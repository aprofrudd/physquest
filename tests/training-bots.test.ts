// Bots that plan the week, to prove the scoring bands: perfect play lands 0.92-0.98, a careless week is well below,
// random planning averages under 0.6, and the worst week still records 0.20.
import { describe, expect, it } from 'vitest';
import { RUNNING } from '../src/rooms/content/running';
import { DAY_COUNT, analyse, sessionFromChip, type Session } from '../src/rooms/training/model';

const content = RUNNING.training;
const seeded = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const week = (chips: readonly string[]): Session[] =>
  Array.from({ length: DAY_COUNT }, (_, d) => sessionFromChip(content, chips[d] ?? '--'));
const stat = (chips: readonly string[]): number => {
  const a = analyse(content, week(chips));
  return 0.4 * a.dataQuality + 0.6 * a.variableAccuracy;
};

const GOOD: Record<number, string[]> = {
  1: ['SUB', 'AWAY', 'EASY', 'SUPR', 'EASY', 'SPRT', 'REST'],
  2: ['SUB', 'EASY', 'AWAY', 'SUPR', 'EASY', 'SPRT', 'REST'],
  3: ['SUB', 'EASY', 'SUPR', 'AWAY', 'EASY', 'SPRT', 'REST'],
};
const OPTIONS = ['--', 'SUB', 'SUPR', 'SPRT', 'EASY', 'REST'];

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;

/**
 * The scoring rule written out a second time, straight from the room spec and without model.ts: an oracle for every
 * plan. It reads the level's numbers from the content (so a content change does not break it), but the formulas are
 * its own, so a slip in the model's formulas shows up as a disagreement.
 */
const oracleStat = (chips: readonly string[]): number => {
  const { keyNextDay, keyTwoDays, supportNextDay, fullAt, noneAt } = content.legs;
  const roleOn = (d: number): 'key' | 'support' | undefined => content.cards.find(c => c.label === chips[d])?.role;
  const legs = chips.map((_, d) => {
    let l = 100;
    if (d >= 1 && roleOn(d - 1) === 'key') l -= keyNextDay;
    if (d >= 2 && roleOn(d - 2) === 'key') l -= keyTwoDays;
    if (d >= 1 && roleOn(d - 1) === 'support') l -= supportNextDay;
    return Math.min(100, Math.max(0, l));
  });
  const best = new Map<string, number>();
  chips.forEach((chip, d) => {
    if (roleOn(d) !== 'key') return;
    const q = Math.min(1, Math.max(0, (legs[d]! - noneAt) / (fullAt - noneAt)));
    best.set(chip, Math.max(best.get(chip) ?? 0, q));
  });
  const keyLabels = content.cards.filter(c => c.role === 'key').map(c => c.label);
  const stimulus = keyLabels.reduce((sum, label) => sum + (best.get(label) ?? 0), 0) / keyLabels.length;
  const sessions = chips.filter((_, d) => roleOn(d) !== undefined).length;
  const restDays = chips.length - sessions;
  const reds = legs.filter(l => l < content.checks.redBelow).length;
  const structure =
    ((sessions >= content.checks.minSessions ? 1 : 0) +
      (restDays >= content.checks.minRest && restDays <= content.checks.maxRest ? 1 : 0) +
      Math.max(0, 1 - 0.5 * reds)) /
    3;
  const dataQuality = stimulus > 0.5 ? 0.5 + 0.4 * structure : 0.5;
  return 0.4 * dataQuality + 0.6 * stimulus;
};

