// The review board: the panel the ruler sits on, and the pieces around it (title, labels, the block's week strip,
// the live readout and its chips, the retest's bracket, the verdict stamp and the final report). Pure drawing: the
// instrument decides what to show and when.
import { drawText, measureText } from '../../render/PixelFont';
import { drawSprite } from '../../render/SpriteSheet';
import { AISHA_SPRITE_COLORS, RUN_SPRITES } from '../testing/people';
import { PALETTES } from '../../render/Palettes';
import { COLORS, STAGE, clamp01, drawChip, drawCentred, drawCross, drawPanel, drawTick, chipWidth } from '../frame';
import { BAD, GOOD, INK, PIN, SOFT, drawBracket, xOf, type RulerGeometry } from './ruler';
import type { Scale } from './model';

/** Where the first row's ruler sits. */
export const GEOMETRY: RulerGeometry = { x0: 24, x1: 232, axisY: 90, half: 6 };

/**
 * The second row's ruler: as wide as the first, four pixels lower. Above it sit the first row's summary, the divider,
 * the heading and the legend, ten pixels apart; its numbers still end above the verdict list (which starts at y 115).
 */
export const GEOMETRY_2: RulerGeometry = { ...GEOMETRY, axisY: 94 };

/**
 * Text rows (each seven pixels tall; the panel's paper starts at y 42, so the first line is two pixels clear of it).
 * The first row's heading and legend; the second row's summary, divider, heading and legend; the report's divider and first item.
 */
export const FIRST_ROW = { title: 44, legend: 55 } as const;
export const SECOND_ROW = { summary: 44, divider: 54, title: 64, legend: 74 } as const;
export const REPORT_ROW = { divider: 44, first: 57 } as const;

/**
 * How high above its axis the retest dot starts its fall, on each row: just under the last words above that ruler
 * (the legend on the first row, the heading on the second), so the falling dot never crosses any text.
 */
export const FALL = 22;
export const FALL_2 = 16;

/** Text starts here and must stop before RIGHT (the panel's 4px border and 4px of paper clear). */
export const LEFT = 12;
export const RIGHT = 244;
/** A tick or cross in the left margin hangs 2px in from the border, and the text beside it starts here: the longest line (YOU SAID: REAL BUT TOO SMALL TO MATTER) ends 2px clear of the other border. */
export const ICON_X = 10;
export const BESIDE_ICON = 19;

export const PANEL_H = 122; // y 38-160: the dialogue box starts at 164
const PAPER = '#f8f8f0';
const GREY = '#909090';
const NAVY_INK = '#1b3a5c';
const GHOST_INK = '#606060';
const DIM_INK = '#707070'; // the words on a chip that is not lit

const width = (text: string): number => measureText(text) - 1;

/** The panel everything sits on, in the room's own dark wood. */
export const drawBoardPanel = (ctx: CanvasRenderingContext2D) => drawPanel(ctx, STAGE.x, STAGE.y, STAGE.w, PANEL_H, PALETTES.office.colors[1]);

/** The row's heading at the left and BETTER → at the right (the ruler always runs worse to better). */
export const drawTitleRow = (ctx: CanvasRenderingContext2D, title: string, y: number) => {
  drawText(ctx, title, LEFT, y, INK);
  const better = 'BETTER →';
  drawText(ctx, better, RIGHT - width(better), y, SOFT);
};

/** BASELINE over the pole, in the pole's navy. */
export const drawBaselineLabel = (ctx: CanvasRenderingContext2D, cx: number) =>
  drawText(ctx, 'BASELINE', Math.round(cx - width('BASELINE') / 2), GEOMETRY.axisY - 22, NAVY_INK);

/** LAST BLOCKS over the earlier blocks' ticks, in their grey, starting at x. */
export const drawGhostLabel = (ctx: CanvasRenderingContext2D, x: number) => drawText(ctx, 'LAST BLOCKS', x, GEOMETRY.axisY - 22, GHOST_INK);

