// The Distance Running hub's lobby (src/data/rooms/hub.ts, tiles in hub-tiles.ts, moving parts in hub-life.ts): its
// own tiles (ids 600-699), walkable exactly where the classic hub is (but for the ATHLETE door's walls and the two
// stations, now solid furniture), doors and the Director on their classic ids, the stations and the board in reach,
// the arrow's floor cells left plain, and an animation that only ever paints on walls, furniture and doors.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DIRECTOR_HUB } from '../src/data/rooms/hub';
import { HUB_T, deptTiles, type Dept } from '../src/data/rooms/hub-tiles';
import { HUB_SPOTS } from '../src/data/rooms/hub-life';
import { HUB_MAP } from '../src/data/maps';
import { DIRECTOR_KEY, MEET_DOOR, MEET_RETURN } from '../src/data/meetDoor';
import { BOARD_KEY } from '../src/data/supportBoard';
import { LEVEL_DATA } from '../src/data/sports';
import { T, isDoor, isSolid } from '../src/render/TileMap';
import { checkInteraction, isBlocked } from '../src/systems/Collision';
import type { GameState } from '../src/state/GameState';

const map = DIRECTOR_HUB;
const key = (x: number, y: number) => `${x},${y}`;

const reachable = (tiles: number[][], from: { x: number; y: number }) => {
  const seen = new Set<string>([key(from.x, from.y)]);
  const queue = [from];
  while (queue.length) {
    const p = queue.shift()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const x = p.x + dx;
      const y = p.y + dy;
      if (seen.has(key(x, y)) || isBlocked(tiles, x, y)) continue;
      seen.add(key(x, y));
      queue.push({ x, y });
    }
  }
  return seen;
};

/** Can the player stand next to `target` and, facing it, get it back from checkInteraction? */
const faceable = (target: { x: number; y: number }, open: Set<string>) =>
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
    if (!open.has(key(x, y))) return false;
    const hit = checkInteraction({ playerPos: { x, y }, playerDir: dir } as unknown as GameState, map);
    return hit.x === target.x && hit.y === target.y && hit.type !== null;
  });

/** The cells the scene's gold arrow bobs over (in front of each door, and the arena's pair). */
const ARROW_CELLS = ['5,3', '10,3', '5,7', '10,7', '3,11', '7,11', '8,11'];
const PLAIN_FLOOR = new Set<number>([HUB_T.floor, HUB_T.floorAlt, HUB_T.floorShadow, HUB_T.floorShadowAlt]);

