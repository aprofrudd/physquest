// The redesigned Testing Lab's map: it can be walked, everything can be reached and looked at, and the
// lines on its equipment come from the level's own data.
import { describe, expect, it } from 'vitest';
import { LEVEL_DATA } from '../src/data/sports';
import { ROOM_SPAWN } from '../src/data/maps';
import { DIALOGUES } from '../src/data/dialogue';
import { TESTING_LAB, thresholdReadout } from '../src/data/rooms/testing';
import { TILE } from '../src/data/rooms/testing-tiles';
import { isDoor, isSolid, T } from '../src/render/TileMap';

const map = TESTING_LAB;
const sport = LEVEL_DATA[3]!;
const at = (x: number, y: number): number | undefined => map.tiles[y]?.[x];
const key = (x: number, y: number): string => `${x},${y}`;
const STEPS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/** Every tile the player can walk to from the spawn, the way Movement does it (doors are stepped on, not through). */
const reachable = (): Set<string> => {
  const seen = new Set<string>([key(ROOM_SPAWN.x, ROOM_SPAWN.y)]);
  const queue: Array<[number, number]> = [[ROOM_SPAWN.x, ROOM_SPAWN.y]];
  while (queue.length) {
    const [cx, cy] = queue.shift()!;
    for (const [dx, dy] of STEPS) {
      const nx = cx + dx;
      const ny = cy + dy;
      const tile = at(nx, ny);
      if (tile === undefined || seen.has(key(nx, ny)) || isSolid(tile)) continue;
      seen.add(key(nx, ny));
      if (!isDoor(tile)) queue.push([nx, ny]);
    }
  }
  return seen;
};

const canBeFaced = (x: number, y: number, walkable: Set<string>): boolean => STEPS.some(([dx, dy]) => walkable.has(key(x + dx, y + dy)));

