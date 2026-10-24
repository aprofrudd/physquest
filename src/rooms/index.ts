// Redesigned rooms: which instrument runs a room for a level. RoomChallengeScene asks here first and falls
// back to the classic pick-from-a-list challenge when there is none.
import type { InstrumentFactory } from './types';
import type { RoomId } from './bundle';
import { newRoomsFor } from './loader';

export type { RoomId };

/** The redesigned room for `room` in `level`, or null to play the classic challenge. */
export const instrumentFor = (room: RoomId, level: number): InstrumentFactory | null => newRoomsFor(level)?.INSTRUMENTS[room] ?? null;
