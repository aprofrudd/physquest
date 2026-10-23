// The Analysis Room's review model: the numbers, the verdict rule, the ruler, the pin, the scoring and the steps.
import { describe, expect, it } from 'vitest';
import { LEVEL_DATA } from '../src/data/sports';
import { RUNNING } from '../src/rooms/content/running';
import type { ReviewRow } from '../src/rooms/content/types';
import { calcStat } from '../src/state/GameState';
import {
  VERDICTS,
  changeOf,
  beyondNoise,
  chipsFor,
  clampPin,
  createReview,
  decimalsOf,
  forecastScore,
  forecastWords,
  fractionOf,
  improvementOf,
  pinImprovement,
  pinRange,
  readoutFor,
  retestOf,
  retestSentence,
  scaleFor,
  scoreOf,
  shuffled,
  stepsForHold,
  summaryOf,
  ticksFor,
  titleOf,
  trueVerdict,
  valueFor,
  whyFor,
  worthwhile,
  type Verdict,
} from '../src/rooms/analysis/model';

const content = RUNNING.analysis;
const { trained, decoy } = content;

/** A small seeded rng (mulberry32) so shuffles are repeatable. */
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

const row = (patch: Partial<ReviewRow>): ReviewRow => ({ ...trained, ...patch });

describe('the numbers of a row', () => {
  it('reads the change and the improvement whichever way the metric runs', () => {
    expect(changeOf(trained)).toBe(-2); // 62 to 60 s: the time fell
    expect(improvementOf(trained)).toBe(2); // and falling is better
    expect(changeOf(decoy)).toBe(2); // 65 to 67
    expect(improvementOf(decoy)).toBe(2); // and rising is better
  });

  it('turns an improvement back into the metric\'s own units', () => {
    expect(valueFor(trained, 1.6)).toBe(60.4);
    expect(valueFor(trained, -0.4)).toBe(62.4);
    expect(valueFor(decoy, 3)).toBe(68);
    expect(valueFor(decoy, 0)).toBe(65);
  });
});

describe('the verdict rule', () => {
  it('calls the last 400 m worth acting on and the VO2max change real but too small', () => {
    expect(trueVerdict(trained)).toBe('worth'); // 2.0 is beyond both the typical error (0.6) and the SWC (0.8)
    expect(trueVerdict(decoy)).toBe('small'); // 2 is beyond the typical error (1.5) but short of the SWC (3.0)
  });

  it('puts every boundary on the right side', () => {
    const at = (size: number) => trueVerdict(row({ baseline: 62, retest: 62 - size, te: 0.6, swc: 0.8 }));
    expect(at(0)).toBe('noise');
    expect(at(0.6)).toBe('noise'); // exactly the typical error: still noise
    expect(at(0.7)).toBe('small');
    expect(at(0.79)).toBe('small');
    expect(at(0.8)).toBe('worth'); // exactly the smallest worthwhile change: worth acting on
    expect(at(5)).toBe('worth');
  });

  it('is not tipped by floating point (61.4 is exactly 0.6 from 62)', () => {
    expect(trueVerdict(row({ baseline: 62, retest: 61.4 }))).toBe('noise');
    expect(trueVerdict(row({ baseline: 62, retest: 61.2 }))).toBe('worth'); // 0.8
  });

  it('judges a change in the worse direction by its size', () => {
    expect(trueVerdict(row({ retest: 62.4 }))).toBe('noise'); // 0.4 slower
    expect(trueVerdict(row({ retest: 62.7 }))).toBe('small'); // 0.7 slower
    expect(trueVerdict(row({ retest: 64 }))).toBe('worth'); // 2.0 slower: a worthwhile change, the wrong way
    expect(trueVerdict(row({ baseline: 65, retest: 62, better: 'higher', te: 1.5, swc: 3 }))).toBe('worth');
  });

  it('calls a swc that is no bigger than the typical error worth acting on once past the error', () => {
    expect(trueVerdict(row({ te: 1, swc: 0.5, retest: 60.5 }))).toBe('worth'); // 1.5 beyond te
    expect(trueVerdict(row({ te: 1, swc: 0.5, retest: 61.5 }))).toBe('noise'); // 0.5 inside te
  });
});

