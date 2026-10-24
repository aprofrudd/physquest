// The Trace Desk's rules: the file each attempt builds, the clean-up verdicts, the numbers read off the cleaned
// file, the pins, the reveal and the score bands (perfect, mistakes, random, worst).
import { describe, expect, it, vi } from 'vitest';
import { LEVEL_DATA } from '../src/data/sports';
import { RUNNING } from '../src/rooms/content/running';
import {
  ODD_NUMBER,
  crossing,
  createTraceDesk,
  fillSlots,
  pinFullLine,
  pinsPlacedLine,
  speedKmh,
  type Rng,
  type TraceDesk,
} from '../src/rooms/datalab/model';
import { paceOf } from '../src/rooms/datalab/names';
import { DIALOGUE_BOX, wrapText } from '../src/render/DialogueBox';

// wrapText lives beside the dialogue box, which pulls in the sound module: keep it silent and off the browser
vi.mock('../src/audio/Sfx', () => ({ sfx: { play: () => {} } }));

const content = RUNNING.data;
const sport = LEVEL_DATA[3]!;

/** A small seeded random source (mulberry32): the same seed always plays the same attempt. */
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

const deskFor = (seed: number): TraceDesk => createTraceDesk(content, sport, seeded(seed));

/** The first seed whose attempt satisfies `want` (every scenario below turns up within a few hundred seeds). */
const findDesk = (want: (desk: TraceDesk) => boolean): TraceDesk => {
  for (let seed = 1; seed < 5000; seed++) {
    const desk = deskFor(seed);
    if (want(desk)) return desk;
  }
  throw new Error('no seed gives that attempt');
};

const kindsOf = (desk: TraceDesk) => desk.suspects.map(s => s.kind);
const at = (desk: TraceDesk, kind: string) => desk.suspects.findIndex(s => s.kind === kind);

describe('the clean file', () => {
  const clean = content.stages.map(s => ({ kmh: s.kmh, mmol: s.mmol }));

  it('puts LT1 and LT2 exactly at 16.0 and 18.0 km/h, which is 3:45 and 3:20 per km', () => {
    expect(crossing(clean, content.lt1Mmol)).toBe(16);
    expect(crossing(clean, content.lt2Mmol)).toBe(18);
    expect(paceOf(16)).toBe('3:45');
    expect(paceOf(18)).toBe('3:20');
  });

  it('gives a best flying 30 m of 28 km/h and vVO2max of 20.6 km/h (2:55 per km)', () => {
    const fastest = Math.min(...content.sprintTimes);
    expect(Math.round(speedKmh(content.sprintMetres, fastest))).toBe(28);
    expect(paceOf(content.vvo2maxKmh)).toBe('2:55');
  });

  it('interpolates between stages and never reaches a line above the data', () => {
    expect(crossing(clean, 3)).toBeCloseTo(17 + (3 - 2.7) / (4.0 - 2.7), 6); // between 17 and 18 km/h
    expect(crossing(clean, 20)).toBeNull();
    expect(crossing([{ kmh: 14, mmol: 3 }], 2)).toBe(14); // already above the line at the first reading
  });
});

