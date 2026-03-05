import type { Scene } from '../engine/GameLoop';
import type { Input } from '../engine/Input';
import type { SceneManager } from '../engine/SceneManager';
import type { GameState } from '../state/GameState';
import type { DialogueSystem } from '../systems/Dialogue';
import { GAME_W, GAME_H } from '../render/DialogueBox';
import { drawText, measureText } from '../render/PixelFont';
import { drawBox, drawSprite } from '../render/SpriteSheet';
import { PALETTES } from '../render/Palettes';
import { LEVEL_DATA } from '../data/sports';
import { ATHLETE_SPRITE, SPRITE_COLORS } from '../data/sprites';
import {
  createMinigameState,
  updateMinigame,
  renderMinigame,
  type MinigameType,
} from '../systems/BossMinigame';

type BossPhase = 'intro' | 'statDisplay' | 'minigame' | 'result';

export const createBossBattleScene = (
  input: Input,
  sceneManager: SceneManager,
  gameState: GameState,
  dialogue: DialogueSystem,
  onWin: () => void,
  onLose: () => void
): Scene => {
  let phase: BossPhase = 'intro';
  let minigame = createMinigameState('sprint', 0.5, 0.5);
  let statDisplayTimer = 0;
  let resultTimer = 0;

  const STAT_NAMES = ['SPEED', 'STRENGTH', 'ENDURANCE', 'POWER'] as const;

  const getPlayerStats = (): number[] => {
    return [
      gameState.playerStats.speed,
      gameState.playerStats.strength,
      gameState.playerStats.endurance,
      gameState.playerStats.power,
    ];
  };

  const getRivalStats = (): number[] => {
    // Rival has fixed stats that scale with level
    const base = 0.4 + gameState.currentLevel * 0.1;
    return [base, base + 0.05, base, base + 0.05];
  };

  return {
    onEnter() {
      phase = 'intro';
      statDisplayTimer = 0;
      resultTimer = 0;

      const sport = LEVEL_DATA[gameState.currentLevel];
      if (!sport) return;

      // Rival taunt
      dialogue.show(
        `${sport.rivalName}: "${sport.rivalTaunt}"`,
        undefined,
        () => {
          phase = 'statDisplay';
          statDisplayTimer = 0;
        }
      );
    },

    update(dt: number) {
      const inp = input.read();
      dialogue.update(dt, inp);

      if (phase === 'statDisplay') {
        statDisplayTimer += dt;
        if (statDisplayTimer > 3) {
          // Start minigame
          phase = 'minigame';
          const sport = LEVEL_DATA[gameState.currentLevel];
          if (sport) {
            const typeMap: Record<string, MinigameType> = {
              speed: 'sprint',
              strength: 'strength',
              endurance: 'endurance',
              power: 'power',
            };
            const mgType = typeMap[sport.bossStat] ?? 'sprint';
            const playerStat = gameState.playerStats[sport.bossStat];
            const rivalStats = getRivalStats();
            const rivalStatIdx = STAT_NAMES.indexOf(sport.bossStat.toUpperCase() as typeof STAT_NAMES[number]);
            const rivalStat = rivalStats[rivalStatIdx >= 0 ? rivalStatIdx : 0] ?? 0.5;
            minigame = createMinigameState(mgType, playerStat, rivalStat);
          }
        }
      }

      if (phase === 'minigame') {
        updateMinigame(minigame, dt, inp.actionPressed, inp.action);
        if (minigame.complete && !dialogue.isActive()) {
          phase = 'result';
          resultTimer = 0;

          const sport = LEVEL_DATA[gameState.currentLevel];
          if (sport) {
            const won = minigame.won;
            const resultText = won
              ? `${sport.rivalName}: "${sport.rivalLoseLine}"`
              : `Better data next time, Coach. The margins matter.`;

            setTimeout(() => {
              dialogue.show(resultText, undefined, () => {
                if (won) {
                  onWin();
                } else {
                  onLose();
                }
              });
            }, 1500);
          }
        }
      }

      if (phase === 'result') {
        resultTimer += dt;
      }
    },

    render(ctx: CanvasRenderingContext2D) {
      const pal = PALETTES.boss;

      // Background
      ctx.fillStyle = pal.colors[0];
      ctx.fillRect(0, 0, GAME_W, GAME_H);

      // Arena floor pattern
      ctx.fillStyle = pal.colors[1];
      for (let y = GAME_H / 2; y < GAME_H; y += 4) {
        ctx.fillRect(0, y, GAME_W, 2);
      }

      const sport = LEVEL_DATA[gameState.currentLevel];
      if (!sport) return;

      // Event title
      const eventTitle = sport.bossEvent;
      const titleW = measureText(eventTitle, 2);
      drawText(ctx, eventTitle, (GAME_W - titleW) / 2, 8, pal.colors[5] ?? '#ffffff', 2);

      // Draw athletes
      const leftX = 20;
      const rightX = GAME_W - 52;
      const athleteY = 30;

      // Player athlete (left)
      drawSprite(ctx, ATHLETE_SPRITE, leftX, athleteY, SPRITE_COLORS['boss_player']!);
      drawText(ctx, 'YOUR ATHLETE', leftX - 4, athleteY - 10, pal.colors[4] ?? '#aaaaaa');

      // Rival athlete (right) — mirrored
      const mirroredSprite = ATHLETE_SPRITE.map(row => [...row].reverse());
      drawSprite(ctx, mirroredSprite, rightX, athleteY, SPRITE_COLORS['boss_rival']!);
      drawText(ctx, sport.rivalName.toUpperCase(), rightX - 4, athleteY - 10, pal.colors[4] ?? '#aaaaaa');

      // Stat bars
      const playerStats = getPlayerStats();
      const rivalStats = getRivalStats();
      const barStartY = GAME_H / 2 - 30;
      const barW = 80;
      const barH = 8;

      for (let i = 0; i < 4; i++) {
        const y = barStartY + i * 16;
        const statName = STAT_NAMES[i]!;

        // Player stat bar (left)
        drawText(ctx, statName, 4, y, pal.colors[3] ?? '#aaaaaa');
        drawBox(ctx, 4, y + 8, barW, barH, pal.colors[0], pal.colors[3] ?? '#666666', 1);
        const pFill = Math.floor(barW * (playerStats[i] ?? 0));
        ctx.fillStyle = '#5b5bd9';
        ctx.fillRect(5, y + 9, pFill, barH - 2);

        // Rival stat bar (right)
        const rx = GAME_W - barW - 4;
        drawText(ctx, statName, rx, y, pal.colors[3] ?? '#aaaaaa');
        drawBox(ctx, rx, y + 8, barW, barH, pal.colors[0], pal.colors[3] ?? '#666666', 1);
        const rFill = Math.floor(barW * (rivalStats[i] ?? 0));
        ctx.fillStyle = '#d95b5b';
        ctx.fillRect(rx + 1, y + 9, rFill, barH - 2);
      }

      // VS text
      drawText(ctx, 'VS', GAME_W / 2 - 8, barStartY + 20, pal.colors[5] ?? '#ffffff', 2);

      // Minigame
      if (phase === 'minigame' || phase === 'result') {
        renderMinigame(ctx, minigame);
      }

      // Stat display phase instruction
      if (phase === 'statDisplay') {
        const remaining = Math.max(0, 3 - statDisplayTimer);
        if (Math.floor(remaining * 3) % 2 === 0) {
          drawText(ctx, 'GET READY...', GAME_W / 2 - 40, GAME_H / 2 + 30, pal.colors[5] ?? '#ffffff', 2);
        }
      }

      // Dialogue on top
      dialogue.render(ctx);
    },
  };
};
