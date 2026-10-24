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
  /** One per test in sports.ts, same names. */
  cards: readonly TestCard[];
  /** One is picked at random per attempt. Empty: no readiness check. */
  checks: readonly AthleteCheck[];
  /** dataQuality multiplier when the test ran on a day it should have been re-booked. */
  ranAnyway: number;
  /** dataQuality multiplier when a ready athlete was re-booked anyway. */
  needlessRebook: number;
}

// ---- Room 2: Data Lab --------------------------------------------------------------------------

/** One stage of an incremental test: running speed and the blood lactate sampled at its end. */
export interface LactateStage {
  kmh: number;
  mmol: number;
}

/** A flagged reading's description ({...} filled from the file) and the reason for the right call. */
export interface SuspectText {
  /** What the lens shows, neutrally (no hint of the answer). */
  seen: string;
  /** Why it is a glitch, or why it is real: shown after the decision. */
  why: string;
}

export interface DataLabContent {
  /** Chart title. */
  fileTitle: string;
  /** How the file was collected (shown once, in the brief). */
  protocol: string;
  /** The clean file. */
  stages: readonly LactateStage[];
  /** Blood lactate (mmol/L) that marks each threshold. */
  lt1Mmol: number;
  lt2Mmol: number;
  /** Flying sprint times (s), clean, and the distance (m). */
  sprintTimes: readonly number[];
  sprintMetres: number;
  /** Speed at VO2max (km/h), shown on the speed ladder. */
  vvo2maxKmh: number;
  /** How much a contaminated sample reads above the true value (mmol/L). */
  contaminatedRise: number;
  /** A misfired sprint time (s). */
  misfireTime: number;
  /** Glitch kinds. {kmh} {value} {before} {after} {n} {time} {speed} {others} are filled in. */
  contaminated: SuspectText;
  failed: SuspectText;
  misfire: SuspectText;
  /** Real readings the software flags too. */
  knee: SuspectText; // the steepest rise so far, at the second threshold
  /** What the lens says at the knee when the player's own file no longer rises most steeply into it (a kept glitch). */
  kneePlain: string;
  peak: SuspectText; // the last stage, the highest reading
  /** How-to pages for the first visit, and the one line after. */
  rules: readonly string[];
  rulesShort: string;
  /** The rule the lens teaches, said once when the clean-up starts. */
  lensRule: string;
  /** What each variable is on the file (by its name in sports.ts). */
  features: Readonly<Record<string, string>>;
  /** The gap on the speed ladder between vVO2max and max sprint speed. */
  reserveLabel: string;
}

// ---- Room 3: Training Floor --------------------------------------------------------------------

export interface WeekCard {
  /** The zone's name in sports.ts. */
  zone: string;
  /** Four-letter label on the board. */
  label: string;
  /** The zone in the athlete's own numbers. */
  target: string;
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
}

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
  rules: readonly string[];
  rulesShort: string;
}

export interface RoomsContent {
  testing: TestingContent;
  data: DataLabContent;
  training: TrainingContent;
  analysis: AnalysisContent;
}
