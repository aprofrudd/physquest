import type { InputState } from '../engine/Input';
import type { GameState } from '../state/GameState';
import { isSolid } from '../render/TileMap';

const MOVE_SPEED = 4; // tiles per second
const MOVE_TIME = 1 / MOVE_SPEED;

interface MovementState {
  moving: boolean;
  moveTimer: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  animFrame: number;
  animTimer: number;
}

export const createMovement = () => {
  const state: MovementState = {
    moving: false,
    moveTimer: 0,
    fromX: 0,
    fromY: 0,
    toX: 0,
    toY: 0,
    animFrame: 0,
    animTimer: 0,
  };

  const update = (
    dt: number,
    input: InputState,
    gameState: GameState,
    map: number[][],
    dialogueActive: boolean
  ): { interactTile?: { x: number; y: number } } => {
    if (dialogueActive) return {};

    // Animation timer
    state.animTimer += dt;
    if (state.animTimer > 0.2) {
      state.animTimer = 0;
      state.animFrame = state.animFrame === 0 ? 1 : 0;
    }

    if (state.moving) {
      state.moveTimer += dt;
      const t = Math.min(state.moveTimer / MOVE_TIME, 1);
      // Interpolate position for rendering
      gameState.playerPos.x = state.fromX + (state.toX - state.fromX) * t;
      gameState.playerPos.y = state.fromY + (state.toY - state.fromY) * t;

      if (t >= 1) {
        state.moving = false;
        gameState.playerPos.x = state.toX;
        gameState.playerPos.y = state.toY;
        gameState.playerMoving = false;
      }
      return {};
    }

    // Determine direction from input
    let dx = 0;
    let dy = 0;
    if (input.up) { dy = -1; gameState.playerDir = 'up'; }
    else if (input.down) { dy = 1; gameState.playerDir = 'down'; }
    else if (input.left) { dx = -1; gameState.playerDir = 'left'; }
    else if (input.right) { dx = 1; gameState.playerDir = 'right'; }

    if (dx !== 0 || dy !== 0) {
      const targetX = Math.round(gameState.playerPos.x) + dx;
      const targetY = Math.round(gameState.playerPos.y) + dy;

      // Check bounds
      if (targetY >= 0 && targetY < map.length) {
        const row = map[targetY];
        if (row && targetX >= 0 && targetX < row.length) {
          const tile = row[targetX];
          if (tile !== undefined && !isSolid(tile)) {
            state.moving = true;
            state.moveTimer = 0;
            state.fromX = Math.round(gameState.playerPos.x);
            state.fromY = Math.round(gameState.playerPos.y);
            state.toX = targetX;
            state.toY = targetY;
            gameState.playerMoving = true;
          }
        }
      }
    }

    return {};
  };

  const getAnimFrame = (): number => state.animFrame;

  return { update, getAnimFrame };
};

export type Movement = ReturnType<typeof createMovement>;