describe('the ruler', () => {
  it('runs from 1.5 x the expected change on the worse side to 2.5 x on the better side', () => {
    expect(scaleFor(trained)).toEqual({ worse: -3, better: 5 });
    expect(valueFor(trained, -3)).toBe(65); // numbers fall to the right for the last 400 m
    expect(valueFor(trained, 5)).toBe(57);
    expect(scaleFor(decoy)).toEqual({ worse: -3, better: 5 });
    expect(valueFor(decoy, -3)).toBe(62);
    expect(valueFor(decoy, 5)).toBe(70);
  });

  it('puts the baseline at three eighths of the way across', () => {
    const scale = scaleFor(trained);
    expect(fractionOf(scale, 0)).toBeCloseTo(3 / 8);
    expect(fractionOf(scale, scale.worse)).toBe(0);
    expect(fractionOf(scale, scale.better)).toBe(1);
  });

  it('labels whole numbers, worse to better, left to right', () => {
    const ticks = ticksFor(trained, scaleFor(trained));
    expect(ticks.map(t => t.value)).toEqual([65, 64, 63, 62, 61, 60, 59, 58, 57]);
    expect(ticks.map(t => t.improvement)).toEqual([-3, -2, -1, 0, 1, 2, 3, 4, 5]);
    expect(ticksFor(decoy, scaleFor(decoy)).map(t => t.value)).toEqual([62, 63, 64, 65, 66, 67, 68, 69, 70]);
  });

  it('thins the labels when the ruler is long', () => {
    const long = row({ baseline: 340, retest: 360, better: 'higher', te: 7, swc: 10 });
    const values = ticksFor(long, scaleFor(long)).map(t => t.value);
    expect(values.length).toBeLessThan(12);
    expect(values).toContain(340);
  });

  it('survives a row with no change at all', () => {
    const flat = row({ retest: 62 });
    const scale = scaleFor(flat);
    expect(scale.better).toBeGreaterThan(0);
    expect(scale.worse).toBeLessThan(0);
  });
});

describe('the forecast pin', () => {
  const scale = scaleFor(trained);
  const range = pinRange(scale, content.step);

  it('moves in steps of 0.2 s over -15 to +25 steps', () => {
    expect(range).toEqual({ min: -15, max: 25 });
    expect(pinImprovement(8, content.step)).toBe(1.6);
    expect(pinImprovement(-3, content.step)).toBe(-0.6);
    expect(valueFor(trained, pinImprovement(range.min, content.step))).toBe(65);
    expect(valueFor(trained, pinImprovement(range.max, content.step))).toBe(57);
  });

  it('clamps at both ends', () => {
    expect(clampPin(-40, range)).toBe(-15);
    expect(clampPin(99, range)).toBe(25);
    expect(clampPin(7, range)).toBe(7);
  });

  it('speeds up while a direction is held', () => {
    expect(stepsForHold(0)).toBe(1);
    expect(stepsForHold(0.99)).toBe(1);
    expect(stepsForHold(1)).toBe(2);
    expect(stepsForHold(1.9)).toBe(2);
    expect(stepsForHold(2)).toBe(3);
    expect(stepsForHold(30)).toBe(3);
  });

  it('lights BEYOND NOISE past the band and WORTHWHILE past the gold line, on either side', () => {
    expect(chipsFor(trained, 0)).toEqual({ beyondNoise: false, worthwhile: false });
    expect(chipsFor(trained, 0.6)).toEqual({ beyondNoise: false, worthwhile: false }); // on the band's edge: still inside
    expect(chipsFor(trained, 0.8)).toEqual({ beyondNoise: true, worthwhile: true }); // 0.8 is the gold line itself
    expect(chipsFor(trained, 0.7)).toEqual({ beyondNoise: true, worthwhile: false });
    expect(chipsFor(trained, -0.7)).toEqual({ beyondNoise: true, worthwhile: false });
    expect(chipsFor(trained, 2)).toEqual({ beyondNoise: true, worthwhile: true });
  });

  it('has the same answers as booleans (used while drawing)', () => {
    for (const improvement of [-2, -0.7, -0.6, 0, 0.6, 0.7, 0.8, 2]) {
      const chips = chipsFor(trained, improvement);
      expect(beyondNoise(trained, improvement)).toBe(chips.beyondNoise);
      expect(worthwhile(trained, improvement)).toBe(chips.worthwhile);
    }
  });

  it('counts decimals in a step', () => {
    expect(decimalsOf(0.2)).toBe(1);
    expect(decimalsOf(0.25)).toBe(2);
    expect(decimalsOf(2)).toBe(0);
  });
});

