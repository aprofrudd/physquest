import type { Scene } from '../engine/GameLoop';
import type { Input } from '../engine/Input';
import type { SceneManager } from '../engine/SceneManager';
import { STAT_KEYS, showdownRating, type BoutResult, type GameState, type StatKey } from '../state/GameState';
import type { DialogueSystem } from '../systems/Dialogue';
import type { PauseMenu } from '../systems/PauseMenu';
import { GAME_W, GAME_H } from '../render/DialogueBox';
import { CHAR_W, drawText, measureText } from '../render/PixelFont';
import { drawPokemonBox, drawSprite } from '../render/SpriteSheet';
import { PALETTES } from '../render/Palettes';
import { LEVEL_DATA } from '../data/sports';
import { ATHLETE_SPRITE, SPRITE_COLORS } from '../data/sprites';
import { sfx } from '../audio/Sfx';
import { announce } from '../ui/announce';
import {
  HUD_COLORS,
  MINIGAME_FOR_STAT,
  MINIGAME_PROMPT,
  STAT_LABEL,
  createMinigameState,
  drawMeter,
  renderMinigame,
  rivalFinalScore,
  roomLabelForStat,
  updateMinigame,
  type MinigameState,
  type MinigameType,
} from '../systems/BossMinigame';

type BossPhase = 'intro' | 'statDisplay' | 'precheck' | 'countdown' | 'minigame' | 'result';

// Mirrored once, not every frame
const RIVAL_SPRITE = ATHLETE_SPRITE.map(row => [...row].reverse());

const STAT_DISPLAY_TIME = 3.2; // seconds the stat comparison stays up
const STAT_SKIP_AFTER = 1; // A can skip the rest after this long
const COUNT_STEP = 0.7; // seconds per 3 / 2 / 1 / GO
const RESULT_SFX_DELAY = 0.25; // lets the last hit sound finish before the jingle
const RESULT_DELAY = 1.5; // game seconds between the end of the minigame and the result dialogue

// Layout (game pixels). Everything stays above the dialogue box at y = 164.
const TITLE_Y = 2;
const TITLE_H = 24;
const NAME_Y = 29;
const NAME_H = 17;
const ATHLETE_Y = 47;
const PLAYER_CX = 46; // athletes are centred on these columns
const RIVAL_CX = 210;
const FOCUS_LINE_Y = 80;
const RATING_LINE_Y = FOCUS_LINE_Y + 11; // 7px of text plus a 4px gap
const ROW_Y0 = 101;
const ROW_PITCH = 15; // rows are 13px tall; the last one ends at y = 158, 5px above the dialogue box
const ROW_H = 13;
const BAR_W = 80; // leaves room in the centre column for the longest label and its stars
const BAR_X_PLAYER = 8;
const BAR_X_RIVAL = GAME_W - 8 - BAR_W;
const PANEL_PAD = 12; // name panels are their text plus 4px border and 2px air on each side
const RIVAL_PANEL_MAX_W = 112; // keeps clear of the player's panel and the centre column

const FOCUS_BAND = '#fbe9a6';
const FOCUS_BAND_EDGE = '#b8860b';
const FOCUS_ICON = '#8a5a00';
const LABEL_MUTED = '#5a4a7a';

const STAR = [
  '...#...',
  '..###..',
  '#######',
  '.#####.',
  '..###..',
  '.##.##.',
  '.#...#.',
];

const drawStar = (ctx: CanvasRenderingContext2D, x: number, y: number, color: string) => {
  ctx.fillStyle = color;
  for (let row = 0; row < STAR.length; row++) {
    const line = STAR[row]!;
    for (let col = 0; col < line.length; col++) {
      if (line[col] === '#') ctx.fillRect(x + col, y + row, 1, 1);
    }
  }
};

// Angled platform (parallelogram) centred on cx
const drawPlatform = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  y: number,
  w: number,
  h: number,
  color: string,
  outlineColor: string,
) => {
  const skew = 8;
  const x = Math.round(cx - (w + skew) / 2);
  ctx.fillStyle = outlineColor;
  ctx.beginPath();
  ctx.moveTo(x + skew, y);
  ctx.lineTo(x + w + skew, y);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x + skew + 1, y + 1);
  ctx.lineTo(x + w + skew - 1, y + 1);
  ctx.lineTo(x + w - 1, y + h - 1);
  ctx.lineTo(x + 1, y + h - 1);
  ctx.closePath();
  ctx.fill();
};

const pct = (v: number): number => Math.round(Math.max(0, Math.min(1, v)) * 100);

