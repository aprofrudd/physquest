// Redesigned Testing Lab: a physiology lab you can read at a glance. Treadmill and gas cart top left, a cycle
// ergometer top right, a sprint lane with timing gates across the middle (the landmark), a lactate bench bottom
// right, a technician at his clipboard. The athlete waits at the start of the lane, so one map can later serve
// a runner, a cyclist or a boxer. Art lives in rooms/testing/kit.ts, tiles in testing-tiles.ts.
import { T } from '../../render/TileMap';
import type { MapData } from '../maps';
import type { SportData } from '../sports';
import { TILE, TECH_SPOT } from './testing-tiles';
import { drawLabLife } from './testing-life';

// Borders use the game's own wall tiles
const TL = T.WALL_CORNER_TL;
const TR = T.WALL_CORNER_TR;
const BL = T.WALL_CORNER_BL;
const BR = T.WALL_CORNER_BR;
const WT = T.WALL_TOP;
const WL = T.WALL_LEFT;
const WR = T.WALL_RIGHT;
const D = T.DOOR;
const N = T.NPC;

// The lab's own
const F = TILE.floor;
const WA = TILE.wall;
const CB = TILE.cabinet;
const BDL = TILE.boardLeft;
const BDR = TILE.boardRight;
const WNL = TILE.windowLeft;
const WNR = TILE.windowRight;
const CK = TILE.clock;
const TRR = TILE.treadmillRear;
const TRM = TILE.treadmillMid;
const TRC = TILE.treadmillConsole;
const TTR = TILE.treadmillRearTop;
const TTM = TILE.treadmillMidTop;
const TTC = TILE.treadmillConsoleTop;
const MNL = TILE.monitorLeft;
const MNR = TILE.monitorRight;
const CTT = TILE.cartTop;
const CTB = TILE.cartBase;
const EGA = TILE.ergoTopLeft;
const EGB = TILE.ergoTopRight;
const EGC = TILE.ergoBottomLeft;
const EGD = TILE.ergoBottomRight;
const LU = TILE.laneUpper;
const LL = TILE.laneLower;
const SU = TILE.startUpper;
const SL = TILE.startLower;
const FU = TILE.finishUpper;
const FL = TILE.finishLower;
const GU = TILE.gateUpper;
const GL = TILE.gateLower;
const CN = TILE.cone;
const AN = TILE.analyser;
const RK = TILE.rack;
const LP = TILE.laptop;
const CF = TILE.centrifuge;
const LG = TILE.log;
const WS = TILE.watches;
const BF = TILE.benchFront;
const WC = TILE.cooler;
const PL = TILE.plant;
const TC = TECH_SPOT;

/**
 * Pulls a "LT1 ..., LT2 ..." readout out of the level's data line, exactly as written there (null when the
 * data has none, so another sport's lab simply has one line on this equipment).
 */
export const thresholdReadout = (dataOutput: string): string | null => {
  const parts = dataOutput.split(', ');
  const lt1 = parts.find(p => p.startsWith('LT1 '));
  const lt2 = parts.find(p => p.startsWith('LT2 '));
  return lt1 && lt2 ? `${lt1}, ${lt2}` : null;
};

export const TESTING_LAB: MapData = {
  name: 'Testing Lab',
  palette: 'lab',
  tiles: [
    [TL, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, TR],
    [WL, CB, CB, BDL, BDR, WA, WA, MNL, MNR, WA, WNL, WNR, CK, CB, CB, WR],
    [WL, F, F, TTR, TTM, TTC, CTT, F, LG, WS, F, F, EGA, EGB, F, WR],
    [WL, F, TC, TRR, TRM, TRC, CTB, F, BF, BF, F, F, EGC, EGD, F, WR],
    [WL, F, F, F, F, F, F, F, F, F, F, F, F, F, F, WR],
    [WL, F, F, F, F, F, F, F, F, F, F, F, F, F, F, WR],
    [WL, F, CN, F, F, GU, F, F, F, F, GU, F, F, F, CN, WR],
    [WL, N, SU, LU, LU, LU, LU, LU, LU, LU, LU, LU, LU, LU, FU, WR],
    [WL, LL, SL, LL, LL, LL, LL, LL, LL, LL, LL, LL, LL, LL, FL, WR],
    [WL, F, CN, F, F, GL, F, F, F, F, GL, F, F, F, CN, WR],
    [WL, F, WC, F, F, F, F, F, F, F, F, AN, RK, LP, CF, WR],
    [WL, PL, F, F, F, F, F, F, F, F, F, BF, BF, BF, BF, WR],
    [WL, F, F, F, F, F, F, D, F, F, F, F, F, F, F, WR],
    [BL, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, BR],
  ],
  // At the start of the lane, on the lane's own surface; the tiles above her stay bare for the "!" bubble
  npcs: [{ x: 1, y: 7, dialogueKey: 'room1_athlete' }],
  npcFloor: LU,
  equipment: [
    // treadmill and the gas cart beside it
    { x: 3, y: 3, dialogueKey: 'room1_equip1' },
    { x: 4, y: 3, dialogueKey: 'room1_equip1' },
    { x: 5, y: 3, dialogueKey: 'room1_equip1' },
    { x: 3, y: 2, dialogueKey: 'room1_equip1' },
    { x: 6, y: 2, dialogueKey: 'room1_equip1' },
    { x: 6, y: 3, dialogueKey: 'room1_equip1' },
    // cycle ergometer
    { x: 12, y: 2, dialogueKey: 'room1_equip2' },
    { x: 13, y: 2, dialogueKey: 'room1_equip2' },
    { x: 12, y: 3, dialogueKey: 'room1_equip2' },
    { x: 13, y: 3, dialogueKey: 'room1_equip2' },
    // timing gates and cones
    { x: 5, y: 6, dialogueKey: 'room1_equip3' },
    { x: 10, y: 6, dialogueKey: 'room1_equip3' },
    { x: 5, y: 9, dialogueKey: 'room1_equip3' },
    { x: 10, y: 9, dialogueKey: 'room1_equip3' },
    { x: 2, y: 6, dialogueKey: 'room1_equip3' },
    { x: 2, y: 9, dialogueKey: 'room1_equip3' },
    { x: 14, y: 6, dialogueKey: 'room1_equip3' },
    { x: 14, y: 9, dialogueKey: 'room1_equip3' },
    // blood lactate analyser and the laptop on the bench
    { x: 11, y: 10, dialogueKey: 'room1_equip4' },
    { x: 11, y: 11, dialogueKey: 'room1_equip4' },
    { x: 13, y: 10, dialogueKey: 'room1_laptop' },
    { x: 13, y: 11, dialogueKey: 'room1_laptop' },
  ],
  doors: [{ x: 7, y: 12, target: 'hub' }],
  life: (ctx, t) => drawLabLife(ctx, t),
  talk: {
    // The shared line ("Testing equipment: Blood lactate analyser."), then what is on its display
    room1_equip4: (sport: SportData) => {
      const readout = thresholdReadout(sport.dataOutput);
      return readout ? ['Testing equipment: Blood lactate analyser.', `Display: ${readout}.`] : ['Testing equipment: Blood lactate analyser.'];
    },
    // The athlete's profile and goal, exactly as the briefing says them
    room1_laptop: (sport: SportData) => [sport.athleteProfile, `Goal: ${sport.goal}`],
  },
  describe:
    'Treadmill and gas analyser top left, cycle ergometer top right, a sprint lane with timing gates across the middle, the lactate bench bottom right. The athlete waits at the start of the lane.',
};