describe('the retest against the forecast', () => {
  it('says whether the forecast is inside the error bars', () => {
    expect(retestOf(trained, 1.6)).toEqual({ forecast: 1.6, actual: 2, off: 0.4, inside: true });
    expect(retestOf(trained, 2.4)).toMatchObject({ off: 0.4, inside: true });
    expect(retestOf(trained, 1.4)).toMatchObject({ off: 0.6, inside: true }); // exactly one typical error: inside
    expect(retestOf(trained, 1.2)).toMatchObject({ off: 0.8, inside: false });
    expect(retestOf(trained, 0)).toMatchObject({ off: 2, inside: false });
  });
});

describe('scoring', () => {
  const c1 = (forecast: number) => forecastScore(forecast, improvementOf(trained), trained.te);

  it('gives full marks within one typical error', () => {
    expect(c1(2)).toBe(1);
    expect(c1(1.4)).toBe(1); // exactly 0.6 off
    expect(c1(2.6)).toBe(1);
    expect(c1(1.6)).toBe(1); // the pin on an earlier block's tick (60.4)
    expect(c1(2.4)).toBe(1); // and on the other (59.6)
  });

  it('falls in a straight line to nothing at four typical errors', () => {
    expect(c1(1.2)).toBeCloseTo(1 - (0.8 / 0.6 - 1) / 3); // 0.889
    expect(c1(0.8)).toBeCloseTo(1 - (1.2 / 0.6 - 1) / 3); // 0.667
    expect(c1(0)).toBeCloseTo(0.2222, 3); // forecasting "no change"
    expect(c1(-0.4)).toBe(0); // 2.4 off = exactly four typical errors
    expect(c1(-3)).toBe(0);
    expect(c1(4.4)).toBe(0);
    expect(c1(5)).toBe(0);
  });

  it('never leaves 0 to 1 and treats over and under alike', () => {
    for (let k = -15; k <= 25; k++) {
      const score = c1(pinImprovement(k, content.step));
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    }
    expect(c1(2 - 1.5)).toBeCloseTo(c1(2 + 1.5), 6);
  });

  it('weights the forecast 60% and the verdicts 40%, and lands the stat on the usual scale', () => {
    const stat = (a: number, b: number) => {
      const s = scoreOf(a, b);
      return calcStat(s.dataQuality, s.variableAccuracy);
    };
    expect(stat(1, 1)).toBeCloseTo(0.96, 6);
    expect(stat(0, 0)).toBeCloseTo(0.32, 6);
    expect(stat(1, 0)).toBeCloseTo(0.32 + 0.64 * 0.6, 6);
    expect(stat(0, 1)).toBeCloseTo(0.32 + 0.64 * 0.4, 6);
    expect(scoreOf(1, 1).q).toBe(1);
    expect(scoreOf(0.5, 0.5).q).toBeCloseTo(0.5);
    expect(scoreOf(1, 1).variableAccuracy).toBeCloseTo(1);
    expect(scoreOf(1, 1).dataQuality).toBeCloseTo(0.9);
  });
});

