// Redesigned Training Floor (Distance Running): a fenced running lane down the left with a jogger looping it, a
// coach with a stopwatch, four coach boards on the top wall (the same screens the challenge shows live), and a
// strength corner on the right with boxes, racks, ropes and cones. The athlete skips in the middle of the floor.
import { T, TILE_SIZE } from '../../render/TileMap';
import { DIALOGUES } from '../dialogue';
import type { MapData } from '../maps';
import { drawTrainingLife, ATHLETE_TILE, BOARD_W, BOARD_XS } from './training-life';
import { TRAIN } from './training-tiles';

const WT = T.WALL_TOP;
const WL = T.WALL_LEFT;
const WR = T.WALL_RIGHT;
const TL = T.WALL_CORNER_TL;
const TRC = T.WALL_CORNER_TR;
const BL = T.WALL_CORNER_BL;
const BR = T.WALL_CORNER_BR;
const D = T.DOOR;
const N = T.NPC;
const MT = T.MAT;

const F = TRAIN.FLOOR;
const W = TRAIN.WALL_FACE;
const BA = TRAIN.BANNER_L;
const BB = TRAIN.BANNER_R;
const LL = TRAIN.LANE_L;
const LR = TRAIN.LANE_R;
const SL = TRAIN.START_L;
const SR = TRAIN.START_R;
const FL = TRAIN.FINISH_L;
const FR = TRAIN.FINISH_R;
const TU = TRAIN.TURF;
const K1 = TRAIN.RACK_TL;
const K2 = TRAIN.RACK_TR;
const K3 = TRAIN.RACK_BL;
const K4 = TRAIN.RACK_BR;
const P1 = TRAIN.PLYO_LOW;
const P2 = TRAIN.PLYO_MID;
const P3 = TRAIN.PLYO_HIGH;
const DB = TRAIN.DUMBBELLS_TOP;
const DU = TRAIN.DUMBBELLS_BOTTOM;
const CN = TRAIN.CONE;
const PO = TRAIN.POST;
const LD = TRAIN.LADDER;
const CO = TRAIN.COACH_FLOOR;

// x:  0   1   2   3   4   5   6   7   8   9   10  11  12  13  14  15
const TILES: number[][] = [
  [TL, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, TRC],
  [WL, BA, BB, W,  W,  W,  W,  W,  W,  W,  W,  W,  W,  W,  W,  WR],
  [WL, FL, FR, TU, F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  WR],
  [WL, LL, LR, TU, F,  F,  F,  F,  F,  PO, P1, P2, P3, K1, K2, WR],
  [WL, LL, LR, TU, F,  F,  F,  F,  F,  F,  F,  F,  F,  K3, K4, WR],
  [WL, LL, LR, TU, F,  CO, F,  F,  F,  F,  F,  F,  F,  F,  F,  WR],
  [WL, LL, LR, TU, F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  DB, WR],
  [WL, LL, LR, TU, F,  F,  F,  F,  F,  F,  F,  N,  F,  F,  DU, WR],
  [WL, LL, LR, TU, F,  F,  CN, F,  F,  F,  F,  F,  F,  F,  F,  WR],
  [WL, LL, LR, TU, F,  F,  F,  F,  F,  F,  MT, MT, MT, MT, F,  WR],
  [WL, LL, LR, TU, CN, F,  F,  F,  F,  F,  MT, MT, MT, MT, F,  WR],
  [WL, SL, SR, TU, F,  F,  LD, LD, LD, LD, F,  F,  F,  F,  F,  WR],
  [WL, F,  F,  F,  F,  F,  F,  D,  F,  F,  F,  F,  F,  F,  F,  WR],
  [BL, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, BR],
];

/** The four boards, left to right, with the line each one reads (the keys keep their old names). */
const BOARDS = [
  { x: BOARD_XS[0], dialogueKey: 'room3_equip1' }, // ZONES: the training zone calculator
  { x: BOARD_XS[1], dialogueKey: 'room3_equip3' }, // INTERVAL: the interval timer station
  { x: BOARD_XS[2], dialogueKey: 'room3_equip4' }, // LEGS: the load monitoring display
  { x: BOARD_XS[3], dialogueKey: 'room3_equip2' }, // WEEK: the periodisation planner
] as const;

/** The wall tiles a board hangs over: all of them read it, so it works from anywhere under it, not just its middle. */
const boardTiles = (x: number): number[] => {
  const first = Math.floor(x / TILE_SIZE);
  const last = Math.floor((x + BOARD_W - 1) / TILE_SIZE);
  return Array.from({ length: last - first + 1 }, (_, i) => first + i);
};

export const TRAINING_FLOOR: MapData = {
  name: 'Training Floor',
  palette: 'track',
  tiles: TILES,
  npcFloor: TRAIN.FLOOR,
  npcs: [{ x: ATHLETE_TILE.x, y: ATHLETE_TILE.y, dialogueKey: 'room3_athlete' }],
  // Zones, interval timer, load monitor and planner: the four boards, each readable from every wall tile under it
  equipment: BOARDS.flatMap(board => boardTiles(board.x).map(x => ({ x, y: 1, dialogueKey: board.dialogueKey }))),
  doors: [{ x: 7, y: 12, target: 'hub' }],
  life: drawTrainingLife,
  talk: {
    // The calculator also reads out the level's zones, as sports.ts words them
    room3_equip1: sport => [
      ...(DIALOGUES['room3_equip1'] ?? []).map(line => line.text),
      ...sport.zones.map(zone => `${zone.name}: ${zone.description}`),
    ],
  },
  describe:
    'A fenced running track down the left with a jogger looping it, a coach with a stopwatch, four coach boards along the top wall, boxes, ropes and racks on the right, and the athlete skipping in the middle of the floor.',
};
