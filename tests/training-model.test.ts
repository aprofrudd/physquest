// The Hard-Easy Week rules: legs, quality, the checks and the score, the planner's cursor and options, the
// run's clock, and how each kind of day is played.
import { describe, expect, it } from 'vitest';
import { RUNNING } from '../src/rooms/content/running';
import {
  AWAY,
  DAY_COUNT,
  EMPTY,
  REST,
  analyse,
  bandOf,
  cardSession,
  chipLabel,
  fillLine,
  keyCardIndices,
  legsFor,
  missingKeys,
  pickAway,
  qualityOf,
  sameSession,
  sessionFromChip,
  shortZone,
  shuffledCards,
  type Session,
} from '../src/rooms/training/model';
import { dayCells, ladderOrder, ladderRungs } from '../src/rooms/training/cells';
import { GO, createPlanner } from '../src/rooms/training/planner';
import { END_HOLD, DAY_SECONDS, FAST_FORWARD, FAST_LOCK, createRunClock } from '../src/rooms/training/run';
import { phaseAt, styleOf } from '../src/rooms/training/style';

const content = RUNNING.training;

/** mulberry32: a small seeded rng, so a test can replay the same attempt. */
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

/** A week written as chip texts; days after the last one given have nothing planned. */
const week = (...chips: string[]): Session[] =>
  Array.from({ length: DAY_COUNT }, (_, d) => sessionFromChip(content, chips[d] ?? '--'));

const stat = (plan: Session[]): number => {
  const a = analyse(content, plan);
  return 0.4 * a.dataQuality + 0.6 * a.variableAccuracy;
};

describe('legs', () => {
  it('starts Monday fresh', () => {
    expect(legsFor(content, week('SUB'))[0]).toBe(100);
  });

  it('drops after a key session: the morning after and two mornings after', () => {
    const legs = legsFor(content, week('SUB', 'REST', 'REST', 'REST'));
    expect(legs.slice(0, 4)).toEqual([100, 100 - content.legs.keyNextDay, 100 - content.legs.keyTwoDays, 100]);
  });

  it('drops a little after a support session, the morning after only', () => {
    const legs = legsFor(content, week('EASY', 'REST', 'REST'));
    expect(legs.slice(0, 3)).toEqual([100, 100 - content.legs.supportNextDay, 100]);
  });

  it('adds the costs of the two days before', () => {
    const legs = legsFor(content, week('SUB', 'SUPR', 'REST'));
    expect(legs[2]).toBe(100 - content.legs.keyNextDay - content.legs.keyTwoDays);
  });

  it('adds a support session yesterday to a key session two days ago', () => {
    const legs = legsFor(content, week('SUB', 'EASY', 'REST'));
    expect(legs[2]).toBe(100 - content.legs.supportNextDay - content.legs.keyTwoDays);
  });

  it('never goes below 0 or above 100', () => {
    const harsh = { ...content, legs: { ...content.legs, keyNextDay: 80, keyTwoDays: 60 } };
    const legs = legsFor(harsh, week('SUB', 'SUPR', 'SPRT', 'SUB', 'SUPR', 'SPRT', 'SUB'));
    expect(Math.min(...legs)).toBe(0);
    expect(Math.max(...legs)).toBe(100);
  });

  it('gets nothing from an away day, a rest day or an empty day', () => {
    expect(legsFor(content, week('SUB', 'AWAY', '--', 'REST')).slice(2, 4)).toEqual([80, 100]);
  });

  it('counts a repeated key card each time', () => {
    const legs = legsFor(content, week('SUB', 'SUB', 'SUB'));
    expect(legs.slice(0, 3)).toEqual([100, 50, 30]);
  });
});

describe('quality', () => {
  it('is full at or above the full line, none at or below the none line, and in between on a slope', () => {
    const { fullAt, noneAt } = content.legs;
    expect(qualityOf(content, fullAt)).toBe(1);
    expect(qualityOf(content, 100)).toBe(1);
    expect(qualityOf(content, noneAt)).toBe(0);
    expect(qualityOf(content, 0)).toBe(0);
    expect(qualityOf(content, (fullAt + noneAt) / 2)).toBeCloseTo(0.5);
    expect(bandOf(content, fullAt)).toBe('full');
    expect(bandOf(content, fullAt - 1)).toBe('part');
    expect(bandOf(content, noneAt + 1)).toBe('part');
    expect(bandOf(content, noneAt)).toBe('none');
  });

  it('is only given to key sessions', () => {
    const a = analyse(content, week('EASY', 'SUB', 'REST'));
    expect(a.quality).toEqual([null, expect.any(Number), null, null, null, null, null]);
  });

  it('loses quality on the second of two key sessions on back-to-back days', () => {
    const a = analyse(content, week('SUB', 'SUPR'));
    expect(a.quality[0]).toBe(1);
    expect(a.quality[1]).toBeLessThan(1);
    expect(a.quality[1]).toBeCloseTo((50 - content.legs.noneAt) / (content.legs.fullAt - content.legs.noneAt));
  });
});

