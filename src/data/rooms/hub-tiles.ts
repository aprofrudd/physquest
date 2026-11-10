// The Performance Director's hub (ids 600-699): the lobby of the Sports Performance Centre, in the colours of the
// building outside (CentreScene: glass, white frames, gold trim, a navy sign plate). Polished cream stone floor,
// navy panelled walls with a gold rail and white skirting, glass bays showing the sky, white pillars with gold caps,
// a pale rug with the centre's emblem under the Director, department entrances framed in each room's own colour, a
// performance monitoring station on the left and a recovery station on the right. Every tile shares one palette
// (HUB); each pattern is built once here and registered with the tile renderer when this module is imported.
// The doors themselves stay the classic DOOR / BOSS_DOOR tiles (the engine finds doors by id); hub-life.ts draws
// their glass fronts over them.
import { registerTiles, type TileDef } from '../../render/TileMap';

export type Pat = number[][];

const SIZE = 16;
const blank = (c: number, w = SIZE): Pat => Array.from({ length: SIZE }, () => Array<number>(w).fill(c));
const box = (p: Pat, x: number, y: number, w: number, h: number, c: number): Pat => {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (p[j] && i >= 0 && i < p[j]!.length) p[j]![i] = c;
  return p;
};
const dots = (p: Pat, pts: ReadonlyArray<readonly [number, number]>, c: number): Pat => {
  for (const [x, y] of pts) if (p[y] && x >= 0 && x < p[y]!.length) p[y]![x] = c;
  return p;
};
/** Character art: each character of `rows` that is in `key` sets that index; anything else leaves the pixel. */
const art = (p: Pat, x: number, y: number, rows: readonly string[], key: Readonly<Record<string, number>>): Pat => {
  rows.forEach((row, j) => {
    [...row].forEach((ch, i) => {
      const c = key[ch];
      if (c !== undefined && p[y + j] && x + i >= 0 && x + i < p[y + j]!.length) p[y + j]![x + i] = c;
    });
  });
  return p;
};
const mirror = (p: Pat): Pat => p.map(row => row.slice().reverse());

// ---- colours: one palette for every hub tile (index 0 is the outline) ----

export const HUB = [
  '#0c1626', // 0 outline
  '#16243a', // 1 navy
  '#22385a', // 2 navy panel
  '#2e4a72', // 3 navy highlight
  '#f4f6f8', // 4 white frame
  '#b8c4cc', // 5 white shade
  '#f4b81c', // 6 gold
  '#c2860a', // 7 gold dark
  '#ffe07a', // 8 gold pale
  '#efe4cc', // 9 stone
  '#ddcfb0', // 10 stone joint
  '#f8f2e2', // 11 stone sheen
  '#d6c8a8', // 12 stone shadow
  '#4ea6dc', // 13 glass
  '#8fd6f4', // 14 glass light
  '#e8fbff', // 15 glint
  '#5c6a78', // 16 steel
  '#3f9a48', // 17 leaf
  '#276a35', // 18 leaf dark
  '#78c860', // 19 leaf light
  '#2a6fb0', // 20 glass dark
  '#c8dcea', // 21 rug field
  '#e2eef6', // 22 rug light
  '#7c9ab2', // 23 rug line
  '#0e2430', // 24 screen
  '#1c4250', // 25 screen grid
  '#e04a3a', // 26 red
  '#7a4ab0', // 27 arena purple
  '#4e2c78', // 28 arena purple dark
  '#9e70d0', // 29 arena purple light
  '#c6b694', // 30 stone deep shadow
  // department accents, dark / mid / light: TESTING, DATA, TRAINING, ANALYSIS, ATHLETE
  '#2c5480', '#4878a8', '#88b8d8', // 31-33 testing blue
  '#2e8c9c', '#5cc8d8', '#a8e8f0', // 34-36 data cyan
  '#237a32', '#38a848', '#78d878', // 37-39 training green
  '#a87c44', '#dcb078', '#f0d8b0', // 40-42 analysis amber
  '#2f6a6a', '#4a8a86', '#7ab4ac', // 43-45 athlete teal
  '#d8573a', // 46 track red
] as const;

export const C = {
  OUT: 0,
  NAVY: 1,
  PANEL: 2,
  NAVYL: 3,
  WHITE: 4,
  SHADE: 5,
  GOLD: 6,
  GOLDD: 7,
  GOLDP: 8,
  STONE: 9,
  JOINT: 10,
  SHEEN: 11,
  SHADOW: 12,
  GLASS: 13,
  GLASSL: 14,
  GLINT: 15,
  STEEL: 16,
  LEAF: 17,
  LEAFD: 18,
  LEAFL: 19,
  GLASSD: 20,
  RUG: 21,
  RUGL: 22,
  RUGLINE: 23,
  SCREEN: 24,
  GRID: 25,
  RED: 26,
  PURP: 27,
  PURPD: 28,
  PURPL: 29,
  DEEP: 30,
  TRACK: 46,
} as const;

/** A department's three shades (palette indices). */
export interface Accent {
  d: number;
  m: number;
  l: number;
}
const accent = (first: number): Accent => ({ d: first, m: first + 1, l: first + 2 });
export const ACCENTS = {
  testing: accent(31),
  data: accent(34),
  training: accent(37),
  analysis: accent(40),
  athlete: accent(43),
} as const;
export type Dept = keyof typeof ACCENTS;

// ---- floor ----

