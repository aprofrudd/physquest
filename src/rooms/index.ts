// Redesigned rooms: which instrument runs a room for a level. RoomChallengeScene asks here first and falls
// back to the classic pick-from-a-list challenge when there is none.
import type { InstrumentFactory } from './types';
import { roomsRedesigned } from './preview';
import { contentFor } from './content';
import { createTestingRoom } from './testing';
import { createDataRoom } from './datalab';
import { createTrainingRoom } from './training';
import { createAnalysisRoom } from './analysis';

export type RoomId = 'room1' | 'room2' | 'room3' | 'room4';

const INSTRUMENTS: Readonly<Record<RoomId, InstrumentFactory>> = {
  room1: createTestingRoom,
  room2: createDataRoom,
  room3: createTrainingRoom,
  room4: createAnalysisRoom,
};

/** The redesigned room for `room` in `level`, or null to play the classic challenge. */
export const instrumentFor = (room: RoomId, level: number): InstrumentFactory | null =>
  roomsRedesigned(level) && contentFor(level) ? INSTRUMENTS[room] : null;
