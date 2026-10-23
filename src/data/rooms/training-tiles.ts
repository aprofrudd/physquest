// The Training Floor's tiles (ids 300-399), drawn in code with the track palette (0 outline, 1 dark green,
// 2 mid green, 3 light green, 4 floor, 5 orange): a fenced running lane with start and finish, a turf verge,
// a squat rack, plyo boxes, a dumbbell rack, cones, a battle-rope post and an agility ladder.
// Importing this file registers them with the tile renderer.
import { registerTiles, type TileDef } from '../../render/TileMap';
import { TILE, createCanvas, type Grid, type PixelCanvas } from './training-art';

export const TRAIN = {
  FLOOR: 300,
  WALL_FACE: 301,
  BANNER_L: 302,
  BANNER_R: 303,
  LANE_L: 304,
  LANE_R: 305,
  START_L: 306,
  START_R: 307,
  FINISH_L: 308,
  FINISH_R: 309,
  TURF: 310,
  RACK_TL: 311,
  RACK_TR: 312,
  RACK_BL: 313,
  RACK_BR: 314,
  PLYO_LOW: 315,
  PLYO_MID: 316,
  PLYO_HIGH: 317,
  DUMBBELLS_TOP: 318,
  DUMBBELLS_BOTTOM: 319,
  CONE: 320,
  POST: 321,
  LADDER: 322,
  COACH_FLOOR: 323,
} as const;

// ---- floor and wall --------------------------------------------------------------------------------------------

/** Rubber gym floor: a light tile with a loose scatter of flecks (placed by hand, so it never lines up into stripes). */
const FLECKS: ReadonlyArray<readonly [number, number]> = [[2, 2], [10, 1], [6, 6], [13, 8], [3, 11], [9, 13], [15, 4]];
const floorTile = (): Grid => {
  const c = createCanvas(TILE, TILE, 4);
  for (const [x, y] of FLECKS) c.px(x, y, 3);
  return c.grid;
};
const FLOOR = floorTile();

const floorCanvas = (tilesW: number, tilesH: number): PixelCanvas => createCanvas(tilesW * TILE, tilesH * TILE).tileFill(FLOOR);

/** The wall under the top brick row: a pale panel with a ledge on top and a skirting board at the bottom. */
const wallFaceCanvas = (tilesW = 1): PixelCanvas => {
  const w = TILE * tilesW;
  return createCanvas(w, TILE, 4)
    .hline(0, 0, w, 1)
    .hline(0, 1, w, 3)
    .hline(0, 10, w, 3)
    .rect(0, 11, w, 2, 2)
    .rect(0, 13, w, 3, 1);
};

/** Draw an object on a see-through canvas, give it an outline, and lay it on `ground`. */
const place = (ground: PixelCanvas, object: PixelCanvas): PixelCanvas => ground.blit(object.clone().outline());

// ---- the lane ---------------------------------------------------------------------------------------------------

/** One of the two lane tiles side by side: orange track with speckles, a solid white edge on the outside and a dashed line between. */
const laneCanvas = (left: boolean): PixelCanvas => {
  const c = createCanvas(TILE, TILE, 5);
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) if ((x * 3 + y * 7) % 29 === 0) c.px(x, y, 4);
  const dash = left ? 15 : 0;
  const edge = left ? 0 : 14;
  c.rect(edge, 0, 2, TILE, 4);
  for (let y = 0; y < TILE; y++) if (y % 6 < 4) c.px(dash, y, 4);
  return c;
};

const laneStart = (left: boolean): Grid => {
  const c = createCanvas(TILE, TILE).tileFill(laneCanvas(left).grid);
  c.rect(0, 12, TILE, 2, 4); // the start line
  c.rect(left ? 4 : 2, 6, 3, 4, 1).px(left ? 5 : 3, 7, 3); // starting block
  return c.grid;
};

const laneFinish = (left: boolean): Grid => {
  const c = createCanvas(TILE, TILE).tileFill(laneCanvas(left).grid);
  for (let y = 10; y < 14; y++) for (let x = 0; x < TILE; x++) c.px(x, y, (Math.floor(x / 4) + (y - 10 > 1 ? 1 : 0)) % 2 ? 0 : 4);
  return c.grid;
};

/** Mown turf: bands of two greens with flecks, and dark edges. */
const turfTile = (): Grid => {
  const c = createCanvas(TILE, TILE, 2);
  for (let y = 0; y < TILE; y++) if (Math.floor(y / 4) % 2 === 0) c.hline(0, y, TILE, 3);
  for (let y = 0; y < TILE; y++) for (let x = 0; x < TILE; x++) if ((x * 7 + y * 3) % 13 === 0) c.px(x, y, 1);
  c.vline(15, 0, TILE, 1).vline(0, 0, TILE, 1);
  return c.grid;
};

/** A chequered banner over the lane's finish (two tiles wide), hung on the wall. */
const bannerTiles = (): [Grid, Grid] => {
  const o = createCanvas(32, 16);
  o.rect(0, 1, 32, 2, 1);
  for (let y = 3; y < 14; y++) for (let x = 2; x < 30; x++) o.px(x, y, (Math.floor((x - 2) / 4) + Math.floor((y - 3) / 4)) % 2 ? 0 : 4);
  const c = place(wallFaceCanvas(2), o);
  return [c.slice(0, 0), c.slice(1, 0)];
};

// ---- the strength corner ----------------------------------------------------------------------------------------

