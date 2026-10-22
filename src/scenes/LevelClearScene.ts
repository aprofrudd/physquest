import type { Scene } from '../engine/GameLoop';
import type { Input } from '../engine/Input';
import type { SceneManager } from '../engine/SceneManager';
import { STAT_KEYS, type GameState, type LevelResult } from '../state/GameState';
import { GAME_W, GAME_H } from '../render/DialogueBox';
import { drawText, measureText } from '../render/PixelFont';
import { drawPokemonBox } from '../render/SpriteSheet';
import { PALETTES } from '../render/Palettes';
import { LEVELS } from '../data/levels';
import { LEVEL_DATA } from '../data/sports';
import { sfx } from '../audio/Sfx';
import { announce } from '../ui/announce';
import { HUD_COLORS, STAT_LABEL, drawMeter, roomLabelForStat } from '../systems/BossMinigame';

export type LevelClearChoice = 'next' | 'retry' | 'hub';

type View = 'win' | 'complete' | 'lose';

const INPUT_LOCK = 1; // seconds before the screen reacts, so a mashed A from the bout can't skip it
const SAFE_W = GAME_W - 16; // widest title that keeps clear of the frame
const ARROW_W = measureText('>', 2) + 4; // cursor column at scale 2 plus a 4px gap, as in the pause menu
const MENU_PAD = 12; // menu panel edge to the cursor / labels: 4px border and 8px of air

const CLOSING_LINES = ['YOUR SCIENCE HELD UP.', 'THE ATHLETE PEAKED AT', 'THE RIGHT MOMENT.'];

const MENU: readonly { label: string; choice: LevelClearChoice }[] = [
  { label: 'RETRY SHOWDOWN', choice: 'retry' },
  { label: 'BACK TO HUB', choice: 'hub' },
  { label: 'LEVEL SELECT', choice: 'next' },
];

const WIN_GREEN = '#2a8a3a'; // >= 3:1 on the cream background (large text)
const LOSE_RED = '#a83030';

const pct = (v: number): number => Math.round(Math.max(0, Math.min(1, v)) * 100);

/** Largest scale (up to maxScale) at which the text fits maxW. */
const fitScale = (text: string, maxScale: number, maxW: number): number => {
  for (let scale = maxScale; scale > 1; scale--) {
    if (measureText(text, scale) <= maxW) return scale;
  }
  return 1;
};

/** Word-wrap to maxChars. A word with no letters or digits (a spaced dash) stays with the word before it. */
const wrapLines = (text: string, maxChars: number): string[] => {
  const words: string[] = [];
  for (const word of text.split(' ')) {
    const prev = words.pop();
    if (prev === undefined) words.push(word);
    else if (/[A-Z0-9]/i.test(word)) words.push(prev, word);
    else words.push(`${prev} ${word}`);
  }

  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if (current && current.length + 1 + word.length > maxChars) {
      lines.push(current);
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }
  if (current) lines.push(current);
  return lines;
};

