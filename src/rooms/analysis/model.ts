// The Analysis Room's "Signal or Noise" review as a pure model: the numbers, the ruler's scale, the forecast pin,
// the verdict rule, the scoring and the order of the steps. No DOM and no canvas, so vitest can drive it with a
// seeded rng; index.ts adds the buttons, the timers and the pictures.
//
// Everything on the ruler is measured in IMPROVEMENT: 0 at the baseline, positive = better, whichever way the
// metric runs (lower is better for the last 400 m, higher for VO2max). A lower-is-better ruler therefore needs no
// special case: its numbers simply fall to the right.
import type { AnalysisContent, ReviewRow } from '../content/types';

export type Verdict = 'noise' | 'small' | 'worth';
/** The three verdicts, in the order AnalysisContent.verdicts lists them. */
export const VERDICTS: readonly Verdict[] = ['noise', 'small', 'worth'];

export type RowId = 'trained' | 'decoy';

export type Phase = 'brief' | 'block' | 'forecast' | 'retest' | 'verdict1' | 'verdict2' | 'summary';
const ORDER: readonly Phase[] = ['brief', 'block', 'forecast', 'retest', 'verdict1', 'verdict2', 'summary'];

/** Float noise (61.4 - 62 is -0.6000000000000014) must never tip a result across a threshold. */
export const round6 = (value: number): number => Math.round(value * 1e6) / 1e6;

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

// ---- the numbers of one row ---------------------------------------------------------------------------------------

/** The change in the metric's own units, signed (retest minus baseline). */
export const changeOf = (row: ReviewRow): number => round6(row.retest - row.baseline);

/** The change as improvement: positive = better. */
export const improvementOf = (row: ReviewRow): number => (row.better === 'higher' ? changeOf(row) : round6(-changeOf(row)));

/** The metric's value for an improvement (0 = baseline). */
export const valueFor = (row: ReviewRow, improvement: number): number =>
  round6(row.baseline + (row.better === 'higher' ? improvement : -improvement));

/**
 * The true call: a change inside the typical error could just be noise; a bigger one is real, but only worth
 * acting on once it reaches the smallest worthwhile change. A change in the WORSE direction is judged the same way.
 */
export const trueVerdict = (row: ReviewRow): Verdict => {
  const size = Math.abs(changeOf(row));
  if (size <= row.te) return 'noise';
  if (size < row.swc) return 'small';
  return 'worth';
};

// ---- the ruler's scale --------------------------------------------------------------------------------------------

/** What the ruler spans, in improvement: from `worse` (left end, negative) to `better` (right end, positive). */
export interface Scale {
  worse: number;
  better: number;
}

/** 1.5 x the expected change on the worse side, 2.5 x on the better side: room to be wrong either way. */
export const scaleFor = (row: ReviewRow): Scale => {
  const expected = Math.abs(changeOf(row)) || row.swc; // a row with no change still needs a ruler
  return { worse: round6(-1.5 * expected), better: round6(2.5 * expected) };
};

/** Where an improvement sits along the ruler, 0 (left end) to 1 (right end). */
export const fractionOf = (scale: Scale, improvement: number): number => (improvement - scale.worse) / (scale.better - scale.worse);

/** One labelled mark on the axis. */
export interface Tick {
  improvement: number;
  value: number;
}

/** Whole numbers (or a coarser or finer step when the ruler is long or short) to label along the axis. */
export const ticksFor = (row: ReviewRow, scale: Scale): Tick[] => {
  const span = scale.better - scale.worse;
  const step = span <= 12 ? 1 : span <= 24 ? 2 : span <= 60 ? 5 : 10;
  const first = valueFor(row, scale.worse);
  const last = valueFor(row, scale.better);
  const lo = Math.min(first, last);
  const hi = Math.max(first, last);
  const ticks: Tick[] = [];
  for (let value = Math.ceil(round6(lo / step)) * step; value <= hi + 1e-9; value += step) {
    const v = round6(value);
    ticks.push({ improvement: row.better === 'higher' ? round6(v - row.baseline) : round6(row.baseline - v), value: v });
  }
  return ticks.sort((a, b) => a.improvement - b.improvement); // worse to better, left to right
};