/** A polished stone slab: joints along its top and left edges, a soft sheen; `alt` is the other checkerboard slab. */
const floor = (alt: boolean): Pat => {
  const p = blank(C.STONE);
  box(p, 0, 0, SIZE, 1, C.JOINT);
  box(p, 0, 0, 1, SIZE, C.JOINT);
  if (alt) {
    // a soft reflection
    dots(p, [[10, 4], [11, 3], [9, 5], [11, 4], [10, 5]], C.SHEEN);
    dots(p, [[4, 12]], C.JOINT);
  } else {
    dots(p, [[3, 3], [4, 3], [3, 4]], C.SHEEN);
    dots(p, [[11, 9], [7, 13]], C.JOINT); // flecks in the stone
  }
  return p;
};

/** The same slab in the shadow of a wall or a department front above it. */
const floorShadow = (alt: boolean): Pat => {
  const p = floor(alt);
  box(p, 0, 0, SIZE, 3, C.SHADOW);
  box(p, 0, 0, SIZE, 1, C.DEEP);
  for (let x = 0; x < SIZE; x += 2) dots(p, [[x, 3]], C.SHADOW);
  return p;
};

// ---- walls ----

/** North wall: a navy cap, panels, the gold rail, then white skirting at the floor. */
const wallNorth = (): Pat => {
  const p = blank(C.PANEL);
  box(p, 0, 0, SIZE, 1, C.OUT);
  box(p, 0, 1, SIZE, 1, C.NAVYL);
  box(p, 0, 2, SIZE, 1, C.NAVY);
  box(p, 7, 3, 1, 7, C.NAVY); // panel seams
  box(p, 8, 3, 1, 7, C.NAVYL);
  box(p, 0, 10, SIZE, 1, C.GOLD);
  box(p, 0, 11, SIZE, 1, C.GOLDD);
  box(p, 0, 12, SIZE, 1, C.PANEL);
  box(p, 0, 13, SIZE, 1, C.NAVY);
  box(p, 0, 14, SIZE, 1, C.WHITE);
  box(p, 0, 15, SIZE, 1, C.SHADE);
  return p;
};

/** Sky behind glass, inside a rectangle: blue at the top, light at the bottom, with fixed streaks of reflection. */
const sky = (p: Pat, x: number, y: number, w: number, h: number): Pat => {
  box(p, x, y, w, h, C.GLASS);
  box(p, x, y + Math.floor(h * 0.55), w, h - Math.floor(h * 0.55), C.GLASSL);
  for (let i = x; i < x + w; i += 2) dots(p, [[i, y + Math.floor(h * 0.55) - 1]], C.GLASSL); // a dithered horizon
  return p;
};

/**
 * One tile of the north glass bay: `part` -1 / 0 / 1 for its left end, a middle tile and its right end. White
 * mullions between the panes; the clouds and the passing glint are drawn by the life.
 */
export const BAY_GLASS = { top: 3, rows: 8 } as const;
const windowNorth = (part: -1 | 0 | 1): Pat => {
  const p = wallNorth();
  box(p, 0, 2, SIZE, 11, C.WHITE); // the frame
  const x0 = part < 0 ? 2 : 1;
  const x1 = part > 0 ? 13 : 14;
  sky(p, x0, BAY_GLASS.top, x1 - x0 + 1, BAY_GLASS.rows);
  if (part < 0) box(p, 0, 2, 1, 11, C.SHADE);
  if (part > 0) box(p, 15, 2, 1, 11, C.SHADE);
  box(p, 0, 11, SIZE, 1, C.WHITE); // the sill
  box(p, 0, 12, SIZE, 1, C.SHADE);
  // fixed reflections, a different streak on each kind of pane
  if (part < 0) dots(p, [[4, 9], [5, 8], [6, 7], [7, 6], [5, 9], [6, 8]], C.GLINT);
  else if (part > 0) dots(p, [[8, 10], [9, 9], [10, 8], [11, 7], [12, 6]], C.GLINT);
  else dots(p, [[10, 10], [11, 9], [12, 8], [11, 10], [12, 9]], C.GLINT);
  return p;
};

/** A white pillar with a gold cap, standing in a corner. */
const pillar = (): Pat => {
  const p = blank(C.NAVY);
  box(p, 0, 0, SIZE, 1, C.OUT);
  box(p, 2, 1, 12, 15, C.WHITE);
  box(p, 11, 1, 2, 15, C.SHADE);
  box(p, 2, 1, 1, 15, C.SHADE);
  box(p, 1, 1, 14, 1, C.GOLDP); // the cap
  box(p, 1, 2, 14, 2, C.GOLD);
  box(p, 1, 4, 14, 1, C.GOLDD);
  box(p, 1, 13, 14, 1, C.GOLD); // the foot
  box(p, 1, 14, 14, 1, C.GOLDD);
  box(p, 1, 15, 14, 1, C.OUT);
  box(p, 6, 6, 1, 6, C.SHADE); // flutes
  box(p, 9, 6, 1, 6, C.SHADE);
  return p;
};

/** The left wall (the right one is its mirror): dark edge, navy panels, a gold rail and white skirting. */
const wallSide = (): Pat => {
  const p = blank(C.PANEL);
  box(p, 0, 0, 2, SIZE, C.OUT);
  box(p, 2, 0, 1, SIZE, C.NAVYL);
  box(p, 3, 0, 1, SIZE, C.NAVY);
  box(p, 4, 0, 6, 1, C.NAVYL); // panel joint
  box(p, 4, 15, 6, 1, C.NAVY);
  box(p, 10, 0, 1, SIZE, C.GOLD);
  box(p, 11, 0, 1, SIZE, C.GOLDD);
  box(p, 12, 0, 1, SIZE, C.NAVY);
  box(p, 13, 0, 2, SIZE, C.WHITE);
  box(p, 15, 0, 1, SIZE, C.SHADE);
  return p;
};

