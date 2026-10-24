// Every attempt (all 20 distinct files) with every combination of remove/keep decisions: the sentences the player is
// told are rebuilt independently from the file as it stands, the lens is checked, and the numbers read off the
// cleaned file are recomputed with a second implementation. Pure model, no canvas.
import { describe, expect, it, vi } from 'vitest';
import { LEVEL_DATA } from '../src/data/sports';
import { RUNNING } from '../src/rooms/content/running';
import { createTraceDesk, type Rng, type TraceDesk } from '../src/rooms/datalab/model';
import { DIALOGUE_BOX, wrapText } from '../src/render/DialogueBox';

vi.mock('../src/audio/Sfx', () => ({ sfx: { play: () => {} } }));

const content = RUNNING.data;
const sport = LEVEL_DATA[3]!;

const seeded = (seed: number): Rng => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** One seed for each distinct attempt. */
const attempts = (): number[] => {
  const seen = new Map<string, number>();
  for (let seed = 1; seed <= 600 && seen.size < 20; seed++) {
    const desk = createTraceDesk(content, sport, seeded(seed));
    const key = desk.suspects.map(s => `${s.kind}@${s.place.type}${s.place.index}`).join(' ');
    if (!seen.has(key)) seen.set(key, seed);
  }
  return [...seen.values()];
};

/** The content sentence with {slots} filled from `values`. */
const fill = (template: string, values: Record<string, string>): string => template.replace(/\{(\w+)\}/g, (_, k: string) => values[k] ?? `<${k}?>`);

/** What the software should say about suspect `i` of `desk`, rebuilt from the file as it stands. */
const expectedSeen = (desk: TraceDesk, i: number): string => {
  const s = desk.suspects[i]!;
  let template = content[s.kind].seen;
  if (s.kind === 'knee') {
    // the content's knee line claims the steepest rise so far: true only if the readings still in the file rise that way
    const upTo = desk.stages.filter((st, k) => st.present && k <= s.place.index).map(st => st.mmol);
    const rises = upTo.slice(1).map((v, j) => v - upTo[j]!);
    const last = rises[rises.length - 1];
    if (last === undefined || last <= 0 || rises.slice(0, -1).some(r => r >= last)) template = content.kneePlain;
  }
  if (s.place.type === 'sprint') {
    const run = desk.sprints[s.place.index]!;
    const others = desk.sprints.filter((x, k) => k !== s.place.index && x.present).map(x => x.time.toFixed(2));
    return fill(template, { n: String(run.n), time: run.time.toFixed(2), speed: ((content.sprintMetres / run.time) * 3.6).toFixed(1), others: others.join(' and ') });
  }
  const present = desk.stages.map((st, k) => ({ st, k })).filter(x => x.st.present);
  const before = [...present].reverse().find(x => x.k < s.place.index)?.st;
  const after = present.find(x => x.k > s.place.index)?.st;
  const here = desk.stages[s.place.index]!;
  return fill(template, { kmh: String(here.kmh), value: here.mmol.toFixed(1), before: before?.mmol.toFixed(1) ?? '', after: after?.mmol.toFixed(1) ?? '' });
};

/** The speed at which the stages still in the file first reach `mmol`, by walking the line segment by segment. */
const firstCrossing = (desk: TraceDesk, mmol: number): number | null => {
  const pts = desk.stages.filter(s => s.present);
  for (let k = 0; k < pts.length; k++) {
    const p = pts[k]!;
    if (p.mmol >= mmol) {
      if (k === 0) return p.kmh;
      const q = pts[k - 1]!;
      return q.kmh + ((mmol - q.mmol) * (p.kmh - q.kmh)) / (p.mmol - q.mmol);
    }
  }
  return null;
};

