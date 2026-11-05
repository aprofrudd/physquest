// The redesigned Data Lab map: the classic rules every room map keeps (spawn, door, connected floor, an athlete
// you can face), the tiles it registers, what its equipment says, and that its animation leaves the space
// above the athlete quiet (her "!" bubble goes there).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DIALOGUES } from '../src/data/dialogue';
import { LEVEL_DATA } from '../src/data/sports';
import { ROOM_SPAWN } from '../src/data/maps';
import { DATA_LAB } from '../src/data/rooms/datalab';
import { DATALAB_PATTERNS, DL } from '../src/data/rooms/datalab-tiles';
import { WALL_SCREEN_AT, WALL_SLOTS, screensFor } from '../src/data/rooms/datalab-life';
import { PALETTES } from '../src/render/Palettes';
import { T, isSolid } from '../src/render/TileMap';

const sport = LEVEL_DATA[3]!;
const map = DATA_LAB;
const W = 16;
const H = 14;
const key = (x: number, y: number) => `${x},${y}`;
const solid = (x: number, y: number): boolean => {
  const tile = map.tiles[y]?.[x];
  return tile === undefined || isSolid(tile);
};

/** Tiles reachable on foot from the spawn. */
const reachable = (): Set<string> => {
  const seen = new Set<string>([key(ROOM_SPAWN.x, ROOM_SPAWN.y)]);
  const queue: Array<[number, number]> = [[ROOM_SPAWN.x, ROOM_SPAWN.y]];
  while (queue.length) {
    const [x, y] = queue.shift()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (seen.has(key(nx, ny)) || solid(nx, ny)) continue;
      seen.add(key(nx, ny));
      queue.push([nx, ny]);
    }
  }
  return seen;
};

const faceable = (x: number, y: number, from: Set<string>): boolean =>
  [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => from.has(key(x + dx!, y + dy!)));

describe('the Data Lab map', () => {
  it('is 16 x 14 in the data palette with the floor under the athlete', () => {
    expect(map.tiles.length).toBe(H);
    for (const row of map.tiles) expect(row.length).toBe(W);
    expect(map.palette).toBe('data');
    expect(PALETTES[map.palette].colors.length).toBe(6);
    expect(map.npcFloor).toBe(DL.FLOOR);
    expect(map.name).toBe('Data Lab');
  });

  it('keeps the classic rules: spawn (7,10) facing up, door (7,12) back to the hub, connected floor', () => {
    expect(ROOM_SPAWN).toEqual({ x: 7, y: 10, dir: 'up' });
    expect(map.doors).toEqual([{ x: 7, y: 12, target: 'hub' }]);
    expect(map.tiles[12]![7]).toBe(T.DOOR);
    expect(solid(7, 10)).toBe(false);
    const seen = reachable();
    expect(seen.has(key(7, 12))).toBe(true);
    // every walkable tile can be reached: no pockets of floor the player cannot get to
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        if (!solid(x, y)) expect(seen.has(key(x, y)), `tile (${x},${y}) is walkable but unreachable`).toBe(true);
      }
    }
  });

  it('is walled all round (the door aside)', () => {
    for (let x = 0; x < W; x++) {
      expect(solid(x, 0)).toBe(true);
      expect(solid(x, H - 1)).toBe(true);
    }
    for (let y = 0; y < H; y++) {
      expect(solid(0, y)).toBe(true);
      expect(solid(W - 1, y)).toBe(true);
    }
  });

  it("has one athlete at the results desk, 'room2_athlete', who can be faced", () => {
    expect(map.npcs).toEqual([{ x: 10, y: 7, dialogueKey: 'room2_athlete' }]);
    expect(map.tiles[7]![10]).toBe(T.NPC);
    expect(faceable(10, 7, reachable())).toBe(true);
  });

  it('only uses tiles that exist: the game tiles and the ones this room registers', () => {
    const known = new Set<number>([...Object.values(T), ...Object.values(DL)]);
    for (const row of map.tiles) for (const tile of row) expect(known.has(tile), `unknown tile ${tile}`).toBe(true);
  });

  it('has a solid tile under every seated analyst and the printer, and walk-on cables', () => {
    for (const [x, y] of [[2, 6], [6, 6], [3, 10]] as const) expect(solid(x, y), `analyst at (${x},${y})`).toBe(true);
    expect(solid(12, 7)).toBe(true);
    expect(solid(5, 10)).toBe(false);
    expect(solid(7, 10)).toBe(false); // the cover plate the coach starts on
  });
});

describe('the tiles', () => {
  it('uses ids 200-299, 16 x 16 patterns and palette indices 0-5', () => {
    for (const [id, pattern] of Object.entries(DATALAB_PATTERNS)) {
      expect(Number(id)).toBeGreaterThanOrEqual(200);
      expect(Number(id)).toBeLessThanOrEqual(299);
      expect(pattern.length).toBe(16);
      for (const row of pattern) {
        expect(row.length).toBe(16);
        for (const v of row) {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(5);
        }
      }
    }
  });

  it('blocks walking through furniture, racks and the video wall but not floor and cables', () => {
    for (const id of [DL.SEAT, DL.WALL_A, DL.WALL_B, DL.CONSOLE_L, DL.CONSOLE_R, DL.DESK_L, DL.DESK_R, DL.RACK_TOP, DL.RACK_BOTTOM, DL.PRINTER, DL.PLANT, DL.RESULTS_L, DL.RESULTS_R]) {
      expect(isSolid(id), `tile ${id}`).toBe(true);
    }
    for (const id of [DL.FLOOR, DL.CABLE, DL.CABLE_COVER]) expect(isSolid(id), `tile ${id}`).toBe(false);
  });

  it('draws the floor lighter than the dark navy, so the coach (navy hair) reads on it', () => {
    // The floor's body is the palette's mid teal, not its dark navy
    const body = DATALAB_PATTERNS[DL.FLOOR]![8]![4];
    expect(body).toBe(2);
  });
});

