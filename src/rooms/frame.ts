// Shared drawing for the redesigned rooms: the stage area between the sport plate and the dialogue box,
// panels, chips, ticks and crosses, in the game's own style. Rooms add their own widgets beside these.
import { drawPokemonBox } from '../render/SpriteSheet';
import { drawText, measureText } from '../render/PixelFont';
import { DIALOGUE_BOX } from '../render/DialogueBox';

/** The area a room may draw in: under the header and sport plates (which end at y = 36), above the dialogue box. */
export const STAGE = { x: 4, y: 38, w: 248, h: DIALOGUE_BOX.y - 2 - 38 } as const;

/** Ink and paper of the dialogue box, and the colours the rooms share for meaning (always paired with a symbol or a word). */
export const COLORS = {
  ink: '#080808',
  inkSoft: '#303030',
  paper: '#f8f8f0',
  grey: '#909090',
  good: '#2f8a3c', // right, kept, full quality
  bad: '#c83030', // wrong, removed in error, compromised
  gold: '#d0a830', // highlight, the cursor's thing, worthwhile line
  blue: '#3868b8', // the player's own mark (forecast, pin)
} as const;

/** A bordered panel (the dialogue box's double border), white inside. */
export const drawPanel = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, border: string = COLORS.inkSoft) =>
  drawPokemonBox(ctx, x, y, w, h, border);

/** Width of a chip for `text` (see drawChip). */
export const chipWidth = (text: string): number => measureText(text) - 1 + 6;

/** Height of a chip: 1px border, 1px padding, the 7px glyphs, 1px padding, 1px border. */
export const CHIP_H = 11;

/** A small labelled plate: 1px border, 3px padding, one line of text. Returns its width. */
export const drawChip = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  fg: string = COLORS.paper,
  bg: string = COLORS.inkSoft,
  border: string = COLORS.ink,
): number => {
  const w = chipWidth(text);
  ctx.fillStyle = border;
  ctx.fillRect(x, y, w, CHIP_H);
  ctx.fillStyle = bg;
  ctx.fillRect(x + 1, y + 1, w - 2, CHIP_H - 2);
  drawText(ctx, text, x + 3, y + 2, fg);
  return w;
};

/** A tick (7x7) for right / kept / done. */
export const drawTick = (ctx: CanvasRenderingContext2D, x: number, y: number, color: string = COLORS.good) =>
  drawText(ctx, '✓', x, y, color);

/** A cross (7x7) for wrong / removed. */
export const drawCross = (ctx: CanvasRenderingContext2D, x: number, y: number, color: string = COLORS.bad) =>
  drawText(ctx, 'X', x, y, color);

/** Text centred on x. */
export const drawCentred = (ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, color: string = COLORS.ink) =>
  drawText(ctx, text, Math.round(cx - (measureText(text) - 1) / 2), y, color);

/** A 1px line between two points (Bresenham), for traces and pointers. */
export const drawLine = (ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, color: string) => {
  x0 = Math.round(x0);
  y0 = Math.round(y0);
  x1 = Math.round(x1);
  y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  ctx.fillStyle = color;
  for (;;) {
    ctx.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x0 += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y0 += sy;
    }
  }
};

/** A dashed horizontal line (2 on, 2 off). */
export const drawDashedH = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, color: string) => {
  ctx.fillStyle = color;
  for (let i = 0; i < w; i += 4) ctx.fillRect(x + i, y, Math.min(2, w - i), 1);
};

/** A dashed vertical line (2 on, 2 off). */
export const drawDashedV = (ctx: CanvasRenderingContext2D, x: number, y: number, h: number, color: string) => {
  ctx.fillStyle = color;
  for (let i = 0; i < h; i += 4) ctx.fillRect(x, y + i, 1, Math.min(2, h - i));
};

/** Gold corner brackets around a rectangle: "this is the thing the cursor is on". */
export const drawBrackets = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string = COLORS.gold) => {
  ctx.fillStyle = color;
  const l = 3;
  ctx.fillRect(x, y, l, 1);
  ctx.fillRect(x, y, 1, l);
  ctx.fillRect(x + w - l, y, l, 1);
  ctx.fillRect(x + w - 1, y, 1, l);
  ctx.fillRect(x, y + h - 1, l, 1);
  ctx.fillRect(x, y + h - l, 1, l);
  ctx.fillRect(x + w - l, y + h - 1, l, 1);
  ctx.fillRect(x + w - 1, y + h - l, 1, l);
};

/** 0-1 clamp. */
export const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

/**
 * A cosmetic pulse (0 or 1, flipping every `period` seconds) driven by a room clock, never by wall time,
 * so pausing freezes it.
 */
export const blink = (t: number, period = 0.4): 0 | 1 => (Math.floor(t / period) % 2 === 0 ? 1 : 0);
