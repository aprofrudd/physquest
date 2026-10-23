// The lab's art is drawn in code, so check its shape: the pixel canvas, every map tile, every sprite frame.
import { describe, expect, it } from 'vitest';
import { TILE, TECH_SPOT } from '../src/data/rooms/testing-tiles';
import { CLEAR, createPixels, spriteColors, toSprite } from '../src/rooms/testing/pixels';
import {
  C,
  CART_PICTURE,
  ERGOMETER_PARTS,
  ERGOMETER_PICTURE,
  LABX,
  TILE_ART,
  TREADMILL_BELT,
  TREADMILL_PICTURE,
} from '../src/rooms/testing/kit';
import {
  AISHA_COLORS,
  HEAD_RIGHT,
  HIPS_RIGHT,
  RUN_FRAMES,
  RUN_FRAMES_LEFT,
  SPENT_RIGHT,
  STAND_RIGHT,
  TECH_COLORS,
  TECH_FRAMES,
} from '../src/rooms/testing/people';
import { ALERT, CROSS, DROP, SPEAKER, STOPWATCH, TICK } from '../src/rooms/testing/icons';

describe('the pixel canvas', () => {
  it('draws rectangles, lines and edges inside its bounds and ignores the rest', () => {
    const c = createPixels(8, 6, 4);
    c.rect(1, 1, 3, 2, 2).hline(0, 5, 8, 1).vline(7, 0, 6, 1).px(-1, 0, 9).px(8, 0, 9).px(0, 6, 9);
    expect(c.get(1, 1)).toBe(2);
    expect(c.get(3, 2)).toBe(2);
    expect(c.get(4, 1)).toBe(4);
    expect(c.get(3, 5)).toBe(1);
    expect(c.get(7, 3)).toBe(1);
    expect(c.grid.flat().includes(9)).toBe(false);
    expect(c.get(99, 99)).toBe(CLEAR);
  });

  it('draws a box with an edge and a fill, and a line from corner to corner', () => {
    const c = createPixels(6, 6).box(0, 0, 6, 6, 1, 2).line(0, 0, 5, 5, 3);
    expect(c.get(0, 3)).toBe(1);
    expect(c.get(2, 3)).toBe(2);
    for (let i = 0; i < 6; i++) expect(c.get(i, i)).toBe(3);
  });

  it('stamps text art, skipping dots, and looks letters up in a key', () => {
    const c = createPixels(4, 2).stamp(0, 0, ['1.a2', '.b..'], { a: 7, b: 8 });
    expect([c.get(0, 0), c.get(1, 0), c.get(2, 0), c.get(3, 0), c.get(1, 1)]).toEqual([1, CLEAR, 7, 2, 8]);
  });

  it('outlines only onto clear pixels and mirrors without changing the original', () => {
    const c = createPixels(5, 5).rect(1, 1, 3, 3, 2).outline(0);
    expect(c.get(0, 0)).toBe(CLEAR); // diagonals are not touched: a 4-neighbour outline
    expect(c.get(0, 2)).toBe(0);
    expect(c.get(2, 2)).toBe(2);
    const left = createPixels(3, 1).stamp(0, 0, ['123']);
    const right = left.flipped();
    expect(right.grid[0]).toEqual([3, 2, 1]);
    expect(left.grid[0]).toEqual([1, 2, 3]);
  });

  it('slices 16x16 tiles with the clear pixels filled in, and turns grids into game sprites', () => {
    const c = createPixels(32, 16).rect(16, 0, 16, 16, 2).px(0, 0, 0);
    expect(c.slice(0, 0, 4)[1]![1]).toBe(4);
    expect(c.slice(0, 0, 4)[0]![0]).toBe(0);
    expect(c.slice(1, 0, 4)[5]![5]).toBe(2);
    expect(toSprite([[CLEAR, 0, 3]])).toEqual([[0, 1, 4]]);
    expect(spriteColors(['#111', '#222'])).toEqual(['', '#111', '#222']);
  });
});

