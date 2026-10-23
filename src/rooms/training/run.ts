// The week playing out: one day at a time, a playhead moving across the board. Pure timing, no drawing.
import { DAY_COUNT } from './model';

/** Seconds each day takes at normal speed. */
export const DAY_SECONDS = 1.2;
/** How much faster holding A makes it. */
export const FAST_FORWARD = 4;
/** A pause on the finished week before the debrief starts (normal-speed seconds). */
export const END_HOLD = 0.8;
/**
 * A must be held this long, without a break, before the fast-forward starts. A tap does not skip ahead, and a press
 * carried over from the question that started the run (the YES) or from the pause menu (RESUME) is over long before.
 */
export const FAST_LOCK = 0.35;

export interface RunClock {
  /** Move on by dt real seconds (`fast`: A is held; the boost starts once it has been held for FAST_LOCK seconds). */
  update(dt: number, fast: boolean): void;
  /** The day being played (0-6). Stays on the last day once the week is over. */
  readonly day: number;
  /** How far through that day (0-1). */
  readonly progress: number;
  /** Days finished so far (0-7). */
  readonly daysDone: number;
  /** The week and the pause after it are over: time for the debrief. */
  readonly finished: boolean;
  /** The last step was fast-forwarded (A has been held long enough). */
  readonly fast: boolean;
}

export const createRunClock = (): RunClock => {
  let elapsed = 0; // normal-speed seconds
  let heldFor = 0; // real seconds A has been held without a break
  let boosted = false;
  return {
    update(dt, fast) {
      heldFor = fast ? heldFor + dt : 0;
      boosted = heldFor > FAST_LOCK;
      elapsed += dt * (boosted ? FAST_FORWARD : 1);
    },
    get fast() {
      return boosted;
    },
    get day() {
      return Math.min(DAY_COUNT - 1, Math.floor(elapsed / DAY_SECONDS));
    },
    get progress() {
      const day = Math.floor(elapsed / DAY_SECONDS);
      return day >= DAY_COUNT ? 1 : (elapsed - day * DAY_SECONDS) / DAY_SECONDS;
    },
    get daysDone() {
      return Math.min(DAY_COUNT, Math.floor(elapsed / DAY_SECONDS));
    },
    get finished() {
      return elapsed >= DAY_COUNT * DAY_SECONDS + END_HOLD;
    },
  };
};