describe('equipment and what it says', () => {
  const seen = reachable();

  it('lists only tiles inside the room, each once, each reachable by facing it', () => {
    const positions = new Set<string>();
    for (const e of map.equipment) {
      expect(e.x).toBeGreaterThan(0);
      expect(e.x).toBeLessThan(W - 1);
      expect(e.y).toBeGreaterThan(0);
      expect(e.y).toBeLessThan(H - 1);
      expect(positions.has(key(e.x, e.y)), `duplicate equipment at (${e.x},${e.y})`).toBe(false);
      positions.add(key(e.x, e.y));
      expect(faceable(e.x, e.y, seen), `equipment (${e.x},${e.y}) cannot be faced`).toBe(true);
    }
  });

  it('gives every equipment key a line: the room\'s own, or the lab\'s existing one', () => {
    for (const e of map.equipment) {
      const own = map.talk?.[e.dialogueKey]?.(sport);
      const shared = DIALOGUES[e.dialogueKey];
      expect((own && own.length > 0) || (shared && shared.length > 0), `no line for ${e.dialogueKey}`).toBe(true);
    }
  });

  it("keeps the four existing data-screen lines word for word", () => {
    expect(DIALOGUES['room2_screen1']![0]!.text).toBe('Data screen: Raw performance output.');
    expect(DIALOGUES['room2_screen2']![0]!.text).toBe('Data screen: Heart rate trace.');
    expect(DIALOGUES['room2_screen3']![0]!.text).toBe('Data screen: Power curve analysis.');
    expect(DIALOGUES['room2_screen4']![0]!.text).toBe('Data screen: Recovery metrics.');
    const keys = new Set(map.equipment.map(e => e.dialogueKey));
    for (const k of ['room2_screen1', 'room2_screen2', 'room2_screen3', 'room2_screen4']) expect(keys.has(k)).toBe(true);
  });

  it('names the results desk at the printer and the desk, with no numbers (the files depend on the tests run)', () => {
    const keys = ['datalab_data'];
    for (const [x, y] of [[12, 7], [10, 6], [11, 6]] as const) {
      const e = map.equipment.find(q => q.x === x && q.y === y)!;
      expect(keys).toContain(e.dialogueKey);
    }
    expect(map.talk!['datalab_data']!(sport)).toEqual(['Results desk: the files from your tests load here.']);
  });

  it("makes each wall screen name its variable as sports.ts writes it, without its number", () => {
    for (let slot = 0; slot < WALL_SLOTS; slot++) {
      expect(map.talk![`datalab_wall${slot}`]!(sport)).toEqual([`Data screen: ${sport.variables[slot]!.name.split(' (')[0]}.`]);
      const tiles = map.equipment.filter(e => e.dialogueKey === `datalab_wall${slot}`);
      expect(tiles.length).toBeGreaterThan(0);
      for (const t of tiles) expect(t.y).toBe(2);
    }
    // every wall tile under the video wall belongs to a screen
    for (let x = 1; x <= 14; x++) expect(WALL_SCREEN_AT[x], `wall tile ${x}`).not.toBeUndefined();
  });

  it('describes the room for a screen reader', () => {
    expect(map.describe).toBe(
      'A video wall of results along the top, workstations on the left, server racks on the right, the athlete at the results desk.',
    );
  });
});

describe('the video wall', () => {
  it('shows each variable as a short label and no value (a number there could come from a test not run)', () => {
    const screens = screensFor(sport);
    expect(screens.map(s => s.label)).toEqual(['LT1', 'LT2', 'HR LT2', 'VO2MAX', 'VVO2']);
    for (const s of screens) expect(s.value).toBe('');
    for (const s of screens) expect(s.label.length).toBeLessThanOrEqual(6);
  });

  it('builds the screens once per level', () => {
    expect(screensFor(sport)).toBe(screensFor(sport));
  });
});

describe('the animation', () => {
  // life() draws into a recording context so we can see where it paints
  interface Hit {
    x: number;
    y: number;
    w: number;
    h: number;
  }
  const makeCtx = (hits: Hit[]) => {
    const target = {
      fillStyle: '',
      globalAlpha: 1,
      fillRect: (x: number, y: number, w: number, h: number) => hits.push({ x, y, w, h }),
      drawImage: (img: { width: number; height: number }, x: number, y: number) => hits.push({ x, y, w: img.width, h: img.height }),
    };
    return target as unknown as CanvasRenderingContext2D;
  };

  beforeEach(() => {
    // glyph and sprite caches make small canvases: give them a recording context too
    vi.stubGlobal('document', {
      createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillStyle: '', fillRect() {}, drawImage() {} }) }),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  const bubble = { x: 160, y: 96, w: 16, h: 16 }; // the tile above the athlete (10,6)
  const intersects = (a: Hit, b: Hit) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  it('leaves the tile above the athlete quiet, whatever the time', () => {
    for (let t = 0; t < 12; t += 0.17) {
      const hits: Hit[] = [];
      map.life!(makeCtx(hits), t, sport);
      const busy = hits.filter(h => intersects(h, bubble));
      expect(busy, `something is drawn above the athlete at t=${t.toFixed(2)}`).toEqual([]);
    }
  });

  it('draws every frame without throwing, and moves', () => {
    const a: Hit[] = [];
    const b: Hit[] = [];
    map.life!(makeCtx(a), 0, sport);
    map.life!(makeCtx(b), 1.3, sport);
    expect(a.length).toBeGreaterThan(50);
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
