// The Testing Lab's moving parts, drawn over the baked map every frame (under the characters): the treadmill
// belt, the gas cart's trace, the gate beams, the analyser display, the laptop cursor, the wall clock and the
// technician's pen. A handful of fillRects each, and the technician's sprite is cached.
import { TILE_SIZE as TS } from '../../render/TileMap';
import { paintGrid, C, CART_SCREEN, TREADMILL_BELT, ANALYSER_LCD, LAPTOP_SCREEN, WALL_MONITOR, fill } from '../../rooms/testing/kit';
import { TECH_COLORS, TECH_FRAMES } from '../../rooms/testing/people';

/** Where things stand on the map, in tiles. The map's layout (testing.ts) and these draw positions share them. */
export const SPOTS = {
  treadmill: { x: 3, y: 2 },
  wallMonitor: { x: 7, y: 1 },
  cart: { x: 6, y: 2 },
  ergometer: { x: 12, y: 2 },
  analyser: { x: 11, y: 10 },
  laptop: { x: 13, y: 10 },
  clock: { x: 12, y: 1 },
  tech: { x: 2, y: 3 },
  /** Gate columns and the two lane rows they span. */
  gateColumns: [5, 10],
  laneTop: 7,
} as const;

// The second hand's twelve positions (1px from the clock's middle outwards, one per tick)
const HAND_DX = [0, 1, 2, 3, 2, 1, 0, -1, -2, -3, -2, -1] as const;
const HAND_DY = [-3, -3, -2, 0, 2, 3, 3, 3, 2, 0, -2, -3] as const;

const drawBelt = (ctx: CanvasRenderingContext2D, t: number) => {
  const x0 = SPOTS.treadmill.x * TS + TREADMILL_BELT.x;
  const y0 = SPOTS.treadmill.y * TS + TREADMILL_BELT.y;
  fill(ctx, C.dark, x0, y0, TREADMILL_BELT.w, TREADMILL_BELT.h);
  const shift = Math.floor(t * 12) % 8; // the belt runs backwards: stripes slide left
  for (let x = x0 - shift; x < x0 + TREADMILL_BELT.w; x += 8) {
    const left = Math.max(x, x0);
    const right = Math.min(x + 2, x0 + TREADMILL_BELT.w);
    if (right > left) fill(ctx, C.mid, left, y0, right - left, TREADMILL_BELT.h);
  }
};

const drawTrace = (ctx: CanvasRenderingContext2D, t: number) => {
  const x0 = SPOTS.cart.x * TS + CART_SCREEN.x;
  const y0 = SPOTS.cart.y * TS + CART_SCREEN.y;
  fill(ctx, C.lcd, x0, y0, CART_SCREEN.w, CART_SCREEN.h);
  for (let i = 0; i < CART_SCREEN.w; i++) {
    const wave = Math.sin((i + t * 6) * 0.75) + 0.5 * Math.sin((i + t * 6) * 1.9);
    fill(ctx, C.dark, x0 + i, y0 + 3 + Math.round(wave * 1.4), 1, 1);
  }
  fill(ctx, Math.floor(t * 2) % 2 === 0 ? C.green : C.dark, x0 + 8, y0 + 1, 2, 1);
};

const drawBeams = (ctx: CanvasRenderingContext2D, t: number) => {
  const phase = Math.floor(t * 4) % 2;
  const top = SPOTS.laneTop * TS - 5; // from the upper post's lens to the lower post's lens
  const bottom = (SPOTS.laneTop + 2) * TS + 5;
  for (const column of SPOTS.gateColumns) {
    const x = column * TS + 7;
    for (let y = top + phase * 2; y < bottom; y += 4) fill(ctx, C.red, x, y, 1, 1);
  }
};