/** A tall glass bay in the left wall, two tiles high: `top` is its upper tile. */
const windowSide = (top: boolean): Pat => {
  const p = wallSide();
  box(p, 3, 0, 10, SIZE, C.WHITE);
  box(p, 3, 0, 1, SIZE, C.SHADE);
  sky(p, 5, top ? 3 : 0, 6, 13);
  if (top) {
    box(p, 5, 3, 6, 6, C.GLASS);
    dots(p, [[5, 9], [7, 9], [9, 9]], C.GLASSL);
  } else {
    box(p, 5, 0, 6, 13, C.GLASSL);
    box(p, 3, 13, 10, 1, C.WHITE);
    box(p, 3, 14, 10, 1, C.SHADE);
    box(p, 3, 15, 10, 1, C.NAVY);
  }
  if (top) box(p, 3, 0, 10, 1, C.NAVY);
  if (!top) box(p, 5, 6, 6, 1, C.WHITE); // a transom bar
  // fixed reflections
  if (top) dots(p, [[6, 8], [7, 7], [8, 6], [9, 5], [7, 8], [8, 7]], C.GLINT);
  else dots(p, [[6, 11], [7, 10], [8, 9], [9, 8]], C.GLINT);
  return p;
};

/** The trophy case set into the right wall (drawn for the left, then mirrored), two tiles high. */
const trophyCase = (top: boolean): Pat => {
  const p = wallSide();
  box(p, 3, 0, 10, SIZE, C.WHITE);
  box(p, 4, top ? 2 : 0, 8, top ? 14 : 13, C.GLASSD);
  if (top) box(p, 3, 0, 10, 1, C.NAVY);
  const shelf = (y: number) => {
    box(p, 4, y, 8, 1, C.WHITE);
    box(p, 4, y + 1, 8, 1, C.SHADE);
  };
  if (top) {
    // a cup
    art(p, 5, 3, ['G....G', 'GPGGGG', '.GPGG.', '..GG..', '..GG..', '.GDDG.'], { G: C.GOLD, P: C.GOLDP, D: C.GOLDD });
    shelf(9);
    // a medal on a purple ribbon, and a small plaque
    art(p, 5, 11, ['PP.', '.P.', 'GGG', 'GPG', 'GGG'], { P: C.PURP, G: C.GOLD });
    art(p, 9, 13, ['DD', 'GG'], { G: C.GOLD, D: C.GOLDD });
  } else {
    shelf(0);
    // a runner's statuette on a plinth
    art(p, 6, 3, ['.GG.', '.GG.', 'GGG.', '.GGG', '.G.G', 'G...', 'DDDD'], { G: C.GOLD, D: C.GOLDD });
    shelf(10);
    box(p, 4, 12, 8, 1, C.GLASSD);
    box(p, 3, 13, 10, 1, C.WHITE);
    box(p, 3, 14, 10, 1, C.SHADE);
    box(p, 3, 15, 10, 1, C.NAVY);
  }
  dots(p, top ? [[11, 3], [10, 4]] : [[11, 5], [10, 6]], C.GLASS); // a glint on the glass
  return mirror(p);
};

/** A tall display in the left wall by the monitoring station, two tiles high: a trace, then a bar per department. */
const wallScreen = (top: boolean): Pat => {
  const p = wallSide();
  box(p, 3, 0, 10, SIZE, C.OUT);
  box(p, 4, top ? 2 : 0, 8, 14, C.SCREEN);
  if (top) {
    box(p, 3, 0, 10, 1, C.NAVY);
    box(p, 5, 3, 4, 1, C.WHITE); // a title
    art(p, 5, 6, ['.....T', '....T.', 'T..T..', '.TT...', '......', 'GGGGGG'], { T: C.GLASSL, G: C.GRID });
    for (let y = 2; y < SIZE; y += 3) dots(p, [[4, y]], C.GRID);
  } else {
    const bars: ReadonlyArray<readonly [number, number]> = [
      [ACCENTS.testing.m, 5],
      [ACCENTS.data.m, 7],
      [ACCENTS.training.m, 9],
      [ACCENTS.analysis.m, 6],
    ];
    bars.forEach(([c, h], i) => box(p, 4 + i * 2, 12 - h, 1, h, c));
    box(p, 4, 12, 8, 1, C.GRID);
    box(p, 3, 14, 10, 1, C.NAVY);
    box(p, 3, 15, 10, 1, C.NAVYL);
  }
  return p;
};

/** A gold-framed poster in the right wall, two tiles high: a runner on the track under a blue sky. */
const poster = (top: boolean): Pat => {
  const p = wallSide();
  box(p, 3, 0, 10, SIZE, C.GOLD);
  box(p, 3, 0, 1, SIZE, C.GOLDP);
  box(p, 12, 0, 1, SIZE, C.GOLDD);
  if (top) {
    box(p, 3, 0, 10, 1, C.NAVY);
    box(p, 3, 1, 10, 1, C.GOLDP);
    box(p, 4, 2, 8, 14, C.GLASS);
    box(p, 4, 9, 8, 7, C.GLASSL);
    art(p, 5, 6, ['..OO..', '..OO..', '.OOOO.', 'O.OO.O', '..OOO.', '.O..O.', 'O....O'], { O: C.NAVY }); // the runner
    dots(p, [[10, 3], [9, 3], [10, 4]], C.GOLDP); // the sun
  } else {
    box(p, 4, 0, 8, 2, C.GLASSL);
    box(p, 4, 2, 8, 9, C.TRACK); // the track
    box(p, 4, 4, 8, 1, C.WHITE);
    box(p, 4, 7, 8, 1, C.WHITE);
    box(p, 4, 10, 8, 1, C.WHITE);
    box(p, 4, 11, 8, 1, C.LEAF);
    box(p, 3, 12, 10, 1, C.GOLDD);
    box(p, 3, 13, 10, 1, C.NAVY);
    box(p, 3, 14, 10, 2, C.PANEL);
  }
  return mirror(p);
};

