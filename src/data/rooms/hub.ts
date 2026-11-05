// The Sports Performance Centre for levels with an ATHLETE room (Distance Running): the classic hub with a fifth
// door, bottom left (the ATHLETE room, set into the bottom wall like the arena's), and the Performance Director
// standing where the hub athlete used to. The athlete herself is now met in the ATHLETE room. Classic tiles only.
import { T } from '../../render/TileMap';
import type { MapData } from '../maps';
import { HUB_MAP } from '../maps';
import { DIRECTOR_KEY, MEET_DOOR } from '../meetDoor';
import { MEET_MAP } from '../../state/GameState';

const F = T.FLOOR;
const D = T.DOOR;
const N = T.NPC;
const E = T.EQUIP;
const B = T.BOSS_DOOR;
const WT = T.WALL_TOP;
const WL = T.WALL_LEFT;
const WR = T.WALL_RIGHT;
const TL = T.WALL_CORNER_TL;
const TR = T.WALL_CORNER_TR;
const BL = T.WALL_CORNER_BL;
const BR = T.WALL_CORNER_BR;
const DK = T.DESK;
const BK = T.BOOKSHELF;
const MN = T.MONITOR;
const PL = T.PLANT;
const SN = T.SIGN;
const RG = T.RUG;

export const DIRECTOR_HUB: MapData = {
  name: HUB_MAP.name,
  palette: 'lab',
  tiles: [
    [TL, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, TR],
    [WL, F,  F,  F,  BK, SN, BK, F,  F,  BK, SN, BK, F,  F,  F,  WR],
    [WL, F,  PL, F,  WT, D,  WT, F,  F,  WT, D,  WT, F,  PL, F,  WR],
    [WL, F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  WR],
    [WL, F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  WR],
    [WL, F,  MN, F,  F,  RG, RG, N,  RG, RG, F,  F,  F,  MN, F,  WR],
    [WL, F,  DK, F,  F,  RG, RG, RG, RG, RG, F,  F,  F,  DK, F,  WR],
    [WL, F,  E,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  E,  F,  WR],
    [WL, F,  PL, F,  WT, D,  WT, F,  F,  WT, D,  WT, F,  PL, F,  WR],
    [WL, F,  F,  F,  BK, SN, BK, F,  F,  BK, SN, BK, F,  F,  F,  WR],
    [WL, F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  WR],
    [WL, F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  WR],
    [WL, F,  WT, D,  WT, F,  F,  B,  B,  F,  F,  F,  F,  F,  F,  WR],
    [BL, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, BR],
  ],
  npcs: [{ x: 7, y: 5, dialogueKey: DIRECTOR_KEY }],
  equipment: HUB_MAP.equipment,
  doors: [...HUB_MAP.doors, { x: MEET_DOOR.x, y: MEET_DOOR.y, target: MEET_MAP }],
  describe:
    'The Performance Director stands on the rug in the middle of the hall. TESTING and DATA doors on the north wall, TRAINING and ANALYSIS doors below the desks, the ATHLETE room door bottom left and the ARENA doors bottom middle.',
};
