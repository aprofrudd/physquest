// The stat this room gives (0.4 x dataQuality + 0.6 x variableAccuracy) for scripted players over 1000 seeded
// attempts: perfect, typical mistakes, random, worst. The table is printed so it can be pasted into notes.
import { describe, expect, it } from 'vitest';
import { LEVEL_DATA } from '../src/data/sports';
import { RUNNING } from '../src/rooms/content/running';
import { DATA_QUALITY_FLOOR, DATA_QUALITY_SPAN, createTraceDesk, dataQualityFor, type Rng, type TraceDesk } from '../src/rooms/datalab/model';

const content = RUNNING.data;
const sport = LEVEL_DATA[3]!;
const RUNS = 1000;

/** A small seeded random source (mulberry32). */
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

type Cleaner = 'perfect' | 'keep' | 'remove' | 'random' | 'worst' | 'typical';
type Pinner = 'key' | 'random' | 'worst' | 'typical';

const shuffle = <T>(items: readonly T[], rng: Rng): T[] => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
};

/** One scripted attempt on seed `seed`: the stat it earns. */
const play = (seed: number, cleaner: Cleaner, pinner: Pinner): number => {
  const rng = seeded(seed * 7919 + 13);
  const desk: TraceDesk = createTraceDesk(content, sport, seeded(seed));
  desk.suspects.forEach((s, i) => {
    let remove: boolean;
    if (cleaner === 'perfect') remove = !s.real;
    else if (cleaner === 'worst') remove = s.real;
    else if (cleaner === 'keep') remove = false;
    else if (cleaner === 'remove') remove = true;
    else if (cleaner === 'typical') remove = rng() < 0.8 ? !s.real : s.real; // right 4 times in 5
    else remove = rng() < 0.5;
    desk.decide(i, remove);
  });
  const rows = desk.rows();
  let chosen: number[];
  if (pinner === 'key') chosen = rows.filter(r => r.key).map(r => r.variable);
  else if (pinner === 'worst') chosen = [...rows.filter(r => !r.key), ...rows.filter(r => r.key)].map(r => r.variable);
  else if (pinner === 'typical') chosen = [...rows.filter(r => r.key).slice(0, 2), ...rows.filter(r => !r.key)].map(r => r.variable); // two right, one wrong
  else chosen = shuffle(rows.map(r => r.variable), rng);
  for (const v of chosen) desk.togglePin(v);
  const { dataQuality, variableAccuracy } = desk.result();
  return 0.4 * dataQuality + 0.6 * variableAccuracy;
};

interface Summary {
  mean: number;
  min: number;
  max: number;
  sd: number;
}

const summary = (cleaner: Cleaner, pinner: Pinner): Summary => {
  const stats = Array.from({ length: RUNS }, (_, i) => play(i + 1, cleaner, pinner));
  const mean = stats.reduce((a, b) => a + b, 0) / stats.length;
  const sd = Math.sqrt(stats.reduce((a, b) => a + (b - mean) ** 2, 0) / stats.length);
  return { mean, min: Math.min(...stats), max: Math.max(...stats), sd };
};

const ROWS: ReadonlyArray<readonly [string, Cleaner, Pinner]> = [
  ['perfect (clean-up right, pins right)', 'perfect', 'key'],
  ['typical mistakes (4 in 5 decisions right, 2 of 3 pins)', 'typical', 'typical'],
  ['perfect clean-up, random pins', 'perfect', 'random'],
  ['random clean-up, perfect pins', 'random', 'key'],
  ['always KEEP, random pins', 'keep', 'random'],
  ['always REMOVE, random pins', 'remove', 'random'],
  ['random everything', 'random', 'random'],
  ['worst (every decision wrong, wrong pins first)', 'worst', 'worst'],
];

describe('the stat this room gives', () => {
  const table = ROWS.map(([name, c, p]) => ({ name, ...summary(c, p) }));

  it('prints the bot table', () => {
    const lines = ['', `bot table (${RUNS} seeded attempts each)`, 'player'.padEnd(56) + 'mean   min    max    sd'];
    for (const r of table) lines.push(r.name.padEnd(56) + [r.mean, r.min, r.max, r.sd].map(v => v.toFixed(3)).join(' '));
    console.log(lines.join('\n'));
    expect(table.length).toBe(ROWS.length);
  });

  it('turns the clean score into data quality, 0.5 to 0.8', () => {
    expect(DATA_QUALITY_FLOOR).toBe(0.5);
    expect(DATA_QUALITY_SPAN).toBe(0.3);
    expect(dataQualityFor(0)).toBe(0.5);
    expect(dataQualityFor(1)).toBeCloseTo(0.8, 10);
    expect(dataQualityFor(0.5)).toBeCloseTo(0.65, 10);
  });

  it('lands perfect play on exactly 92%, every attempt', () => {
    const perfect = table[0]!;
    expect(perfect.min).toBeCloseTo(0.92, 10);
    expect(perfect.max).toBeCloseTo(0.92, 10);
  });

  it('keeps typical mistakes clearly under perfect', () => {
    const typical = table[1]!;
    expect(typical.mean).toBeLessThan(0.82);
    expect(typical.mean).toBeGreaterThan(0.6);
  });

  it('keeps always-KEEP, always-REMOVE and random play with random pins in the low 0.6s at most', () => {
    expect(table[4]!.mean).toBeLessThan(0.64);
    expect(table[5]!.mean).toBeLessThan(0.65);
    expect(table[6]!.mean).toBeLessThan(0.64);
  });

  it('weights the pins more than the clean-up (they are 60% of the stat)', () => {
    expect(table[2]!.mean).toBeLessThan(table[3]!.mean + 0.2); // sanity: both far below perfect
    expect(table[2]!.mean).toBeLessThan(0.8);
    expect(table[3]!.mean).toBeLessThan(0.89);
  });

  it('floors the worst play at 0.2-0.4 (a wrong pin set still has one key variable in it)', () => {
    const worst = table[7]!;
    expect(worst.min).toBeGreaterThanOrEqual(0.4 - 1e-9);
    expect(worst.max).toBeLessThanOrEqual(0.4 + 1e-9);
    // all three pins wrong is impossible (only two variables are not key), so 0.2 is the floor of the formula, not of play
    expect(0.4 * dataQualityFor(0)).toBeCloseTo(0.2, 10);
  });
});
