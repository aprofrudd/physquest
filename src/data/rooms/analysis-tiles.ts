// The Analysis Room's tiles (ids 400-499), registered with the shared tile registry when this module is imported.
// Every picture here is composed from analysis-art.ts: floor under rug under furniture.
import { registerTiles, type TileDef } from '../../render/TileMap';
import {
  C,
  RUG_COLS,
  RUG_ROWS,
  ROOM_COLORS,
  chairBack,
  chairSeat,
  chairFront,
  coffeeCups,
  coffeeMachine,
  counterFront,
  floorWood,
  plant,
  printer,
  rugTile,
  stack,
  tableFront,
  tableTop,
  trophies,
  wallFace,
} from './analysis-art';

/** Tile ids of the briefing room. */
export const AT = {
  FLOOR: 400,
  FLOOR_SOLID: 401, // the same boards, for a person standing on them (people are drawn by the room's life)
  WALL: 402,
  DADO: 403,
  RUG_TL: 404,
  RUG_T: 405,
  RUG_TR: 406,
  RUG_L: 407,
  RUG_C: 408,
  RUG_R: 409,
  RUG_BL: 410,
  RUG_B: 411,
  RUG_BR: 412,
  CHAIR_FRONT: 413,
  CHAIR_BACK: 414,
  TABLE_L: 415,
  TABLE_M: 416,
  TABLE_R: 417,
  TABLE_LAPTOP: 418,
  TABLE_PAPERS: 419,
  TABLE_JUG: 420,
  APRON_L: 421,
  APRON_M: 422,
  APRON_R: 423,
  COFFEE: 424,
  CUPS: 425,
  COUNTER: 426,
  PLANT: 427,
  ATHLETE_SEAT: 428, // the tile under the athlete: her chair, pushed back from the table
  PRINTER: 429,
  TROPHIES: 430,
} as const;

const floor = floorWood();
const onFloor = (...layers: number[][][]) => stack(C.cream, floor, ...layers);
const onRug = (...layers: number[][][]) => stack(C.cream, floor, rugTile(1, 1), ...layers); // a middle tile of the rug

const solid = (pattern: number[][]): TileDef => ({ pattern, solid: true, colors: ROOM_COLORS });
const walk = (pattern: number[][]): TileDef => ({ pattern, colors: ROOM_COLORS });

registerTiles({
  [AT.FLOOR]: walk(onFloor()),
  [AT.FLOOR_SOLID]: solid(onFloor()),
  [AT.WALL]: solid(wallFace(false)),
  [AT.DADO]: solid(wallFace(true)),
  [AT.RUG_TL]: walk(onFloor(rugTile(0, 0))),
  [AT.RUG_T]: walk(onFloor(rugTile(1, 0))),
  [AT.RUG_TR]: walk(onFloor(rugTile(RUG_COLS - 1, 0))),
  [AT.RUG_L]: walk(onFloor(rugTile(0, 1))),
  [AT.RUG_C]: walk(onFloor(rugTile(1, 1))),
  [AT.RUG_R]: walk(onFloor(rugTile(RUG_COLS - 1, 1))),
  [AT.RUG_BL]: walk(onFloor(rugTile(0, RUG_ROWS - 1))),
  [AT.RUG_B]: walk(onFloor(rugTile(1, RUG_ROWS - 1))),
  [AT.RUG_BR]: walk(onFloor(rugTile(RUG_COLS - 1, RUG_ROWS - 1))),
  [AT.CHAIR_FRONT]: solid(onRug(chairFront())),
  [AT.CHAIR_BACK]: solid(onRug(chairBack())),
  [AT.TABLE_L]: solid(onRug(tableTop('left', 'none'))),
  [AT.TABLE_M]: solid(onRug(tableTop('middle', 'none'))),
  [AT.TABLE_R]: solid(onRug(tableTop('right', 'none'))),
  [AT.TABLE_LAPTOP]: solid(onRug(tableTop('middle', 'laptop'))),
  [AT.TABLE_PAPERS]: solid(onRug(tableTop('middle', 'papers'))),
  [AT.TABLE_JUG]: solid(onRug(tableTop('middle', 'jug'))),
  [AT.APRON_L]: solid(onRug(tableFront('left'))),
  [AT.APRON_M]: solid(onRug(tableFront('middle'))),
  [AT.APRON_R]: solid(onRug(tableFront('right'))),
  [AT.COFFEE]: solid(onFloor(coffeeMachine())),
  [AT.CUPS]: solid(onFloor(coffeeCups())),
  [AT.COUNTER]: solid(onFloor(counterFront())),
  [AT.PLANT]: solid(onFloor(plant())),
  [AT.ATHLETE_SEAT]: solid(onRug(chairSeat())),
  [AT.PRINTER]: solid(onFloor(printer())),
  [AT.TROPHIES]: solid(onFloor(trophies())),
});
