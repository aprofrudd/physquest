// Content for the redesigned rooms, by level index. A level without an entry keeps the classic rooms.
import type { RoomsContent } from './types';
import { RUNNING } from './running';

const CONTENT: Readonly<Partial<Record<number, RoomsContent>>> = {
  3: RUNNING,
};

/** The redesigned rooms' content for `level`, or undefined if that level has none yet. */
export const contentFor = (level: number): RoomsContent | undefined => CONTENT[level];
