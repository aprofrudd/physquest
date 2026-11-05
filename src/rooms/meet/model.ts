// The ATHLETE room's rules, with no drawing and no timers: the questions in a shuffled order, which have been asked,
// the notebook, and the overview score (good Phase 1 questions asked, out of the asks allowed). The overview never
// feeds a stat or the showdown rating.
import type { MeetContent, MeetQuestion } from '../content/meet-types';

export interface Meet {
  readonly content: MeetContent;
  /** The questions not asked yet, in this visit's shuffled order (an asked one leaves the list). */
  readonly options: MeetQuestion[];
  /** The option labels, in the same order (kept in step with `options`, so nothing is built while drawing). */
  readonly labels: string[];
  /** The questions asked so far, in order. */
  readonly asked: MeetQuestion[];
  /** The notebook: one note per good question asked. */
  readonly notes: string[];
  /** Index into `options`. */
  cursor: number;
}

/** Fisher-Yates with the given random source. */
export const shuffled = <T>(items: readonly T[], rng: () => number): T[] => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(rng() * (i + 1)));
    const swap = out[i]!;
    out[i] = out[j]!;
    out[j] = swap;
  }
  return out;
};

/** How many questions this visit allows: the content's asks, never more than there are questions. */
export const asksAllowed = (content: MeetContent): number => Math.max(0, Math.min(content.asks, content.questions.length));

export const createMeet = (content: MeetContent, rng: () => number): Meet => {
  const options = shuffled(content.questions, rng);
  return { content, options, labels: options.map(q => q.ask), asked: [], notes: [], cursor: 0 };
};

/** Good questions asked so far. */
export const goodAsked = (meet: Meet): number => meet.asked.filter(q => q.good).length;

/** Questions still to ask this visit. */
export const asksLeft = (meet: Meet): number => Math.max(0, asksAllowed(meet.content) - meet.asked.length);

/** Every allowed question has been asked. */
export const finished = (meet: Meet): boolean => asksLeft(meet) === 0 || meet.options.length === 0;

/** Move the cursor up (-1) or down (+1), wrapping. Returns false when there is nothing to move to. */
export const moveCursor = (meet: Meet, step: number): boolean => {
  const n = meet.options.length;
  if (n <= 1) return false;
  meet.cursor = (((meet.cursor + step) % n) + n) % n;
  return true;
};

/** The question under the cursor, or null. */
export const current = (meet: Meet): MeetQuestion | null => meet.options[meet.cursor] ?? null;

/**
 * Ask the question under the cursor: it leaves the list, a good one writes its note into the notebook. Returns the
 * question, or null when nothing can be asked (the visit is finished).
 */
export const askCurrent = (meet: Meet): MeetQuestion | null => {
  if (finished(meet)) return null;
  const question = meet.options[meet.cursor];
  if (!question) return null;
  meet.options.splice(meet.cursor, 1);
  meet.labels.splice(meet.cursor, 1);
  meet.asked.push(question);
  if (question.good) meet.notes.push(question.note);
  if (meet.cursor >= meet.options.length) meet.cursor = Math.max(0, meet.options.length - 1);
  return question;
};

/** The closing line for `good` good questions (the last line covers anything above the list). */
export const debriefFor = (content: MeetContent, good: number): string =>
  content.debrief[Math.max(0, Math.min(good, content.debrief.length - 1))] ?? '';

/** The score line, e.g. OVERVIEW 4/5. */
export const overviewLabel = (good: number, of: number): string => `OVERVIEW ${good}/${of}`;

/**
 * What is said after an answer, as two dialogue pages: the note written down in speech (good; the notebook keeps
 * the capitals) or the short reason the question is weaker, then the one-sentence why. Two pages, so neither
 * sentence is split across a page break.
 */
export const afterAnswer = (question: MeetQuestion): readonly string[] => [
  question.good ? (question.said ?? `Noted: ${question.note}.`) : question.note,
  question.why,
];