describe('key cards', () => {
  it('finds the three key cards in card order', () => {
    const keys = keyCardIndices(content);
    expect(keys.map(i => content.cards[i]!.label)).toEqual(['SUB', 'SUPR', 'SPRT']);
  });

  it('takes the best day of a card placed twice (the one with the most legs)', () => {
    const a = analyse(content, week('SUB', 'SUB', 'REST', 'SUB'));
    const sub = a.keys.find(k => content.cards[k.card]!.label === 'SUB')!;
    expect(sub.day).toBe(0); // legs 100 on Monday beats 50 on Tuesday and 80 on Thursday
    expect(sub.legs).toBe(100);
    expect(sub.best).toBe(1);
  });

  it('takes the earliest of equal days', () => {
    const a = analyse(content, week('SUB', 'REST', 'REST', 'REST', 'SUB'));
    expect(a.keys[0]!.day).toBe(0);
  });

  it('reports a card that was never placed with no day and no quality', () => {
    const a = analyse(content, week('SUB'));
    const sprt = a.keys.find(k => content.cards[k.card]!.label === 'SPRT')!;
    expect(sprt).toEqual({ card: sprt.card, best: 0, day: null, legs: null });
  });

  it('lists the key cards still missing', () => {
    expect(missingKeys(content, week('SUB', 'EASY')).map(c => c.label)).toEqual(['SUPR', 'SPRT']);
    expect(missingKeys(content, week('SUB', 'SUPR', 'SPRT'))).toEqual([]);
    expect(missingKeys(content, week()).map(c => c.label)).toEqual(['SUB', 'SUPR', 'SPRT']);
  });
});

describe('the checks', () => {
  it('counts key and support sessions, not rest, away or empty days', () => {
    const a = analyse(content, week('SUB', 'EASY', 'REST', 'AWAY'));
    expect(a.sessions).toBe(2);
    expect(a.restDays).toBe(5); // REST, AWAY and the three empty days
  });

  it('wants at least the minimum number of sessions', () => {
    const four = analyse(content, week('SUB', 'EASY', 'SUPR', 'EASY', 'REST', 'REST', 'REST'));
    expect(four.sessions).toBe(4);
    expect(four.checks.sessions).toBe(false);
    const five = analyse(content, week('SUB', 'EASY', 'SUPR', 'EASY', 'SPRT', 'REST', 'REST'));
    expect(five.checks.sessions).toBe(true);
  });

  it('wants the rest days between the minimum and the maximum', () => {
    const none = analyse(content, week('EASY', 'EASY', 'EASY', 'EASY', 'EASY', 'EASY', 'EASY'));
    expect(none.restDays).toBe(0);
    expect(none.checks.rest).toBe(false);
    const one = analyse(content, week('EASY', 'EASY', 'EASY', 'EASY', 'EASY', 'EASY', 'REST'));
    expect(one.checks.rest).toBe(true);
    const three = analyse(content, week('EASY', 'EASY', 'EASY', 'EASY', 'REST', 'REST', 'REST'));
    expect(three.checks.rest).toBe(true);
    const four = analyse(content, week('EASY', 'EASY', 'EASY', 'REST', 'REST', 'REST', 'AWAY'));
    expect(four.restDays).toBe(4);
    expect(four.checks.rest).toBe(false);
  });

  it('counts an away day and an empty day as rest', () => {
    const a = analyse(content, week('EASY', 'AWAY', '--', 'EASY', 'EASY', 'EASY', 'EASY'));
    expect(a.restDays).toBe(2);
    expect(a.checks.rest).toBe(true);
  });

  it('counts mornings below the red line, one cut of the structure mark each', () => {
    // Key, key, rest: Wednesday is at 100 - 50 - 20 = 30, a red morning
    const one = analyse(content, week('SUB', 'SUPR', 'REST', 'REST', 'REST', 'REST', 'REST'));
    expect(one.legs[2]).toBe(30);
    expect(one.redMornings).toBe(1);
    expect(one.checks.red).toBe(false);
    // The red term takes 0.5 off for the first red morning
    const withoutRed = analyse(content, week('SUB', 'REST', 'SUPR', 'REST', 'SPRT', 'EASY', 'EASY'));
    expect(withoutRed.redMornings).toBe(0);
    expect(withoutRed.checks.red).toBe(true);
  });

  it('floors the red term at zero', () => {
    const a = analyse(content, week('SUB', 'SUPR', 'SPRT', 'SUB', 'SUPR', 'SPRT', 'SUB'));
    expect(a.redMornings).toBe(5);
    // sessions ok (7 >= 5), rest not ok (0 rest days), red term floored: structure = (1 + 0 + 0) / 3
    expect(a.structure).toBeCloseTo(1 / 3);
  });

  it('exactly matches the spec at the threshold of a red morning (legs below, not at, the line)', () => {
    const edge = { ...content, checks: { ...content.checks, redBelow: 50 } };
    const a = analyse(edge, week('SUB', 'REST'));
    expect(a.legs[1]).toBe(50);
    expect(a.redMornings).toBe(0); // 50 is not below 50
  });
});