/** The south wall, seen from above: its navy top with a gold line. */
const wallSouth = (): Pat => {
  const p = blank(C.PANEL);
  box(p, 0, 0, SIZE, 1, C.WHITE);
  box(p, 0, 1, SIZE, 1, C.SHADE);
  box(p, 0, 2, SIZE, 1, C.NAVY);
  box(p, 0, 4, SIZE, 1, C.GOLD);
  box(p, 0, 5, SIZE, 1, C.GOLDD);
  box(p, 7, 6, 1, 8, C.NAVY);
  box(p, 8, 6, 1, 8, C.NAVYL);
  box(p, 0, 14, SIZE, 1, C.NAVY);
  box(p, 0, 15, SIZE, 1, C.OUT);
  return p;
};

/** The south wall under the arena entrance: purple panels between gold. `edge` -1 / 1 for the left / right end. */
const wallArena = (edge: -1 | 0 | 1): Pat => {
  const p = wallSouth();
  box(p, 0, 6, SIZE, 8, C.PURPD);
  box(p, 0, 6, SIZE, 1, C.PURP);
  if (edge !== 0) {
    // a gold pilaster at the outer end
    const x = edge < 0 ? 0 : 11;
    box(p, x, 0, 5, 15, C.GOLD);
    box(p, x, 0, 5, 1, C.GOLDP);
    box(p, edge < 0 ? x + 4 : x, 0, 1, 15, C.GOLDD);
    box(p, edge < 0 ? x : x + 4, 1, 1, 13, C.GOLDP);
    box(p, x, 14, 5, 1, C.GOLDD);
  } else {
    dots(p, [[3, 9], [12, 9]], C.GOLD);
  }
  return p;
};

// ---- the department entrances ----

/** Small white icons, one per department, 7 x 7. */
const ICONS: Record<Dept, readonly string[]> = {
  testing: ['..###..', '...#...', '.#####.', '#..#..#', '#..##.#', '#.....#', '.#####.'], // a stopwatch
  data: ['......#', '....#.#', '....#.#', '..#.#.#', '..#.#.#', '#.#.#.#', '#######'], // bars
  training: ['.......', '#.....#', '##...##', '#######', '##...##', '#.....#', '.......'], // a dumbbell
  analysis: ['......#', '.....#.', '#...#..', '.#.#...', '..#....', '.......', '#######'], // a rising line
  athlete: ['...##..', '...##..', '.####..', '#.##.#.', '..###..', '.#..#..', '#....#.'], // a runner
};

// The north entrances (TESTING, DATA) have their band above the door; the middle ones (TRAINING, ANALYSIS) below it,
// so their piers get a top edge of their own, as does the ATHLETE door, which has no band.
const CAPPED: Readonly<Record<Dept, boolean>> = { testing: false, data: false, training: true, analysis: true, athlete: true };

/**
 * The department's colour band above (or, for the middle pair, below) its door. It sits under the room's name
 * plate, so only its white edges show around it. `part` -1 / 0 / 1 for its left, middle and right tile.
 */
const fascia = (a: Accent, part: -1 | 0 | 1): Pat => {
  const p = blank(a.m);
  box(p, 0, 0, SIZE, 2, C.WHITE);
  box(p, 0, 2, SIZE, 1, a.l);
  box(p, 0, 12, SIZE, 1, a.d);
  box(p, 0, 13, SIZE, 2, C.WHITE);
  box(p, 0, 15, SIZE, 1, C.SHADE);
  if (part === -1) {
    box(p, 0, 0, 1, SIZE, C.OUT);
    box(p, 1, 0, 2, SIZE, C.WHITE);
  }
  if (part === 1) {
    box(p, 15, 0, 1, SIZE, C.OUT);
    box(p, 13, 0, 2, SIZE, C.SHADE);
  }
  return p;
};

/** A pier beside a department door (`capped` for an entrance with no colour band above it): a white pilaster and the department's colour panel (with its icon on the left). */
const pier = (dept: Dept, left: boolean, capped: boolean): Pat => {
  const a = ACCENTS[dept];
  const p = blank(a.m);
  box(p, 0, 0, 1, SIZE, C.OUT);
  box(p, 1, 0, 3, SIZE, C.WHITE);
  box(p, 3, 0, 1, SIZE, C.SHADE);
  box(p, 4, 0, 12, 1, a.d); // under the band above
  box(p, 4, 1, 1, 12, a.l);
  box(p, 13, 1, 1, 12, a.d);
  box(p, 14, 0, 2, SIZE, C.WHITE); // the door's white jamb
  if (left) {
    art(p, 5, 3, ICONS[dept], { '#': C.WHITE });
  } else {
    // a slim light panel
    box(p, 7, 3, 4, 8, a.l);
    box(p, 7, 3, 4, 1, C.WHITE);
    box(p, 10, 4, 1, 7, a.d);
  }
  box(p, 1, 13, 15, 1, C.WHITE); // the sill and the plinth
  box(p, 1, 14, 15, 1, C.STEEL);
  box(p, 0, 15, SIZE, 1, C.OUT);
  if (capped) {
    // nothing above this entrance: give it a top edge of its own
    box(p, 0, 0, SIZE, 1, C.OUT);
    box(p, 1, 1, 15, 1, C.WHITE);
    box(p, 4, 2, 10, 1, a.d);
  }
  return left ? p : mirror(p);
};

