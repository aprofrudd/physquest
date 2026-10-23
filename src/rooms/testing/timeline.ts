// What happens when, during a test on the stage. Each test is a function of u (0-1: how far through the
// preview loop or the run), so the stage can draw any moment and a test can check them. No drawing here.
// None of the shapes are measurements: they are cartoons of each test's form (steps, trials, a fading
// effort, shuttles that quicken until she stops) and carry no numbers beyond the card's own chips.
import type { EffortShape } from '../content/types';

export const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

// ---- incremental treadmill test ------------------------------------------------------------------------------

export interface StageAt {
  /** 0-based stage. */
  stage: number;
  /** How far through the stage (0-1). */
  within: number;
  /** Belt speed in arbitrary units: each stage is faster than the last. */
  speed: number;
  /** Belt distance travelled so far (arbitrary units): the belt's and the runner's stride phase follow it. */
  travel: number;
  /** 0 until the stage's last stretch, then 0-1: the fingertip sample at the end of each stage. */
  sample: number;
}

const stageSpeed = (stage: number): number => 1 + 0.45 * stage;

/** The treadmill test at u, for `count` stages. */
export const stageAt = (u: number, count: number): StageAt => {
  const n = Math.max(1, count);
  const x = clamp01(u) * n;
  const stage = Math.min(n - 1, Math.floor(x));
  const within = x - stage;
  let travel = 0;
  for (let k = 0; k < stage; k++) travel += stageSpeed(k) / n;
  travel += (stageSpeed(stage) * within) / n;
  return { stage, within, speed: stageSpeed(stage), travel, sample: within > 0.72 ? (within - 0.72) / 0.28 : 0 };
};

// ---- separate all-out trials with rest between ------------------------------------------------------------------

export type TrialPhase = 'run' | 'rest' | 'end';

export interface TrialAt {
  /** 0-based trial. */
  trial: number;
  phase: TrialPhase;
  within: number;
  /** How far down the lane this trial goes (0-1): the trials are over different distances, each longer than the last. */
  distance: number;
}

const REST_SHARE = 0.1;
const TRIAL_RUN_SHARE = 0.8; // of the whole: the runs and the rests between them (the rest is the end hold)

/** The trial's length grows by 60% of the first each time, so a longer trial takes longer. */
const trialWeight = (k: number): number => 1 + 0.6 * k;

export const trialDistance = (trial: number, trials: number): number => (trials <= 1 ? 1 : 0.4 + (0.6 * trial) / (trials - 1));

/** The trials test at u, for `trials` runs. */
export const trialAt = (u: number, trials: number): TrialAt => {
  const n = Math.max(1, trials);
  let weights = 0;
  for (let k = 0; k < n; k++) weights += trialWeight(k);
  const unit = (TRIAL_RUN_SHARE - REST_SHARE * (n - 1)) / weights;
  let t = clamp01(u);
  for (let k = 0; k < n; k++) {
    const run = unit * trialWeight(k);
    if (t < run) return { trial: k, phase: 'run', within: t / run, distance: trialDistance(k, n) };
    t -= run;
    if (k < n - 1) {
      if (t < REST_SHARE) return { trial: k, phase: 'rest', within: t / REST_SHARE, distance: trialDistance(k, n) };
      t -= REST_SHARE;
    }
  }
  const end = 1 - TRIAL_RUN_SHARE;
  return { trial: n - 1, phase: 'end', within: clamp01(t / end), distance: trialDistance(n - 1, n) };
};

// ---- one all-out effort that fades ---------------------------------------------------------------------------------

/** Effort (1 at the start, fading to a third) and the flywheel's turn in radians. */
export interface CycleAt {
  power: number;
  angle: number;
}

const FADE_RATE = 2.5;
const FLOOR_POWER = 0.35;
const SPIN = 70; // radians per unit of u at full effort

export const cycleAt = (u: number): CycleAt => {
  const t = clamp01(u);
  const power = FLOOR_POWER + (1 - FLOOR_POWER) * Math.exp(-FADE_RATE * t);
  const angle = SPIN * (FLOOR_POWER * t + ((1 - FLOOR_POWER) * (1 - Math.exp(-FADE_RATE * t))) / FADE_RATE);
  return { power, angle };
};

// ---- shuttles that quicken until she cannot keep up --------------------------------------------------------------------

export interface ShuttleAt {
  /** 1-based: each shuttle is a level, quicker than the one before. */
  level: number;
  /** Where she is along the lane (0 = left cone, 1 = right cone). */
  x: number;
  /** Which way she is heading (1 = right). */
  dir: 1 | -1;
  /** How fast she is going, 1 at the beep's pace down to 0 when she stops (on the last shuttle she tires). */
  pace: number;
  /** She has stopped for good: the last beep went and she was not there. */
  spent: boolean;
  /** 1 at the moment of a beep, fading out quickly. */
  beep: number;
}

const SHUTTLES = 6; // the sixth is the one she cannot make
const SHUTTLE_SHARE = 0.82;
const SHUTTLE_QUICKEN = 0.88;
const FAIL_REACH = 0.55; // she gets this far along the last shuttle
const BEEP_WINDOW = 0.03; // of u

const shuttleLengths = (() => {
  const weights = Array.from({ length: SHUTTLES }, (_, k) => SHUTTLE_QUICKEN ** k);
  const total = weights.reduce((a, b) => a + b, 0);
  return weights.map(w => (SHUTTLE_SHARE * w) / total);
})();

