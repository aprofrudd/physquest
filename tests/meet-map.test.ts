// The ATHLETE room's map (src/data/rooms/meet.ts) and the Distance Running hub (src/data/rooms/hub.ts).
import { describe, expect, it } from 'vitest';
import { MEET_ROOM } from '../src/data/rooms/meet';
import { DIRECTOR_HUB } from '../src/data/rooms/hub';
import { HUB_MAP, ROOM_SPAWN } from '../src/data/maps';
import { DIRECTOR_KEY, MEET_DOOR, MEET_RETURN } from '../src/data/meetDoor';
import { LEVEL_DATA } from '../src/data/sports';
import { T, isSolid } from '../src/render/TileMap';
import { checkInteraction, isBlocked } from '../src/systems/Collision';
import type { GameState } from '../src/state/GameState';

const reachable = (tiles: number[][], from: { x: number; y: number }) => {
  const seen = new Set<string>([`${from.x},${from.y}`]);
  const queue = [from];
  while (queue.length) {
    const p = queue.shift()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const x = p.x + dx;
      const y = p.y + dy;
      if (seen.has(`${x},${y}`) || isBlocked(tiles, x, y)) continue;
      seen.add(`${x},${y}`);
      queue.push({ x, y });
    }
  }
  return seen;
};

const facing = (map: typeof MEET_ROOM, target: { x: number; y: number }, open: Set<string>) =>
  (
    [
      [0, 1, 'up'],
      [0, -1, 'down'],
      [1, 0, 'left'],
      [-1, 0, 'right'],
    ] as const
  ).some(([dx, dy, dir]) => {
    const x = target.x + dx;
    const y = target.y + dy;
    if (!open.has(`${x},${y}`)) return false;
    const hit = checkInteraction({ playerPos: { x, y }, playerDir: dir } as unknown as GameState, map);
    return hit.x === target.x && hit.y === target.y && hit.type !== null;
  });

describe('the ATHLETE room map', () => {
  const map = MEET_ROOM;
  const open = reachable(map.tiles, ROOM_SPAWN);

  it('is 16 x 14, uses only its own ids (500-599) or the shared T tiles, and its spawn is open', () => {
    expect(map.tiles.length).toBe(14);
    for (const row of map.tiles) {
      expect(row.length).toBe(16);
      for (const id of row) expect(id < 100 || (id >= 500 && id <= 599), `tile ${id}`).toBe(true);
    }
    expect(isBlocked(map.tiles, ROOM_SPAWN.x, ROOM_SPAWN.y)).toBe(false);
    expect(map.doors).toEqual([{ x: 7, y: 12, target: 'hub' }]);
    expect(map.tiles[12]![7]).toBe(T.DOOR);
  });

  it('can reach and face the athlete and every piece of equipment, whose lines all resolve', () => {
    const [aisha] = map.npcs;
    expect(map.tiles[aisha!.y]![aisha!.x]).toBe(T.NPC);
    expect(facing(map, aisha!, open)).toBe(true);
    const sport = LEVEL_DATA[3]!;
    for (const e of map.equipment) {
      expect(facing(map, e, open), `${e.dialogueKey} at ${e.x},${e.y}`).toBe(true);
      const lines = map.talk?.[e.dialogueKey]?.(sport);
      expect(lines && lines.length > 0, e.dialogueKey).toBe(true);
      for (const l of lines!) expect(l).not.toMatch(/\{|coach/i);
    }
  });

  it('has a life animation, a description and a rug under the athlete', () => {
    expect(map.life).toBeTypeOf('function');
    expect(map.describe).toMatch(/table/);
    expect(isSolid(map.npcFloor!)).toBe(false);
  });
});

describe('the Distance Running hub', () => {
  it('walks like the classic hub plus the ATHLETE door and its walls, with the Director where the athlete stood', () => {
    expect(DIRECTOR_HUB.tiles.length).toBe(HUB_MAP.tiles.length);
    // The lobby has its own tiles, but what can be walked on differs from the classic hub only where intended: the
    // ATHLETE door's two walls on the bottom row (the door itself stays walkable), and the two equipment stations, now solid furniture
    const diffs: string[] = [];
    for (let y = 0; y < 14; y++) {
      expect(DIRECTOR_HUB.tiles[y]!.length).toBe(HUB_MAP.tiles[y]!.length);
      for (let x = 0; x < 16; x++) {
        if (isSolid(DIRECTOR_HUB.tiles[y]![x]!) !== isSolid(HUB_MAP.tiles[y]![x]!)) diffs.push(`${x},${y}`);
      }
    }
    expect(diffs).toEqual(['2,7', '13,7', '2,12', '4,12']);
    // the engine finds doors and the NPC by their classic ids
    for (const d of HUB_MAP.doors) expect(DIRECTOR_HUB.tiles[d.y]![d.x]).toBe(HUB_MAP.tiles[d.y]![d.x]);
    expect(DIRECTOR_HUB.tiles[5]![7]).toBe(T.NPC);
    expect(DIRECTOR_HUB.tiles[MEET_DOOR.y]![MEET_DOOR.x]).toBe(T.DOOR);
    expect(DIRECTOR_HUB.npcs).toEqual([{ x: 7, y: 5, dialogueKey: DIRECTOR_KEY }]);
    const open = reachable(DIRECTOR_HUB.tiles, { x: 7, y: 7 });
    expect(open.has(`${MEET_RETURN.x},${MEET_RETURN.y}`)).toBe(true);
    expect(open.has(`${MEET_DOOR.x},${MEET_DOOR.y}`)).toBe(true);
    for (const d of DIRECTOR_HUB.doors) expect(open.has(`${d.x},${d.y}`), `${d.target} door`).toBe(true);
  });
});
