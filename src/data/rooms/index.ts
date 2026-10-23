// The redesigned rooms' maps, used instead of the classic ones for levels whose rooms are redesigned
// (see rooms/preview.ts). Each room's map, tiles and animation live in its own file here.
import { ALL_MAPS, type MapData } from '../maps';
import { roomsRedesigned } from '../../rooms/preview';
import { TESTING_LAB } from './testing';
import { DATA_LAB } from './datalab';
import { TRAINING_FLOOR } from './training';
import { BRIEFING_ROOM } from './analysis';

const REDESIGNED_MAPS: Readonly<Record<string, MapData>> = {
  room1: TESTING_LAB,
  room2: DATA_LAB,
  room3: TRAINING_FLOOR,
  room4: BRIEFING_ROOM,
};

/** The map to show for `mapId` in `level`: the redesigned room when that level has one, else the classic map. */
export const mapFor = (mapId: string, level: number): MapData | undefined =>
  (roomsRedesigned(level) ? REDESIGNED_MAPS[mapId] : undefined) ?? ALL_MAPS[mapId];
