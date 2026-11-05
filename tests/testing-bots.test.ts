// Bots play the Testing Lab through the model, to show where careful, careless and random play land.
// Run `npx vitest run tests/testing-bots.test.ts` to see the table printed.
import { describe, expect, it } from 'vitest';
import { LEVEL_DATA } from '../src/data/sports';
import { RUNNING } from '../src/rooms/content/running';
import { RUN_SECONDS, createTestingModel, statOf, type CheckCall, type Rng } from '../src/rooms/testing/model';

const sport = LEVEL_DATA[3]!;
const content = RUNNING.testing;

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

/** What a bot does: which tests (by name, in order) go in the battery, and what call to make on test day. */
interface Bot {
  tests: (names: readonly string[], rng: Rng) => readonly [string, string];
  call: (right: CheckCall, rng: Rng) => CheckCall;
}

const opposite = (call: CheckCall): CheckCall => (call === 'run' ? 'rebook' : 'run');

/** One attempt: the bot builds its battery and makes its call; returns the stat the room would record. */
const play = (bot: Bot, seed: number): number => {
  const rng = seeded(seed);
  const model = createTestingModel({ sport, content, rng });
  model.startPick();
  const names = model.state.order.map(t => t.name);
  for (const name of bot.tests(names, rng)) {
    model.update(1);
    model.moveCursor(Math.max(0, names.indexOf(name)) - model.state.cursor);
    model.choose();
  }
  if (model.state.phase === 'check') {
    const right = model.state.check!.call;
    model.answer(bot.call(right, rng));
    model.beginRun();
  }
  model.update(RUN_SECONDS + 0.1);
  model.update(RUN_SECONDS + 0.1);
  expect(model.state.phase).toBe('printout');
  return statOf(model.result());
};

const stats = (bot: Bot, runs = 1000) => {
  const values = Array.from({ length: runs }, (_, i) => play(bot, 1000 + i)).sort((a, b) => a - b);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return { mean, min: values[0]!, p5: values[Math.floor(runs * 0.05)]!, p95: values[Math.floor(runs * 0.95)]!, max: values[values.length - 1]! };
};

const named = (a: string, b: string): Bot['tests'] => () => [a, b];
const right: Bot['call'] = r => r;
const LP = 'Lactate Profile';
const CS = 'Critical Speed Test';
const RIGHT_TESTS = [LP, CS];
const WRONG_TESTS = ['Wingate Test', 'Beep Test'];

/** Two different tests at random. */
const anyTwo = (names: readonly string[], rng: Rng): [string, string] => {
  const first = names[Math.floor(rng() * names.length)]!;
  const rest = names.filter(n => n !== first);
  return [first, rest[Math.floor(rng() * rest.length)]!];
};

const BOTS: Record<string, Bot> = {
  'perfect: both right tests, right call': { tests: named(LP, CS), call: right },
  'partial: lactate profile + Wingate, right call': { tests: named(LP, 'Wingate Test'), call: right },
  'partial: critical speed + Beep, right call': { tests: named(CS, 'Beep Test'), call: right },
  'right tests, always runs (ignores readiness)': { tests: named(LP, CS), call: () => 'run' },
  'right tests, always re-books': { tests: named(LP, CS), call: () => 'rebook' },
  'right tests, reads readiness right 70%': { tests: named(LP, CS), call: (r, rng) => (rng() < 0.7 ? r : opposite(r)) },
  'no right test (Wingate + Beep), right call': { tests: named('Wingate Test', 'Beep Test'), call: right },
  'typical mistakes: each pick 60% right, 70% right call': {
    tests: (_names, rng) => {
      const pickOne = (taken: string[]) => {
        const pool = (rng() < 0.6 ? RIGHT_TESTS : WRONG_TESTS).filter(n => !taken.includes(n));
        return (pool.length > 0 ? pool : [...RIGHT_TESTS, ...WRONG_TESTS].filter(n => !taken.includes(n)))[Math.floor(rng() * 2) % Math.max(1, pool.length)]!;
      };
      const first = pickOne([]);
      return [first, pickOne([first])];
    },
    call: (r, rng) => (rng() < 0.7 ? r : opposite(r)),
  },
  'random: any two tests, coin-flip call': { tests: anyTwo, call: (_r, rng) => (rng() < 0.5 ? 'run' : 'rebook') },
  'worst: Wingate + Beep, wrong call': { tests: named('Wingate Test', 'Beep Test'), call: r => opposite(r) },
};

describe('bots', () => {
  const table = Object.fromEntries(Object.entries(BOTS).map(([name, bot]) => [name, stats(bot)]));

  it('prints the table', () => {
    const rows = Object.entries(table).map(([name, s]) => `${name.padEnd(52)} mean ${s.mean.toFixed(3)}  min ${s.min.toFixed(3)}  p5 ${s.p5.toFixed(3)}  p95 ${s.p95.toFixed(3)}  max ${s.max.toFixed(3)}`);
    console.log(`\n${rows.join('\n')}\n`);
    expect(rows).toHaveLength(Object.keys(BOTS).length);
  });

  it('lands perfect play between 0.92 and 0.98', () => {
    const perfect = table['perfect: both right tests, right call']!;
    expect(perfect.min).toBeCloseTo(0.97, 9);
    expect(perfect.max).toBeCloseTo(0.97, 9);
  });

  it('puts a partial battery in the mixed band (50 to 80)', () => {
    for (const name of ['partial: lactate profile + Wingate, right call', 'partial: critical speed + Beep, right call']) {
      expect(table[name]!.mean).toBeGreaterThanOrEqual(0.5);
      expect(table[name]!.mean).toBeLessThan(0.8);
    }
  });

  it('costs the right tests something when readiness is ignored, and little when it is over-cautious', () => {
    const ignores = table['right tests, always runs (ignores readiness)']!;
    const cautious = table['right tests, always re-books']!;
    expect(ignores.mean).toBeLessThan(0.96);
    expect(ignores.mean).toBeGreaterThan(0.85);
    expect(ignores.min).toBeCloseTo(0.4 * 0.925 * 0.7 + 0.6, 9);
    expect(cautious.mean).toBeGreaterThan(0.95);
    expect(cautious.mean).toBeLessThan(0.97);
  });

  it('keeps a battery with no right test well below, in the weak band', () => {
    expect(table['no right test (Wingate + Beep), right call']!.mean).toBeCloseTo(0.4, 9);
    expect(table['worst: Wingate + Beep, wrong call']!.max).toBeLessThan(0.4);
    expect(table['worst: Wingate + Beep, wrong call']!.min).toBeGreaterThan(0.2);
  });

  it('puts typical mistakes in the middle and random play below them', () => {
    const typical = table['typical mistakes: each pick 60% right, 70% right call']!;
    expect(typical.mean).toBeGreaterThan(0.55);
    expect(typical.mean).toBeLessThan(0.85);
    const random = table['random: any two tests, coin-flip call']!;
    expect(random.mean).toBeGreaterThan(0.5);
    expect(random.mean).toBeLessThan(0.72);
    expect(random.p5).toBeLessThan(0.45);
    expect(random.p95).toBeGreaterThan(0.9);
  });
});