const drawAnalyser = (ctx: CanvasRenderingContext2D, t: number) => {
  const x0 = SPOTS.analyser.x * TS + ANALYSER_LCD.x;
  const y0 = SPOTS.analyser.y * TS + ANALYSER_LCD.y;
  fill(ctx, C.lcd, x0, y0, ANALYSER_LCD.w, ANALYSER_LCD.h);
  fill(ctx, C.dark, x0 + 1, y0 + 1, 6, 1); // a line of reading, and a shorter one under it
  fill(ctx, C.dark, x0 + 1, y0 + 3, 3, 1);
  if (Math.floor(t * 2) % 2 === 0) fill(ctx, C.dark, x0 + 5, y0 + 3, 1, 1); // its marker blinks
};

const drawLaptop = (ctx: CanvasRenderingContext2D, t: number) => {
  const x0 = SPOTS.laptop.x * TS + LAPTOP_SCREEN.x;
  const y0 = SPOTS.laptop.y * TS + LAPTOP_SCREEN.y;
  fill(ctx, C.lcd, x0, y0, LAPTOP_SCREEN.w, LAPTOP_SCREEN.h);
  fill(ctx, C.dark, x0 + 1, y0 + 2, 6, 1);
  fill(ctx, C.mid, x0 + 1, y0 + 4, 4, 1);
  if (Math.floor(t * 2) % 2 === 0) fill(ctx, C.dark, x0 + 6, y0 + 4, 1, 1); // cursor
};

// One heartbeat, 16 columns wide: flat, a small bump, the spike and the dip, flat
const BEAT = [0, 0, 0, 1, 1, 0, 0, -1, 4, -3, 0, 0, 1, 1, 0, 0] as const;

const drawWallMonitor = (ctx: CanvasRenderingContext2D, t: number) => {
  const x0 = SPOTS.wallMonitor.x * TS + WALL_MONITOR.x;
  const y0 = SPOTS.wallMonitor.y * TS + WALL_MONITOR.y;
  fill(ctx, C.screen, x0, y0, WALL_MONITOR.w, WALL_MONITOR.h);
  fill(ctx, C.dark, x0, y0 + 4, WALL_MONITOR.w, 1);
  const shift = Math.floor(t * 14);
  let before = y0 + 4;
  for (let i = 0; i < WALL_MONITOR.w; i++) {
    const at = y0 + 4 - (BEAT[(i + shift) % BEAT.length] ?? 0);
    // join each column to the one before, so the spike is a line and not a scatter of dots
    fill(ctx, C.green, x0 + i, Math.min(at, before), 1, Math.abs(at - before) + 1);
    before = at;
  }
};

const drawClock = (ctx: CanvasRenderingContext2D, t: number) => {
  const cx = SPOTS.clock.x * TS + 8;
  const cy = SPOTS.clock.y * TS + 7;
  fill(ctx, C.outline, cx - 2, cy - 2, 1, 1); // the short hand, pointing up and left
  fill(ctx, C.outline, cx - 1, cy - 1, 1, 1);
  fill(ctx, C.outline, cx, cy, 1, 1);
  const tick = Math.floor(t) % 12;
  const dx = HAND_DX[tick] ?? 0;
  const dy = HAND_DY[tick] ?? 0;
  fill(ctx, C.red, cx + Math.round(dx * 0.66), cy + Math.round(dy * 0.66), 1, 1);
  fill(ctx, C.red, cx + Math.round(dx * 0.33), cy + Math.round(dy * 0.33), 1, 1);
};

/** Everything that moves in the lab, for the room clock `t` (seconds). */
export const drawLabLife = (ctx: CanvasRenderingContext2D, t: number): void => {
  drawBelt(ctx, t);
  drawTrace(ctx, t);
  drawBeams(ctx, t);
  drawAnalyser(ctx, t);
  drawLaptop(ctx, t);
  drawClock(ctx, t);
  drawWallMonitor(ctx, t);
  // the technician writes on his clipboard
  const frame = TECH_FRAMES[Math.floor(t * 2) % TECH_FRAMES.length];
  if (frame) paintGrid(ctx, frame, SPOTS.tech.x * TS, SPOTS.tech.y * TS, TECH_COLORS);
};