describe('the words built from the numbers', () => {
  it('writes the live readout', () => {
    expect(readoutFor(trained, 0, 0.2)).toBe('FORECAST 62.0 S (NO CHANGE)');
    expect(readoutFor(trained, 8, 0.2)).toBe('FORECAST 60.4 S (1.6 BETTER)');
    expect(readoutFor(trained, -2, 0.2)).toBe('FORECAST 62.4 S (0.4 WORSE)');
    expect(readoutFor(trained, 25, 0.2)).toBe('FORECAST 57.0 S (5.0 BETTER)');
  });

  it('says the forecast for a screen reader', () => {
    expect(forecastWords(trained, 8, 0.2)).toBe('Forecast 60.4 s, 1.6 better.');
    expect(forecastWords(trained, 0, 0.2)).toBe('Forecast 62.0 s, no change.');
    expect(forecastWords(trained, -2, 0.2)).toBe('Forecast 62.4 s, 0.4 worse.');
  });

  it('titles a row and summarises it', () => {
    expect(titleOf(trained)).toBe('LAST 400 M (S)');
    expect(titleOf(decoy)).toBe('VO2MAX (ML/KG/MIN)');
    expect(summaryOf(trained)).toBe('LAST 400 M: 62 → 60 S');
    expect(summaryOf(decoy)).toBe('VO2MAX: 65 → 67 ML/KG/MIN');
  });

  it('fills the explanation of the true verdict from the content, verbatim', () => {
    expect(whyFor(content, trained)).toBe('It moved 2.0 s: beyond the typical error (0.6) and the smallest worthwhile change (0.8).');
    expect(whyFor(content, decoy)).toBe(
      'It moved 2.0 ml/kg/min: beyond the typical error (1.5) but short of the smallest worthwhile change (3.0).',
    );
    expect(whyFor(content, row({ retest: 61.6 }))).toBe('It moved 0.4 s: inside the typical error (0.6), so it could just be noise.');
  });

  it('writes the retest sentence', () => {
    const forecast = 1.6;
    expect(retestSentence(trained, forecast, retestOf(trained, forecast))).toBe(
      'Retest: 60 s. You forecast 60.4 s. Off by 0.4: inside the error bars.',
    );
    expect(retestSentence(trained, 0, retestOf(trained, 0))).toBe('Retest: 60 s. You forecast 62 s. Off by 2.0: outside the error bars.');
    expect(retestSentence(trained, 2, retestOf(trained, 2))).toContain('Spot on.');
  });
});

describe('no sentence the model writes ever carries a stray number', () => {
  const BAD = /NaN|undefined|Infinity|null|-0\.0|\{|\}/;

  it('is clean for every pin position, both rows and every verdict', () => {
    const range = pinRange(scaleFor(trained), content.step);
    for (let steps = range.min; steps <= range.max; steps++) {
      const improvement = pinImprovement(steps, content.step);
      const texts = [
        readoutFor(trained, steps, content.step),
        forecastWords(trained, steps, content.step),
        retestSentence(trained, improvement, retestOf(trained, improvement)),
      ];
      for (const text of texts) expect(text, `pin ${steps}: ${text}`).not.toMatch(BAD);
    }
    for (const r of [trained, decoy]) {
      for (const text of [whyFor(content, r), titleOf(r), summaryOf(r)]) expect(text, text).not.toMatch(BAD);
      // and whichever way the change went, and however big or small it was
      for (const retest of [r.baseline, r.baseline + r.te, r.baseline - r.te, r.baseline + r.swc, r.baseline - r.swc, r.baseline + 10, r.baseline - 10]) {
        const text = whyFor(content, { ...r, retest });
        expect(text, text).not.toMatch(BAD);
        expect(text).toMatch(/^It moved \d+\.\d /);
      }
    }
  });
});

