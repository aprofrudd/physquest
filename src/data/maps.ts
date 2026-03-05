import { T } from '../render/TileMap';
import type { PaletteId } from '../render/Palettes';

// Map data: each room is a 2D array of tile types
// Maps are 16x14 tiles (256x224 pixels = one screen)

export interface MapData {
  tiles: number[][];
  palette: PaletteId;
  name: string;
  npcs: NpcData[];
  equipment: EquipData[];
  doors: DoorData[];
}

export interface NpcData {
  x: number;
  y: number;
  dialogueKey: string;
}

export interface EquipData {
  x: number;
  y: number;
  dialogueKey: string;
}

export interface DoorData {
  x: number;
  y: number;
  target: string;
}

// Shorthand aliases
const F = T.FLOOR;
const D = T.DOOR;
const N = T.NPC;
const E = T.EQUIP;
const A = T.FLOOR_ALT;
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
const TM = T.TREADMILL;
const BE = T.BENCH;
const MT = T.MAT;
const PL = T.PLANT;
const SN = T.SIGN;
const RG = T.RUG;

// Hub overworld — Sports Performance Centre
// Equipment E tiles placed on floor in front of desks (row 7) for interaction
export const HUB_MAP: MapData = {
  name: 'Sports Performance Centre',
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
    [WL, F,  F,  F,  F,  F,  F,  B,  B,  F,  F,  F,  F,  F,  F,  WR],
    [BL, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, BR],
  ],
  npcs: [
    { x: 7, y: 5, dialogueKey: 'hub_athlete' },
  ],
  equipment: [
    { x: 2, y: 7, dialogueKey: 'hub_equip_left' },
    { x: 13, y: 7, dialogueKey: 'hub_equip_right' },
  ],
  doors: [
    { x: 5, y: 2, target: 'room1' },
    { x: 10, y: 2, target: 'room2' },
    { x: 5, y: 8, target: 'room3' },
    { x: 10, y: 8, target: 'room4' },
    { x: 7, y: 12, target: 'boss' },
    { x: 8, y: 12, target: 'boss' },
  ],
};

// Room 1 — Testing Lab
// Monitors+desks along top, TM/BE as visual decor, E tiles on floor below for interaction
export const ROOM1_MAP: MapData = {
  name: 'Testing Lab',
  palette: 'lab',
  tiles: [
    [TL, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, TR],
    [WL, F,  MN, F,  F,  MN, F,  F,  F,  MN, F,  F,  MN, F,  F,  WR],
    [WL, F,  DK, F,  F,  DK, F,  F,  F,  DK, F,  F,  DK, F,  F,  WR],
    [WL, F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  BK, WR],
    [WL, F,  F,  F,  TM, F,  F,  F,  F,  F,  BE, F,  F,  F,  BK, WR],
    [WL, F,  F,  F,  E,  F,  F,  F,  F,  F,  E,  F,  F,  F,  F,  WR],
    [WL, F,  F,  F,  F,  F,  F,  N,  F,  F,  F,  F,  F,  F,  F,  WR],
    [WL, F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  WR],
    [WL, F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  WR],
    [WL, F,  F,  F,  E,  F,  F,  F,  F,  F,  E,  F,  F,  F,  F,  WR],
    [WL, F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  WR],
    [WL, F,  PL, F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  PL, F,  WR],
    [WL, F,  F,  F,  F,  F,  F,  D,  F,  F,  F,  F,  F,  F,  F,  WR],
    [BL, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, BR],
  ],
  npcs: [{ x: 7, y: 6, dialogueKey: 'room1_athlete' }],
  equipment: [
    { x: 4, y: 9, dialogueKey: 'room1_equip1' },
    { x: 10, y: 9, dialogueKey: 'room1_equip2' },
    { x: 4, y: 5, dialogueKey: 'room1_equip3' },
    { x: 10, y: 5, dialogueKey: 'room1_equip4' },
  ],
  doors: [{ x: 7, y: 12, target: 'hub' }],
};

// Room 2 — Data Analysis
// Monitors+desks in rows, E tiles on floor below for interaction
export const ROOM2_MAP: MapData = {
  name: 'Data Analysis',
  palette: 'gym',
  tiles: [
    [TL, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, TR],
    [WL, A,  A,  A,  A,  A,  A,  A,  A,  A,  A,  A,  A,  A,  A,  WR],
    [WL, A,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  A,  WR],
    [WL, A,  F,  MN, F,  F,  MN, F,  MN, F,  F,  MN, F,  F,  A,  WR],
    [WL, A,  F,  DK, F,  F,  DK, F,  DK, F,  F,  DK, F,  F,  A,  WR],
    [WL, A,  F,  E,  F,  F,  F,  F,  F,  F,  F,  E,  F,  F,  A,  WR],
    [WL, A,  F,  F,  F,  F,  F,  N,  F,  F,  F,  F,  F,  F,  A,  WR],
    [WL, A,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  A,  WR],
    [WL, A,  F,  F,  E,  F,  F,  F,  F,  F,  E,  F,  F,  F,  A,  WR],
    [WL, A,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  A,  WR],
    [WL, A,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  A,  WR],
    [WL, A,  A,  A,  A,  A,  A,  A,  A,  A,  A,  A,  A,  A,  A,  WR],
    [WL, F,  F,  F,  F,  F,  F,  D,  F,  F,  F,  F,  F,  F,  F,  WR],
    [BL, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, BR],
  ],
  npcs: [{ x: 7, y: 6, dialogueKey: 'room2_athlete' }],
  equipment: [
    { x: 4, y: 8, dialogueKey: 'room2_screen1' },
    { x: 10, y: 8, dialogueKey: 'room2_screen2' },
    { x: 3, y: 5, dialogueKey: 'room2_screen3' },
    { x: 11, y: 5, dialogueKey: 'room2_screen4' },
  ],
  doors: [{ x: 7, y: 12, target: 'hub' }],
};

