// Loads the redesigned rooms' chunk (bundle.ts) on demand, and decides per level visit which rooms it plays.
// A visit that starts before the chunk is ready plays the classic rooms throughout: a chunk arriving mid-visit
// changes nothing until the next visit, so a level is never half redesigned.
import type * as Bundle from './bundle';
import { roomsRedesigned } from './preview';
import { contentFor } from './content';

let bundle: typeof Bundle | null = null;
let loading: Promise<boolean> | null = null;
let failed = false;
const committed = new Set<number>(); // levels whose current visit plays the redesigned rooms

/** Whether `level` plays the redesigned rooms for this player (once the chunk is loaded). */
export const levelHasNewRooms = (level: number): boolean => roomsRedesigned(level) && contentFor(level) !== undefined;

/**
 * Start loading the chunk (once); resolves true when it is ready. A failed load stays failed until the page is
 * reloaded (browsers keep a failed import), and every level then plays the classic rooms.
 */
export const loadRooms = (): Promise<boolean> => {
  if (bundle) return Promise.resolve(true);
  if (failed) return Promise.resolve(false);
  return (loading ??= import('./bundle').then(
    module => {
      bundle = module;
      return true;
    },
    () => {
      failed = true;
      return false;
    },
  ));
};

/** Whether the chunk has loaded. */
export const roomsLoaded = (): boolean => bundle !== null;

/** A visit to `level` is starting: it plays the redesigned rooms if they are ready now, else the classic ones. */
export const commitLevel = (level: number): void => {
  if (bundle && levelHasNewRooms(level)) committed.add(level);
  else committed.delete(level);
};

/** The loaded chunk, if the current visit to `level` plays it; null for the classic rooms. */
export const newRoomsFor = (level: number): typeof Bundle | null => (committed.has(level) ? bundle : null);
