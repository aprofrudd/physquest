// The Trace Desk's rules: the files each attempt builds (one per test run that has a file), the clean-up verdicts,
// the numbers read off the cleaned files, the key variables (only from the files present), the reveal and the score.
import { describe, expect, it, vi } from 'vitest';
import { LEVEL_DATA } from '../src/data/sports';
import { RUNNING } from '../src/rooms/content/running';
import {
  ODD_NUMBER,
  crossing,
  createTraceDesk,
  distanceTimeFit,
  fillSlots,
  filesFor,
  keyFullLine,
  keysChosenLine,
  type Rng,
  type TraceDesk,
} from '../src/rooms/datalab/model';
import { partsOf } from '../src/rooms/datalab/names';
import { DIALOGUE_BOX, wrapText } from '../src/render/DialogueBox';

// wrapText lives beside the dialogue box, which pulls in the sound module: keep it silent and off the browser
vi.mock('../src/audio/Sfx', () => ({ sfx: { play: () => {} } }));

const content = RUNNING.data;
const sport = LEVEL_DATA[3]!;
const LP = 'Lactate Profile';
const CS = 'Critical Speed Test';
const BATTERIES: readonly (readonly string[])[] = [[LP, CS], [LP, 'Wingate Test'], ['Beep Test', CS], [LP], [CS], []];

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

const deskFor = (seed: number, tests: readonly string[] = [LP, CS]): TraceDesk => createTraceDesk(content, sport, { tests, rng: seeded(seed) });

/** Every reading decided right (or all wrong). */
const cleanUp = (desk: TraceDesk, right = true) => desk.suspects.forEach((s, i) => desk.decide(i, right ? !s.real : s.real));

describe('the clean files', () => {
  const clean = content.lactate.stages.map(s => ({ kmh: s.kmh, mmol: s.mmol }));

  it('puts LT1 0.5 mmol/L above her lowest reading at 14.5 km/h, and LT2 at 4 mmol/L at 16.8 km/h', () => {
    expect(crossing(clean, 1.0 + content.lactate.lt1Rise)).toBeCloseTo(14.5, 6);
    expect(crossing(clean, content.lactate.lt2Mmol)).toBeCloseTo(16.82, 2);
    expect(crossing(clean, 20)).toBeNull();
    expect(crossing([{ kmh: 14, mmol: 3 }], 2)).toBe(14);
  });

  it('fits critical speed (4.94 m/s, 17.8 km/h) and D prime (about 140 m) through the three trials', () => {
    const fit = distanceTimeFit(content.trials.trials)!;
    expect(fit.slope).toBeCloseTo(4.938, 3);
    expect(fit.slope * 3.6).toBeCloseTo(17.8, 1);
    expect(fit.intercept).toBeGreaterThan(135);
    expect(fit.intercept).toBeLessThan(150);
    expect(distanceTimeFit(content.trials.trials.slice(0, 1))).toBeNull();
  });
});

