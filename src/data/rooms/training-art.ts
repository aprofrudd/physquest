// A tiny pixel canvas for drawing the Training Floor's tile art in code: cells are palette indices (0-5 of the
// track palette: 0 outline, 1 dark green, 2 mid green, 3 light green, 4 floor, 5 orange), -1 is see-through.
// Objects are drawn on a see-through canvas, given a 1px outline, laid on the floor and cut into 16x16 tiles.

export type Grid = number[][];

export const TILE = 16;
export const CLEAR = -1;

export interface PixelCanvas {
  readonly w: number;
  readonly h: number;
  readonly grid: Grid;
  px(x: number, y: number, c: number): PixelCanvas;
  rect(x: number, y: number, w: number, h: number, c: number): PixelCanvas;
  hline(x: number, y: number, w: number, c: number): PixelCanvas;
  vline(x: number, y: number, h: number, c: number): PixelCanvas;
  /** A filled disc (the radius is rounded generously so small ones stay round). */
  disc(cx: number, cy: number, radius: number, c: number): PixelCanvas;
  /** Lay another canvas on top of this one (its see-through cells leave this one alone). */
  blit(src: PixelCanvas, ox?: number, oy?: number): PixelCanvas;
  /** A 1px outline (4-neighbour) around everything drawn, put only on see-through cells. */
  outline(c?: number): PixelCanvas;
  /** Fill every cell from a 16x16 tile, repeating it. */
  tileFill(tile: Grid): PixelCanvas;
  clone(): PixelCanvas;
  /** The 16x16 tile at (tx, ty); see-through cells become `bg`. */
  slice(tx: number, ty: number, bg?: number): Grid;
}

export const createCanvas = (w: number, h: number, fill: number = CLEAR): PixelCanvas => {
  const grid: Grid = Array.from({ length: h }, () => Array.from({ length: w }, () => fill));

  const self: PixelCanvas = {
    w,
    h,
    grid,
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
    disc(cx, cy, radius, c) {
      for (let j = -radius; j <= radius; j++) {
        for (let i = -radius; i <= radius; i++) {
          if (i * i + j * j <= radius * radius + radius * 0.8) self.px(cx + i, cy + j, c);
        }
      }
      return self;
    },
    blit(src, ox = 0, oy = 0) {
      for (let j = 0; j < src.h; j++) {
        for (let i = 0; i < src.w; i++) {
          const v = src.grid[j]?.[i];
          if (v !== undefined && v !== CLEAR) self.px(ox + i, oy + j, v);
        }
      }
      return self;
    },
    outline(c = 0) {
      const before = grid.map(row => row.slice());
      for (let j = 0; j < h; j++) {
        for (let i = 0; i < w; i++) {
          if (before[j]?.[i] !== CLEAR) continue;
          const near = [before[j - 1]?.[i], before[j + 1]?.[i], before[j]?.[i - 1], before[j]?.[i + 1]];
          if (near.some(v => v !== undefined && v !== CLEAR)) self.px(i, j, c);
        }
      }
      return self;
    },
    tileFill(tile) {
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) self.px(i, j, tile[j % TILE]?.[i % TILE] ?? CLEAR);
      return self;
    },
    clone() {
      const copy = createCanvas(w, h);
      copy.blit(self);
      return copy;
    },
    slice(tx, ty, bg = 4) {
      const out: Grid = [];
      for (let j = 0; j < TILE; j++) {
        const row: number[] = [];
        for (let i = 0; i < TILE; i++) {
          const v = grid[ty * TILE + j]?.[tx * TILE + i] ?? CLEAR;
          row.push(v === CLEAR ? bg : v);
        }
        out.push(row);
      }
      return out;
    },
  };
  return self;
};
