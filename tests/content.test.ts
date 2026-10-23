// The redesigned rooms' content must line up with sports.ts: same names, numbers that agree.
import { describe, expect, it } from 'vitest';
import { LEVEL_DATA } from '../src/data/sports';
import { RUNNING } from '../src/rooms/content/running';

const sport = LEVEL_DATA[3]!;
const kmhFromPace = (pace: string): number => {
  const [m, s] = pace.split(':').map(Number);
  return 3600 / (m! * 60 + s!);
};

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

  it('puts the thresholds where the data line says they are', () => {
    const { stages, lt1Mmol, lt2Mmol } = RUNNING.data;
    const at = (mmol: number) => stages.find(s => s.mmol === mmol)!.kmh;
    expect(at(lt1Mmol)).toBeCloseTo(kmhFromPace('3:45'), 1);
    expect(at(lt2Mmol)).toBeCloseTo(kmhFromPace('3:20'), 1);
    expect(RUNNING.data.vvo2maxKmh).toBeCloseTo(kmhFromPace('2:55'), 1);
    expect(sport.dataOutput).toContain('LT1 3:45/km (2.0 mmol/L)');
    expect(sport.dataOutput).toContain('LT2 3:20/km (4.0 mmol/L)');
  });

  it('gives a best sprint of 28 km/h', () => {
    const best = Math.min(...RUNNING.data.sprintTimes);
    expect((RUNNING.data.sprintMetres / best) * 3.6).toBeCloseTo(28, 0);
    expect(sport.dataOutput).toContain('max sprint speed 28 km/h');
  });

  it('retests the outcome sports.ts calls correct', () => {
    const { trained, weeks } = RUNNING.analysis;
    const right = sport.predictions.find(p => p.correct)!.text;
    expect(right).toContain(`${trained.baseline}s`);
    expect(right).toContain(`${trained.retest}s`);
    expect(sport.predictionScenario).toContain(`${weeks} weeks`);
  });

  it('keeps the needs line and test chips short enough to draw', () => {
    expect(RUNNING.testing.needs.length).toBeLessThanOrEqual(28);
    for (const card of RUNNING.testing.cards) expect(card.gives.length).toBeLessThanOrEqual(19);
  });
});