// ---- the forecast pin ---------------------------------------------------------------------------------------------

/** The pin moves in whole steps from the baseline (0); positive steps are better. */
export interface PinRange {
  min: number;
  max: number;
}

export const pinRange = (scale: Scale, step: number): PinRange => ({
  min: -Math.floor(round6(-scale.worse / step)),
  max: Math.floor(round6(scale.better / step)),
});

export const clampPin = (steps: number, range: PinRange): number => Math.max(range.min, Math.min(range.max, steps));

export const pinImprovement = (steps: number, step: number): number => round6(steps * step);

/** Holding a direction speeds the pin up: one step at a time, then two after a second, then three after two. */
export const stepsForHold = (heldSeconds: number): number => (heldSeconds >= 2 ? 3 : heldSeconds >= 1 ? 2 : 1);

/** The pin is past the noise band (either side of the baseline). */
export const beyondNoise = (row: ReviewRow, improvement: number): boolean => Math.abs(round6(improvement)) > row.te;

/** The pin is on or past the gold line (either side of the baseline). */
export const worthwhile = (row: ReviewRow, improvement: number): boolean => Math.abs(round6(improvement)) >= row.swc;

/** The two chips under the ruler. */
export const chipsFor = (row: ReviewRow, improvement: number): { beyondNoise: boolean; worthwhile: boolean } => ({
  beyondNoise: beyondNoise(row, improvement),
  worthwhile: worthwhile(row, improvement),
});

// ---- the retest against the forecast ------------------------------------------------------------------------------

export interface Retest {
  forecast: number; // improvement the player locked in
  actual: number; // improvement the retest showed
  off: number; // |forecast - actual| in the metric's units
  inside: boolean; // the forecast is inside the retest's error bars (within one typical error)
}

export const retestOf = (row: ReviewRow, forecastImprovement: number): Retest => {
  const actual = improvementOf(row);
  const off = round6(Math.abs(forecastImprovement - actual));
  return { forecast: forecastImprovement, actual, off, inside: off <= row.te };
};

// ---- scoring ------------------------------------------------------------------------------------------------------

/** e = how many typical errors the forecast missed by. */
export const forecastError = (forecastImprovement: number, actualImprovement: number, te: number): number =>
  Math.abs(forecastImprovement - actualImprovement) / te;

/** Within one typical error: full marks; then falling in a straight line to nothing at four. */
export const forecastScore = (forecastImprovement: number, actualImprovement: number, te: number): number =>
  clamp01(1 - (round6(forecastError(forecastImprovement, actualImprovement, te)) - 1) / 3);

export interface Score {
  /** The forecast, 0-1. */
  c1: number;
  /** The mean of the two verdicts, 0-1. */
  c2: number;
  /** 0.6 c1 + 0.4 c2. */
  q: number;
  variableAccuracy: number;
  dataQuality: number;
}

/** q lands the stat on the scale the other rooms use: stat = 0.32 + 0.64 q (all wrong 0.32, perfect 0.96). */
export const scoreOf = (c1: number, c2: number): Score => {
  const q = 0.6 * c1 + 0.4 * c2;
  return { c1, c2, q, variableAccuracy: 0.2 + 0.8 * q, dataQuality: 0.5 + 0.4 * q };
};

// ---- words built from the numbers ---------------------------------------------------------------------------------

/** One decimal place, never "-0.0". */
export const fmt1 = (value: number): string => {
  const text = round6(value).toFixed(1);
  return text === '-0.0' ? '0.0' : text;
};

/** The number as it is written in the content: 62, 60.4. */
export const plain = (value: number): string => String(round6(value));

/** Decimal places in a step (0.2 has one). */
export const decimalsOf = (step: number): number => {
  const text = String(round6(step));
  const dot = text.indexOf('.');
  return dot < 0 ? 0 : text.length - dot - 1;
};

/** The words for an improvement of `improvement` (in the metric's units): 1.6 FASTER, 0.4 SLOWER, NO CHANGE. */
const gapWords = (row: ReviewRow, improvement: number, decimals: number): string =>
  improvement === 0 ? 'NO CHANGE' : `${Math.abs(improvement).toFixed(decimals)} ${improvement > 0 ? row.betterWord : row.worseWord}`;

