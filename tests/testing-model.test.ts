// The Testing Lab's rules: shuffles, the test-day check, the readiness factor, the run's clock and the score.
import { describe, expect, it } from 'vitest';
import { LEVEL_DATA } from '../src/data/sports';
import { RUNNING } from '../src/rooms/content/running';
import type { AthleteCheck, TestingContent } from '../src/rooms/content/types';
import {
  DECISION_LOCK,
  RUN_SECONDS,
  RUN_SKIP_AFTER,
  athleteName,
  createTestingModel,
  factorFor,
  pickCheck,
  resultFor,
  shuffled,
  shuffledNot,
  statOf,
  type Rng,
} from '../src/rooms/testing/model';

const sport = LEVEL_DATA[3]!;
const content = RUNNING.testing;
const test = (name: string) => sport.tests.find(t => t.name === name)!;
const LT = test('Lactate Threshold Test');
const CS = test('Critical Speed Test');
const WINGATE = test('Wingate Test');
const BEEP = test('Beep Test');

/** A small seeded generator (mulberry32), so every run of these tests sees the same "random" numbers. */
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

const rebookCheck = content.checks.find(c => c.call === 'rebook')!;
const runCheck = content.checks.find(c => c.call === 'run')!;

/** A model whose check is exactly `check` (or none), whatever the rng says. */
const modelWith = (check: AthleteCheck | null, seed = 1) =>
  createTestingModel({
    sport,
    content: { ...content, checks: check ? [check] : [] },
    rng: seeded(seed),
  });

/** Run a model through the pick to the end of the printout, as a player would. */
const play = (model: ReturnType<typeof modelWith>, test: typeof LT, call?: 'run' | 'rebook') => {
  model.startPick();
  model.update(DECISION_LOCK + 0.01);
  model.moveCursor(model.state.order.indexOf(test)); // the cursor starts on the first test
  model.choose();
  if (model.state.phase === 'check') {
    model.answer(call ?? 'run');
    model.beginRun();
  }
  model.update(RUN_SECONDS + 0.01);
  return model;
};