/** The glass double doors drawn over a department's DOOR tile (by the life). */
export const doorFront = (dept: Dept): Pat => {
  const a = ACCENTS[dept];
  const p = blank(a.m);
  box(p, 0, 0, SIZE, 1, C.OUT);
  box(p, 0, 1, SIZE, 1, a.l); // the header
  box(p, 0, 3, SIZE, 1, a.d);
  box(p, 0, 0, 1, SIZE, a.d);
  box(p, 15, 0, 1, SIZE, a.d);
  box(p, 1, 1, 1, 13, a.l);
  box(p, 2, 4, 12, 10, C.GLASSD); // two glass doors, the lobby's light on them
  box(p, 2, 4, 12, 1, C.OUT);
  box(p, 2, 10, 12, 4, C.GLASS);
  dots(p, [[2, 9], [4, 9], [6, 9], [9, 9], [11, 9], [13, 9]], C.GLASS);
  box(p, 7, 4, 2, 10, C.STEEL); // where the doors meet
  box(p, 7, 4, 1, 10, C.SHADE);
  box(p, 6, 7, 1, 3, C.WHITE); // handles
  box(p, 9, 7, 1, 3, C.WHITE);
  dots(p, [[3, 9], [4, 8], [5, 7], [6, 6], [3, 8], [4, 7], [5, 6], [10, 9], [11, 8], [12, 7], [13, 6]], C.GLASSL);
  box(p, 1, 14, 14, 1, C.STEEL); // the threshold
  box(p, 0, 15, SIZE, 1, a.d);
  box(p, 3, 15, 10, 1, a.m);
  if (CAPPED[dept]) box(p, 0, 1, SIZE, 1, C.WHITE); // the top edge its piers have
  box(p, 0, 0, SIZE, 1, C.OUT);
  return p;
};

/** The arena's gold-framed double doors, 32 x 16, drawn over the two BOSS_DOOR tiles (by the life). */
export const arenaFront = (): Pat => {
  const w = 32;
  const p = blank(C.GOLD, w);
  box(p, 0, 0, w, 1, C.OUT);
  box(p, 0, 1, w, 1, C.GOLDP);
  box(p, 0, 0, 1, SIZE, C.GOLDD);
  box(p, 1, 1, 1, 14, C.GOLDP);
  box(p, w - 1, 0, 1, SIZE, C.GOLDD);
  box(p, w - 2, 2, 1, 13, C.GOLDD);
  box(p, 3, 3, 26, 10, C.PURPD); // the doors
  box(p, 3, 3, 26, 1, C.OUT);
  for (const x0 of [4, 17]) {
    box(p, x0, 4, 11, 9, C.PURP);
    box(p, x0, 4, 11, 1, C.PURPL);
    box(p, x0 + 1, 6, 4, 5, C.PURPD); // panels
    box(p, x0 + 6, 6, 4, 5, C.PURPD);
    dots(p, [[x0 + 1, 6], [x0 + 6, 6]], C.PURPL);
  }
  box(p, 15, 3, 2, 10, C.GOLDD); // where they meet
  // the emblem across the seam: a gold star
  art(p, 12, 5, ['...P...', '..GPG..', 'GGGPGGG', '.GGPGG.', '..GGG..', '.GG.GG.', '.D...D.'], { G: C.GOLD, P: C.GOLDP, D: C.GOLDD });
  box(p, 2, 13, 28, 1, C.GOLDP); // the threshold
  box(p, 2, 14, 28, 1, C.GOLDD);
  box(p, 0, 15, w, 1, C.OUT);
  return p;
};

/** Stone lit by a side window: a soft patch of sunlight, slanting away from the left wall (mirrored for the right). */
const floorLit = (alt: boolean, fromLeft: boolean, lower: boolean): Pat => {
  const p = floor(alt);
  for (let y = 1; y < SIZE; y++) {
    const x0 = 1 + Math.floor((y + (lower ? SIZE : 0)) / 4); // one patch over two tiles, the window's height
    for (let x = x0; x < x0 + 8 && x < SIZE; x++) if (p[y]![x] !== C.JOINT) p[y]![x] = C.SHEEN;
  }
  return fromLeft ? p : mirror(p);
};

/** A star set into the floor either side of the arena doors: a gold-rimmed purple medallion in the stone. */
const floorStar = (alt: boolean): Pat => {
  const p = floor(alt);
  art(
    p,
    2,
    2,
    [
      '....GGGG....',
      '..GGPPPPGG..',
      '.GPPPPSPPPG.',
      '.GPPPSSPPPG.',
      'GPSSSSSSSSPG',
      'GPPSSSSSSPPG',
      'GPPPSSSSPPPG',
      'GPPSSPPSSPPG',
      '.GPSPPPPSPG.',
      '.GPPPPPPPPG.',
      '..GGPPPPGG..',
      '....GGGG....',
    ],
    { G: C.GOLD, P: C.PURP, S: C.GOLDP },
  );
  dots(p, [[6, 2], [7, 2], [4, 3], [3, 4]], C.GOLDP); // the rim catches the light
  dots(p, [[10, 13], [11, 12], [12, 11]], C.GOLDD);
  return p;
};