describe('building an attempt', () => {
  it('always flags the knee (18 km/h) and the peak (20 km/h) as real, and 2 or 3 glitches', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const desk = deskFor(seed);
      const knee = desk.suspects.find(s => s.kind === 'knee')!;
      const peak = desk.suspects.find(s => s.kind === 'peak')!;
      expect(desk.stages[knee.place.index]!.kmh).toBe(18);
      expect(desk.stages[peak.place.index]!.kmh).toBe(20);
      expect(knee.real && peak.real).toBe(true);
      const glitches = desk.suspects.filter(s => !s.real);
      expect([2, 3]).toContain(glitches.length);
      expect(desk.suspects.length).toBe(2 + glitches.length);
      expect(new Set(glitches.map(g => g.kind)).size).toBe(glitches.length); // each kind at most once
    }
  });

  it('orders suspects left to right along the chart with the sprint last', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const desk = deskFor(seed);
      const stageIdx = desk.suspects.filter(s => s.place.type === 'stage').map(s => s.place.index);
      expect(stageIdx).toEqual([...stageIdx].sort((a, b) => a - b));
      const sprintAt = desk.suspects.findIndex(s => s.place.type === 'sprint');
      if (sprintAt >= 0) expect(sprintAt).toBe(desk.suspects.length - 1);
    }
  });

  it('puts stage glitches at 15 or 17 km/h (never the stage that carries LT1), never next to each other, with the content\'s glitch values', () => {
    for (let seed = 1; seed <= 500; seed++) {
      const desk = deskFor(seed);
      const stageGlitches = desk.suspects.filter(s => !s.real && s.place.type === 'stage');
      for (const g of stageGlitches) {
        const stage = desk.stages[g.place.index]!;
        expect([15, 17]).toContain(stage.kmh);
        const truth = content.stages[g.place.index]!.mmol;
        if (g.kind === 'contaminated') expect(stage.mmol).toBeCloseTo(truth + content.contaminatedRise, 6);
        else expect(stage.mmol).toBe(0);
      }
      if (stageGlitches.length === 2) {
        expect(Math.abs(stageGlitches[0]!.place.index - stageGlitches[1]!.place.index)).toBeGreaterThan(1);
      }
      const misfire = desk.suspects.find(s => s.kind === 'misfire');
      if (misfire) expect(desk.sprints[misfire.place.index]!.time).toBe(content.misfireTime);
      // everything else in the file is the clean data
      desk.stages.forEach((s, i) => {
        if (!desk.suspects.some(x => x.place.type === 'stage' && x.place.index === i && !x.real)) expect(s.mmol).toBe(content.stages[i]!.mmol);
      });
    }
  });

  it('is the same attempt for the same seed and a different one for another (replays re-roll)', () => {
    const a = deskFor(11);
    const b = deskFor(11);
    expect(kindsOf(a)).toEqual(kindsOf(b));
    expect(a.order).toEqual(b.order);
    const signatures = new Set<string>();
    for (let seed = 1; seed <= 200; seed++) {
      const d = deskFor(seed);
      signatures.add(`${d.suspects.map(s => `${s.kind}@${s.place.index}`).join(',')}|${d.order.join('')}`);
    }
    expect(signatures.size).toBeGreaterThan(50);
  });

  it('reaches every glitch combination: each kind, each stage, each sprint', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 600; seed++) {
      for (const s of deskFor(seed).suspects) if (!s.real) seen.add(`${s.kind}@${s.place.index}`);
    }
    for (const stage of [1, 3]) {
      expect(seen.has(`contaminated@${stage}`)).toBe(true);
      expect(seen.has(`failed@${stage}`)).toBe(true);
    }
    for (const sprint of [0, 1, 2]) expect(seen.has(`misfire@${sprint}`)).toBe(true);
  });

  it('shuffles the pin list per attempt and keeps every variable in it once', () => {
    const orders = new Set<string>();
    for (let seed = 1; seed <= 100; seed++) {
      const d = deskFor(seed);
      expect([...d.order].sort()).toEqual([0, 1, 2, 3, 4]);
      orders.add(d.order.join(''));
    }
    expect(orders.size).toBeGreaterThan(10);
  });

  it('asks for as many pins as there are key variables in sports.ts', () => {
    expect(deskFor(1).pinLimit).toBe(sport.variables.filter(v => v.correct).length);
    expect(deskFor(1).pinLimit).toBe(3);
  });
});

