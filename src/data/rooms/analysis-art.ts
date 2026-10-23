// Pixel art for the Analysis Room (the briefing room): a tiny painter, the 16x16 tile pictures and the people.
// Pure data: nothing here touches the DOM, so the map can be built and tested without a canvas.
import { PALETTES } from '../../render/Palettes';

/** A picture as palette indices; -1 is see-through (what is underneath shows). */
export type Grid = number[][];

/**
 * The colours of every tile in this room. The first six are the room's own `office` palette (outline, dark,
 * mid, light, background, accent); the rest are the few extra inks a briefing room needs (a green leaf, a red flag).
 */
export const ROOM_COLORS: readonly string[] = [
  ...PALETTES.office.colors, // 0 outline, 1 dark wood, 2 mid wood, 3 light wood, 4 cream, 5 projector blue
  '#1f4f9a', // 6 deep blue
  '#e8c060', // 7 brass
  '#4aa04a', // 8 leaf green
  '#c83030', // 9 red
  '#ffffff', // 10 white
  '#9aa0a8', // 11 steel
  '#b07a10', // 12 dark gold (marker pen)
];

export const C = {
  outline: 0,
  dark: 1,
  mid: 2,
  light: 3,
  cream: 4,
  blue: 5,
  deepBlue: 6,
  brass: 7,
  green: 8,
  red: 9,
  white: 10,
  steel: 11,
  gold: 12,
} as const;

/** A painter over a Grid: rectangles, lines and an outline, enough for 16x16 furniture. */
export class Pix {
  readonly g: Grid;

  constructor(
    readonly w: number,
    readonly h: number,
    fill = -1,
  ) {
    this.g = Array.from({ length: h }, () => new Array<number>(w).fill(fill));
  }

  get(x: number, y: number): number {
    return this.g[y]?.[x] ?? -1;
  }

  px(x: number, y: number, color: number): this {
    const row = this.g[y];
    if (row && x >= 0 && x < this.w) row[x] = color;
    return this;
  }

  rect(x: number, y: number, w: number, h: number, color: number): this {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, color);
    return this;
  }

  hline(x: number, y: number, w: number, color: number): this {
    return this.rect(x, y, w, 1, color);
  }

  vline(x: number, y: number, h: number, color: number): this {
    return this.rect(x, y, 1, h, color);
  }

  /** A 1px outline around everything opaque, drawn only onto see-through pixels. */
  outline(color: number = C.outline): this {
    const src = this.g.map(row => row.slice());
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if ((src[y]?.[x] ?? -1) >= 0) continue;
        const near = [src[y - 1]?.[x], src[y + 1]?.[x], src[y]?.[x - 1], src[y]?.[x + 1]];
        if (near.some(v => v !== undefined && v >= 0)) this.px(x, y, color);
      }
    }
    return this;
  }
}

/** Lays pictures over each other (later ones on top) into a tile pattern: anything still see-through becomes `fallback`. */
export const stack = (fallback: number, ...layers: Grid[]): number[][] => {
  const out: number[][] = Array.from({ length: 16 }, () => new Array<number>(16).fill(fallback));
  for (const layer of layers) {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const v = layer[y]?.[x] ?? -1;
        if (v >= 0) (out[y] as number[])[x] = v;
      }
    }
  }
  return out;
};

// ---- the floor and the walls ------------------------------------------------------------------------------------------

/** Wooden planks: light boards with darker seams and staggered joints. */
export const floorWood = (): Grid => {
  const p = new Pix(16, 16, C.light);
  const joints = [3, 11, 7, 14];
  for (let r = 0; r < 4; r++) {
    p.hline(0, r * 4 + 3, 16, C.mid);
    p.vline(joints[r] ?? 0, r * 4, 3, C.mid);
  }
  p.px(6, 1, C.mid).px(13, 6, C.mid).px(2, 9, C.mid).px(9, 13, C.mid);
  return p.g;
};

