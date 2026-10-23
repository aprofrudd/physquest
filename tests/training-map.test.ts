// The Training Floor's walk-around map: it follows the classic rules (16x14, spawn and door where the game
// expects them, everything reachable) and keeps the fenced lane out of the player's way.
import { describe, expect, it } from 'vitest';
import { DIALOGUES } from '../src/data/dialogue';
import { ROOM_SPAWN } from '../src/data/maps';
import { LEVEL_DATA } from '../src/data/sports';
import { T, isDoor, isSolid } from '../src/render/TileMap';
import { TRAINING_FLOOR } from '../src/data/rooms/training';
import { COACH_TILE, ATHLETE_TILE, BOARD_W, BOARD_XS } from '../src/data/rooms/training-life';
import { TRAIN, TRAIN_TILES } from '../src/data/rooms/training-tiles';

const map = TRAINING_FLOOR;
const sport = LEVEL_DATA[3]!;
const tileAt = (x: number, y: number): number | undefined => map.tiles[y]?.[x];
const walkable = (x: number, y: number): boolean => {
  const tile = tileAt(x, y);
  return tile !== undefined && !isSolid(tile);
};

/** Every tile the player can stand on, walking from the room's spawn. */
const reachable = (): Set<string> => {
  const seen = new Set<string>([`${ROOM_SPAWN.x},${ROOM_SPAWN.y}`]);
  const queue: Array<[number, number]> = [[ROOM_SPAWN.x, ROOM_SPAWN.y]];
  while (queue.length > 0) {
    const [x, y] = queue.shift()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      const key = `${nx},${ny}`;
      if (seen.has(key) || !walkable(nx, ny)) continue;
      seen.add(key);
      queue.push([nx, ny]);
    }
  }
  return seen;
};

const canFaceFrom = (x: number, y: number, standable: Set<string>): boolean =>
  [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => standable.has(`${x + dx!},${y + dy!}`));