describe('the score', () => {
  it('gives the perfect hard-easy week 0.96', () => {
    expect(stat(week('SUB', 'EASY', 'SUPR', 'EASY', 'SPRT', 'EASY', 'REST'))).toBeCloseTo(0.96);
  });

  it('gives other good weeks the same 0.96 (key, rest, key, rest, key, easy, easy)', () => {
    expect(stat(week('SUB', 'REST', 'SUPR', 'REST', 'SPRT', 'EASY', 'EASY'))).toBeCloseTo(0.96);
  });

  it('keeps the perfect score with the away day on any of TUE, WED or THU', () => {
    for (const away of [1, 2, 3]) {
      // Find a perfect plan for this away day by search: it must exist and score 0.96
      let best = 0;
      const cards = ['SUB', 'SUPR', 'SPRT', 'EASY', 'REST'];
      const plan: string[] = Array.from({ length: 7 }, () => '--');
      plan[away] = 'AWAY';
      const days = [0, 1, 2, 3, 4, 5, 6].filter(d => d !== away);
      const rec = (i: number) => {
        if (i === days.length) {
          best = Math.max(best, stat(week(...plan)));
          return;
        }
        for (const c of cards) {
          plan[days[i]!] = c;
          rec(i + 1);
        }
      };
      rec(0);
      expect(best).toBeCloseTo(0.96);
    }
  });

  it('scores a hard day on each of the days one after another far below it', () => {
    expect(stat(week('SUB', 'SUPR', 'SPRT', 'SUB', 'SUPR', 'SPRT', 'SUB'))).toBeCloseTo(0.43, 2);
  });

  it('scores only easy sessions, or an empty week, 0.20', () => {
    expect(stat(week('EASY', 'EASY', 'EASY', 'EASY', 'EASY', 'EASY', 'REST'))).toBeCloseTo(0.2);
    expect(stat(week())).toBeCloseTo(0.2);
  });

  it('gates the structure bonus on the key work: the data quality is 0.5 at a stimulus of 0.5 or less', () => {
    // Two key sessions at full quality and the third missing: stimulus 2/3
    const two = analyse(content, week('SUB', 'EASY', 'SUPR', 'EASY', 'REST', 'EASY', 'EASY'));
    expect(two.stimulus).toBeCloseTo(2 / 3);
    expect(two.dataQuality).toBeGreaterThan(0.5);
    // One key session at full quality: stimulus 1/3, no bonus
    const one = analyse(content, week('SUB', 'EASY', 'EASY', 'EASY', 'EASY', 'REST', 'EASY'));
    expect(one.stimulus).toBeCloseTo(1 / 3);
    expect(one.dataQuality).toBe(0.5);
  });

  it('keeps the variable accuracy equal to the stimulus', () => {
    const a = analyse(content, week('SUB', 'EASY', 'SUPR', 'REST', 'SPRT', 'EASY', 'REST'));
    expect(a.variableAccuracy).toBe(a.stimulus);
  });

  it('puts every plan between 0.2 and 0.96', () => {
    const rng = seeded(7);
    const chips = ['--', 'SUB', 'SUPR', 'EASY', 'SPRT', 'REST', 'AWAY'];
    for (let i = 0; i < 2000; i++) {
      const s = stat(week(...Array.from({ length: 7 }, () => chips[Math.floor(rng() * chips.length)]!)));
      expect(s).toBeGreaterThanOrEqual(0.2 - 1e-9);
      expect(s).toBeLessThanOrEqual(0.96 + 1e-9);
    }
  });
});

