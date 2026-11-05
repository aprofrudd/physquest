// The zoom lens: a small inset that shows the flagged reading and the readings around it as dots with their
// values, and a dotted IF REMOVED line across the gap the reading would leave.
import { drawText, measureText } from '../../render/PixelFont';
import { COLORS, drawLine } from '../frame';
import type { Lens } from './model';
import { PAPER, drawDot, drawDotted } from './chart';

/** The lens frame in game pixels. */
export const LENS_BOX = { x: 146, y: 62, w: 98, h: 36 } as const;

const EDGE = 4; // from the frame's edge to a value's text: the 2px border and 2px of air
// The values sit in one row under the dots. When two neighbours' values would sit closer than GAP_BETWEEN_VALUES
// (a decimal point's own air makes "0.0 2.0" read as one run) they take turns in a row above and a row below, with
// the reading under the lens always in the lower row, directly under its gold marker.
const LOW_ROW = 25; // from the frame's top
const HIGH_ROW = 6; // clear of the ZOOM caption that sits on the frame's top edge
const DOTS_TOP = 9; // the dots' band
const DOTS_BOTTOM = 20;
const STAGGERED_TOP = 15; // takes turns: no dot touches the upper row of values (1px clear)
const STAGGERED_BOTTOM = 20; // the marker's last row stays above the lower row of values
const GAP_BETWEEN_VALUES = 8; // pixels that keep two values apart (ink to ink)

/** The margin each end of the frame needs for a value up to `widest` pixels wide (its half, the frame and 2px of air). */
export const lensPad = (widest: number): number => Math.ceil(widest / 2) + EDGE;

/** Whether `n` dots with values up to `widest` pixels wide sit so close that neighbouring values must take turns. */
export const lensStaggers = (n: number, widest: number): boolean =>
  n > 1 && (LENS_BOX.w - lensPad(widest) * 2) / (n - 1) < widest + GAP_BETWEEN_VALUES;

const rect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) => {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
};

/** A caption sitting on the frame's top edge, with paper behind it so the border does not run through the text. */
const legend = (ctx: CanvasRenderingContext2D, text: string, x: number, color: string) => {
  const w = measureText(text) - 1;
  rect(ctx, x - 2, LENS_BOX.y - 1, w + 4, 3, PAPER.paper);
  drawText(ctx, text, x, LENS_BOX.y - 3, color);
};

const drawFrame = (ctx: CanvasRenderingContext2D, ringed: boolean) => {
  const { x, y, w, h } = LENS_BOX;
  rect(ctx, x, y, w, h, COLORS.ink);
  rect(ctx, x + 1, y + 1, w - 2, h - 2, ringed ? COLORS.gold : COLORS.grey);
  rect(ctx, x + 2, y + 2, w - 4, h - 4, '#ffffff');
};

/** The lens with nothing under it yet (while the brief is read). */
export const drawEmptyLens = (ctx: CanvasRenderingContext2D) => {
  drawFrame(ctx, false);
  legend(ctx, 'ZOOM', LENS_BOX.x + 5, PAPER.inkSoft);
};

/** The lens on a flagged reading. */
export const drawLens = (ctx: CanvasRenderingContext2D, lens: Lens) => {
  drawFrame(ctx, true);
  legend(ctx, 'ZOOM', LENS_BOX.x + 5, PAPER.inkSoft);
  const dots = lens.dots;
  const n = dots.length;
  if (n === 0) return;

  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < n; i++) {
    lo = Math.min(lo, dots[i]!.value);
    hi = Math.max(hi, dots[i]!.value);
  }
  const vSpan = Math.max(hi - lo, 0.0001);
  let widest = 0;
  for (let i = 0; i < n; i++) widest = Math.max(widest, measureText(dots[i]!.text) - 1);
  const stagger = lensStaggers(n, widest);
  const left = LENS_BOX.x + lensPad(widest);
  const width = LENS_BOX.w - lensPad(widest) * 2;
  const bandTop = stagger ? STAGGERED_TOP : DOTS_TOP;
  const bandBottom = stagger ? STAGGERED_BOTTOM : DOTS_BOTTOM;
  // Dots are spread evenly (a removed stage between two of them is not drawn as an empty gap), so values never collide
  const xOf = (i: number) => Math.round(n === 1 ? left + width / 2 : left + (i / (n - 1)) * width);
  const yOf = (v: number) => Math.round(LENS_BOX.y + bandBottom - ((v - lo) / vSpan) * (bandBottom - bandTop));

  // The reading's own line, dot to dot, then the dotted line across the gap it would leave
  for (let i = 0; i + 1 < n; i++) {
    const a = dots[i]!;
    const b = dots[i + 1]!;
    drawLine(ctx, xOf(i), yOf(a.value), xOf(i + 1), yOf(b.value), PAPER.trace);
  }
  let from = -1;
  let to = -1;
  for (let i = 0; i < lens.repair.length; i++) {
    const idx = lens.repair[i]!;
    if (idx < lens.suspect) from = idx;
    else if (to < 0) to = idx;
  }
  if (from >= 0 && to >= 0) {
    const a = dots[from]!;
    const b = dots[to]!;
    drawDotted(ctx, xOf(from), yOf(a.value), xOf(to), yOf(b.value), PAPER.goodText);
    legend(ctx, 'IF REMOVED', LENS_BOX.x + LENS_BOX.w - 5 - (measureText('IF REMOVED') - 1), PAPER.goodText);
  }

  for (let i = 0; i < n; i++) {
    const d = dots[i]!;
    const x = xOf(i);
    const y = yOf(d.value);
    const suspect = i === lens.suspect;
    if (suspect) {
      rect(ctx, x - 3, y - 3, 7, 7, COLORS.ink);
      rect(ctx, x - 2, y - 2, 5, 5, COLORS.gold);
    } else {
      drawDot(ctx, x, y, d.role === 'flagged' ? COLORS.inkSoft : PAPER.trace, d.role === 'flagged');
    }
    const textX = Math.round(x - (measureText(d.text) - 1) / 2);
    const high = stagger && (i - lens.suspect) % 2 !== 0; // every other value takes the upper row, the reading's own never
    const rowY = LENS_BOX.y + (high ? HIGH_ROW : LOW_ROW);
    drawText(ctx, d.text, textX, rowY, suspect ? COLORS.ink : PAPER.inkSoft);
    if (suspect) rect(ctx, textX, high ? rowY + 8 : rowY - 2, measureText(d.text) - 1, 1, COLORS.gold);
  }
};
