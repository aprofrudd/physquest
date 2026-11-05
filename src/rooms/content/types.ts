// The redesigned rooms' content for one level. Everything here is physiology content: Alan reviews it,
// and rooms use it verbatim (rooms may only add wording that carries no physiology, such as button hints).
// Names (test, variable and zone names) must match sports.ts exactly: the rest of each item
// (description, correct answer, explanation, data quality) still comes from there.

// ---- Room 1: Testing Lab ----------------------------------------------------------------------

/** The kit a test is shown on. */
export type TestKit = 'treadmill' | 'track' | 'cycle' | 'shuttle';

/** The shape of a test's effort profile on the stage. */
export type EffortShape =
  | 'stages' // speed or power steps up stage by stage to the end
  | 'trials' // separate all-out trials with rest between
  | 'allout' // one short all-out effort that fades
  | 'shuttles'; // shuttles that get faster level by level until the athlete can't keep up

export interface TestCard {
  /** The test's name in sports.ts. */
  name: string;
  kit: TestKit;
  shape: EffortShape;
  /** Three short tags for what the test is made of. */
  chips: readonly [string, string, string];
  /** What the test records (at most 19 characters). */
  gives: string;
}

/** A test-day readiness check: what the athlete says before the test, and the right call. */
export interface AthleteCheck {
  says: string;
  call: 'run' | 'rebook';
  why: string;
}

export interface TestingContent {
  /** What the athlete needs from testing, after "<NAME> NEEDS:" (at most 28 characters). */
  needs: string;
  /** How many tests the player picks for the battery (they all run on the same test day). */
  battery: number;
  /** One per test in sports.ts, same names. */
  cards: readonly TestCard[];
  /** One is picked at random per attempt (one test day for the whole battery). Empty: no readiness check. */
  checks: readonly AthleteCheck[];
  /** dataQuality multiplier when the test ran on a day it should have been re-booked. */
  ranAnyway: number;
  /** dataQuality multiplier when a ready athlete was re-booked anyway. */
  needlessRebook: number;
}

// ---- Room 2: Data Lab --------------------------------------------------------------------------
// One file per test the Testing Lab ran (a test with no file here gives the Data Lab nothing). Each file has its
// own flagged readings, and the variables it gives (by `features[name].file`).

/** One stage of an incremental test: running speed, the blood lactate and the heart rate at its end. */
export interface LactateStage {
  kmh: number;
  mmol: number;
  hr: number;
}

/** A flagged reading's description ({...} filled from the file) and the reason for the right call. */
export interface SuspectText {
  /** What the software says about it, neutrally (no hint of the answer). */
  seen: string;
  /** Why it is a glitch, or why it is real: shown after the decision. */
  why: string;
}

/** What every file has. */
interface FileContent {
  /** The test's name in sports.ts. */
  test: string;
  /** The file's header after "FILE 1/2: " (at most 29 characters). */
  title: string;
  /** The heading of its variables in the key-variable list. */
  group: string;
  /** Said when the file comes up, after "First file:" / "Next file:" / "Her file:". */
  intro: string;
  /** How the file was collected (first visit only, after the intro). */
  protocol: string;
  /** The question for each flagged reading. {i} {n} and the reading's own slots are filled in. */
  ask: string;
  /** The rule for telling a glitch from real data in this file (first visit, before its first decision). */
  lensRule: string;
  /** The last line of the reveal when this is the only file (with every file, sports.ts variableInsight). */
  insight: string;
}

export interface LactateFile extends FileContent {
  /** The clean file. */
  stages: readonly LactateStage[];
  /** LT1: where lactate first rises this far (mmol/L) above her lowest reading. */
  lt1Rise: number;
  /** LT2: the fixed blood lactate (mmol/L). */
  lt2Mmol: number;
  /** From the final ramp to exhaustion. */
  vo2max: number;
  vvo2maxKmh: number;
  hrMax: number;
  /** How much a contaminated sample reads above the true value (mmol/L). */
  contaminatedRise: number;
  /** Glitches and real readings. {kmh} {value} {before} {after} are filled in. */
  contaminated: SuspectText;
  failed: SuspectText;
  /** Real: the steepest rise so far, at the second threshold. */
  knee: SuspectText;
  /** What it says at the knee when the player's own file no longer rises most steeply into it (a kept glitch). */
  kneePlain: string;
  /** Real: the last stage, the highest reading. */
  peak: SuspectText;
}

/** One all-out time trial. */
export interface TimeTrial {
  metres: number;
  seconds: number;
}

export interface TrialsFile extends FileContent {
  /** The clean trials, shortest first. */
  trials: readonly TimeTrial[];
  /** The ways a trial can be mistimed: which trial (index) and how many seconds out it reads. One is picked per attempt. */
  mistimings: readonly { trial: number; seconds: number }[];
  /** {m} {time} {pace} {others} are filled in. */
  mistimed: SuspectText;
  /** Real: the shortest trial is the fastest per km. */
  fastest: SuspectText;
}

