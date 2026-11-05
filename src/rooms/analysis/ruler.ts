// The ruler: one metric on an axis that always runs worse (left) to better (right). Everything here is drawn with
// colours of its own (not the room's palette) so it reads on the cream panel, and every mark has a shape or a word
// as well as a colour: the noise band is hatched, the worthwhile lines are dashed, YOUR GUESS is a triangle with its
// own label, the retest a ringed dot with whiskers.
import { drawText, measureText } from '../../render/PixelFont';
import { COLORS, clamp01 } from '../frame';
import type { ReviewRow } from '../content/types';
import { fractionOf, type Scale, type Tick } from './model';

export const INK = COLORS.ink;
export const SOFT = COLORS.inkSoft;
export const PIN = COLORS.blue;
export const GOOD = COLORS.good;
export const BAD = COLORS.bad;
/** The worthwhile lines and their legend: a dark gold that stays readable on the cream panel. */
export const GOLD = '#b8860b';
const NAVY = '#1b3a5c';
const BAND = '#8ab8e0';
const BAND_PAPER = '#eef4f8';
const BAND_EDGE = '#4878a8';
const DOT = '#2f9a45';
const DOT_EDGE = '#1f6a2c';
const GHOST = '#8a8a8a';

/** Where a ruler sits on the stage: its ends (where the scale's worse and better ends are), its axis and the band's half height. */
export interface RulerGeometry {
  x0: number;
  x1: number;
  axisY: number;
  half: number;
}

export const xOf = (g: RulerGeometry, scale: Scale, improvement: number): number => Math.round(g.x0 + fractionOf(scale, improvement) * (g.x1 - g.x0));

const rect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) => {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
};

// ---- the hatched band ---------------------------------------------------------------------------------------------

let hatch: HTMLCanvasElement | null = null;
const patterns = new WeakMap<CanvasRenderingContext2D, CanvasPattern>();

/** A 2x2 checker, made once; the pattern is fixed to the screen's pixels, so a band never shimmers as it grows. */
const hatchFor = (ctx: CanvasRenderingContext2D): CanvasPattern | string => {
  const cached = patterns.get(ctx);
  if (cached) return cached;
  if (!hatch) {
    hatch = document.createElement('canvas');
    hatch.width = 2;
    hatch.height = 2;
    const h = hatch.getContext('2d') as CanvasRenderingContext2D;
    h.fillStyle = BAND_PAPER;
    h.fillRect(0, 0, 2, 2);
    h.fillStyle = BAND;
    h.fillRect(0, 0, 1, 1);
    h.fillRect(1, 1, 1, 1);
  }
  const made = ctx.createPattern(hatch, 'repeat');
  if (!made) return BAND;
  patterns.set(ctx, made);
  return made;
};

/** A hatched box (the legend's swatch and the band itself). */
export const drawHatch = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, edge = true) => {
  if (w <= 0 || h <= 0) return;
  ctx.fillStyle = hatchFor(ctx);
  ctx.fillRect(x, y, w, h);
  if (edge) {
    rect(ctx, x, y, w, 1, BAND_EDGE);
    rect(ctx, x, y + h - 1, w, 1, BAND_EDGE);
  }
};

/** A vertical dashed line: 2px on, 2px off. */
export const drawDashesV = (ctx: CanvasRenderingContext2D, x: number, y: number, h: number, color: string = GOLD) => {
  ctx.fillStyle = color;
  for (let i = 0; i < h; i += 4) ctx.fillRect(x, y + i, 1, Math.min(2, h - i));
};

// ---- marks --------------------------------------------------------------------------------------------------------

/** A round dot: ink ring, `fill` inside (9px across). */
export const drawDot = (ctx: CanvasRenderingContext2D, x: number, y: number, fill: string, ring: string = INK) => {
  ctx.fillStyle = ring;
  ctx.fillRect(x - 3, y - 4, 7, 9);
  ctx.fillRect(x - 4, y - 3, 9, 7);
  ctx.fillStyle = fill;
  ctx.fillRect(x - 2, y - 3, 5, 7);
  ctx.fillRect(x - 3, y - 2, 7, 5);
};

