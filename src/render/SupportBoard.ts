// The SUPPORT BOARD in the Director's hub: a small board on the north wall (a bar per support score, with its
// initial) and the full panel the player opens by facing it and pressing A: the four scores, the athlete OVERVIEW,
// the showdown rating against the rival's TARGET and whether the ARENA is open. Also the panel as plain text, for
// screen readers and tests. The wall board allocates nothing per frame.
import { drawText, CHAR_W } from './PixelFont';
import { drawPokemonBox } from './SpriteSheet';
import { GAME_W, GAME_H } from './DialogueBox';
import { BOARD_RECT } from '../data/supportBoard';
import { DIRECTOR_SPEAKER } from '../data/speakers';
import {
  FOCUS_WEIGHT,
  STAT_KEYS,
  allRoomsComplete,
  arenaOpen,
  meetOf,
  roomsCompleted,
  roomsTotal,
  type GameState,
  type StatKey,
} from '../state/GameState';
import {
  SCORE_LABEL,
  SCORE_SHORT,
  levelRating,
  scoreSpoken,
  showdownFocus,
  showdownTarget,
  statRoom,
} from '../systems/SupportScores';

const INK = '#080808';
const DIM = '#606060'; // 5.9:1 on the panel's #f8f8f0
const GOOD = '#1c7c34'; // 4.9:1
const BAD = '#a83030'; // 6.0:1
const FOCUS_INK = '#2858a8'; // 6.3:1
const TRACK = '#d8d8c8';
const SCORE_COLOR: Readonly<Record<StatKey, string>> = {
  speed: '#d03030',
  strength: '#d88020',
  endurance: '#30a040',
  power: '#3868b8',
};

const pct = (v: number): number => Math.max(0, Math.min(100, Math.round(v * 100)));
const textWidth = (text: string): number => text.length * CHAR_W - 1;

/** The score a room has recorded, or null while that room is not done this level. */
export const scoreOf = (state: GameState, stat: StatKey): number | null =>
  state.roomProgress[statRoom(stat)] ? state.playerStats[stat] : null;

/** The score as the board writes it: "85%", or "--" before its room is done. */
export const scoreText = (state: GameState, stat: StatKey): string => {
  const v = scoreOf(state, stat);
  return v === null ? '--' : `${pct(v)}%`;
};

/** The athlete overview as the board writes it: "4/5", "DONE" (an older save) or "--". */
export const overviewText = (state: GameState): string => {
  const meet = meetOf(state);
  if (!meet.met) return '--';
  return meet.of ? `${meet.best}/${meet.of}` : 'DONE';
};

/** The ARENA's line: open, waiting on the Director's last check-in, or locked with the rooms still to do. */
export const arenaText = (state: GameState): string => {
  if (arenaOpen(state)) return 'ARENA: OPEN';
  if (allRoomsComplete(state)) return `ARENA: TALK TO ${DIRECTOR_SPEAKER.name.toUpperCase()}`;
  return `ARENA: LOCKED (${roomsCompleted(state)}/${roomsTotal(state)} ROOMS)`;
};

/** How the rating is made, e.g. "70% TRAINING PLAN + 30% ALL FOUR". */
export const ratingRule = (level: number): string =>
  `${Math.round(FOCUS_WEIGHT * 100)}% ${SCORE_LABEL[showdownFocus(level)]} + ${Math.round((1 - FOCUS_WEIGHT) * 100)}% ALL FOUR`;

/** The board as plain lines (what the panel shows, top to bottom). `note` is the content's line under the title. */
export const boardLines = (state: GameState, note: string): string[] => {
  const level = state.currentLevel;
  return [
    'SUPPORT BOARD',
    note,
    ...STAT_KEYS.map(k => `${SCORE_LABEL[k]} ${scoreText(state, k)}`),
    `ATHLETE OVERVIEW ${overviewText(state)}`,
    `SHOWDOWN RATING ${pct(levelRating(state))}%`,
    `RIVAL TARGET ${pct(showdownTarget(level))}%`,
    ratingRule(level),
    arenaText(state),
  ];
};

/** The panel for the screen-reader live region: `note` as spoken; `closeName` is the player's name for the A button. */
export const boardSummary = (state: GameState, note: string, closeName = 'A'): string => {
  const level = state.currentLevel;
  const focus = showdownFocus(level);
  const scores = STAT_KEYS.map(k => {
    const v = scoreOf(state, k);
    const name = scoreSpoken(k);
    return `${name.charAt(0).toUpperCase()}${name.slice(1)}, ${v === null ? 'not yet' : `${pct(v)} percent`}`;
  }).join('. ');
  const meet = meetOf(state);
  const overview = meet.met ? (meet.of ? `${meet.best} of ${meet.of}` : 'done') : 'not yet';
  const arena = arenaText(state).replace('ARENA: ', '').toLowerCase().replace(/ \((\d+)\/(\d+) rooms\)/, ', $1 of $2 rooms done');
  const sentence = /[.!?]$/.test(note) ? note : `${note}.`;
  return (
    `Support board. ${sentence} ${scores}. Athlete overview, ${overview}. ` +
    `Showdown rating ${pct(levelRating(state))} percent: ${Math.round(FOCUS_WEIGHT * 100)} percent ${scoreSpoken(focus)}, ` +
    `${Math.round((1 - FOCUS_WEIGHT) * 100)} percent all four. Rival target ${pct(showdownTarget(level))} percent. ` +
    `Arena ${arena}. ${closeName} closes.`
  );
};