// ---- the rug under the Director ----

/**
 * The rug, five tiles wide and two deep. `col` -1 / 0 / 1 for its left edge, inside and right edge; `top` for its
 * upper row. A white border with a blue-grey line, a pale field of small diamonds.
 */
const rug = (col: -1 | 0 | 1, top: boolean): Pat => {
  const p = blank(C.RUG);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if ((x + y) % 8 === 0 || (x - y + 16) % 8 === 0) p[y]![x] = C.RUGL; // a trellis of diamonds
      if ((x + y) % 8 === 4 && (x - y + 16) % 8 === 4) p[y]![x] = C.RUGLINE; // a dot in each
    }
  }
  // the border: nested bands by distance from the rug's outer edge (so the corners mitre by themselves)
  const band = [C.RUGLINE, C.WHITE, C.RUGLINE, C.RUGLINE, C.WHITE] as const;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      let d = top ? y : SIZE - 1 - y;
      if (col < 0) d = Math.min(d, x);
      if (col > 0) d = Math.min(d, SIZE - 1 - x);
      if (d < band.length) p[y]![x] = band[d]!;
    }
  }
  if (col !== 0) dots(p, [[col < 0 ? 7 : SIZE - 8, top ? 7 : SIZE - 8]], C.RUGLINE); // a knot by the corner
  return p;
};

/** The middle of the rug's front row, with the centre's emblem: a running track inside a gold laurel. */
const rugEmblem = (): Pat => {
  const p = rug(0, false);
  box(p, 1, 0, 14, 11, C.RUG);
  art(
    p,
    1,
    0,
    [
      '...TTTTTTTT...',
      '..TWWWWWWWWT..',
      '.TWTTTTTTTTWT.',
      'GTWTFFFFFFTWTG',
      'GTWTFFFFFFTWTG',
      'GTWTFFFFFFTWTG',
      '.TWTTTTTTTTWT.',
      'G.TWWWWWWWWT.G',
      '.G.TTTTTTTT.G.',
      '..GG......GG..',
      '....GGGGGG....',
    ],
    { T: C.TRACK, W: C.WHITE, F: C.LEAFL, G: C.GOLD },
  );
  return p;
};

// ---- furniture ----

/** A plant in a navy planter with a gold rim, on the stone floor. */
const plant = (alt: boolean): Pat => {
  const p = floor(alt);
  // shadow on the floor
  box(p, 3, 14, 11, 2, C.SHADOW);
  // the planter
  box(p, 4, 9, 9, 6, C.PANEL);
  box(p, 4, 9, 9, 1, C.GOLDP);
  box(p, 4, 10, 9, 1, C.GOLD);
  box(p, 4, 11, 9, 1, C.GOLDD);
  box(p, 4, 9, 1, 6, C.OUT);
  box(p, 12, 9, 1, 6, C.OUT);
  box(p, 4, 15, 9, 1, C.OUT);
  box(p, 5, 12, 1, 3, C.NAVYL);
  // the leaves
  art(
    p,
    2,
    0,
    [
      '......D......',
      '...D.DLD.D...',
      '..DLDLLLDLD..',
      '.DLLLDLDLLLD.',
      'DLLHLDLDLHLLD',
      'DLHLDLLLDLHLD',
      '.DLDLLHLLDLD.',
      'DLLDLHLHLDLLD',
      '.DD.DLDLD.DD.',
      '....DDDDD....',
    ],
    { D: C.LEAFD, L: C.LEAF, H: C.LEAFL },
  );
  return p;
};

/** Performance monitoring: the kiosk's screen (its trace is drawn by the life) on a stand. */
const kioskScreen = (): Pat => {
  const p = floor(true);
  box(p, 1, 1, 14, 11, C.OUT);
  box(p, 2, 2, 12, 9, C.SCREEN);
  for (const y of [4, 7]) for (let x = 2; x < 14; x += 2) dots(p, [[x, y]], C.GRID);
  for (const x of [5, 9]) for (let y = 3; y < 11; y += 2) dots(p, [[x, y]], C.GRID);
  box(p, 1, 11, 14, 1, C.NAVY);
  dots(p, [[12, 11]], C.GOLD); // power light
  box(p, 7, 12, 2, 4, C.STEEL);
  box(p, 7, 12, 1, 4, C.SHADE);
  return p;
};

/** The kiosk's counter: a white top with a keyboard, a navy front with a gold stripe. */
const kioskCounter = (): Pat => {
  const p = floor(false);
  box(p, 2, 15, 13, 1, C.SHADOW);
  box(p, 1, 0, 14, 7, C.WHITE);
  box(p, 1, 0, 14, 1, C.SHADE);
  box(p, 7, 0, 2, 2, C.STEEL); // the screen's stand
  box(p, 3, 3, 10, 3, C.SHADE); // the keyboard
  for (let x = 4; x < 12; x += 2) dots(p, [[x, 4]], C.WHITE);
  box(p, 1, 7, 14, 7, C.PANEL);
  box(p, 1, 7, 14, 1, C.NAVY);
  box(p, 1, 9, 14, 1, C.GOLD);
  box(p, 1, 13, 14, 1, C.NAVY);
  box(p, 0, 0, 1, 14, C.OUT);
  box(p, 15, 0, 1, 14, C.OUT);
  box(p, 0, 14, SIZE, 1, C.OUT);
  return p;
};

