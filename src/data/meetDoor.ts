// Where the ATHLETE room's door is in the Distance Running hub (data/rooms/hub.ts), for the parts of the game that
// draw or use it outside the redesigned rooms' chunk: the hub's label plate, the door arrow and the spot outside it.
// The classic hub (maps.ts) has no such door. The door is set into the bottom wall, left of the arena's, so it is
// entered from above like the arena.
import type { Spawn } from './maps';

/** The door tile itself (bottom row of the hall). */
export const MEET_DOOR = { x: 3, y: 12 } as const;

/** Back in the hub from the ATHLETE room: just above its door, facing away from it. */
export const MEET_RETURN: Spawn = { x: 3, y: 11, dir: 'up' };

/** The ATHLETE label plate, on the bottom wall under the door (in tile units, as HUB_SIGNS). */
export const MEET_SIGN = { cx: 3.5, cy: 13.5 } as const;

/** The dialogue key of the Performance Director in that hub (OverworldScene gives the welcome, reminder or after lines). */
export const DIRECTOR_KEY = 'hub_director';
