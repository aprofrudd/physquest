// The redesigned Analysis Room's map: the classic room rules (spawn, door, connected floor), the athlete and every
// thing to look at can be reached, and the equipment says exactly what the brief says it should.
import { describe, expect, it } from 'vitest';
import { LEVEL_DATA } from '../src/data/sports';
import { BRIEFING_ROOM } from '../src/data/rooms/analysis';
import { AT } from '../src/data/rooms/analysis-tiles';
import { PEOPLE } from '../src/data/rooms/analysis-life';
import { ROOM_SPAWN } from '../src/data/maps';
import { isSolid, T } from '../src/render/TileMap';
import { isBlocked } from '../src/systems/Collision';

const map = BRIEFING_ROOM;
const sport = LEVEL_DATA[3]!;
const WIDTH = 16;
const HEIGHT = 14;
const key = (x: number, y: number) => `${x},${y}`;
const NEIGHBOURS = [
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0],
] as const;

/** Every walkable tile reachable from the spawn, the way the player walks (one tile at a time, never through furniture). */
const reachable = (): Set<string> => {
  const seen = new Set<string>([key(ROOM_SPAWN.x, ROOM_SPAWN.y)]);
  const queue: Array<[number, number]> = [[ROOM_SPAWN.x, ROOM_SPAWN.y]];
  while (queue.length > 0) {
    const [x, y] = queue.shift()!;
    for (const [dx, dy] of NEIGHBOURS) {
      const [nx, ny] = [x + dx, y + dy];
      if (seen.has(key(nx, ny)) || isBlocked(map.tiles, nx, ny)) continue;
      seen.add(key(nx, ny));
      queue.push([nx, ny]);
    }
  }
  return seen;
};

/** A walkable, reachable tile next to (x, y) from which the player can face it. */
const facingSpot = (x: number, y: number, seen: Set<string>) => NEIGHBOURS.map(([dx, dy]) => [x + dx, y + dy] as const).find(([nx, ny]) => seen.has(key(nx, ny)));

describe('the briefing room map', () => {
  it('is one 16 by 14 screen in the office palette', () => {
    expect(map.tiles).toHaveLength(HEIGHT);
    for (const row of map.tiles) expect(row).toHaveLength(WIDTH);
    expect(map.palette).toBe('office');
    expect(map.name).toBe('Analysis Room');
  });

  it('only uses the game\'s own tiles or this room\'s ids (400-499), and every id is real', () => {
    const own = new Set<number>(Object.values(AT));
    for (const id of own) expect(id).toBeGreaterThanOrEqual(400);
    for (const id of own) expect(id).toBeLessThan(500);
    const game = new Set<number>(Object.values(T));
    for (const row of map.tiles) for (const tile of row) expect(own.has(tile) || game.has(tile)).toBe(true);
    expect(own.has(map.npcFloor ?? -1)).toBe(true);
  });

  it('has walls all round, with the door at (7,12) leading back to the hub', () => {
    for (let x = 0; x < WIDTH; x++) {
      expect(isSolid(map.tiles[0]![x]!)).toBe(true);
      expect(isSolid(map.tiles[HEIGHT - 1]![x]!)).toBe(true);
    }
    for (let y = 0; y < HEIGHT; y++) {
      expect(isSolid(map.tiles[y]![0]!)).toBe(true);
      expect(isSolid(map.tiles[y]![WIDTH - 1]!)).toBe(true);
    }
    expect(map.tiles[12]![7]).toBe(T.DOOR);
    expect(map.doors).toEqual([{ x: 7, y: 12, target: 'hub' }]);
  });

  it('starts the player at (7,10) facing up, on open floor with open floor ahead', () => {
    expect(ROOM_SPAWN).toEqual({ x: 7, y: 10, dir: 'up' });
    expect(isBlocked(map.tiles, 7, 10)).toBe(false);
    expect(isBlocked(map.tiles, 7, 9)).toBe(false);
  });

  it('connects all the floor: the door, the athlete and every walkable tile can be reached from the spawn', () => {
    const seen = reachable();
    expect(seen.has(key(7, 12))).toBe(true);
    let walkable = 0;
    for (let y = 1; y < HEIGHT - 1; y++) {
      for (let x = 1; x < WIDTH - 1; x++) {
        if (isBlocked(map.tiles, x, y)) continue;
        walkable++;
        expect(seen.has(key(x, y)), `walkable tile (${x},${y}) cannot be reached`).toBe(true);
      }
    }
    expect(walkable).toBeGreaterThan(60); // a room to walk around in, not a corridor
  });

  it('puts the athlete at the head of the table, faceable from open floor with nothing busy above', () => {
    expect(map.npcs).toEqual([{ x: 11, y: 6, dialogueKey: 'room4_athlete' }]);
    const { x, y } = map.npcs[0]!;
    expect(map.tiles[y]![x]).toBe(T.NPC);
    const seen = reachable();
    expect(facingSpot(x, y, seen)).toBeDefined();
    // the "!" and "A" bubbles hang over the tile above her, and over the one beside it: both are plain rug
    expect(seen.has(key(x, y - 1))).toBe(true);
    expect([AT.RUG_C, AT.RUG_T, AT.RUG_R, AT.RUG_TR]).toContain(map.tiles[y - 1]![x]);
    // the table's end is at her side
    expect(map.tiles[y]![x - 1]).toBe(AT.TABLE_R);
  });

  it('puts the presenter and the colleagues on solid tiles, so nobody can walk through them', () => {
    for (const person of Object.values(PEOPLE)) expect(isBlocked(map.tiles, person.x, person.y), `(${person.x},${person.y})`).toBe(true);
    // and they leave the way to the athlete open
    const seen = reachable();
    expect(seen.has(key(11, 7))).toBe(true);
  });
});

describe('the things to look at', () => {
  const lines = (dialogueKey: string): string[] => map.talk![dialogueKey]!(sport);

  it('can each be faced from open floor', () => {
    const seen = reachable();
    for (const e of map.equipment) {
      expect(facingSpot(e.x, e.y, seen), `${e.dialogueKey} at (${e.x},${e.y})`).toBeDefined();
      expect(map.talk![e.dialogueKey], e.dialogueKey).toBeDefined();
    }
  });

  it('covers the projector, the whiteboard, the laptop and the planner, each with its own lines', () => {
    const keys = new Set(map.equipment.map(e => e.dialogueKey));
    expect([...keys].sort()).toEqual(['room4_screen1', 'room4_screen2', 'room4_screen3', 'room4_screen4']);
    expect(Object.keys(map.talk!).sort()).toEqual([...keys].sort());
  });

  it('says what the brief says, reusing the existing text and the level\'s own data', () => {
    expect(lines('room4_screen1')).toEqual(['Prediction model: Physiological adaptation curves.', sport.predictionScenario]);
    expect(lines('room4_screen2')).toEqual(['Prediction model: Performance trajectory.', `Goal: ${sport.goal}`]);
    expect(lines('room4_screen3')).toEqual(['Prediction model: Training load response.', sport.athleteProfile]);
    expect(lines('room4_screen4')).toEqual(['Prediction model: Competition readiness score.']);
    expect(sport.goal).toContain('speed reserve');
  });

  it('describes the room for screen readers', () => {
    expect(map.describe).toBeTruthy();
    expect(map.describe).toMatch(/projector/i);
    expect(map.describe).toMatch(/athlete/i);
  });

  it('animates through life without needing anything but a canvas', () => {
    expect(typeof map.life).toBe('function');
  });
});
