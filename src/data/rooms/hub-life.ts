// The hub's moving parts and door fronts, drawn over the baked map every frame (under the characters). The doors
// stay the classic DOOR / BOSS_DOOR tiles, which the engine recognises by id, so their glass fronts (each
// department's colour, the arena's gold and purple) are painted once into one cached layer and laid over them.
// Then: a cloud drifting across the north glass bay, a glint sweeping over the windows now and then, a live trace on
// the monitoring kiosk, a shimmer running along the arena's gold frame, the recovery pod's glow and a bubble in the
// water cooler. A few fillRects each; nothing is allocated per frame. At t = 0 (reduced motion) all is at rest.
import { TILE_SIZE as TS } from '../../render/TileMap';
import { ACCENTS, BAY_GLASS, C, HUB, arenaFront, doorFront, type Dept, type Pat } from './hub-tiles';

/** Where things are, in tiles (hub.ts lays the room out with the same numbers). */
export const HUB_SPOTS = {
  doors: [
    { dept: 'testing', x: 5, y: 2 },
    { dept: 'data', x: 10, y: 2 },
    { dept: 'training', x: 5, y: 8 },
    { dept: 'analysis', x: 10, y: 8 },
    { dept: 'athlete', x: 3, y: 12 },
  ] as ReadonlyArray<{ dept: Dept; x: number; y: number }>,
  arena: { x: 7, y: 12 }, // the left of its two tiles
  northBay: { from: 5, to: 10 }, // the glass bay along the top wall, tiles 5-10
  sideBays: [
    { x: 0, y: 3 },
    { x: 15, y: 3 },
    { x: 0, y: 9 },
  ],
  kiosk: { x: 2, y: 5 },
  cooler: { x: 13, y: 5 },
  podFoot: { x: 13, y: 7 },
} as const;

const W = 16 * TS;
const H = 14 * TS;

// ---- the door fronts: one cached layer the size of the room ----

let fronts: HTMLCanvasElement | null = null;

const paint = (ctx: CanvasRenderingContext2D, p: Pat, x0: number, y0: number) => {
  p.forEach((row, y) =>
    row.forEach((c, x) => {
      ctx.fillStyle = HUB[c]!;
      ctx.fillRect(x0 + x, y0 + y, 1, 1);
    }),
  );
};

const doorFronts = (): HTMLCanvasElement | null => {
  if (fronts || typeof document === 'undefined') return fronts;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  for (const d of HUB_SPOTS.doors) paint(ctx, doorFront(d.dept), d.x * TS, d.y * TS);
  paint(ctx, arenaFront(), HUB_SPOTS.arena.x * TS, HUB_SPOTS.arena.y * TS);
  fronts = canvas;
  return fronts;
};

const rect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) => {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
};

// ---- the north glass bay: a cloud, and a glint now and then ----

// The bay's panes, in pixels: tiles `from`..`to` of the top row, white mullions where two tiles meet
const BAY_FROM = HUB_SPOTS.northBay.from;
const BAY_TO = HUB_SPOTS.northBay.to;
const BAY_X0 = BAY_FROM * TS + 2;
const BAY_X3 = BAY_TO * TS + 13; // inclusive
const BAY_TOP = BAY_GLASS.top;
const BAY_ROWS = BAY_GLASS.rows;
const inBay = (x: number): boolean => {
  if (x < BAY_X0 || x > BAY_X3) return false;
  const local = x % TS;
  return local !== 0 && local !== TS - 1;
};

// A cloud: rows of [dx, width], white over a shaded underside
const CLOUD: ReadonlyArray<readonly [number, number, number]> = [
  [3, 3, C.GLINT],
  [1, 7, C.GLINT],
  [0, 9, C.WHITE],
  [1, 7, C.GLASSL],
];

const drawCloud = (ctx: CanvasRenderingContext2D, left: number, top: number) => {
  for (let row = 0; row < CLOUD.length; row++) {
    const [dx, w, c] = CLOUD[row]!;
    ctx.fillStyle = HUB[c]!;
    for (let i = 0; i < w; i++) {
      const x = left + dx + i;
      if (inBay(x)) ctx.fillRect(x, top + row, 1, 1);
    }
  }
};

const drawSky = (ctx: CanvasRenderingContext2D, t: number) => {
  const span = BAY_X3 - BAY_X0 + 1 + 12;
  // two clouds at different heights and speeds, both in view at t = 0 so a still frame has them
  drawCloud(ctx, Math.floor(BAY_X0 - 9 + ((t * 1.6 + 30) % span)), BAY_TOP + 1);
  drawCloud(ctx, Math.floor(BAY_X0 - 9 + ((t * 1.1 + 70) % span)), BAY_TOP + 3);
};

const GLINT_EVERY = 7; // seconds between sweeps
const GLINT_TIME = 0.9; // seconds a sweep takes

