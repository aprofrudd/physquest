import { isDoor, isInteractable, isSolid, T } from '../render/TileMap';
import type { GameState } from '../state/GameState';
import type { MapData } from '../data/maps';

export interface InteractionResult {
  type: 'door' | 'npc' | 'equipment' | 'bossDoor' | null;
  target?: string;
  dialogueKey?: string;
  /** The tile the result refers to (the faced tile, or the tile stood on for doors). */
  x?: number;
  y?: number;
}

export const tileAt = (map: number[][], x: number, y: number): number | undefined => map[y]?.[x];

/** Out of bounds counts as blocked, so a bad map can never let the player walk off it. */
export const isBlocked = (map: number[][], x: number, y: number): boolean => {
  const tile = tileAt(map, x, y);
  return tile === undefined || isSolid(tile);
};

/** First free, non-door neighbour of a tile; a safe place to put the player back. */
export const findOpenNeighbour = (map: number[][], x: number, y: number): { x: number; y: number } | null => {
  const around = [
    { x, y: y + 1 },
    { x, y: y - 1 },
    { x: x - 1, y },
    { x: x + 1, y },
  ];
  for (const p of around) {
    const tile = tileAt(map, p.x, p.y);
    if (tile !== undefined && !isSolid(tile) && !isDoor(tile)) return p;
  }
  return null;
};

const describe = (mapData: MapData, tile: number, x: number, y: number): InteractionResult => {
  if (tile === T.BOSS_DOOR) {
    const door = mapData.doors.find(d => d.x === x && d.y === y);
    return { type: 'bossDoor', target: door?.target, x, y };
  }

  if (isDoor(tile)) {
    const door = mapData.doors.find(d => d.x === x && d.y === y);
    return { type: 'door', target: door?.target, x, y };
  }

  if (isInteractable(tile)) {
    if (tile === T.NPC) {
      const npc = mapData.npcs.find(n => n.x === x && n.y === y);
      return { type: 'npc', dialogueKey: npc?.dialogueKey, x, y };
    }
    if (tile === T.EQUIP) {
      const equip = mapData.equipment.find(e => e.x === x && e.y === y);
      return { type: 'equipment', dialogueKey: equip?.dialogueKey, x, y };
    }
  }

  return { type: null, x, y };
};

export const checkInteraction = (
  gameState: GameState,
  mapData: MapData
): InteractionResult => {
  // Get the tile the player is facing
  let fx = Math.round(gameState.playerPos.x);
  let fy = Math.round(gameState.playerPos.y);

  switch (gameState.playerDir) {
    case 'up': fy -= 1; break;
    case 'down': fy += 1; break;
    case 'left': fx -= 1; break;
    case 'right': fx += 1; break;
  }

  const tile = tileAt(mapData.tiles, fx, fy);
  if (tile === undefined) return { type: null };
  return describe(mapData, tile, fx, fy);
};

// Check if player is standing on a door tile
export const checkStandingOnDoor = (
  gameState: GameState,
  mapData: MapData
): InteractionResult => {
  const px = Math.round(gameState.playerPos.x);
  const py = Math.round(gameState.playerPos.y);
  const tile = tileAt(mapData.tiles, px, py);
  if (tile === undefined) return { type: null };

  const result = describe(mapData, tile, px, py);
  return result.type === 'door' || result.type === 'bossDoor' ? result : { type: null };
};
