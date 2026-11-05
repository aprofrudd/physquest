// Draws every stage screen with a recording stand-in for the canvas, across every test and moment, and checks
// that nothing throws, no number is NaN, and nothing visible lands outside the stage window.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// The game's sound module reads its saved mute setting when it loads; give Node a harmless store so it does not warn
vi.hoisted(() => {
  Object.defineProperty(globalThis, 'localStorage', { value: { getItem: () => null, setItem: () => undefined }, configurable: true });
});

import { LEVEL_DATA } from '../src/data/sports';
import { RUNNING } from '../src/rooms/content/running';
import { createTestingModel, PRINTOUT_SECONDS, REBOOK_SECONDS, RUN_SECONDS } from '../src/rooms/testing/model';
import {
  drawCheckStage,
  drawPickStage,
  drawPrintoutStage,
  drawRunStage,
  pickWindow,
  runWindow,
  type CheckView,
  type PickView,
  type PrintoutView,
  type Rect,
  type RunView,
} from '../src/rooms/testing/stage';

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const intersect = (a: Box, b: Box | null): Box | null => {
  if (!b) return a;
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.w, b.x + b.w);
  const bottom = Math.min(a.y + a.h, b.y + b.h);
  return right > x && bottom > y ? { x, y, w: right - x, h: bottom - y } : null;
};

/** A canvas stand-in that records what is drawn, with the clip rectangle applied, and rejects non-finite numbers. */
class RecordingContext {
  drawn: Box[] = [];
  bad: string[] = [];
  fillStyle = '#000';
  globalAlpha = 1;
  private clipBox: Box | null = null;
  private stack: (Box | null)[] = [];
  private path: Box | null = null;

  private finite(name: string, ...values: number[]) {
    if (!values.every(Number.isFinite)) this.bad.push(`${name}(${values.join(', ')})`);
  }

  private record(x: number, y: number, w: number, h: number) {
    const visible = intersect({ x, y, w: Math.abs(w), h: Math.abs(h) }, this.clipBox);
    if (visible && w !== 0 && h !== 0) this.drawn.push(visible);
  }

  fillRect(x: number, y: number, w: number, h: number) {
    this.finite('fillRect', x, y, w, h);
    if (w < 0 || h < 0) this.bad.push(`fillRect with a negative size (${x}, ${y}, ${w}, ${h})`);
    this.record(x, y, w, h);
  }

  /** drawImage(image, x, y) or drawImage(image, sx, sy, sw, sh, x, y, w, h): the picture's place on the canvas is what counts. */
  drawImage(image: { width: number; height: number }, ...rest: number[]) {
    this.finite('drawImage', ...rest);
    if (rest.length >= 8) this.record(rest[4] ?? 0, rest[5] ?? 0, rest[6] ?? 0, rest[7] ?? 0);
    else this.record(rest[0] ?? 0, rest[1] ?? 0, image.width, image.height);
  }

  save() {
    this.stack.push(this.clipBox);
  }

  restore() {
    this.clipBox = this.stack.pop() ?? null;
  }

  beginPath() {
    this.path = null;
  }

  rect(x: number, y: number, w: number, h: number) {
    this.finite('rect', x, y, w, h);
    this.path = { x, y, w, h };
  }

  clip() {
    if (this.path) this.clipBox = intersect(this.path, this.clipBox);
  }

  clear() {
    this.drawn = [];
    this.bad = [];
  }
}

const makeCanvas = () => {
  const ctx = new RecordingContext();
  return { width: 0, height: 0, getContext: () => ctx };
};

const realDocument = (globalThis as { document?: unknown }).document;

beforeAll(() => {
  (globalThis as { document?: unknown }).document = { createElement: () => makeCanvas() };
});

afterAll(() => {
  (globalThis as { document?: unknown }).document = realDocument;
});

const sport = LEVEL_DATA[3]!;
const content = RUNNING.testing;
const stages = RUNNING.data.lactate.stages.length;
const listTop = 108;
const window = pickWindow(listTop);

const inside = (boxes: readonly Box[], r: Rect) =>
  boxes.filter(b => b.x < r.x || b.y < r.y || b.x + b.w > r.x + r.w || b.y + b.h > r.y + r.h);

const draw = (paint: (ctx: CanvasRenderingContext2D) => void, within: Rect, label: string) => {
  const ctx = new RecordingContext();
  paint(ctx as unknown as CanvasRenderingContext2D);
  expect(ctx.bad, `${label}: bad numbers`).toEqual([]);
  expect(ctx.drawn.length, `${label}: something is drawn`).toBeGreaterThan(20);
  const outside = inside(ctx.drawn, within);
  expect(outside, `${label}: drawn outside the window`).toEqual([]);
};