describe('what the player is shown', () => {
  it('fills every slot of the content sentences and never leaves a brace behind', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const desk = deskFor(seed);
      desk.suspects.forEach((_, i) => {
        const text = desk.seen(i);
        expect(text).not.toMatch(/[{}]/);
        expect(text.length).toBeGreaterThan(20);
      });
    }
  });

  it('describes a contaminated sample with the stage, the reading and the stages either side', () => {
    const desk = findDesk(d => d.suspects.some(s => s.kind === 'contaminated' && s.place.index === 3));
    const i = at(desk, 'contaminated');
    expect(desk.seen(i)).toBe('At 17 km/h lactate reads 6.2 mmol/L. The stages either side read 2.0 and 4.0.');
  });

  it('describes a failed sample as 0.0 and names the neighbours', () => {
    const desk = findDesk(d => d.suspects.some(s => s.kind === 'failed' && s.place.index === 1));
    expect(desk.seen(at(desk, 'failed'))).toBe('At 15 km/h lactate reads 0.0 mmol/L. The stages either side read 1.1 and 2.0.');
  });

  it('describes a misfired sprint with its speed and the other two times', () => {
    const desk = findDesk(d => d.suspects.some(s => s.kind === 'misfire' && s.place.index === 1));
    expect(desk.seen(at(desk, 'misfire'))).toBe(
      'Sprint 2 reads 3.21 s, which is 33.6 km/h. Her other two runs were 3.89 and 3.88 s.',
    );
  });

  it('describes the real readings from the content', () => {
    const desk = deskFor(5);
    // The player meets the readings left to right: with the glitches before the knee taken out, it is a steep rise
    const knee = at(desk, 'knee');
    desk.suspects.forEach((s, i) => {
      if (!s.real && s.place.type === 'stage' && s.place.index < desk.suspects[knee]!.place.index) desk.decide(i, true);
    });
    expect(desk.seen(knee)).toBe("At 18 km/h lactate jumps to 4.0 mmol/L, its steepest rise so far.");
    expect(desk.seen(at(desk, 'peak'))).toBe('The last stage reads 9.1 mmol/L, the highest reading of the test.');
  });

  it('only calls the knee the steepest rise when the file as the player left it rises that way', () => {
    // A contaminated reading kept at 17 km/h (6.2) leaves 18 km/h (4.0) as a fall: the lens then just says what it reads
    const desk = findDesk(d => d.suspects.some(s => s.kind === 'contaminated' && s.place.index === 3));
    const c = at(desk, 'contaminated');
    desk.decide(c, false); // kept: the glitch stays in the file
    expect(desk.seen(at(desk, 'knee'))).toBe('At 18 km/h lactate reads 4.0 mmol/L. The stages either side read 6.2 and 6.3.');
    expect(content.kneePlain).toBe('At {kmh} km/h lactate reads {value} mmol/L. The stages either side read {before} and {after}.');
  });

  it('shows the lens as the suspect plus the readings around it, with an IF REMOVED line that skips the suspect', () => {
    const desk = findDesk(d => d.suspects.some(s => s.kind === 'contaminated' && s.place.index === 3));
    const lens = desk.lens(at(desk, 'contaminated'));
    expect(lens.dots.length).toBe(5);
    expect(lens.dots[lens.suspect]!.role).toBe('suspect');
    expect(lens.repair).not.toContain(lens.suspect);
    expect(lens.dots.map(d => d.text)).toContain('6.2');
    // the repair line runs through the readings either side and the unflagged ones
    for (const idx of lens.repair) expect(lens.dots[idx]!.role === 'normal' || Math.abs(idx - lens.suspect) === 1).toBe(true);
  });

  it('pushes the lens window along at the end of the file (the peak shows the stages before it)', () => {
    const desk = deskFor(2);
    const lens = desk.lens(at(desk, 'peak'));
    expect(lens.dots.length).toBe(5);
    expect(lens.suspect).toBe(4);
    expect(lens.dots.map(d => d.at)).toEqual([16, 17, 18, 19, 20]);
  });

  it('marks other undecided flagged readings in a lens and keeps the far ones off the repair line', () => {
    const desk = findDesk(d => d.suspects.filter(s => !s.real && s.place.type === 'stage').length === 2);
    const first = desk.suspects.findIndex(s => !s.real && s.place.type === 'stage');
    const lens = desk.lens(first);
    const flagged = lens.dots.filter(d => d.role === 'flagged');
    expect(flagged.length).toBeGreaterThan(0);
    // a flagged reading further than one place away is not on the line; the readings either side always are
    lens.dots.forEach((d, i) => {
      const nextTo = Math.abs(i - lens.suspect) === 1;
      if (i === lens.suspect) expect(lens.repair).not.toContain(i);
      else if (nextTo) expect(lens.repair).toContain(i);
      else expect(lens.repair.includes(i)).toBe(d.role === 'normal');
    });
  });

  it('runs the IF REMOVED line through the real reading next door (the knee beside a glitch at 17 km/h)', () => {
    const desk = findDesk(d => d.suspects.some(s => s.kind === 'contaminated' && s.place.index === 3));
    const lens = desk.lens(at(desk, 'contaminated'));
    const next = lens.dots[lens.suspect + 1]!;
    expect(next.text).toBe('4.0'); // the knee, flagged too
    expect(lens.repair).toContain(lens.suspect + 1);
  });

  it('keeps the picture the player saw after the file changes under it', () => {
    const desk = findDesk(d => d.suspects.filter(s => !s.real && s.place.type === 'stage').length === 2);
    const stageGlitch = desk.suspects.findIndex(s => !s.real && s.place.type === 'stage');
    const before = desk.seen(stageGlitch);
    const lensBefore = desk.lens(stageGlitch);
    desk.decide(stageGlitch, true);
    expect(desk.seen(stageGlitch)).toBe(before);
    expect(desk.lens(stageGlitch)).toBe(lensBefore);
  });

  it('recomputes a later suspect from the cleaned file (a removed neighbour is skipped)', () => {
    const desk = findDesk(d => d.suspects.some(s => s.kind === 'contaminated' && s.place.index === 3));
    const c = at(desk, 'contaminated');
    const k = at(desk, 'knee');
    desk.decide(c, true); // 17 km/h gone
    expect(desk.lens(k).dots.map(d => d.at)).not.toContain(17);
    expect(desk.seen(k)).toContain('18 km/h');
  });
});

