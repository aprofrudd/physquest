// The redesigned rooms' content must line up with sports.ts: same names, numbers that agree.
import { describe, expect, it } from 'vitest';
import { LEVEL_DATA } from '../src/data/sports';
import { RUNNING } from '../src/rooms/content/running';
import { MEET_RUNNING } from '../src/rooms/content/meet-running';
import { createTraceDesk, distanceTimeFit, reportedPace } from '../src/rooms/datalab/model';
import { partsOf } from '../src/rooms/datalab/names';

const sport = LEVEL_DATA[3]!;
const valueOf = (prefix: string): string => partsOf(sport.variables.find(v => v.name.startsWith(prefix))!.name).value;

describe('running content', () => {
  it('names every test, zone and variable exactly as sports.ts does', () => {
    expect(RUNNING.testing.cards.map(c => c.name).sort()).toEqual(sport.tests.map(t => t.name).sort());
    expect(RUNNING.training.cards.map(c => c.zone).sort()).toEqual(sport.zones.map(z => z.name).sort());
    expect(Object.keys(RUNNING.data.features).sort()).toEqual(sport.variables.map(v => v.name).sort());
  });

  it('marks key sessions where sports.ts marks the zone correct', () => {
    for (const card of RUNNING.training.cards) {
      const zone = sport.zones.find(z => z.name === card.zone)!;
      expect(card.role === 'key').toBe(zone.correct);
    }
  });

  it('gives the Data Lab a file for exactly the tests sports.ts calls correct', () => {
    const files = [RUNNING.data.lactate.test, RUNNING.data.trials.test].sort();
    expect(files).toEqual(sport.tests.filter(t => t.correct).map(t => t.name).sort());
  });

  it("reads Alan's approved numbers off the clean files, as the variable names give them", () => {
    const desk = createTraceDesk(RUNNING.data, sport, { rng: () => 0.99 });
    for (const s of desk.suspects) desk.decide(desk.suspects.indexOf(s), !s.real);
    const d = desk.derived();
    expect(d.lt1Kmh).toBeCloseTo(14.5, 1);
    expect(d.lt2Kmh).toBeCloseTo(16.8, 1);
    expect(d.lt1Pace).toBe('4:08');
    expect(d.lt2Pace).toBe('3:34');
    expect(d.hrLt2).toBe(176);
    expect(d.csKmh).toBeCloseTo(17.8, 1);
    expect(d.csPace).toBe('3:22');
    expect(d.dPrime).toBe(140);
    expect(valueOf('LT1')).toBe(d.lt1Pace);
    expect(valueOf('LT2')).toBe(d.lt2Pace);
    expect(valueOf('HR at LT2')).toBe(String(d.hrLt2));
    expect(valueOf('Critical Speed')).toBe(d.csPace);
    expect(valueOf('D Prime')).toBe(String(d.dPrime));
    expect(valueOf('Best Trial')).toBe(d.bestPace);
    expect(valueOf('VO2max')).toBe(String(RUNNING.data.lactate.vo2max));
    expect(valueOf('vVO2max')).toBe(reportedPace(RUNNING.data.lactate.vvo2maxKmh));
    expect(RUNNING.data.lactate.vvo2maxKmh).toBe(19.0);
    expect(RUNNING.data.lactate.hrMax).toBe(192);
  });

  it('puts the HR at LT1 at 158 and the critical speed fit within a few seconds of her 16:20 PB', () => {
    const st = RUNNING.data.lactate.stages;
    const i = st.findIndex(s => s.kmh === 15);
    expect(st[i - 1]!.hr + 0.5 * (st[i]!.hr - st[i - 1]!.hr)).toBe(158);
    const fit = distanceTimeFit(RUNNING.data.trials.trials)!;
    expect(fit.slope).toBeCloseTo(4.94, 2);
    const fiveK = (5000 - fit.intercept) / fit.slope;
    expect(Math.abs(fiveK - (16 * 60 + 20))).toBeLessThan(10);
    expect(sport.athleteProfile).toContain('16:20');
  });

  it('quotes the same numbers in the data line, the training targets and the Director', () => {
    for (const n of ['4:08', '3:34', '176', '58', '3:09', '3:22', '140']) expect(sport.dataOutput).toContain(n);
    const targets = RUNNING.training.cards.map(c => c.target).join(' ');
    for (const n of ['3:34', '3:22', '3:09', '4:08']) expect(targets).toContain(n);
    const files = Object.values(MEET_RUNNING.checkIns.dataFiles).flat().join(' ');
    for (const n of ['4:08', '3:34', '58', '3:09', '3:22', '140']) expect(files).toContain(n);
  });

  it('never mentions a sprint test or a speed reserve in the level 4 content', () => {
    const text = JSON.stringify([sport, RUNNING, MEET_RUNNING.checkIns]).toLowerCase();
    expect(text).not.toContain('speed reserve');
    expect(text).not.toContain('flying');
    expect(text).not.toContain('max sprint');
  });

  it('retests the outcome sports.ts calls correct', () => {
    const { trained, weeks } = RUNNING.analysis;
    const right = sport.predictions.find(p => p.correct)!.text;
    expect(right).toContain(`${trained.baseline}s`);
    expect(right).toContain(`${trained.retest}s`);
    expect(sport.predictionScenario).toContain(`${weeks} weeks`);
    expect(RUNNING.analysis.decoy.baseline).toBe(58);
  });

  it('keeps the needs line, test chips and file titles short enough to draw', () => {
    expect(RUNNING.testing.needs.length).toBeLessThanOrEqual(28);
    for (const card of RUNNING.testing.cards) expect(card.gives.length).toBeLessThanOrEqual(19);
    for (const f of [RUNNING.data.lactate, RUNNING.data.trials]) expect(f.title.length).toBeLessThanOrEqual(29);
    for (const card of RUNNING.training.cards) expect((card.plain ?? '').length).toBeLessThanOrEqual(20);
  });
});