/** The monitoring console: a pedestal with a tablet showing a heart rate and a chest strap beside it. */
const console_ = (): Pat => {
  const p = floor(true);
  box(p, 2, 15, 13, 1, C.SHADOW);
  box(p, 2, 1, 12, 13, C.PANEL);
  box(p, 1, 1, 14, 1, C.OUT);
  box(p, 1, 1, 1, 14, C.OUT);
  box(p, 14, 1, 1, 14, C.OUT);
  box(p, 1, 14, 14, 1, C.OUT);
  box(p, 2, 2, 12, 5, C.WHITE); // the top
  box(p, 2, 6, 12, 1, C.SHADE);
  box(p, 3, 2, 6, 4, C.OUT); // the tablet
  box(p, 4, 3, 4, 2, C.SCREEN);
  dots(p, [[4, 3], [6, 3], [5, 4]], C.RED); // a heart
  art(p, 9, 3, ['SSSS', 'S..S', '.SS.'], { S: C.STEEL }); // the strap
  box(p, 2, 8, 12, 1, C.GOLD);
  box(p, 4, 10, 3, 2, C.NAVY); // drawers
  box(p, 9, 10, 3, 2, C.NAVY);
  dots(p, [[5, 10], [10, 10]], C.NAVYL);
  return p;
};

/** Recovery: a water cooler, a blue bottle on a white dispenser. */
const waterCooler = (): Pat => {
  const p = floor(false);
  box(p, 3, 15, 11, 1, C.SHADOW);
  art(
    p,
    4,
    0,
    [
      '..OOOO..',
      '.OGLLGO.',
      'OGLLLLGO',
      'OGLWLLGO',
      'OGLWLLGO',
      'OGGLLGGO',
      '.OOGGOO.',
    ],
    { O: C.OUT, G: C.GLASS, L: C.GLASSL, W: C.GLINT },
  );
  box(p, 3, 7, 10, 8, C.WHITE);
  box(p, 10, 7, 3, 8, C.SHADE);
  box(p, 3, 7, 10, 1, C.SHADE);
  box(p, 2, 7, 1, 8, C.OUT);
  box(p, 13, 7, 1, 8, C.OUT);
  box(p, 2, 15, 12, 1, C.OUT);
  box(p, 5, 9, 5, 3, C.STEEL); // the alcove and its taps
  dots(p, [[6, 9]], C.RED);
  dots(p, [[8, 9]], C.GLASS);
  box(p, 5, 12, 5, 1, C.NAVY); // the drip tray
  return p;
};

/** Recovery: a pod for lying in, two tiles long; `head` is its upper tile, with the glass canopy. */
const recoveryPod = (head: boolean): Pat => {
  const p = floor(head);
  if (head) {
    art(
      p,
      1,
      1,
      [
        '...OOOOOOOO...',
        '..OWWWWWWWWO..',
        '.OWWGGGGGGWWO.',
        '.OWGLLLLLLGWO.',
        'OWWGLHLLLLGWWO',
        'OWGLHLLLLLLGWO',
        'OWGLLLLLLLLGWO',
        'OWGLLLLLLLLGWO',
        'OWGLLLLLLLLGWO',
        'OWGLLLLLLLLGWO',
        'OWGLLLLLLLLGWO',
        'OWGLLLLLLLLGWO',
        'OWGLLLLLLLLGWO',
        'OWGLLLLLLLLGWO',
        'OWGLLLLLLLLGWO',
      ],
      { O: C.OUT, W: C.WHITE, G: C.GLASS, L: C.GLASSL, H: C.GLINT },
    );
    box(p, 12, 6, 1, 10, C.SHADE);
  } else {
    art(
      p,
      1,
      0,
      [
        'OWGLLLLLLLLGWO',
        'OWGLLLLLLLLGWO',
        'OWGGGGGGGGGGWO',
        'OWWWWWWWWWWWWO',
        'OWTTTTTTTTTTWO',
        'OWWWWWWWWWWWWO',
        'OWSSWWWWWSSWWO',
        'OWSSWWWWWSSWWO',
        '.OWWWWWWWWWWO.',
        '.OSSSSSSSSSSO.',
        '..OOOOOOOOOO..',
      ],
      { O: C.OUT, W: C.WHITE, G: C.GLASS, L: C.GLASSL, T: ACCENTS.athlete.m, S: C.SHADE },
    );
    box(p, 12, 0, 1, 8, C.SHADE);
    box(p, 3, 11, 11, 2, C.SHADOW);
  }
  return p;
};

// ---- registration ----

export const HUB_T = {
  floor: 600,
  floorAlt: 601,
  floorShadow: 602,
  floorShadowAlt: 603,
  wallNorth: 604,
  windowNorthL: 605,
  windowNorthR: 606,
  windowNorth: 635,
  floorStar: 636,
  floorStarAlt: 637,
  floorLitL: 638,
  floorLitLAlt: 639,
  floorLitR: 665,
  floorLitRAlt: 666,
  floorLitL2: 667,
  floorLitL2Alt: 668,
  floorLitR2: 669,
  floorLitR2Alt: 670,
  wallScreenTop: 671,
  wallScreenBottom: 672,
  posterTop: 673,
  posterBottom: 674,
  pillar: 607,
  wallLeft: 608,
  wallRight: 609,
  windowLeftTop: 610,
  windowLeftBottom: 611,
  windowRightTop: 612,
  windowRightBottom: 613,
  trophyTop: 614,
  trophyBottom: 615,
  wallSouth: 616,
  arenaWallL: 617,
  arenaWall: 618,
  arenaWallR: 619,
  rugTL: 620,
  rugT: 621,
  rugTR: 622,
  rugBL: 623,
  rugB: 624,
  rugBR: 625,
  rugEmblem: 626,
  plant: 627,
  plantAlt: 628,
  kioskScreen: 629,
  kioskCounter: 630,
  console: 631,
  cooler: 632,
  podHead: 633,
  podFoot: 634,
  /** Per department: band left / middle / right, pier left / right (ids from 640, five apart). */
  testing: 640,
  data: 645,
  training: 650,
  analysis: 655,
  athlete: 660,
} as const;

