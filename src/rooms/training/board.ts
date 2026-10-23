// The week board: MON to SUN and a GO slot. Each day is a column with its name, a session chip, and a LEGS
// gauge with the number for that morning; under the columns, a footer with the week's three checks. Drawing
// only: the planner and the run say what to show. Colour is always paired with a label, a number or a mark.
import { drawPanel, drawBrackets, drawCross, drawTick } from '../frame';
import { drawText, measureText } from '../../render/PixelFont';
import { DAYS } from './model';
import { LOOK, legsTone, toneFill, toneInk, type CellKind, type DayCell, type LegsLines } from './look';
import type { CheckLine } from './text';
import { fillRect } from './widgets';

export const BOARD = { x: 4, y: 90, w: 248, h: 72 } as const;

const COLUMNS = 8; // seven days and GO
const COL_W = 30;
const COL_X = BOARD.x + 4;
const NAME_Y = 96;
const PILL_Y = 95;
const ARROW_UP_Y = 104;
const CHIP_Y = 108;
const CHIP_H = 16;
const CHIP_W = 28;
const ARROW_DOWN_Y = 124;
const GAUGE_Y = 128;
const GAUGE_W = 12;
const GAUGE_H = 10;
const NUMBER_Y = 139;
const FOOTER_RULE_Y = 148;
const FOOTER_TEXT_Y = 150;
const TINT_TOP = 94;
const TINT_BOTTOM = 148; // the highlight's border rests on the footer rule, with a clear row under the digits

/** The GO slot's index. */
export const GO_SLOT = 7;

/** What the board is for right now: planning (every day live), running (days appear as they are played), or the debrief (all played). */
export type BoardMode = 'plan' | 'run' | 'debrief';

export interface BoardView {
  mode: BoardMode;
  /** The seven days. */
  cells: readonly DayCell[];
  /** Planning: the column the cursor is on (0-6 a day, 7 the GO slot), or -1. */
  focus: number;
  /** Running: days already played, and the day being played (-1 once the week is over). */
  played: number;
  active: number;
  /** Running: how far the active day's gauge has filled (0-1). */
  reveal: number;
  /** GO is lit green: every key session has a day. */
  ready: boolean;
  /** The three checks under the columns, or null while they are not being shown. */
  checks: readonly CheckLine[] | null;
  lines: LegsLines;
  /** A day to ring in gold (the debrief points at a key session's best day), or -1. */
  ring: number;
  /** Ring the checks footer in gold (the debrief is talking about them). */
  ringChecks: boolean;
}

const colX = (i: number): number => COL_X + i * COL_W;

const stroke = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) => {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, 1);
  ctx.fillRect(x, y + h - 1, w, 1);
  ctx.fillRect(x, y, 1, h);
  ctx.fillRect(x + w - 1, y, 1, h);
};

const centredText = (ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, color: string) =>
  drawText(ctx, text, Math.round(cx - (measureText(text) - 1) / 2), y, color);

// ---- chips ------------------------------------------------------------------------------------------------------

interface ChipLook {
  fill: string;
  ink: string;
}

const CHIP_LOOK: Readonly<Record<Exclude<CellKind, 'empty'>, ChipLook>> = {
  key: { fill: LOOK.orange, ink: LOOK.ink },
  support: { fill: LOOK.lightGreen, ink: LOOK.darkGreen },
  rest: { fill: LOOK.restFill, ink: LOOK.greyInk },
  away: { fill: LOOK.awayFill, ink: LOOK.paper },
};

