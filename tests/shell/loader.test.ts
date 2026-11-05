// The redesigned rooms' chunk: a level visit plays the new rooms only if the chunk was ready when the visit began.
import { describe, expect, it } from 'vitest';
import { commitLevel, levelHasNewRooms, loadRooms, meetRoomFor, newRoomsFor, roomsLoaded } from '../../src/rooms/loader';

describe('room chunk loader', () => {
  it('plays the classic rooms for a visit that began before the chunk loaded, and the new ones from the next visit', async () => {
    expect(levelHasNewRooms(3)).toBe(true);
    expect(levelHasNewRooms(0)).toBe(false);
    expect(roomsLoaded()).toBe(false);
    commitLevel(3); // a visit starts before the chunk is ready
    expect(newRoomsFor(3)).toBeNull();
    expect(meetRoomFor(3), 'a classic visit has no ATHLETE room').toBe(false);
    expect(await loadRooms()).toBe(true);
    expect(newRoomsFor(3)).toBeNull(); // still the classic rooms for the rest of that visit
    commitLevel(3); // the next visit
    expect(newRoomsFor(3)?.INSTRUMENTS.room1).toBeTypeOf('function');
    // the four rooms, the ATHLETE room and the hub with its door and the Performance Director
    expect(Object.keys(newRoomsFor(3)!.MAPS)).toEqual(['room1', 'room2', 'room3', 'room4', 'meet', 'hub']);
    expect(meetRoomFor(3)).toBe(true);
  });

  it('never gives the classic levels the new rooms', async () => {
    await loadRooms();
    for (const level of [0, 1, 2]) {
      commitLevel(level);
      expect(newRoomsFor(level)).toBeNull();
    }
  });

  it('loads once', async () => {
    const [a, b] = await Promise.all([loadRooms(), loadRooms()]);
    expect(a && b).toBe(true);
  });
});
