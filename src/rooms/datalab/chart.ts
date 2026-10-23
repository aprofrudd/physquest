// A small chart renderer for the rooms that show a measured file: chart paper with a pale grid, axes with tick
// labels, a joined line with dots, rings, dashed drops and brackets. It knows nothing about lactate: later sports
// reuse it for heart-rate and power traces. Everything is drawn with fillRect or cached sprites (no per-frame
// allocation) in the game's flat pixel style.
import { drawText, measureText } from '../../render/PixelFont';
import { COLORS, drawDashedH, drawDashedV, drawLine } from '../frame';

/** The chart's inks. Meaning colours come from the rooms' shared COLORS and are always paired with a mark or a word. */
export const PAPER = {
  paper: COLORS.paper,
  gridMinor: '#e6ecde',
  gridMajor: '#cfd9c6',
  ink: COLORS.ink,
  inkSoft: COLORS.inkSoft,
  /** The measured line. */
  trace: '#12283c',
  goldPale: '#f4e9b4',
  goodText: '#1f6a2c',
  badText: '#a02020',
} as const;

/** The plot's rectangle in game pixels (the area inside the axes) and the data range it shows. */
export interface Plot {
  x: number;
  y: number;
  w: number;
  h: number;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

/** Game pixel x of a data x. */
export const plotX = (p: Plot, v: number): number => Math.round(p.x + ((v - p.xMin) / (p.xMax - p.xMin)) * (p.w - 1));

/** Game pixel y of a data y (the plot's last row is yMin). */
export const plotY = (p: Plot, v: number): number => Math.round(p.y + p.h - 1 - ((v - p.yMin) / (p.yMax - p.yMin)) * (p.h - 1));

const rect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) => {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
};

/** The pale grid: a vertical line at each x in `xs` and a horizontal one at each y in `ys` (data values). */
export const drawGrid = (ctx: CanvasRenderingContext2D, p: Plot, xs: readonly number[], ys: readonly number[]) => {
  for (let i = 0; i < xs.length; i++) rect(ctx, plotX(p, xs[i]!), p.y, 1, p.h, PAPER.gridMinor);
  for (let i = 0; i < ys.length; i++) rect(ctx, p.x, plotY(p, ys[i]!), p.w, 1, PAPER.gridMajor);
};

/** The two axis lines: the bottom one just under the plot, the left one just beside it. */
export const drawAxes = (ctx: CanvasRenderingContext2D, p: Plot, color: string = PAPER.ink) => {
  rect(ctx, p.x, p.y + p.h, p.w, 1, color);
  rect(ctx, p.x - 1, p.y, 1, p.h + 1, color);
};

export interface Tick {
  value: number;
  label: string;
  color?: string;
}

/** Tick marks and labels under the bottom axis, centred on their values (the first `count` ticks). */
export const drawXTicks = (ctx: CanvasRenderingContext2D, p: Plot, ticks: readonly Tick[], count: number = ticks.length, color: string = PAPER.inkSoft) => {
  for (let i = 0; i < count; i++) {
    const t = ticks[i]!;
    const x = plotX(p, t.value);
    rect(ctx, x, p.y + p.h + 1, 1, 2, PAPER.ink);
    drawText(ctx, t.label, Math.round(x - (measureText(t.label) - 1) / 2), p.y + p.h + 4, t.color ?? color);
  }
};

// Where each y label is drawn (centre row), reused every frame
const labelYs: number[] = [];

/**
 * Labels left of the left axis, right-aligned and centred on their values (the first `count` ticks, lowest value
 * first). On a short plot two labels can land closer than a glyph is tall: from the lowest up, each label is pushed
 * up until it is `minPitch` px clear of the one below (the tick marks stay on their values).
 */
export const drawYTicks = (ctx: CanvasRenderingContext2D, p: Plot, ticks: readonly Tick[], count: number = ticks.length, color: string = PAPER.inkSoft, minPitch = 8) => {
  labelYs.length = count;
  for (let i = 0; i < count; i++) {
    const y = plotY(p, ticks[i]!.value);
    labelYs[i] = i > 0 ? Math.min(y, labelYs[i - 1]! - minPitch) : y;
  }
  for (let i = 0; i < count; i++) {
    const t = ticks[i]!;
    rect(ctx, p.x - 3, plotY(p, t.value), 2, 1, PAPER.ink);
    drawText(ctx, t.label, p.x - 4 - (measureText(t.label) - 1), labelYs[i]! - 3, t.color ?? color);
  }
};

/** A dashed horizontal reference line across the plot at a data y. */
export const drawRefLine = (ctx: CanvasRenderingContext2D, p: Plot, value: number, color: string = PAPER.inkSoft) => {
  drawDashedH(ctx, p.x, plotY(p, value), p.w, color);
};