// Room 3 — Training Floor
// Mats on floor, TM/BE as visual decor, E tiles on floor below for interaction
export const ROOM3_MAP: MapData = {
  name: 'Training Floor',
  palette: 'track',
  tiles: [
    [TL, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, TR],
    [WL, F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  WR],
    [WL, F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  WR],
    [WL, F,  F,  TM, F,  MT, MT, F,  F,  MT, MT, F,  BE, F,  F,  WR],
    [WL, F,  F,  E,  F,  MT, MT, F,  F,  MT, MT, F,  E,  F,  F,  WR],
    [WL, F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  WR],
    [WL, F,  F,  F,  F,  F,  F,  N,  F,  F,  F,  F,  F,  F,  F,  WR],
    [WL, F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  WR],
    [WL, F,  F,  E,  F,  MT, MT, F,  F,  MT, MT, F,  E,  F,  F,  WR],
    [WL, F,  F,  BE, F,  MT, MT, F,  F,  MT, MT, F,  TM, F,  F,  WR],
    [WL, F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  WR],
    [WL, F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  WR],
    [WL, F,  F,  F,  F,  F,  F,  D,  F,  F,  F,  F,  F,  F,  F,  WR],
    [BL, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, BR],
  ],
  npcs: [{ x: 7, y: 6, dialogueKey: 'room3_athlete' }],
  equipment: [
    { x: 3, y: 4, dialogueKey: 'room3_equip1' },
    { x: 12, y: 4, dialogueKey: 'room3_equip2' },
    { x: 3, y: 8, dialogueKey: 'room3_equip3' },
    { x: 12, y: 8, dialogueKey: 'room3_equip4' },
  ],
  doors: [{ x: 7, y: 12, target: 'hub' }],
};

// Room 4 — Analysis Room
// Conference table (desk rectangle), E tiles on adjacent floor for interaction
export const ROOM4_MAP: MapData = {
  name: 'Analysis Room',
  palette: 'lab',
  tiles: [
    [TL, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, TR],
    [WL, A,  A,  A,  A,  A,  A,  A,  A,  A,  A,  A,  A,  A,  A,  WR],
    [WL, A,  F,  BK, F,  F,  MN, F,  MN, F,  F,  BK, F,  F,  A,  WR],
    [WL, A,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  A,  WR],
    [WL, A,  F,  F,  RG, RG, DK, DK, DK, DK, RG, RG, F,  F,  A,  WR],
    [WL, A,  F,  F,  RG, RG, E,  F,  F,  E,  RG, RG, F,  F,  A,  WR],
    [WL, A,  F,  F,  RG, RG, F,  N,  F,  F,  RG, RG, F,  F,  A,  WR],
    [WL, A,  F,  F,  RG, RG, E,  F,  F,  E,  RG, RG, F,  F,  A,  WR],
    [WL, A,  F,  F,  RG, RG, DK, DK, DK, DK, RG, RG, F,  F,  A,  WR],
    [WL, A,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  A,  WR],
    [WL, A,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  F,  A,  WR],
    [WL, A,  A,  A,  A,  A,  A,  A,  A,  A,  A,  A,  A,  A,  A,  WR],
    [WL, F,  F,  F,  F,  F,  F,  D,  F,  F,  F,  F,  F,  F,  F,  WR],
    [BL, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, WT, BR],
  ],
  npcs: [{ x: 7, y: 6, dialogueKey: 'room4_athlete' }],
  equipment: [
    { x: 6, y: 5, dialogueKey: 'room4_screen1' },
    { x: 9, y: 5, dialogueKey: 'room4_screen2' },
    { x: 6, y: 7, dialogueKey: 'room4_screen3' },
    { x: 9, y: 7, dialogueKey: 'room4_screen4' },
  ],
  doors: [{ x: 7, y: 12, target: 'hub' }],
};

export const ALL_MAPS: Record<string, MapData> = {
  hub: HUB_MAP,
  room1: ROOM1_MAP,
  room2: ROOM2_MAP,
  room3: ROOM3_MAP,
  room4: ROOM4_MAP,
};
