// The Testing Lab's rules, with no drawing and no DOM: the shuffled list and its cursor, the test-day check,
// the run's clock, the printout and the score. The room (index.ts) drives it from the host's dialogue and
// input; the stage (stage.ts) only reads it. Randomness comes in through `rng`, so tests can seed it.
import type { SportData, TestOption } from '../../data/sports';
import { calcStat } from '../../state/GameState';
import type { AthleteCheck, TestCard, TestingContent } from '../content/types';
import type { RoomResult } from '../types';

export type CheckCall = AthleteCheck['call'];

export type Phase =
  | 'brief' // the athlete's profile and goal are being read; the stage tours the four tests
  | 'pick' // the list: the highlighted test plays on the stage
  | 'check' // test day: she says how she is; the player runs the test or re-books it
  | 'run' // the chosen test runs on its kit
  | 'printout' // the lab printout
  | 'feedback' // the verdict and the insight, in the dialogue box
  | 'done';

/** A press of A is ignored this long after a decision appears, so a carried-over press can't decide it unseen. */
export const DECISION_LOCK = 0.35;
/** How long a test runs on the stage, and when A may skip it. */
export const RUN_SECONDS = 5;
export const RUN_SKIP_AFTER = 0.5;
/** How long the calendar takes to move on after a re-booking. */
export const REBOOK_SECONDS = 1.6;
/** How long the printout takes to slide out of the printer. */
export const PRINTOUT_SECONDS = 0.7;
/** The stage tour in the brief shows each test this long. */
export const TOUR_SECONDS = 2.6;

/** Days of the week for the calendar (UI words only). */
export const WEEKDAYS: readonly string[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
/** Test day is a weekday from Monday to Wednesday, so a re-booking two days on is still a weekday (never a weekend). */
export const TEST_DAYS = 3;

/** What a wrong test is worth for variable accuracy (as in the classic room). */
export const WRONG_TEST_ACCURACY = 0.3;

export type Rng = () => number;

/** A random integer in [0, count) from an rng that may return 1 by mistake. */
const randomIndex = (rng: Rng, count: number): number => Math.min(count - 1, Math.floor(rng() * count));

/** Fisher-Yates: a shuffled copy. */
export const shuffled = <T>(items: readonly T[], rng: Rng): T[] => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomIndex(rng, i + 1);
    const swap = out[i] as T;
    out[i] = out[j] as T;
    out[j] = swap;
  }
  return out;
};

/**
 * A shuffled copy of the tests that is never in the order named by `avoid` (the list shown last time), so a
 * replay's list really is reshuffled: if chance repeats the old order, it is turned one place.
 */
export const shuffledNot = (tests: readonly TestOption[], rng: Rng, avoid?: readonly string[]): TestOption[] => {
  const order = shuffled(tests, rng);
  if (avoid && order.length > 1 && order.every((test, i) => test.name === avoid[i])) order.push(order.shift() as TestOption);
  return order;
};

/**
 * One check at random. When there is more than one, the check shown last time (by its words) is left out, so
 * a replay gets a new one.
 */
export const pickCheck = (checks: readonly AthleteCheck[], rng: Rng, avoid?: string): AthleteCheck | null => {
  if (checks.length === 0) return null;
  const fresh = checks.filter(c => c.says !== avoid);
  const pool = fresh.length > 0 ? fresh : checks;
  return pool[randomIndex(rng, pool.length)] ?? null;
};

/**
 * The share of the test's data quality that survives the readiness call: 1 when the call was right,
 * `ranAnyway` when she should have been re-booked but the test ran, `needlessRebook` when a ready
 * athlete was re-booked. No check (or no call yet): 1.
 */
export const factorFor = (content: TestingContent, check: AthleteCheck | null, call: CheckCall | null): number => {
  if (!check || !call || call === check.call) return 1;
  return check.call === 'rebook' ? content.ranAnyway : content.needlessRebook;
};

/** The room's two numbers for a chosen test and the readiness factor. */
export const resultFor = (test: TestOption, factor: number): RoomResult => ({
  dataQuality: test.dataQuality * factor,
  variableAccuracy: test.correct ? 1 : WRONG_TEST_ACCURACY,
});

/** The stat this result lands as (the scene's calcStat, repeated here for tests and the bot table). */
export const statOf = (result: RoomResult): number => calcStat(result.dataQuality, result.variableAccuracy);

/** What the printout says about the test. */
export interface PrintoutLines {
  title: string;
  testName: string;
  records: string;
  /** DATA QUALITY: SHAKY, only when she ran when she should have been re-booked. */
  shaky: string | null;
  verdictGood: boolean;
  verdict: string;
}

/** Capitals read badly aloud: lower-case the words, but keep ones with digits (LT1, VO2MAX) as written. */
export const spoken = (text: string): string =>
  text
    .split(' ')
    .map(word => (/\d/.test(word) ? word : word.toLowerCase()))
    .join(' ');

/** The athlete's first name in capitals: the first word of the profile, minus its comma. */
export const athleteName = (sport: SportData): string => (sport.athleteProfile.split(' ')[0] ?? '').replace(/,$/, '').toUpperCase();

export interface TestingState {
  phase: Phase;
  /** The tests in this attempt's order. */
  order: readonly TestOption[];
  cursor: number;
  chosen: TestOption | null;
  check: AthleteCheck | null;
  call: CheckCall | null;
  /** Which weekday it is (0 = MON): the calendar on test day, and two days on if re-booked. */
  day: number;
  /** She was re-booked: the calendar moves on before the run. */
  rebooked: boolean;
  /** Seconds since the model started (the stage's clock for cosmetic cycles). */
  clock: number;
  /** Seconds in the current phase. */
  phaseTime: number;
  /** Seconds left in which A is ignored. */
  lock: number;
  /** Seconds the calendar has been flipping (re-booking). */
  flip: number;
}

