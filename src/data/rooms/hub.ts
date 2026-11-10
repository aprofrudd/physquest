// The Sports Performance Centre's lobby, for levels with an ATHLETE room (Distance Running): the Performance Director
// stands on the rug in the middle of the hall, and five department entrances and the arena lead off it. The layout
// (and what can be walked on, cell for cell) is the classic hub's with a fifth door bottom left, the ATHLETE room's;
// the look is the centre's own: tiles in hub-tiles.ts, door fronts and moving parts in hub-life.ts. The doors and the
// Director's cell keep their classic ids, which the engine looks for.
import { T } from '../../render/TileMap';
import type { MapData } from '../maps';
import { HUB_MAP } from '../maps';
import { DIRECTOR_KEY, MEET_DOOR } from '../meetDoor';
import { BOARD_SPOTS } from '../supportBoard';
import { MEET_MAP } from '../../state/GameState';
import { HUB_T as H, deptTiles } from './hub-tiles';
import { drawHubLife } from './hub-life';

const D = T.DOOR;
const N = T.NPC;
const B = T.BOSS_DOOR;

const PI = H.pillar;
const WN = H.wallNorth;
const BL = H.windowNorthL;
const BM = H.windowNorth;
const BR = H.windowNorthR;
const WL = H.wallLeft;
const WR = H.wallRight;
const LT = H.windowLeftTop;
const LB = H.windowLeftBottom;
const RT = H.windowRightTop;
const RB = H.windowRightBottom;
const CT = H.trophyTop;
const CB = H.trophyBottom;
const WS = H.wallSouth;
const DT = H.wallScreenTop;
const DB = H.wallScreenBottom;
const PT = H.posterTop;
const PB = H.posterBottom;
const AL = H.arenaWallL;
const AW = H.arenaWall;
const AR = H.arenaWallR;
const PL = H.plant;
const KS = H.kioskScreen;
const KC = H.kioskCounter;
const CN = H.console;
const CO = H.cooler;
const PH = H.podHead;
const PF = H.podFoot;
const G1 = H.rugTL;
const G2 = H.rugT;
const G3 = H.rugTR;
const G4 = H.rugBL;
const EM = H.rugEmblem;
const G6 = H.rugBR;
const G5 = H.rugB;

const te = deptTiles('testing');
const da = deptTiles('data');
const tr = deptTiles('training');
const an = deptTiles('analysis');
const at = deptTiles('athlete');

// Floor cells in the layout (negative, so they never clash with a tile id): plain stone, stone in the shadow of the
// wall or a department front above it, and a star inlaid either side of the arena doors. The slabs alternate in a
// checkerboard.
const _ = -1;
const S = -2;
const ST = -3;
const LL = -4; // sunlight from a window in the left wall
const LR = -5; // and the right

// prettier-ignore
const LAYOUT: number[][] = [
  [PI, WN, WN, WN, WN, BL, BM, BM, BM, BM, BR, WN, WN, WN, WN, PI],
  [WL, S,  S,  S,  te.bandL, te.band, te.bandR, S, S, da.bandL, da.band, da.bandR, S, S, S, WR],
  [WL, _,  PL, _,  te.pierL, D, te.pierR, _, _, da.pierL, D, da.pierR, _, PL, _, WR],
  [LT, LL, _,  _,  S,  S,  S,  _,  _,  S,  S,  S,  _,  _,  LR, RT],
  [LB, LL, _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  LR, RB],
  [WL, _,  KS, _,  _,  G1, G2, N,  G2, G3, _,  _,  _,  CO, _,  WR],
  [DT, _,  KC, _,  _,  G4, G5, EM, G5, G6, _,  _,  _,  PH, _,  PT],
  [DB, _,  CN, _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  PF, _,  PB],
  [WL, _,  PL, _,  tr.pierL, D, tr.pierR, _, _, an.pierL, D, an.pierR, _, PL, _, WR],
  [LT, LL, _,  _,  tr.bandL, tr.band, tr.bandR, _, _, an.bandL, an.band, an.bandR, _, _, _, CT],
  [LB, LL, _,  _,  S,  S,  S,  _,  _,  S,  S,  S,  _,  _,  _,  CB],
  [WL, _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  WR],
  [WL, _,  at.pierL, D, at.pierR, _, ST, B, B, ST, _, _, _, _, _, WR],
  [PI, WS, WS, WS, WS, WS, AL, AW, AW, AR, WS, WS, WS, WS, WS, PI],
];

/** The layout with its floor cells filled in: stone slabs in a checkerboard, shaded where marked. */
const tiles = LAYOUT.map((row, y) =>
  row.map((cell, x) => {
    if (cell >= 0) return cell;
    const alt = (x + y) % 2 === 1;
    if (cell === ST) return alt ? H.floorStarAlt : H.floorStar;
    // a sunlit patch covers the two cells beside a window: its upper cell is the one under the window's top
    const lower = LAYOUT[y - 1]?.[x] === cell;
    if (cell === LL) return lower ? (alt ? H.floorLitL2Alt : H.floorLitL2) : alt ? H.floorLitLAlt : H.floorLitL;
    if (cell === LR) return lower ? (alt ? H.floorLitR2Alt : H.floorLitR2) : alt ? H.floorLitRAlt : H.floorLitR;
    if (cell === S) return alt ? H.floorShadowAlt : H.floorShadow;
    return alt ? H.floorAlt : H.floor;
  }),
);

export const DIRECTOR_HUB: MapData = {
  name: HUB_MAP.name,
  palette: 'lab',
  tiles,
  npcs: [{ x: 7, y: 5, dialogueKey: DIRECTOR_KEY }],
  npcFloor: H.rugT,
  equipment: [...HUB_MAP.equipment, ...BOARD_SPOTS], // the SUPPORT BOARD, drawn over the north wall top left
  doors: [...HUB_MAP.doors, { x: MEET_DOOR.x, y: MEET_DOOR.y, target: MEET_MAP }],
  life: (ctx, t) => drawHubLife(ctx, t),
  describe:
    'The lobby of the Sports Performance Centre: polished stone, navy walls with a gold rail and tall windows. The Performance Director stands on the rug in the middle of the hall. TESTING and DATA entrances on the north wall, TRAINING and ANALYSIS entrances below the middle, each framed in its own colour, the ATHLETE room door bottom left and the gold ARENA doors bottom middle. A performance monitoring station stands on the left, a recovery station with a water cooler and a recovery pod on the right, and a trophy case is set into the right wall. The SUPPORT BOARD with your support scores hangs on the north wall, top left, above the plant.',
};
