// The welcome and the "meet the athlete" room for a level: the Performance Director's lines in the hub and the
// first conversation with the athlete. The conversation follows Phase 1 (Athlete overview) of the scientific
// support process in Ruddock, Boyd, Winter and Ranchordas (2018), Int J Sports Physiol Perform
// (docs/reference/scientific-support-process.txt, Table 1).
//
// Everything here is content Alan reviews: rooms use it verbatim. Tokens filled at render time:
//   {NAME}  the player's name from name entry
//   {A} {B} {START} {SELECT} {DPAD}  button names for the player's device (input.fill)

/** One question the player may ask the athlete. */
export interface MeetQuestion {
  /** Stable id, used for review and tests (e.g. 'goals', 'history'). */
  id: string;
  /** The option text the player picks (fits drawOptionList; at most 30 characters). */
  ask: string;
  /** The athlete's reply, one dialogue page per string. */
  answer: readonly string[];
  /** True when it is a Phase 1 athlete-overview question worth asking at a first meeting. */
  good: boolean;
  /**
   * Said after the answer: for a good question, the short note written in the notebook (at most 24 characters,
   * e.g. 'GOAL: SUB-15 IN 2 YRS'); for a weaker one, why it can wait or does not help yet.
   */
  note: string;
  /**
   * Good questions: the note as it is said aloud and read to screen readers, in sentence case
   * (e.g. 'Noted: her goal is the nationals final.'). Without it the room says "Noted: <note>."
   */
  said?: string;
  /** Why it matters (good) or why it is weaker (not good): one sentence, drawn from the paper's "Why?" column. */
  why: string;
}

export interface MeetContent {
  /** The Performance Director's name and job line, e.g. 'DR MORGAN' and 'PERFORMANCE DIRECTOR'. */
  director: { name: string; role: string };
  /**
   * The Director's welcome, said by name the first time the player enters the hub of this level: who they are,
   * the Performance Centre and its rooms, then the request to go and meet the athlete in the ATHLETE room.
   */
  directorWelcome: readonly string[];
  /** What the Director says when talked to again before the athlete has been met. */
  directorReminder: readonly string[];
  /**
   * What the Director says when talked to again once every check-in so far is done and the next room is open
   * (points to that room; {ROOM} is its hub sign, e.g. TESTING).
   */
  directorAfter: readonly string[];
  /** The needs chat with the Director between the ATHLETE room and TESTING (Phase 2: needs analysis). */
  needs: NeedsChat;
  /** The Director's check-in after each room: what it found and what to do next. It opens the next room. */
  checkIns: CheckIns;
  /** The athlete introduces herself on entering the room for the first time: name, age, event, situation. */
  athleteIntro: readonly string[];
  /** How the conversation works (full rules, then a one-line reminder on later visits). */
  rules: readonly string[];
  rulesShort: string;
  /** Mixed good and weaker questions; the room shuffles them per visit. */
  questions: readonly MeetQuestion[];
  /** How many questions the player may ask in one visit. */
  asks: number;
  /** Closing lines by how many good questions were asked (index = good asked, capped at asks). */
  debrief: readonly string[];
  /** The athlete's last line before the player leaves (sets up the TESTING room). */
  farewell: readonly string[];
}

// ---- The Director's check-ins ----------------------------------------------------------------------------------
// Phase 2 (needs analysis, Table 2) before any testing, then a short talk after each room on what it found and
// what to do next. Nothing here may claim a result the player has not produced yet; once a room has produced
// its results, the check-in after it may quote them.

/** One answer the player may give to the Director. */
export interface NeedsOption {
  /** The option text (fits the choice list: at most 30 characters, 2 lines). */
  text: string;
  /** The answer that follows from the athlete overview and the event's demands. */
  good: boolean;
  /** The Director's reply to this answer (a weaker answer is corrected kindly, with the reason). */
  reply: readonly string[];
}

/** One question in the needs chat: the Director's pages (the last one is the question), then the answers. */
export interface NeedsQuestion {
  id: string;
  ask: readonly string[];
  /** Shuffled per visit. Exactly one is good. */
  options: readonly NeedsOption[];
}

export interface NeedsChat {
  /** The Director opens the chat: the athlete has been met, now what does she need (by name: {NAME}). */
  intro: readonly string[];
  /** Asked in order: e.g. what the event demands, where she is strong, what she needs, what to measure. */
  questions: readonly NeedsQuestion[];
  /** The working hypothesis they agree, and the send-off to TESTING (no test is named: choosing it is the room's job). */
  agreed: readonly string[];
  /**
   * What the athlete needs from testing, as the Testing Lab shows it after "<NAME> NEEDS:" (at most 28 characters).
   * It replaces any presupposed goal: a question to answer, not a result.
   */
  testingNeeds: string;
  /** The Testing Lab's brief line (replaces "Goal: ..."): what testing is for, as agreed with the Director. */
  testingBrief: string;
  /** Said again if the player talks to the Director after the chat but before TESTING. */
  reminder: readonly string[];
}

/** What a room found, by how well it went: strong (stat 0.8 or more), mixed (0.5 to 0.8), weak (under 0.5). */
export interface Bands {
  strong: readonly string[];
  mixed: readonly string[];
  weak: readonly string[];
}

export interface CheckIns {
  /**
   * After TESTING, one entry per test in the battery (keys are the test names in sports.ts): what that test measured
   * and whether it helps with the agreed question.
   */
  testing: Readonly<Record<string, readonly string[]>>;
  /**
   * After TESTING, on the battery as a whole: `full` when every test the Data Lab has a file for was run; `missing`
   * (keyed by the test name) when one of them was left out; `none` when no test in the battery gives the Data Lab a
   * file (then DATA stays shut until TESTING is run again).
   */
  battery: { full: readonly string[]; missing: Readonly<Record<string, readonly string[]>>; none: readonly string[] };
  /** After TESTING, on the test-day call: [right call, ran on a day it should have been re-booked, re-booked needlessly]. */
  testingCall: { right: readonly string[]; ranAnyway: readonly string[]; needlessRebook: readonly string[] };
  /** What to do next after TESTING (to the DATA lab: clean the files and find the key variables). */
  testingNext: readonly string[];
  /** What to do next after a battery with no Data Lab file: back to TESTING. */
  retestNext: readonly string[];
  /** After the DATA lab: what each file in it showed (keys are test names; real numbers), then by how well it went. */
  dataFiles: Readonly<Record<string, readonly string[]>>;
  data: Bands;
  dataNext: readonly string[];
  /** After TRAINING; then what next (to ANALYSIS). */
  training: Bands;
  trainingNext: readonly string[];
  /** After ANALYSIS; then what next (the ARENA). */
  analysis: Bands;
  analysisNext: readonly string[];
  /** The door line when the player tries the next room before the check-in (e.g. "TALK TO DR ELLIS FIRST."). */
  doorRefusal: string;
  /** The DATA door's line after a battery with no Data Lab file, once the check-in is heard (e.g. "RE-TEST IN TESTING FIRST."). */
  retestRefusal: string;
}