const pace = (kmh: number): string => {
  const s = Math.round(3600 / kmh);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

describe('every attempt under every combination of decisions', () => {
  const seeds = attempts();

  it('finds all 20 attempts', () => {
    expect(seeds.length).toBe(20);
  });

  it('tells the player exactly what the content says, filled from the file as it stands', () => {
    let checked = 0;
    for (const seed of seeds) {
      const n = createTraceDesk(content, sport, seeded(seed)).suspects.length;
      for (let mask = 0; mask < 1 << n; mask++) {
        const desk = createTraceDesk(content, sport, seeded(seed));
        for (let i = 0; i < n; i++) {
          // before deciding: the description is the content's, filled from the file as it stands now
          const said = desk.seen(i);
          expect(said).toBe(expectedSeen(desk, i));
          expect(wrapText(said, DIALOGUE_BOX.chars).length).toBeLessThanOrEqual(DIALOGUE_BOX.lines);
          const verdict = desk.decide(i, ((mask >> i) & 1) === 1)!;
          expect(wrapText(verdict.why, DIALOGUE_BOX.chars).length).toBeLessThanOrEqual(DIALOGUE_BOX.lines);
          expect(wrapText(verdict.result, 17).length).toBeLessThanOrEqual(3); // the banner beside the lens
          expect(verdict.why).toBe(content[desk.suspects[i]!.kind].why);
          // after deciding: the picture the player saw stays as it was
          expect(desk.seen(i)).toBe(said);
          checked++;
        }
      }
    }
    expect(checked).toBe(1856); // 20 attempts x every combination of decisions x every suspect
  });

  it('draws a sound lens for every suspect in every state: the reading, its neighbours, a line across the gap', () => {
    for (const seed of seeds) {
      const n = createTraceDesk(content, sport, seeded(seed)).suspects.length;
      for (let mask = 0; mask < 1 << n; mask++) {
        const desk = createTraceDesk(content, sport, seeded(seed));
        for (let i = 0; i < n; i++) {
          const lens = desk.lens(i);
          const dots = lens.dots;
          expect(dots.length).toBeGreaterThanOrEqual(2);
          expect(dots.length).toBeLessThanOrEqual(5);
          expect(dots[lens.suspect]!.role).toBe('suspect');
          expect(dots.filter(d => d.role === 'suspect').length).toBe(1);
          for (const d of dots) {
            expect(Number.isFinite(d.value)).toBe(true);
            expect(d.text).toMatch(/^\d+\.\d+$/);
          }
          for (let k = 1; k < dots.length; k++) expect(dots[k]!.at).toBeGreaterThan(dots[k - 1]!.at); // in file order
          expect(lens.repair).not.toContain(lens.suspect);
          for (let k = 1; k < lens.repair.length; k++) expect(lens.repair[k]!).toBeGreaterThan(lens.repair[k - 1]!);
          for (const r of lens.repair) expect(r >= 0 && r < dots.length).toBe(true);
          // the readings either side of the suspect are on the line whenever they exist
          if (lens.suspect > 0) expect(lens.repair).toContain(lens.suspect - 1);
          if (lens.suspect < dots.length - 1) expect(lens.repair).toContain(lens.suspect + 1);
          desk.decide(i, ((mask >> i) & 1) === 1);
        }
      }
    }
  });

  it('reads the thresholds, the sprint and the rows off the cleaned file the way an independent calculation does', () => {
    for (const seed of seeds) {
      const n = createTraceDesk(content, sport, seeded(seed)).suspects.length;
      for (let mask = 0; mask < 1 << n; mask++) {
        const desk = createTraceDesk(content, sport, seeded(seed));
        desk.suspects.forEach((_, i) => desk.decide(i, ((mask >> i) & 1) === 1));
        const d = desk.derived();
        const lt1 = firstCrossing(desk, content.lt1Mmol)!;
        const lt2 = firstCrossing(desk, content.lt2Mmol)!;
        expect(d.lt1Kmh).toBeCloseTo(lt1, 9);
        expect(d.lt2Kmh).toBeCloseTo(lt2, 9);
        expect(d.lt1Pace).toBe(pace(lt1));
        expect(d.lt2Pace).toBe(pace(lt2));
        const fastest = Math.min(...desk.sprints.filter(s => s.present).map(s => s.time));
        expect(d.sprintKmh).toBeCloseTo((content.sprintMetres / fastest) * 3.6, 9);
        expect(d.vvo2Kmh).toBe(content.vvo2maxKmh);

        // a row says '?' exactly when the player's own number differs from the one in its name
        const right = desk.suspects.every(s => s.real === (s.decision === 'kept'));
        for (const row of desk.rows()) {
          expect(row.shown).not.toMatch(/NaN|undefined|null/);
          const name = sport.variables[row.variable]!.name;
          if (row.feature === 'lt1') expect(row.odd).toBe(pace(lt1) !== '3:45');
          else if (row.feature === 'lt2') expect(row.odd).toBe(pace(lt2) !== '3:20');
          else if (row.feature === 'sprint') expect(row.odd).toBe(Math.round((content.sprintMetres / fastest) * 3.6) !== 28);
          else expect(row.odd).toBe(false);
          expect(row.shown).toBe(row.odd ? row.shown : name);
          expect(row.shown.endsWith('?')).toBe(row.odd);
          if (right) expect(row.odd).toBe(false);
        }
        // the score is right decisions over suspects, whatever the pins
        const rightCount = desk.suspects.filter(s => s.real === (s.decision === 'kept')).length;
        expect(desk.cleanScore()).toBeCloseTo(rightCount / n, 12);
        expect(desk.result().dataQuality).toBeCloseTo(0.5 + 0.3 * (rightCount / n), 12);
      }
    }
  });
});