export const createLevelClearScene = (
  input: Input,
  sceneManager: SceneManager,
  gameState: GameState,
  getResult: () => LevelResult | null,
  onContinue: (choice: LevelClearChoice) => void,
): Scene => {
  let timer = 0;
  let menuIndex = 0;
  let result: LevelResult | null = null;
  let view: View = 'win';

  const centred = (
    ctx: CanvasRenderingContext2D,
    text: string,
    y: number,
    color: string,
    scale = 1,
  ) => {
    drawText(ctx, text, Math.round((GAME_W - measureText(text, scale)) / 2), y, color, scale);
  };

  const drawTitle = (
    ctx: CanvasRenderingContext2D,
    text: string,
    y: number,
    maxScale: number,
    color: string,
  ) => {
    const pal = PALETTES.title;
    const scale = fitScale(text, maxScale, SAFE_W);
    const x = Math.round((GAME_W - measureText(text, scale)) / 2);
    drawText(ctx, text, x + 1, y + 1, pal.colors[1], scale); // drop shadow
    drawText(ctx, text, x, y, color, scale);
  };

  const drawStatsPanel = (ctx: CanvasRenderingContext2D, y: number, r: LevelResult | null) => {
    const pal = PALETTES.title;
    const panelX = 16;
    const panelW = GAME_W - 32;
    drawPokemonBox(ctx, panelX, y, panelW, 84, pal.colors[1]);

    for (let i = 0; i < STAT_KEYS.length; i++) {
      const key = STAT_KEYS[i]!;
      const value = r ? r.stats[key] : 0;
      const rowY = y + 12 + i * 18;
      drawText(ctx, STAT_LABEL[key], panelX + 12, rowY, '#080808');
      const barX = 92;
      const color = value > 0.7 ? HUD_COLORS.reached : value > 0.4 ? '#c0a830' : HUD_COLORS.rival;
      drawMeter(ctx, barX, rowY - 2, 100, 11, value, color);
      // Inside the panel: bar ends at 192, value text at 198..222, panel interior ends at 236
      drawText(ctx, `${pct(value)}%`, barX + 100 + 6, rowY, '#080808');
    }
  };

  const drawWin = (ctx: CanvasRenderingContext2D, r: LevelResult) => {
    const pal = PALETTES.title;
    drawTitle(ctx, 'LEVEL CLEAR!', 14, 3, WIN_GREEN);
    const level = LEVELS[r.level];
    if (level) centred(ctx, level.name, 42, pal.colors[1]);
    drawStatsPanel(ctx, 58, r);

    const rival = LEVEL_DATA[r.level]?.rivalName;
    if (rival) centred(ctx, `YOU BEAT ${rival.toUpperCase()}!`, 154, pal.colors[1]);
    centred(ctx, `FINAL SCORE ${pct(r.playerScore)}% VS ${pct(r.rivalScore)}%`, 168, pal.colors[1]);
  };

  const drawComplete = (ctx: CanvasRenderingContext2D, r: LevelResult | null) => {
    const pal = PALETTES.title;
    drawTitle(ctx, 'GAME COMPLETE!', 16, 2, WIN_GREEN);
    if (r) {
      const level = LEVELS[r.level];
      if (level) centred(ctx, level.name, 36, pal.colors[1]);
      drawStatsPanel(ctx, 50, r);
      CLOSING_LINES.forEach((line, i) => centred(ctx, line, 146 + i * 12, i === 0 ? pal.colors[0] : pal.colors[1]));
    } else {
      // Reached from the level select with no bout to report: no stats to show
      centred(ctx, 'ALL 4 SPORTS CLEARED!', 60, pal.colors[1]);
      CLOSING_LINES.forEach((line, i) => centred(ctx, line, 90 + i * 12, i === 0 ? pal.colors[0] : pal.colors[1]));
    }
  };

  const drawLose = (ctx: CanvasRenderingContext2D, r: LevelResult) => {
    const pal = PALETTES.title;
    drawTitle(ctx, 'DEFEATED', 10, 3, LOSE_RED);

    // Diagnosis: was it the science (rating) or the timing?
    drawPokemonBox(ctx, 16, 38, GAME_W - 32, 78, pal.colors[1]);
    const stat = STAT_LABEL[r.focus];
    const room = roomLabelForStat(r.focus);
    const tooLow = r.rating <= r.rivalScore;
    centred(ctx, `FOCUS: ${stat} (${room} ROOM)`, 47, HUD_COLORS.ink);
    centred(ctx, `RATING ${pct(r.rating)}% VS TARGET ${pct(r.rivalScore)}%`, 59, tooLow ? HUD_COLORS.bad : HUD_COLORS.good);
    // Two sentences, each on its own line(s), so a wrap never starts a line with a dash or a stray word
    const advice = tooLow
      ? [`YOUR ${stat} RATING WAS TOO LOW.`, `REPLAY THE ${room} ROOM.`]
      : ['YOUR SCIENCE WAS GOOD ENOUGH.', 'SHARPEN YOUR TIMING!'];
    advice
      .flatMap(sentence => wrapLines(sentence, 34))
      .forEach((line, i) => centred(ctx, line, 77 + i * 11, '#080808'));

    // Menu: a cursor column, a gap, then the labels. The block is centred in a panel sized from the
    // widest label, so nothing touches the border.
    const labelW = Math.max(...MENU.map(m => measureText(m.label, 2)));
    const blockW = ARROW_W + labelW - 2; // -2: the last glyph's trailing gap
    const menuW = blockW + MENU_PAD * 2;
    const menuX = Math.round((GAME_W - menuW) / 2);
    drawPokemonBox(ctx, menuX, 122, menuW, 76, pal.colors[1]);
    const arrowOn = Date.now() % 800 < 560;
    for (let i = 0; i < MENU.length; i++) {
      const item = MENU[i]!;
      const selected = i === menuIndex;
      const y = 133 + i * 20;
      if (selected && arrowOn) drawText(ctx, '>', menuX + MENU_PAD, y, '#080808', 2);
      drawText(ctx, item.label, menuX + MENU_PAD + ARROW_W, y, selected ? '#080808' : '#606060', 2);
    }

    if (timer >= INPUT_LOCK) centred(ctx, 'D-PAD: MOVE   A: CHOOSE', 206, pal.colors[1]);
  };

  const announceView = () => {
    const r = result;
    const level = r ? LEVELS[r.level]?.name ?? '' : '';
    const stats = r
      ? STAT_KEYS.map(k => `${STAT_LABEL[k].toLowerCase()} ${pct(r.stats[k])} percent`).join(', ')
      : '';
    if (view === 'lose' && r) {
      const tooLow = r.rating <= r.rivalScore;
      announce(
        `Defeated. Focus ${STAT_LABEL[r.focus].toLowerCase()}, ${roomLabelForStat(r.focus).toLowerCase()} room. ` +
        `Rating ${pct(r.rating)} percent versus target ${pct(r.rivalScore)} percent. ` +
        (tooLow ? 'Your rating was too low. Replay that room.' : 'Your science was good enough. Sharpen your timing.') +
        ` Menu: ${MENU[menuIndex]?.label.toLowerCase() ?? ''}.`,
      );
    } else if (view === 'complete') {
      announce(`Game complete! ${stats ? `${stats}. ` : ''}Press A to continue.`);
    } else {
      announce(`Level clear! ${level}. ${stats}. Press A to continue.`);
    }
  };

  return {
    onEnter() {
      timer = 0;
      menuIndex = 0;
      result = getResult();
      view = result === null ? 'complete' : result.outcome;
      if (view === 'complete') sfx.play('win'); // the finale earns its own fanfare
      announceView();
    },

    update(dt: number) {
      timer += dt;
      const inp = input.read();
      if (timer < INPUT_LOCK) return;

      const confirm = inp.aPressed || inp.startPressed;

      if (view === 'lose') {
        const step = (inp.downRepeat ? 1 : 0) - (inp.upRepeat ? 1 : 0);
        if (step !== 0) {
          menuIndex = (menuIndex + step + MENU.length) % MENU.length;
          sfx.play('blip');
          announce(MENU[menuIndex]?.label.toLowerCase() ?? '');
        }
        if (confirm) {
          const item = MENU[menuIndex];
          if (item) {
            sfx.play('select');
            onContinue(item.choice);
          }
        }
        return;
      }

      if (confirm) {
        sfx.play('select');
        // With no bout to report (level select redirect after the game is done) 'next' would bounce
        // straight back here, so go to the title instead.
        if (result === null) sceneManager.switchTo('title');
        else onContinue('next');
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

      if (view === 'lose' && result) drawLose(ctx, result);
      else if (view === 'win' && result) drawWin(ctx, result);
      else drawComplete(ctx, result);

      // Continue prompt blinks once the screen is listening
      if (view !== 'lose' && timer >= INPUT_LOCK && Date.now() % 800 < 520) {
        centred(ctx, 'PRESS A TO CONTINUE', GAME_H - 22, pal.colors[0]);
      }
    },
  };
};
