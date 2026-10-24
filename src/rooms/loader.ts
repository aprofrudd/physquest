// Loads the redesigned rooms' chunk (bundle.ts) on demand, and says which levels use it. Until it has loaded,
// every level plays the classic rooms, so a slow or failed download never leaves a level half redesigned.
import type * as Bundle from './bundle';
import { roomsRedesigned } from './preview';
import { contentFor } from './content';

let bundle: typeof Bundle | null = null;
let loading: Promise<boolean> | null = null;

/** Whether `level` plays the redesigned rooms for this player (once the chunk is loaded). */
export const levelHasNewRooms = (level: number): boolean => roomsRedesigned(level) && contentFor(level) !== undefined;

/** Start loading the chunk (once); resolves true when it is ready, false if it could not be loaded (try again later). */
export const loadRooms = (): Promise<boolean> =>
  (loading ??= import('./bundle').then(
    module => {
      bundle = module;
      return true;
    },
    () => {
      loading = null; // offline: the classic rooms play, and the next level start tries again
      return false;
    },
  ));

/** Whether the chunk has loaded. */
export const roomsLoaded = (): boolean => bundle !== null;

/** The loaded chunk, if `level` uses it; null for the classic rooms. */
export const newRoomsFor = (level: number): typeof Bundle | null => (levelHasNewRooms(level) ? bundle : null);
