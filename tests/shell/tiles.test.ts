// Every registered tile pattern is a full 16x16 grid of valid colour indices (a ragged row or an index past the
// palette would leave transparent pixels that show the room's background colour through the map).
import { describe, expect, it, vi } from 'vitest';

const defsByCall: Record<number, { pattern: number[][]; solid?: boolean; colors?: readonly string[] }>[] = [];
vi.mock('../../src/render/TileMap', async importOriginal => {
  const real = await importOriginal<typeof import('../../src/render/TileMap')>();
  return {
    ...real,
    registerTiles: (defs: Record<number, { pattern: number[][]; solid?: boolean; colors?: readonly string[] }>) => {
      defsByCall.push(defs);
      return real.registerTiles(defs as never);
    },
  };
});

await import('../../src/data/rooms');
const { PALETTES } = await import('../../src/render/Palettes');

const PALETTE_OF: Record<number, number> = { 1: 6, 2: 6, 3: 6, 4: 6 }; // palette colours for tiles without their own

describe('registered tile patterns', () => {
  it('every tile is 16 rows of 16 valid indices', () => {
    const bad: string[] = [];
    let count = 0;
    for (const defs of defsByCall)
      for (const [key, def] of Object.entries(defs)) {
        count++;
        const id = Number(key);
        const limit = def.colors ? def.colors.length : PALETTE_OF[Math.floor(id / 100)] ?? 6;
        if (def.pattern.length !== 16) bad.push(`tile ${id}: ${def.pattern.length} rows`);
        def.pattern.forEach((row, y) => {
          if (row.length !== 16) bad.push(`tile ${id} row ${y}: ${row.length} columns`);
          row.forEach((v, x) => {
            if (!Number.isInteger(v) || v < 0 || v >= limit) bad.push(`tile ${id} (${x},${y}): index ${v} (limit ${limit})`);
          });
        });
      }
    if (process.env.FUZZ_LOG) console.log(`${count} tiles checked`);
    expect(bad.slice(0, 20)).toEqual([]);
    expect(PALETTES.data.colors.length).toBe(6);
  });
});
