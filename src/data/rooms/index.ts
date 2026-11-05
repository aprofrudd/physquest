// The map to show for a room: the redesigned room's (rooms/bundle.ts) for levels whose rooms are redesigned,
// once that chunk has loaded, else the classic map. Each redesigned room's map, tiles and art live here in its
// own files. The hub is the Performance Director's (with the ATHLETE door) only in a visit that has the ATHLETE room.
import { ALL_MAPS, type MapData } from '../maps';
import { meetRoomFor, newRoomsFor } from '../../rooms/loader';

/** The map to show for `mapId` in `level`. */
export const mapFor = (mapId: string, level: number): MapData | undefined => {
  if ((mapId === 'hub' || mapId === 'meet') && !meetRoomFor(level)) return ALL_MAPS[mapId];
  return newRoomsFor(level)?.MAPS[mapId] ?? ALL_MAPS[mapId];
};