describe('the lab palette', () => {
  it('starts with the lab palette so tiles drawn with 0-5 still match the room', () => {
    expect(LABX.slice(0, 6)).toEqual(['#080808', '#1b3a5c', '#4878a8', '#88b8d8', '#f0e8d8', '#d0a830']);
    expect(LABX.every(c => /^#[0-9a-f]{6}$/.test(c))).toBe(true);
    expect(Math.max(...Object.values(C))).toBe(LABX.length - 1);
  });
});

describe('map tiles', () => {
  const names = Object.keys(TILE_ART) as (keyof typeof TILE_ART)[];

  it('are all 16 by 16, with no clear pixels left and only palette colours', () => {
    for (const name of names) {
      const grid = TILE_ART[name];
      expect(grid, name).toHaveLength(16);
      for (const row of grid) {
        expect(row, name).toHaveLength(16);
        for (const v of row) {
          expect(v, name).toBeGreaterThanOrEqual(0);
          expect(v, name).toBeLessThan(LABX.length);
        }
      }
    }
  });

  it('have their own ids in the lab range (100 to 199), none shared', () => {
    const ids = [...names.map(n => TILE[n]), TECH_SPOT];
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toBeGreaterThanOrEqual(100);
      expect(id).toBeLessThan(200);
    }
  });

  it('make the pieces the right size: a treadmill of 3 by 2 tiles, an ergometer of 2 by 2, a cart of 1 by 2', () => {
    expect([TREADMILL_PICTURE.w, TREADMILL_PICTURE.h]).toEqual([48, 32]);
    expect([ERGOMETER_PICTURE.w, ERGOMETER_PICTURE.h]).toEqual([32, 32]);
    expect([CART_PICTURE.w, CART_PICTURE.h]).toEqual([16, 32]);
  });

  it('keep the moving belt and the ergometer\'s parts inside their pictures', () => {
    expect(TREADMILL_BELT.x + TREADMILL_BELT.w).toBeLessThanOrEqual(TREADMILL_PICTURE.w);
    expect(TREADMILL_BELT.y + TREADMILL_BELT.h).toBeLessThanOrEqual(TREADMILL_PICTURE.h);
    for (const part of Object.values(ERGOMETER_PARTS)) {
      expect(part.x).toBeLessThan(ERGOMETER_PICTURE.w);
      expect(part.y).toBeLessThan(ERGOMETER_PICTURE.h);
    }
  });
});

describe('people and icons', () => {
  const frames = [...RUN_FRAMES, ...RUN_FRAMES_LEFT, STAND_RIGHT, ...HIPS_RIGHT, ...SPENT_RIGHT];

  it('draws Aisha in 16 by 16 frames using only her seven colours', () => {
    expect(AISHA_COLORS).toHaveLength(7);
    for (const frame of frames) {
      expect(frame).toHaveLength(16);
      for (const row of frame) {
        expect(row).toHaveLength(16);
        for (const v of row) expect(v === CLEAR || (v >= 0 && v < AISHA_COLORS.length)).toBe(true);
      }
    }
    expect(HEAD_RIGHT).toHaveLength(7);
  });

  it('gives her running left the mirror image of running right', () => {
    RUN_FRAMES.forEach((frame, i) => {
      expect(RUN_FRAMES_LEFT[i]).toEqual(frame.map(row => row.slice().reverse()));
    });
  });

  it('keeps her feet on the floor row in every standing and running frame, so she never floats', () => {
    for (const frame of [...RUN_FRAMES, STAND_RIGHT, ...HIPS_RIGHT, ...SPENT_RIGHT]) {
      const lowest = frame.map(row => row.some(v => v !== CLEAR)).lastIndexOf(true);
      expect(lowest).toBeGreaterThanOrEqual(14);
    }
  });

  it('draws the technician in two frames with his own colours, and the icons in their own sizes', () => {
    expect(TECH_FRAMES).toHaveLength(2);
    expect(TECH_COLORS).toHaveLength(8);
    for (const frame of TECH_FRAMES) {
      expect(frame).toHaveLength(16);
      for (const row of frame) for (const v of row) expect(v === CLEAR || (v >= 0 && v < TECH_COLORS.length)).toBe(true);
    }
    expect([DROP[0]!.length, DROP.length]).toEqual([5, 7]);
    expect([STOPWATCH[0]!.length, STOPWATCH.length]).toEqual([9, 10]);
    expect([SPEAKER[0]!.length, SPEAKER.length]).toEqual([8, 8]);
    expect(TICK.length).toBe(9);
    expect(CROSS.length).toBe(9);
    expect([ALERT[0]!.length, ALERT.length]).toEqual([7, 9]);
  });
});
