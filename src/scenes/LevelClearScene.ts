import type { Scene } from '../engine/GameLoop';
import type { Input } from '../engine/Input';
import type { SceneManager } from '../engine/SceneManager';
import type { GameState } from '../state/GameState';
import { GAME_W, GAME_H } from '../render/DialogueBox';
import { drawText, measureText } from '../render/PixelFont';
import { drawBox } from '../render/SpriteSheet';
import { PALETTES } from '../render/Palettes';
import { LEVELS } from '../data/levels';

export const createLevelClearScene = (
  input: Input,
  sceneManager: SceneManager,
  gameState: GameState,
  won: () => boolean,
  onContinue: () => void
): Scene => {
  let timer = 0;

  return {
    onEnter() {
      timer = 0;
    },

    update(dt: number) {
      timer += dt;
      const inp = input.read();
      if (inp.actionPressed && timer > 2) {
        onContinue();
      }
    },

    render(ctx: CanvasRenderingContext2D) {
      const pal = PALETTES.title;
      ctx.fillStyle = pal.colors[0];
      ctx.fillRect(0, 0, GAME_W, GAME_H);

      const isWin = won();
      const level = LEVELS[gameState.currentLevel];

      if (isWin) {
        const title = gameState.gameComplete ? 'GAME COMPLETE!' : 'LEVEL CLEAR!';
        const titleW = measureText(title, 3);
        drawText(ctx, title, (GAME_W - titleW) / 2, 20, '#5bd95b', 3);

        if (level) {
          drawText(ctx, level.name, (GAME_W - measureText(level.name)) / 2, 50, pal.colors[4]);
        }

        // Stats summary
        drawBox(ctx, 20, 70, GAME_W - 40, 80, pal.colors[1], pal.colors[3], 2);

        const stats = [
          { label: 'SPEED', value: gameState.playerStats.speed },
          { label: 'STRENGTH', value: gameState.playerStats.strength },
          { label: 'ENDURANCE', value: gameState.playerStats.endurance },
          { label: 'POWER', value: gameState.playerStats.power },
        ];

        for (let i = 0; i < stats.length; i++) {
          const s = stats[i]!;
          const y = 80 + i * 16;
          drawText(ctx, s.label, 30, y, pal.colors[4]);
          // Stat bar
          const barX = 110;
          const barW = 100;
          drawBox(ctx, barX, y, barW, 10, pal.colors[0], pal.colors[2], 1);
          const fillW = Math.floor(barW * s.value);
          ctx.fillStyle = s.value > 0.7 ? '#5bd95b' : s.value > 0.4 ? '#d9d95b' : '#d95b5b';
          ctx.fillRect(barX + 1, y + 1, fillW, 8);
          drawText(ctx, `${Math.round(s.value * 100)}%`, barX + barW + 8, y, pal.colors[4]);
        }

        if (gameState.gameComplete) {
          const msg = 'Your science held up. The athlete peaked at the right moment.';
          drawText(ctx, 'YOUR SCIENCE HELD UP.', 20, 165, pal.colors[5] ?? '#ffffff');
          drawText(ctx, 'THE ATHLETE PEAKED AT', 20, 177, pal.colors[4]);
          drawText(ctx, 'THE RIGHT MOMENT.', 20, 189, pal.colors[4]);
        }
      } else {
        const title = 'DEFEATED';
        const titleW = measureText(title, 3);
        drawText(ctx, title, (GAME_W - titleW) / 2, 40, '#d95b5b', 3);

        drawText(ctx, 'BETTER DATA NEXT TIME,', 30, 90, pal.colors[4]);
        drawText(ctx, 'COACH. THE MARGINS', 30, 104, pal.colors[4]);
        drawText(ctx, 'MATTER.', 30, 118, pal.colors[4]);
      }

      // Continue prompt
      if (timer > 2) {
        if (Math.floor(timer * 2) % 2 === 0) {
          const cont = 'PRESS SPACE TO CONTINUE';
          const contW = measureText(cont);
          drawText(ctx, cont, (GAME_W - contW) / 2, GAME_H - 30, pal.colors[3]);
        }
      }
    },
  };
};
