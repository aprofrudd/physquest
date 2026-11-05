// The Testing Lab's rules, with no drawing and no DOM: the shuffled list and its cursor, the battery the player
// builds from it (content.testing.battery tests), the one test-day check for the whole battery, each test's run,
// the printout and the score. The room (index.ts) drives it from the host's dialogue and
// input; the stage (stage.ts) only reads it. Randomness comes in through `rng`, so tests can seed it.
import type { SportData, TestOption } from '../../data/sports';
import { calcStat, type TestCall } from '../../state/GameState';
import type { AthleteCheck, TestCard, TestingContent } from '../content/types';
import type { RoomResult } from '../types';

export type CheckCall = AthleteCheck['call'];

export type Phase =
  | 'brief' // the athlete's profile and goal are being read; the stage tours the four tests
  | 'pick' // the list: the highlighted test plays on the stage; A adds it to the battery
  | 'check' // test day: she says how she is; the player runs the battery or re-books it
  | 'run' // each test of the battery runs on its kit, one after the other
  | 'printout' // the lab printout
  | 'feedback' // the printout has been read: the room is finishing (the Director's check-in gives the verdict)
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

/** What a battery is worth for variable accuracy: every test with a Data Lab file in it, some of them, none. */
export const FULL_BATTERY_ACCURACY = 1;
export const PARTIAL_BATTERY_ACCURACY = 0.65;
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

/** How the test-day call went: right (or no check), ran when she should have been re-booked, or re-booked needlessly. */
export const callOutcome = (check: AthleteCheck | null, call: CheckCall | null): TestCall => {
  if (!check || !call || call === check.call) return 'right';
  return check.call === 'rebook' ? 'ranAnyway' : 'needlessRebook';
};

/** How much of what the athlete needs a battery covers: every right test (full), some, or none. */
export type Coverage = 'full' | 'partial' | 'none';

export const coverageOf = (all: readonly TestOption[], battery: readonly TestOption[]): Coverage => {
  const right = all.filter(t => t.correct).length;
  const got = battery.filter(t => t.correct).length;
  return got === 0 ? 'none' : got >= Math.min(right, battery.length) ? 'full' : 'partial';
};

/**
 * The room's two numbers for a battery and the readiness factor: data quality is the battery's mean, times the
 * readiness factor; variable accuracy is by coverage (every right test, some, none).
 */
export const resultFor = (all: readonly TestOption[], battery: readonly TestOption[], factor: number): RoomResult => {
  const quality = battery.length === 0 ? 0 : battery.reduce((sum, t) => sum + t.dataQuality, 0) / battery.length;
  const coverage = coverageOf(all, battery);
  return {
    dataQuality: quality * factor,
    variableAccuracy: coverage === 'full' ? FULL_BATTERY_ACCURACY : coverage === 'partial' ? PARTIAL_BATTERY_ACCURACY : WRONG_TEST_ACCURACY,
  };
};

/** The stat this result lands as (the scene's calcStat, repeated here for tests and the bot table). */
export const statOf = (result: RoomResult): number => calcStat(result.dataQuality, result.variableAccuracy);

/** One test on the printout: its name, what it records, and whether it gives the Data Lab a file. */
export interface PrintoutTest {
  name: string;
  records: string;
  good: boolean;
}

/** What the printout says about the battery. */
export interface PrintoutLines {
  title: string;
  /** For the band: "2 TESTS", or the test's name for a battery of one. */
  testName: string;
  tests: PrintoutTest[];
  /** DATA QUALITY: SHAKY, only when she ran when she should have been re-booked. */
  shaky: string | null;
  /** full: a tick on green; partial: a warning on cream; none: a cross on red. */
  verdictTone: Coverage;
  verdict: string;
}

/** Capitals read badly aloud: lower-case the words, but keep ones with digits (LT1, VO2MAX) as written. */
// Abbreviations a screen reader should say letter by letter, as written
const ACRONYMS: ReadonlySet<string> = new Set(['CS', 'D', 'CP', 'MAP', 'RSA', 'FTP', 'HR']);

export const spoken = (text: string): string =>
  text
    .split(' ')
    .map(word => (/\d/.test(word) || ACRONYMS.has(word.replace(/[^A-Z]/g, '')) ? word : word.toLowerCase()))
    .join(' ');

/** The athlete's first name in capitals: the first word of the profile, minus its comma. */
export const athleteName = (sport: SportData): string => (sport.athleteProfile.split(' ')[0] ?? '').replace(/,$/, '').toUpperCase();