describe('clean-up decisions', () => {
  it('says what the content says about each of the four outcomes', () => {
    const desk = findDesk(d => d.suspects.some(s => s.kind === 'contaminated') && d.suspects.some(s => s.kind === 'failed'));
    const c = at(desk, 'contaminated');
    const f = at(desk, 'failed');
    const knee = at(desk, 'knee');
    const peak = at(desk, 'peak');
    expect(desk.decide(c, true)).toEqual({ right: true, result: 'Good catch: a glitch, not Aisha.', why: content.contaminated.why });
    expect(desk.decide(f, false)).toEqual({ right: false, result: 'Missed: that glitch is still in the file.', why: content.failed.why });
    expect(desk.decide(knee, false)).toEqual({ right: true, result: 'Right: that is real data.', why: content.knee.why });
    expect(desk.decide(peak, true)).toEqual({
      right: false,
      result: 'That was real: you have clipped it from the file.',
      why: content.peak.why,
    });
  });

  it('removes a point only when A removes it, and counts decisions', () => {
    const desk = deskFor(3);
    expect(desk.decided()).toBe(0);
    desk.decide(0, false);
    expect(desk.stages.every(s => s.present)).toBe(true);
    desk.decide(1, true);
    const gone = desk.suspects[1]!;
    const present = gone.place.type === 'stage' ? desk.stages[gone.place.index]!.present : desk.sprints[gone.place.index]!.present;
    expect(present).toBe(false);
    expect(desk.decided()).toBe(2);
  });

  it('refuses a second decision on the same suspect', () => {
    const desk = deskFor(4);
    expect(desk.decide(0, true)).not.toBeNull();
    expect(desk.decide(0, false)).toBeNull();
    expect(desk.suspects[0]!.decision).toBe('removed');
  });

  it('draws the sprint lens from the three runs and joins the other two', () => {
    const desk = findDesk(d => d.suspects.some(s => s.kind === 'misfire' && s.place.index === 0));
    const lens = desk.lens(at(desk, 'misfire'));
    expect(lens.dots.map(d => d.text)).toEqual(['3.21', '3.86', '3.88']);
    expect(lens.repair).toEqual([1, 2]);
  });
});

