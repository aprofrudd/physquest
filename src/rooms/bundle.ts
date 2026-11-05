// Everything the redesigned rooms need: the four instruments, their maps, tiles and art. It is its own chunk,
// loaded after the title screen appears (see loader.ts), so players of the classic levels never wait for it.
import type { MapData } from '../data/maps';
import type { InstrumentFactory } from './types';
import { createTestingRoom } from './testing';
import { createDataRoom } from './datalab';
import { createTrainingRoom } from './training';
import { createAnalysisRoom } from './analysis';
import { createMeetRoom } from './meet';
import { TESTING_LAB } from '../data/rooms/testing';
import { DATA_LAB } from '../data/rooms/datalab';
import { TRAINING_FLOOR } from '../data/rooms/training';
import { BRIEFING_ROOM } from '../data/rooms/analysis';
import { MEET_ROOM } from '../data/rooms/meet';
import { DIRECTOR_HUB } from '../data/rooms/hub';

/** The four rooms, and the ATHLETE room ('meet') of a level with a Performance Director (see loader.ts meetRoomFor). */
export type RoomId = 'room1' | 'room2' | 'room3' | 'room4' | 'meet';

export const INSTRUMENTS: Readonly<Record<RoomId, InstrumentFactory>> = {
  room1: createTestingRoom,
  room2: createDataRoom,
  room3: createTrainingRoom,
  room4: createAnalysisRoom,
  meet: createMeetRoom,
};

export const MAPS: Readonly<Record<string, MapData>> = {
  room1: TESTING_LAB,
  room2: DATA_LAB,
  room3: TRAINING_FLOOR,
  room4: BRIEFING_ROOM,
  // the hub with the ATHLETE door and the Performance Director (data/rooms/index.ts mapFor only shows it, and the
  // ATHLETE room, in a visit with meet content: see loader.ts meetRoomFor)
  meet: MEET_ROOM,
  hub: DIRECTOR_HUB,
};