describe('chips and sessions', () => {
  it('labels each kind of day', () => {
    expect(chipLabel(content, EMPTY)).toBe('--');
    expect(chipLabel(content, REST)).toBe('REST');
    expect(chipLabel(content, AWAY)).toBe(content.awayLabel);
    expect(chipLabel(content, cardSession(0))).toBe(content.cards[0]!.label);
  });

  it('turns a chip text back into its session', () => {
    for (const text of ['--', 'REST', content.awayLabel, ...content.cards.map(c => c.label)]) {
      expect(chipLabel(content, sessionFromChip(content, text))).toBe(text);
    }
    expect(sessionFromChip(content, 'NOPE')).toBe(EMPTY);
  });

  it('compares sessions by kind and card', () => {
    expect(sameSession(cardSession(1), cardSession(1))).toBe(true);
    expect(sameSession(cardSession(1), cardSession(2))).toBe(false);
    expect(sameSession(REST, REST)).toBe(true);
    expect(sameSession(REST, AWAY)).toBe(false);
  });

  it('fills the gaps in a content line and leaves unknown ones alone', () => {
    expect(fillLine('{label}: legs {legs}% {nope}', { label: 'SUB', legs: 50 })).toBe('SUB: legs 50% {nope}');
  });

  it('shortens a zone name before its bracket', () => {
    expect(shortZone('Sub-threshold (LT1-LT2 pace)')).toBe('Sub-threshold');
    expect(shortZone('Easy Running (slower than LT1)')).toBe('Easy Running');
    expect(shortZone('Plain')).toBe('Plain');
  });
});

describe('an attempt', () => {
  it('picks the away day from TUE, WED and THU only, all three turning up', () => {
    const rng = seeded(1);
    const seen = new Set<number | null>();
    for (let i = 0; i < 300; i++) seen.add(pickAway(content, rng));
    expect([...seen].sort()).toEqual([1, 2, 3]);
  });

  it('has no away day when the level has none', () => {
    expect(pickAway({ ...content, awayDay: false }, seeded(1))).toBeNull();
  });

  it('keeps the away day in range even when the rng returns 1', () => {
    expect(pickAway(content, () => 0.9999999)).toBe(3);
    expect(pickAway(content, () => 1)).toBe(3);
    expect(pickAway(content, () => 0)).toBe(1);
  });

  it('shuffles the cards into a permutation, differently for different seeds', () => {
    const orders = new Set<string>();
    for (let seed = 0; seed < 40; seed++) {
      const order = shuffledCards(content, seeded(seed));
      expect([...order].sort()).toEqual(content.cards.map((_, i) => i));
      orders.add(order.join(','));
    }
    expect(orders.size).toBeGreaterThan(8);
  });

  it('replays the same attempt from the same seed', () => {
    const a = createPlanner(content, seeded(5));
    const b = createPlanner(content, seeded(5));
    expect(a.away).toBe(b.away);
    expect(a.order).toEqual(b.order);
  });
});