/** A department's five tile ids: band left, middle, right (none for the ATHLETE door), then the piers left and right of its door. */
export const deptTiles = (dept: Dept) => {
  const base = HUB_T[dept];
  return { bandL: base, band: base + 1, bandR: base + 2, pierL: base + 3, pierR: base + 4 };
};

const tile = (pattern: Pat, solid: boolean): TileDef => ({ pattern, colors: HUB, solid });

const defs: Record<number, TileDef> = {
  [HUB_T.floor]: tile(floor(false), false),
  [HUB_T.floorLitL]: tile(floorLit(false, true, false), false),
  [HUB_T.floorLitLAlt]: tile(floorLit(true, true, false), false),
  [HUB_T.floorLitR]: tile(floorLit(false, false, false), false),
  [HUB_T.floorLitRAlt]: tile(floorLit(true, false, false), false),
  [HUB_T.floorLitL2]: tile(floorLit(false, true, true), false),
  [HUB_T.floorLitL2Alt]: tile(floorLit(true, true, true), false),
  [HUB_T.floorLitR2]: tile(floorLit(false, false, true), false),
  [HUB_T.floorLitR2Alt]: tile(floorLit(true, false, true), false),
  [HUB_T.floorStar]: tile(floorStar(false), false),
  [HUB_T.floorStarAlt]: tile(floorStar(true), false),
  [HUB_T.floorAlt]: tile(floor(true), false),
  [HUB_T.floorShadow]: tile(floorShadow(false), false),
  [HUB_T.floorShadowAlt]: tile(floorShadow(true), false),
  [HUB_T.wallNorth]: tile(wallNorth(), true),
  [HUB_T.windowNorthL]: tile(windowNorth(-1), true),
  [HUB_T.windowNorth]: tile(windowNorth(0), true),
  [HUB_T.windowNorthR]: tile(windowNorth(1), true),
  [HUB_T.pillar]: tile(pillar(), true),
  [HUB_T.wallLeft]: tile(wallSide(), true),
  [HUB_T.wallRight]: tile(mirror(wallSide()), true),
  [HUB_T.windowLeftTop]: tile(windowSide(true), true),
  [HUB_T.windowLeftBottom]: tile(windowSide(false), true),
  [HUB_T.windowRightTop]: tile(mirror(windowSide(true)), true),
  [HUB_T.windowRightBottom]: tile(mirror(windowSide(false)), true),
  [HUB_T.wallScreenTop]: tile(wallScreen(true), true),
  [HUB_T.wallScreenBottom]: tile(wallScreen(false), true),
  [HUB_T.posterTop]: tile(poster(true), true),
  [HUB_T.posterBottom]: tile(poster(false), true),
  [HUB_T.trophyTop]: tile(trophyCase(true), true),
  [HUB_T.trophyBottom]: tile(trophyCase(false), true),
  [HUB_T.wallSouth]: tile(wallSouth(), true),
  [HUB_T.arenaWallL]: tile(wallArena(-1), true),
  [HUB_T.arenaWall]: tile(wallArena(0), true),
  [HUB_T.arenaWallR]: tile(wallArena(1), true),
  [HUB_T.rugTL]: tile(rug(-1, true), false),
  [HUB_T.rugT]: tile(rug(0, true), false),
  [HUB_T.rugTR]: tile(rug(1, true), false),
  [HUB_T.rugBL]: tile(rug(-1, false), false),
  [HUB_T.rugB]: tile(rug(0, false), false),
  [HUB_T.rugBR]: tile(rug(1, false), false),
  [HUB_T.rugEmblem]: tile(rugEmblem(), false),
  [HUB_T.plant]: tile(plant(false), true),
  [HUB_T.plantAlt]: tile(plant(true), true),
  [HUB_T.kioskScreen]: tile(kioskScreen(), true),
  [HUB_T.kioskCounter]: tile(kioskCounter(), true),
  [HUB_T.console]: tile(console_(), true),
  [HUB_T.cooler]: tile(waterCooler(), true),
  [HUB_T.podHead]: tile(recoveryPod(true), true),
  [HUB_T.podFoot]: tile(recoveryPod(false), true),
};
for (const dept of Object.keys(ACCENTS) as Dept[]) {
  const ids = deptTiles(dept);
  const a = ACCENTS[dept];
  if (dept !== 'athlete') {
    defs[ids.bandL] = tile(fascia(a, -1), true);
    defs[ids.band] = tile(fascia(a, 0), true);
    defs[ids.bandR] = tile(fascia(a, 1), true);
  }
  defs[ids.pierL] = tile(pier(dept, true, CAPPED[dept]), true);
  defs[ids.pierR] = tile(pier(dept, false, CAPPED[dept]), true);
}

registerTiles(defs);
