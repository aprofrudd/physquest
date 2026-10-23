// Tile art for the redesigned Data Lab (palette `data`, tile ids 200-299). Patterns are palette indices:
// 0 outline, 1 dark, 2 mid, 3 light, 4 background, 5 accent. Objects are baked onto the floor so every
// tile is opaque. Animated parts (screens, LEDs, paper, cable light) are drawn by datalab-life.ts.
import { registerTiles } from '../../render/TileMap';

export const DL = {
  FLOOR: 200,
  /** Floor under a seated analyst: solid, so nobody walks through them. */
  SEAT: 201,
  WALL_A: 202,
  WALL_B: 203,
  CONSOLE_L: 204,
  CONSOLE_R: 205,
  DESK_L: 206,
  DESK_R: 207,
  RACK_TOP: 208,
  RACK_BOTTOM: 209,
  PRINTER: 210,
  CABLE: 211,
  PLANT: 212,
  RESULTS_L: 213,
  RESULTS_R: 214,
  /** A cover plate where the cable run crosses the way in: walk-on, so the coach stands on a light tile. */
  CABLE_COVER: 215,
} as const;

type Grid = number[][];

/** A grid of palette indices that art is drawn into (-1 is transparent), with chainable drawing calls. */
interface Pix {
  readonly w: number;
  readonly h: number;
  readonly g: Grid;
  px(x: number, y: number, c: number): Pix;
  r(x: number, y: number, w: number, h: number, c: number): Pix;
  hl(x: number, y: number, w: number, c: number): Pix;
  vl(x: number, y: number, h: number, c: number): Pix;
  box(x: number, y: number, w: number, h: number, edge: number, fill: number): Pix;
  /** Paint another grid over this one wherever it is not transparent. */
  blit(src: Pix, ox?: number, oy?: number): Pix;
  /** The 16x16 tile at tile column tx and row ty; transparent pixels become `bg`. */
  tile(tx: number, ty: number, bg?: number): Grid;
}

const createPix = (w: number, h: number, fill = -1): Pix => {
  const g: Grid = Array.from({ length: h }, () => new Array<number>(w).fill(fill));
  const pix: Pix = {
    w,
    h,
    g,
    px(x, y, c) {
      if (x >= 0 && y >= 0 && x < w && y < h) g[y]![x] = c;
      return pix;
    },
    r(x, y, rw, rh, c) {
      for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) pix.px(x + i, y + j, c);
      return pix;
    },
    hl: (x, y, len, c) => pix.r(x, y, len, 1, c),
    vl: (x, y, len, c) => pix.r(x, y, 1, len, c),
    box(x, y, bw, bh, edge, inner) {
      pix.r(x, y, bw, bh, edge);
      return pix.r(x + 1, y + 1, bw - 2, bh - 2, inner);
    },
    blit(src, ox = 0, oy = 0) {
      for (let j = 0; j < src.h; j++) {
        for (let i = 0; i < src.w; i++) {
          const v = src.g[j]![i]!;
          if (v >= 0) pix.px(ox + i, oy + j, v);
        }
      }
      return pix;
    },
    tile(tx, ty, bg = 2) {
      return Array.from({ length: 16 }, (_, j) => Array.from({ length: 16 }, (_, i) => g[ty * 16 + j]?.[tx * 16 + i] ?? bg).map(v => (v < 0 ? bg : v)));
    },
  };
  return pix;
};

// ---- Floor: raised panels, lit from the top left --------------------------------------------------------------------

const floorPix = (): Pix => {
  const f = createPix(16, 16, 2);
  f.hl(0, 0, 16, 3).vl(0, 0, 16, 3).hl(0, 15, 16, 1).vl(15, 1, 15, 1).px(8, 8, 1);
  return f;
};
const FLOOR_PIX = floorPix();
const FLOOR = FLOOR_PIX.g;

/** The floor repeated over a w x h tile area, for baking an object onto it. */
const floorArea = (w: number, h: number): Pix => {
  const area = createPix(w * 16, h * 16);
  for (let y = 0; y < h * 16; y++) for (let x = 0; x < w * 16; x++) area.px(x, y, FLOOR[y % 16]![x % 16]!);
  return area;
};

// ---- Video wall backing (the five screens are drawn over it every frame) ---------------------------------------

const wallA = (): Grid => createPix(16, 16, 1).hl(0, 0, 16, 0).hl(0, 1, 16, 2).g;
const wallB = (): Grid => createPix(16, 16, 1).hl(0, 13, 16, 2).hl(0, 14, 16, 0).hl(0, 15, 16, 0).g;

// ---- Workstation: a monitor pair with a black glass (the traces are drawn over it), and a desk -----------------

const consolePair = (): [Grid, Grid] => {
  const o = createPix(32, 16);
  o.r(1, 1, 30, 12, 2).r(2, 2, 28, 10, 0).r(13, 13, 6, 2, 1).r(9, 14, 14, 2, 2).hl(1, 1, 30, 3);
  const c = floorArea(2, 1).blit(o);
  return [c.tile(0, 0), c.tile(1, 0)];
};

const deskPair = (papers: boolean): [Grid, Grid] => {
  const o = createPix(32, 16);
  o.r(0, 0, 32, 4, 3).r(0, 4, 32, 9, 2).hl(0, 4, 32, 1).hl(0, 13, 32, 0).r(0, 14, 32, 2, 0);
  o.vl(15, 6, 7, 1).hl(14, 8, 3, 3); // drawer handle
  if (papers) {
    // The results desk: a printout and a pen on the top
    o.r(6, 0, 10, 4, 4).hl(7, 1, 7, 2).hl(7, 2, 5, 2).r(20, 1, 6, 2, 5);
  } else {
    o.r(8, 1, 13, 3, 0).hl(9, 2, 11, 3); // keyboard
    o.r(23, 1, 2, 2, 0).r(3, 0, 3, 4, 5).px(4, 1, 4); // mouse and a mug
  }
  const c = floorArea(2, 1).blit(o);
  return [c.tile(0, 0), c.tile(1, 0)];
};