describe('the planner', () => {
  it('starts on Monday with an empty week (apart from the away day)', () => {
    const p = createPlanner(content, seeded(3));
    expect(p.cursor).toBe(0);
    expect(p.plan.filter(s => s.kind === 'empty')).toHaveLength(DAY_COUNT - 1);
    expect(p.plan[p.away!]).toBe(AWAY);
    expect(p.touched()).toBe(false);
  });

  it('cycles a day through nothing, the cards in this attempt\'s order, then REST', () => {
    const p = createPlanner(content, seeded(3));
    if (p.away === 0) throw new Error('Monday should never be the away day');
    const seen: string[] = [chipLabel(content, p.plan[0]!)];
    for (let i = 0; i < 6; i++) {
      p.cycle(1);
      seen.push(chipLabel(content, p.plan[0]!));
    }
    expect(seen).toEqual(['--', ...p.order.map(i => content.cards[i]!.label), 'REST', '--']);
  });

  it('cycles backwards from nothing to REST', () => {
    const p = createPlanner(content, seeded(3));
    p.cycle(-1);
    expect(p.plan[0]).toBe(REST);
    p.cycle(-1);
    expect(p.plan[0]).toEqual(cardSession(p.order[p.order.length - 1]!));
  });

  it('moves the cursor across the days and the GO slot, wrapping both ways', () => {
    const p = createPlanner(content, seeded(3));
    p.move(-1);
    expect(p.cursor).toBe(GO);
    p.move(1);
    expect(p.cursor).toBe(0);
    for (let i = 0; i < DAY_COUNT; i++) p.move(1);
    expect(p.cursor).toBe(GO);
  });

  it('moves on with next() until GO, where it stops', () => {
    const p = createPlanner(content, seeded(3));
    for (let i = 0; i < DAY_COUNT; i++) expect(p.next()).toBe(true);
    expect(p.cursor).toBe(GO);
    expect(p.next()).toBe(false);
    expect(p.cursor).toBe(GO);
  });

  it('cannot change the away day, and does nothing on GO', () => {
    const p = createPlanner(content, seeded(3));
    while (p.cursor !== p.away) p.move(1);
    expect(p.cycle(1)).toBe(false);
    expect(p.plan[p.away!]).toBe(AWAY);
    while (p.cursor !== GO) p.move(1);
    expect(p.cycle(1)).toBe(false);
  });

  it('is touched once a card or a rest is placed, not by an away day alone', () => {
    const p = createPlanner(content, seeded(3));
    expect(p.touched()).toBe(false);
    p.cycle(-1); // REST on Monday
    expect(p.touched()).toBe(true);
  });

  it('keeps the analysis in step with the plan', () => {
    const p = createPlanner(content, seeded(3));
    const before = p.analysis.sessions;
    p.cycle(1);
    expect(p.analysis.sessions).toBe(before + (content.cards[p.order[0]!]!.role === 'key' || content.cards[p.order[0]!]!.role === 'support' ? 1 : 0));
    expect(p.analysis).toEqual(analyse(content, p.plan));
  });

  it('reports the missing key cards', () => {
    const p = createPlanner(content, seeded(3));
    expect(p.missing().map(c => c.label)).toEqual(['SUB', 'SUPR', 'SPRT']);
  });

  it('can reach every session on every day', () => {
    for (let seed = 0; seed < 20; seed++) {
      const p = createPlanner(content, seeded(seed));
      for (let day = 0; day < DAY_COUNT; day++) {
        if (day > 0) p.move(1);
        if (day === p.away) continue;
        const reached = new Set<string>();
        for (let i = 0; i < p.options.length; i++) {
          reached.add(chipLabel(content, p.plan[day]!));
          p.cycle(1);
        }
        expect(reached.size).toBe(p.options.length);
      }
    }
  });
});

describe('what the screens draw', () => {
  it('makes a cell per day: its kind, its chip text, its legs, and whether a key session is flagged', () => {
    const plan = week('SUB', 'SUPR', 'EASY', 'REST', 'AWAY', '--');
    const cells = dayCells(content, plan, analyse(content, plan));
    expect(cells.map(c => c.kind)).toEqual(['key', 'key', 'support', 'rest', 'away', 'empty', 'empty']);
    expect(cells.map(c => c.label)).toEqual(['SUB', 'SUPR', 'EASY', 'REST', 'AWAY', '--', '--']);
    expect(cells.map(c => c.legs)).toEqual([100, 50, 30, 75, 100, 100, 100]);
    expect(cells.map(c => c.flagged)).toEqual([false, true, false, false, false, false, false]);
  });

  it('stacks the zones as a ladder: support first, then the key cards in card order', () => {
    expect(ladderOrder(content).map(i => content.cards[i]!.label)).toEqual(['EASY', 'SUB', 'SUPR', 'SPRT']);
    expect(ladderRungs(content)).toEqual(['support', 'key', 'key', 'key']);
  });
});

