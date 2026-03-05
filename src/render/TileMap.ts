import { PALETTES } from './Palettes';
import type { PaletteId } from './Palettes';

export const TILE_SIZE = 16;

// Tile types
export const T = {
  EMPTY: 0,
  FLOOR: 1,
  WALL: 2,
  DOOR: 3,
  NPC: 4,
  EQUIP: 5,
  WALL_TOP: 6,
  FLOOR_ALT: 7,
  BOSS_DOOR: 8,
} as const;

export type TileType = (typeof T)[keyof typeof T];

// Tile colors per palette — maps tile type to palette index
const TILE_COLORS: Record<number, number> = {
  [T.EMPTY]: 0,
  [T.FLOOR]: 1,
  [T.WALL]: 2,
  [T.DOOR]: 3,
  [T.NPC]: 4,
  [T.EQUIP]: 3,
  [T.WALL_TOP]: 2,
  [T.FLOOR_ALT]: 1,
  [T.BOSS_DOOR]: 5,
};

export const isSolid = (tile: number): boolean => {
  return tile === T.WALL || tile === T.WALL_TOP;
};

export const isDoor = (tile: number): boolean => {
  return tile === T.DOOR || tile === T.BOSS_DOOR;
};

export const isInteractable = (tile: number): boolean => {
  return tile === T.NPC || tile === T.EQUIP;
};

export const renderTileMap = (
  ctx: CanvasRenderingContext2D,
  map: number[][],
  paletteId: PaletteId,
  cameraX: number,
  cameraY: number,
  viewW: number,
  viewH: number
) => {
  const palette = PALETTES[paletteId];
  const startCol = Math.max(0, Math.floor(cameraX / TILE_SIZE));
  const startRow = Math.max(0, Math.floor(cameraY / TILE_SIZE));
  const endCol = Math.min(
    (map[0]?.length ?? 0),
    Math.ceil((cameraX + viewW) / TILE_SIZE) + 1
  );
  const endRow = Math.min(map.length, Math.ceil((cameraY + viewH) / TILE_SIZE) + 1);

  for (let row = startRow; row < endRow; row++) {
    const mapRow = map[row];
    if (!mapRow) continue;
    for (let col = startCol; col < endCol; col++) {
      const tile = mapRow[col];
      if (tile === undefined || tile === T.EMPTY) continue;

      const screenX = col * TILE_SIZE - cameraX;
      const screenY = row * TILE_SIZE - cameraY;

      const colorIdx = TILE_COLORS[tile] ?? 1;
      const color = palette.colors[colorIdx] ?? palette.colors[1]!;

      ctx.fillStyle = color;
      ctx.fillRect(Math.floor(screenX), Math.floor(screenY), TILE_SIZE, TILE_SIZE);

      // Add tile details
      if (tile === T.WALL || tile === T.WALL_TOP) {
        // darker border for walls
        ctx.fillStyle = palette.colors[0]!;
        ctx.fillRect(Math.floor(screenX), Math.floor(screenY + TILE_SIZE - 1), TILE_SIZE, 1);
      } else if (tile === T.DOOR || tile === T.BOSS_DOOR) {
        // door frame lines
        ctx.fillStyle = palette.colors[4] ?? palette.colors[2]!;
        ctx.fillRect(Math.floor(screenX), Math.floor(screenY), 2, TILE_SIZE);
        ctx.fillRect(Math.floor(screenX + TILE_SIZE - 2), Math.floor(screenY), 2, TILE_SIZE);
        ctx.fillRect(Math.floor(screenX), Math.floor(screenY), TILE_SIZE, 2);
      } else if (tile === T.EQUIP) {
        // equipment marker — small box
        ctx.fillStyle = palette.colors[4] ?? palette.colors[2]!;
        ctx.fillRect(Math.floor(screenX + 4), Math.floor(screenY + 4), 8, 8);
        ctx.fillStyle = palette.colors[5] ?? palette.colors[3]!;
        ctx.fillRect(Math.floor(screenX + 5), Math.floor(screenY + 5), 6, 6);
      } else if (tile === T.NPC) {
        // NPC marker — floor with a dot
        ctx.fillStyle = palette.colors[0]!;
        // NPC body gets drawn by sprite system, but mark floor
      } else if (tile === T.FLOOR_ALT) {
        // checkerboard pattern
        ctx.fillStyle = palette.colors[2] ?? palette.colors[1]!;
        if ((row + col) % 2 === 0) {
          ctx.fillRect(Math.floor(screenX + 2), Math.floor(screenY + 2), 4, 4);
          ctx.fillRect(Math.floor(screenX + 10), Math.floor(screenY + 10), 4, 4);
        }
      }
    }
  }
};
