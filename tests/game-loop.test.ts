// The game loop's rendering budget: updates stay at a fixed 60 Hz while renders follow renderEvery, an unchanged frame
// is not presented (but is at least once a second), and a hidden page schedules no frames at all. Also the frame watch
// that tells a changed frame from an unchanged one.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createGameLoop, type Scene } from '../src/engine/GameLoop';
import { watchFrames } from '../src/engine/frameWatch';

/** Enough of a 2D context for the watch: methods on the prototype, style setters as accessors (as in browsers). */
class Ctx2D {
  canvas = { width: 256, height: 224 };
  calls = 0;
  private style: unknown = '#000';
  get fillStyle() {
    return this.style;
  }
  set fillStyle(v: unknown) {
    this.style = v;
  }
  fillRect(_x: number, _y: number, _w: number, _h: number) {
    this.calls++;
  }
  drawImage(_img: unknown, _x: number, _y: number) {
    this.calls++;
  }
  measureText(t: string) {
    return { width: t.length };
  }
  setTransform() {}
}

describe('the frame watch', () => {
  it('says a frame changed when any call, argument, style or image differs, and not otherwise', () => {
    const c = new Ctx2D();
    const watch = watchFrames(c as unknown as CanvasRenderingContext2D);
    const img = {};
    const other = {};
    const frame = (x: number, color: string, image: object) => {
      watch.begin();
      c.fillStyle = color;
      c.fillRect(x, 0, 10, 10);
      c.drawImage(image, 4, 4);
      return watch.changed();
    };
    expect(frame(1, '#fff', img)).toBe(true); // the first frame
    expect(frame(1, '#fff', img)).toBe(false);
    expect(frame(1.5, '#fff', img)).toBe(true); // a sub-pixel move counts
    expect(frame(1.5, '#fff', img)).toBe(false);
    expect(frame(1.5, '#ffe', img)).toBe(true);
    expect(frame(1.5, '#ffe', other)).toBe(true); // another canvas at the same spot
    expect(frame(1.5, '#ffe', other)).toBe(false);
    // the wrapped calls still reach the context, return values and all
    expect(c.calls).toBe(14);
    expect(c.fillStyle).toBe('#ffe');
    expect(c.measureText('abc')).toEqual({ width: 3 });
  });

  it('an extra call, or the same calls in another order, is a change', () => {
    const c = new Ctx2D();
    const watch = watchFrames(c as unknown as CanvasRenderingContext2D);
    const run = (body: () => void) => {
      watch.begin();
      body();
      return watch.changed();
    };
    run(() => {
      c.fillRect(0, 0, 1, 1);
      c.fillRect(2, 0, 1, 1);
    });
    expect(run(() => {
      c.fillRect(2, 0, 1, 1);
      c.fillRect(0, 0, 1, 1);
    })).toBe(true);
    expect(run(() => {
      c.fillRect(2, 0, 1, 1);
      c.fillRect(0, 0, 1, 1);
      c.setTransform();
    })).toBe(true);
  });
});

describe('the game loop', () => {
  let frames: ((t: number) => void)[] = [];
  let now = 0;
  let visibility = 'visible';
  const listeners: (() => void)[] = [];

  beforeEach(() => {
    frames = [];
    now = 0;
    visibility = 'visible';
    listeners.length = 0;
    vi.stubGlobal('requestAnimationFrame', (cb: (t: number) => void) => frames.push(cb));
    vi.stubGlobal('cancelAnimationFrame', () => {
      frames = [];
    });
    vi.stubGlobal('performance', { now: () => now });
    vi.stubGlobal('document', {
      get visibilityState() {
        return visibility;
      },
      addEventListener: (_: string, fn: () => void) => listeners.push(fn),
      removeEventListener: () => {},
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  /** Run the display for `ms` at `hz` refreshes a second. */
  const run = (ms: number, hz = 60) => {
    const end = now + ms;
    while (now < end && frames.length > 0) {
      now += 1000 / hz;
      const due = frames;
      frames = [];
      for (const cb of due) cb(now);
    }
    if (frames.length === 0) now = end;
  };

  const setup = (renderEvery: () => number, moving: () => boolean) => {
    const c = new Ctx2D();
    const ctx = c as unknown as CanvasRenderingContext2D;
    let updates = 0;
    let renders = 0;
    let presents = 0;
    let x = 0;
    const scene: Scene = {
      update: () => {
        updates++;
        if (moving()) x++;
      },
      render: g => {
        renders++;
        g.fillStyle = '#fff';
        g.fillRect(x, 0, 16, 16);
      },
    };
    const loop = createGameLoop(ctx, () => scene, () => presents++, { renderEvery, watch: watchFrames(ctx) });
    loop.start();
    return { loop, counts: () => ({ updates, renders, presents }) };
  };

  it('keeps 60 updates a second but renders every other one at 30 fps, presenting only changed frames', () => {
    let moving = true;
    const { loop, counts } = setup(() => 2, () => moving);
    run(1000);
    let c = counts();
    expect(c.updates).toBeGreaterThanOrEqual(59);
    expect(c.updates).toBeLessThanOrEqual(61);
    expect(c.renders).toBeGreaterThanOrEqual(29);
    expect(c.renders).toBeLessThanOrEqual(31);
    expect(c.presents).toBe(c.renders);
    expect(loop.stats()).toEqual(c);
    // standing still: frames are rendered but not presented, except once a second
    moving = false;
    const before = counts();
    run(3000);
    c = counts();
    expect(c.updates - before.updates).toBeGreaterThanOrEqual(179);
    expect(c.renders - before.renders).toBeGreaterThanOrEqual(89);
    expect(c.presents - before.presents).toBeGreaterThanOrEqual(2);
    expect(c.presents - before.presents).toBeLessThanOrEqual(4);
  });

  it('renders after every update at renderEvery 1, and not more often on a 120 Hz display', () => {
    const { counts } = setup(() => 1, () => true);
    run(1000, 120);
    const c = counts();
    expect(c.updates).toBeGreaterThanOrEqual(59);
    expect(c.updates).toBeLessThanOrEqual(61);
    expect(c.renders).toBe(c.updates + 1); // the first frame renders before any update
  });

  it('follows a renderEvery that changes from frame to frame (idle at 20 fps, then back)', () => {
    let every = 3;
    const { counts } = setup(() => every, () => true);
    run(1000);
    const idle = counts().renders;
    expect(idle).toBeGreaterThanOrEqual(19);
    expect(idle).toBeLessThanOrEqual(21);
    every = 1;
    run(1000);
    expect(counts().renders - idle).toBeGreaterThanOrEqual(59);
  });

  it('schedules nothing while the page is hidden, and starts afresh without catching up', () => {
    const { counts } = setup(() => 1, () => true);
    run(500);
    const before = counts();
    visibility = 'hidden';
    listeners.forEach(fn => fn());
    expect(frames.length).toBe(0);
    run(5000);
    expect(counts()).toEqual(before);
    visibility = 'visible';
    listeners.forEach(fn => fn());
    run(100);
    const after = counts();
    expect(after.updates - before.updates).toBeLessThanOrEqual(7); // 100 ms of updates, not 5 s
    expect(after.presents).toBeGreaterThan(before.presents); // the first frame back is shown at once
  });
});
