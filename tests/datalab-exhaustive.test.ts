// Every distinct attempt (both files) with every combination of remove/keep decisions: the sentences the player is
// told are rebuilt independently from the files as they stand, the lens is checked, and the numbers read off the
// cleaned files are recomputed with a second implementation. Pure model, no canvas.
import { describe, expect, it, vi } from 'vitest';
import { LEVEL_DATA } from '../src/data/sports';
import { RUNNING } from '../src/rooms/content/running';
import { createTraceDesk, type Rng, type TraceDesk } from '../src/rooms/datalab/model';
import { DIALOGUE_BOX, wrapText } from '../src/render/DialogueBox';

vi.mock('../src/audio/Sfx', () => ({ sfx: { play: () => {} } }));

const content = RUNNING.data;
const sport = LEVEL_DATA[3]!;
const BOTH = ['Lactate Profile', 'Critical Speed Test'];

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

const make = (seed: number) => createTraceDesk(content, sport, { tests: BOTH, rng: seeded(seed) });

/** One seed for each distinct attempt. */
const attempts = (): number[] => {
  const seen = new Map<string, number>();
  for (let seed = 1; seed <= 600; seed++) {
    const desk = make(seed);
    const key = desk.suspects.map(s => `${s.kind}@${s.place.type}${s.place.index}`).join(' ');
    if (!seen.has(key)) seen.set(key, seed);
  }
  return [...seen.values()];
};