describe('the Distance Running hub: the lobby', () => {
  const open = reachable(map.tiles, { x: 7, y: 7 });

  it('is 16 x 14 and uses only its own tiles (600-699) besides the classic doors and NPC cell', () => {
    expect(map.tiles.length).toBe(14);
    const classic = new Set<number>([T.DOOR, T.BOSS_DOOR, T.NPC]);
    for (const row of map.tiles) {
      expect(row.length).toBe(16);
      for (const id of row) expect(classic.has(id) || (id >= 600 && id <= 699), `tile ${id}`).toBe(true);
    }
  });

  it('is solid exactly where the classic hub is, but for the ATHLETE door\'s walls and the two stations', () => {
    const diffs: string[] = [];
    for (let y = 0; y < 14; y++)
      for (let x = 0; x < 16; x++) if (isSolid(map.tiles[y]![x]!) !== isSolid(HUB_MAP.tiles[y]![x]!)) diffs.push(key(x, y));
    expect(diffs).toEqual(['2,7', '13,7', '2,12', '4,12']);
    // so the same floor is reachable, less those four cells
    const classicOpen = reachable(HUB_MAP.tiles, { x: 7, y: 7 });
    for (const d of diffs) classicOpen.delete(d);
    expect([...open].sort()).toEqual([...classicOpen].sort());
  });

  it('keeps the doors and the Director on their classic ids, all reachable, with the rug under the Director', () => {
    for (const d of map.doors) {
      expect(isDoor(map.tiles[d.y]![d.x]!), `${d.target} door`).toBe(true);
      expect(open.has(key(d.x, d.y)), `${d.target} door`).toBe(true);
    }
    expect(map.tiles[12]![7]).toBe(T.BOSS_DOOR);
    expect(map.tiles[12]![8]).toBe(T.BOSS_DOOR);
    expect(map.tiles[MEET_DOOR.y]![MEET_DOOR.x]).toBe(T.DOOR);
    expect(open.has(key(MEET_RETURN.x, MEET_RETURN.y))).toBe(true);
    expect(map.npcs).toEqual([{ x: 7, y: 5, dialogueKey: DIRECTOR_KEY }]);
    expect(map.tiles[5]![7]).toBe(T.NPC);
    expect(map.npcFloor).toBe(HUB_T.rugT);
    expect(isSolid(map.npcFloor!)).toBe(false);
    expect(faceable({ x: 7, y: 5 }, open)).toBe(true);
  });

  it('makes the two stations solid furniture that can be faced, and the board faceable from the floor below it', () => {
    for (const e of map.equipment) {
      expect(faceable(e, open), `${e.dialogueKey} at ${e.x},${e.y}`).toBe(true);
      expect(isSolid(map.tiles[e.y]![e.x]!), `${e.dialogueKey} at ${e.x},${e.y}`).toBe(true);
    }
    expect(map.tiles[7]![2]).toBe(HUB_T.console);
    expect(map.tiles[7]![13]).toBe(HUB_T.podFoot);
    for (const e of map.equipment.filter(e => e.dialogueKey === BOARD_KEY)) {
      expect(map.tiles[e.y]![e.x]).toBe(HUB_T.wallNorth); // plain wall behind the board
      expect(open.has(key(e.x, e.y + 1))).toBe(true);
    }
  });

  it('leaves the cells under the gold arrow as plain floor', () => {
    for (const c of ARROW_CELLS) {
      const [x, y] = c.split(',').map(Number) as [number, number];
      expect(PLAIN_FLOOR.has(map.tiles[y]![x]!), `cell ${c}`).toBe(true);
    }
  });

  it('frames each door with its own department\'s piers', () => {
    const at = (x: number, y: number) => map.tiles[y]![x]!;
    for (const d of HUB_SPOTS.doors) {
      const ids = deptTiles(d.dept as Dept);
      expect(at(d.x, d.y)).toBe(T.DOOR);
      expect([at(d.x - 1, d.y), at(d.x + 1, d.y)], d.dept).toEqual([ids.pierL, ids.pierR]);
    }
  });

  it('describes the lobby, its doors and the board', () => {
    expect(map.describe).toMatch(/ATHLETE/);
    expect(map.describe).toMatch(/SUPPORT BOARD/);
    expect(map.describe).toMatch(/ARENA/);
    expect(map.describe).toMatch(/monitoring station/);
    expect(map.describe).toMatch(/recovery station/);
  });
});

describe('the lobby\'s animation', () => {
  interface Hit {
    x: number;
    y: number;
    w: number;
    h: number;
    image?: boolean;
  }
  const makeCtx = (hits: Hit[]) =>
    ({
      fillStyle: '',
      fillRect: (x: number, y: number, w: number, h: number) => hits.push({ x, y, w, h }),
      drawImage: (img: { width: number; height: number }, x: number, y: number) =>
        hits.push({ x, y, w: img.width, h: img.height, image: true }),
    }) as unknown as CanvasRenderingContext2D;

  beforeEach(() => {
    vi.stubGlobal('document', {
      createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillStyle: '', fillRect() {}, drawImage() {} }) }),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  const sport = LEVEL_DATA[3]!;
  const walkable = (px: number, py: number) => {
    const tile = map.tiles[Math.floor(py / 16)]?.[Math.floor(px / 16)];
    return tile !== undefined && !isSolid(tile) && !isDoor(tile);
  };

  it('paints only on walls, furniture and doors, never on the floor the player walks on', () => {
    for (let t = 0; t < 15; t += 0.13) {
      const hits: Hit[] = [];
      map.life!(makeCtx(hits), t, sport);
      for (const h of hits.filter(h => !h.image)) {
        for (const [px, py] of [[h.x, h.y], [h.x + h.w - 1, h.y + h.h - 1]] as const) {
          expect(walkable(px, py), `paint at ${px},${py} (t=${t.toFixed(2)})`).toBe(false);
        }
      }
    }
  });

  it('lays the door fronts as one cached layer, and moves', () => {
    const a: Hit[] = [];
    const b: Hit[] = [];
    map.life!(makeCtx(a), 0, sport);
    map.life!(makeCtx(b), 3.3, sport);
    expect(a.filter(h => h.image)).toEqual([{ x: 0, y: 0, w: 256, h: 224, image: true }]);
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it('draws the same thing at the same time (a frozen clock is a still picture)', () => {
    const a: Hit[] = [];
    const b: Hit[] = [];
    map.life!(makeCtx(a), 0, sport);
    map.life!(makeCtx(b), 0, sport);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
