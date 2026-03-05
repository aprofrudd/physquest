import type { Scene } from '../engine/GameLoop';
import type { Input } from '../engine/Input';
import type { SceneManager } from '../engine/SceneManager';
import type { GameState } from '../state/GameState';
import { GAME_W, GAME_H } from '../render/DialogueBox';
import { drawText, measureText } from '../render/PixelFont';
import { drawPokemonBox } from '../render/SpriteSheet';
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

      // Light background
      ctx.fillStyle = pal.colors[4];
      ctx.fillRect(0, 0, GAME_W, GAME_H);

      // Border frame
      ctx.fillStyle = pal.colors[0];
      ctx.fillRect(0, 0, GAME_W, 3);
      ctx.fillRect(0, GAME_H - 3, GAME_W, 3);
      ctx.fillRect(0, 0, 3, GAME_H);
      ctx.fillRect(GAME_W - 3, 0, 3, GAME_H);

      const isWin = won();
      const level = LEVELS[gameState.currentLevel];

      if (isWin) {
        const title = gameState.gameComplete ? 'GAME COMPLETE!' : 'LEVEL CLEAR!';
        const titleW = measureText(title, 3);
        // Drop shadow + title
        drawText(ctx, title, (GAME_W - titleW) / 2 + 1, 21, pal.colors[1], 3);
        drawText(ctx, title, (GAME_W - titleW) / 2, 20, '#38a848', 3);

        if (level) {
          const levelW = measureText(level.name);
          drawText(ctx, level.name, (GAME_W - levelW) / 2, 48, pal.colors[1]);
        }

        // Stats summary in Pokemon-style box
        drawPokemonBox(ctx, 20, 62, GAME_W - 40, 86, pal.colors[1]);

        const stats = [
          { label: 'SPEED', value: gameState.playerStats.speed },
          { label: 'STRENGTH', value: gameState.playerStats.strength },
          { label: 'ENDURANCE', value: gameState.playerStats.endurance },
          { label: 'POWER', value: gameState.playerStats.power },
        ];

        for (let i = 0; i < stats.length; i++) {
          const s = stats[i]!;
          const y = 72 + i * 18;
          drawText(ctx, s.label, 30, y, '#080808');
          // Stat bar
          const barX = 110;
          const barW = 100;
          drawPokemonBox(ctx, barX, y - 1, barW, 12, pal.colors[2]);
          const fillW = Math.floor((barW - 8) * s.value);
          ctx.fillStyle = s.value > 0.7 ? '#38a848' : s.value > 0.4 ? '#c0a830' : '#a83030';
          ctx.fillRect(barX + 4, y + 1, fillW, 8);
          drawText(ctx, `${Math.round(s.value * 100)}%`, barX + barW + 8, y, '#080808');
        }

        if (gameState.gameComplete) {
          drawText(ctx, 'YOUR SCIENCE HELD UP.', 20, 160, pal.colors[0]);
          drawText(ctx, 'THE ATHLETE PEAKED AT', 20, 172, pal.colors[1]);
          drawText(ctx, 'THE RIGHT MOMENT.', 20, 184, pal.colors[1]);
        }
      } else {
        const title = 'DEFEATED';
        const titleW = measureText(title, 3);
        drawText(ctx, title, (GAME_W - titleW) / 2 + 1, 41, pal.colors[1], 3);
        drawText(ctx, title, (GAME_W - titleW) / 2, 40, '#a83030', 3);

        drawPokemonBox(ctx, 20, 80, GAME_W - 40, 50, pal.colors[1]);
        drawText(ctx, 'BETTER DATA NEXT TIME,', 30, 90, '#080808');
        drawText(ctx, 'COACH. THE MARGINS', 30, 104, '#080808');
        drawText(ctx, 'MATTER.', 30, 118, '#080808');
      }

      // Continue prompt — Pokemon-style blink
      if (timer > 2) {
        const blinkCycle = (Date.now() % 750);
        if (blinkCycle < 500) {
          const cont = 'PRESS SPACE TO CONTINUE';
          const contW = measureText(cont);
          drawText(ctx, cont, (GAME_W - contW) / 2, GAME_H - 20, pal.colors[0]);
        }
      }
    },
  };
};
