// The ATHLETE room's map tiles (ids 500-599): a calm consultation room. Sage walls, a wooden floor, a window, a
// whiteboard, a clock, a kit shelf and a framed race bib on the back wall, a teal rug with a table (a notebook and two
// mugs on it) and two chairs in the middle. Each pattern is built once here from rectangles and dots, with its own
// colours, and registered with the tile renderer when this module is imported.
import { registerTiles, type TileDef } from '../../render/TileMap';

type Pat = number[][];

const SIZE = 16;
const blank = (c: number): Pat => Array.from({ length: SIZE }, () => Array<number>(SIZE).fill(c));
const box = (p: Pat, x: number, y: number, w: number, h: number, c: number): Pat => {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (p[j] && i >= 0 && i < SIZE) p[j]![i] = c;
  return p;
};
const dots = (p: Pat, pts: ReadonlyArray<readonly [number, number]>, c: number): Pat => {
  for (const [x, y] of pts) if (p[y] && x >= 0 && x < SIZE) p[y]![x] = c;
  return p;
};
/** A rectangle's outline only. */
const frame = (p: Pat, x: number, y: number, w: number, h: number, c: number): Pat => {
  box(p, x, y, w, 1, c);
  box(p, x, y + h - 1, w, 1, c);
  box(p, x, y, 1, h, c);
  box(p, x + w - 1, y, 1, h, c);
  return p;
};

// ---- colours (index 0 is always the outline) ----

/** Floor, table and chairs: warm oak. */
export const WOOD = ['#1a1410', '#5a3a22', '#9a6a3e', '#c89a64', '#dcb47c', '#e9cc98'] as const;
/** Back wall, whiteboard, clock and the bib frame: soft sage, with a red marker. */
export const WALLX = ['#1a1410', '#4a5a48', '#7f9c7c', '#c9d9bc', '#f8f6ee', '#c04a3a'] as const;
/** The window: frame, sky, cloud, wall, sill. */
export const SKYX = ['#1a1410', '#4a5a48', '#78aee0', '#f4f8fc', '#c9d9bc', '#e8e0c8'] as const;
/** The kit shelf: shelf wood, wall, orange spikes, a gold medal, blue kit. */
export const KITX = ['#1a1410', '#5a3a22', '#c9d9bc', '#e86a2a', '#f0c830', '#3868b8'] as const;
/** The rug: teal, on the oak floor. */
export const RUGX = ['#1a1410', '#2f6a6a', '#4a8a86', '#7ab4ac', '#dcb47c', '#c89a64'] as const;
/** The plants: leaves and a clay pot on the oak floor. */
export const PLANTX = ['#1a1410', '#2f6a3a', '#4a9a52', '#a8643a', '#dcb47c', '#c89a64'] as const;

// ---- patterns ----

/** Oak planks, four pixels deep, with staggered joints. */
const floor = (): Pat => {
  const p = blank(4);
  for (const y of [3, 7, 11, 15]) box(p, 0, y, SIZE, 1, 3);
  const joints = [6, 13, 2, 9];
  joints.forEach((x, i) => box(p, x, i * 4, 1, 3, 3));
  return dots(p, [[2, 1], [11, 5], [6, 9], [14, 13]], 5);
};

/** The back wall: sage, with a darker skirting at the foot. */
const wall = (): Pat => box(box(blank(3), 0, 12, SIZE, 1, 1), 0, 13, SIZE, 3, 2);

const windowHalf = (left: boolean): Pat => {
  const p = box(box(blank(4), 0, 13, SIZE, 3, 4), 0, 12, SIZE, 1, 5);
  const x0 = left ? 2 : 0;
  const x1 = left ? 15 : 13; // inclusive
  box(p, x0, 2, x1 - x0 + 1, 10, 1); // the frame
  box(p, left ? 3 : 0, 3, left ? 12 : 13, 8, 2); // the sky (the mullion is the frame between the two halves)
  if (!left) box(p, 0, 3, 1, 8, 1);
  box(p, left ? 1 : 0, 12, left ? 15 : 15, 1, 5); // the sill
  box(p, left ? 1 : 0, 13, left ? 15 : 15, 1, 1);
  return p;
};