/** The upper wall (cream with a dark cap line under the brick) and the panelled dado below it. */
export const wallFace = (dado: boolean): Grid => {
  const p = new Pix(16, 16, C.cream);
  if (!dado) return p.hline(0, 0, 16, C.dark).hline(0, 1, 16, C.light).g;
  p.hline(0, 8, 16, C.light).hline(0, 9, 16, C.dark).rect(0, 10, 16, 6, C.mid);
  p.vline(0, 10, 6, C.dark).vline(8, 10, 6, C.dark).hline(0, 10, 16, C.light).rect(0, 14, 16, 2, C.dark);
  return p.g;
};

// ---- the rug: a blue rug with a cream edge and tan flowers, fringed at the short ends ---------------------------------

export const RUG_COLS = 10;
export const RUG_ROWS = 6;

/** Where the pattern's little flowers sit (mod 16, in rug pixels): two a lattice cell apart, so every middle tile is alike. */
const FLOWERS: ReadonlyArray<readonly [number, number]> = [
  [7, 7],
  [15, 15],
];

/** A flower is a 2px cap over a 4px base: a little mound. */
const isFlower = (px: number, py: number): boolean =>
  FLOWERS.some(([ax, ay]) => {
    const dx = (px - ax + 16) % 16;
    const dy = (py - ay + 16) % 16;
    return (dy === 0 && dx <= 1) || (dy === 1 && (dx === 15 || dx <= 2));
  });

/** One pixel of the whole rug (its own pixel coordinates), or -1 for the floor showing through the fringe. */
const rugPixel = (px: number, py: number): number => {
  const w = RUG_COLS * 16;
  const h = RUG_ROWS * 16;
  if (px < 2 || px >= w - 2) return py % 3 === 0 ? C.cream : -1;
  const edge = Math.min(px - 2, w - 3 - px, py, h - 1 - py);
  if (edge < 2) return C.dark;
  if (edge < 4) return C.cream;
  return isFlower(px, py) ? C.light : C.blue;
};

/** The rug's tile at (tx, ty) counted from its top-left corner (0..RUG_COLS-1, 0..RUG_ROWS-1). */
export const rugTile = (tx: number, ty: number): Grid => {
  const p = new Pix(16, 16);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) p.px(x, y, rugPixel(tx * 16 + x, ty * 16 + y));
  return p.g;
};

// ---- chairs and the conference table (see-through backgrounds: the rug shows underneath) -------------------------------

/** A chair seen from the front (its back above its seat), as the colleagues and the athlete sit in them. */
export const chairFront = (): Grid => {
  const p = new Pix(16, 16);
  p.rect(3, 1, 10, 9, C.dark).rect(4, 2, 8, 7, C.mid).hline(4, 2, 8, C.light);
  p.rect(2, 10, 12, 3, C.dark).rect(3, 10, 10, 2, C.mid).rect(4, 13, 2, 2, C.dark).rect(10, 13, 2, 2, C.dark);
  return p.outline().g;
};

/** A chair seen from behind: the high back towards the viewer. */
export const chairBack = (): Grid => {
  const p = new Pix(16, 16);
  p.rect(2, 1, 12, 11, C.dark).rect(3, 2, 10, 9, C.mid).vline(8, 3, 7, C.dark).hline(3, 2, 10, C.light);
  p.rect(7, 12, 2, 2, C.dark).rect(3, 14, 3, 2, C.dark).rect(10, 14, 3, 2, C.dark);
  return p.outline().g;
};

/** The seat and legs of the chair the athlete stands at: her own sprite hides the back. */
export const chairSeat = (): Grid => {
  const p = new Pix(16, 16);
  p.rect(1, 9, 14, 5, C.dark).rect(2, 9, 12, 4, C.mid).hline(2, 9, 12, C.light);
  p.rect(3, 14, 2, 2, C.dark).rect(11, 14, 2, 2, C.dark);
  return p.outline().g;
};

export type TableEnd = 'left' | 'middle' | 'right';
export type TableThing = 'none' | 'laptop' | 'papers' | 'jug';