/** A two-pixel diagonal of light crossing a pane from left to right (`x0..x1` wide, `rows` tall, from `top`). */
const sweep = (ctx: CanvasRenderingContext2D, phase: number, x0: number, x1: number, top: number, rows: number, keep: (x: number) => boolean) => {
  const head = x0 - rows + Math.floor(phase * (x1 - x0 + rows + 2));
  ctx.fillStyle = HUB[C.GLINT]!;
  for (let r = 0; r < rows; r++) {
    for (let k = 0; k < 2; k++) {
      const x = head + (rows - 1 - r) + k;
      if (x >= x0 && x <= x1 && keep(x)) ctx.fillRect(x, top + r, 1, 1);
    }
  }
};

const always = () => true;

const drawGlints = (ctx: CanvasRenderingContext2D, t: number) => {
  if (t <= 0) return;
  const p = (t % GLINT_EVERY) / GLINT_TIME;
  if (p < 1) sweep(ctx, p, BAY_X0, BAY_X3, BAY_TOP, BAY_ROWS, inBay);
  // the side bays follow, one after another
  for (let i = 0; i < HUB_SPOTS.sideBays.length; i++) {
    const bay = HUB_SPOTS.sideBays[i]!;
    const q = ((t - 1.2 - i * 0.5 + GLINT_EVERY) % GLINT_EVERY) / GLINT_TIME;
    if (q < 0 || q >= 1) continue;
    const x0 = bay.x * TS + 5;
    sweep(ctx, q, x0, x0 + 5, bay.y * TS + 3, 10, always);
  }
};

// ---- the monitoring kiosk's trace ----

/** One beat of a heart-rate trace, in pixels above the screen's baseline. */
const BEAT = [0, 0, 0, 1, 0, 0, -1, 5, -2, 0, 0, 1, 2, 1, 0, 0] as const;
const SCREEN_X = HUB_SPOTS.kiosk.x * TS + 2;
const SCREEN_W = 12;
const BASELINE = HUB_SPOTS.kiosk.y * TS + 8;
const TRACE = '#7ef0a0';
const TRACE_HEAD = '#e8fff0';

const drawTrace = (ctx: CanvasRenderingContext2D, t: number) => {
  const shift = Math.floor(t * 10);
  for (let i = 0; i < SCREEN_W; i++) {
    const dy = BEAT[(i + shift) % BEAT.length]!;
    rect(ctx, SCREEN_X + i, BASELINE - dy, 1, 1, i === SCREEN_W - 1 ? TRACE_HEAD : TRACE);
  }
  // a little readout in the corner: the heart's beat
  if (Math.floor(t * 1.5) % 2 === 0) rect(ctx, SCREEN_X + 10, BASELINE - 5, 2, 1, HUB[C.RED]!);
};

// ---- the arena's shimmer ----

const ARENA_X = HUB_SPOTS.arena.x * TS;
const ARENA_Y = HUB_SPOTS.arena.y * TS;
const SHIMMER_EVERY = 5;
const SHIMMER_TIME = 1.4;
const SHINE = '#fffbe0';

const drawShimmer = (ctx: CanvasRenderingContext2D, t: number) => {
  // the star twinkles
  if (t > 0 && Math.floor(t * 1.2) % 3 === 0) {
    rect(ctx, ARENA_X + 15, ARENA_Y + 6, 2, 1, SHINE);
    rect(ctx, ARENA_X + 15, ARENA_Y + 3, 1, 1, SHINE);
  }
  if (t <= 0) return;
  const p = (t % SHIMMER_EVERY) / SHIMMER_TIME;
  if (p >= 1) return;
  // along the lintel, left to right, and down both sides at the same time
  const x = ARENA_X + Math.floor(p * 34) - 2;
  for (let k = 0; k < 4; k++) {
    const px = x + k;
    if (px >= ARENA_X + 1 && px <= ARENA_X + 30) rect(ctx, px, ARENA_Y + 1, 1, 1, SHINE);
  }
  const y = ARENA_Y + 1 + Math.floor(p * 13);
  rect(ctx, ARENA_X + 1, y, 1, 2, SHINE);
  rect(ctx, ARENA_X + 30, y, 1, 2, SHINE);
};

// ---- recovery: the pod's glow and the cooler's bubble ----

const drawRecovery = (ctx: CanvasRenderingContext2D, t: number) => {
  const pod = HUB_SPOTS.podFoot;
  const glow = Math.floor(t * 0.8) % 2 === 1 ? ACCENTS.athlete.l : ACCENTS.athlete.m;
  rect(ctx, pod.x * TS + 3, pod.y * TS + 4, 10, 1, HUB[glow]!);
  if (t > 0) {
    const phase = (t % 2.5) / 2.5; // a bubble rising through the bottle
    if (phase < 0.8) {
      const c = HUB_SPOTS.cooler;
      rect(ctx, c.x * TS + 9, c.y * TS + 5 - Math.floor(phase * 5), 1, 1, HUB[C.GLINT]!);
    }
  }
};

/** Everything drawn over the hub's map, for the room clock `t` (seconds). */
export const drawHubLife = (ctx: CanvasRenderingContext2D, t: number): void => {
  const layer = doorFronts();
  if (layer) ctx.drawImage(layer, 0, 0);
  drawSky(ctx, t);
  drawGlints(ctx, t);
  drawTrace(ctx, t);
  drawShimmer(ctx, t);
  drawRecovery(ctx, t);
};