const boardHalf = (left: boolean): Pat => {
  const p = wall();
  const x0 = left ? 1 : 0;
  const w = left ? 15 : 15;
  box(p, x0, 2, w, 9, 1); // frame
  box(p, left ? 2 : 0, 3, left ? 14 : 14, 7, 4); // white
  box(p, x0, 11, w, 1, 2); // the pen tray
  if (left) {
    box(p, 3, 4, 7, 1, 1); // "PHASE 1"
    box(p, 11, 4, 1, 1, 5);
    box(p, 3, 6, 10, 1, 2);
    box(p, 3, 8, 8, 1, 2);
    dots(p, [[6, 11], [7, 11]], 5); // a red pen in the tray
  } else {
    box(p, 1, 4, 6, 1, 5);
    box(p, 1, 6, 10, 1, 2);
    box(p, 1, 8, 7, 1, 2);
  }
  return p;
};

const clock = (): Pat => {
  const p = wall();
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const d = Math.hypot(x - 8, y - 7);
      if (d <= 5.6) p[y]![x] = d > 4.6 ? 0 : 4;
    }
  }
  dots(p, [[8, 3], [12, 7], [8, 11], [4, 7]], 2); // the hours
  return dots(p, [[8, 7], [7, 6], [6, 5]], 0); // the short hand; the second hand is drawn by the room's life
};

const shelfHalf = (left: boolean): Pat => {
  const p = box(box(blank(2), 0, 13, SIZE, 3, 2), 0, 12, SIZE, 1, 0);
  box(p, 0, 6, SIZE, 1, 1);
  box(p, 0, 7, SIZE, 1, 0);
  box(p, 0, 11, SIZE, 1, 1);
  if (left) {
    // a pair of racing spikes
    box(p, 2, 3, 5, 3, 3);
    box(p, 8, 3, 5, 3, 3);
    box(p, 2, 5, 6, 1, 0);
    box(p, 8, 5, 6, 1, 0);
    dots(p, [[2, 3], [8, 3]], 0);
    // a foam roller
    box(p, 2, 8, 11, 3, 5);
    box(p, 2, 8, 11, 1, 0);
    dots(p, [[5, 9], [8, 9], [11, 9]], 0);
  } else {
    // a medal on its ribbon
    dots(p, [[3, 0], [4, 1], [5, 2], [9, 0], [8, 1], [7, 2]], 5);
    box(p, 5, 3, 3, 3, 4);
    dots(p, [[5, 3], [7, 5]], 0);
    // a water bottle and a stopwatch
    box(p, 3, 8, 3, 3, 5);
    box(p, 4, 7, 1, 1, 0);
    box(p, 9, 8, 4, 3, 0);
    box(p, 10, 9, 2, 1, 4);
  }
  return p;
};

/** A race bib in a frame. */
const bib = (): Pat => {
  const p = wall();
  frame(p, 3, 2, 10, 10, 1);
  box(p, 4, 3, 8, 8, 4);
  box(p, 4, 3, 8, 2, 5);
  box(p, 5, 6, 2, 3, 0); // the number
  box(p, 8, 6, 3, 1, 0);
  box(p, 10, 7, 1, 1, 0);
  box(p, 8, 8, 3, 1, 0);
  return p;
};