/** Name for a panel: the full name, or just the surname if it would crowd the other panel. */
const panelName = (name: string, maxW: number): string => {
  const full = name.toUpperCase();
  if (measureText(full) + PANEL_PAD <= maxW) return full;
  const surname = full.split(' ').pop() ?? full;
  return surname.slice(0, Math.floor((maxW - PANEL_PAD) / CHAR_W));
};

// Rival ceilings scale with the level; strength and power get a small bonus
const rivalCeilingFor = (level: number, stat: StatKey): number => {
  const base = 0.4 + level * 0.1;
  return stat === 'strength' || stat === 'power' ? base + 0.05 : base;
};

interface Setup {
  rivalName: string;
  rivalTaunt: string;
  rivalLoseLine: string;
  event: string;
  focus: StatKey;
  type: MinigameType;
  room: string; // hub sign of the room that trains the focus stat
  rating: number; // player's showdown rating
  rivalCeiling: number;
  target: number; // rival's final minigame score
  rivalStats: number[]; // per STAT_KEYS, for the comparison rows
}

export const createBossBattleScene = (
  input: Input,
  sceneManager: SceneManager,
  gameState: GameState,
  dialogue: DialogueSystem,
  onResult: (result: BoutResult) => void,
  pauseMenu: PauseMenu,
): Scene => {
  let phase: BossPhase = 'intro';
  let setup: Setup | null = null;
  let minigame: MinigameState | null = null;
  let statTimer = 0;
  let stepTimer = 0;
  let lastStep = -1;
  let goTimer = 0;
  let resultTimer = 0;
  let resultSfxPlayed = false;
  let resultShown = false;

  const buildSetup = (): Setup | null => {
    const sport = LEVEL_DATA[gameState.currentLevel];
    if (!sport) return null;
    const focus = sport.bossStat;
    const type = MINIGAME_FOR_STAT[focus];
    const rivalCeiling = rivalCeilingFor(gameState.currentLevel, focus);
    return {
      rivalName: sport.rivalName,
      rivalTaunt: sport.rivalTaunt,
      rivalLoseLine: sport.rivalLoseLine,
      event: sport.bossEvent,
      focus,
      type,
      room: roomLabelForStat(focus),
      rating: showdownRating(gameState.playerStats, focus),
      rivalCeiling,
      target: rivalFinalScore(type, rivalCeiling),
      rivalStats: STAT_KEYS.map(k => rivalCeilingFor(gameState.currentLevel, k)),
    };
  };

  const focusLine = (s: Setup): string => `FOCUS: ${STAT_LABEL[s.focus]} (${s.room} ROOM)`;
  const ratingLine = (s: Setup): string => `RATING ${pct(s.rating)}% VS TARGET ${pct(s.target)}%`;

  const startCountdown = (s: Setup) => {
    phase = 'countdown';
    stepTimer = 0;
    lastStep = -1;
    goTimer = 0;
    minigame = createMinigameState(s.type, s.rating, s.rivalCeiling);
    announce(`Get ready. ${MINIGAME_PROMPT[s.type].replace('!', '')}`);
  };

  const leaveToHub = () => {
    gameState.returnDoor = 'boss';
    dialogue.reset();
    sceneManager.switchTo('overworld');
  };

  // The coach warns when even perfect play can't beat the rival
  const afterStatDisplay = (s: Setup) => {
    if (s.rating > s.target) {
      startCountdown(s);
      return;
    }
    phase = 'precheck';
    const rival = s.rivalName.toUpperCase();
    dialogue.show(
      `YOUR ${STAT_LABEL[s.focus]} RATING (${pct(s.rating)}%) CAN'T BEAT ${rival}'S ${pct(s.target)}%. REPLAY THE ${s.room} ROOM TO RAISE IT.`,
      ['BACK TO HUB', 'FIGHT ANYWAY'],
      (choice) => {
        if (choice === 1) startCountdown(s);
        else leaveToHub(); // also the safe default if nothing was chosen
      },
    );
  };

  const showResult = (s: Setup, mg: MinigameState) => {
    const won = mg.won;
    const text = won
      ? `${s.rivalName}: "${s.rivalLoseLine}"`
      : 'Better data next time, Coach. The margins matter.';
    dialogue.show(text, undefined, () => {
      onResult({
        won,
        focus: s.focus,
        rating: s.rating,
        rivalRating: s.rivalCeiling,
        playerScore: mg.playerScore,
        rivalScore: mg.rivalScore,
      });
    });
  };

  // Header (focus + rating) and the comparison rows. While the coach's warning is up its choice box
  // covers the lower right, so then only the focus row is shown, high enough to stay clear of it.
  const drawStatRows = (ctx: CanvasRenderingContext2D, s: Setup, focusOnly: boolean) => {
    const pal = PALETTES.boss;
    const pulse = Math.floor(Date.now() / 350) % 2 === 0;

    const focusText = focusLine(s);
    drawText(ctx, focusText, Math.round((GAME_W - measureText(focusText)) / 2), FOCUS_LINE_Y, HUD_COLORS.ink);
    const ratingText = ratingLine(s);
    drawText(
      ctx,
      ratingText,
      Math.round((GAME_W - measureText(ratingText)) / 2),
      RATING_LINE_Y,
      s.rating > s.target ? HUD_COLORS.good : HUD_COLORS.bad,
    );

    let slot = 0;
    for (let i = 0; i < STAT_KEYS.length; i++) {
      const key = STAT_KEYS[i]!;
      const isFocus = key === s.focus;
      if (focusOnly && !isFocus) continue;
      const y0 = ROW_Y0 + slot * ROW_PITCH;
      slot++;
      const label = STAT_LABEL[key];
      const labelW = measureText(label);
      const labelX = Math.round((GAME_W - labelW) / 2);

      if (isFocus) {
        ctx.fillStyle = FOCUS_BAND_EDGE;
        ctx.fillRect(4, y0, GAME_W - 8, ROW_H);
        ctx.fillStyle = FOCUS_BAND;
        ctx.fillRect(5, y0 + 1, GAME_W - 10, ROW_H - 2);
        const starColor = pulse ? FOCUS_ICON : pal.colors[5];
        drawStar(ctx, labelX - 10, y0 + 3, starColor);
        drawStar(ctx, labelX + labelW + 3, y0 + 3, starColor);
      }

      drawMeter(ctx, BAR_X_PLAYER, y0 + 2, BAR_W, 9, gameState.playerStats[key], HUD_COLORS.player);
      drawMeter(ctx, BAR_X_RIVAL, y0 + 2, BAR_W, 9, s.rivalStats[i] ?? 0, HUD_COLORS.rival);
      drawText(ctx, label, labelX, y0 + 3, isFocus ? HUD_COLORS.ink : LABEL_MUTED);
    }
  };

  const drawArena = (ctx: CanvasRenderingContext2D, s: Setup) => {
    const pal = PALETTES.boss;

    // Event title: scale 2 text at y = 7 inside a 24px panel (scale 1 only if the name is very long)
    const titleScale = measureText(s.event, 2) + 16 <= GAME_W - 8 ? 2 : 1;
    const titleW = measureText(s.event, titleScale);
    const titlePanelW = titleW + 16;
    drawPokemonBox(ctx, Math.round((GAME_W - titlePanelW) / 2), TITLE_Y, titlePanelW, TITLE_H);
    drawText(ctx, s.event, Math.round((GAME_W - titleW) / 2), titleScale === 2 ? 7 : 10, pal.colors[0], titleScale);

    // Name panels sized from their text; the rival's is right-aligned to x = 252
    const playerLabel = 'YOUR ATHLETE';
    const playerPanelW = measureText(playerLabel) + PANEL_PAD;
    drawPokemonBox(ctx, 4, NAME_Y, playerPanelW, NAME_H);
    drawText(ctx, playerLabel, 4 + PANEL_PAD / 2, NAME_Y + 5, '#080808');

    const rivalLabel = panelName(s.rivalName, RIVAL_PANEL_MAX_W);
    const rivalPanelW = measureText(rivalLabel) + PANEL_PAD;
    const rivalPanelX = GAME_W - 4 - rivalPanelW;
    drawPokemonBox(ctx, rivalPanelX, NAME_Y, rivalPanelW, NAME_H);
    drawText(ctx, rivalLabel, rivalPanelX + PANEL_PAD / 2, NAME_Y + 5, '#080808');

    // Athletes on their platforms: they dip during the bout; afterwards the loser slumps, the winner bounces
    const tick = Math.floor(Date.now() / 250) % 2;
    let playerDrop = 0;
    let rivalDrop = 0;
    if (phase === 'minigame') {
      playerDrop = tick;
      rivalDrop = 1 - tick;
    } else if (phase === 'result' && minigame) {
      playerDrop = minigame.won ? tick : 3;
      rivalDrop = minigame.won ? 3 : tick;
    }
    const platY = ATHLETE_Y + 23;
    drawPlatform(ctx, PLAYER_CX, platY, 40, 6, pal.colors[3], pal.colors[1]);
    drawPlatform(ctx, RIVAL_CX, platY, 40, 6, pal.colors[3], pal.colors[1]);
    // The 32px sprite's figure spans columns 5..24 (7..26 mirrored): offset so it is centred on its column
    drawSprite(ctx, ATHLETE_SPRITE, PLAYER_CX - 15, ATHLETE_Y + playerDrop, SPRITE_COLORS['boss_player']!);
    drawSprite(ctx, RIVAL_SPRITE, RIVAL_CX - 16, ATHLETE_Y + rivalDrop, SPRITE_COLORS['boss_rival']!);
  };

  const drawCentre = (ctx: CanvasRenderingContext2D) => {
    // VS between the athletes; the countdown takes its place
    let text = 'VS';
    let scale = 2;
    let color: string = PALETTES.boss.colors[5];
    if (phase === 'countdown') {
      const step = Math.min(2, Math.floor(stepTimer / COUNT_STEP));
      text = String(3 - step);
      scale = stepTimer - step * COUNT_STEP < 0.12 ? 4 : 3;
      color = HUD_COLORS.ink;
    } else if (phase === 'minigame' && goTimer < COUNT_STEP) {
      text = 'GO!';
      scale = goTimer < 0.12 ? 4 : 3;
      color = HUD_COLORS.good;
    }
    const w = measureText(text, scale);
    const y = ATHLETE_Y + 12 - Math.round((7 * scale) / 2);
    drawText(ctx, text, Math.round((GAME_W - w) / 2), y, color, scale);
  };

  return {
    onEnter() {
      phase = 'intro';
      minigame = null;
      statTimer = 0;
      stepTimer = 0;
      lastStep = -1;
      goTimer = 0;
      resultTimer = 0;
      resultSfxPlayed = false;
      resultShown = false;

      setup = buildSetup();
      const s = setup;
      if (!s) {
        // No such level (corrupt state): don't strand the player on an empty arena
        sceneManager.switchTo('levelSelect');
        return;
      }

      dialogue.show(`${s.rivalName}: "${s.rivalTaunt}"`, undefined, () => {
        phase = 'statDisplay';
        statTimer = 0;
        announce(`${focusLine(s)}. ${ratingLine(s)}.`);
      });
    },

    update(dt: number) {
      const inp = input.read();

      if (pauseMenu.handle(dt, inp)) return;

      dialogue.update(dt, inp);
      // A dialogue choice may have left the scene (back to the hub)
      if (sceneManager.getCurrentId() !== 'bossBattle') return;

      const s = setup;
      if (!s) return;

      switch (phase) {
        case 'statDisplay':
          statTimer += dt;
          if (statTimer >= STAT_DISPLAY_TIME || (statTimer >= STAT_SKIP_AFTER && inp.aPressed)) {
            afterStatDisplay(s);
          }
          break;

        case 'countdown': {
          stepTimer += dt;
          const step = Math.floor(stepTimer / COUNT_STEP);
          if (step < 3) {
            if (step !== lastStep) {
              lastStep = step;
              sfx.play('blip');
            }
          } else {
            phase = 'minigame';
            goTimer = 0;
            sfx.play('select');
            announce('Go!');
          }
          break;
        }

        case 'minigame': {
          const mg = minigame;
          if (!mg) break;
          goTimer += dt;
          updateMinigame(mg, dt, inp);
          if (mg.complete) {
            phase = 'result';
            resultTimer = 0;
            announce(mg.won ? 'You win!' : 'You lose.');
          }
          break;
        }

        case 'result': {
          const mg = minigame;
          if (!mg) break;
          resultTimer += dt;
          if (!resultSfxPlayed && resultTimer >= RESULT_SFX_DELAY) {
            resultSfxPlayed = true;
            sfx.play(mg.won ? 'win' : 'lose');
          }
          if (!resultShown && resultTimer >= RESULT_DELAY) {
            resultShown = true;
            showResult(s, mg);
          }
          break;
        }

        default:
          break;
      }
    },

    render(ctx: CanvasRenderingContext2D) {
      const pal = PALETTES.boss;

      // Background — light (GBC style) with a faint arena floor (light enough that text over it stays >= 4.5:1)
      ctx.fillStyle = pal.colors[4];
      ctx.fillRect(0, 0, GAME_W, GAME_H);
      ctx.fillStyle = '#ddd2ee';
      for (let y = GAME_H / 2; y < GAME_H; y += 6) {
        ctx.fillRect(0, y, GAME_W, 1);
      }

      const s = setup;
      if (s) {
        drawArena(ctx, s);
        drawCentre(ctx);
        if (phase === 'intro' || phase === 'statDisplay' || phase === 'precheck') {
          drawStatRows(ctx, s, phase === 'precheck');
        } else if (minigame) {
          renderMinigame(ctx, minigame);
        }
      }

      // Dialogue and pause on top
      dialogue.render(ctx);
      pauseMenu.render(ctx);
    },
  };
};
