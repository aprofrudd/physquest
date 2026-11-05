import { drawText, measureText } from '../render/PixelFont';
import type { FrameWatch } from './frameWatch';

export interface Scene {
  update(dt: number): void;
  render(ctx: CanvasRenderingContext2D): void;
  onEnter?(): void;
  onExit?(): void;
}

const TIMESTEP = 1000 / 60; // ~16.67ms
const KEEP_ALIVE = 1000; // ms: an unchanged frame is still presented this often (a restored display canvas fills again)
const MAX_FRAME = 100; // cap catch-up after a stall (tab switch, GC pause)
const MAX_ERRORS = 30; // consecutive failing frames before giving up

const CRASH_LINES = ['SOMETHING WENT WRONG', '', 'TAP OR PRESS ANY KEY', 'TO RELOAD'];

const drawCrashScreen = (ctx: CanvasRenderingContext2D) => {
  const { width, height } = ctx.canvas;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  try {
    ctx.fillStyle = '#f0e8d8';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#080808';
    ctx.fillRect(0, 0, width, 3);
    ctx.fillRect(0, height - 3, width, 3);
    ctx.fillRect(0, 0, 3, height);
    ctx.fillRect(width - 3, 0, 3, height);
    const top = Math.floor(height / 2 - (CRASH_LINES.length * 12) / 2);
    CRASH_LINES.forEach((line, i) => {
      drawText(ctx, line, Math.floor((width - measureText(line)) / 2), top + i * 12, i === 0 ? '#a83030' : '#182848');
    });
  } catch {
    // The failure may be in our own drawing code: fall back to plain canvas text
    ctx.fillStyle = '#080808';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#f8f8f0';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(CRASH_LINES[0]!, width / 2, height / 2 - 6);
    ctx.fillText('TAP OR PRESS ANY KEY TO RELOAD', width / 2, height / 2 + 10);
  }
};

const reloadOnNextGesture = () => {
  const reload = () => location.reload();
  window.addEventListener('pointerdown', reload, { once: true });
  window.addEventListener('keydown', reload, { once: true });
};

export interface LoopOptions {
  /**
   * Render once every this many fixed updates (read each frame): 1 renders after every update (60 fps), 2 every
   * other one (30 fps). Updates always run at 60 Hz, so timers, input and game logic are unchanged.
   */
  renderEvery?: () => number;
  /** Hashes each rendered frame (see frameWatch.ts): onRendered (present) is skipped when nothing changed. */
  watch?: FrameWatch;
}

/** Work done since the loop started (for measurements and the debug hook). */
export interface LoopStats {
  updates: number;
  renders: number;
  /** Frames handed to onRendered (renders minus the unchanged frames skipped). */
  presents: number;
}

export const createGameLoop = (
  ctx: CanvasRenderingContext2D,
  getScene: () => Scene | null,
  onRendered?: () => void,
  options: LoopOptions = {},
) => {
  let lastTime = 0;
  let accumulator = 0;
  let running = false;
  let paused = false; // the page is hidden: no frames are scheduled at all
  let rafId = 0;
  let stepsSinceRender = 0;
  let forceRender = true; // the first frame, and the first after the page comes back
  let lastPresent = -Infinity;
  let errorFrames = 0;
  const stats: LoopStats = { updates: 0, renders: 0, presents: 0 };

  const present = (time: number) => {
    lastPresent = time;
    stats.presents++;
    onRendered?.();
  };

  const tick = (time: number) => {
    if (!running || paused) return;
    // Schedule first so one bad frame can't stop the loop
    rafId = requestAnimationFrame(tick);

    const delta = Math.min(time - lastTime, MAX_FRAME);
    lastTime = time;
    accumulator += Math.max(0, delta);

    try {
      // Re-read the scene every step: a step may switch scenes, and the
      // remaining steps of this frame must go to the new scene.
      while (accumulator >= TIMESTEP) {
        accumulator -= TIMESTEP;
        stepsSinceRender++;
        stats.updates++;
        getScene()?.update(TIMESTEP / 1000); // pass seconds
      }

      // Render only after an update (on 90/120Hz displays most frames have none), and at most once every
      // `renderEvery` updates
      const every = Math.max(1, Math.floor(options.renderEvery?.() ?? 1));
      if (forceRender || (stepsSinceRender > 0 && stepsSinceRender >= every)) {
        const forced = forceRender;
        forceRender = false;
        stepsSinceRender = 0;
        options.watch?.begin();
        getScene()?.render(ctx);
        stats.renders++;
        const changed = options.watch ? options.watch.changed() : true;
        if (changed || forced || time - lastPresent >= KEEP_ALIVE) present(time);
      }
      errorFrames = 0;
    } catch (err) {
      console.error(err);
      errorFrames++;
      if (errorFrames >= MAX_ERRORS) {
        running = false;
        cancelAnimationFrame(rafId);
        drawCrashScreen(ctx);
        try {
          present(time);
        } catch {
          // nothing more we can show
        }
        reloadOnNextGesture();
      }
    }
  };

  // Hidden: stop scheduling frames altogether (browsers throttle rAF in the background, but not always to zero, e.g.
  // a page left visible behind a lock screen's media controls). Visible again: start afresh, without catching up on
  // the time spent away.
  const onVisibility = () => {
    if (!running) return;
    if (document.visibilityState === 'hidden') {
      paused = true;
      cancelAnimationFrame(rafId);
    } else if (paused) {
      paused = false;
      lastTime = performance.now();
      accumulator = 0;
      forceRender = true;
      rafId = requestAnimationFrame(tick);
    }
  };

  return {
    start() {
      if (running) return;
      running = true;
      paused = document.visibilityState === 'hidden';
      lastTime = performance.now();
      accumulator = 0;
      stepsSinceRender = 0;
      forceRender = true;
      errorFrames = 0;
      document.addEventListener('visibilitychange', onVisibility);
      if (!paused) rafId = requestAnimationFrame(tick);
    },
    /** Counters since the loop was created. */
    stats: (): Readonly<LoopStats> => stats,
    stop() {
      running = false;
      paused = false;
      cancelAnimationFrame(rafId);
      document.removeEventListener('visibilitychange', onVisibility);
    },
  };
};