/** One half of the table, seen from above: oak top, a darker front edge and legs. */
const tableHalf = (left: boolean): Pat => {
  const p = floor();
  const x0 = left ? 2 : 0;
  const w = left ? 14 : 14;
  box(p, x0, 3, w, 8, 3); // the top
  box(p, x0, 3, w, 1, 0);
  box(p, x0, 10, w, 1, 1);
  box(p, x0, 11, w, 2, 2); // the front edge
  box(p, x0, 13, w, 1, 0);
  if (left) box(p, 2, 3, 1, 11, 0);
  else box(p, 13, 3, 1, 11, 0);
  box(p, left ? 3 : 11, 13, 2, 2, 1); // a leg
  if (left) {
    // the notebook, open, with a pen beside it
    box(p, 5, 4, 7, 5, 5);
    box(p, 5, 4, 7, 1, 0);
    box(p, 8, 4, 1, 5, 2);
    box(p, 6, 6, 2, 1, 2);
    box(p, 9, 6, 2, 1, 2);
    box(p, 13, 5, 1, 4, 0);
  } else {
    // two mugs
    box(p, 3, 5, 4, 4, 0);
    box(p, 4, 6, 2, 2, 1);
    box(p, 8, 5, 4, 4, 0);
    box(p, 9, 6, 2, 2, 1);
    dots(p, [[7, 6], [12, 6]], 0);
  }
  return p;
};

const chair = (): Pat => {
  const p = floor();
  box(p, 3, 2, 10, 5, 1); // the back
  box(p, 3, 2, 10, 1, 0);
  box(p, 3, 7, 10, 5, 2); // the seat
  box(p, 3, 7, 10, 1, 0);
  box(p, 3, 11, 10, 1, 1);
  box(p, 3, 12, 2, 3, 1); // legs
  box(p, 11, 12, 2, 3, 1);
  return p;
};

/** The rug: teal, with a light diamond that repeats seamlessly from tile to tile. */
const rug = (): Pat => {
  const p = blank(2);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const d = Math.abs(x - 7.5) + Math.abs(y - 7.5);
      if (d >= 5 && d < 6) p[y]![x] = 3;
    }
  }
  return dots(p, [[0, 0], [15, 0], [0, 15], [15, 15], [7, 7], [8, 8], [7, 8], [8, 7]], 1);
};

const plant = (): Pat => {
  const p = floor();
  // pot
  box(p, 5, 10, 6, 5, 3);
  box(p, 4, 10, 8, 1, 0);
  box(p, 5, 15, 6, 1, 0);
  // leaves
  box(p, 4, 3, 3, 6, 2);
  box(p, 9, 3, 3, 6, 2);
  box(p, 6, 1, 4, 8, 1);
  dots(p, [[3, 5], [12, 5], [7, 0], [8, 0], [5, 2], [10, 2]], 2);
  return p;
};

// ---- registration ----

export const MEET = {
  floor: 500,
  wall: 501,
  windowLeft: 502,
  windowRight: 503,
  boardLeft: 504,
  boardRight: 505,
  clock: 506,
  shelfLeft: 507,
  shelfRight: 508,
  bib: 509,
  tableLeft: 510,
  tableRight: 511,
  chair: 512,
  rug: 513,
  plant: 514,
} as const;

const tile = (pattern: Pat, colors: readonly string[], solid: boolean): TileDef => ({ pattern, colors, solid });

registerTiles({
  [MEET.floor]: tile(floor(), WOOD, false),
  [MEET.wall]: tile(wall(), WALLX, true),
  [MEET.windowLeft]: tile(windowHalf(true), SKYX, true),
  [MEET.windowRight]: tile(windowHalf(false), SKYX, true),
  [MEET.boardLeft]: tile(boardHalf(true), WALLX, true),
  [MEET.boardRight]: tile(boardHalf(false), WALLX, true),
  [MEET.clock]: tile(clock(), WALLX, true),
  [MEET.shelfLeft]: tile(shelfHalf(true), KITX, true),
  [MEET.shelfRight]: tile(shelfHalf(false), KITX, true),
  [MEET.bib]: tile(bib(), WALLX, true),
  [MEET.tableLeft]: tile(tableHalf(true), WOOD, true),
  [MEET.tableRight]: tile(tableHalf(false), WOOD, true),
  [MEET.chair]: tile(chair(), WOOD, true),
  [MEET.rug]: tile(rug(), RUGX, false),
  [MEET.plant]: tile(plant(), PLANTX, true),
});
