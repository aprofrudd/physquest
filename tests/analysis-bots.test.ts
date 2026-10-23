// Scoring bands: bots play the review through the model (perfect, typical mistakes, random, worst) and the stat they
// would earn must land where the brief says: perfect 0.92-0.98, random at most about 0.6, worst about 0.2-0.4.
import { describe, expect, it } from 'vitest';
import { RUNNING } from '../src/rooms/content/running';
import { createReview, type Verdict } from '../src/rooms/analysis/model';
import { calcStat } from '../src/state/GameState';

const content = RUNNING.analysis;

const seeded = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** Plays one review: where the pin goes (steps from the baseline), and which verdict is picked for each row. */
const play = (seed: number, pin: number, trainedCall: Verdict, decoyCall: Verdict): number => {
  const review = createReview(content, seeded(seed));
  review.advance();
  review.advance();
  review.movePin(pin);
  review.lock();
  review.advance();
  review.pick(review.optionsFor('trained').indexOf(trainedCall));
  review.advance();
  review.pick(review.optionsFor('decoy').indexOf(decoyCall));
  review.advance();
  const score = review.score();
  return calcStat(score.dataQuality, score.variableAccuracy);
};

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

describe('what each kind of player earns', () => {
  const rows: Array<[string, number]> = [];
  const note = (name: string, stat: number) => rows.push([name, stat]);

  it('perfect play: the pin on the retest (or on either earlier block), both verdicts right', () => {
    const perfect = play(1, 10, 'worth', 'small');
    note('perfect (pin 60.0, worth, small)', perfect);
    expect(perfect).toBeGreaterThanOrEqual(0.92);
    expect(perfect).toBeLessThanOrEqual(0.98);
    // the evidence works too: the pin on either earlier block (60.4, 59.6), or within one typical error
    for (const pin of [7, 8, 9, 11, 12, 13]) expect(play(1, pin, 'worth', 'small')).toBeCloseTo(0.96, 6);
    note('pin on an earlier block (60.4 or 59.6)', play(1, 8, 'worth', 'small'));
  });

  it('typical mistakes land between the worst and the best, each one costing something', () => {
    const cases: Array<[string, number, Verdict, Verdict]> = [
      ['forecasts no change (pin 62.0), verdicts right', 0, 'worth', 'small'],
      ['forecast right, calls VO2max worth acting on', 10, 'worth', 'worth'],
      ['forecast right, calls VO2max noise', 10, 'worth', 'noise'],
      ['forecast right, calls everything noise', 10, 'noise', 'noise'],
      ['forecast right, calls everything worth acting on', 10, 'worth', 'worth'],
      ['over-optimistic forecast (pin 58.0), verdicts right', 20, 'worth', 'small'],
      ['over-optimistic forecast, VO2max called worth', 20, 'worth', 'worth'],
      ['forecast 1.0 s better (61.0), verdicts right', 5, 'worth', 'small'],
      ['forecast 0.4 s better (61.6), calls both noise', 2, 'noise', 'noise'],
    ];
    const stats = cases.map(([name, pin, a, b]) => {
      const stat = play(2, pin, a, b);
      note(name, stat);
      return stat;
    });
    for (const stat of stats) {
      expect(stat).toBeGreaterThan(0.32);
      expect(stat).toBeLessThan(0.92); // no mistake still earns a perfect score
    }
    // each error costs: a wrong verdict or a missed forecast always scores below perfect
    expect(Math.max(...stats)).toBeLessThan(0.9);
    // and a bad forecast hurts more than one wrong verdict (60% against 20%)
    expect(play(2, 0, 'worth', 'small')).toBeLessThan(play(2, 10, 'worth', 'worth'));
  });

  it('random play (random pin, random verdicts, 1000 seeded runs) stays at or below about 0.6', () => {
    const rng = seeded(2024);
    const stats: number[] = [];
    const verdicts: Verdict[] = ['noise', 'small', 'worth'];
    for (let i = 0; i < 1000; i++) {
      const pin = -15 + Math.floor(rng() * 41); // anywhere on the ruler
      const a = verdicts[Math.floor(rng() * 3)] as Verdict;
      const b = verdicts[Math.floor(rng() * 3)] as Verdict;
      stats.push(play(i + 1, pin, a, b));
    }
    const average = mean(stats);
    const sorted = [...stats].sort((x, y) => x - y);
    note(`random x1000: mean ${pct(average)}, median ${pct(sorted[500] as number)}, p95 ${pct(sorted[950] as number)}, max ${pct(sorted[999] as number)}`, average);
    expect(average).toBeLessThanOrEqual(0.6);
    expect(average).toBeGreaterThan(0.4);
    expect(sorted[950] as number).toBeLessThan(0.9); // not even a lucky one in twenty looks like mastery
    expect(stats.filter(s => s >= 0.92).length / stats.length).toBeLessThan(0.05); // a random run rarely reaches a perfect score
  });

  it('worst play lands near the floor (0.32)', () => {
    const worst = play(3, -15, 'noise', 'worth'); // pin at the far worse end, both verdicts wrong
    note('worst (pin 65.0, both wrong)', worst);
    expect(worst).toBeCloseTo(0.32, 6);
    expect(worst).toBeGreaterThanOrEqual(0.2);
    expect(worst).toBeLessThanOrEqual(0.4);
  });

  it('prints the table (copy into the notes)', () => {
    const table = rows.map(([name, stat]) => `| ${name} | ${pct(stat)} |`).join('\n');
    console.log(`\n| bot | POWER stat |\n|---|---|\n${table}\n`);
    expect(rows.length).toBeGreaterThan(5);
  });
});