/** Where each beep sounds (the end of each shuttle), as u. */
export const BEEP_TIMES: readonly number[] = (() => {
  let at = 0;
  return shuttleLengths.map(len => (at += len));
})();

export const SHUTTLE_LEVELS = SHUTTLES;

export const shuttleAt = (u: number): ShuttleAt => {
  const t = clamp01(u);
  let start = 0;
  let level = SHUTTLES - 1;
  let within = 1;
  let found = false;
  for (let k = 0; k < SHUTTLES; k++) {
    const len = shuttleLengths[k] ?? 0;
    if (t < start + len) {
      level = k;
      within = (t - start) / len;
      found = true;
      break;
    }
    start += len;
  }
  if (!found) {
    level = SHUTTLES - 1;
    within = 1;
  }
  const failing = level === SHUTTLES - 1;
  // Along the shuttle she goes at the beep's pace; on the last one she slows and stops short
  let along = within;
  let pace = 1;
  if (failing && within >= 0.45) {
    const q = (within - 0.45) / 0.55;
    along = FAIL_REACH - (FAIL_REACH - 0.45) * (1 - q) ** 2;
    pace = 1 - q;
  } else if (failing) {
    along = within;
  }
  if (!found) pace = 0;
  const dir: 1 | -1 = level % 2 === 0 ? 1 : -1;
  const x = dir === 1 ? along : 1 - along;
  let beep = 0;
  for (const at of BEEP_TIMES) if (t >= at && t < at + BEEP_WINDOW) beep = Math.max(beep, 1 - (t - at) / BEEP_WINDOW);
  return { level: level + 1, x, dir, pace, spent: !found, beep };
};

// ---- the effort profile: what the little chart draws ----------------------------------------------------------------------

/** How many columns the chart has: three to a stage for stepped tests, 24 for the rest. */
export const profileColumns = (shape: EffortShape, steps = 6): number => (shape === 'stages' ? Math.max(1, steps) * 3 : 24);

/**
 * The effort chart for a test's shape: one value (0-1) per column, left to right. `steps` is the number of
 * stages for stepped tests, `trials` the number of separate efforts.
 */
export const effortProfile = (shape: EffortShape, steps = 6, trials = 3): number[] => {
  const columns = profileColumns(shape, steps);
  const out: number[] = [];
  for (let i = 0; i < columns; i++) {
    const x = i / columns;
    switch (shape) {
      case 'stages': {
        const k = Math.min(steps - 1, Math.floor(x * steps));
        out.push(0.22 + (0.78 * k) / Math.max(1, steps - 1));
        break;
      }
      case 'trials': {
        // n efforts separated by rests: each effort is 2 parts in 3 of its slot's share
        const slot = x * trials;
        out.push(slot - Math.floor(slot) < 0.7 ? 1 : 0.12);
        break;
      }
      case 'allout': {
        out.push(i === 0 ? 0.55 : FLOOR_POWER + (1 - FLOOR_POWER) * Math.exp(-FADE_RATE * x * 1.6));
        break;
      }
      case 'shuttles': {
        // five rising steps, then nothing: she has stopped
        const k = Math.floor(x * 6);
        out.push(k >= 5 ? 0 : 0.25 + 0.15 * k);
        break;
      }
    }
  }
  return out;
};

/**
 * The moment the pick screen's preview freezes on for someone who has asked for reduced motion: a clear one
 * for each test (mid-stage, mid-trial, mid-effort, mid-shuttle), never a rest or a blink.
 */
export const calmPreviewU = (shape: EffortShape): number => {
  switch (shape) {
    case 'stages':
      return 0.5;
    case 'trials':
      return 0.33;
    case 'allout':
      return 0.2;
    case 'shuttles':
      return 0.45;
  }
};

// ---- the protocol readout ---------------------------------------------------------------------------------------------------

export interface ReadoutCounts {
  stages: number;
  trials: number;
}

/** The short protocol line for the run (no numbers beyond the counters): STAGE 3, TRIAL 2 OF 3, ALL-OUT, LEVEL 4. */
export const readoutAt = (shape: EffortShape, u: number, counts: ReadoutCounts): string => {
  switch (shape) {
    case 'stages':
      return `STAGE ${stageAt(u, counts.stages).stage + 1}`;
    case 'trials': {
      const at = trialAt(u, counts.trials);
      return at.phase === 'rest' ? 'REST' : `TRIAL ${at.trial + 1} OF ${counts.trials}`;
    }
    case 'allout':
      return 'ALL-OUT';
    case 'shuttles':
      return `LEVEL ${shuttleAt(u).level}`;
  }
};

/**
 * How many things have happened so far in a run, for a sound at each: a stage starting, a trial starting, the
 * start of the all-out effort, and a beep (at the start and at every turn). It only ever goes up with u.
 */
export const beatCount = (shape: EffortShape, u: number, counts: ReadoutCounts): number => {
  switch (shape) {
    case 'stages':
      return stageAt(u, counts.stages).stage + 1;
    case 'trials':
      return trialAt(u, counts.trials).trial + 1;
    case 'allout':
      return 1;
    case 'shuttles': {
      const t = clamp01(u);
      let passed = 1;
      for (const at of BEEP_TIMES) if (t >= at) passed++;
      return passed;
    }
  }
};

/** How many separate efforts a trials card makes: the number in its chips ("3 TRIALS"), else 3. */
export const trialCountOf = (chips: readonly string[]): number => {
  for (const chip of chips) {
    const found = /^(\d+) TRIALS?$/.exec(chip.trim().toUpperCase());
    if (found?.[1]) return Math.max(1, Number(found[1]));
  }
  return 3;
};