describe('how a day is played', () => {
  it('maps each running card to its style', () => {
    const style = (label: string) => styleOf(content, sessionFromChip(content, label));
    expect(style('EASY')).toBe('easy');
    expect(style('SUB')).toBe('steady');
    expect(style('SUPR')).toBe('reps');
    expect(style('SPRT')).toBe('sprints');
    expect(style('REST')).toBe('rest');
    expect(style('AWAY')).toBe('away');
    expect(style('--')).toBe('none');
  });

  it('falls back to the card\'s role for a label it does not know', () => {
    const odd = { ...content, cards: [{ ...content.cards[0]!, label: 'XXXX', role: 'key' as const }, { ...content.cards[2]!, label: 'YYYY', role: 'support' as const }] };
    expect(styleOf(odd, cardSession(0))).toBe('steady');
    expect(styleOf(odd, cardSession(1))).toBe('easy');
  });

  it('alternates work and rest through reps and sprints, and shows steady running as steady', () => {
    const reps = Array.from({ length: 20 }, (_, i) => phaseAt('reps', (i + 0.5) / 20));
    expect(reps).toContain('work');
    expect(reps).toContain('rest');
    expect(reps[0]).toBe('work');
    expect(reps[reps.length - 1]).toBe('rest');
    const sprints = Array.from({ length: 30 }, (_, i) => phaseAt('sprints', (i + 0.5) / 30));
    expect(sprints.filter(p => p === 'work').length).toBeLessThan(sprints.filter(p => p === 'rest').length);
    expect(phaseAt('steady', 0.4)).toBe('steady');
    expect(phaseAt('easy', 0.9)).toBe('steady');
    expect(phaseAt('rest', 0.5)).toBe('off');
    expect(phaseAt('away', 0.5)).toBe('off');
    expect(phaseAt('none', 0.5)).toBe('off');
  });
});

describe('the run', () => {
  const step = (clock: ReturnType<typeof createRunClock>, seconds: number, fast = false) => {
    for (let t = 0; t < seconds - 1e-9; t += 1 / 60) clock.update(1 / 60, fast);
  };

  it('takes 1.2 seconds a day', () => {
    const clock = createRunClock();
    expect(clock.day).toBe(0);
    step(clock, DAY_SECONDS * 0.5);
    expect(clock.day).toBe(0);
    expect(clock.progress).toBeCloseTo(0.5, 1);
    step(clock, DAY_SECONDS * 0.5 + 0.02);
    expect(clock.day).toBe(1);
    expect(clock.daysDone).toBe(1);
  });

  it('finishes after seven days and a short hold, staying on the last day', () => {
    const clock = createRunClock();
    step(clock, DAY_SECONDS * DAY_COUNT + 0.05);
    expect(clock.daysDone).toBe(DAY_COUNT);
    expect(clock.day).toBe(DAY_COUNT - 1);
    expect(clock.progress).toBe(1);
    expect(clock.finished).toBe(false);
    step(clock, END_HOLD);
    expect(clock.finished).toBe(true);
  });

  it('goes four times as fast while A is held, but not in the first moments (the YES press)', () => {
    const slow = createRunClock();
    step(slow, 1);
    const fast = createRunClock();
    step(fast, FAST_LOCK - 0.03, true);
    // The lock ignored the held A, so this is still just the real time spent
    const early = fast.day + fast.progress;
    expect(early).toBeCloseTo((FAST_LOCK - 0.03) / DAY_SECONDS, 1);
    expect(fast.fast).toBe(false); // still inside the lock
    step(fast, 1, true);
    expect(fast.fast).toBe(true);
    const gained = fast.day + fast.progress - early;
    expect(gained).toBeCloseTo((FAST_FORWARD * 1) / DAY_SECONDS, 0);
    expect(slow.day + slow.progress).toBeCloseTo(1 / DAY_SECONDS, 1);
  });

  it('only fast-forwards once A has been held for the lock without a break, and stops the moment it is let go', () => {
    const clock = createRunClock();
    step(clock, FAST_LOCK + 0.05, true);
    expect(clock.fast).toBe(true);
    step(clock, 1 / 60, false);
    expect(clock.fast).toBe(false);
  });

  it('does not fast-forward on taps of A, or on a press that closed the pause menu (it is over before the lock)', () => {
    const clock = createRunClock();
    for (let i = 0; i < 6; i++) {
      step(clock, FAST_LOCK - 0.05, true); // a press that lasts less than the lock...
      step(clock, 0.05, false); // ...then a let-go
      expect(clock.fast).toBe(false);
    }
    // Every step ran at normal speed: six rounds of exactly the lock's length
    expect(clock.day + clock.progress).toBeCloseTo((6 * FAST_LOCK) / DAY_SECONDS, 1);
  });
});