describe('the file as cleaned', () => {
  const perfect = (desk: TraceDesk) => desk.suspects.forEach((s, i) => desk.decide(i, !s.real));

  it('reads exactly 16.0, 18.0 and 28 km/h again once every glitch is removed and every real reading kept', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const desk = deskFor(seed);
      perfect(desk);
      const d = desk.derived();
      expect(d.lt1Kmh).toBe(16);
      expect(d.lt2Kmh).toBe(18);
      expect(d.lt1Pace).toBe('3:45');
      expect(d.lt2Pace).toBe('3:20');
      expect(Math.round(d.sprintKmh)).toBe(28);
      expect(d.vvo2Kmh).toBe(content.vvo2maxKmh);
      expect(desk.rows().every(r => !r.odd)).toBe(true);
      expect(desk.rows().map(r => r.shown)).toEqual(desk.order.map(i => sport.variables[i]!.name));
    }
  });

  it('pulls LT1 and LT2 both back to 14 km/h when a contaminated reading stays in at 15 km/h', () => {
    const desk = findDesk(d => d.suspects.some(s => s.kind === 'contaminated' && s.place.index === 1));
    desk.suspects.forEach((s, i) => desk.decide(i, !s.real && s.kind !== 'contaminated')); // keep that glitch
    const d = desk.derived();
    expect(d.lt1Kmh).toBeCloseTo(14 + (2.0 - 1.1) / (4.9 - 1.1), 6); // 14.237
    expect(d.lt2Kmh).toBeCloseTo(14 + (4.0 - 1.1) / (4.9 - 1.1), 6); // 14.763
    expect(d.lt1Pace).toBe('4:13');
    const lt1 = desk.rows().find(r => r.feature === 'lt1')!;
    expect(lt1.shown).toBe('LT1 Pace (4:13/km)?');
    expect(lt1.odd).toBe(true);
    expect(desk.rows().find(r => r.feature === 'lt2')!.odd).toBe(true);
  });

  it('leaves LT1 alone and pulls LT2 earlier when a contaminated reading stays in at 17 km/h', () => {
    const desk = findDesk(d => d.suspects.some(s => s.kind === 'contaminated' && s.place.index === 3));
    desk.suspects.forEach((s, i) => desk.decide(i, !s.real && s.kind !== 'contaminated'));
    expect(desk.derived().lt1Kmh).toBe(16);
    expect(desk.derived().lt2Kmh).toBeCloseTo(16 + (4.0 - 2.0) / (6.2 - 2.0), 6);
    expect(desk.rows().find(r => r.feature === 'lt1')!.odd).toBe(false);
    expect(desk.rows().find(r => r.feature === 'lt2')!.odd).toBe(true);
  });

  it('reads LT2 off the line between the neighbours when the real knee is clipped from the file', () => {
    const desk = deskFor(21);
    desk.suspects.forEach((s, i) => desk.decide(i, !s.real || s.kind === 'knee'));
    const d = desk.derived();
    expect(d.lt2Kmh).not.toBe(18);
    expect(d.lt2Kmh).toBe(crossing(desk.points(), content.lt2Mmol));
    const row = desk.rows().find(r => r.feature === 'lt2')!;
    expect(row.odd).toBe(true);
    expect(row.shown.startsWith('LT2 Pace (')).toBe(true);
    expect(row.shown.endsWith('/km)?')).toBe(true);
    expect(row.shown).not.toBe('LT2 Pace (3:20/km)?');
  });

  it('raises max sprint speed when the misfired time stays in the file', () => {
    const desk = findDesk(d => d.suspects.some(s => s.kind === 'misfire'));
    desk.suspects.forEach((s, i) => desk.decide(i, !s.real && s.kind !== 'misfire'));
    expect(Math.round(desk.derived().sprintKmh)).toBe(34);
    expect(desk.rows().find(r => r.feature === 'sprint')!.shown).toBe('Max Sprint Speed (34 km/h)?');
  });

  it('never changes VO2max or vVO2max whatever the clean-up does', () => {
    for (const remove of [true, false]) {
      const desk = deskFor(9);
      desk.suspects.forEach((_, i) => desk.decide(i, remove));
      for (const r of desk.rows()) {
        if (r.feature === 'vo2max' || r.feature === 'vvo2max') expect(r.shown).toBe(r.name);
      }
    }
  });

  it('shows a placeholder when the line never reaches the threshold', () => {
    const desk = findDesk(d => !d.suspects.some(s => s.kind === 'contaminated'));
    desk.stages.forEach(s => {
      if (s.kmh >= 17) s.present = false;
    });
    desk.decide(0, false); // a decision bumps the version, so the cached numbers are read again
    const lt2 = desk.rows().find(r => r.feature === 'lt2')!;
    expect(desk.derived().lt2Kmh).toBeNull();
    expect(lt2.shown).toBe('LT2 Pace (--:--/km)?');
  });
});