describe('the Training Floor map', () => {
  it('is one screen: 16 by 14 tiles in the track palette', () => {
    expect(map.tiles).toHaveLength(14);
    for (const row of map.tiles) expect(row).toHaveLength(16);
    expect(map.palette).toBe('track');
    expect(map.name).toBe('Training Floor');
  });

  it('is walled all round, and leaves by the door at (7,12) back to the hub', () => {
    for (let x = 0; x < 16; x++) {
      expect(isSolid(tileAt(x, 0)!)).toBe(true);
      expect(isSolid(tileAt(x, 13)!)).toBe(true);
    }
    for (let y = 0; y < 14; y++) {
      expect(isSolid(tileAt(0, y)!)).toBe(true);
      expect(isSolid(tileAt(15, y)!)).toBe(true);
    }
    expect(tileAt(7, 12)).toBe(T.DOOR);
    expect(isDoor(tileAt(7, 12)!)).toBe(true);
    expect(map.doors).toEqual([{ x: 7, y: 12, target: 'hub' }]);
  });

  it('lets the player walk in at the spawn and out through the door', () => {
    expect(walkable(ROOM_SPAWN.x, ROOM_SPAWN.y)).toBe(true);
    expect(ROOM_SPAWN).toMatchObject({ x: 7, y: 10, dir: 'up' });
    expect(reachable().has('7,12')).toBe(true);
  });

  it('has the athlete on the floor, faceable from a tile the player can reach', () => {
    expect(map.npcs).toEqual([{ x: ATHLETE_TILE.x, y: ATHLETE_TILE.y, dialogueKey: 'room3_athlete' }]);
    expect(tileAt(ATHLETE_TILE.x, ATHLETE_TILE.y)).toBe(T.NPC);
    expect(map.npcFloor).toBe(TRAIN.FLOOR);
    expect(canFaceFrom(ATHLETE_TILE.x, ATHLETE_TILE.y, reachable())).toBe(true);
  });

  it('keeps the tiles above the athlete quiet, so the "!" bubble has plain floor behind it', () => {
    for (const dy of [1, 2]) expect(tileAt(ATHLETE_TILE.x, ATHLETE_TILE.y - dy)).toBe(TRAIN.FLOOR);
  });

  it('keeps every piece of equipment faceable, and gives each one something to say', () => {
    const standable = reachable();
    for (const item of map.equipment) {
      expect(canFaceFrom(item.x, item.y, standable), `${item.dialogueKey} at ${item.x},${item.y}`).toBe(true);
      const lines = map.talk?.[item.dialogueKey]?.(sport) ?? DIALOGUES[item.dialogueKey]?.map(l => l.text);
      expect(lines?.length ?? 0).toBeGreaterThan(0);
    }
    expect([...new Set(map.equipment.map(e => e.dialogueKey))].sort()).toEqual(['room3_equip1', 'room3_equip2', 'room3_equip3', 'room3_equip4']);
  });

  it('lets every wall tile under a board read it, not only the middle one (zones, interval, legs, week)', () => {
    const keys = ['room3_equip1', 'room3_equip3', 'room3_equip4', 'room3_equip2'];
    BOARD_XS.forEach((x, i) => {
      for (let px = x; px < x + BOARD_W; px++) {
        const tile = Math.floor(px / 16);
        expect(map.equipment.find(e => e.x === tile && e.y === 1)?.dialogueKey, `pixel ${px}`).toBe(keys[i]);
      }
    });
    // ...and no tile of the wall that has no board over it reads anything
    for (const item of map.equipment) {
      const underABoard = BOARD_XS.some(x => item.x >= Math.floor(x / 16) && item.x <= Math.floor((x + BOARD_W - 1) / 16));
      expect(underABoard, `equipment at ${item.x},${item.y}`).toBe(true);
    }
    // each tile is listed once
    expect(new Set(map.equipment.map(e => `${e.x},${e.y}`)).size).toBe(map.equipment.length);
  });

  it('reads the four coach boards as the old equipment lines', () => {
    const lines = (key: string) => map.talk?.[key]?.(sport) ?? DIALOGUES[key]?.map(l => l.text) ?? [];
    expect(lines('room3_equip2')).toEqual(['Periodisation planner.']);
    expect(lines('room3_equip3')).toEqual(['Interval timer station.']);
    expect(lines('room3_equip4')).toEqual(['Load monitoring display.']);
  });

  it('adds the level\'s zones, as sports.ts words them, to the zone calculator', () => {
    const lines = map.talk?.['room3_equip1']?.(sport) ?? [];
    expect(lines[0]).toBe('Training zone calculator.');
    expect(lines.slice(1)).toEqual(sport.zones.map(z => `${z.name}: ${z.description}`));
  });

  it('hangs the four boards on the wall, in the row of wall-face tiles', () => {
    for (const item of map.equipment) {
      expect(item.y).toBe(1);
      expect(tileAt(item.x, item.y)).toBe(TRAIN.WALL_FACE);
    }
  });

  it('fences the lane: no lane tile is walkable and none can be reached', () => {
    const standable = reachable();
    for (let y = 2; y <= 11; y++) {
      for (const x of [1, 2]) {
        expect(walkable(x, y), `lane tile ${x},${y}`).toBe(false);
        expect(standable.has(`${x},${y}`)).toBe(false);
      }
    }
  });

  it('puts the coach on a solid tile that is not something to talk to', () => {
    expect(tileAt(COACH_TILE.x, COACH_TILE.y)).toBe(TRAIN.COACH_FLOOR);
    expect(isSolid(TRAIN.COACH_FLOOR)).toBe(true);
    expect(map.npcs.some(n => n.x === COACH_TILE.x && n.y === COACH_TILE.y)).toBe(false);
    expect(map.equipment.some(e => e.x === COACH_TILE.x && e.y === COACH_TILE.y)).toBe(false);
  });

  it('uses only the shell\'s tiles and this room\'s own (ids 300-399)', () => {
    const known = new Set<number>(Object.values(T));
    for (const row of map.tiles) {
      for (const tile of row) expect(known.has(tile) || (tile >= 300 && tile < 400), `tile ${tile}`).toBe(true);
    }
    for (const id of Object.values(TRAIN)) expect(id >= 300 && id < 400).toBe(true);
  });

  it('draws every tile as 16 by 16 palette indices of the track palette (0-5)', () => {
    for (const [id, def] of Object.entries(TRAIN_TILES)) {
      expect(def.pattern, `tile ${id}`).toHaveLength(16);
      for (const row of def.pattern) {
        expect(row, `tile ${id}`).toHaveLength(16);
        for (const index of row) expect(Number.isInteger(index) && index >= 0 && index <= 5, `tile ${id} index ${index}`).toBe(true);
      }
    }
    expect(Object.keys(TRAIN_TILES).map(Number).sort()).toEqual(Object.values(TRAIN).sort());
  });

  it('blocks walking on the lane, the machines, the boxes and the coach, and nothing else', () => {
    const solidIds = Object.entries(TRAIN_TILES).filter(([, def]) => def.solid).map(([id]) => Number(id));
    const openIds = Object.entries(TRAIN_TILES).filter(([, def]) => !def.solid).map(([id]) => Number(id));
    expect(openIds.sort()).toEqual([TRAIN.FLOOR, TRAIN.TURF, TRAIN.LADDER].sort());
    for (const id of solidIds) expect(isSolid(id)).toBe(true);
    for (const id of openIds) expect(isSolid(id)).toBe(false);
  });

  it('leaves plenty of floor to walk on, all of it connected', () => {
    const standable = reachable();
    let floor = 0;
    for (let y = 1; y <= 12; y++) for (let x = 1; x <= 14; x++) if (walkable(x, y)) floor++;
    expect(standable.size).toBe(floor); // nothing walkable is cut off
    expect(floor).toBeGreaterThan(60);
  });

  it('has a description for screen readers and a life animation', () => {
    expect(map.describe?.length ?? 0).toBeGreaterThan(40);
    expect(typeof map.life).toBe('function');
  });
});