export interface TestingModel {
  readonly state: Readonly<TestingState>;
  /** The card for a test (a plain one if the content has none, so the room never fails to draw). */
  cardOf(test: TestOption): TestCard;
  /** The test under the cursor. */
  highlighted(): TestOption;
  /** She ran when she should have been re-booked: the run and the printout say the data is shaky. */
  shaky(): boolean;
  /** The readiness factor so far (1 before any call). */
  factor(): number;
  printout(): PrintoutLines;
  /** The printout as a sentence for a screen reader. */
  printoutSpoken(): string;
  result(): RoomResult;
  /** Move to the next phase's start. */
  startPick(): void;
  moveCursor(step: number): void;
  /** A may decide now (the decision's lock has run out). */
  canDecide(): boolean;
  /** Take the highlighted test: on to test day if there are checks, else straight to the run. */
  choose(): void;
  /** The player's call on test day; true when it was the right one. */
  answer(call: CheckCall): boolean;
  beginRun(): void;
  /** A during the run: allowed after RUN_SKIP_AFTER; jumps to the printout. True if it skipped. */
  skipRun(): boolean;
  /** The printout is read: on to the verdict. */
  startFeedback(): void;
  finish(): void;
  update(dt: number): void;
}

export interface TestingOptions {
  sport: SportData;
  content: TestingContent;
  rng?: Rng;
  /** The words of the check shown last time (a replay avoids it). */
  lastCheck?: string;
  /** The test names in the order the list showed last time (a replay's list is never in the same order). */
  lastOrder?: readonly string[];
}

const PLAIN_CARD: Omit<TestCard, 'name'> = { kit: 'track', shape: 'trials', chips: ['', '', ''], gives: '' };

export const createTestingModel = ({ sport, content, rng = Math.random, lastCheck, lastOrder }: TestingOptions): TestingModel => {
  const state: TestingState = {
    phase: 'brief',
    order: shuffledNot(sport.tests, rng, lastOrder),
    cursor: 0,
    chosen: null,
    check: pickCheck(content.checks, rng, lastCheck),
    call: null,
    day: randomIndex(rng, TEST_DAYS),
    rebooked: false,
    clock: 0,
    phaseTime: 0,
    lock: 0,
    flip: 0,
  };

  const enter = (phase: Phase, lock = 0) => {
    state.phase = phase;
    state.phaseTime = 0;
    state.lock = lock;
  };

  const cardOf = (test: TestOption): TestCard =>
    content.cards.find(c => c.name === test.name) ?? { name: test.name, ...PLAIN_CARD };

  const highlighted = (): TestOption => state.order[state.cursor] ?? (state.order[0] as TestOption);

  const shaky = (): boolean => !!state.check && state.check.call === 'rebook' && state.call === 'run';

  const factor = (): number => factorFor(content, state.check, state.call);

  const result = (): RoomResult => {
    const test = state.chosen ?? highlighted();
    return resultFor(test, factor());
  };

  const printout = (): PrintoutLines => {
    const test = state.chosen ?? highlighted();
    const card = cardOf(test);
    const name = athleteName(sport);
    return {
      title: 'LAB PRINTOUT',
      testName: test.name.toUpperCase(),
      records: `RECORDS: ${card.gives}`,
      shaky: shaky() ? 'DATA QUALITY: SHAKY' : null,
      verdictGood: test.correct,
      verdict: test.correct ? 'SENT TO THE DATA LAB' : `NOT WHAT ${name} NEEDS`,
    };
  };

  const printoutSpoken = (): string => {
    const test = state.chosen ?? highlighted();
    const card = cardOf(test);
    const first = sport.athleteProfile.split(' ')[0]?.replace(/,$/, '') ?? '';
    const verdict = test.correct ? 'Sent to the Data Lab.' : `Not what ${first} needs.`;
    return `Lab printout. ${test.name}. Records ${spoken(card.gives)}. ${shaky() ? 'Data quality: shaky. ' : ''}${verdict}`;
  };

  return {
    state,
    cardOf,
    highlighted,
    shaky,
    factor,
    printout,
    printoutSpoken,
    result,

    startPick() {
      enter('pick', DECISION_LOCK);
    },

    moveCursor(step) {
      if (state.phase !== 'pick' || state.order.length === 0) return;
      const n = state.order.length;
      state.cursor = (((state.cursor + step) % n) + n) % n;
    },

    canDecide: () => state.lock <= 0,

    choose() {
      if (state.phase !== 'pick' || state.lock > 0) return;
      state.chosen = highlighted();
      if (state.check) enter('check', DECISION_LOCK);
      else enter('run', RUN_SKIP_AFTER);
    },

    answer(call) {
      if (state.phase !== 'check') return false;
      state.call = call;
      state.rebooked = call === 'rebook';
      state.flip = 0;
      return !state.check || state.check.call === call;
    },

    beginRun() {
      enter('run', RUN_SKIP_AFTER);
    },

    skipRun() {
      if (state.phase !== 'run' || state.lock > 0) return false;
      enter('printout', DECISION_LOCK);
      return true;
    },

    startFeedback() {
      if (state.phase === 'printout') enter('feedback');
    },

    finish() {
      enter('done');
    },

    update(dt) {
      state.clock += dt;
      state.phaseTime += dt;
      if (state.lock > 0) state.lock = Math.max(0, state.lock - dt);
      if (state.phase === 'check' && state.rebooked) state.flip += dt;
      if (state.phase === 'run' && state.phaseTime >= RUN_SECONDS) enter('printout', DECISION_LOCK);
    },
  };
};