/** A small dot for a baseline trial (5px across). */
const drawTrialDot = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
  ctx.fillStyle = INK;
  ctx.fillRect(x - 1, y - 2, 3, 5);
  ctx.fillRect(x - 2, y - 1, 5, 3);
  ctx.fillStyle = '#f8f8f0';
  ctx.fillRect(x - 1, y - 1, 3, 3);
};

/** YOUR GUESS: a blue triangle pointing down at the axis, its tip at `tipY`. */
export const drawPin = (ctx: CanvasRenderingContext2D, x: number, tipY: number, color: string = PIN, ring: string = INK) => {
  for (let i = 0; i < 7; i++) {
    const w = 13 - i * 2;
    rect(ctx, x - (w - 1) / 2, tipY - 7 + i, w, 1, ring);
    if (w > 2) rect(ctx, x - (w - 3) / 2, tipY - 7 + i, w - 2, 1, color);
  }
  rect(ctx, x, tipY, 1, 1, ring);
};

/** A ghost tick across the axis: where an earlier block's improvement landed (grey with a white core, so the guess above never hides it). */
export const drawGhostTick = (ctx: CanvasRenderingContext2D, x: number, axisY: number) => {
  rect(ctx, x - 1, axisY - 5, 3, 11, GHOST);
  rect(ctx, x, axisY - 4, 1, 9, '#f8f8f0');
};

/** The retest dot with its error bars (whiskers one typical error either side). `grow` 0-1 opens the whiskers. */
export const drawRetestDot = (ctx: CanvasRenderingContext2D, g: RulerGeometry, scale: Scale, improvement: number, te: number, grow: number, dotY = g.axisY) => {
  const x = xOf(g, scale, improvement);
  const reach = Math.round((xOf(g, scale, improvement + te) - x) * clamp01(grow));
  if (reach > 0) {
    rect(ctx, x - reach, dotY - 1, reach * 2 + 1, 2, DOT_EDGE);
    rect(ctx, x - reach, dotY - 4, 2, 9, DOT_EDGE);
    rect(ctx, x + reach - 1, dotY - 4, 2, 9, DOT_EDGE);
  }
  drawDot(ctx, x, dotY, DOT);
};

// ---- the ruler ----------------------------------------------------------------------------------------------------

/** How much of the ruler is drawn, each 0-1 (the brief builds it up piece by piece). */
export interface Reveal {
  axis: number;
  pole: number;
  /** One per baseline trial. */
  trials: number[];
  band: number;
  gold: number;
}

/** A ruler that is completely drawn (do not change it: make a Reveal of your own to animate). */
export const FULL: Readonly<Reveal> = { axis: 1, pole: 1, trials: [1, 1], band: 1, gold: 1 };

const labels = new Map<number, string>();

/** The number on the axis as text, made once for each value (drawing runs every frame). */
const labelOf = (value: number): string => {
  let text = labels.get(value);
  if (text === undefined) {
    text = String(value);
    labels.set(value, text);
  }
  return text;
};

