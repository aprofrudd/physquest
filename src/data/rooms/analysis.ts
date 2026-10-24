// The redesigned Analysis Room: a warm wood briefing room. The wall shows what the review is about (a projector
// chart, a whiteboard with the noise band, a season planner with the race day circled), a conference table on a
// blue rug holds the laptop and papers, and the athlete waits at the head of it.
//
// Rules every room keeps: the player arrives at (7,10) facing up, the way out is the door at (7,12), all the
// floor is connected, and the athlete can be faced from a walkable tile with nothing busy above.
import { T } from '../../render/TileMap';
import type { MapData } from '../maps';
import { AT } from './analysis-tiles';
import { drawBriefingLife } from './analysis-life';
import { LEVEL_DATA } from '../sports';
import { contentFor } from '../../rooms/content';

const TL = T.WALL_CORNER_TL;
const TR = T.WALL_CORNER_TR;
const BL = T.WALL_CORNER_BL;
const BR = T.WALL_CORNER_BR;
const WT = T.WALL_TOP;
const WL = T.WALL_LEFT;
const WR = T.WALL_RIGHT;
const BK = T.BOOKSHELF;
const D = T.DOOR;
const N = T.NPC;

const f = AT.FLOOR;
const p = AT.FLOOR_SOLID; // where a person stands (they are drawn by the room's life)
const w = AT.WALL;
const d = AT.DADO;
const { RUG_TL, RUG_T, RUG_TR, RUG_L, RUG_C, RUG_R, RUG_BL, RUG_B, RUG_BR } = AT;
const ch = AT.CHAIR_FRONT;
const cb = AT.CHAIR_BACK;

const tiles: number[][] = [
  [TL, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, TR],
  [WL, BK, BK, w, w, w, w, w, w, w, w, w, w, BK, BK, WR],
  [WL, BK, BK, d, d, d, d, d, d, d, d, d, d, BK, BK, WR],
  [WL, f, f, f, f, f, f, f, p, f, f, f, f, f, AT.PLANT, WR],
  [WL, f, f, RUG_TL, RUG_T, RUG_T, RUG_T, RUG_T, RUG_T, RUG_T, RUG_T, RUG_T, RUG_TR, f, f, WR],
  [WL, AT.PRINTER, f, RUG_L, ch, RUG_C, ch, RUG_C, ch, RUG_C, RUG_C, RUG_C, RUG_R, f, AT.TROPHIES, WR],
  [WL, f, f, RUG_L, AT.TABLE_L, AT.TABLE_LAPTOP, AT.TABLE_M, AT.TABLE_PAPERS, AT.TABLE_M, AT.TABLE_JUG, AT.TABLE_R, N, RUG_R, f, f, WR],
  [WL, f, f, RUG_L, AT.APRON_L, AT.APRON_M, AT.APRON_M, AT.APRON_M, AT.APRON_M, AT.APRON_M, AT.APRON_R, RUG_C, RUG_R, f, f, WR],
  [WL, f, f, RUG_L, RUG_C, cb, cb, RUG_C, cb, RUG_C, RUG_C, RUG_C, RUG_R, f, f, WR],
  [WL, f, f, RUG_BL, RUG_B, RUG_B, RUG_B, RUG_B, RUG_B, RUG_B, RUG_B, RUG_B, RUG_BR, AT.COFFEE, AT.CUPS, WR],
  [WL, f, f, f, f, f, f, f, f, f, f, f, f, AT.COUNTER, AT.COUNTER, WR],
  [WL, AT.PLANT, f, f, f, f, f, f, f, f, f, f, f, f, f, WR],
  [WL, f, f, f, f, f, f, D, f, f, f, f, f, f, f, WR],
  [BL, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, BR],
];

export const BRIEFING_ROOM: MapData = {
  name: 'Analysis Room',
  palette: 'office',
  tiles,
  npcFloor: AT.ATHLETE_SEAT,
  npcs: [{ x: 11, y: 6, dialogueKey: 'room4_athlete' }],
  // Each wall picture can be looked at from any tile in front of it (the presenter stands in front of the whiteboard's first tile)
  equipment: [
    ...[3, 4, 5, 6, 7].map(x => ({ x, y: 2, dialogueKey: 'room4_screen1' })), // the projector
    ...[9, 10].map(x => ({ x, y: 2, dialogueKey: 'room4_screen2' })), // the whiteboard
    { x: 5, y: 6, dialogueKey: 'room4_screen3' }, // the laptop, from the gap between the chairs
    ...[11, 12].map(x => ({ x, y: 2, dialogueKey: 'room4_screen4' })), // the season planner
  ],
  doors: [{ x: 7, y: 12, target: 'hub' }],
  life: (ctx, t, sport) => drawBriefingLife(ctx, t, contentFor(LEVEL_DATA.indexOf(sport))?.analysis.weeks ?? 0),
  // The room's own lines for each thing: the existing prediction-model text, then the athlete's data where it fits
  talk: {
    room4_screen1: sport => ['Prediction model: Physiological adaptation curves.', sport.predictionScenario],
    room4_screen2: sport => ['Prediction model: Performance trajectory.', `Goal: ${sport.goal}`],
    room4_screen3: sport => ['Prediction model: Training load response.', sport.athleteProfile],
    room4_screen4: () => ['Prediction model: Competition readiness score.'],
  },
  describe:
    'A briefing room. A projector chart, a whiteboard with a noise band and a season planner hang on the far wall. ' +
    'A conference table on a blue rug fills the middle, with the athlete at its head. A printer, a shelf of trophies and a coffee machine stand round the edges.',
};
