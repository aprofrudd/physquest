export interface Scene {
  update(dt: number): void;
  render(ctx: CanvasRenderingContext2D): void;
  onEnter?(): void;
  onExit?(): void;
}

const TIMESTEP = 1000 / 60; // ~16.67ms

export const createGameLoop = (
  ctx: CanvasRenderingContext2D,
  getScene: () => Scene | null
) => {
  let lastTime = 0;
  let accumulator = 0;
  let running = false;
  let rafId = 0;

  const tick = (time: number) => {
    if (!running) return;
    const delta = Math.min(time - lastTime, 100); // cap at 100ms
    lastTime = time;
    accumulator += delta;

    const scene = getScene();
    if (scene) {
      while (accumulator >= TIMESTEP) {
        scene.update(TIMESTEP / 1000); // pass seconds
        accumulator -= TIMESTEP;
      }
      scene.render(ctx);
    }

    rafId = requestAnimationFrame(tick);
  };

  return {
    start() {
      if (running) return;
      running = true;
      lastTime = performance.now();
      accumulator = 0;
      rafId = requestAnimationFrame(tick);
    },
    stop() {
      running = false;
      cancelAnimationFrame(rafId);
    },
  };
};