/** A dashed vertical drop from a data point down to the bottom axis. */
export const drawDrop = (ctx: CanvasRenderingContext2D, p: Plot, x: number, y: number, color: string) => {
  const px = plotX(p, x);
  const py = plotY(p, y);
  drawDashedV(ctx, px, py, p.y + p.h - py, color);
};

/** A dashed vertical line through the whole plot at a data x. */
export const drawVLine = (ctx: CanvasRenderingContext2D, p: Plot, x: number, color: string) => {
  drawDashedV(ctx, plotX(p, x), p.y, p.h, color);
};

export interface DataPoint {
  x: number;
  y: number;
}

/** The measured line through the first `count` data points, 2px thick so it reads on a phone. */
export const drawTrace = (ctx: CanvasRenderingContext2D, p: Plot, points: readonly DataPoint[], count: number = points.length, color: string = PAPER.trace) => {
  for (let i = 0; i + 1 < count; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    drawLine(ctx, plotX(p, a.x), plotY(p, a.y), plotX(p, b.x), plotY(p, b.y), color);
    drawLine(ctx, plotX(p, a.x), plotY(p, a.y) + 1, plotX(p, b.x), plotY(p, b.y) + 1, color);
  }
};

/** A dotted line (1 on, 1 off along x) between two pixel points, for "what the line would be". */
export const drawDotted = (ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, color: string) => {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  ctx.fillStyle = color;
  for (let i = 0; i <= steps; i += 2) {
    const t = steps === 0 ? 0 : i / steps;
    ctx.fillRect(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t), 1, 1);
  }
};

// ---- Dots and rings, cached as tiny sprites --------------------------------------------------------------------

// One tiny canvas per radius and colour, found without building a key string on every draw
const rings = new Map<number, Map<string, HTMLCanvasElement>>();

const circlePixels = (r: number): Array<readonly [number, number]> => {
  // Midpoint circle: a clean 1px outline
  const out: Array<readonly [number, number]> = [];
  let x = r;
  let y = 0;
  let err = 1 - r;
  while (x >= y) {
    for (const [dx, dy] of [
      [x, y],
      [y, x],
      [-y, x],
      [-x, y],
      [-x, -y],
      [-y, -x],
      [y, -x],
      [x, -y],
    ] as const) {
      out.push([dx, dy]);
    }
    y++;
    if (err < 0) err += 2 * y + 1;
    else {
      x--;
      err += 2 * (y - x) + 1;
    }
  }
  return out;
};

const ringSprite = (r: number, color: string): HTMLCanvasElement => {
  let byColor = rings.get(r);
  if (!byColor) {
    byColor = new Map();
    rings.set(r, byColor);
  }
  let sprite = byColor.get(color);
  if (!sprite) {
    sprite = document.createElement('canvas');
    sprite.width = r * 2 + 1;
    sprite.height = r * 2 + 1;
    const c = sprite.getContext('2d')!;
    c.fillStyle = color;
    for (const [dx, dy] of circlePixels(r)) c.fillRect(r + dx, r + dy, 1, 1);
    byColor.set(color, sprite);
  }
  return sprite;
};

/** A 1px ring of radius r centred on (cx, cy). */
export const drawRing = (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string) => {
  ctx.drawImage(ringSprite(r, color), Math.round(cx) - r, Math.round(cy) - r);
};

/** A data dot: a 3x3 square (or 5x5 when `big`), solid, with a light core when `hollow`. */
export const drawDot = (ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string = PAPER.trace, hollow = false, big = false) => {
  const half = big ? 2 : 1;
  const x = Math.round(cx);
  const y = Math.round(cy);
  rect(ctx, x - half, y - half, half * 2 + 1, half * 2 + 1, color);
  if (hollow) rect(ctx, x - half + 1, y - half + 1, half * 2 - 1, half * 2 - 1, PAPER.paper);
};

/** A square bracket on its side: a vertical line from y0 to y1 with short serifs pointing left (side -1) or right (1). */
export const drawBracketV = (ctx: CanvasRenderingContext2D, x: number, y0: number, y1: number, color: string, side: -1 | 1 = 1) => {
  const top = Math.min(y0, y1);
  const height = Math.abs(y1 - y0) + 1;
  rect(ctx, x, top, 1, height, color);
  rect(ctx, side === 1 ? x : x - 2, top, 3, 1, color);
  rect(ctx, side === 1 ? x : x - 2, top + height - 1, 3, 1, color);
};

/** A 9x9 tag: `mark` is a digit, or a tick / cross drawn in `ink`. */
export const drawTag = (ctx: CanvasRenderingContext2D, x: number, y: number, mark: string, fill: string, edge: string, ink: string) => {
  rect(ctx, x, y, 9, 9, edge);
  rect(ctx, x + 1, y + 1, 7, 7, fill);
  drawText(ctx, mark, x + 2, y + 1, ink);
};