/** Draws the axis with its ticks and numbers, the baseline pole and trial dots, the noise band and the worthwhile lines. */
export const drawRuler = (
  ctx: CanvasRenderingContext2D,
  g: RulerGeometry,
  row: ReviewRow,
  scale: Scale,
  ticks: readonly Tick[],
  trials: readonly number[],
  reveal: Readonly<Reveal> = FULL,
) => {
  const { axisY, half } = g;
  const centre = xOf(g, scale, 0);
  const top = axisY - half;
  const height = half * 2 + 1;

  // the noise band: baseline plus or minus the typical error, spreading from the pole
  if (reveal.band > 0) {
    const reach = Math.round((xOf(g, scale, row.te) - centre) * clamp01(reveal.band));
    drawHatch(ctx, centre - reach, top, reach * 2 + 1, height);
  }

  // the smallest worthwhile change, either side, sliding out from the band's edge
  if (reveal.gold > 0) {
    const reachGold = row.te + (row.swc - row.te) * clamp01(reveal.gold);
    drawDashesV(ctx, xOf(g, scale, -reachGold), top - 2, height + 4);
    drawDashesV(ctx, xOf(g, scale, reachGold), top - 2, height + 4);
  }

  // the axis grows from the left end, with an arrow at the better end
  const reach = Math.round((g.x1 + 8 - (g.x0 - 8)) * clamp01(reveal.axis));
  rect(ctx, g.x0 - 8, axisY, reach, 1, NAVY);
  if (reveal.axis >= 1) {
    rect(ctx, g.x1 + 7, axisY - 2, 1, 5, NAVY);
    rect(ctx, g.x1 + 6, axisY - 1, 1, 3, NAVY);
    rect(ctx, g.x1 + 5, axisY, 1, 1, NAVY);
  }

  // ticks and numbers appear as the axis passes them
  for (const tick of ticks) {
    const x = xOf(g, scale, tick.improvement);
    if (x > g.x0 - 8 + reach) continue;
    const isBaseline = tick.improvement === 0;
    if (!isBaseline) rect(ctx, x, axisY + 1, 1, 3, NAVY);
    const text = labelOf(tick.value);
    drawText(ctx, text, Math.round(x - (measureText(text) - 1) / 2), axisY + half + 6, isBaseline ? INK : NAVY);
  }

  // the baseline pole, dropping in from above
  if (reveal.pole > 0) {
    const poleH = Math.round((height + 6) * clamp01(reveal.pole));
    rect(ctx, centre - 1, top - 2, 2, poleH, NAVY);
  }

  // the two baseline trials land either side of the pole
  for (let i = 0; i < trials.length; i++) {
    const p = clamp01(reveal.trials[i] ?? 0);
    if (p <= 0) continue;
    const value = trials[i] as number;
    const improvement = row.better === 'higher' ? value - row.baseline : row.baseline - value;
    const drop = Math.round((1 - p) * 10);
    drawTrialDot(ctx, xOf(g, scale, improvement), axisY - drop);
  }
};

/** A bracket under the axis from one x to another, ends turned up, with the gap's words centred beneath it. */
export const drawBracket = (ctx: CanvasRenderingContext2D, xa: number, xb: number, y: number, color: string = SOFT) => {
  const left = Math.min(xa, xb);
  const right = Math.max(xa, xb);
  rect(ctx, left, y, right - left + 1, 1, color);
  rect(ctx, left, y - 3, 1, 4, color);
  rect(ctx, right, y - 3, 1, 4, color);
};

/** The second row's legend marks (each nine pixels tall, from y - 1 to y + 7), each with its word beside it. Each has a fixed place, so nothing shifts as the others appear. */
export const LEGEND_X = { noise: 12, worth: 64, retest: 190 } as const;

/** The noise band's key: a hatched swatch and its words (NOISE, or NOISE: TYPICAL ERROR 0.6 S). Returns its width. */
export const drawNoiseKey = (ctx: CanvasRenderingContext2D, x: number, y: number, text: string): number => {
  drawHatch(ctx, x, y - 1, 9, 9);
  drawText(ctx, text, x + 13, y, SOFT);
  return 13 + measureText(text) - 1;
};

/** The worthwhile lines' key: two gold dashes and their words, in the lines' gold. Returns its width. */
export const drawWorthKey = (ctx: CanvasRenderingContext2D, x: number, y: number, text: string): number => {
  drawDashesV(ctx, x + 1, y - 1, 9);
  drawDashesV(ctx, x + 5, y - 1, 9);
  drawText(ctx, text, x + 10, y, GOLD);
  return 10 + measureText(text) - 1;
};

/** The retest dot's key. */
export const drawRetestKey = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
  drawDot(ctx, x + 4, y + 3, DOT);
  drawText(ctx, 'RETEST', x + 13, y, SOFT);
};

/** The second row's legend: short words, each with its mark. */
export const drawLegend = (ctx: CanvasRenderingContext2D, y: number, noise: boolean, worth: boolean, retest: boolean) => {
  if (noise) drawNoiseKey(ctx, LEGEND_X.noise, y, 'NOISE');
  if (worth) drawWorthKey(ctx, LEGEND_X.worth, y, 'WORTHWHILE');
  if (retest) drawRetestKey(ctx, LEGEND_X.retest, y);
};
