import type { InputState } from '../engine/Input';
import type { SceneManager } from '../engine/SceneManager';
import { drawText, measureText } from '../render/PixelFont';
import { drawPokemonBox } from '../render/SpriteSheet';
import { GAME_W, GAME_H } from '../render/DialogueBox';
import { saveGame } from './SaveSystem';
import type { GameState } from '../state/GameState';

const OPTIONS = ['RESUME', 'SAVE GAME', 'QUIT TO TITLE'] as const;

export interface PauseMenu {
  isActive(): boolean;
  toggle(): void;
  update(dt: number, inp: InputState): void;
  render(ctx: CanvasRenderingContext2D): void;
}

export const createPauseMenu = (
  sceneManager: SceneManager,
  gameState: GameState,
): PauseMenu => {
  let active = false;
  let selectedIndex = 0;
  let upWasDown = false;
  let downWasDown = false;
  let actionWasDown = false;
  let savedFlashTimer = 0;

  return {
    isActive() {
      return active;
    },

    toggle() {
      active = !active;
      if (active) {
        selectedIndex = 0;
        upWasDown = false;
        downWasDown = false;
        actionWasDown = false;
        savedFlashTimer = 0;
      }
    },

    update(dt: number, inp: InputState) {
      if (!active) return;

      if (savedFlashTimer > 0) {
        savedFlashTimer -= dt;
      }

      const upPressed = inp.up && !upWasDown;
      const downPressed = inp.down && !downWasDown;
      const actionPressed = inp.action && !actionWasDown;
      upWasDown = inp.up;
      downWasDown = inp.down;
      actionWasDown = inp.action;

      // ESC to close
      if (inp.escapePressed) {
        active = false;
        return;
      }

      if (upPressed) selectedIndex = (selectedIndex - 1 + OPTIONS.length) % OPTIONS.length;
      if (downPressed) selectedIndex = (selectedIndex + 1) % OPTIONS.length;

      if (actionPressed) {
        switch (selectedIndex) {
          case 0: // Resume
            active = false;
            break;
          case 1: // Save
            saveGame(gameState);
            savedFlashTimer = 1.5;
            break;
          case 2: // Quit to title
            active = false;
            sceneManager.switchTo('title');
            break;
        }
      }
    },

    render(ctx: CanvasRenderingContext2D) {
      if (!active) return;

      // Semi-transparent overlay
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 0, GAME_W, GAME_H);

      // Pause box
      const boxW = 140;
      const boxH = 80;
      const boxX = (GAME_W - boxW) / 2;
      const boxY = (GAME_H - boxH) / 2;
      drawPokemonBox(ctx, boxX, boxY, boxW, boxH);

      // Header
      const header = 'PAUSED';
      const headerW = measureText(header, 2);
      drawText(ctx, header, (GAME_W - headerW) / 2, boxY + 8, '#080808', 2);

      // Options
      const optStartY = boxY + 30;
      for (let i = 0; i < OPTIONS.length; i++) {
        const isSelected = i === selectedIndex;
        const prefix = isSelected ? '>' : ' ';
        const color = isSelected ? '#080808' : '#606060';
        drawText(ctx, prefix + OPTIONS[i], boxX + 12, optStartY + i * 14, color);
      }

      // Saved flash
      if (savedFlashTimer > 0) {
        const flashText = 'SAVED!';
        const flashW = measureText(flashText, 2);
        drawText(ctx, flashText, (GAME_W - flashW) / 2, boxY + boxH + 8, '#38a848', 2);
      }
    },
  };
};