const fill = (template: string, values: Record<string, string>): string => template.replace(/\{(\w+)\}/g, (_, k: string) => values[k] ?? `<${k}?>`);
const mmss = (seconds: number): string => {
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const pace = (kmh: number): string => mmss(3600 / (Math.round(kmh * 10) / 10));

/** What the software should say about suspect `i`, rebuilt from the files as they stand. */
const expectedSeen = (desk: TraceDesk, i: number): string => {
  const s = desk.suspects[i]!;
  if (s.place.type === 'trial') {
    const t = desk.trials[s.place.index]!;
    const perKm = (x: { metres: number; seconds: number }) => mmss((x.seconds * 1000) / x.metres);
    const others = desk.trials.filter((x, k) => k !== s.place.index && x.present).map(perKm);
    const template = s.kind === 'mistimed' ? content.trials.mistimed.seen : content.trials.fastest.seen;
    return fill(template, { m: String(t.metres), time: mmss(t.seconds), pace: perKm(t), others: others.join(' and ') });
  }
  const lac = content.lactate;
  let template = s.kind === 'knee' ? lac.knee.seen : s.kind === 'peak' ? lac.peak.seen : s.kind === 'failed' ? lac.failed.seen : lac.contaminated.seen;
  if (s.kind === 'knee') {
    const upTo = desk.stages.filter((st, k) => st.present && k <= s.place.index).map(st => st.mmol);
    const rises = upTo.slice(1).map((v, j) => v - upTo[j]!);
    const last = rises[rises.length - 1];
    if (last === undefined || last <= 0 || rises.slice(0, -1).some(r => r >= last)) template = lac.kneePlain;
  }
  const present = desk.stages.map((st, k) => ({ st, k })).filter(x => x.st.present);
  const before = [...present].reverse().find(x => x.k < s.place.index)?.st;
  const after = present.find(x => x.k > s.place.index)?.st;
  const here = desk.stages[s.place.index]!;
  return fill(template, { kmh: String(here.kmh), value: here.mmol.toFixed(1), before: before?.mmol.toFixed(1) ?? '', after: after?.mmol.toFixed(1) ?? '' });
};

/** The speed at which the stages still in the file first reach `mmol`, walking the line segment by segment. */
const firstCrossing = (pts: readonly { kmh: number; mmol: number }[], mmol: number): number | null => {
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

/** Critical speed (km/h) and D prime (m) by the normal equations of least squares. */
const fitCs = (trials: readonly { metres: number; seconds: number }[]) => {
  const n = trials.length;
  const sx = trials.reduce((a, t) => a + t.seconds, 0);
  const sy = trials.reduce((a, t) => a + t.metres, 0);
  const sxx = trials.reduce((a, t) => a + t.seconds * t.seconds, 0);
  const sxy = trials.reduce((a, t) => a + t.seconds * t.metres, 0);
  const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx);
  return { kmh: slope * 3.6, dPrime: (sy - slope * sx) / n };
};

describe('every attempt under every combination of decisions', () => {
  const seeds = attempts();

  it('finds every distinct attempt: one or two lactate glitches (13 and 16 km/h) with each mistimed trial', () => {
    // lactate: either kind at 13 or 16 km/h (4), or both kinds at 13 and 16 (2); trials: 2400 m or 3600 m mistimed
    expect(seeds.length).toBe(12);
  });

  it('tells the player exactly what the content says, filled from the files as they stand, in the box', () => {
    let checked = 0;
    let expected = 0;
    for (const seed of seeds) {
      const n = make(seed).suspects.length;
      expected += (1 << n) * n;
      for (let mask = 0; mask < 1 << n; mask++) {
        const desk = make(seed);
        for (let i = 0; i < n; i++) {
          const said = desk.seen(i);
          expect(said).toBe(expectedSeen(desk, i));
          expect(wrapText(`${desk.ask(i)} ${said}`, DIALOGUE_BOX.chars).length).toBeLessThanOrEqual(DIALOGUE_BOX.lines);
          const verdict = desk.decide(i, ((mask >> i) & 1) === 1)!;
          expect(wrapText(verdict.why, DIALOGUE_BOX.chars).length).toBeLessThanOrEqual(DIALOGUE_BOX.lines);
          expect(wrapText(verdict.result, 15).length).toBeLessThanOrEqual(6); // the banner beside the lens
          expect(desk.seen(i)).toBe(said);
          checked++;
        }
      }
    }
    expect(checked).toBe(expected);
  });

  it('draws a sound lens for every lactate reading in every state, and one for every trial', () => {
    for (const seed of seeds) {
      const n = make(seed).suspects.length;
      for (let mask = 0; mask < 1 << n; mask++) {
        const desk = make(seed);
        for (let i = 0; i < n; i++) {
          const lens = desk.lens(i);
          const dots = lens.dots;
          expect(dots.length).toBeGreaterThanOrEqual(2);
          expect(dots.length).toBeLessThanOrEqual(5);
          expect(dots[lens.suspect]!.role).toBe('suspect');
          for (const d of dots) {
            expect(Number.isFinite(d.value)).toBe(true);
            expect(d.text).toMatch(desk.suspects[i]!.file === 'lactate' ? /^\d+\.\d$/ : /^\d+:\d\d$/);
          }
          for (let k = 1; k < dots.length; k++) expect(dots[k]!.at).toBeGreaterThan(dots[k - 1]!.at);
          expect(lens.repair).not.toContain(lens.suspect);
          if (lens.suspect > 0) expect(lens.repair).toContain(lens.suspect - 1);
          if (lens.suspect < dots.length - 1) expect(lens.repair).toContain(lens.suspect + 1);
          desk.decide(i, ((mask >> i) & 1) === 1);
        }
      }
    }
  });

  it('reads the thresholds, critical speed, D prime and the rows off the cleaned files the way an independent calculation does', () => {
    for (const seed of seeds) {
      const n = make(seed).suspects.length;
      for (let mask = 0; mask < 1 << n; mask++) {
        const desk = make(seed);
        desk.suspects.forEach((_, i) => desk.decide(i, ((mask >> i) & 1) === 1));
        const d = desk.derived();
        const pts = desk.stages.filter(s => s.present);
        const low = Math.min(...pts.map(p => p.mmol));
        const lt1 = firstCrossing(pts, low + content.lactate.lt1Rise);
        const lt2 = firstCrossing(pts, content.lactate.lt2Mmol);
        for (const [mine, theirs, p] of [[d.lt1Kmh, lt1, d.lt1Pace], [d.lt2Kmh, lt2, d.lt2Pace]] as const) {
          if (theirs === null) {
            expect(mine).toBeNull(); // the curve never gets there once the readings that reach it are gone
            expect(p).toBeNull();
          } else {
            expect(mine).toBeCloseTo(theirs, 9);
            expect(p).toBe(pace(theirs));
          }
        }
        const kept = desk.trials.filter(t => t.present);
        const fit = kept.length >= 2 ? fitCs(kept) : null;
        if (fit) {
          expect(d.csKmh).toBeCloseTo(fit.kmh, 9);
          expect(d.csPace).toBe(pace(fit.kmh));
          expect(d.dPrime).toBe(Math.round(fit.dPrime / 10) * 10);
        } else {
          expect([d.csKmh, d.csPace, d.dPrime]).toEqual([null, null, null]);
        }

        const right = desk.suspects.every(s => s.real === (s.decision === 'kept'));
        for (const row of desk.rows()) {
          expect(row.shown).not.toMatch(/NaN|undefined|null|Infinity/);
          expect(row.shown.endsWith('?')).toBe(row.odd);
          if (right) expect(row.odd).toBe(false);
          if (row.feature === 'lt1') expect(row.odd).toBe(lt1 === null || pace(lt1) !== '4:08');
          if (row.feature === 'cs') expect(row.odd).toBe(!fit || pace(fit.kmh) !== '3:22');
          if (row.feature === 'vo2max' || row.feature === 'vvo2max') expect(row.odd).toBe(false);
        }
        const rightCount = desk.suspects.filter(s => s.real === (s.decision === 'kept')).length;
        expect(desk.cleanScore()).toBeCloseTo(rightCount / n, 12);
        expect(desk.result().dataQuality).toBeCloseTo(0.5 + 0.3 * (rightCount / n), 12);
      }
    }
  });
});
