import { isDoor, isInteractable, T } from '../render/TileMap';
import type { GameState } from '../state/GameState';
import type { MapData } from '../data/maps';

export interface InteractionResult {
  type: 'door' | 'npc' | 'equipment' | 'bossDoor' | null;
  target?: string;
  dialogueKey?: string;
}

export const checkInteraction = (
  gameState: GameState,
  mapData: MapData
): InteractionResult => {
  // Get the tile the player is facing
  const px = Math.round(gameState.playerPos.x);
  const py = Math.round(gameState.playerPos.y);
  let fx = px;
  let fy = py;

  switch (gameState.playerDir) {
    case 'up': fy -= 1; break;
    case 'down': fy += 1; break;
    case 'left': fx -= 1; break;
    case 'right': fx += 1; break;
  }

  const row = mapData.tiles[fy];
  if (!row) return { type: null };
  const tile = row[fx];
  if (tile === undefined) return { type: null };

  if (tile === T.BOSS_DOOR) {
    const door = mapData.doors.find(d => d.x === fx && d.y === fy);
    return { type: 'bossDoor', target: door?.target };
  }

  if (isDoor(tile)) {
    const door = mapData.doors.find(d => d.x === fx && d.y === fy);
    return { type: 'door', target: door?.target };
  }

  if (isInteractable(tile)) {
    if (tile === T.NPC) {
      const npc = mapData.npcs.find(n => n.x === fx && n.y === fy);
      return { type: 'npc', dialogueKey: npc?.dialogueKey };
    }
    if (tile === T.EQUIP) {
      const equip = mapData.equipment.find(e => e.x === fx && e.y === fy);
      return { type: 'equipment', dialogueKey: equip?.dialogueKey };
    }
  }

  return { type: null };
};

// Check if player is standing on a door tile
export const checkStandingOnDoor = (
  gameState: GameState,
  mapData: MapData
): InteractionResult => {
  const px = Math.round(gameState.playerPos.x);
  const py = Math.round(gameState.playerPos.y);
  const row = mapData.tiles[py];
  if (!row) return { type: null };
  const tile = row[px];
  if (tile === undefined) return { type: null };

  if (tile === T.BOSS_DOOR) {
    const door = mapData.doors.find(d => d.x === px && d.y === py);
    return { type: 'bossDoor', target: door?.target };
  }

  if (isDoor(tile)) {
    const door = mapData.doors.find(d => d.x === px && d.y === py);
    return { type: 'door', target: door?.target };
  }

  return { type: null };
};
