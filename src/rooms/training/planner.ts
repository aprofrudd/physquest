// The planning board's state: which day the cursor is on, what each day is set to, and what that adds up to.
// Pure (no DOM, no canvas): the instrument feeds it presses, the renderer reads it.
import type { TrainingContent, WeekCard } from '../content/types';
import {
  AWAY,
  DAY_COUNT,
  EMPTY,
  REST,
  analyse,
  cardSession,
  missingKeys,
  pickAway,
  shuffledCards,
  type Session,
  type WeekAnalysis,
} from './model';

/** The cursor slot after the seventh day: the GO button. */
export const GO = DAY_COUNT;
const SLOTS = DAY_COUNT + 1;

export interface Planner {
  /** The away day (1-3: TUE, WED or THU) for this attempt, or null when there is none. */
  readonly away: number | null;
  /** Card indices in the order UP and DOWN cycle through them: fresh for every attempt. */
  readonly order: readonly number[];
  /** What UP and DOWN cycle a day through: nothing planned, the cards in `order`, then REST. */
  readonly options: readonly Session[];
  /** 0-6 for a day, GO (7) for the GO slot. */
  readonly cursor: number;
  readonly plan: readonly Session[];
  /** What the plan so far adds up to (recomputed when the plan changes). */
  readonly analysis: WeekAnalysis;
  /** LEFT or RIGHT: the previous or next slot. Wraps round, unless `wrap` is false (a held direction stops at the ends). */
  move(delta: 1 | -1, wrap?: boolean): void;
  /** DOWN or UP: the cursor day's next or previous option. Does nothing on GO or on the away day; says if it changed. */
  cycle(delta: 1 | -1): boolean;
  /** A: on to the next slot (day after day, then GO). False when already on GO. */
  next(): boolean;
  /** Anything the player has placed (an away day is not theirs). */
  touched(): boolean;
  /** Key cards with no session yet. */
  missing(): WeekCard[];
}

/** A fresh attempt: a shuffled option order, and an away day if the level has one. Pass a seeded rng in tests. */
export const createPlanner = (content: TrainingContent, rng: () => number = Math.random): Planner => {
  const away = pickAway(content, rng);
  const order = shuffledCards(content, rng);
  const options: Session[] = [EMPTY, ...order.map(cardSession), REST];
  const choices: number[] = Array.from({ length: DAY_COUNT }, () => 0); // index into options, per day
  let cursor = 0;
  let plan: Session[] = [];
  let analysis: WeekAnalysis;

  const rebuild = () => {
    plan = choices.map((choice, day) => (day === away ? AWAY : (options[choice] ?? EMPTY)));
    analysis = analyse(content, plan);
  };
  rebuild();

  return {
    away,
    order,
    options,
    get cursor() {
      return cursor;
    },
    get plan() {
      return plan;
    },
    get analysis() {
      return analysis;
    },
    move(delta, wrap = true) {
      const next = cursor + delta;
      if (!wrap && (next < 0 || next >= SLOTS)) return;
      cursor = (next + SLOTS) % SLOTS;
    },
    cycle(delta) {
      if (cursor === GO || cursor === away) return false;
      choices[cursor] = ((choices[cursor] ?? 0) + delta + options.length) % options.length;
      rebuild();
      return true;
    },
    next() {
      if (cursor === GO) return false;
      cursor++;
      return true;
    },
    touched: () => plan.some(s => s.kind === 'card' || s.kind === 'rest'),
    missing: () => missingKeys(content, plan),
  };
};