describe('the recording canvas', () => {
  it('sees what is drawn outside a window, and what a clip hides', () => {
    const ctx = new RecordingContext();
    ctx.fillRect(0, 0, 10, 10); // in the corner, outside the stage window
    ctx.fillRect(10, 40, 5, 5); // inside it
    expect(inside(ctx.drawn, window)).toHaveLength(1);
    ctx.clear();
    ctx.save();
    ctx.beginPath();
    ctx.rect(20, 50, 10, 10);
    ctx.clip();
    ctx.fillRect(0, 0, 200, 200); // only the clipped part counts
    ctx.restore();
    ctx.fillRect(1, 1, 2, 2);
    expect(ctx.drawn[0]).toEqual({ x: 20, y: 50, w: 10, h: 10 });
    expect(ctx.drawn).toHaveLength(2);
    ctx.fillRect(Number.NaN, 0, 1, 1);
    expect(ctx.bad).toHaveLength(1);
  });
});

describe('the pick screen window', () => {
  it('draws every test at every moment of its loop inside its window, with no bad numbers', () => {
    for (const calm of [false, true]) {
      for (const card of content.cards) {
        for (let clock = 0; clock < 8.3; clock += 0.37) {
          const view: PickView = { window, lead: 'AISHA NEEDS: ', needs: content.needs, card, clock, calm, stages };
          draw(ctx => drawPickStage(ctx, view), window, `${card.name} at ${clock.toFixed(2)} s${calm ? ' (calm)' : ''}`);
        }
      }
    }
  });
});

describe('test day', () => {
  it('draws the calendar, before and after the call, flipping and stamped, for every weekday', () => {
    const card = content.cards[0]!;
    for (const day of [0, 2, 4]) {
      for (const flip of [0, 0.3, 0.6, 0.9, 1.2, 1.5, REBOOK_SECONDS]) {
        for (const [shaky, rebooked, answered] of [[false, false, false], [true, false, true], [false, true, true]] as const) {
          const view: CheckView = {
            window, lead: 'AISHA NEEDS: ', needs: content.needs, card, plate: card.name.toUpperCase(), clock: flip * 3, calm: false, stages,
            day, shaky, rebooked, flip, answered,
          };
          draw(ctx => drawCheckStage(ctx, view), window, `day ${day} flip ${flip} shaky ${shaky} rebooked ${rebooked}`);
        }
      }
    }
  });
});

describe('the run', () => {
  it('draws every test through its run, shaky or not, while the window grows, inside the window', () => {
    for (const card of content.cards) {
      for (const shaky of [false, true]) {
        for (const calm of [false, true]) {
          for (let u = 0; u <= 1.0001; u += 0.05) {
            const growing: Rect = { ...runWindow, h: Math.round(window.h + (runWindow.h - window.h) * Math.min(1, u * 8)) };
            const view: RunView = { window: growing, card, title: card.name.toUpperCase(), clock: u * RUN_SECONDS, u: Math.min(1, u), shaky, calm, stages };
            draw(ctx => drawRunStage(ctx, view), growing, `${card.name} u ${u.toFixed(2)} shaky ${shaky} calm ${calm}`);
          }
        }
      }
    }
  });
});

/** A model with `names` in its battery (each pick after its lock) and the call made. */
const withBattery = (names: readonly string[], call: 'run' | 'rebook') => {
  const model = createTestingModel({ sport, content: { ...content, checks: [{ ...content.checks[0]!, call }] }, rng: () => 0.2 });
  model.startPick();
  for (const name of names) {
    model.update(1);
    model.moveCursor(model.state.order.findIndex(t => t.name === name) - model.state.cursor);
    model.choose();
  }
  model.answer('run');
  return model;
};

describe('the printout', () => {
  it('draws the card sliding out and settled, for a full battery, a partial one, none, and shaky data', () => {
    const batteries = [
      [['Lactate Profile', 'Critical Speed Test'], 'rebook'],
      [['Wingate Test', 'Beep Test'], 'run'],
      [['Critical Speed Test', 'Wingate Test'], 'rebook'],
      [['Beep Test', 'Lactate Profile'], 'run'],
    ] as const;
    for (const [names, call] of batteries) {
      const name = names.join(' + ');
      const model = withBattery(names, call);
      for (const calm of [false, true]) {
        for (let slide = 0; slide <= PRINTOUT_SECONDS + 0.5; slide += 0.1) {
          const view: PrintoutView = { window: runWindow, calm, lines: model.printout(), slide };
          draw(ctx => drawPrintoutStage(ctx, view), runWindow, `${name} slide ${slide.toFixed(1)}`);
        }
      }
    }
  });

  it('says shaky only when the battery ran on a day to re-book', () => {
    expect(withBattery(['Lactate Profile', 'Beep Test'], 'rebook').printout().shaky).toBe('DATA QUALITY: SHAKY');
    expect(withBattery(['Lactate Profile', 'Beep Test'], 'run').printout().shaky).toBeNull();
  });
});
