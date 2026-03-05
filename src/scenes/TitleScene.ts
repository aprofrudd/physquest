import type { Scene } from '../engine/GameLoop';
import type { Input } from '../engine/Input';
import type { SceneManager } from '../engine/SceneManager';
import { drawText, measureText } from '../render/PixelFont';
import { PALETTES } from '../render/Palettes';
import { GAME_W, GAME_H } from '../render/DialogueBox';

export const createTitleScene = (
  input: Input,
  sceneManager: SceneManager
): Scene => {
  let timer = 0;

  return {
    onEnter() {
      timer = 0;
    },

    update(dt: number) {
      timer += dt;
      const inp = input.read();
      if (inp.actionPressed && timer > 0.5) {
        sceneManager.switchTo('overworld');
      }
    },

    render(ctx: CanvasRenderingContext2D) {
      const pal = PALETTES.title;

      // Background
      ctx.fillStyle = pal.colors[0];
      ctx.fillRect(0, 0, GAME_W, GAME_H);

      // Decorative pixels
      ctx.fillStyle = pal.colors[1];
      for (let i = 0; i < 40; i++) {
        const x = (i * 37 + Math.floor(timer * 10)) % GAME_W;
        const y = (i * 53) % GAME_H;
        ctx.fillRect(x, y, 2, 2);
      }

      // Title
      const title = 'PHYSQUEST';
      const titleW = measureText(title, 3);
      drawText(ctx, title, (GAME_W - titleW) / 2, 50, pal.colors[4], 3);

      // Subtitle
      const sub = 'SPORTS SCIENCE ADVENTURE';
      const subW = measureText(sub, 1);
      drawText(ctx, sub, (GAME_W - subW) / 2, 80, pal.colors[3]);

      // Decorative line
      ctx.fillStyle = pal.colors[2];
      ctx.fillRect(40, 100, GAME_W - 80, 2);

      // Instructions
      const inst1 = 'ARROWS TO MOVE';
      const inst2 = 'SPACE TO INTERACT';
      drawText(ctx, inst1, (GAME_W - measureText(inst1)) / 2, 120, pal.colors[3]);
      drawText(ctx, inst2, (GAME_W - measureText(inst2)) / 2, 132, pal.colors[3]);

      // Press start (blinking)
      if (Math.floor(timer * 2) % 2 === 0) {
        const start = 'PRESS SPACE TO START';
        const startW = measureText(start, 2);
        drawText(ctx, start, (GAME_W - startW) / 2, 170, pal.colors[5], 2);
      }

      // Version
      drawText(ctx, 'V1.0', 4, GAME_H - 12, pal.colors[2]);
    },
  };
};
