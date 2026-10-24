// Regression guard for "the other three sports (and classic level 4) keep the classic rooms exactly as before".
// Compares the merged build's shared code against the pre-rooms commit fb8e2a1 (copied into regress-old-*.ts).
import { describe, expect, it } from 'vitest';
import { loadRooms } from '../../src/rooms/loader';

await loadRooms(); // the redesigned rooms' chunk, which the game loads after the title
import { ALL_MAPS, HUB_MAP, ROOM1_MAP, ROOM2_MAP, ROOM3_MAP, ROOM4_MAP, HUB_RETURN, HUB_START, ROOM_SPAWN, HUB_SIGNS } from '../../src/data/maps';
import * as OLD from './classic-maps.fixture';
import { checkInteraction, checkStandingOnDoor } from '../../src/systems/Collision';
import { checkInteraction as oldCheckInteraction, checkStandingOnDoor as oldCheckStandingOnDoor } from './classic-collision.fixture';
import { isDoor, isInteractable, isSolid, T } from '../../src/render/TileMap';
import { mapFor } from '../../src/data/rooms';
import { roomsRedesigned, REDESIGNED_LEVELS } from '../../src/rooms/preview';
import type { GameState } from '../../src/state/GameState';

const DIRS = ['up', 'down', 'left', 'right'] as const;
const fakeState = (x: number, y: number, dir: (typeof DIRS)[number]) =>
  ({ playerPos: { x, y }, playerDir: dir }) as unknown as GameState;

describe('classic maps are unchanged since fb8e2a1', () => {
  const pairs: Array<[string, unknown, unknown]> = [
    ['hub', HUB_MAP, OLD.HUB_MAP],
    ['room1', ROOM1_MAP, OLD.ROOM1_MAP],
    ['room2', ROOM2_MAP, OLD.ROOM2_MAP],
    ['room3', ROOM3_MAP, OLD.ROOM3_MAP],
    ['room4', ROOM4_MAP, OLD.ROOM4_MAP],
  ];
  for (const [id, now, before] of pairs) {
    it(`${id}: tiles, palette, name, npcs, equipment, doors identical`, () => {
      expect(now).toEqual(before);
    });
  }

  it('spawns, hub returns and signs identical', () => {
    expect(ROOM_SPAWN).toEqual(OLD.ROOM_SPAWN);
    expect(HUB_START).toEqual(OLD.HUB_START);
    expect(HUB_RETURN).toEqual(OLD.HUB_RETURN);
    expect(HUB_SIGNS).toEqual(OLD.HUB_SIGNS);
  });

  it('ALL_MAPS lists the same ids', () => {
    expect(Object.keys(ALL_MAPS).sort()).toEqual(Object.keys(OLD.ALL_MAPS).sort());
  });

  it('classic maps carry none of the new optional fields', () => {
    for (const m of Object.values(ALL_MAPS)) {
      expect(m.life).toBeUndefined();
      expect(m.talk).toBeUndefined();
      expect(m.describe).toBeUndefined();
      expect(m.npcFloor).toBeUndefined();
    }
  });
});

describe('Collision: classic maps behave exactly as before for every tile and facing', () => {
  for (const [id, map] of Object.entries(ALL_MAPS)) {
    it(`${id}: checkInteraction and checkStandingOnDoor agree with fb8e2a1 at every position and direction`, () => {
      const diffs: string[] = [];
      const rows = map.tiles.length;
      const cols = map.tiles[0]!.length;
      for (let y = -1; y <= rows; y++) {
        for (let x = -1; x <= cols; x++) {
          for (const d of DIRS) {
            const gs = fakeState(x, y, d);
            const a = checkInteraction(gs, map);
            const b = oldCheckInteraction(gs, map);
            if (JSON.stringify(a) !== JSON.stringify(b)) diffs.push(`${id} interact (${x},${y}) ${d}: now ${JSON.stringify(a)} was ${JSON.stringify(b)}`);
          }
          const gs = fakeState(x, y, 'up');
          const a = checkStandingOnDoor(gs, map);
          const b = oldCheckStandingOnDoor(gs, map);
          if (JSON.stringify(a) !== JSON.stringify(b)) diffs.push(`${id} door (${x},${y}): now ${JSON.stringify(a)} was ${JSON.stringify(b)}`);
        }
      }
      expect(diffs).toEqual([]);
    });

    it(`${id}: every equipment entry sits on an EQUIP tile (so position-based lookup changes nothing)`, () => {
      for (const e of map.equipment) {
        expect(map.tiles[e.y]?.[e.x], `${id} equipment ${e.dialogueKey} at ${e.x},${e.y}`).toBe(T.EQUIP);
      }
    });
  }
});

describe('TileMap: classic tiles keep their solidity/interactivity', () => {
  it('every classic tile id 0..99 answers like before', () => {
    // isSolid/isInteractable/isDoor for the original enum must not have changed (registered tiles are 100+)
    const solid = new Set<number>([
      T.WALL_TOP, T.WALL_LEFT, T.WALL_RIGHT, T.WALL_CORNER_TL, T.WALL_CORNER_TR, T.WALL_CORNER_BL, T.WALL_CORNER_BR,
      T.DESK, T.BOOKSHELF, T.MONITOR, T.TREADMILL, T.BENCH, T.PLANT, T.SIGN, T.NPC,
    ]);
    for (let id = 0; id < 100; id++) {
      // Walls etc. are solid, everything else not, in the original code; see TileMap.isSolid at fb8e2a1
      if (solid.has(id)) expect(isSolid(id), `solid ${id}`).toBe(true);
    }
    expect(isDoor(T.DOOR)).toBe(true);
    expect(isDoor(T.BOSS_DOOR)).toBe(true);
    expect(isInteractable(T.EQUIP)).toBe(true);
    expect(isInteractable(T.NPC)).toBe(true);
    expect(isSolid(T.FLOOR)).toBe(false);
    expect(isSolid(T.FLOOR_ALT)).toBe(false);
    expect(isSolid(T.MAT)).toBe(false);
    expect(isSolid(T.RUG)).toBe(false);
    expect(isSolid(T.EQUIP)).toBe(false);
  });
});

describe('mapFor / roomsRedesigned (no window in vitest: the default applies)', () => {
  it('only Distance Running (index 3) is redesigned', () => {
    expect([...REDESIGNED_LEVELS]).toEqual([3]);
  });

  it('levels 0-2 always get the classic map objects', () => {
    for (const level of [0, 1, 2]) {
      expect(roomsRedesigned(level)).toBe(false);
      for (const id of ['hub', 'room1', 'room2', 'room3', 'room4']) {
        expect(mapFor(id, level)).toBe(ALL_MAPS[id]);
      }
    }
  });

  it('the hub is the classic hub for every level', () => {
    for (const level of [0, 1, 2, 3]) expect(mapFor('hub', level)).toBe(ALL_MAPS['hub']);
  });
});