describe('the files of an attempt', () => {
  it('has one file per test run that has one, lactate first; an empty battery has both', () => {
    expect(filesFor(content, [CS, LP])).toEqual(['lactate', 'trials']);
    expect(filesFor(content, [LP, 'Wingate Test'])).toEqual(['lactate']);
    expect(filesFor(content, ['Beep Test', CS])).toEqual(['trials']);
    expect(filesFor(content, ['Beep Test', 'Wingate Test'])).toEqual([]);
    expect(filesFor(content, [])).toEqual(['lactate', 'trials']);
  });

  it('flags the knee (17 km/h) and the peak (18 km/h) as real and 1 or 2 lactate glitches, numbered within the file', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const desk = deskFor(seed, [LP]);
      const kinds = desk.suspects.map(s => s.kind);
      expect(kinds).toContain('knee');
      expect(kinds).toContain('peak');
      const knee = desk.suspects.find(s => s.kind === 'knee')!;
      expect(desk.stages[knee.place.index]!.kmh).toBe(17);
      expect(desk.stages[desk.suspects.find(s => s.kind === 'peak')!.place.index]!.kmh).toBe(18);
      const glitches = desk.suspects.filter(s => !s.real);
      expect([1, 2]).toContain(glitches.length);
      desk.suspects.forEach((s, i) => {
        expect(s.number).toBe(i + 1);
        expect(s.of).toBe(desk.suspects.length);
        expect(s.file).toBe('lactate');
      });
    }
  });

  it('puts a lactate glitch only where cleaning it out leaves the clean numbers as they were', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const desk = deskFor(seed, [LP]);
      for (const g of desk.suspects.filter(s => !s.real)) {
        const stage = desk.stages[g.place.index]!;
        const truth = content.lactate.stages[g.place.index]!.mmol;
        if (g.kind === 'contaminated') expect(stage.mmol).toBeCloseTo(truth + content.lactate.contaminatedRise, 6);
        else expect(stage.mmol).toBe(0);
      }
      cleanUp(desk);
      const d = desk.derived();
      expect([d.lt1Pace, d.lt2Pace, d.hrLt2]).toEqual(['4:08', '3:34', 176]);
    }
  });

  it('flags the 1200 m trial as real and one mistimed trial (2400 m long, or 3600 m short) as a glitch', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 200; seed++) {
      const desk = deskFor(seed, [CS]);
      expect(desk.stages).toHaveLength(0);
      expect(desk.suspects.map(s => s.kind)).toEqual(['fastest', 'mistimed']);
      const m = desk.suspects[1]!;
      const t = desk.trials[m.place.index]!;
      const clean = content.trials.trials[m.place.index]!;
      expect(t.seconds - clean.seconds).toBe(m.place.index === 1 ? 40 : -40);
      seen.add(String(t.metres));
      cleanUp(desk);
      const d = desk.derived();
      expect([d.csPace, d.dPrime, d.bestPace]).toEqual(['3:22', 140, '2:58']);
    }
    expect([...seen].sort()).toEqual(['2400', '3600']);
  });

  it('puts the lactate file first and the trials file second, each with its own count', () => {
    const desk = deskFor(5);
    expect(desk.files.map(f => f.kind)).toEqual(['lactate', 'trials']);
    const [lac, tri] = desk.files;
    expect(tri!.first).toBe(lac!.count);
    expect(desk.suspects.length).toBe(lac!.count + tri!.count);
    expect(desk.suspects[tri!.first]!.number).toBe(1);
    expect(desk.fileIndexOf(tri!.first)).toBe(1);
    expect(desk.fileIndexOf(0)).toBe(0);
  });
});

describe('no value from a test that was not run', () => {
  it('offers only the variables of the files present, grouped by file', () => {
    for (const tests of BATTERIES) {
      const desk = deskFor(3, tests);
      const files = filesFor(content, tests);
      const rows = desk.rows();
      for (const r of rows) expect(files).toContain(content.features[r.name]!.file);
      expect(rows.map(r => r.file)).toEqual([...rows.map(r => r.file)].sort((a, b) => files.indexOf(a) - files.indexOf(b)));
      const offered = new Set(rows.map(r => r.name));
      for (const v of sport.variables) expect(offered.has(v.name)).toBe(files.includes(content.features[v.name]!.file));
    }
  });

  it('asks for as many key variables as the files present have', () => {
    expect(deskFor(1, [LP, CS]).pinLimit).toBe(4);
    expect(deskFor(1, [LP, 'Beep Test']).pinLimit).toBe(2);
    expect(deskFor(1, [CS, 'Wingate Test']).pinLimit).toBe(2);
  });

  it('derives nothing from a file that is not there', () => {
    const lactateOnly = deskFor(2, [LP]).derived();
    expect([lactateOnly.csKmh, lactateOnly.csPace, lactateOnly.dPrime, lactateOnly.bestPace]).toEqual([null, null, null, null]);
    const trialsOnly = deskFor(2, [CS]).derived();
    expect([trialsOnly.lt1Kmh, trialsOnly.lt2Kmh, trialsOnly.hrLt2, trialsOnly.vo2max, trialsOnly.vvo2Kmh]).toEqual([null, null, null, null, null]);
  });

  it('quotes no number of an untested file in the reveal: one file ends on its own insight', () => {
    const only = deskFor(2, [LP]);
    cleanUp(only);
    expect(only.reveal().at(-1)!.text).toBe(content.lactate.insight);
    expect(only.reveal().map(l => l.text).join(' ')).not.toMatch(/3:22|140 m|2:58/); // no number from the trials
    const both = deskFor(2, [LP, CS]);
    expect(both.reveal().at(-1)!.text).toBe(sport.variableInsight);
  });
});

