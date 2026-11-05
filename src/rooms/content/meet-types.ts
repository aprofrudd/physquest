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
  /** What the Director says once the athlete has been met (points to TESTING). */
  directorAfter: readonly string[];
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
