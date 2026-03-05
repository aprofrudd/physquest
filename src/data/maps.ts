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
  target: string; // 'room1' | 'room2' | 'room3' | 'room4' | 'boss'
}

const W = T.WALL;
const F = T.FLOOR;
const D = T.DOOR;
const N = T.NPC;
const E = T.EQUIP;
const A = T.FLOOR_ALT;
const B = T.BOSS_DOOR;
const _ = T.EMPTY;

// Hub overworld — sports performance centre
export const HUB_MAP: MapData = {
  name: 'Sports Performance Centre',
  palette: 'lab',
  tiles: [
    [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
    [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W],
    [W,F,A,F,W,D,W,F,F,W,D,W,F,A,F,W],
    [W,F,F,F,W,F,W,F,F,W,F,W,F,F,F,W],
    [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W],
    [W,F,E,F,F,F,F,N,F,F,F,F,F,E,F,W],
    [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W],
    [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W],
    [W,F,A,F,W,D,W,F,F,W,D,W,F,A,F,W],
    [W,F,F,F,W,F,W,F,F,W,F,W,F,F,F,W],
    [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W],
    [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W],
    [W,F,F,F,F,F,F,B,B,F,F,F,F,F,F,W],
    [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
  ],
  npcs: [
    { x: 7, y: 5, dialogueKey: 'hub_athlete' },
  ],
  equipment: [
    { x: 2, y: 5, dialogueKey: 'hub_equip_left' },
    { x: 13, y: 5, dialogueKey: 'hub_equip_right' },
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

// Room maps — each room is a single screen
export const ROOM1_MAP: MapData = {
  name: 'Testing Lab',
  palette: 'lab',
  tiles: [
    [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
    [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W],
    [W,F,E,F,F,E,F,F,F,E,F,F,E,F,F,W],
    [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W],
    [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W],
    [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W],
    [W,F,F,F,F,F,F,N,F,F,F,F,F,F,F,W],
    [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W],
    [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W],
    [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W],
    [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W],
    [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W],
    [W,F,F,F,F,F,F,D,F,F,F,F,F,F,F,W],
    [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
  ],
  npcs: [{ x: 7, y: 6, dialogueKey: 'room1_athlete' }],
  equipment: [
    { x: 2, y: 2, dialogueKey: 'room1_equip1' },
    { x: 5, y: 2, dialogueKey: 'room1_equip2' },
    { x: 9, y: 2, dialogueKey: 'room1_equip3' },
    { x: 12, y: 2, dialogueKey: 'room1_equip4' },
  ],
  doors: [{ x: 7, y: 12, target: 'hub' }],
};

export const ROOM2_MAP: MapData = {
  name: 'Data Analysis',
  palette: 'gym',
  tiles: [
    [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
    [W,A,A,A,A,A,A,A,A,A,A,A,A,A,A,W],
    [W,A,F,F,F,F,F,F,F,F,F,F,F,F,A,W],
    [W,A,F,E,F,F,E,F,E,F,F,E,F,F,A,W],
    [W,A,F,F,F,F,F,F,F,F,F,F,F,F,A,W],
    [W,A,F,F,F,F,F,F,F,F,F,F,F,F,A,W],
    [W,A,F,F,F,F,F,N,F,F,F,F,F,F,A,W],
    [W,A,F,F,F,F,F,F,F,F,F,F,F,F,A,W],
    [W,A,F,F,F,F,F,F,F,F,F,F,F,F,A,W],
    [W,A,F,F,F,F,F,F,F,F,F,F,F,F,A,W],
    [W,A,F,F,F,F,F,F,F,F,F,F,F,F,A,W],
    [W,A,A,A,A,A,A,A,A,A,A,A,A,A,A,W],
    [W,F,F,F,F,F,F,D,F,F,F,F,F,F,F,W],
    [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
  ],
  npcs: [{ x: 7, y: 6, dialogueKey: 'room2_athlete' }],
  equipment: [
    { x: 3, y: 3, dialogueKey: 'room2_screen1' },
    { x: 6, y: 3, dialogueKey: 'room2_screen2' },
    { x: 8, y: 3, dialogueKey: 'room2_screen3' },
    { x: 11, y: 3, dialogueKey: 'room2_screen4' },
  ],
  doors: [{ x: 7, y: 12, target: 'hub' }],
};

export const ROOM3_MAP: MapData = {
  name: 'Training Floor',
  palette: 'track',
  tiles: [
    [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
    [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W],
    [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W],
    [W,F,F,E,F,F,F,F,F,F,F,E,F,F,F,W],
    [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W],
    [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W],
    [W,F,F,F,F,F,F,N,F,F,F,F,F,F,F,W],
    [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W],
    [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W],
    [W,F,F,E,F,F,F,F,F,F,F,E,F,F,F,W],
    [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W],
    [W,F,F,F,F,F,F,F,F,F,F,F,F,F,F,W],
    [W,F,F,F,F,F,F,D,F,F,F,F,F,F,F,W],
    [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
  ],
  npcs: [{ x: 7, y: 6, dialogueKey: 'room3_athlete' }],
  equipment: [
    { x: 3, y: 3, dialogueKey: 'room3_equip1' },
    { x: 11, y: 3, dialogueKey: 'room3_equip2' },
    { x: 3, y: 9, dialogueKey: 'room3_equip3' },
    { x: 11, y: 9, dialogueKey: 'room3_equip4' },
  ],
  doors: [{ x: 7, y: 12, target: 'hub' }],
};

export const ROOM4_MAP: MapData = {
  name: 'Analysis Room',
  palette: 'lab',
  tiles: [
    [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
    [W,A,A,A,A,A,A,A,A,A,A,A,A,A,A,W],
    [W,A,F,F,F,F,F,F,F,F,F,F,F,F,A,W],
    [W,A,F,F,F,E,F,F,F,E,F,F,F,F,A,W],
    [W,A,F,F,F,F,F,F,F,F,F,F,F,F,A,W],
    [W,A,F,F,F,F,F,F,F,F,F,F,F,F,A,W],
    [W,A,F,F,F,F,F,N,F,F,F,F,F,F,A,W],
    [W,A,F,F,F,F,F,F,F,F,F,F,F,F,A,W],
    [W,A,F,F,F,F,F,F,F,F,F,F,F,F,A,W],
    [W,A,F,F,F,E,F,F,F,E,F,F,F,F,A,W],
    [W,A,F,F,F,F,F,F,F,F,F,F,F,F,A,W],
    [W,A,A,A,A,A,A,A,A,A,A,A,A,A,A,W],
    [W,F,F,F,F,F,F,D,F,F,F,F,F,F,F,W],
    [W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W],
  ],
  npcs: [{ x: 7, y: 6, dialogueKey: 'room4_athlete' }],
  equipment: [
    { x: 5, y: 3, dialogueKey: 'room4_screen1' },
    { x: 9, y: 3, dialogueKey: 'room4_screen2' },
    { x: 5, y: 9, dialogueKey: 'room4_screen3' },
    { x: 9, y: 9, dialogueKey: 'room4_screen4' },
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
