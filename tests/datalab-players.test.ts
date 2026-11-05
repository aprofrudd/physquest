// Scripted players pressing the buttons of the real instrument (not the model): what stat does the room record for a
// perfect player, a careless one, a random one and the worst one? The shell's own calcStat turns the result into the stat.
import { describe, expect, it, vi } from 'vitest';
import { chooseAndLock, cleanAll, makeRig, seeded, statOf, type Rig } from './datalab-rig';

vi.mock('../src/audio/Sfx', () => ({ sfx: { play: () => {} } }));
vi.mock('../src/ui/announce', () => ({ announce: () => {} }));

type Cleaner = 'perfect' | 'typical' | 'worst' | 'keep' | 'remove' | 'random';
type Pinner = 'key' | 'typical' | 'wrong' | 'random';

// 1000 attempts each is the table in the notes; the default keeps the suite quick (DATALAB_RUNS=1000 for the full table)
const RUNS = Number(process.env.DATALAB_RUNS ?? 150);

/** Clean the files, then choose the key variables and lock in, the way a player with these habits would. Returns the stat. */
const play = (seed: number, cleaner: Cleaner, pinner: Pinner): number => {
  const rig: Rig = makeRig(seed, { tests: ['Lactate Profile', 'Critical Speed Test'] });
  const rng = seeded(seed * 104729 + 3);
  cleanAll(rig, s =>
    cleaner === 'perfect' ? !s.real : cleaner === 'worst' ? s.real : cleaner === 'remove' ? true : cleaner === 'keep' ? false : cleaner === 'typical' ? (rng() < 0.8 ? !s.real : s.real) : rng() < 0.5,
  );
  const { list, pinLimit } = rig.debug();
  const rows = [...list.keys()];
  const keys = rows.filter(r => list[r]!.key);
  const others = rows.filter(r => !list[r]!.key);
  const chosen =
    pinner === 'key'
      ? keys
      : pinner === 'typical'
        ? [...keys.slice(0, pinLimit - 1), ...others.slice(0, 1)] // all right but one
        : pinner === 'wrong'
          ? [...others, ...keys].slice(0, pinLimit)
          : [...rows].sort(() => rng() - 0.5).slice(0, pinLimit);
  chooseAndLock(rig, [...chosen].sort((a, b) => a - b));
  expect(rig.results.length).toBe(1); // recorded once, and only after the reveal
  expect(rig.quits()).toBe(0);
  return statOf(rig.results[0]!);
};

const mean = (cleaner: Cleaner, pinner: Pinner): { mean: number; min: number; max: number; sd: number } => {
  const stats = Array.from({ length: RUNS }, (_, i) => play(i + 1, cleaner, pinner));
  const average = stats.reduce((a, b) => a + b, 0) / stats.length;
  const sd = Math.sqrt(stats.reduce((a, b) => a + (b - average) ** 2, 0) / stats.length);
  return { mean: average, min: Math.min(...stats), max: Math.max(...stats), sd };
};

describe('the stat the room records, pressing the real buttons', () => {
  it('prints the table', () => {
    const table: ReadonlyArray<readonly [string, Cleaner, Pinner]> = [
      ['perfect (clean-up right, pins right)', 'perfect', 'key'],
      ['typical mistakes (4 in 5 decisions right, 3 of 4 key variables)', 'typical', 'typical'],
      ['random everything', 'random', 'random'],
      ['always KEEP, random pins', 'keep', 'random'],
      ['always REMOVE, random pins', 'remove', 'random'],
      ['worst (every decision wrong, wrong pins first)', 'worst', 'wrong'],
    ];
    const lines = ['', `through the buttons (${RUNS} seeded attempts each)`, 'player'.padEnd(56) + 'mean   min    max    sd'];
    for (const [name, c, p] of table) {
      const r = mean(c, p);
      lines.push(name.padEnd(56) + [r.mean, r.min, r.max, r.sd].map(v => v.toFixed(3)).join(' '));
    }
    console.log(lines.join('\n'));
    expect(lines.length).toBe(table.length + 3);
  });

  it('records exactly 92% for a perfect player, on every attempt', () => {
    const r = mean('perfect', 'key');
    expect(r.min).toBeCloseTo(0.92, 10);
    expect(r.max).toBeCloseTo(0.92, 10);
  });

  it('records 20% for the worst player: every call wrong, no key variable chosen', () => {
    const r = mean('worst', 'wrong');
    expect(r.min).toBeCloseTo(0.2, 10);
    expect(r.max).toBeCloseTo(0.2, 10);
  });

  it('keeps a random player, an always-KEEP and an always-REMOVE player near 62% and well under perfect', () => {
    for (const [cleaner, pinner] of [['random', 'random'], ['keep', 'random'], ['remove', 'random']] as const) {
      const r = mean(cleaner, pinner);
      expect(r.mean).toBeGreaterThan(0.55);
      expect(r.mean).toBeLessThan(0.66);
      expect(r.mean).toBeLessThan(0.92 - 0.25);
    }
  });

  it('pays careless clean-up less than careless pinning (the pins are 60% of the stat)', () => {
    const carelessClean = mean('random', 'key').mean;
    const carelessPins = mean('perfect', 'random').mean;
    expect(carelessClean).toBeGreaterThan(carelessPins);
    expect(carelessClean).toBeLessThan(0.92);
  });
});
