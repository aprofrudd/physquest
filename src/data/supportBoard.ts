// The SUPPORT BOARD on the hub's north wall (the Director's hub only): where it hangs, and the key that marks the wall
// tiles under it as something to look at. Shared by the map (src/data/rooms/hub.ts), the overworld and the drawing.
import type { EquipData } from './maps';

/** Equipment key of the board's wall tiles: facing one and pressing A opens the board. */
export const BOARD_KEY = 'hub_board';

/**
 * The board, in game pixels: on the top wall over tiles 1-3, clear of the corner tile and of the SELECT hint left of
 * the ROOMS badge (which starts at x = 68 at the earliest).
 */
export const BOARD_RECT = { x: 17, y: 1, w: 47, h: 14 } as const;

/** The wall tiles it covers, each faced from the floor tile below it (x 1-3, y 1). */
export const BOARD_SPOTS: readonly EquipData[] = [1, 2, 3].map(x => ({ x, y: 0, dialogueKey: BOARD_KEY }));
