// Content for the redesigned rooms, by level index. A level without an entry keeps the classic rooms.
import type { RoomsContent } from './types';
import { RUNNING } from './running';
import type { MeetContent } from './meet-types';
import { MEET_RUNNING } from './meet-running';

const CONTENT: Readonly<Partial<Record<number, RoomsContent>>> = {
  3: RUNNING,
};

/** The redesigned rooms' content for `level`, or undefined if that level has none yet. */
export const contentFor = (level: number): RoomsContent | undefined => CONTENT[level];

// The Performance Director's welcome and the ATHLETE room, by level index. A level without an entry has neither.
const MEET: Readonly<Partial<Record<number, MeetContent>>> = {
  3: MEET_RUNNING,
};

/** The welcome and athlete meeting for `level`, or undefined if that level has none. */
export const meetContentFor = (level: number): MeetContent | undefined => MEET[level];