describe('shuffled', () => {
  it('keeps every item exactly once', () => {
    const out = shuffled([1, 2, 3, 4, 5, 6], seeded(7));
    expect([...out].sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('is the same for the same seed and does not touch the input', () => {
    const items = ['a', 'b', 'c', 'd'];
    expect(shuffled(items, seeded(3))).toEqual(shuffled(items, seeded(3)));
    expect(items).toEqual(['a', 'b', 'c', 'd']);
  });

  it('gives different orders over many seeds, with every item landing first sometimes', () => {
    const firsts = new Set<string>();
    for (let seed = 1; seed <= 60; seed++) firsts.add(shuffled(['a', 'b', 'c', 'd'], seeded(seed))[0]!);
    expect(firsts.size).toBe(4);
  });

  it('copes with an rng that returns 1', () => {
    expect(shuffled([1, 2, 3], () => 1).sort()).toEqual([1, 2, 3]);
  });

  it('handles empty and single lists', () => {
    expect(shuffled([], seeded(1))).toEqual([]);
    expect(shuffled(['x'], seeded(1))).toEqual(['x']);
  });
});

describe('pickCheck', () => {
  it('returns null when the content has no checks', () => {
    expect(pickCheck([], seeded(1))).toBeNull();
  });

  it('reaches every check over many draws', () => {
    const seen = new Set<string>();
    const rng = seeded(11);
    for (let i = 0; i < 200; i++) seen.add(pickCheck(content.checks, rng)!.says);
    expect(seen.size).toBe(content.checks.length);
  });

  it('leaves out the check shown last time', () => {
    const rng = seeded(5);
    for (let i = 0; i < 100; i++) expect(pickCheck(content.checks, rng, rebookCheck.says)!.says).not.toBe(rebookCheck.says);
  });

  it('still returns the only check when it is the one to avoid', () => {
    expect(pickCheck([rebookCheck], seeded(1), rebookCheck.says)).toBe(rebookCheck);
  });
});

describe('readiness factor', () => {
  it('is 1 when the call was right', () => {
    expect(factorFor(content, rebookCheck, 'rebook')).toBe(1);
    expect(factorFor(content, runCheck, 'run')).toBe(1);
  });

  it('is ranAnyway when she should have been re-booked but the test ran', () => {
    expect(factorFor(content, rebookCheck, 'run')).toBe(content.ranAnyway);
    expect(content.ranAnyway).toBe(0.7);
  });

  it('is needlessRebook when a ready athlete was re-booked', () => {
    expect(factorFor(content, runCheck, 'rebook')).toBe(content.needlessRebook);
    expect(content.needlessRebook).toBe(0.95);
  });

  it('is 1 with no check or no call yet', () => {
    expect(factorFor(content, null, 'run')).toBe(1);
    expect(factorFor(content, rebookCheck, null)).toBe(1);
  });
});

describe('score', () => {
  const stat = (t: typeof LT, factor: number) => statOf(resultFor(t, factor));

  it('lands the specified stat for each test with the right call', () => {
    expect(stat(LT, 1)).toBeCloseTo(0.98, 9);
    expect(stat(CS, 1)).toBeCloseTo(0.96, 9);
    expect(stat(WINGATE, 1)).toBeCloseTo(0.38, 9);
    expect(stat(BEEP, 1)).toBeCloseTo(0.42, 9);
  });

  it('takes the readiness factor off the test data quality only', () => {
    expect(stat(LT, content.ranAnyway)).toBeCloseTo(0.866, 9);
    expect(stat(LT, content.needlessRebook)).toBeCloseTo(0.4 * 0.95 * 0.95 + 0.6, 9);
    expect(resultFor(LT, 0.7).variableAccuracy).toBe(1);
  });

  it('gives 0.3 variable accuracy to a test sports.ts calls wrong, 1 to a right one', () => {
    for (const t of sport.tests) expect(resultFor(t, 1).variableAccuracy).toBe(t.correct ? 1 : 0.3);
  });

  it('keeps perfect play between 0.92 and 0.98 and the worst play far below', () => {
    expect(stat(LT, 1)).toBeLessThanOrEqual(0.98 + 1e-9);
    expect(stat(CS, 1)).toBeGreaterThanOrEqual(0.92);
    const worst = Math.min(...sport.tests.map(t => stat(t, content.ranAnyway)));
    expect(worst).toBeLessThan(0.4);
    expect(worst).toBeGreaterThan(0.15);
  });
});

describe('the flow', () => {
  it('starts in the brief with the four tests shuffled and the cursor on the first', () => {
    const model = createTestingModel({ sport, content, rng: seeded(2) });
    expect(model.state.phase).toBe('brief');
    expect(model.state.order.map(t => t.name).sort()).toEqual(sport.tests.map(t => t.name).sort());
    expect(model.state.cursor).toBe(0);
    expect(model.highlighted()).toBe(model.state.order[0]);
  });

  it('ignores A for the first 0.35 s of the pick', () => {
    const model = modelWith(null);
    model.startPick();
    expect(model.canDecide()).toBe(false);
    model.choose();
    expect(model.state.phase).toBe('pick');
    model.update(DECISION_LOCK - 0.01);
    model.choose();
    expect(model.state.phase).toBe('pick');
    model.update(0.02);
    expect(model.canDecide()).toBe(true);
    model.choose();
    expect(model.state.phase).toBe('run');
  });

  it('wraps the cursor both ways and only moves in the pick', () => {
    const model = modelWith(null);
    model.moveCursor(1);
    expect(model.state.cursor).toBe(0); // not in the pick yet
    model.startPick();
    model.moveCursor(-1);
    expect(model.state.cursor).toBe(3);
    model.moveCursor(1);
    expect(model.state.cursor).toBe(0);
    model.moveCursor(5);
    expect(model.state.cursor).toBe(1);
  });

  it('goes to test day when there are checks, straight to the run when there are none', () => {
    const withCheck = modelWith(rebookCheck);
    withCheck.startPick();
    withCheck.update(1);
    withCheck.choose();
    expect(withCheck.state.phase).toBe('check');
    expect(withCheck.state.chosen).toBe(withCheck.state.order[0]);

    const without = modelWith(null);
    without.startPick();
    without.update(1);
    without.choose();
    expect(without.state.phase).toBe('run');
    expect(without.factor()).toBe(1);
    expect(without.state.check).toBeNull();
  });

  it('says whether the call was right and marks a test that ran on a day to re-book as shaky', () => {
    const shaky = modelWith(rebookCheck);
    shaky.startPick();
    shaky.update(1);
    shaky.choose();
    expect(shaky.answer('run')).toBe(false);
    expect(shaky.shaky()).toBe(true);
    expect(shaky.state.rebooked).toBe(false);
    expect(shaky.factor()).toBe(content.ranAnyway);

    const right = modelWith(rebookCheck);
    right.startPick();
    right.update(1);
    right.choose();
    expect(right.answer('rebook')).toBe(true);
    expect(right.shaky()).toBe(false);
    expect(right.state.rebooked).toBe(true);
    expect(right.factor()).toBe(1);

    const needless = modelWith(runCheck);
    needless.startPick();
    needless.update(1);
    needless.choose();
    expect(needless.answer('rebook')).toBe(false);
    expect(needless.shaky()).toBe(false); // the data is fine, only the day was wasted
    expect(needless.factor()).toBe(content.needlessRebook);
  });

  it('moves the calendar on while a re-booking is flipping, and nowhere else', () => {
    const model = modelWith(rebookCheck);
    model.startPick();
    model.update(1);
    model.choose();
    model.update(0.5);
    expect(model.state.flip).toBe(0);
    model.answer('rebook');
    model.update(0.4);
    expect(model.state.flip).toBeCloseTo(0.4, 9);
  });

  it('lets A skip the run only after half a second, and ends it by itself at five seconds', () => {
    const model = modelWith(null);
    model.startPick();
    model.update(1);
    model.choose();
    expect(model.skipRun()).toBe(false);
    model.update(RUN_SKIP_AFTER - 0.05);
    expect(model.skipRun()).toBe(false);
    model.update(0.1);
    expect(model.skipRun()).toBe(true);
    expect(model.state.phase).toBe('printout');

    const full = modelWith(null);
    full.startPick();
    full.update(1);
    full.choose();
    full.update(RUN_SECONDS - 0.1);
    expect(full.state.phase).toBe('run');
    full.update(0.2);
    expect(full.state.phase).toBe('printout');
  });

  it('locks the printout for 0.35 s so a skip press cannot carry through it', () => {
    const model = modelWith(null);
    model.startPick();
    model.update(1);
    model.choose();
    model.update(RUN_SECONDS + 0.01);
    expect(model.state.phase).toBe('printout');
    expect(model.canDecide()).toBe(false);
    model.update(DECISION_LOCK + 0.01);
    expect(model.canDecide()).toBe(true);
    model.startFeedback();
    expect(model.state.phase).toBe('feedback');
    model.finish();
    expect(model.state.phase).toBe('done');
  });

  it('ignores choose, answer, skip and feedback calls made in the wrong phase', () => {
    const model = modelWith(rebookCheck);
    model.choose();
    expect(model.state.phase).toBe('brief');
    expect(model.answer('run')).toBe(false);
    expect(model.skipRun()).toBe(false);
    model.startFeedback();
    expect(model.state.phase).toBe('brief');
  });

  it('draws a new shuffle and a new check on a replay', () => {
    const first = createTestingModel({ sport, content, rng: seeded(21) });
    const orders = new Set<string>();
    let sameCheck = 0;
    for (let seed = 30; seed < 70; seed++) {
      const again = createTestingModel({ sport, content, rng: seeded(seed), lastCheck: first.state.check!.says });
      orders.add(again.state.order.map(t => t.name).join('|'));
      if (again.state.check!.says === first.state.check!.says) sameCheck++;
    }
    expect(orders.size).toBeGreaterThan(5);
    expect(sameCheck).toBe(0);
  });

  it('never shows the same list order twice in a row, even when the generator would repeat itself', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const first = createTestingModel({ sport, content, rng: seeded(seed) }).state.order.map(t => t.name);
      // the same seed would shuffle to the same list again: the model turns it one place instead
      const again = createTestingModel({ sport, content, rng: seeded(seed), lastOrder: first }).state.order.map(t => t.name);
      expect(again).not.toEqual(first);
      expect([...again].sort()).toEqual([...first].sort());
    }
  });

  it('leaves a shuffle alone when it is not the order shown last time', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const plain = shuffledNot(sport.tests, seeded(seed)).map(t => t.name);
      expect(shuffledNot(sport.tests, seeded(seed), ['no', 'such', 'order', 'here']).map(t => t.name)).toEqual(plain);
      expect(shuffledNot(sport.tests, seeded(seed), plain.slice().reverse().concat('extra')).map(t => t.name)).toEqual(plain);
    }
  });

  it('draws a weekday from Monday to Wednesday, so a re-booking two days on is still a weekday', () => {
    const seen = new Set<number>();
    for (let seed = 1; seed < 80; seed++) {
      const day = createTestingModel({ sport, content, rng: seeded(seed) }).state.day;
      seen.add(day);
      expect(day).toBeGreaterThanOrEqual(0);
      expect(day + 2).toBeLessThanOrEqual(4); // never a Saturday or a Sunday
    }
    expect([...seen].sort()).toEqual([0, 1, 2]);
  });
});

