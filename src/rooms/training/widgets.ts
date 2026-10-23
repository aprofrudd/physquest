// The four small screens of the coach's wall: ZONES (the zones as bars), INTERVAL (a timer showing WORK or REST,
// no digits), LEGS (a trace of the week's legs) and WEEK (a mini planner). The walk-around map hangs them on the
// top wall; the instrument shows the same widgets live. Each draws its body into a rectangle the caller frames.
import { drawText, measureText } from '../../render/PixelFont';
import { drawLine } from '../frame';
import { LOOK, legsTone, toneFill, type DayCell, type LegsLines } from './look';
import type { Phase } from './style';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const fillRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) => {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
};

const centredText = (ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, color: string) =>
  drawText(ctx, text, Math.round(cx - (measureText(text) - 1) / 2), y, color);

/** The body of a station (see drawStationFrame) at x, y: below its title bar. Work it out once, not every frame. */
export const stationBody = (x: number, y: number, w: number, h: number): Rect => ({ x: x + 1, y: y + 10, w: w - 2, h: h - 11 });

/** A station for the instrument's wall row: black frame, dark-green title bar, then a body of `bodyColor`. */
export const drawStationFrame = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  title: string,
  bodyColor: string,
) => {
  fillRect(ctx, x, y, w, h, LOOK.outline);
  fillRect(ctx, x + 1, y + 1, w - 2, 9, LOOK.darkGreen);
  centredText(ctx, title, x + w / 2, y + 2, LOOK.paper);
  fillRect(ctx, x + 1, y + 10, w - 2, h - 11, bodyColor);
};

/** The body of a bare board (see drawBoardFrame) at x, y. */
export const boardBody = (x: number, y: number, w: number, h: number): Rect => ({ x: x + 1, y: y + 1, w: w - 2, h: h - 2 });

/** A bare board for the map's wall: black frame and a body of `bodyColor`. */
export const drawBoardFrame = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, bodyColor: string) => {
  fillRect(ctx, x, y, w, h, LOOK.outline);
  fillRect(ctx, x + 1, y + 1, w - 2, h - 2, bodyColor);
};

// ---- ZONES -------------------------------------------------------------------------------------------------------

/** A rung of the zone ladder: a key session's orange or a support session's green. */
export type Rung = 'key' | 'support';

/**
 * The zones as a ladder of bars, the easiest at the bottom and each rung longer than the one below. `focus` is
 * the rung to point at (-1 for none): gold with a black outline, so it reads without the colour.
 */
export const drawZonesBody = (ctx: CanvasRenderingContext2D, r: Rect, rungs: readonly Rung[], focus: number) => {
  fillRect(ctx, r.x, r.y, r.w, r.h, LOOK.floor);
  const n = rungs.length;
  if (n === 0) return;
  const barH = r.h >= 15 ? 3 : 2;
  const total = n * barH + (n - 1);
  const top = r.y + Math.floor((r.h - total) / 2);
  const maxW = r.w - 6;
  for (let i = 0; i < n; i++) {
    const y = top + (n - 1 - i) * (barH + 1);
    const w = Math.max(4, Math.round(((i + 1) / n) * maxW));
    if (i === focus) {
      fillRect(ctx, r.x + 2, y - 1, w + 2, barH + 2, LOOK.outline);
      fillRect(ctx, r.x + 3, y, w, barH, LOOK.gold);
    } else {
      fillRect(ctx, r.x + 3, y, w, barH, rungs[i] === 'key' ? LOOK.orange : LOOK.midGreen);
    }
  }
};

// ---- INTERVAL ----------------------------------------------------------------------------------------------------

const PHASE_TEXT: Readonly<Record<Phase, string>> = { work: 'WORK', rest: 'REST', steady: 'STEADY', off: '--' };
const PHASE_COLOR: Readonly<Record<Phase, string>> = {
  work: LOOK.ledGreen,
  rest: LOOK.ledRed,
  steady: LOOK.ledAmber,
  off: LOOK.ledOff,
};

/** The interval timer: WORK, REST or STEADY in lamp colours, no digits. `lit` blinks the little lamp. */
export const drawIntervalBody = (ctx: CanvasRenderingContext2D, r: Rect, phase: Phase, lit: boolean) => {
  fillRect(ctx, r.x, r.y, r.w, r.h, LOOK.lcd);
  centredText(ctx, PHASE_TEXT[phase], r.x + r.w / 2, r.y + Math.floor((r.h - 7) / 2), PHASE_COLOR[phase]);
  if (lit && phase !== 'off') fillRect(ctx, r.x + 2, r.y + 2, 2, 2, PHASE_COLOR[phase]);
};

// ---- LEGS --------------------------------------------------------------------------------------------------------