describe('Testing Lab map', () => {
  it('is one screen: 16 by 14 tiles, with the exit door at (7, 12) under the spawn', () => {
    expect(map.tiles).toHaveLength(14);
    for (const row of map.tiles) expect(row).toHaveLength(16);
    expect(map.doors).toEqual([{ x: 7, y: 12, target: 'hub' }]);
    expect(at(7, 12)).toBe(T.DOOR);
    expect(ROOM_SPAWN).toMatchObject({ x: 7, y: 10, dir: 'up' });
    expect(isSolid(at(ROOM_SPAWN.x, ROOM_SPAWN.y)!)).toBe(false);
  });

  it('is walled in and the walls are the game ones', () => {
    for (let x = 1; x < 15; x++) {
      expect(at(x, 0)).toBe(T.WALL_TOP);
      expect(at(x, 13)).toBe(T.WALL_TOP);
    }
    for (let y = 1; y < 13; y++) {
      expect(at(0, y)).toBe(T.WALL_LEFT);
      expect(at(15, y)).toBe(T.WALL_RIGHT);
    }
  });

  it('lets the player walk from the spawn to the door', () => {
    expect(reachable().has(key(7, 12))).toBe(true);
  });

  it('leaves no open floor tile cut off from the spawn', () => {
    const walkable = reachable();
    for (let y = 1; y <= 12; y++) {
      for (let x = 1; x <= 14; x++) {
        const tile = at(x, y)!;
        if (!isSolid(tile)) expect(walkable.has(key(x, y)), `tile (${x}, ${y}) is cut off`).toBe(true);
      }
    }
  });

  it('puts the athlete at the start of the lane, where she can be faced', () => {
    const [npc] = map.npcs;
    expect(map.npcs).toHaveLength(1);
    expect(npc).toMatchObject({ x: 1, y: 7, dialogueKey: 'room1_athlete' });
    expect(at(1, 7)).toBe(T.NPC);
    expect(canBeFaced(1, 7, reachable())).toBe(true);
    // she stands on the lane's own surface, just behind the start line
    expect(map.npcFloor).toBe(TILE.laneUpper);
    expect(at(2, 7)).toBe(TILE.startUpper);
  });

  it('keeps the tile above the athlete bare, for the "!" bubble', () => {
    expect(at(1, 6)).toBe(TILE.floor);
    expect(at(1, 5)).toBe(TILE.floor);
  });

  it('can be faced at every piece of equipment from a walkable tile', () => {
    const walkable = reachable();
    expect(map.equipment.length).toBeGreaterThan(10);
    for (const e of map.equipment) {
      expect(at(e.x, e.y)).toBeDefined();
      expect(canBeFaced(e.x, e.y, walkable), `equipment at (${e.x}, ${e.y}) cannot be faced`).toBe(true);
    }
  });

  it('has the four pieces of equipment the rooms list, each with a line to say', () => {
    const keys = new Set(map.equipment.map(e => e.dialogueKey));
    for (const k of ['room1_equip1', 'room1_equip2', 'room1_equip3', 'room1_equip4', 'room1_laptop']) {
      expect(keys.has(k)).toBe(true);
      const lines = map.talk?.[k]?.(sport) ?? DIALOGUES[k]?.map(l => l.text);
      expect(lines && lines.length > 0, `no lines for ${k}`).toBe(true);
    }
  });

  it('uses the existing text for the treadmill, ergometer and gates', () => {
    expect(DIALOGUES['room1_equip1']![0]!.text).toBe('Testing equipment: Treadmill with gas analyser.');
    expect(DIALOGUES['room1_equip2']![0]!.text).toBe('Testing equipment: Cycle ergometer.');
    expect(DIALOGUES['room1_equip3']![0]!.text).toBe('Testing equipment: Timing gates and cones.');
  });

  it('says the athlete profile and goal on the laptop, verbatim', () => {
    expect(map.talk!['room1_laptop']!(sport)).toEqual([sport.athleteProfile, `Goal: ${sport.goal}`]);
  });

  it('shows no numbers on the lactate analyser before her tests are run (one line only)', () => {
    const lines = map.talk!['room1_equip4']!(sport);
    expect(lines).toEqual(['Testing equipment: Blood lactate analyser.']);
    expect(thresholdReadout(sport.dataOutput)).toBeNull();
    expect(thresholdReadout('LT1 3:45/km (2.0 mmol/L), LT2 3:20/km (4.0 mmol/L), VO2max 65')).toBe('LT1 3:45/km (2.0 mmol/L), LT2 3:20/km (4.0 mmol/L)');
  });

  it('has one line only on the analyser for a sport whose data has no thresholds', () => {
    expect(thresholdReadout(LEVEL_DATA[0]!.dataOutput)).toBeNull();
    expect(map.talk!['room1_equip4']!(LEVEL_DATA[0]!)).toEqual(['Testing equipment: Blood lactate analyser.']);
  });

  it('describes the room for screen readers, naming what is where', () => {
    expect(map.describe).toContain('Treadmill');
    expect(map.describe).toContain('timing gates');
    expect(map.describe).toContain('lactate');
    expect(map.describe).toContain('athlete waits at the start of the lane');
  });

  it('draws every tile from the lab range (100 to 199) or the game walls and door', () => {
    for (const row of map.tiles) {
      for (const tile of row) {
        const game = [T.WALL_TOP, T.WALL_LEFT, T.WALL_RIGHT, T.WALL_CORNER_TL, T.WALL_CORNER_TR, T.WALL_CORNER_BL, T.WALL_CORNER_BR, T.DOOR, T.NPC] as number[];
        expect(game.includes(tile) || (tile >= 100 && tile < 200), `tile id ${tile}`).toBe(true);
      }
    }
  });

  it('puts the technician on a tile nobody can walk onto, and animates in life()', () => {
    expect(isSolid(at(2, 3)!)).toBe(true);
    expect(typeof map.life).toBe('function');
  });
});