const drawChip = (ctx: CanvasRenderingContext2D, x: number, y: number, cell: DayCell, waiting: boolean) => {
  if (cell.kind === 'empty') {
    // Nothing planned yet: a dashed outline and a dash
    ctx.fillStyle = LOOK.grey;
    for (let i = 0; i < CHIP_W; i += 3) {
      ctx.fillRect(x + i, y, 2, 1);
      ctx.fillRect(x + i, y + CHIP_H - 1, 2, 1);
    }
    for (let j = 0; j < CHIP_H; j += 3) {
      ctx.fillRect(x, y + j, 1, 2);
      ctx.fillRect(x + CHIP_W - 1, y + j, 1, 2);
    }
    centredText(ctx, '--', x + CHIP_W / 2, y + 5, LOOK.grey);
    return;
  }
  const look = CHIP_LOOK[cell.kind];
  fillRect(ctx, x, y, CHIP_W, CHIP_H, LOOK.outline);
  fillRect(ctx, x + 1, y + 1, CHIP_W - 2, CHIP_H - 2, look.fill);
  if (cell.kind === 'key') fillRect(ctx, x + 1, y + 1, CHIP_W - 2, 1, LOOK.orangeLight); // a lit top edge: the hard days stand out
  if (cell.kind === 'away') {
    // Diagonal hatching above and below the label (never behind it): nothing can be done on this day
    ctx.fillStyle = LOOK.awayHatch;
    for (let j = 0; j < CHIP_H - 2; j++) {
      if (j >= 3 && j <= CHIP_H - 6) continue;
      for (let i = -CHIP_H; i < CHIP_W; i += 4) {
        const px = x + 1 + i + j;
        if (px > x && px < x + CHIP_W - 1) ctx.fillRect(px, y + 1 + j, 1, 1);
      }
    }
  }
  centredText(ctx, cell.label, x + CHIP_W / 2, y + 5, look.ink);
  if (waiting && cell.kind !== 'away') {
    // A day still to come: washed out
    ctx.globalAlpha = 0.55;
    fillRect(ctx, x, y, CHIP_W, CHIP_H, LOOK.paper);
    ctx.globalAlpha = 1;
  }
};

/** A small red square with a white "!": a key session that will not be at full quality. */
const drawFlag = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
  fillRect(ctx, x + 1, y, 5, 7, LOOK.outline);
  fillRect(ctx, x, y + 1, 7, 5, LOOK.outline);
  fillRect(ctx, x + 1, y + 1, 5, 5, LOOK.bad);
  drawText(ctx, '!', x + 1, y, '#ffffff');
};

// ---- gauge ------------------------------------------------------------------------------------------------------

/** `fraction` (0-1) is how much of the legs value shows: 1 normally, less while a run fills the gauge in. */
const drawGauge = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  legs: number,
  lines: LegsLines,
  pending: boolean,
  fraction: number,
) => {
  fillRect(ctx, x, y, GAUGE_W, GAUGE_H, LOOK.outline);
  fillRect(ctx, x + 1, y + 1, GAUGE_W - 2, GAUGE_H - 2, '#f0f4e8');
  const inner = GAUGE_H - 2;
  if (!pending) {
    const filled = Math.max(0, Math.round((inner * legs * fraction) / 100));
    fillRect(ctx, x + 1, y + GAUGE_H - 1 - filled, GAUGE_W - 2, filled, toneFill(legsTone(legs, lines)));
  }
  // The full-quality mark
  fillRect(ctx, x, y + 1 + Math.round((inner * (100 - lines.fullAt)) / 100), GAUGE_W, 1, pending ? '#a8b0a0' : LOOK.darkGreen);
};

// ---- arrows -----------------------------------------------------------------------------------------------------

const drawArrow = (ctx: CanvasRenderingContext2D, cx: number, y: number, up: boolean) => {
  ctx.fillStyle = LOOK.orange;
  for (let r = 0; r < 4; r++) {
    const w = (up ? r : 3 - r) * 2 + 1;
    ctx.fillRect(cx - (w - 1) / 2, y + r, w, 1);
  }
};

// ---- the footer -------------------------------------------------------------------------------------------------

/** The three checks: "SESSIONS 4/5 X   REST 2 ✓   RED 0 ✓", the group centred under the columns. */
const drawFooter = (ctx: CanvasRenderingContext2D, checks: readonly CheckLine[], ring: boolean) => {
  const GAP = 14;
  const GLYPH_W = 8; // a gap and the 5px tick or cross
  let total = GAP * Math.max(0, checks.length - 1);
  for (const check of checks) total += measureText(check.text) - 1 + GLYPH_W;
  fillRect(ctx, COL_X, FOOTER_RULE_Y, 240, 1, LOOK.lightGreen);
  let x = COL_X + Math.round((240 - total) / 2);
  for (const check of checks) {
    drawText(ctx, check.text, x, FOOTER_TEXT_Y, LOOK.inkSoft);
    const gx = x + measureText(check.text) + 2;
    if (check.ok) drawTick(ctx, gx, FOOTER_TEXT_Y, LOOK.good);
    else drawCross(ctx, gx, FOOTER_TEXT_Y, LOOK.bad);
    x += measureText(check.text) - 1 + GLYPH_W + GAP;
  }
  if (ring) stroke(ctx, COL_X + 2, FOOTER_RULE_Y + 1, 236, 11, LOOK.gold);
};

