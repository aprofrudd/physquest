import type { Scene } from '../engine/GameLoop';
import type { Input } from '../engine/Input';
import type { SceneManager } from '../engine/SceneManager';
import type { GameState } from '../state/GameState';
import type { DialogueSystem } from '../systems/Dialogue';
import type { PauseMenu } from '../systems/PauseMenu';
import { GAME_W, GAME_H } from '../render/DialogueBox';
import { drawText, measureText } from '../render/PixelFont';
import { drawPokemonBox, drawSprite } from '../render/SpriteSheet';
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

// Draw an angled platform (parallelogram)
const drawPlatform = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  outlineColor: string
) => {
  const skew = 8;
  // Outline
  ctx.fillStyle = outlineColor;
  ctx.beginPath();
  ctx.moveTo(x + skew, y);
  ctx.lineTo(x + w + skew, y);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  ctx.fill();
  // Fill
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x + skew + 1, y + 1);
  ctx.lineTo(x + w + skew - 1, y + 1);
  ctx.lineTo(x + w - 1, y + h - 1);
  ctx.lineTo(x + 1, y + h - 1);
  ctx.closePath();
  ctx.fill();
};

export const createBossBattleScene = (
  input: Input,
  sceneManager: SceneManager,
  gameState: GameState,
  dialogue: DialogueSystem,
  onWin: () => void,
  onLose: () => void,
  pauseMenu: PauseMenu,
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

      // Pause menu
      if (inp.escapePressed && !pauseMenu.isActive()) pauseMenu.toggle();
      if (pauseMenu.isActive()) { pauseMenu.update(dt, inp); return; }

      dialogue.update(dt, inp);

      if (phase === 'statDisplay') {
        statDisplayTimer += dt;
        if (statDisplayTimer > 3) {
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

      // Background — light (GBC style)
      ctx.fillStyle = pal.colors[4];
      ctx.fillRect(0, 0, GAME_W, GAME_H);

      // Arena floor pattern — subtle lines on bottom half
      ctx.fillStyle = pal.colors[3];
      for (let y = GAME_H / 2; y < GAME_H; y += 6) {
        ctx.fillRect(0, y, GAME_W, 1);
      }

      const sport = LEVEL_DATA[gameState.currentLevel];
      if (!sport) return;

      // Event title in bordered panel
      const eventTitle = sport.bossEvent;
      const titleW = measureText(eventTitle, 2);
      const titlePanelW = titleW + 16;
      drawPokemonBox(ctx, (GAME_W - titlePanelW) / 2, 2, titlePanelW, 20);
      drawText(ctx, eventTitle, (GAME_W - titleW) / 2, 8, pal.colors[0], 2);

      // Platforms for each combatant
      const leftX = 16;
      const rightX = GAME_W - 56;
      const athleteY = 30;
      const platY = athleteY + 24;

      // Player platform
      drawPlatform(ctx, leftX - 4, platY, 40, 8, pal.colors[3], pal.colors[1]);
      // Rival platform
      drawPlatform(ctx, rightX - 4, platY, 40, 8, pal.colors[3], pal.colors[1]);

      // Player athlete (left)
      drawSprite(ctx, ATHLETE_SPRITE, leftX, athleteY, SPRITE_COLORS['boss_player']!);

      // Player name panel
      drawPokemonBox(ctx, leftX - 6, athleteY - 16, 50, 14);
      drawText(ctx, 'YOUR ATHLETE', leftX - 2, athleteY - 13, '#080808');

      // Rival athlete (right) — mirrored
      const mirroredSprite = ATHLETE_SPRITE.map(row => [...row].reverse());
      drawSprite(ctx, mirroredSprite, rightX, athleteY, SPRITE_COLORS['boss_rival']!);

      // Rival name panel
      const rivalLabel = sport.rivalName.toUpperCase();
      const rivalLabelW = measureText(rivalLabel);
      drawPokemonBox(ctx, rightX - 6, athleteY - 16, rivalLabelW + 12, 14);
      drawText(ctx, rivalLabel, rightX - 2, athleteY - 13, '#080808');

      // Stat bars in Pokemon-style bordered panels
      const playerStats = getPlayerStats();
      const rivalStats = getRivalStats();
      const barStartY = GAME_H / 2 - 30;
      const barW = 80;
      const barH = 8;

      for (let i = 0; i < 4; i++) {
        const y = barStartY + i * 16;
        const statName = STAT_NAMES[i]!;

        // Player stat panel (left)
        drawText(ctx, statName, 4, y, pal.colors[1]);
        drawPokemonBox(ctx, 4, y + 8, barW, barH + 4, pal.colors[1]);
        const pFill = Math.floor((barW - 8) * (playerStats[i] ?? 0));
        ctx.fillStyle = '#3858a8';
        ctx.fillRect(8, y + 10, pFill, barH - 2);

        // Rival stat panel (right)
        const rx = GAME_W - barW - 4;
        drawText(ctx, statName, rx, y, pal.colors[1]);
        drawPokemonBox(ctx, rx, y + 8, barW, barH + 4, pal.colors[1]);
        const rFill = Math.floor((barW - 8) * (rivalStats[i] ?? 0));
        ctx.fillStyle = '#a83030';
        ctx.fillRect(rx + 4, y + 10, rFill, barH - 2);
      }

      // VS text
      drawText(ctx, 'VS', GAME_W / 2 - 8, barStartY + 20, pal.colors[5], 2);

      // Minigame
      if (phase === 'minigame' || phase === 'result') {
        renderMinigame(ctx, minigame);
      }

      // Stat display phase instruction
      if (phase === 'statDisplay') {
        const remaining = Math.max(0, 3 - statDisplayTimer);
        if (Math.floor(remaining * 3) % 2 === 0) {
          const readyText = 'GET READY...';
          const readyW = measureText(readyText, 2);
          drawText(ctx, readyText, (GAME_W - readyW) / 2, GAME_H / 2 + 30, pal.colors[0], 2);
        }
      }

      // Dialogue on top
      dialogue.render(ctx);

      // Pause overlay
      pauseMenu.render(ctx);
    },
  };
};
