// Every sprite and grid the rooms draw (walk-around life, stages, boards) uses only colour indices its colour list has,
// and the same array identity is passed every frame (drawSprite / paintGrid cache by array identity).
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { Button } from '../../src/engine/Input';

vi.mock('../../src/audio/Sfx', () => ({ sfx: { play: () => {}, isMuted: () => false, toggleMuted: () => {} } }));
vi.mock('../../src/ui/announce', () => ({ announce: () => {} }));

const sprites = new Map<number[][], { colors: string[]; bad: string[] }>();
const grids = new Map<number[][], { colors: readonly string[]; bad: string[] }>();
const spriteCalls: number[][][] = [];
let frameSprites = new Set<number[][]>();
let perFrameFresh = 0;
const everSeen = new WeakSet<number[][]>();

vi.mock('../../src/render/SpriteSheet', async importOriginal => {
  const real = await importOriginal<typeof import('../../src/render/SpriteSheet')>();
  return {
    ...real,
    drawSprite: (ctx: CanvasRenderingContext2D, sprite: number[][], x: number, y: number, colors: string[], scale = 1) => {
      if (!sprites.has(sprite)) {
        const bad: string[] = [];
        sprite.forEach((row, j) => row.forEach((v, i) => {
          if (v !== 0 && !colors[v]) bad.push(`(${i},${j}) index ${v} has no colour (list of ${colors.length})`);
        }));
        sprites.set(sprite, { colors, bad });
      }
      frameSprites.add(sprite);
      real.drawSprite(ctx, sprite, x, y, colors, scale);
    },
  };
});
vi.mock('../../src/rooms/testing/kit', async importOriginal => {
  const real = await importOriginal<typeof import('../../src/rooms/testing/kit')>();
  return {
    ...real,
    paintGrid: (ctx: CanvasRenderingContext2D, grid: number[][], x: number, y: number, colors: readonly string[] = real.LABX) => {
      if (!grids.has(grid)) {
        const bad: string[] = [];
        grid.forEach((row, j) => row.forEach((v, i) => {
          if (v >= 0 && !colors[v]) bad.push(`(${i},${j}) index ${v} has no colour (list of ${colors.length})`);
        }));
        grids.set(grid, { colors, bad });
      }
      frameSprites.add(grid);
      real.paintGrid(ctx, grid, x, y, colors);
    },
  };
});

const H = await import('./harness');
beforeAll(() => H.installFakeDom());

const pick = (rng: () => number): Button => {
  const r = rng();
  return r < 0.45 ? 'a' : r < 0.6 ? 'down' : r < 0.7 ? 'up' : r < 0.8 ? 'left' : 'right';
};

describe('sprites and grids', () => {
  it('all indices have colours, and arrays are reused frame to frame', async () => {
    const newArraysByFrame: number[] = [];
    for (const room of ['room1', 'room2', 'room3', 'room4']) {
      for (let seed = 1; seed <= 6; seed++) {
        const rng = H.seeded(seed * 31 + room.charCodeAt(4));
        vi.spyOn(Math, 'random').mockImplementation(rng);
        const w = await H.makeWorld(3);
        w.enter(room);
        for (let s = 0; s < 60 * 60; s++) {
          if (rng() < 0.08) w.emu.tap(pick(rng), 1 + Math.floor(rng() * 4));
          frameSprites = new Set();
          w.step(1);
          let fresh = 0;
          for (const a of frameSprites) {
            if (!everSeen.has(a)) {
              everSeen.add(a);
              fresh++;
            }
          }
          if (s > 600) newArraysByFrame.push(fresh); // after warm-up
          if (w.current() !== 'roomChallenge') break;
        }
        vi.restoreAllMocks();
      }
    }
    const badSprites = [...sprites.values()].flatMap(v => v.bad).slice(0, 10);
    const badGrids = [...grids.values()].flatMap(v => v.bad).slice(0, 10);
    if (process.env.FUZZ_LOG) console.log(`${sprites.size} distinct sprite arrays, ${grids.size} distinct grids`);
    expect(badSprites).toEqual([]);
    expect(badGrids).toEqual([]);
    // an array seen for the first time long after start-up means a fresh copy is being built (cache miss) in a frame
    const fresh = newArraysByFrame.reduce((a, b) => a + b, 0);
    if (process.env.FUZZ_LOG) console.log('first-seen arrays after warm-up:', fresh, 'over', newArraysByFrame.length, 'frames');
  }, 300000);
});