describe('pins, reveal and the odd-number hint', () => {
  const keyIdx = sport.variables.map((v, i) => (v.correct ? i : -1)).filter(i => i >= 0);
  const wrongIdx = sport.variables.map((v, i) => (v.correct ? -1 : i)).filter(i => i >= 0);

  it('allows three pins, refuses a fourth, and unpins on a second press', () => {
    const desk = deskFor(1);
    expect(desk.togglePin(0)).toBe('pinned');
    expect(desk.togglePin(1)).toBe('pinned');
    expect(desk.togglePin(2)).toBe('pinned');
    expect(desk.canLock()).toBe(true);
    expect(desk.togglePin(3)).toBe('full');
    expect(desk.pins()).toEqual([0, 1, 2]);
    expect(desk.togglePin(1)).toBe('unpinned');
    expect(desk.canLock()).toBe(false);
    expect(desk.pins()).toEqual([0, 2]);
  });

  it('marks pinned rows and keeps the row objects stable between changes', () => {
    const desk = deskFor(1);
    const rows = desk.rows();
    expect(desk.rows()).toBe(rows);
    desk.togglePin(desk.order[0]!);
    expect(desk.rows()[0]!.pinned).toBe(true);
    expect(desk.rows()[1]!.pinned).toBe(false);
  });

  it('reveals pins in list order, then the key variables missed, then the insight, all from sports.ts', () => {
    const desk = deskFor(8);
    // pin one key variable and two wrong ones
    const pins = [keyIdx[0]!, wrongIdx[0]!, wrongIdx[1]!];
    pins.forEach(p => desk.togglePin(p));
    const lines = desk.reveal();
    const pinnedInOrder = desk.order.filter(i => pins.includes(i));
    expect(lines.slice(0, 3).map(l => l.variable)).toEqual(pinnedInOrder);
    for (const line of lines.slice(0, 3)) {
      const v = sport.variables[line.variable]!;
      expect(line.text).toBe(`${v.correct ? 'Correct!' : 'Not quite.'} ${v.explanation}`);
      expect(line.good).toBe(v.correct);
    }
    const missed = lines.slice(3, 5);
    expect(missed.every(l => l.kind === 'missed')).toBe(true);
    expect(missed.map(l => l.variable).sort()).toEqual(keyIdx.filter(i => i !== keyIdx[0]).sort());
    for (const m of missed) {
      const v = sport.variables[m.variable]!;
      expect(m.text).toBe(`Missed: ${v.name}. ${v.explanation}`);
    }
    expect(lines.at(-1)).toEqual({ text: sport.variableInsight, good: true, variable: -1, kind: 'insight' });
    expect(lines.length).toBe(6);
  });

  it('has no missed lines when all three key variables are pinned', () => {
    const desk = deskFor(8);
    keyIdx.forEach(i => desk.togglePin(i));
    const kinds = desk.reveal().map(l => l.kind);
    expect(kinds).toEqual(['pinned', 'pinned', 'pinned', 'insight']);
  });

  it('carries the odd-number hint as plain wording', () => {
    expect(ODD_NUMBER).toBe('That number looks odd. Did a glitch slip through?');
  });

  it('fills slots and leaves an unknown slot as written', () => {
    expect(fillSlots('At {kmh} km/h {nope}', { kmh: '17' })).toBe('At 17 km/h {nope}');
  });
});