/**
 * The week's legs as a trace, one point a day, with a dashed line at the full-quality mark. `shown` days are
 * drawn (the run reveals the week as it goes); `focus` is ringed.
 */
export const drawLegsBody = (
  ctx: CanvasRenderingContext2D,
  r: Rect,
  legs: readonly number[],
  focus: number,
  shown: number,
  lines: LegsLines,
) => {
  fillRect(ctx, r.x, r.y, r.w, r.h, LOOK.glass);
  const n = legs.length;
  if (n < 2) return;
  const yOf = (v: number): number => r.y + r.h - 3 - Math.round((Math.max(0, Math.min(100, v)) / 100) * (r.h - 6));
  const xOf = (i: number): number => r.x + 4 + Math.round((i * (r.w - 8)) / (n - 1));
  ctx.fillStyle = LOOK.glassGrid;
  const line = yOf(lines.fullAt);
  for (let x = r.x + 2; x < r.x + r.w - 2; x += 3) ctx.fillRect(x, line, 2, 1);
  const count = Math.min(n, shown);
  for (let i = 1; i < count; i++) drawLine(ctx, xOf(i - 1), yOf(legs[i - 1] ?? 0), xOf(i), yOf(legs[i] ?? 0), LOOK.trace);
  for (let i = 0; i < count; i++) {
    const value = legs[i] ?? 0;
    fillRect(ctx, xOf(i) - 1, yOf(value) - 1, 3, 3, toneFill(legsTone(value, lines)));
  }
  if (focus >= 0 && focus < count) {
    const x = xOf(focus);
    const y = yOf(legs[focus] ?? 0);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - 3, y - 3, 7, 1);
    ctx.fillRect(x - 3, y + 3, 7, 1);
    ctx.fillRect(x - 3, y - 3, 1, 7);
    ctx.fillRect(x + 3, y - 3, 1, 7);
  }
};

// ---- WEEK --------------------------------------------------------------------------------------------------------

const CELL_FILL: Readonly<Record<DayCell['kind'], string>> = {
  key: LOOK.orange,
  support: LOOK.lightGreen,
  rest: LOOK.restFill,
  away: LOOK.awayFill,
  empty: LOOK.floor,
};

/** A mini planner: a square per day in its session's colour over a dot for that morning's legs. */
export const drawWeekBody = (
  ctx: CanvasRenderingContext2D,
  r: Rect,
  cells: readonly DayCell[],
  focus: number,
  shown: number,
  lines: LegsLines,
) => {
  fillRect(ctx, r.x, r.y, r.w, r.h, LOOK.floor);
  const n = cells.length;
  if (n === 0) return;
  const colW = Math.floor((r.w - 4) / n);
  const x0 = r.x + 2 + Math.floor((r.w - 4 - colW * n) / 2);
  const dotH = r.h >= 15 ? 3 : 2;
  const squareY = r.y + Math.floor((r.h - (5 + 2 + dotH)) / 2);
  for (let i = 0; i < n; i++) {
    const cell = cells[i];
    if (!cell) continue;
    const cx = x0 + i * colW + Math.floor((colW - 5) / 2);
    const reached = i < shown;
    if (cell.kind === 'empty') {
      ctx.fillStyle = LOOK.grey;
      ctx.fillRect(cx, squareY, 5, 1);
      ctx.fillRect(cx, squareY + 4, 5, 1);
      ctx.fillRect(cx, squareY, 1, 5);
      ctx.fillRect(cx + 4, squareY, 1, 5);
    } else {
      fillRect(ctx, cx, squareY, 5, 5, CELL_FILL[cell.kind]);
      if (cell.kind === 'rest' || cell.kind === 'away') {
        ctx.fillStyle = LOOK.grey;
        ctx.fillRect(cx, squareY, 5, 1);
        ctx.fillRect(cx, squareY + 4, 5, 1);
        ctx.fillRect(cx, squareY, 1, 5);
        ctx.fillRect(cx + 4, squareY, 1, 5);
      }
    }
    const dotY = squareY + 7;
    if (reached) fillRect(ctx, cx, dotY, 5, dotH, toneFill(legsTone(cell.legs, lines)));
    else fillRect(ctx, cx + 1, dotY, 3, 1, LOOK.grey);
    if (i === focus) {
      const fx = x0 + i * colW;
      ctx.fillStyle = LOOK.outline;
      ctx.fillRect(fx, r.y + 1, colW, 1);
      ctx.fillRect(fx, r.y + r.h - 2, colW, 1);
      ctx.fillRect(fx, r.y + 1, 1, r.h - 2);
      ctx.fillRect(fx + colW - 1, r.y + 1, 1, r.h - 2);
    }
  }
};