export type DataFileKind = 'lactate' | 'trials';

export interface DataLabContent {
  lactate: LactateFile;
  trials: TrialsFile;
  /** How-to pages for the first visit (a worked example and the controls), and the one line after. */
  rules: readonly string[];
  rulesShort: string;
  /** The two answers for a flagged reading: keep it (real), remove it (glitch). */
  options: readonly [string, string];
  /** Said once the files are clean, before the key variables are chosen. {N} is how many. */
  chooseIntro: string;
  /** First visit: what makes a variable key, from another sport so it gives nothing away. */
  keyExample: string;
  /** Asked before the key variables are locked in. {N} is how many. */
  lockAsk: string;
  /** Each variable (by its name in sports.ts): the file it comes from and what it is on that file. */
  features: Readonly<Record<string, { file: DataFileKind; about: string }>>;
}

// ---- Room 3: Training Floor --------------------------------------------------------------------

export interface WeekCard {
  /** The zone's name in sports.ts. */
  zone: string;
  /** Four-letter label on the board. */
  label: string;
  /** The zone in the athlete's own numbers. */
  target: string;
  /** The tests (names in sports.ts) the target's numbers come from. */
  uses?: readonly string[];
  /** The target in words, for a battery without one of those tests (no number from a test that was not run). */
  plain?: string;
  /** key: one of the week's quality sessions (needs fresh legs). support: volume and recovery. */
  role: 'key' | 'support';
}

export interface LegsRule {
  /** Legs (0-100) lost the morning after a key session, and two mornings after. */
  keyNextDay: number;
  keyTwoDays: number;
  /** Legs lost the morning after a support session. */
  supportNextDay: number;
  /** A key session is at full quality with legs at or above fullAt, worthless at or below noneAt. */
  fullAt: number;
  noneAt: number;
}

export interface WeekChecks {
  /** At least this many sessions (key + support). */
  minSessions: number;
  /** Rest days (an AWAY day counts) between these. */
  minRest: number;
  maxRest: number;
  /** A morning below this is a red morning. */
  redBelow: number;
}

export interface TrainingContent {
  cards: readonly WeekCard[];
  legs: LegsRule;
  checks: WeekChecks;
  /** One random day (Tue-Thu) with no session possible, e.g. travel. */
  awayDay: boolean;
  awayLabel: string;
  rules: readonly string[];
  rulesShort: string;
  /** What a key session gets, by quality. {label} {legs} filled in. */
  fullQuality: string;
  partQuality: string;
  noQuality: string;
  /** What a support session is for. */
  supportNote: string;
}

// ---- Room 4: Analysis Room ---------------------------------------------------------------------

export interface ReviewRow {
  /** Metric and unit as shown on the ruler. */
  metric: string;
  unit: string;
  baseline: number;
  retest: number;
  better: 'higher' | 'lower';
  /** Typical error and smallest worthwhile change, in the metric's units. */
  te: number;
  swc: number;
  /** The metric as said in a sentence ("last 400 m", "VO2max"). */
  name: string;
  /** Words for a change in the better and the worse direction (FASTER / SLOWER, HIGHER / LOWER). */
  betterWord: string;
  worseWord: string;
}

/** What each page of the Analysis Room's first-visit walk-through points at on the board, in order. */
export type TourMark = 'before' | 'noise' | 'worth' | 'guess';

export interface AnalysisContent {
  /** The trained metric: the one the player forecasts. */
  trained: ReviewRow;
  /** Weeks in the block. */
  weeks: number;
  /** Two baseline trials (their spread is the typical error, as drawn). */
  baselineTrials: readonly [number, number];
  /** Improvements in the athlete's earlier blocks (shown as ghost ticks). */
  history: readonly number[];
  /** Forecast pin step, in the metric's units. */
  step: number;
  /** A variable the Data Lab set aside, retested too. */
  decoy: ReviewRow;
  /** The three verdicts, in this order: noise, real but too small, worth acting on. */
  verdicts: readonly [string, string, string];
  /** Explanations after a verdict. {change} {unit} {te} {swc} filled in. */
  noiseWhy: string;
  smallWhy: string;
  worthWhy: string;
  /** The first visit's walk-through of the board, one page per element, each pointing at `tour[i]`. */
  rules: readonly string[];
  tour: readonly TourMark[];
  /** Later visits: one line instead. */
  rulesShort: string;
  /** The forecast prompt ({LEFT} {RIGHT} {A} filled for the player's device). */
  forecastAsk: string;
  /** The verdict question. {name} {before} {after} {unit} filled from the row. */
  judgeAsk: string;
}

export interface RoomsContent {
  testing: TestingContent;
  data: DataLabContent;
  training: TrainingContent;
  analysis: AnalysisContent;
}
