// Adversarial map checks: tile id collisions between rooms, reachability, facing the athlete and every
// equipment entry, dialogue keys that resolve, and the classic maps still behaving as before.
import { describe, expect, it, vi } from 'vitest';

const registered: { ids: number[] }[] = [];

vi.mock('../../src/render/TileMap', async importOriginal => {
  const real = await importOriginal<typeof import('../../src/render/TileMap')>();
  return {
    ...real,
    registerTiles: (defs: Record<number, unknown>) => {
      registered.push({ ids: Object.keys(defs).map(Number) });
      return real.registerTiles(defs as never);
    },
  };
});

// The redesigned rooms' chunk (which the game loads after the title), loaded once the spy above is in place
const { loadRooms } = await import('../../src/rooms/loader');
await loadRooms();

const { T, isSolid, isDoor } = await import('../../src/render/TileMap');
const { mapFor } = await import('../../src/data/rooms');
const { ALL_MAPS, ROOM_SPAWN } = await import('../../src/data/maps');
const { DIALOGUES } = await import('../../src/data/dialogue');
const { LEVEL_DATA } = await import('../../src/data/sports');
const { isBlocked, checkInteraction } = await import('../../src/systems/Collision');

const ROOMS = ['room1', 'room2', 'room3', 'room4'] as const;
const RANGE: Record<string, [number, number]> = { room1: [100, 199], room2: [200, 299], room3: [300, 399], room4: [400, 499] };

const reachable = (tiles: number[][], from: { x: number; y: number }) => {
  const seen = new Set<string>();
  const queue = [from];
  seen.add(`${from.x},${from.y}`);
  while (queue.length) {
    const p = queue.shift()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const x = p.x + dx;
      const y = p.y + dy;
      const key = `${x},${y}`;
      if (seen.has(key)) continue;
      // doors are walkable tiles (stepping on one leaves); solid tiles are not
      if (isBlocked(tiles, x, y)) continue;
      seen.add(key);
      queue.push({ x, y });
    }
  }
  return seen;
};

describe('tile registration', () => {
  it('no id is registered twice, and each registration stays in its room range', () => {
    const seen = new Map<number, number>();
    registered.forEach((r, i) => {
      for (const id of r.ids) {
        expect(seen.has(id), `tile ${id} registered by call ${seen.get(id)} and ${i}`).toBe(false);
        seen.set(id, i);
      }
    });
    // each call's ids sit inside one hundred-block
    for (const r of registered) {
      const blocks = new Set(r.ids.map(id => Math.floor(id / 100)));
      expect(blocks.size, `call mixes ranges: ${[...blocks]}`).toBe(1);
    }
    expect(registered.length).toBeGreaterThanOrEqual(4);
  });
});