/** The top of the table: a tan surface with rounded ends, and a thing on it. */
export const tableTop = (end: TableEnd, thing: TableThing): Grid => {
  const p = new Pix(16, 16);
  p.hline(0, 1, 16, C.outline).rect(0, 2, 16, 11, C.light).hline(0, 2, 16, C.cream);
  p.hline(0, 12, 16, C.mid).hline(0, 13, 16, C.dark).hline(0, 14, 16, C.outline);
  if (end === 'left') p.vline(0, 1, 14, C.outline).vline(1, 2, 12, C.mid).px(0, 1, -1).px(0, 14, -1);
  if (end === 'right') p.vline(15, 1, 14, C.outline).vline(14, 2, 12, C.mid).px(15, 1, -1).px(15, 14, -1);
  if (thing === 'laptop') {
    p.rect(3, 3, 10, 5, C.outline).rect(4, 4, 8, 3, C.dark).px(8, 5, C.cream); // the screen and its cursor
    p.rect(2, 8, 12, 3, C.mid).hline(2, 8, 12, C.cream);
  }
  if (thing === 'papers') {
    p.rect(3, 4, 7, 6, C.cream).hline(4, 6, 5, C.mid).hline(4, 8, 4, C.mid);
    p.rect(10, 5, 4, 5, C.cream).hline(11, 7, 2, C.mid).px(12, 4, C.blue).px(2, 9, C.blue);
    p.rect(3, 4, 7, 1, C.light).vline(2, 4, 6, C.outline).vline(10, 4, 6, C.outline);
  }
  if (thing === 'jug') {
    p.rect(2, 4, 4, 6, C.blue).rect(3, 5, 2, 4, C.cream).rect(2, 3, 4, 1, C.outline); // the water jug
    p.rect(10, 6, 4, 4, C.cream).hline(10, 6, 4, C.mid).px(14, 7, C.cream).px(14, 8, C.cream); // the mug
  }
  return p.g;
};

/** The table's front edge (the apron) with legs at the ends; the middle is just apron. */
export const tableFront = (end: TableEnd): Grid => {
  const p = new Pix(16, 16);
  p.rect(0, 0, 16, 4, C.mid).hline(0, 0, 16, C.dark).hline(0, 3, 16, C.dark).hline(0, 4, 16, C.outline);
  if (end === 'left') p.vline(0, 0, 5, C.outline).rect(1, 4, 3, 10, C.dark).vline(1, 4, 10, C.mid).rect(1, 14, 4, 1, C.outline);
  if (end === 'right') p.vline(15, 0, 5, C.outline).rect(12, 4, 3, 10, C.dark).vline(12, 4, 10, C.mid).rect(11, 14, 4, 1, C.outline);
  return p.g;
};

// ---- the coffee corner ------------------------------------------------------------------------------------------------

/** A counter top with a coffee machine on it. */
export const coffeeMachine = (): Grid => {
  const p = new Pix(16, 16);
  p.rect(0, 11, 16, 5, C.light).hline(0, 11, 16, C.cream);
  p.rect(2, 1, 12, 10, C.dark).rect(3, 2, 10, 4, C.mid).rect(4, 3, 3, 2, C.blue).rect(5, 7, 6, 3, C.outline).rect(7, 8, 2, 2, C.cream).rect(11, 3, 2, 2, C.light);
  return p.outline().g;
};

/** A counter top with cups and a stack of paper cups. */
export const coffeeCups = (): Grid => {
  const p = new Pix(16, 16);
  p.rect(0, 11, 16, 5, C.light).hline(0, 11, 16, C.cream);
  p.rect(2, 4, 5, 7, C.cream).hline(2, 4, 5, C.light).rect(8, 7, 3, 4, C.cream).rect(12, 7, 3, 4, C.blue).hline(8, 7, 3, C.mid);
  return p.outline().g;
};

