import { drawText, measureText } from '../render/PixelFont';

export interface Scene {
  update(dt: number): void;
  render(ctx: CanvasRenderingContext2D): void;
  onEnter?(): void;
  onExit?(): void;
}

const TIMESTEP = 1000 / 60; // ~16.67ms
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

export const createGameLoop = (
  ctx: CanvasRenderingContext2D,
  getScene: () => Scene | null,
  onRendered?: () => void,
) => {
  let lastTime = 0;
  let accumulator = 0;
  let running = false;
  let rafId = 0;
  let needsRender = true;
  let errorFrames = 0;

  const tick = (time: number) => {
    if (!running) return;
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
        needsRender = true;
        getScene()?.update(TIMESTEP / 1000); // pass seconds
      }

      // On 90/120Hz displays most frames have no new update; skip redundant draws.
      if (needsRender) {
        needsRender = false;
        getScene()?.render(ctx);
        onRendered?.();
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
          onRendered?.();
        } catch {
          // nothing more we can show
        }
        reloadOnNextGesture();
      }
    }
  };

  const onVisibility = () => {
    // Don't try to catch up on time spent in the background
    if (document.visibilityState === 'visible') {
      lastTime = performance.now();
      accumulator = 0;
    }
  };

  return {
    start() {
      if (running) return;
      running = true;
      lastTime = performance.now();
      accumulator = 0;
      needsRender = true;
      errorFrames = 0;
      document.addEventListener('visibilitychange', onVisibility);
      rafId = requestAnimationFrame(tick);
    },
    stop() {
      running = false;
      cancelAnimationFrame(rafId);
      document.removeEventListener('visibilitychange', onVisibility);
    },
  };
};