/** YOUR GUESS 70.4 S: the label that moves with the guess on the ruler. */
export const guessLabel = (row: ReviewRow, steps: number, step: number): string =>
  `YOUR GUESS ${valueFor(row, pinImprovement(steps, step)).toFixed(Math.max(1, decimalsOf(step)))} ${row.unit}`;

/** YOUR GUESS 70.4 S (1.6 FASTER): the guess with how far it is from BEFORE (the report's head). */
export const readoutFor = (row: ReviewRow, steps: number, step: number): string => {
  const improvement = pinImprovement(steps, step);
  return `${guessLabel(row, steps, step)} (${gapWords(row, improvement, Math.max(1, decimalsOf(step)))})`;
};

/** What a screen reader hears for the guess: Your guess: 70.4 s, 1.6 faster. */
export const forecastWords = (row: ReviewRow, steps: number, step: number): string => {
  const improvement = pinImprovement(steps, step);
  const decimals = Math.max(1, decimalsOf(step));
  return `Your guess: ${valueFor(row, improvement).toFixed(decimals)} ${row.unit.toLowerCase()}, ${gapWords(row, improvement, decimals).toLowerCase()}.`;
};

/** BEFORE 72 S: the label over the baseline pole. */
export const beforeLabel = (row: ReviewRow): string => `BEFORE ${plain(row.baseline)} ${row.unit}`;

/** NOISE: TYPICAL ERROR 0.6 S. */
export const noiseLabel = (row: ReviewRow): string => `NOISE: TYPICAL ERROR ${plain(row.te)} ${row.unit}`;

/** WORTHWHILE CHANGE: 0.8 S. */
export const worthLabel = (row: ReviewRow): string => `WORTHWHILE CHANGE: ${plain(row.swc)} ${row.unit}`;

/** FASTER →: which way is better, at the right of the heading (the ruler always runs worse to better). */
export const betterLabel = (row: ReviewRow): string => `${row.betterWord} →`;

/** The verdict question for a row, from the content's template. */
export const judgeText = (content: AnalysisContent, row: ReviewRow): string => {
  const fills: Readonly<Record<string, string>> = {
    name: row.name,
    before: plain(row.baseline),
    after: plain(row.retest),
    unit: row.unit.toLowerCase(),
  };
  return content.judgeAsk.replace(/\{(name|before|after|unit)\}/g, (_, key: string) => fills[key] ?? '');
};

/** The ruler's heading: LAST 400 M (S). */
export const titleOf = (row: ReviewRow): string => `${row.metric} (${row.unit})`;

/** One line for a finished row: LAST 400 M: 62 → 60 S. */
export const summaryOf = (row: ReviewRow): string => `${row.metric}: ${plain(row.baseline)} → ${plain(row.retest)} ${row.unit}`;

/** The explanation for the TRUE verdict, with the row's numbers filled in. */
export const whyFor = (content: AnalysisContent, row: ReviewRow): string => {
  const template = { noise: content.noiseWhy, small: content.smallWhy, worth: content.worthWhy }[trueVerdict(row)];
  const fills: Readonly<Record<string, string>> = {
    change: fmt1(Math.abs(changeOf(row))),
    unit: row.unit.toLowerCase(),
    te: fmt1(row.te),
    swc: fmt1(row.swc),
  };
  return template.replace(/\{(change|unit|te|swc)\}/g, (_, key: string) => fills[key] ?? '');
};

/** The sentence for the retest: what was forecast, what came back, and whether the forecast was inside the error bars. */
export const retestSentence = (row: ReviewRow, forecast: number, retest: Retest): string => {
  const decimals = 1;
  const where = retest.off === 0 ? 'Spot on.' : `Off by ${retest.off.toFixed(decimals)}: ${retest.inside ? 'inside' : 'outside'} the error bars.`;
  return `Retest: ${plain(row.retest)} ${row.unit.toLowerCase()}. You forecast ${plain(valueFor(row, forecast))} ${row.unit.toLowerCase()}. ${where}`;
};