/** The cupboard fronts under the counter top. */
export const counterFront = (): Grid => {
  const p = new Pix(16, 16, C.mid);
  p.hline(0, 0, 16, C.cream).hline(0, 1, 16, C.light).vline(0, 2, 12, C.dark).vline(15, 2, 12, C.dark);
  p.rect(10, 5, 2, 4, C.blue).hline(0, 14, 16, C.dark).hline(0, 15, 16, C.outline);
  return p.g;
};

/** A potted plant with green leaves. */
export const plant = (): Grid => {
  const p = new Pix(16, 16);
  p.rect(5, 1, 6, 8, C.green).rect(3, 3, 10, 4, C.green).rect(6, 2, 2, 3, C.light).px(4, 4, C.light).px(11, 4, C.light);
  p.rect(7, 9, 2, 2, C.dark);
  p.rect(4, 11, 8, 4, C.mid).hline(4, 11, 8, C.dark).hline(4, 14, 8, C.dark);
  return p.outline().g;
};

/** A printer with paper in its tray and a status light. */
export const printer = (): Grid => {
  const p = new Pix(16, 16);
  p.rect(4, 2, 8, 6, C.white).hline(5, 4, 6, C.steel).hline(5, 6, 5, C.steel); // the paper in the tray
  p.rect(1, 7, 14, 7, C.steel).hline(1, 7, 14, C.white).rect(3, 10, 10, 2, C.dark).px(12, 9, C.green).px(13, 9, C.red);
  p.hline(2, 13, 12, C.dark);
  return p.outline().g;
};

/** A low cabinet with three trophies on top: the race the season is aimed at. */
export const trophies = (): Grid => {
  const p = new Pix(16, 16);
  p.rect(1, 9, 14, 6, C.mid).hline(1, 9, 14, C.light).vline(8, 10, 5, C.dark).hline(1, 14, 14, C.dark);
  p.px(7, 12, C.brass).px(9, 12, C.brass);
  for (const [x, h] of [[2, 5], [6, 7], [10, 5]] as const) {
    p.rect(x, 9 - h, 4, h - 2, C.brass).px(x + 1, 9 - h + 1, C.white); // the cup and its shine
    p.rect(x + 1, 7, 2, 1, C.brass).rect(x, 8, 4, 1, C.gold); // the stem and the base
  }
  return p.outline().g;
};

// ---- people: existing sprites, recoloured and re-posed ---------------------------------------------------------------

/** Sprites are 16x16 palette-index arrays (0 see-through, 1 outline, 2 hair, 3 skin, 4 shirt, 5 shirt 2, 6 white, 7 red). */
export type Sprite = number[][];

/** Copy of `base` with string-art patches: digits set that index, '_' clears, '.' leaves it. */
export const patch = (base: Sprite, ...patches: ReadonlyArray<readonly [number, number, readonly string[]]>): Sprite => {
  const out = base.map(row => row.slice());
  for (const [x, y, rows] of patches) {
    rows.forEach((text, j) => {
      [...text].forEach((ch, i) => {
        if (ch === '.') return;
        const row = out[y + j];
        if (row && x + i >= 0 && x + i < 16) row[x + i] = ch === '_' ? 0 : Number(ch);
      });
    });
  }
  return out;
};

/** Seated: no legs (the chair and the table cover them). */
export const seated = (base: Sprite): Sprite => base.map((row, y) => (y >= 13 ? new Array<number>(16).fill(0) : row.slice()));

/** Clothes for each person: outline, hair, skin, shirt, shirt 2, white, red. */
export const PEOPLE_COLORS: Readonly<Record<'presenter' | 'colleagueA' | 'colleagueB', string[]>> = {
  presenter: ['', '#100804', '#202020', '#e0b088', '#2a3a6a', '#8aa0d0', '#ffffff', '#e03030'],
  colleagueA: ['', '#100804', '#d8c070', '#c08860', '#a03850', '#e08898', '#ffffff', '#e03030'],
  colleagueB: ['', '#100804', '#583828', '#e0b088', '#707880', '#b0b8c0', '#ffffff', '#e03030'],
};