describe('edge cases', () => {
  it('scores nothing decided and nothing pinned as the floor: data quality 0.5, accuracy 0', () => {
    const desk = deskFor(3);
    expect(desk.decided()).toBe(0);
    expect(desk.cleanScore()).toBe(0);
    expect(desk.result()).toEqual({ dataQuality: 0.5, variableAccuracy: 0 });
  });

  it('reveals only the missed key variables and the insight when nothing is pinned', () => {
    const desk = deskFor(3);
    const lines = desk.reveal();
    expect(lines.map(l => l.kind)).toEqual(['missed', 'missed', 'missed', 'insight']);
    expect(lines.slice(0, 3).every(l => l.text.startsWith('Missed: '))).toBe(true);
  });

  it('ignores a suspect that does not exist', () => {
    const desk = deskFor(3);
    expect(desk.decide(-1, true)).toBeNull();
    expect(desk.decide(desk.suspects.length, true)).toBeNull();
    expect(desk.decided()).toBe(0);
  });

  it('reads the clean file when the glitches are removed in any order', () => {
    const desk = deskFor(12);
    [...desk.suspects.keys()].reverse().forEach(i => desk.decide(i, !desk.suspects[i]!.real));
    expect(desk.derived().lt1Pace).toBe('3:45');
    expect(desk.derived().lt2Pace).toBe('3:20');
    expect(desk.cleanScore()).toBe(1);
  });

  it('can remove every flagged reading: the chart keeps the stages that were never flagged', () => {
    const desk = deskFor(12);
    desk.suspects.forEach((_, i) => desk.decide(i, true));
    const kept = desk.stages.filter(s => s.present).map(s => s.kmh);
    expect(kept.length).toBe(desk.stages.length - desk.suspects.filter(s => s.place.type === 'stage').length);
    expect(kept).toContain(14);
    expect(kept).toContain(16);
    expect(desk.sprints.filter(r => r.present).length).toBeGreaterThanOrEqual(2);
  });

  it('keeps the same rows (by object) until a decision or a pin changes the file', () => {
    const desk = deskFor(4);
    const rows = desk.rows();
    expect(desk.rows()).toBe(rows);
    desk.decide(0, true);
    expect(desk.rows()).not.toBe(rows);
  });
});

describe('what the prompt box has to hold', () => {
  const fits = (text: string) => wrapText(text).length <= DIALOGUE_BOX.lines;

  it('fits every description, reason and pin line in the box (four lines of 38 characters)', () => {
    const texts: string[] = [];
    for (const k of ['contaminated', 'failed', 'misfire', 'knee', 'peak'] as const) texts.push(content[k].why);
    for (const feature of Object.values(content.features)) texts.push(feature, `${feature} ${ODD_NUMBER}`);
    texts.push(`Lock in your 3 pins and see how you did. ${ODD_NUMBER}`, pinFullLine(3), pinsPlacedLine(3).replace('{DOWN}', 'DOWN'));
    for (let seed = 1; seed <= 200; seed++) {
      const desk = deskFor(seed);
      desk.suspects.forEach((_, i) => texts.push(desk.seen(i)));
    }
    const tooLong = texts.filter(t => !fits(t));
    expect(tooLong).toEqual([]);
  });

  it('fits the verdict lines in the readout beside the lens (17 characters, 3 lines)', () => {
    for (const result of ['Good catch: a glitch, not Aisha.', 'Right: that is real data.', 'That was real: you have clipped it from the file.', 'Missed: that glitch is still in the file.']) {
      expect(wrapText(result, 17).length).toBeLessThanOrEqual(3);
    }
  });
});

describe('what the room writes can be drawn in the 5x7 font', () => {
  // The glyphs PixelFont has (text is drawn in capitals); anything else would be skipped and leave a gap
  const FONT = new Set([...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,!?:-/()%+=><\'"&#*;_[]—✓★•…→←↑↓▼']);
  // {slots} and {BUTTON} tokens are filled in before anything is drawn
  const unsupported = (text: string): string[] => [...text.replace(/\{\w+\}/g, 'X').toUpperCase()].filter(ch => !FONT.has(ch));

  it('has only drawable characters in the content, the sentences it fills in and the lines it adds', () => {
    const texts: string[] = [content.fileTitle, content.protocol, ...content.rules, content.rulesShort, content.lensRule, content.reserveLabel];
    for (const k of ['contaminated', 'failed', 'misfire', 'knee', 'peak'] as const) texts.push(content[k].seen, content[k].why);
    texts.push(...Object.values(content.features), ...sport.variables.map(v => `${v.name} ${v.explanation}`), sport.variableInsight, ODD_NUMBER);
    texts.push(pinFullLine(3), pinsPlacedLine(3));
    for (let seed = 1; seed <= 100; seed++) {
      const desk = deskFor(seed);
      desk.suspects.forEach((_, i) => texts.push(desk.seen(i)));
      desk.suspects.forEach((_, i) => {
        const v = desk.decide(i, i % 2 === 0);
        if (v) texts.push(v.result, v.why);
      });
      texts.push(...desk.rows().map(r => r.shown), ...desk.reveal().map(l => l.text));
    }
    const bad = new Set(texts.flatMap(unsupported));
    expect([...bad]).toEqual([]);
  });
});