/**
 * The small board on the wall: a white board with, for each score, its initial and a bar that fills as the score
 * rises (an empty track before its room is done). Read it in full on the panel.
 */
export const drawWallBoard = (ctx: CanvasRenderingContext2D, state: GameState) => {
  const { x, y, w, h } = BOARD_RECT;
  ctx.fillStyle = '#3a3020'; // frame
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#f8f8f0';
  ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  const barTop = y + 2;
  const barH = h - 4;
  for (let i = 0; i < STAT_KEYS.length; i++) {
    const key = STAT_KEYS[i]!;
    const cx = x + 2 + i * 11;
    drawText(ctx, SCORE_SHORT[key].charAt(0), cx, y + 4, INK);
    ctx.fillStyle = TRACK;
    ctx.fillRect(cx + 6, barTop, 3, barH);
    const v = scoreOf(state, key);
    const fill = v === null ? 0 : Math.round(barH * Math.max(0, Math.min(1, v)));
    if (fill > 0) {
      ctx.fillStyle = SCORE_COLOR[key];
      ctx.fillRect(cx + 6, barTop + barH - fill, 3, fill);
    }
  }
};

/** The full board. `note` is the content's line under the title; `footer` the close hint in the player's buttons. */
export const drawBoardPanel = (ctx: CanvasRenderingContext2D, state: GameState, note: string, footer: string) => {
  const level = state.currentLevel;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(0, 0, GAME_W, GAME_H);
  drawPokemonBox(ctx, 8, 8, GAME_W - 16, GAME_H - 16);

  const left = 20;
  const right = GAME_W - 20;
  const divider = (y: number) => {
    ctx.fillStyle = '#a0a0a0';
    ctx.fillRect(left, y, right - left, 1);
  };
  const rightText = (text: string, y: number, color: string) => drawText(ctx, text, right - textWidth(text), y, color);

  drawText(ctx, 'SUPPORT BOARD', left, 16, INK, 2);
  drawText(ctx, note, left, 34, DIM);
  divider(45);

  // The four scores: name, bar, value. The focus score is drawn in blue with a star (it is 70% of the rating).
  const focus = showdownFocus(level);
  const barX = left + 84; // the longest name, TRAINING PLAN, ends at x = 97
  const barW = 96;
  for (let i = 0; i < STAT_KEYS.length; i++) {
    const key = STAT_KEYS[i]!;
    const y = 52 + i * 13;
    const isFocus = key === focus;
    drawText(ctx, SCORE_LABEL[key], left, y, isFocus ? FOCUS_INK : INK);
    if (isFocus) drawText(ctx, '*', left + textWidth(SCORE_LABEL[key]) + 3, y, FOCUS_INK);
    ctx.fillStyle = INK;
    ctx.fillRect(barX + 6, y - 1, barW - 6, 9);
    ctx.fillStyle = TRACK;
    ctx.fillRect(barX + 7, y, barW - 8, 7);
    const v = scoreOf(state, key);
    const fill = v === null ? 0 : Math.round((barW - 8) * Math.max(0, Math.min(1, v)));
    if (fill > 0) {
      ctx.fillStyle = SCORE_COLOR[key];
      ctx.fillRect(barX + 7, y, fill, 7);
    }
    const text = scoreText(state, key);
    rightText(text, y, v === null ? DIM : INK);
  }
  drawText(ctx, 'ATHLETE OVERVIEW', left, 104, INK);
  rightText(overviewText(state), 104, meetOf(state).met ? INK : DIM);
  divider(116);

  const rating = levelRating(state);
  const target = showdownTarget(level);
  drawText(ctx, 'SHOWDOWN RATING', left, 122, INK);
  rightText(`${pct(rating)}%`, 122, rating > target ? GOOD : BAD);
  drawText(ctx, 'RIVAL TARGET', left, 134, INK);
  rightText(`${pct(target)}%`, 134, INK);
  drawText(ctx, `*${ratingRule(level)}`, left, 146, FOCUS_INK);
  const arena = arenaText(state);
  drawText(ctx, arena, left, 160, arenaOpen(state) ? GOOD : INK);
  divider(176);

  drawText(ctx, footer, Math.round((GAME_W - textWidth(footer)) / 2), 192, DIM);
};