/** A squat rack with a loaded bar, 2x2 tiles. */
const rackTiles = (): [Grid, Grid, Grid, Grid] => {
  const o = createCanvas(32, 32);
  o.rect(2, 26, 28, 5, 3).hline(2, 26, 28, 4).rect(2, 30, 28, 1, 2); // platform
  o.rect(4, 2, 3, 25, 1).vline(4, 2, 25, 2).rect(25, 2, 3, 25, 1).vline(25, 2, 25, 2); // uprights
  o.rect(4, 2, 24, 2, 1); // top bar
  o.rect(0, 11, 32, 2, 3).hline(0, 11, 32, 4); // the barbell
  o.disc(3, 12, 5, 5).disc(3, 12, 3, 1).disc(28, 12, 5, 5).disc(28, 12, 3, 1); // plates
  o.rect(7, 22, 18, 1, 2); // safety bar
  const c = place(floorCanvas(2, 2), o);
  return [c.slice(0, 0), c.slice(1, 0), c.slice(0, 1), c.slice(1, 1)];
};

/** A plyo box of the given height (px). */
const plyoTile = (height: number): Grid => {
  const o = createCanvas(TILE, TILE);
  const top = 15 - height;
  o.rect(2, top, 12, height, 5).rect(2, top, 12, 3, 3).hline(2, top, 12, 4);
  o.rect(3, Math.min(14, top + 5), 10, 1, 1);
  return place(floorCanvas(1, 1), o).slice(0, 0);
};

/** A dumbbell rack, two tiles tall: six dumbbells on two shelves. */
const dumbbellTiles = (): [Grid, Grid] => {
  const o = createCanvas(16, 32);
  o.rect(1, 2, 14, 28, 2).vline(1, 2, 28, 3).rect(2, 3, 12, 12, 1).rect(2, 17, 12, 12, 1);
  for (const y of [5, 9, 13, 19, 23, 27]) o.rect(3, y, 3, 2, 3).rect(10, y, 3, 2, 3).hline(6, y, 4, 4);
  o.rect(1, 15, 14, 2, 3);
  const c = place(floorCanvas(1, 2), o);
  return [c.slice(0, 0), c.slice(0, 1)];
};

const coneTile = (): Grid => {
  const o = createCanvas(TILE, TILE);
  o.rect(7, 3, 2, 3, 5).rect(6, 6, 4, 2, 4).rect(6, 8, 4, 1, 5).rect(5, 9, 6, 2, 5).rect(4, 11, 8, 2, 1);
  return place(floorCanvas(1, 1), o).slice(0, 0);
};

/** The post the battle ropes are tied to. */
const postTile = (): Grid => {
  const o = createCanvas(TILE, TILE);
  o.rect(6, 3, 4, 10, 1).vline(6, 3, 10, 2).rect(5, 12, 6, 3, 5).hline(5, 12, 6, 3);
  return place(floorCanvas(1, 1), o).slice(0, 0);
};

/** An agility ladder lying on the floor: rungs and a rail, repeated along four tiles. */
const ladderTile = (): Grid => {
  const c = floorCanvas(1, 1);
  c.rect(0, 4, TILE, 2, 5).rect(0, 10, TILE, 2, 5).rect(0, 4, 2, 8, 5);
  return c.grid;
};

// ---- registration -------------------------------------------------------------------------------------------------

const [BANNER_L, BANNER_R] = bannerTiles();
const [RACK_TL, RACK_TR, RACK_BL, RACK_BR] = rackTiles();
const [DUMBBELLS_TOP, DUMBBELLS_BOTTOM] = dumbbellTiles();

const solid = (pattern: Grid): TileDef => ({ pattern, solid: true });
const open = (pattern: Grid): TileDef => ({ pattern });

/** Every tile of the room, by id (exported so tests can check the art). */
export const TRAIN_TILES: Readonly<Record<number, TileDef>> = {
  [TRAIN.FLOOR]: open(FLOOR),
  [TRAIN.WALL_FACE]: solid(wallFaceCanvas().grid),
  [TRAIN.BANNER_L]: solid(BANNER_L),
  [TRAIN.BANNER_R]: solid(BANNER_R),
  // The lane is fenced: nobody can walk onto it, so the jogger looping it never meets the player
  [TRAIN.LANE_L]: solid(laneCanvas(true).grid),
  [TRAIN.LANE_R]: solid(laneCanvas(false).grid),
  [TRAIN.START_L]: solid(laneStart(true)),
  [TRAIN.START_R]: solid(laneStart(false)),
  [TRAIN.FINISH_L]: solid(laneFinish(true)),
  [TRAIN.FINISH_R]: solid(laneFinish(false)),
  [TRAIN.TURF]: open(turfTile()),
  [TRAIN.RACK_TL]: solid(RACK_TL),
  [TRAIN.RACK_TR]: solid(RACK_TR),
  [TRAIN.RACK_BL]: solid(RACK_BL),
  [TRAIN.RACK_BR]: solid(RACK_BR),
  [TRAIN.PLYO_LOW]: solid(plyoTile(6)),
  [TRAIN.PLYO_MID]: solid(plyoTile(10)),
  [TRAIN.PLYO_HIGH]: solid(plyoTile(14)),
  [TRAIN.DUMBBELLS_TOP]: solid(DUMBBELLS_TOP),
  [TRAIN.DUMBBELLS_BOTTOM]: solid(DUMBBELLS_BOTTOM),
  [TRAIN.CONE]: solid(coneTile()),
  [TRAIN.POST]: solid(postTile()),
  [TRAIN.LADDER]: open(ladderTile()),
  [TRAIN.COACH_FLOOR]: solid(FLOOR),
};

registerTiles(TRAIN_TILES);