/** A one-line summary of a finished row with its tick or cross: LAST 400 M: 62 → 60 S ✓ */
export const drawSummaryLine = (ctx: CanvasRenderingContext2D, text: string, right: boolean, y: number) => {
  drawText(ctx, text, LEFT, y, INK);
  const at = LEFT + width(text) + 6;
  if (right) drawTick(ctx, at, y);
  else drawCross(ctx, at, y);
};

/** A thin rule with a word in the middle of it (FROM THE DATA ROOM). */
export const drawDivider = (ctx: CanvasRenderingContext2D, label: string, y: number) => {
  ctx.fillStyle = GREY;
  ctx.fillRect(LEFT, y + 3, RIGHT - LEFT, 1);
  const w = width(label) + 8;
  const x = Math.round(128 - w / 2);
  ctx.fillStyle = PAPER;
  ctx.fillRect(x, y, w, 7);
  drawText(ctx, label, x + 4, y, SOFT);
};

// ---- the forecast: readout and chips ------------------------------------------------------------------------------

/** FORECAST 60.4 S (1.6 BETTER) in the pin's blue, centred under the ruler. */
export const drawReadout = (ctx: CanvasRenderingContext2D, text: string, y: number) => drawCentred(ctx, text, 128, y, PIN);

/** The empty tick box on a chip that is not lit. */
const drawBox = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
  ctx.fillStyle = GREY;
  ctx.fillRect(x, y, 5, 1);
  ctx.fillRect(x, y + 4, 5, 1);
  ctx.fillRect(x, y + 1, 1, 3);
  ctx.fillRect(x + 4, y + 1, 1, 3);
};

const CHIP_GAP = 8;
// Two spaces in front of each word leave room for the tick when a chip is lit
const CHIP_A = '  BEYOND NOISE';
const CHIP_B = '  WORTHWHILE';
const CHIPS_W = chipWidth(CHIP_A) + CHIP_GAP + chipWidth(CHIP_B);
const CHIP_A_X = Math.round(128 - CHIPS_W / 2);
const CHIP_B_X = CHIP_A_X + chipWidth(CHIP_A) + CHIP_GAP;

/**
 * The two chips that light as the pin passes the noise band and the worthwhile line. Lit chips are filled and carry a
 * tick, so the state shows without colour; unlit ones are empty outlines.
 */
export const drawChips = (ctx: CanvasRenderingContext2D, y: number, beyondNoise: boolean, worthwhile: boolean) => {
  const a = CHIP_A;
  const b = CHIP_B;
  const xa = CHIP_A_X;
  const xb = CHIP_B_X;
  if (beyondNoise) {
    drawChip(ctx, xa, y, a, PAPER, PIN, INK);
    drawTick(ctx, xa + 3, y + 2, PAPER);
  } else {
    drawChip(ctx, xa, y, a, DIM_INK, PAPER, GREY);
    drawBox(ctx, xa + 4, y + 3);
  }
  if (worthwhile) {
    drawChip(ctx, xb, y, b, INK, COLORS.gold, INK);
    drawTick(ctx, xb + 3, y + 2, INK);
  } else {
    drawChip(ctx, xb, y, b, DIM_INK, PAPER, GREY);
    drawBox(ctx, xb + 4, y + 3);
  }
};

// ---- the block: a strip of equal week cells with the athlete jogging to the retest flag ---------------------------------

const STRIP = { x: 14, y: 131, cell: 20, pitch: 21 } as const;