// ---- Server rack (LEDs are drawn over it) ------------------------------------------------------------------------

const rackTop = (): Grid => {
  const c = createPix(16, 16, 1).box(0, 0, 16, 16, 0, 1);
  for (let u = 0; u < 3; u++) {
    const y = 1 + u * 5;
    c.r(2, y, 12, 4, 2).hl(2, y, 12, 3).r(3, y + 2, 5, 1, 0).r(10, y + 1, 3, 2, 1);
  }
  return c.g;
};

const rackBottom = (): Grid => {
  const c = createPix(16, 16, 1).box(0, 0, 16, 16, 0, 1);
  for (let u = 0; u < 2; u++) {
    const y = 1 + u * 5;
    c.r(2, y, 12, 4, 2).hl(2, y, 12, 3).r(3, y + 2, 5, 1, 0).r(10, y + 1, 3, 2, 1);
  }
  c.r(2, 11, 12, 3, 0).hl(3, 12, 10, 1).r(1, 14, 14, 2, 0);
  return c.g;
};

/** LED positions on the rack tiles (x, y within the tile): drawn each frame by datalab-life.ts. */
export const RACK_LEDS_TOP: ReadonlyArray<readonly [number, number]> = [[11, 2], [12, 2], [11, 7], [12, 7], [11, 12], [12, 12]];
export const RACK_LEDS_BOTTOM: ReadonlyArray<readonly [number, number]> = [[11, 2], [12, 2], [11, 7], [12, 7]];

// ---- Printer: the body is baked in; the paper inching out is drawn each frame --------------------------------------

/** The printer with `paper` pixels of paper showing (0 to 4). */
export const printerPix = (paper: number): Grid => {
  const o = createPix(16, 16);
  o.r(2, 4, 12, 8, 2).hl(2, 4, 12, 3).r(4, 2, 8, 2, 4).r(3, 8, 10, 2, 1).r(11, 6, 2, 1, 5);
  if (paper > 0) o.r(5, 10, 6, paper, 4);
  o.r(2, 12, 12, 2, 1);
  const c = floorArea(1, 1).blit(o);
  return c.tile(0, 0);
};

// ---- Floor cable run: walk-on, light pulses along it are drawn each frame ------------------------------------------

const cable = (): Grid => {
  const c = floorArea(1, 1);
  c.r(0, 5, 16, 6, 0).hl(0, 5, 16, 2).hl(0, 10, 16, 2).hl(0, 7, 16, 1).hl(0, 8, 16, 1);
  return c.tile(0, 0);
};

const cableCover = (): Grid => {
  const c = floorArea(1, 1);
  // A plate the colour of the floor with a lit top edge and dark grooves: the cable runs under it
  c.r(0, 4, 16, 8, 0).r(1, 5, 14, 6, 2).hl(1, 5, 14, 3).hl(1, 10, 14, 1);
  for (let x = 4; x < 14; x += 4) c.vl(x, 6, 4, 1);
  return c.tile(0, 0);
};

// ---- Plant on the raised floor ------------------------------------------------------------------------------------

const PLANT_ART = [
  '4444444444444444',
  '4444440220444444',
  '4444022332204444',
  '4440233333320444',
  '4402332332332044',
  '4402323333232044',
  '4440233333320444',
  '4444023333204444',
  '4444400220044444',
  '4444440110444444',
  '4444001111004444',
  '4444055555504444',
  '4444055555504444',
  '4444055555504444',
  '4444000000004444',
  '4444444444444444',
];
const plant = (): Grid => PLANT_ART.map((row, y) => [...row].map((ch, x) => (ch === '4' ? FLOOR[y]![x]! : Number(ch))));

const [CONSOLE_L, CONSOLE_R] = consolePair();
const [DESK_L, DESK_R] = deskPair(false);
const [RESULTS_L, RESULTS_R] = deskPair(true);

const DEFS = {
  [DL.FLOOR]: { pattern: FLOOR },
  [DL.SEAT]: { pattern: FLOOR, solid: true },
  [DL.WALL_A]: { pattern: wallA(), solid: true },
  [DL.WALL_B]: { pattern: wallB(), solid: true },
  [DL.CONSOLE_L]: { pattern: CONSOLE_L, solid: true },
  [DL.CONSOLE_R]: { pattern: CONSOLE_R, solid: true },
  [DL.DESK_L]: { pattern: DESK_L, solid: true },
  [DL.DESK_R]: { pattern: DESK_R, solid: true },
  [DL.RACK_TOP]: { pattern: rackTop(), solid: true },
  [DL.RACK_BOTTOM]: { pattern: rackBottom(), solid: true },
  [DL.PRINTER]: { pattern: printerPix(0), solid: true },
  [DL.CABLE]: { pattern: cable() },
  [DL.CABLE_COVER]: { pattern: cableCover() },
  [DL.PLANT]: { pattern: plant(), solid: true },
  [DL.RESULTS_L]: { pattern: RESULTS_L, solid: true },
  [DL.RESULTS_R]: { pattern: RESULTS_R, solid: true },
};

registerTiles(DEFS);

/** Every pattern this room registered, by tile id (for tests: sizes and palette indices). */
export const DATALAB_PATTERNS: Readonly<Record<number, Grid>> = Object.fromEntries(Object.entries(DEFS).map(([id, def]) => [id, def.pattern]));
