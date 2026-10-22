// Minimal 5x7 pixel font — each char is 5 wide, 7 tall
// Stored as 7 rows of 5-bit bitmasks
const CHARS: Record<string, number[]> = {
  A: [0b01110, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
  B: [0b11110, 0b10001, 0b10001, 0b11110, 0b10001, 0b10001, 0b11110],
  C: [0b01110, 0b10001, 0b10000, 0b10000, 0b10000, 0b10001, 0b01110],
  D: [0b11110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b11110],
  E: [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b11111],
  F: [0b11111, 0b10000, 0b10000, 0b11110, 0b10000, 0b10000, 0b10000],
  G: [0b01110, 0b10001, 0b10000, 0b10111, 0b10001, 0b10001, 0b01110],
  H: [0b10001, 0b10001, 0b10001, 0b11111, 0b10001, 0b10001, 0b10001],
  I: [0b01110, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
  J: [0b00111, 0b00010, 0b00010, 0b00010, 0b00010, 0b10010, 0b01100],
  K: [0b10001, 0b10010, 0b10100, 0b11000, 0b10100, 0b10010, 0b10001],
  L: [0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b10000, 0b11111],
  M: [0b10001, 0b11011, 0b10101, 0b10101, 0b10001, 0b10001, 0b10001],
  N: [0b10001, 0b11001, 0b10101, 0b10011, 0b10001, 0b10001, 0b10001],
  O: [0b01110, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  P: [0b11110, 0b10001, 0b10001, 0b11110, 0b10000, 0b10000, 0b10000],
  Q: [0b01110, 0b10001, 0b10001, 0b10001, 0b10101, 0b10010, 0b01101],
  R: [0b11110, 0b10001, 0b10001, 0b11110, 0b10100, 0b10010, 0b10001],
  S: [0b01110, 0b10001, 0b10000, 0b01110, 0b00001, 0b10001, 0b01110],
  T: [0b11111, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00100],
  U: [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01110],
  V: [0b10001, 0b10001, 0b10001, 0b10001, 0b10001, 0b01010, 0b00100],
  W: [0b10001, 0b10001, 0b10001, 0b10101, 0b10101, 0b11011, 0b10001],
  X: [0b10001, 0b10001, 0b01010, 0b00100, 0b01010, 0b10001, 0b10001],
  Y: [0b10001, 0b10001, 0b01010, 0b00100, 0b00100, 0b00100, 0b00100],
  Z: [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b10000, 0b11111],
  '0': [0b01110, 0b10001, 0b10011, 0b10101, 0b11001, 0b10001, 0b01110],
  '1': [0b00100, 0b01100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
  '2': [0b01110, 0b10001, 0b00001, 0b00110, 0b01000, 0b10000, 0b11111],
  '3': [0b01110, 0b10001, 0b00001, 0b00110, 0b00001, 0b10001, 0b01110],
  '4': [0b00010, 0b00110, 0b01010, 0b10010, 0b11111, 0b00010, 0b00010],
  '5': [0b11111, 0b10000, 0b11110, 0b00001, 0b00001, 0b10001, 0b01110],
  '6': [0b01110, 0b10000, 0b10000, 0b11110, 0b10001, 0b10001, 0b01110],
  '7': [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b01000, 0b01000],
  '8': [0b01110, 0b10001, 0b10001, 0b01110, 0b10001, 0b10001, 0b01110],
  '9': [0b01110, 0b10001, 0b10001, 0b01111, 0b00001, 0b00001, 0b01110],
  ' ': [0b00000, 0b00000, 0b00000, 0b00000, 0b00000, 0b00000, 0b00000],
  '.': [0b00000, 0b00000, 0b00000, 0b00000, 0b00000, 0b00000, 0b00100],
  ',': [0b00000, 0b00000, 0b00000, 0b00000, 0b00000, 0b00100, 0b01000],
  '!': [0b00100, 0b00100, 0b00100, 0b00100, 0b00100, 0b00000, 0b00100],
  '?': [0b01110, 0b10001, 0b00001, 0b00110, 0b00100, 0b00000, 0b00100],
  ':': [0b00000, 0b00100, 0b00000, 0b00000, 0b00000, 0b00100, 0b00000],
  '-': [0b00000, 0b00000, 0b00000, 0b11111, 0b00000, 0b00000, 0b00000],
  '/': [0b00001, 0b00010, 0b00010, 0b00100, 0b01000, 0b01000, 0b10000],
  '(': [0b00010, 0b00100, 0b01000, 0b01000, 0b01000, 0b00100, 0b00010],
  ')': [0b01000, 0b00100, 0b00010, 0b00010, 0b00010, 0b00100, 0b01000],
  '%': [0b11001, 0b11010, 0b00010, 0b00100, 0b01000, 0b01011, 0b10011],
  '+': [0b00000, 0b00100, 0b00100, 0b11111, 0b00100, 0b00100, 0b00000],
  '=': [0b00000, 0b00000, 0b11111, 0b00000, 0b11111, 0b00000, 0b00000],
  '>': [0b01000, 0b00100, 0b00010, 0b00001, 0b00010, 0b00100, 0b01000],
  '<': [0b00010, 0b00100, 0b01000, 0b10000, 0b01000, 0b00100, 0b00010],
  "'": [0b00100, 0b00100, 0b01000, 0b00000, 0b00000, 0b00000, 0b00000],
  '"': [0b01010, 0b01010, 0b00000, 0b00000, 0b00000, 0b00000, 0b00000],
  // UI and dialogue glyphs
  '&': [0b01100, 0b10010, 0b10100, 0b01000, 0b10101, 0b10010, 0b01101],
  '#': [0b01010, 0b01010, 0b11111, 0b01010, 0b11111, 0b01010, 0b01010],
  '*': [0b00000, 0b00100, 0b10101, 0b01110, 0b10101, 0b00100, 0b00000],
  ';': [0b00000, 0b00100, 0b00000, 0b00000, 0b00000, 0b00100, 0b01000],
  '_': [0b00000, 0b00000, 0b00000, 0b00000, 0b00000, 0b00000, 0b11111],
  '[': [0b01110, 0b01000, 0b01000, 0b01000, 0b01000, 0b01000, 0b01110],
  ']': [0b01110, 0b00010, 0b00010, 0b00010, 0b00010, 0b00010, 0b01110],
  '—': [0b00000, 0b00000, 0b00000, 0b11111, 0b00000, 0b00000, 0b00000],
  '✓': [0b00000, 0b00001, 0b00010, 0b00100, 0b10100, 0b01000, 0b00000],
  '★': [0b00100, 0b10101, 0b01110, 0b11111, 0b01110, 0b01010, 0b00000],
  '•': [0b00000, 0b00000, 0b01110, 0b01110, 0b01110, 0b00000, 0b00000],
  '…': [0b00000, 0b00000, 0b00000, 0b00000, 0b00000, 0b00000, 0b10101],
  '→': [0b00000, 0b00100, 0b00010, 0b11111, 0b00010, 0b00100, 0b00000],
  '←': [0b00000, 0b00100, 0b01000, 0b11111, 0b01000, 0b00100, 0b00000],
  '↑': [0b00100, 0b01110, 0b10101, 0b00100, 0b00100, 0b00100, 0b00100],
  '↓': [0b00100, 0b00100, 0b00100, 0b00100, 0b10101, 0b01110, 0b00100],
  '▼': [0b00000, 0b00000, 0b11111, 0b01110, 0b00100, 0b00000, 0b00000],
};

const CHAR_W = 6; // 5px char + 1px gap
const CHAR_H = 8; // 7px char + 1px gap

// Each glyph is rasterised once per (colour, scale, char) and blitted with one drawImage. Scale is a
// whole number of screen pixels in every caller, so the cached canvas covers the same pixels fillRect did.
const glyphCache = new Map<string, Map<string, HTMLCanvasElement>>();

// Per-pixel fills, the original drawing method. Builds glyph canvases and serves partial-alpha draws.
const paintGlyph = (
  ctx: CanvasRenderingContext2D,
  bitmap: number[],
  x: number,
  y: number,
  color: string,
  scale: number
) => {
  ctx.fillStyle = color;
  for (let row = 0; row < 7; row++) {
    const bits = bitmap[row]!;
    for (let col = 0; col < 5; col++) {
      if (bits & (1 << (4 - col))) ctx.fillRect(x + col * scale, y + row * scale, scale, scale);
    }
  }
};

const renderGlyph = (bitmap: number[], color: string, scale: number): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = 5 * scale;
  canvas.height = 7 * scale;
  paintGlyph(canvas.getContext('2d')!, bitmap, 0, 0, color, scale);
  return canvas;
};

export const drawText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  scale: number = 1
) => {
  // One string key per call, so the per-character lookups below allocate nothing
  const styleKey = `${color}|${scale}`;
  let glyphs = glyphCache.get(styleKey);
  if (!glyphs) {
    glyphs = new Map<string, HTMLCanvasElement>();
    glyphCache.set(styleKey, glyphs);
  }

  // Partial alpha (the overworld room-label fade): drawImage rounds the blend differently from fillRect,
  // so those draws stay per pixel to match the original output exactly
  const partialAlpha = ctx.globalAlpha !== 1;

  const upper = text.toUpperCase();
  for (let i = 0; i < upper.length; i++) {
    const ch = upper[i]!;
    if (ch === ' ') continue; // blank glyph: nothing to paint, but the cursor still advances
    const gx = Math.floor(x + i * CHAR_W * scale);
    const gy = Math.floor(y);
    if (partialAlpha) {
      const bitmap = CHARS[ch];
      if (bitmap) paintGlyph(ctx, bitmap, gx, gy, color, scale);
      continue;
    }
    let glyph = glyphs.get(ch);
    if (!glyph) {
      const bitmap = CHARS[ch];
      if (!bitmap) continue; // unknown character: skipped, but it keeps its width
      glyph = renderGlyph(bitmap, color, scale);
      glyphs.set(ch, glyph);
    }
    ctx.drawImage(glyph, gx, gy);
  }
};

export const measureText = (text: string, scale: number = 1): number => {
  return text.length * CHAR_W * scale;
};

export { CHAR_W, CHAR_H };