// ---- the board --------------------------------------------------------------------------------------------------

/** Draw the board panel: day columns, GO, and the footer checks. */
export const drawBoard = (ctx: CanvasRenderingContext2D, view: BoardView) => {
  drawPanel(ctx, BOARD.x, BOARD.y, BOARD.w, BOARD.h, LOOK.darkGreen);
  const planning = view.mode === 'plan';
  const running = view.mode === 'run';

  for (let i = 0; i < COLUMNS; i++) {
    const x = colX(i);
    const cx = x + COL_W / 2;
    const focused = planning && view.focus === i;
    const playing = running && view.active === i;
    const pointed = view.mode === 'debrief' && view.ring === i;
    if (focused || playing || pointed) {
      // The GO column has no gauge, so its highlight stops under the chip
      const bottom = i === GO_SLOT ? CHIP_Y + CHIP_H + 3 : TINT_BOTTOM;
      fillRect(ctx, x + 1, TINT_TOP, COL_W - 2, bottom - TINT_TOP, LOOK.orange);
      fillRect(ctx, x + 2, TINT_TOP + 1, COL_W - 4, bottom - TINT_TOP - 2, LOOK.orangeTint);
    }

    if (i === GO_SLOT) {
      if (focused) {
        fillRect(ctx, cx - 10, PILL_Y, 20, 9, LOOK.darkGreen);
        centredText(ctx, 'RUN', cx, NAME_Y, '#ffffff');
      } else {
        centredText(ctx, 'RUN', cx, NAME_Y, LOOK.greyInk);
      }
      const lit = view.ready || running;
      fillRect(ctx, x + 1, CHIP_Y, CHIP_W, CHIP_H, LOOK.outline);
      fillRect(ctx, x + 2, CHIP_Y + 1, CHIP_W - 2, CHIP_H - 2, lit ? LOOK.good : '#c8d0c0');
      centredText(ctx, 'GO', cx, CHIP_Y + 5, lit ? '#ffffff' : '#606858');
      continue;
    }

    const cell = view.cells[i];
    if (!cell) continue;
    const finished = !planning && (view.mode === 'debrief' || i < view.played);
    const reached = planning || finished || playing;

    // Day name: a dark pill when it is the cursor's or the playhead's; a played day's name makes room for its tick
    const nameX = finished ? cx - 3 : cx;
    if (focused || playing || pointed) {
      fillRect(ctx, nameX - 10, PILL_Y, 20, 9, LOOK.darkGreen);
      centredText(ctx, DAYS[i] ?? '', nameX, NAME_Y, '#ffffff');
    } else {
      centredText(ctx, DAYS[i] ?? '', nameX, NAME_Y, reached ? LOOK.inkSoft : LOOK.grey);
    }
    // A played day is ticked, or marked "!" when its key session was below full quality (clear of the name's pill)
    if (finished) {
      if (cell.flagged) drawText(ctx, '!', x + COL_W - 7, NAME_Y, LOOK.bad);
      else drawTick(ctx, x + COL_W - 7, NAME_Y, LOOK.good);
    }

    drawChip(ctx, x + 1, CHIP_Y, cell, !reached);
    if (cell.flagged && reached) drawFlag(ctx, x + COL_W - 8, CHIP_Y - 4);

    if (focused && cell.kind !== 'away') {
      drawArrow(ctx, cx, ARROW_UP_Y, true);
      drawArrow(ctx, cx, ARROW_DOWN_Y, false);
    }

    const fraction = playing ? view.reveal : 1;
    drawGauge(ctx, cx - GAUGE_W / 2, GAUGE_Y, cell.legs, view.lines, !reached, fraction);
    const tone = legsTone(cell.legs, view.lines);
    const shown = reached ? String(Math.round(cell.legs * fraction)) : '--';
    centredText(ctx, shown, cx, NUMBER_Y, reached ? toneInk(tone) : LOOK.grey);
  }

  if (view.mode === 'debrief' && view.ring >= 0 && view.ring < GO_SLOT) {
    drawBrackets(ctx, colX(view.ring), TINT_TOP - 1, COL_W, TINT_BOTTOM - TINT_TOP + 2, LOOK.gold);
  }
  if (view.checks) drawFooter(ctx, view.checks, view.ringChecks);
};
