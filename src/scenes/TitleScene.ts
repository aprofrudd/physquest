import type { Scene } from '../engine/GameLoop';
import type { Input } from '../engine/Input';
import type { SceneManager } from '../engine/SceneManager';
import type { GameState } from '../state/GameState';
import { drawText, measureText } from '../render/PixelFont';
import { PALETTES } from '../render/Palettes';
import { GAME_W, GAME_H } from '../render/DialogueBox';
import { hasSave, loadSave, deleteSave, applySave } from '../systems/SaveSystem';

// Simple logo sprite: 48x16 clipboard/whistle icon (drawn at 1x scale)
const LOGO_SPRITE: number[][] = [
  [0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,1,4,4,4,4,4,4,4,4,4,4,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,1,4,4,4,4,4,4,4,4,4,4,4,4,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,5,5,5,1,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,1,4,1,1,1,4,1,1,4,1,1,4,4,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,5,5,5,5,5,1,0,0,0,0,0,0,0,0,0],
  [0,0,0,1,4,4,4,4,4,4,4,4,4,4,4,4,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,5,1,1,1,5,1,0,0,0,0,0,0,0,0,0],
  [0,0,0,1,4,1,1,4,1,1,1,4,1,4,4,4,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,1,1,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,1,4,4,4,4,4,4,4,4,4,4,4,4,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,1,4,1,4,1,1,4,1,1,4,1,4,4,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,1,4,4,4,4,4,4,4,4,4,4,4,4,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,1,4,1,1,1,4,1,4,1,1,1,4,4,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,1,4,4,4,4,4,4,4,4,4,4,4,4,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
];

// Draw logo sprite using palette colors
const drawLogo = (ctx: CanvasRenderingContext2D, x: number, y: number, colors: string[]) => {
  for (let row = 0; row < LOGO_SPRITE.length; row++) {
    const spriteRow = LOGO_SPRITE[row]!;
    for (let col = 0; col < spriteRow.length; col++) {
      const idx = spriteRow[col];
      if (idx === 0) continue;
      const color = colors[idx!];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(Math.floor(x + col), Math.floor(y + row), 1, 1);
    }
  }
};

export const createTitleScene = (
  input: Input,
  sceneManager: SceneManager,
  gameState: GameState,
): Scene => {
  let timer = 0;
  let saveExists = false;
  let menuIndex = 0; // 0 = Continue, 1 = New Game (when save exists)
  let upWasDown = false;
  let downWasDown = false;

  return {
    onEnter() {
      timer = 0;
      saveExists = hasSave();
      menuIndex = 0;
      upWasDown = false;
      downWasDown = false;
    },

    update(dt: number) {
      timer += dt;
      const inp = input.read();

      if (timer < 0.5) return;

      if (saveExists) {
        // Menu navigation
        const upPressed = inp.up && !upWasDown;
        const downPressed = inp.down && !downWasDown;
        upWasDown = inp.up;
        downWasDown = inp.down;

        if (upPressed) menuIndex = (menuIndex - 1 + 2) % 2;
        if (downPressed) menuIndex = (menuIndex + 1) % 2;

        if (inp.actionPressed) {
          if (menuIndex === 0) {
            // Continue
            const save = loadSave();
            if (save) {
              applySave(gameState, save);
              sceneManager.switchTo('levelSelect');
            } else {
              // Save was deleted externally
              saveExists = false;
            }
          } else {
            // New Game
            deleteSave();
            sceneManager.switchTo('intro');
          }
        }
      } else {
        // No save — just press space
        if (inp.actionPressed) {
          sceneManager.switchTo('intro');
        }
      }
    },

    render(ctx: CanvasRenderingContext2D) {
      const pal = PALETTES.title;

      // Background — light (GBC style)
      ctx.fillStyle = pal.colors[4];
      ctx.fillRect(0, 0, GAME_W, GAME_H);

      // Double-line border frame around screen
      ctx.fillStyle = pal.colors[0];
      ctx.fillRect(0, 0, GAME_W, 3);
      ctx.fillRect(0, GAME_H - 3, GAME_W, 3);
      ctx.fillRect(0, 0, 3, GAME_H);
      ctx.fillRect(GAME_W - 3, 0, 3, GAME_H);
      ctx.fillStyle = pal.colors[1];
      ctx.fillRect(3, 3, GAME_W - 6, 2);
      ctx.fillRect(3, GAME_H - 5, GAME_W - 6, 2);
      ctx.fillRect(3, 3, 2, GAME_H - 6);
      ctx.fillRect(GAME_W - 5, 3, 2, GAME_H - 6);

      // Title "PHYSQUEST" at 3x with 1px drop shadow
      const title = 'PHYSQUEST';
      const titleW = measureText(title, 3);
      const titleX = (GAME_W - titleW) / 2;
      // Drop shadow
      drawText(ctx, title, titleX + 1, 31, pal.colors[1], 3);
      // Main title
      drawText(ctx, title, titleX, 30, pal.colors[5], 3);

      // Subtitle
      const sub = 'SPORTS SCIENCE ADVENTURE';
      const subW = measureText(sub, 1);
      drawText(ctx, sub, (GAME_W - subW) / 2, 56, pal.colors[1]);

      // Horizontal divider
      ctx.fillStyle = pal.colors[2];
      ctx.fillRect(30, 68, GAME_W - 60, 2);

      // Logo sprite
      drawLogo(ctx, (GAME_W - 48) / 2, 76, pal.colors as unknown as string[]);

      // Horizontal divider
      ctx.fillStyle = pal.colors[2];
      ctx.fillRect(30, 98, GAME_W - 60, 2);

      // Instructions
      const inst1 = 'ARROWS TO MOVE';
      const inst2 = 'SPACE TO INTERACT';
      drawText(ctx, inst1, (GAME_W - measureText(inst1)) / 2, 110, pal.colors[1]);
      drawText(ctx, inst2, (GAME_W - measureText(inst2)) / 2, 122, pal.colors[1]);

      // Menu or press start
      if (saveExists) {
        const menuY = 150;
        const options = ['CONTINUE', 'NEW GAME'];
        for (let i = 0; i < options.length; i++) {
          const opt = options[i]!;
          const isSelected = i === menuIndex;
          const prefix = isSelected ? '>' : ' ';
          const text = prefix + opt;
          const textW = measureText(text, 2);
          const color = isSelected ? pal.colors[0] : pal.colors[2];
          drawText(ctx, text, (GAME_W - textW) / 2, menuY + i * 20, color, 2);
        }
      } else {
        // Press start — Pokemon-style blink (500ms on, 250ms off)
        const blinkCycle = (Date.now() % 750);
        if (blinkCycle < 500) {
          const start = 'PRESS SPACE TO START';
          const startW = measureText(start, 2);
          drawText(ctx, start, (GAME_W - startW) / 2, 155, pal.colors[0], 2);
        }
      }

      // Version
      drawText(ctx, 'V1.0', 8, GAME_H - 14, pal.colors[2]);
    },
  };
};