export interface TestingState {
  phase: Phase;
  /** The tests in this attempt's order. */
  order: readonly TestOption[];
  cursor: number;
  /** The tests picked so far, in the order picked (the battery once it is full). */
  battery: TestOption[];
  /** Which test of the battery is running (during the run). */
  running: number;
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
  /** How many tests the battery takes. */
  size: number;
  /** The test of the battery on its kit now (the one running, else the first). */
  current(): TestOption | null;
  coverage(): Coverage;
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
  /**
   * Add the highlighted test to the battery: 'added', 'full' (that was the last one: on to test day if there are
   * checks, else straight to the run), 'taken' (already in it) or 'locked' (A is still ignored).
   */
  choose(): 'added' | 'full' | 'taken' | 'locked';
  /** Take the last test out of the battery (B in the pick list). False when the battery is empty. */
  unpick(): boolean;
  /** The player's call on test day; true when it was the right one. */
  answer(call: CheckCall): boolean;
  beginRun(): void;
  /** A during the run: allowed after RUN_SKIP_AFTER; jumps to the next test's run, or the printout. True if it skipped. */
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
    battery: [],
    running: 0,
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

  const size = Math.max(1, Math.min(content.battery, sport.tests.length));
  const battery = (): readonly TestOption[] => (state.battery.length > 0 ? state.battery : [highlighted()]);
  const coverage = (): Coverage => coverageOf(sport.tests, battery());

  const result = (): RoomResult => ({
    ...resultFor(sport.tests, battery(), factor()),
    testing: { tests: battery().map(t => t.name), call: callOutcome(state.check, state.call) },
  });

  /** The verdict strip: how many of the battery's tests give the Data Lab a file. */
  const verdictOf = (): string => {
    const tests = battery();
    const files = tests.filter(t => t.correct).length;
    if (files === 0) return 'NO FILE FOR THE DATA LAB';
    if (files === tests.length) return `${tests.length === 1 ? 'FILE' : tests.length === 2 ? 'BOTH' : 'ALL'} SENT TO THE DATA LAB`;
    return `${files} OF ${tests.length} TO THE DATA LAB`;
  };

  const printout = (): PrintoutLines => {
    const tests = battery();
    return {
      title: 'LAB PRINTOUT',
      testName: tests.length === 1 ? (tests[0] as TestOption).name.toUpperCase() : `${tests.length} TESTS`,
      tests: tests.map(t => ({ name: t.name.toUpperCase(), records: `RECORDS: ${cardOf(t).gives}`, good: t.correct })),
      shaky: shaky() ? 'DATA QUALITY: SHAKY' : null,
      verdictTone: coverage(),
      verdict: verdictOf(),
    };
  };

  const printoutSpoken = (): string => {
    const tests = battery()
      .map(t => `${t.name}: records ${spoken(cardOf(t).gives)}${t.correct ? '' : ', no file for the Data Lab'}.`)
      .join(' ');
    const verdict = verdictOf().toLowerCase().replace('data lab', 'Data Lab');
    return `Lab printout. ${tests} ${shaky() ? 'Data quality: shaky. ' : ''}${verdict.charAt(0).toUpperCase()}${verdict.slice(1)}.`;
  };

  const startRun = (index: number) => {
    state.running = index;
    enter('run', RUN_SKIP_AFTER);
  };

  /** The current test's run is over: the next one in the battery, or the printout. */
  const runDone = () => {
    if (state.running + 1 < state.battery.length) startRun(state.running + 1);
    else enter('printout', DECISION_LOCK);
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
    size,
    current: () => state.battery[state.running] ?? state.battery[0] ?? null,
    coverage,

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
      if (state.phase !== 'pick' || state.lock > 0) return 'locked';
      const test = highlighted();
      if (state.battery.includes(test)) return 'taken';
      state.battery.push(test);
      if (state.battery.length < size) {
        state.lock = DECISION_LOCK; // the next pick is a new decision
        // the cursor moves on to the next test not in the battery, so A is never left on a test already taken
        const n = state.order.length;
        for (let k = 1; k < n; k++) {
          const next = (state.cursor + k) % n;
          if (!state.battery.includes(state.order[next] as TestOption)) {
            state.cursor = next;
            break;
          }
        }
        return 'added';
      }
      if (state.check) enter('check', DECISION_LOCK);
      else startRun(0);
      return 'full';
    },

    unpick() {
      if (state.phase !== 'pick' || state.battery.length === 0) return false;
      state.battery.pop();
      return true;
    },

    answer(call) {
      if (state.phase !== 'check') return false;
      state.call = call;
      state.rebooked = call === 'rebook';
      state.flip = 0;
      return !state.check || state.check.call === call;
    },

    beginRun() {
      startRun(0);
    },

    skipRun() {
      if (state.phase !== 'run' || state.lock > 0) return false;
      runDone();
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
      if (state.phase === 'run' && state.phaseTime >= RUN_SECONDS) runDone();
    },
  };
};
