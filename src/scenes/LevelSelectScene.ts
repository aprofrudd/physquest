import type { Scene } from '../engine/GameLoop';
import type { Input } from '../engine/Input';
import type { SceneManager } from '../engine/SceneManager';
import type { GameState } from '../state/GameState';
import { drawText, measureText } from '../render/PixelFont';
import { drawPokemonBox } from '../render/SpriteSheet';
import { GAME_W, GAME_H } from '../render/DialogueBox';
import { PALETTES } from '../render/Palettes';
import { LEVELS } from '../data/levels';
import { LEVEL_DATA } from '../data/sports';

export const createLevelSelectScene = (
  input: Input,
  sceneManager: SceneManager,
  gameState: GameState,
  onSelectLevel: (levelIndex: number) => void,
): Scene => {
  let selectedIndex = 0;
  let upWasDown = false;
  let downWasDown = false;
  let shouldRedirectGameComplete = false;

  return {
    onEnter() {
      // Check if all bosses defeated → game complete (deferred to first update)
      if (gameState.bossDefeated.every(b => b)) {
        gameState.gameComplete = true;
        shouldRedirectGameComplete = true;
        return;
      }

      shouldRedirectGameComplete = false;
      selectedIndex = 0;
      upWasDown = false;
      downWasDown = false;
    },

    update(dt: number) {
      if (shouldRedirectGameComplete) {
        shouldRedirectGameComplete = false;
        sceneManager.switchTo('levelClear');
        return;
      }

      const inp = input.read();

      const upPressed = inp.up && !upWasDown;
      const downPressed = inp.down && !downWasDown;
      upWasDown = inp.up;
      downWasDown = inp.down;

      if (upPressed) selectedIndex = (selectedIndex - 1 + 4) % 4;
      if (downPressed) selectedIndex = (selectedIndex + 1) % 4;

      if (inp.actionPressed) {
        onSelectLevel(selectedIndex);
      }
    },

    render(ctx: CanvasRenderingContext2D) {
      const pal = PALETTES.title;

      // Background
      ctx.fillStyle = pal.colors[4];
      ctx.fillRect(0, 0, GAME_W, GAME_H);

      // Border frame
      ctx.fillStyle = pal.colors[0];
      ctx.fillRect(0, 0, GAME_W, 3);
      ctx.fillRect(0, GAME_H - 3, GAME_W, 3);
      ctx.fillRect(0, 0, 3, GAME_H);
      ctx.fillRect(GAME_W - 3, 0, 3, GAME_H);

      // Header
      const header = 'SELECT A SPORT';
      const headerW = measureText(header, 2);
      drawText(ctx, header, (GAME_W - headerW) / 2, 12, pal.colors[0], 2);

      // Player name
      if (gameState.playerName) {
        const nameText = `COACH ${gameState.playerName}`;
        drawText(ctx, nameText, (GAME_W - measureText(nameText)) / 2, 30, pal.colors[2]);
      }

      // Sport cards
      const cardStartY = 44;
      const cardH = 40;
      const cardGap = 4;
      const cardX = 16;
      const cardW = GAME_W - 32;

      for (let i = 0; i < 4; i++) {
        const level = LEVELS[i];
        const sport = LEVEL_DATA[i];
        if (!level || !sport) continue;

        const y = cardStartY + i * (cardH + cardGap);
        const isSelected = i === selectedIndex;
        const isComplete = gameState.bossDefeated[i] ?? false;

        // Card box
        const borderColor = isSelected ? pal.colors[5] : pal.colors[1];
        drawPokemonBox(ctx, cardX, y, cardW, cardH, borderColor);

        // Selection cursor
        if (isSelected) {
          drawText(ctx, '>', cardX + 6, y + 8, pal.colors[5], 2);
        }

        // Sport name
        const nameX = cardX + 24;
        drawText(ctx, sport.sport, nameX, y + 8, '#080808', 2);

        // Athlete name
        const athleteLine = sport.athleteProfile.split('.')[0] ?? '';
        const truncated = athleteLine.length > 32 ? athleteLine.slice(0, 32) + '...' : athleteLine;
        drawText(ctx, truncated, nameX, y + 24, pal.colors[1]);

        // Complete badge
        if (isComplete) {
          const badge = 'COMPLETE';
          const badgeW = measureText(badge) + 8;
          const badgeX = cardX + cardW - badgeW - 8;
          ctx.fillStyle = '#38a848';
          ctx.fillRect(badgeX, y + 8, badgeW, 12);
          drawText(ctx, badge, badgeX + 4, y + 10, '#f8f8f0');
        }
      }

      // Instructions
      const inst = 'UP/DOWN:CHOOSE  SPACE:SELECT';
      drawText(ctx, inst, (GAME_W - measureText(inst)) / 2, GAME_H - 16, pal.colors[2]);
    },
  };
};
