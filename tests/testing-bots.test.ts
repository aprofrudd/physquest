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

/** What a bot does: which test (by name) and what call to make on test day. */
interface Bot {
  test: (names: readonly string[], rng: Rng) => string;
  call: (right: CheckCall, rng: Rng) => CheckCall;
}

const opposite = (call: CheckCall): CheckCall => (call === 'run' ? 'rebook' : 'run');

/** One attempt: the bot picks a test and makes its call; returns the stat the room would record. */
const play = (bot: Bot, seed: number): number => {
  const rng = seeded(seed);
  const model = createTestingModel({ sport, content, rng });
  model.startPick();
  model.update(1);
  const names = model.state.order.map(t => t.name);
  model.moveCursor(Math.max(0, names.indexOf(bot.test(names, rng)))); // the cursor starts on the first test
  model.choose();
  if (model.state.phase === 'check') {
    const right = model.state.check!.call;
    model.answer(bot.call(right, rng));
    model.beginRun();
  }
  model.update(RUN_SECONDS + 0.1);
  return statOf(model.result());
};

const stats = (bot: Bot, runs = 1000) => {
  const values = Array.from({ length: runs }, (_, i) => play(bot, 1000 + i)).sort((a, b) => a - b);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return { mean, min: values[0]!, p5: values[Math.floor(runs * 0.05)]!, p95: values[Math.floor(runs * 0.95)]!, max: values[values.length - 1]! };
};

const named = (name: string): Bot['test'] => () => name;
const right: Bot['call'] = r => r;

const BOTS: Record<string, Bot> = {
  'perfect: Lactate Threshold, right call': { test: named('Lactate Threshold Test'), call: right },
  'good: Critical Speed, right call': { test: named('Critical Speed Test'), call: right },
  'right test, always runs (ignores readiness)': { test: named('Lactate Threshold Test'), call: () => 'run' },
  'right test, always re-books': { test: named('Lactate Threshold Test'), call: () => 'rebook' },
  'right test, reads readiness right 70%': { test: named('Lactate Threshold Test'), call: (r, rng) => (rng() < 0.7 ? r : opposite(r)) },
  'wrong test (Beep), right call': { test: named('Beep Test'), call: right },
  'typical mistakes: 60% right test, 70% right call': {
    test: (names, rng) => (rng() < 0.6 ? (rng() < 0.5 ? 'Lactate Threshold Test' : 'Critical Speed Test') : (rng() < 0.5 ? 'Beep Test' : 'Wingate Test')),
    call: (r, rng) => (rng() < 0.7 ? r : opposite(r)),
  },
  'random: any test, coin-flip call': { test: (names, rng) => names[Math.floor(rng() * names.length)]!, call: (_r, rng) => (rng() < 0.5 ? 'run' : 'rebook') },
  'worst: Wingate, wrong call': { test: named('Wingate Test'), call: (r) => opposite(r) },
};

describe('bots', () => {
  const table = Object.fromEntries(Object.entries(BOTS).map(([name, bot]) => [name, stats(bot)]));

  it('prints the table', () => {
    const rows = Object.entries(table).map(([name, s]) => `${name.padEnd(52)} mean ${s.mean.toFixed(3)}  min ${s.min.toFixed(3)}  p5 ${s.p5.toFixed(3)}  p95 ${s.p95.toFixed(3)}  max ${s.max.toFixed(3)}`);
    console.log(`\n${rows.join('\n')}\n`);
    expect(rows).toHaveLength(Object.keys(BOTS).length);
  });

  it('lands perfect play between 0.92 and 0.98', () => {
    const perfect = table['perfect: Lactate Threshold, right call']!;
    expect(perfect.min).toBeCloseTo(0.98, 9);
    expect(perfect.max).toBeCloseTo(0.98, 9);
    const good = table['good: Critical Speed, right call']!;
    expect(good.mean).toBeCloseTo(0.96, 9);
  });

  it('costs the right test something when readiness is ignored, and little when it is over-cautious', () => {
    const ignores = table['right test, always runs (ignores readiness)']!;
    const cautious = table['right test, always re-books']!;
    expect(ignores.mean).toBeLessThan(0.97);
    expect(ignores.mean).toBeGreaterThan(0.86);
    expect(ignores.min).toBeCloseTo(0.866, 9);
    expect(cautious.mean).toBeGreaterThan(0.96);
    expect(cautious.mean).toBeLessThan(0.98);
  });

  it('keeps the wrong tests well below the right ones', () => {
    expect(table['wrong test (Beep), right call']!.mean).toBeCloseTo(0.42, 9);
    expect(table['worst: Wingate, wrong call']!.max).toBeLessThan(0.4);
    expect(table['worst: Wingate, wrong call']!.min).toBeGreaterThan(0.2);
  });

  it('puts typical mistakes in the middle and random play near the classic room (half the tests are right)', () => {
    const typical = table['typical mistakes: 60% right test, 70% right call']!;
    expect(typical.mean).toBeGreaterThan(0.6);
    expect(typical.mean).toBeLessThan(0.85);
    const random = table['random: any test, coin-flip call']!;
    expect(random.mean).toBeGreaterThan(0.55);
    expect(random.mean).toBeLessThan(0.72);
    expect(random.p5).toBeLessThan(0.45);
    expect(random.p95).toBeGreaterThan(0.9);
  });
});
