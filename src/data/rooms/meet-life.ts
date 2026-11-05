// The ATHLETE room's moving parts, drawn over the baked map every frame (under the characters): clouds drifting past
// the window, steam from the two mugs and the wall clock's second hand. A few fillRects each; nothing is allocated.
import { TILE_SIZE as TS } from '../../render/TileMap';
import { SKYX, WALLX } from './meet-tiles';

/** Where things are on the map, in tiles (meet.ts lays the room out with the same numbers). */
export const MEET_SPOTS = {
  windowLeft: { x: 2, y: 1 },
  clock: { x: 8, y: 1 },
  table: { x: 7, y: 6 }, // the left half; the mugs are on the right half
  athlete: { x: 9, y: 7 },
} as const;

// The window's sky, in pixels: the left pane and the right pane, either side of the mullion
const SKY_TOP = MEET_SPOTS.windowLeft.y * TS + 3;
const LEFT_X0 = MEET_SPOTS.windowLeft.x * TS + 3;
const LEFT_X1 = MEET_SPOTS.windowLeft.x * TS + 14; // inclusive
const RIGHT_X0 = (MEET_SPOTS.windowLeft.x + 1) * TS + 1;
const RIGHT_X1 = (MEET_SPOTS.windowLeft.x + 1) * TS + 12;
const SPAN = RIGHT_X1 - LEFT_X0 + 1;

const inSky = (x: number): boolean => (x >= LEFT_X0 && x <= LEFT_X1) || (x >= RIGHT_X0 && x <= RIGHT_X1);

// A cloud: rows of [dx, width]
const CLOUD: ReadonlyArray<readonly [number, number]> = [
  [2, 3],
  [0, 7],
];

const drawCloud = (ctx: CanvasRenderingContext2D, left: number, top: number) => {
  ctx.fillStyle = SKYX[3];
  for (let row = 0; row < CLOUD.length; row++) {
    const [dx, w] = CLOUD[row]!;
    for (let i = 0; i < w; i++) {
      const x = left + dx + i;
      if (inSky(x)) ctx.fillRect(x, top + row, 1, 1);
    }
  }
};

const drawClouds = (ctx: CanvasRenderingContext2D, t: number) => {
  const travel = SPAN + 8; // a cloud enters fully hidden on the left and leaves fully hidden on the right
  const a = (t * 2) % travel;
  const b = (t * 1.3 + travel / 2) % travel;
  drawCloud(ctx, Math.floor(LEFT_X0 - 7 + a), SKY_TOP + 1);
  drawCloud(ctx, Math.floor(LEFT_X0 - 7 + b), SKY_TOP + 5);
};

// Steam: three wisps over each mug, rising and fading in turn
const MUG_X = [(MEET_SPOTS.table.x + 1) * TS + 4, (MEET_SPOTS.table.x + 1) * TS + 9] as const;
const MUG_TOP = MEET_SPOTS.table.y * TS + 4;

const drawSteam = (ctx: CanvasRenderingContext2D, t: number) => {
  ctx.fillStyle = WALLX[4];
  for (let m = 0; m < MUG_X.length; m++) {
    const x0 = MUG_X[m]!;
    for (let k = 0; k < 3; k++) {
      const phase = (t * 0.9 + k / 3 + m * 0.5) % 1; // 0 at the mug, 1 at the top of the rise
      const y = MUG_TOP - Math.floor(phase * 6);
      const x = x0 + (Math.floor(phase * 6 + m) % 2);
      if (phase < 0.85) ctx.fillRect(x, y, 1, 1);
    }
  }
};

// The second hand's twelve positions (1px from the clock's middle outwards, one per tick)
const HAND_DX = [0, 1, 2, 3, 2, 1, 0, -1, -2, -3, -2, -1] as const;
const HAND_DY = [-3, -3, -2, 0, 2, 3, 3, 3, 2, 0, -2, -3] as const;

const drawClockHand = (ctx: CanvasRenderingContext2D, t: number) => {
  const cx = MEET_SPOTS.clock.x * TS + 8;
  const cy = MEET_SPOTS.clock.y * TS + 7;
  const tick = Math.floor(t) % 12;
  const dx = HAND_DX[tick] ?? 0;
  const dy = HAND_DY[tick] ?? 0;
  ctx.fillStyle = WALLX[5];
  ctx.fillRect(cx + Math.round(dx * 0.66), cy + Math.round(dy * 0.66), 1, 1);
  ctx.fillRect(cx + Math.round(dx * 0.33), cy + Math.round(dy * 0.33), 1, 1);
};

/** Everything that moves in the room, for the room clock `t` (seconds). */
export const drawMeetLife = (ctx: CanvasRenderingContext2D, t: number): void => {
  drawClouds(ctx, t);
  drawSteam(ctx, t);
  drawClockHand(ctx, t);
};
