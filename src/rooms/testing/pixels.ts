// A tiny pixel canvas for drawing the lab's art in code (no DOM, so tests can import it).
// Art is built once at start-up as grids of palette indices (-1 = clear), then sliced into 16x16 map tiles
// or turned into sprites, so the walk-around lab and the test stage share one set of drawings.

/** Rows of palette indices; -1 is see-through. */
export type Grid = number[][];

export const CLEAR = -1;

export interface Pixels {
  readonly w: number;
  readonly h: number;
  readonly grid: Grid;
  get(x: number, y: number): number;
  px(x: number, y: number, c: number): Pixels;
  rect(x: number, y: number, w: number, h: number, c: number): Pixels;
  hline(x: number, y: number, w: number, c: number): Pixels;
  vline(x: number, y: number, h: number, c: number): Pixels;
  /** A rectangle with a 1px edge and a fill (fill < 0 leaves the inside alone). */
  box(x: number, y: number, w: number, h: number, edge: number, fill: number): Pixels;
  line(x0: number, y0: number, x1: number, y1: number, c: number): Pixels;
  disc(cx: number, cy: number, radius: number, c: number): Pixels;
  /** Rows of text art: digits and letters look up `key` (digits default to their own index), '.' skips. */
  stamp(x: number, y: number, rows: readonly string[], key?: Readonly<Record<string, number>>): Pixels;
  /** Copy another canvas on top (clear pixels are skipped). */
  blit(src: Pixels, ox?: number, oy?: number): Pixels;
  clone(): Pixels;
  /** A 1px outline round every opaque pixel, drawn only onto clear pixels. */
  outline(c?: number): Pixels;
  /** Fill the whole canvas by repeating a 16x16 pattern. */
  tileFill(pattern: Grid): Pixels;
  /** The 16x16 tile at (tx, ty), clear pixels filled with `bg`. */
  slice(tx: number, ty: number, bg: number): Grid;
  /** A mirror image. */
  flipped(): Pixels;
}

export const createPixels = (w: number, h: number, fill: number = CLEAR): Pixels => {
  const grid: Grid = Array.from({ length: h }, () => new Array<number>(w).fill(fill));

  const self: Pixels = {
    w,
    h,
    grid,
    get: (x, y) => grid[y]?.[x] ?? CLEAR,
    px(x, y, c) {
      const row = grid[y];
      if (row && x >= 0 && x < w) row[x] = c;
      return self;
    },
    rect(x, y, rw, rh, c) {
      for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) self.px(x + i, y + j, c);
      return self;
    },
    hline: (x, y, len, c) => self.rect(x, y, len, 1, c),
    vline: (x, y, len, c) => self.rect(x, y, 1, len, c),
    box(x, y, bw, bh, edge, inside) {
      self.rect(x, y, bw, bh, edge);
      if (inside >= 0) self.rect(x + 1, y + 1, bw - 2, bh - 2, inside);
      return self;
    },
    line(x0, y0, x1, y1, c) {
      const dx = Math.abs(x1 - x0);
      const dy = -Math.abs(y1 - y0);
      const sx = x0 < x1 ? 1 : -1;
      const sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;
      for (;;) {
        self.px(x0, y0, c);
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
      return self;
    },
    disc(cx, cy, radius, c) {
      for (let j = -radius; j <= radius; j++) {
        for (let i = -radius; i <= radius; i++) {
          if (i * i + j * j <= radius * radius + radius * 0.8) self.px(cx + i, cy + j, c);
        }
      }
      return self;
    },
    stamp(x, y, rows, key = {}) {
      rows.forEach((row, j) => {
        [...row].forEach((ch, i) => {
          if (ch === '.' || ch === ' ') return;
          const v = key[ch] ?? (ch >= '0' && ch <= '9' ? Number(ch) : undefined);
          if (v !== undefined) self.px(x + i, y + j, v);
        });
      });
      return self;
    },
    blit(src, ox = 0, oy = 0) {
      for (let j = 0; j < src.h; j++) {
        for (let i = 0; i < src.w; i++) {
          const v = src.grid[j]?.[i] ?? CLEAR;
          if (v !== CLEAR) self.px(ox + i, oy + j, v);
        }
      }
      return self;
    },
    clone() {
      const copy = createPixels(w, h);
      copy.grid.forEach((row, j) => row.splice(0, w, ...(grid[j] ?? [])));
      return copy;
    },
    outline(c = 0) {
      const before = grid.map(row => row.slice());
      for (let j = 0; j < h; j++) {
        for (let i = 0; i < w; i++) {
          if ((before[j]?.[i] ?? CLEAR) !== CLEAR) continue;
          const touches = [before[j - 1]?.[i], before[j + 1]?.[i], before[j]?.[i - 1], before[j]?.[i + 1]].some(
            v => v !== undefined && v !== CLEAR,
          );
          if (touches) self.px(i, j, c);
        }
      }
      return self;
    },
    tileFill(pattern) {
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) self.px(i, j, pattern[j % 16]?.[i % 16] ?? CLEAR);
      return self;
    },
    slice(tx, ty, bg) {
      const out: Grid = [];
      for (let j = 0; j < 16; j++) {
        const row: number[] = [];
        for (let i = 0; i < 16; i++) {
          const v = grid[ty * 16 + j]?.[tx * 16 + i] ?? CLEAR;
          row.push(v === CLEAR ? bg : v);
        }
        out.push(row);
      }
      return out;
    },
    flipped() {
      const mirror = createPixels(w, h);
      mirror.grid.forEach((row, j) => row.splice(0, w, ...(grid[j] ?? []).slice().reverse()));
      return mirror;
    },
  };
  return self;
};

/**
 * A grid as a game sprite (see render/SpriteSheet drawSprite): 0 is see-through there, so every index moves
 * up by one and the colour list gets a blank first entry.
 */
export const toSprite = (grid: Grid): number[][] => grid.map(row => row.map(v => (v === CLEAR ? 0 : v + 1)));

/** Colours for sprites made with toSprite: a blank, then the palette. */
export const spriteColors = (palette: readonly string[]): string[] => ['', ...palette];
