import type { InputState } from '../engine/Input';
import type { GameState } from '../state/GameState';
import { isDoor } from '../render/TileMap';
import { sfx } from '../audio/Sfx';
import { isBlocked, tileAt } from './Collision';

export type Dir = GameState['playerDir'];

const WALK_STEP = 0.25; // 4 tiles/s: exactly 15 fixed updates per tile at 60 Hz
const RUN_STEP = 0.125; // 8 tiles/s while B is held
const RECOIL_STEP = 1 / 15; // quick hop back when a door turns the player away: settled 4 updates after the message closes
const TURN_DELAY = 0.14; // a turn from standstill only becomes a walk if the key is still down after this (outlasts a 60-130 ms tap)
const EPS = 1e-4; // 15 * (1/60) lands a hair under 0.25 in floating point

const DIRS: readonly Dir[] = ['up', 'down', 'left', 'right'];
const DELTA: Record<Dir, readonly [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};
const PRESSED = {
  up: 'upPressed',
  down: 'downPressed',
  left: 'leftPressed',
  right: 'rightPressed',
} as const;

interface Step {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  time: number; // seconds the whole step takes
  elapsed: number;
  forced: boolean; // scripted (door push-back): ignores input and never chains
}

export interface MoveResult {
  /** A player-driven step finished this update; the tile the player now stands on. */
  arrived?: { x: number; y: number };
}

export const createMovement = () => {
  let step: Step | null = null;
  let origin: { x: number; y: number } | null = null; // tile the latest step started from
  let needsNeutral = false; // ignore held directions until every one has been released once
  let turnDir: Dir | null = null; // direction we turned toward from standstill
  let turnHold = 0; // how long that direction has been held since
  let order = 0;
  const pressedAt: Record<Dir, number> = { up: 0, down: 0, left: 0, right: 0 };

  // Of the held directions the most recently pressed one wins, so rolling the d-pad turns at once
  const heldDirection = (inp: InputState): Dir | null => {
    let best: Dir | null = null;
    for (const d of DIRS) {
      if (inp[d] && (best === null || pressedAt[d] > pressedAt[best])) best = d;
    }
    return best;
  };

  const place = (gs: GameState, s: Step) => {
    const t = Math.min(s.elapsed / s.time, 1);
    gs.playerPos.x = s.fromX + (s.toX - s.fromX) * t;
    gs.playerPos.y = s.fromY + (s.toY - s.fromY) * t;
  };

  const update = (
    dt: number,
    inp: InputState,
    gs: GameState,
    map: number[][],
    frozen = false,
  ): MoveResult => {
    for (const d of DIRS) if (inp[PRESSED[d]]) pressedAt[d] = ++order;
    if (needsNeutral && !DIRS.some(d => inp[d])) needsNeutral = false;
    // Frozen (dialogue, fade, panel): the world stands still but we keep watching the keys
    if (frozen) return {};

    const result: MoveResult = {};
    let carry = dt; // time left in this update for the next step to use
    let chaining = false;

    if (step) {
      step.elapsed += dt;
      if (step.elapsed < step.time - EPS) {
        place(gs, step);
        return result;
      }
      // Step done. Whatever time overshot carries into the next step so tile-to-tile motion has no gap.
      carry = Math.max(0, step.elapsed - step.time);
      const done = step;
      step = null;
      gs.playerPos.x = done.toX;
      gs.playerPos.y = done.toY;
      if (done.forced) {
        needsNeutral = true;
        gs.playerMoving = false;
        return result;
      }
      result.arrived = { x: done.toX, y: done.toY };
      // Never walk on through a door: the scene decides what the door does
      if (isDoor(tileAt(map, done.toX, done.toY) ?? 0)) {
        gs.playerMoving = false;
        return result;
      }
      chaining = true;
    }

    const dir = needsNeutral ? null : heldDirection(inp);
    if (!dir) {
      turnDir = null;
      turnHold = 0;
      gs.playerMoving = false;
      return result;
    }

    if (chaining) {
      turnDir = null; // already walking: a new direction applies at once
    } else {
      if (dir !== gs.playerDir) {
        gs.playerDir = dir; // turn on the spot straight away
        turnDir = dir;
        turnHold = 0;
      }
      if (turnDir === dir) {
        turnHold += dt;
        if (turnHold < TURN_DELAY - EPS) {
          gs.playerMoving = false;
          return result;
        }
        turnDir = null;
      }
    }

    gs.playerDir = dir;
    const [dx, dy] = DELTA[dir];
    const fromX = Math.round(gs.playerPos.x);
    const fromY = Math.round(gs.playerPos.y);
    const toX = fromX + dx;
    const toY = fromY + dy;

    if (isBlocked(map, toX, toY)) {
      sfx.play('bump'); // we already face it; Sfx rate-limits the repeats while the key stays down
      gs.playerMoving = false;
      return result;
    }

    origin = { x: fromX, y: fromY };
    step = { fromX, fromY, toX, toY, time: inp.b ? RUN_STEP : WALK_STEP, elapsed: carry, forced: false };
    gs.playerMoving = true;
    place(gs, step);
    return result;
  };

  /** Hop the player one tile to (toX, toY), ignoring input, then wait for the keys to be released. */
  const forceStep = (gs: GameState, toX: number, toY: number) => {
    const fromX = Math.round(gs.playerPos.x);
    const fromY = Math.round(gs.playerPos.y);
    if (fromX === toX && fromY === toY) return;
    if (toX !== fromX) gs.playerDir = toX < fromX ? 'left' : 'right';
    else gs.playerDir = toY < fromY ? 'up' : 'down';
    step = { fromX, fromY, toX, toY, time: RECOIL_STEP, elapsed: 0, forced: true };
    origin = null;
    turnDir = null;
    gs.playerMoving = true;
  };

  /** Drop any step in progress and ignore held directions until they have been released once. */
  const reset = (gs: GameState) => {
    step = null;
    origin = null;
    turnDir = null;
    turnHold = 0;
    needsNeutral = true;
    gs.playerPos.x = Math.round(gs.playerPos.x);
    gs.playerPos.y = Math.round(gs.playerPos.y);
    gs.playerMoving = false;
  };

  /** Which way to show the walk cycle: legs apart for the first half of each tile, together for the second. */
  const getAnimFrame = (): number => (step && step.elapsed < step.time / 2 ? 1 : 0);

  return {
    update,
    forceStep,
    reset,
    getAnimFrame,
    isMoving: (): boolean => step !== null,
    /** The tile the latest step started from: where to put the player back after a refused door. */
    stepOrigin: (): { x: number; y: number } | null => (origin ? { ...origin } : null),
  };
};

export type Movement = ReturnType<typeof createMovement>;