/** The strip, the jogging athlete and the RETEST flag. `done` weeks are filled; `progress` (0-1) is how far the athlete has run. */
export const drawBlock = (ctx: CanvasRenderingContext2D, weeks: number, done: number, progress: number, t: number, justFilled: boolean) => {
  const end = STRIP.x + weeks * STRIP.pitch - 1;
  for (let i = 0; i < weeks; i++) {
    const x = STRIP.x + i * STRIP.pitch;
    const filled = i < done;
    ctx.fillStyle = filled ? COLORS.inkSoft : GREY;
    ctx.fillRect(x, STRIP.y, STRIP.cell, 10);
    ctx.fillStyle = filled ? (justFilled && i === done - 1 ? COLORS.gold : COLORS.inkSoft) : PAPER;
    ctx.fillRect(x + 1, STRIP.y + 1, STRIP.cell - 2, 8);
  }
  // the athlete, side on, running along the top of the strip
  const runner = RUN_SPRITES[Math.floor(t * 8) % RUN_SPRITES.length] ?? [];
  const x = Math.round(STRIP.x + clamp01(progress) * (end - STRIP.x - 14));
  drawSprite(ctx, runner, x, STRIP.y - 17, AISHA_SPRITE_COLORS);
  // the RETEST flag on its pole at the end of the strip
  ctx.fillStyle = INK;
  ctx.fillRect(end + 6, STRIP.y - 17, 2, 28);
  ctx.fillStyle = BAD;
  ctx.fillRect(end + 8, STRIP.y - 17, 8, 5);
  const label = 'RETEST';
  drawText(ctx, label, RIGHT - width(label), STRIP.y + 14, INK);
};

const weekLabels: string[] = [];

/** WEEK 3 under the strip. The words are made once for each week, not for each frame. */
export const drawWeekLabel = (ctx: CanvasRenderingContext2D, week: number) => {
  const label = (weekLabels[week] ??= `WEEK ${week}`);
  drawCentred(ctx, label, 128, STRIP.y + 14, INK);
};

// ---- the retest: the gap between forecast and result --------------------------------------------------------------

/** The bracket from the pin to the dot, and what it says: OFF BY 0.4 with INSIDE or OUTSIDE THE ERROR BARS. */
export const drawGap = (ctx: CanvasRenderingContext2D, g: RulerGeometry, scale: Scale, forecast: number, actual: number, off: string, inside: boolean, y: number) => {
  const xa = xOf(g, scale, forecast);
  const xb = xOf(g, scale, actual);
  drawBracket(ctx, xa, xb, y);
  // two lines under the bracket, centred on it but kept inside the panel
  const verdict = inside ? 'INSIDE THE ERROR BARS' : 'OUTSIDE THE ERROR BARS';
  const total = 10 + width(verdict); // the tick or cross, a gap, the words
  const cx = Math.max(LEFT + total / 2, Math.min(RIGHT - total / 2, (xa + xb) / 2));
  drawCentred(ctx, off, Math.round(cx), y + 5, INK);
  const x = Math.round(cx - total / 2);
  if (inside) drawTick(ctx, x, y + 15);
  else drawCross(ctx, x, y + 15);
  drawText(ctx, verdict, x + 10, y + 15, inside ? GOOD : BAD);
};

// ---- the verdict: what the player said, and what was true ---------------------------------------------------------

/** What the player said (with a tick or cross) and, when wrong, what was true beneath it. Both lines come ready-made. */
export const drawStamp = (ctx: CanvasRenderingContext2D, said: string, truth: string, right: boolean, y: number) => {
  if (right) drawTick(ctx, ICON_X, y);
  else drawCross(ctx, ICON_X, y);
  drawText(ctx, said, BESIDE_ICON, y, right ? GOOD : BAD);
  if (!right) {
    drawTick(ctx, ICON_X, y + 12);
    drawText(ctx, truth, BESIDE_ICON, y + 12, GOOD);
  }
};

// ---- the report at the end ----------------------------------------------------------------------------------------

export interface ReportItem {
  /** Tick or cross. */
  ok: boolean;
  head: string;
  /** Lines under the head, each with its own colour. */
  lines: ReadonlyArray<{ text: string; color: string }>;
}

/** Three short blocks: the forecast, then each row with its verdict. */
export const drawReport = (ctx: CanvasRenderingContext2D, items: readonly ReportItem[], y: number) => {
  let at = y;
  for (const item of items) {
    if (item.ok) drawTick(ctx, ICON_X, at);
    else drawCross(ctx, ICON_X, at);
    drawText(ctx, item.head, BESIDE_ICON, at, INK);
    at += 10;
    for (const line of item.lines) {
      drawText(ctx, line.text, BESIDE_ICON, at, line.color);
      at += 10;
    }
    at += 4;
  }
};

