// The test-day calendar page while it turns: a whole page shows its words and its week, a squashed one is a blank
// card seen edge on (so nothing is cut in half or left floating outside it), and the stamp sits inside the page.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// The game's sound module reads its saved mute setting when it loads; give Node a harmless store so it does not warn
vi.hoisted(() => {
  Object.defineProperty(globalThis, 'localStorage', { value: { getItem: () => null, setItem: () => undefined }, configurable: true });
});

const log = vi.hoisted(() => ({ texts: [] as string[], rects: [] as { x: number; y: number; w: number; h: number; color: string }[] }));

vi.mock('../src/render/PixelFont', async importOriginal => {
  const actual = await importOriginal<typeof import('../src/render/PixelFont')>();
  return { ...actual, drawText: (_ctx: unknown, text: string) => void log.texts.push(text) };
});

import { RUNNING } from '../src/rooms/content/running';
import { REBOOK_SECONDS, WEEKDAYS } from '../src/rooms/testing/model';
import { calendarAt, drawCheckStage, pickWindow, type CheckView } from '../src/rooms/testing/stage';
import { LABX, C } from '../src/rooms/testing/kit';

const content = RUNNING.testing;
const card = content.cards[0]!;
const window = pickWindow(108);

/** A canvas that records each rectangle with the colour it was filled in. */
const canvas = (() => {
  let fillStyle = '';
  return new Proxy({}, {
    get: (_t, key) => {
      if (key === 'fillStyle') return fillStyle;
      if (key === 'fillRect') return (x: number, y: number, w: number, h: number) => void log.rects.push({ x, y, w, h, color: fillStyle });
      return () => undefined;
    },
    set: (_t, key, value) => {
      if (key === 'fillStyle') fillStyle = String(value);
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
})();

const realDocument = (globalThis as { document?: unknown }).document;
beforeAll(() => {
  (globalThis as { document?: unknown }).document = { createElement: () => ({ width: 0, height: 0, getContext: () => canvas }) };
});
afterAll(() => {
  (globalThis as { document?: unknown }).document = realDocument;
});

const draw = (day: number, flip: number, calm = false) => {
  log.texts.length = 0;
  log.rects.length = 0;
  const view: CheckView = {
    window, lead: 'AISHA NEEDS: ', needs: content.needs, card, plate: card.name.toUpperCase(), clock: 0.4, calm, stages: 7,
    day, shaky: false, rebooked: true, flip, answered: true,
  };
  drawCheckStage(canvas, view);
  return { texts: [...log.texts], rects: [...log.rects] };
};

const WORDS = new Set<string>(['TEST DAY', ...WEEKDAYS]);

describe('the calendar page while it turns', () => {
  it('shows its words only when the page is whole, and the right day on it', () => {
    let whole = 0;
    let blank = 0;
    for (const day of [0, 2, 4]) {
      for (let flip = 0; flip <= REBOOK_SECONDS + 1e-9; flip += 0.02) {
        const at = calendarAt(day, true, flip);
        const { texts } = draw(day, flip);
        const words = texts.filter(t => WORDS.has(t));
        if (at.scale >= 0.94) {
          whole++;
          expect(words, `day ${day} flip ${flip.toFixed(2)}`).toContain('TEST DAY');
          expect(words).toContain(WEEKDAYS[at.day]);
        } else {
          blank++;
          expect(words, `day ${day} flip ${flip.toFixed(2)} (page ${at.scale.toFixed(2)})`).toEqual([]);
        }
      }
    }
    expect(whole).toBeGreaterThan(20);
    expect(blank).toBeGreaterThan(20);
  });

  it('draws the week strip inside the page, never below it', () => {
    const outline = LABX[C.outline]!;
    for (const flip of [0, 0.3, 0.6, 0.9, 1.2, REBOOK_SECONDS]) {
      const { rects } = draw(1, flip);
      // the page is the tallest outlined rectangle 64 px wide
      const page = rects.filter(r => r.color === outline && r.w === 64).sort((a, b) => b.h - a.h)[0];
      expect(page, `flip ${flip}`).toBeDefined();
      // every 6x6 square of the week strip (outlined: the ones over the page's columns) lies inside it
      const strip = rects.filter(r => r.color === outline && r.w === 6 && r.h === 6 && r.x >= page!.x && r.x + r.w <= page!.x + page!.w);
      for (const square of strip) {
        expect(square.y, `flip ${flip}`).toBeGreaterThanOrEqual(page!.y);
        expect(square.y + square.h, `flip ${flip}`).toBeLessThanOrEqual(page!.y + page!.h);
      }
      // a whole page has all seven squares, a squashed one none
      expect(strip.length === 7 || strip.length === 0, `flip ${flip}: ${strip.length} squares`).toBe(true);
    }
  });

  it('keeps the RE-BOOKED stamp inside the page once the page has turned twice', () => {
    const outline = LABX[C.outline]!;
    const red = LABX[C.red]!;
    const { texts, rects } = draw(2, REBOOK_SECONDS);
    expect(texts).toContain('RE-BOOKED');
    const page = rects.filter(r => r.color === outline && r.w === 64).sort((a, b) => b.h - a.h)[0]!;
    const stamp = rects.find(r => r.color === red && r.h === 13)!;
    expect(stamp.x).toBeGreaterThan(page.x);
    expect(stamp.x + stamp.w).toBeLessThan(page.x + page.w);
    expect(stamp.y + stamp.h).toBeLessThan(page.y + page.h);
  });

  it('does not squash the page under reduced motion: the day just changes', () => {
    for (let flip = 0; flip <= REBOOK_SECONDS; flip += 0.1) {
      const { texts } = draw(0, flip, true);
      expect(texts).toContain('TEST DAY');
    }
  });
});