// ---- the review: the order of the steps and what each one allows --------------------------------------------------

export interface Pick {
  row: RowId;
  picked: Verdict;
  truth: Verdict;
  right: boolean;
}

export interface Review {
  readonly content: AnalysisContent;
  readonly phase: Phase;
  /** The pin, in whole steps from the baseline (positive = better). */
  readonly pin: number;
  readonly locked: boolean;
  readonly pinRange: PinRange;
  readonly picks: readonly Pick[];
  /** The three verdicts in the order this attempt lists them for a row (fixed for the attempt, so a re-ask shows the same list). */
  optionsFor(row: RowId): readonly Verdict[];
  rowFor(row: RowId): ReviewRow;
  /** Brief to block to forecast, retest to the first verdict, and so on. The forecast stays until it is locked and a verdict until it is picked. */
  advance(): Phase;
  /** Moves the pin by whole steps (negative = worse), clamped to the ruler. True if it moved. */
  movePin(delta: number): boolean;
  /** Locks the forecast and goes to the retest. False if it was not the forecast's turn. */
  lock(): boolean;
  /** Records the player's verdict for the row being judged (an index into optionsFor). Null if there is nothing to pick. */
  pick(optionIndex: number): Pick | null;
  /** The retest against the locked forecast; null before the lock. */
  retest(): Retest | null;
  score(): Score;
}

/** Fisher-Yates with the caller's rng. */
export const shuffled = <T>(items: readonly T[], rng: () => number): T[] => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const keep = out[i] as T;
    out[i] = out[j] as T;
    out[j] = keep;
  }
  return out;
};

/** A fresh attempt: the pin on the baseline, the verdict lists shuffled by `rng`. */
export const createReview = (content: AnalysisContent, rng: () => number = Math.random): Review => {
  const scale = scaleFor(content.trained);
  const range = pinRange(scale, content.step);
  const options: Record<RowId, Verdict[]> = { trained: shuffled(VERDICTS, rng), decoy: shuffled(VERDICTS, rng) };
  const picks: Pick[] = [];
  let phase: Phase = 'brief';
  let pin = 0;
  let locked = false;

  const rowFor = (row: RowId): ReviewRow => (row === 'trained' ? content.trained : content.decoy);
  const judging = (): RowId | null => (phase === 'verdict1' ? 'trained' : phase === 'verdict2' ? 'decoy' : null);
  const picked = (row: RowId): boolean => picks.some(p => p.row === row);

  const review: Review = {
    content,
    get phase() {
      return phase;
    },
    get pin() {
      return pin;
    },
    get locked() {
      return locked;
    },
    pinRange: range,
    get picks() {
      return picks;
    },
    optionsFor: row => options[row],
    rowFor,
    advance() {
      const row = judging();
      const waiting = phase === 'forecast' || phase === 'summary' || (row !== null && !picked(row));
      if (!waiting) phase = ORDER[ORDER.indexOf(phase) + 1] ?? phase;
      return phase;
    },
    movePin(delta) {
      if (phase !== 'forecast') return false;
      const next = clampPin(pin + delta, range);
      if (next === pin) return false;
      pin = next;
      return true;
    },
    lock() {
      if (phase !== 'forecast') return false;
      locked = true;
      phase = 'retest';
      return true;
    },
    pick(optionIndex) {
      const row = judging();
      const verdict = row === null ? undefined : options[row][optionIndex];
      if (row === null || verdict === undefined || picked(row)) return null;
      const truth = trueVerdict(rowFor(row));
      const made: Pick = { row, picked: verdict, truth, right: verdict === truth };
      picks.push(made);
      return made;
    },
    retest() {
      return locked ? retestOf(content.trained, pinImprovement(pin, content.step)) : null;
    },
    score() {
      const retest = review.retest();
      const c1 = retest ? forecastScore(retest.forecast, retest.actual, content.trained.te) : 0;
      const right = picks.filter(p => p.right).length;
      return scoreOf(c1, right / 2); // the two verdicts count equally; one not made counts as wrong
    },
  };
  return review;
};