describe('the content the model reads', () => {
  it('agrees with sports.ts about the trained metric', () => {
    const right = LEVEL_DATA[3]!.predictions.find(p => p.correct)!.text;
    expect(right).toContain(`${trained.baseline}s`);
    expect(right).toContain(`${trained.retest}s`);
  });

  it('keeps the baseline trials, the history and the step consistent with the ruler', () => {
    expect(content.baselineTrials.map(t => Math.abs(t - trained.baseline)).every(d => d <= trained.te)).toBe(true);
    for (const h of content.history) expect(Math.round(h / content.step) * content.step).toBeCloseTo(h, 6); // a pin position
    const range = pinRange(scaleFor(trained), content.step);
    for (const h of content.history) expect(h / content.step).toBeLessThan(range.max);
    expect(content.verdicts).toHaveLength(VERDICTS.length);
  });
});

describe('a review', () => {
  it('starts in the brief with the pin on the baseline', () => {
    const review = createReview(content, seeded(1));
    expect(review.phase).toBe('brief');
    expect(review.pin).toBe(0);
    expect(review.locked).toBe(false);
    expect(review.retest()).toBeNull();
    expect(review.picks).toEqual([]);
  });

  it('goes brief, block, forecast and then waits for the lock', () => {
    const review = createReview(content, seeded(1));
    expect(review.advance()).toBe('block');
    expect(review.advance()).toBe('forecast');
    expect(review.advance()).toBe('forecast'); // cannot be skipped
    expect(review.advance()).toBe('forecast');
  });

  it('moves the pin only during the forecast, in whole steps, and clamps it', () => {
    const review = createReview(content, seeded(1));
    expect(review.movePin(1)).toBe(false); // the brief
    review.advance();
    expect(review.movePin(1)).toBe(false); // the block
    review.advance();
    expect(review.movePin(3)).toBe(true);
    expect(review.pin).toBe(3);
    expect(review.movePin(-5)).toBe(true);
    expect(review.pin).toBe(-2);
    expect(review.movePin(-100)).toBe(true);
    expect(review.pin).toBe(-15);
    expect(review.movePin(-1)).toBe(false); // already at the end
    expect(review.movePin(100)).toBe(true);
    expect(review.pin).toBe(25);
    expect(review.movePin(1)).toBe(false);
  });

  it('locks the forecast once and then runs the retest', () => {
    const review = createReview(content, seeded(1));
    expect(review.lock()).toBe(false); // not yet
    review.advance();
    review.advance();
    review.movePin(8);
    expect(review.lock()).toBe(true);
    expect(review.phase).toBe('retest');
    expect(review.locked).toBe(true);
    expect(review.lock()).toBe(false); // only once
    expect(review.movePin(1)).toBe(false); // the pin is fixed now
    expect(review.pin).toBe(8);
    expect(review.retest()).toMatchObject({ off: 0.4, inside: true });
  });

  it('takes one verdict per row, in order, and ignores picks out of turn', () => {
    const review = createReview(content, seeded(1));
    expect(review.pick(0)).toBeNull(); // the brief
    review.advance();
    review.advance();
    review.lock();
    expect(review.pick(0)).toBeNull(); // the retest
    expect(review.advance()).toBe('verdict1');
    expect(review.advance()).toBe('verdict1'); // not before the pick
    expect(review.pick(7)).toBeNull(); // no such option
    expect(review.pick(-1)).toBeNull();
    const first = review.pick(0);
    expect(first).toMatchObject({ row: 'trained', truth: 'worth' });
    expect(review.pick(1)).toBeNull(); // a row is judged once
    expect(review.advance()).toBe('verdict2');
    const second = review.pick(1);
    expect(second).toMatchObject({ row: 'decoy', truth: 'small' });
    expect(review.advance()).toBe('summary');
    expect(review.advance()).toBe('summary');
    expect(review.picks).toHaveLength(2);
  });

  it('shuffles each row\'s list per attempt, but a re-ask of the same attempt shows the same list', () => {
    const a = createReview(content, seeded(7));
    const first = [...a.optionsFor('trained')];
    expect([...first].sort()).toEqual([...VERDICTS].sort()); // a permutation: nothing lost, nothing doubled
    expect([...a.optionsFor('decoy')].sort()).toEqual([...VERDICTS].sort());
    expect([...a.optionsFor('trained')]).toEqual(first);

    const same = createReview(content, seeded(7));
    expect([...same.optionsFor('trained')]).toEqual(first); // seeded: repeatable

    const orders = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) orders.add(createReview(content, seeded(seed)).optionsFor('trained').join(','));
    expect(orders.size).toBe(6); // every order turns up, so a replay can differ
  });

  it('scores the verdict against the TRUE verdict whatever position it is listed in', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const review = createReview(content, seeded(seed));
      review.advance();
      review.advance();
      review.lock();
      review.advance();
      const options = review.optionsFor('trained');
      const rightIndex = options.indexOf('worth');
      expect(review.pick(rightIndex)?.right).toBe(true);
      review.advance();
      const decoyOptions = review.optionsFor('decoy');
      expect(review.pick(decoyOptions.indexOf('noise'))?.right).toBe(false);
    }
  });

  it('averages one third for random verdicts (all nine pairs of picks, each once)', () => {
    let total = 0;
    for (const a of VERDICTS) {
      for (const b of VERDICTS) {
        const review = createReview(content, seeded(5));
        review.advance();
        review.advance();
        review.lock();
        review.advance();
        review.pick(review.optionsFor('trained').indexOf(a));
        review.advance();
        review.pick(review.optionsFor('decoy').indexOf(b));
        total += review.score().c2;
      }
    }
    expect(total / 9).toBeCloseTo(1 / 3, 10);
  });

  it('counts a verdict that was never made as wrong, and a forecast that was never locked as nothing', () => {
    const review = createReview(content, seeded(1));
    expect(review.score()).toMatchObject({ c1: 0, c2: 0 });
    review.advance();
    review.advance();
    review.movePin(10);
    expect(review.score().c1).toBe(0); // still not locked
    review.lock();
    expect(review.score()).toMatchObject({ c1: 1, c2: 0 });
    review.advance();
    review.pick(review.optionsFor('trained').indexOf('worth'));
    expect(review.score()).toMatchObject({ c1: 1, c2: 0.5 });
  });

  it('lands a perfect review at 96% and a review with everything wrong at 32%', () => {
    const play = (pinSteps: number, picks: [Verdict, Verdict]) => {
      const review = createReview(content, seeded(3));
      review.advance();
      review.advance();
      review.movePin(pinSteps);
      review.lock();
      review.advance();
      review.pick(review.optionsFor('trained').indexOf(picks[0]));
      review.advance();
      review.pick(review.optionsFor('decoy').indexOf(picks[1]));
      review.advance();
      const score = review.score();
      return calcStat(score.dataQuality, score.variableAccuracy);
    };
    expect(play(10, ['worth', 'small'])).toBeCloseTo(0.96, 6);
    expect(play(-15, ['noise', 'worth'])).toBeCloseTo(0.32, 6);
  });
});

describe('shuffling', () => {
  it('is a permutation and leaves its input alone', () => {
    const input = [1, 2, 3, 4, 5];
    const out = shuffled(input, seeded(5));
    expect(input).toEqual([1, 2, 3, 4, 5]);
    expect([...out].sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('copes with nothing and with one thing', () => {
    expect(shuffled([], seeded(1))).toEqual([]);
    expect(shuffled(['x'], seeded(1))).toEqual(['x']);
  });
});