describe('the printout', () => {
  it('names the test, what it records and sends a right test to the Data Lab', () => {
    const model = play(modelWith(runCheck), LT);
    const p = model.printout();
    expect(p.title).toBe('LAB PRINTOUT');
    expect(p.testName).toBe('LACTATE THRESHOLD TEST');
    expect(p.records).toBe('RECORDS: LT1 AND LT2 PACES');
    expect(p.verdictGood).toBe(true);
    expect(p.verdict).toBe('SENT TO THE DATA LAB');
    expect(p.shaky).toBeNull();
  });

  it('says a wrong test is not what the athlete needs, by her name', () => {
    const p = play(modelWith(runCheck), WINGATE).printout();
    expect(p.verdictGood).toBe(false);
    expect(p.verdict).toBe('NOT WHAT AISHA NEEDS');
    expect(p.records).toBe('RECORDS: PEAK AND MEAN POWER');
  });

  it('flags shaky data only when the test ran on a day to re-book', () => {
    expect(play(modelWith(rebookCheck), CS, 'run').printout().shaky).toBe('DATA QUALITY: SHAKY');
    expect(play(modelWith(rebookCheck), CS, 'rebook').printout().shaky).toBeNull();
    expect(play(modelWith(runCheck), CS, 'rebook').printout().shaky).toBeNull();
  });

  it('gives the room result from the chosen test and the call', () => {
    const model = play(modelWith(rebookCheck), LT, 'run');
    expect(model.result()).toEqual({ dataQuality: 0.95 * 0.7, variableAccuracy: 1 });
    const stat = statOf(model.result());
    expect(stat).toBeCloseTo(0.866, 9);
  });
});

describe('content gaps', () => {
  it('draws a plain card for a test the content does not know, instead of failing', () => {
    const thin: TestingContent = { ...content, cards: content.cards.filter(c => c.name !== 'Beep Test') };
    const model = createTestingModel({ sport, content: thin, rng: seeded(1) });
    const card = model.cardOf(BEEP);
    expect(card.name).toBe('Beep Test');
    expect(card.chips).toEqual(['', '', '']);
  });

  it('names the athlete from the profile: first word, no comma, capitals', () => {
    expect(athleteName(sport)).toBe('AISHA');
    expect(athleteName(LEVEL_DATA[0]!)).toBe('JAKE');
  });
});