describe.each(ROOMS)('%s redesigned map', room => {
  const map = mapFor(room, 3)!;
  const [lo, hi] = RANGE[room]!;

  it('is 16 x 14 with rectangular rows', () => {
    expect(map.tiles.length).toBe(14);
    for (const row of map.tiles) expect(row.length).toBe(16);
  });

  it('only uses its own custom ids (or the shared T tiles)', () => {
    const shared = new Set(Object.values(T));
    for (const row of map.tiles)
      for (const id of row) {
        if (shared.has(id as never)) continue;
        expect(id >= lo && id <= hi, `${room}: tile ${id} outside ${lo}-${hi}`).toBe(true);
      }
  });

  it('spawn is open, door reachable, every open tile reachable', () => {
    expect(isBlocked(map.tiles, ROOM_SPAWN.x, ROOM_SPAWN.y)).toBe(false);
    const seen = reachable(map.tiles, ROOM_SPAWN);
    const door = map.doors[0]!;
    expect(seen.has(`${door.x},${door.y}`)).toBe(true);
    const lost: string[] = [];
    map.tiles.forEach((row, y) => row.forEach((id, x) => {
      if (!isSolid(id) && !seen.has(`${x},${y}`)) lost.push(`${x},${y}(${id})`);
    }));
    expect(lost).toEqual([]);
  });

  it('the athlete is on an NPC tile and can be faced from an open reachable tile', () => {
    const seen = reachable(map.tiles, ROOM_SPAWN);
    for (const npc of map.npcs) {
      expect(map.tiles[npc.y]?.[npc.x]).toBe(T.NPC);
      const faced = [[0, 1], [0, -1], [1, 0], [-1, 0]].filter(([dx, dy]) => seen.has(`${npc.x + dx!},${npc.y + dy!}`));
      expect(faced.length, `${room}: athlete cannot be faced`).toBeGreaterThan(0);
    }
  });

  it('every equipment entry can be faced from a reachable tile and has lines', () => {
    const seen = reachable(map.tiles, ROOM_SPAWN);
    const sport = LEVEL_DATA[3]!;
    for (const e of map.equipment) {
      expect(e.x >= 0 && e.x < 16 && e.y >= 0 && e.y < 14, `${room}: equipment ${e.dialogueKey} off the map`).toBe(true);
      const tile = map.tiles[e.y]![e.x]!;
      expect(tile, `${room}: equipment on an NPC tile`).not.toBe(T.NPC);
      expect(isDoor(tile), `${room}: equipment on a door`).toBe(false);
      const faced = [[0, 1], [0, -1], [1, 0], [-1, 0]].filter(([dx, dy]) => seen.has(`${e.x + dx!},${e.y + dy!}`));
      expect(faced.length, `${room}: ${e.dialogueKey} at ${e.x},${e.y} cannot be faced`).toBeGreaterThan(0);
      const own = map.talk?.[e.dialogueKey]?.(sport);
      const lines = own ?? DIALOGUES[e.dialogueKey]?.map(l => l.text);
      expect(lines && lines.length > 0, `${room}: no lines for ${e.dialogueKey}`).toBe(true);
    }
  });

  it('facing an equipment entry through checkInteraction gives its key (every direction that reaches it)', () => {
    const seen = reachable(map.tiles, ROOM_SPAWN);
    for (const e of map.equipment) {
      for (const [dx, dy, dir] of [[0, 1, 'up'], [0, -1, 'down'], [1, 0, 'left'], [-1, 0, 'right']] as const) {
        const sx = e.x + dx;
        const sy = e.y + dy;
        if (!seen.has(`${sx},${sy}`)) continue;
        const state = { playerPos: { x: sx, y: sy }, playerDir: dir } as never;
        const hit = checkInteraction(state, map);
        expect(hit.type).toBe('equipment');
        expect(hit.dialogueKey).toBe(e.dialogueKey);
      }
    }
  });
});

describe('classic maps are untouched by the equipment-by-position rule', () => {
  it.each(Object.keys(ALL_MAPS))('%s: every listed equipment entry sits on an EQUIP tile', id => {
    const map = ALL_MAPS[id]!;
    for (const e of map.equipment) {
      expect(map.tiles[e.y]?.[e.x], `${id}: equipment ${e.dialogueKey} at ${e.x},${e.y}`).toBe(T.EQUIP);
    }
  });
  it.each(Object.keys(ALL_MAPS))('%s: every EQUIP tile has an equipment entry (nothing lost)', id => {
    const map = ALL_MAPS[id]!;
    map.tiles.forEach((row, y) => row.forEach((tile, x) => {
      if (tile === T.EQUIP) expect(map.equipment.some(e => e.x === x && e.y === y), `${id}: EQUIP at ${x},${y} has no entry`).toBe(true);
    }));
  });
  it('classic room palettes match what RoomChallengeScene used to hard-code', () => {
    const old: Record<string, string> = { room1: 'lab', room2: 'gym', room3: 'track', room4: 'lab' };
    for (const room of ROOMS) expect(ALL_MAPS[room]!.palette, room).toBe(old[room]);
  });
  it('mapFor returns the classic map for levels 0-2', () => {
    for (const level of [0, 1, 2]) for (const room of ROOMS) expect(mapFor(room, level)).toBe(ALL_MAPS[room]);
  });
});