describe('bots', () => {
  it('agrees with an independent implementation of the scoring rule on every plan, for each away day', () => {
    let worstGap = 0;
    let plans = 0;
    for (const away of [1, 2, 3]) {
      const plan = Array.from({ length: DAY_COUNT }, () => '--');
      plan[away] = 'AWAY';
      const free = [0, 1, 2, 3, 4, 5, 6].filter(d => d !== away);
      const walk = (i: number) => {
        if (i === free.length) {
          worstGap = Math.max(worstGap, Math.abs(stat(plan) - oracleStat(plan)));
          plans++;
          return;
        }
        for (const o of OPTIONS) {
          plan[free[i]!] = o;
          walk(i + 1);
        }
      };
      walk(0);
    }
    expect(plans).toBe(3 * 6 ** 6);
    expect(worstGap).toBeLessThan(1e-12);
  });

  it('a perfect planner scores 0.96, whichever day the athlete is away', () => {
    for (const away of [1, 2, 3]) expect(stat(GOOD[away]!)).toBeCloseTo(0.96);
  });

  it('no plan scores above 0.96 or below 0.20, searching every plan for each away day', () => {
    for (const away of [1, 2, 3]) {
      let best = 0;
      let worst = 1;
      const plan = Array.from({ length: DAY_COUNT }, () => '--');
      plan[away] = 'AWAY';
      const free = [0, 1, 2, 3, 4, 5, 6].filter(d => d !== away);
      const walk = (i: number) => {
        if (i === free.length) {
          const s = stat(plan);
          best = Math.max(best, s);
          worst = Math.min(worst, s);
          return;
        }
        for (const o of OPTIONS) {
          plan[free[i]!] = o;
          walk(i + 1);
        }
      };
      walk(0);
      expect(best).toBeCloseTo(0.96);
      expect(worst).toBeCloseTo(0.2);
    }
  });

  it('a planner who forgets a key session scores about 0.7-0.76', () => {
    expect(stat(['SUB', 'EASY', 'AWAY', 'SUPR', 'EASY', 'EASY', 'REST'])).toBeCloseTo(0.76);
    expect(stat(['SUB', 'EASY', 'AWAY', 'SUPR', 'EASY', 'REST', 'REST'])).toBeCloseTo(0.707, 2);
  });

  it('a planner who puts two hard days back to back scores well below the perfect week', () => {
    const score = stat(['SUB', 'SUPR', 'AWAY', 'SPRT', 'EASY', 'EASY', 'REST']);
    expect(score).toBeLessThan(0.8);
    expect(score).toBeGreaterThan(0.6);
  });

  it('a planner who trains hard every day scores about 0.43', () => {
    expect(stat(['SUB', 'SUPR', 'AWAY', 'SUB', 'SUPR', 'SPRT', 'SUB'])).toBeLessThan(0.5);
    expect(stat(['SUB', 'SUPR', 'SPRT', 'SUB', 'SUPR', 'SPRT', 'SUB'])).toBeCloseTo(0.43, 2);
  });

  it('a planner who only runs easy, or plans nothing, scores 0.20', () => {
    expect(stat(['EASY', 'EASY', 'AWAY', 'EASY', 'EASY', 'EASY', 'EASY'])).toBeCloseTo(0.2);
    expect(stat([])).toBeCloseTo(0.2);
  });

  it('random planning (1000 seeded weeks) averages under 0.6 and rarely reaches the top', () => {
    const rng = seeded(2024);
    const scores: number[] = [];
    for (let i = 0; i < 1000; i++) {
      const away = 1 + Math.floor(rng() * 3);
      const chips = Array.from({ length: DAY_COUNT }, (_, d) => (d === away ? 'AWAY' : OPTIONS[Math.floor(rng() * OPTIONS.length)]!));
      scores.push(stat(chips));
    }
    expect(mean(scores)).toBeLessThan(0.6);
    expect(median(scores)).toBeGreaterThan(0.55);
    expect(median(scores)).toBeLessThan(0.72);
    expect(scores.filter(s => s >= 0.92).length / scores.length).toBeLessThan(0.05);
  });

  it('random planning (10000 seeded weeks) averages under 0.6 with a median between 0.6 and 0.7', () => {
    const rng = seeded(77);
    const scores: number[] = [];
    for (let i = 0; i < 10000; i++) {
      const away = 1 + Math.floor(rng() * 3);
      const chips = Array.from({ length: DAY_COUNT }, (_, d) => (d === away ? 'AWAY' : OPTIONS[Math.floor(rng() * OPTIONS.length)]!));
      scores.push(stat(chips));
    }
    expect(mean(scores)).toBeLessThan(0.6);
    expect(median(scores)).toBeGreaterThan(0.6);
    expect(median(scores)).toBeLessThan(0.7);
  });
});