describe('what the software says about a reading', () => {
  it('asks a plain question per reading, numbered within its file', () => {
    const desk = deskFor(8);
    desk.suspects.forEach((s, i) => {
      const ask = desk.ask(i);
      expect(ask.startsWith(`Reading ${s.number} of ${s.of}: `)).toBe(true);
      expect(ask.endsWith('Real data, or a glitch?')).toBe(true);
      if (s.file === 'lactate') expect(ask).toContain(`lactate at ${desk.stages[s.place.index]!.kmh} km/h`);
      else expect(ask).toContain(`the ${desk.trials[s.place.index]!.metres} m trial`);
    });
  });

  it('says the same neutral words about the real fastest trial and the mistimed one', () => {
    expect(content.trials.fastest.seen).toBe(content.trials.mistimed.seen);
  });

  it('fits the question and what the software says in the prompt box, for every reading of every attempt', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const desk = deskFor(seed);
      desk.suspects.forEach((_, i) => {
        const lines = wrapText(`${desk.ask(i)} ${desk.seen(i)}`);
        expect(lines.length, `${desk.ask(i)} ${desk.seen(i)}`).toBeLessThanOrEqual(DIALOGUE_BOX.lines);
        expect(desk.seen(i)).not.toMatch(/\{\w+\}/);
      });
    }
  });

  it('fills every slot, and leaves one with no value as written', () => {
    expect(fillSlots('{a} and {b}', { a: '1' })).toBe('1 and {b}');
  });
});

describe('decisions', () => {
  it('scores a right call on a glitch (remove) and on real data (keep), with the content reason', () => {
    const desk = deskFor(4);
    desk.suspects.forEach((s, i) => {
      const v = desk.decide(i, !s.real)!;
      expect(v.right).toBe(true);
      expect(v.why.length).toBeGreaterThan(10);
      expect(desk.decide(i, s.real)).toBeNull(); // decided once
    });
    expect(desk.cleanScore()).toBe(1);
    expect(desk.fileClean(0) && desk.fileClean(1)).toBe(true);
  });

  it('marks a kept glitch: the number on its row looks odd and carries a ?', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const desk = deskFor(seed);
      cleanUp(desk, false);
      const odd = desk.rows().filter(r => r.odd);
      expect(odd.length).toBeGreaterThan(0);
      for (const r of odd) {
        expect(r.shown.endsWith('?')).toBe(true);
        expect(partsOf(r.shown.slice(0, -1)).value).not.toBe(partsOf(r.name).value);
      }
    }
  });

  it('gives each clean file the names exactly as sports.ts writes them', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const desk = deskFor(seed);
      cleanUp(desk);
      for (const r of desk.rows()) expect(r.shown).toBe(r.name);
    }
  });

  it('removes a reading from its file (the chart and the fit lose it)', () => {
    const desk = deskFor(6);
    const i = desk.suspects.findIndex(s => s.kind === 'mistimed');
    const before = desk.trials.filter(t => t.present).length;
    desk.decide(i, true);
    expect(desk.trials.filter(t => t.present).length).toBe(before - 1);
    const j = desk.suspects.findIndex(s => !s.real && s.file === 'lactate');
    const points = desk.points().length;
    desk.decide(j, true);
    expect(desk.points().length).toBe(points - 1);
  });
});

describe('key variables and the score', () => {
  it('chooses up to the limit, refuses more, and locks only when full', () => {
    const desk = deskFor(9);
    const rows = desk.rows();
    for (let k = 0; k < desk.pinLimit; k++) {
      expect(desk.canLock()).toBe(false);
      expect(desk.togglePin(rows[k]!.variable)).toBe('pinned');
    }
    expect(desk.canLock()).toBe(true);
    expect(desk.togglePin(rows[desk.pinLimit]!.variable)).toBe('full');
    expect(desk.togglePin(rows[0]!.variable)).toBe('unpinned');
    expect(keyFullLine(4)).toBe('All 4 key variables are chosen. Take one out first.');
    expect(keysChosenLine(4)).toBe('All 4 key variables chosen. {A}: LOCK IN, or {UP} to change one.');
    expect(ODD_NUMBER).toContain('glitch');
  });

  it('scores 1 for the key variables, less for the others, and the clean-up into data quality', () => {
    const desk = deskFor(10);
    cleanUp(desk);
    for (const r of desk.rows()) if (r.key) desk.togglePin(r.variable);
    expect(desk.result()).toEqual({ dataQuality: 0.8, variableAccuracy: 1 });
    const bad = deskFor(10);
    cleanUp(bad, false);
    for (const r of bad.rows().filter(x => !x.key).slice(0, bad.pinLimit)) bad.togglePin(r.variable);
    expect(bad.result().dataQuality).toBe(0.5);
    expect(bad.result().variableAccuracy).toBe(0);
  });

  it('names the key variables of the full battery: LT2, vVO2max, critical speed and D prime', () => {
    const keys = deskFor(1).rows().filter(r => r.key).map(r => r.name.split(' (')[0]).sort();
    expect(keys).toEqual(['Critical Speed', 'D Prime', 'LT2 Pace', 'vVO2max Pace']);
  });
});
