// What moves in the briefing room, and the pictures on its wall: the projector chart that slowly draws itself,
// the whiteboard's noise band, the season planner, a steaming mug, a blinking laptop cursor and the presenter's
// pointer. Drawn every frame over the baked tiles and under the characters; `t` is the room clock (it stops while
// the game is paused, and under reduced motion it stays at 0).
import { drawText } from '../../render/PixelFont';
import { drawSprite } from '../../render/SpriteSheet';
import { prefersReducedMotion } from '../../render/motion';
import { COACH_LEFT, COACH_UP, NPC_SPRITE } from '../sprites';
import { RUNNING } from '../../rooms/content/running';
import { C, PEOPLE_COLORS, ROOM_COLORS, patch, seated, type Sprite } from './analysis-art';

const K = ROOM_COLORS;
const ink = K[C.outline] as string;
const dark = K[C.dark] as string;
const light = K[C.light] as string;
const cream = K[C.cream] as string;
const blue = K[C.blue] as string;
const deepBlue = K[C.deepBlue] as string;
const gold = K[C.gold] as string;
const red = K[C.red] as string;
const green = K[C.green] as string;
const white = K[C.white] as string;
const steel = K[C.steel] as string;

const rect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) => {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
};

// ---- where things are (pixels; the room is 16 x 14 tiles of 16px) ---------------------------------------------------

/** The projector screen's white area (the wall's tiles 3-7 across, rows 1-2). */
const SCR = { x: 52, y: 19, w: 72, h: 26 };
/** The chart drawn on it: its axes, and the curve's columns. */
const CHART = { x: SCR.x + 7, baseY: SCR.y + 13, columns: 45 };
const CURVE_Y: readonly number[] = Array.from({ length: CHART.columns }, (_, i) => CHART.baseY - Math.round(9 * (1 - Math.exp(-i / 16))));

/** How long the curve takes to draw, and how long the finished chart is held, in seconds. */
const DRAW_TIME = 7;
const HOLD_TIME = 5;

const WEEKS = RUNNING.analysis.weeks;

// ---- the wall pictures (static: drawn once into their own canvas) ---------------------------------------------------

const paintProjector = (ctx: CanvasRenderingContext2D) => {
  rect(ctx, 48, 16, 80, 2, dark); // the housing the screen rolls down from
  rect(ctx, SCR.x - 2, SCR.y - 2, SCR.w + 4, SCR.h + 3, ink);
  rect(ctx, SCR.x, SCR.y, SCR.w, SCR.h, cream);
  rect(ctx, CHART.x - 1, SCR.y + 2, 1, 15, dark); // the y axis
  rect(ctx, CHART.x - 1, SCR.y + 16, SCR.w - 12, 1, dark); // the x axis
  for (let g = 0; g < 3; g++) rect(ctx, CHART.x, SCR.y + 4 + g * 4, SCR.w - 14, 1, light);
  drawText(ctx, 'NOW', SCR.x + 3, SCR.y + 18, dark);
  const label = `WEEK ${WEEKS}`;
  drawText(ctx, label, SCR.x + SCR.w - 3 - (label.length * 6 - 1), SCR.y + 18, dark);
};

const paintWhiteboard = (ctx: CanvasRenderingContext2D) => {
  const x = 130;
  const y = 17;
  rect(ctx, x, y, 44, 29, ink);
  rect(ctx, x + 1, y + 1, 42, 27, steel);
  rect(ctx, x + 2, y + 2, 40, 24, white);
  rect(ctx, x + 2, y + 26, 40, 1, light); // the pen tray
  // a bell curve with its middle band (the noise) hatched and the smallest worthwhile change marked beyond it
  const baseY = y + 23;
  const centre = x + 22;
  for (let i = -17; i <= 17; i++) {
    const height = Math.round(12 * Math.exp(-0.5 * (i / 7) * (i / 7)));
    if (Math.abs(i) <= 6) for (let k = 0; k < height; k++) if ((i + k) % 2 === 0) rect(ctx, centre + i, baseY - k, 1, 1, blue);
    rect(ctx, centre + i, baseY - height, 1, 1, deepBlue);
  }
  rect(ctx, x + 3, baseY + 1, 38, 1, dark);
  for (const s of [-1, 1]) for (let k = 0; k < 15; k += 4) rect(ctx, centre + s * 9, baseY - 13 + k, 1, 2, gold);
  drawText(ctx, 'TE', x + 3, y + 3, deepBlue); // marker pens: the band's blue, the worthwhile line's gold
  drawText(ctx, 'SWC', x + 40 - 17, y + 3, gold);
};

const paintPlanner = (ctx: CanvasRenderingContext2D) => {
  const x = 178;
  const y = 17;
  rect(ctx, x, y, 28, 29, ink);
  rect(ctx, x + 1, y + 1, 26, 27, white);
  rect(ctx, x + 1, y + 1, 26, 9, deepBlue);
  drawText(ctx, 'RACE', x + 2, y + 2, cream);
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 6; col++) {
      const spent = row === 0 || (row === 1 && col < 3);
      rect(ctx, x + 3 + col * 4, y + 13 + row * 5, 3, 3, spent ? blue : light);
    }
  }
  // the race day, circled, with a flag
  const rx = x + 3 + 4 * 4;
  const ry = y + 13 + 2 * 5;
  rect(ctx, rx - 1, ry - 1, 5, 5, red);
  rect(ctx, rx, ry, 3, 3, white);
  rect(ctx, rx + 1, ry - 5, 1, 4, ink);
  rect(ctx, rx + 2, ry - 5, 3, 2, red);
};

let wallLayer: HTMLCanvasElement | null = null;

/** The three wall pictures on one canvas the size of the room, made the first time the room is drawn. */
const wallPictures = (): HTMLCanvasElement => {
  if (wallLayer) return wallLayer;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 48;
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  paintProjector(ctx);
  paintWhiteboard(ctx);
  paintPlanner(ctx);
  wallLayer = canvas;
  return canvas;
};

// ---- people ------------------------------------------------------------------------------------------------------

const POINTER = ['6', '6'] as const;
const PRESENTER: readonly Sprite[] = [
  patch(COACH_LEFT[0] as Sprite, [1, 9, POINTER]),
  patch(COACH_LEFT[1] as Sprite, [1, 8, POINTER]),
];
const COLLEAGUE_A: readonly Sprite[] = [
  seated(NPC_SPRITE),
  seated(patch(NPC_SPRITE, [4, 10, ['3']], [11, 10, ['3']])),
];
const COLLEAGUE_B: Sprite = seated(COACH_UP[0] as Sprite);

/** Where the people stand, in tiles. */
export const PEOPLE = {
  presenter: { x: 8, y: 3 },
  colleagueA: { x: 4, y: 5 },
  colleagueB: { x: 6, y: 8 },
} as const;

/** Everything animated in the room, drawn over the baked map. */
export const drawBriefingLife = (ctx: CanvasRenderingContext2D, t: number): void => {
  ctx.drawImage(wallPictures(), 0, 0);

  // the projector chart draws its line, holds, then starts over; reduced motion shows it finished
  const still = prefersReducedMotion();
  const phase = t % (DRAW_TIME + HOLD_TIME);
  const reveal = still ? CHART.columns : Math.min(CHART.columns, Math.floor((phase / DRAW_TIME) * CHART.columns));
  for (let i = 0; i < reveal; i++) rect(ctx, CHART.x + i, CURVE_Y[i] as number, 2, 2, blue);
  if (reveal >= CHART.columns) {
    // the forecast zone: hatched, with a question mark that blinks
    const zx = CHART.x + CHART.columns + 2;
    for (let j = 0; j < 12; j += 2) for (let i = 0; i < 16; i += 2) if ((i + j) % 4 === 0) rect(ctx, zx + i, SCR.y + 3 + j, 2, 2, light);
    if (still || Math.floor(t * 2) % 2 === 0) drawText(ctx, '?', zx + 5, SCR.y + 5, blue);
  }

  // the presenter beside the board, his laser riding the head of the curve
  const presenter = PEOPLE.presenter;
  const frame = Math.floor(t * 1.4) % 2;
  drawSprite(ctx, PRESENTER[frame] as Sprite, presenter.x * 16, presenter.y * 16, PEOPLE_COLORS.presenter);
  const head = Math.max(0, Math.min(CHART.columns - 1, reveal - 1));
  const dotX = CHART.x + head;
  const dotY = CURVE_Y[head] as number;
  rect(ctx, dotX, dotY - 1, 2, 2, red);

  // the colleagues
  const typing = Math.floor(t * 0.8) % 2;
  drawSprite(ctx, COLLEAGUE_A[typing] as Sprite, PEOPLE.colleagueA.x * 16, PEOPLE.colleagueA.y * 16, PEOPLE_COLORS.colleagueA);
  drawSprite(ctx, COLLEAGUE_B, PEOPLE.colleagueB.x * 16, PEOPLE.colleagueB.y * 16, PEOPLE_COLORS.colleagueB);

  // the laptop's cursor (the screen sits at (84..91, 100..102)) and the steam over the mug (9,6)
  if (still || Math.floor(t * 2) % 2 === 0) rect(ctx, 88, 101, 1, 1, cream);
  const puff = Math.floor(t * 2) % 2;
  rect(ctx, 154 + puff, 98, 1, 1, white);
  rect(ctx, 155 - puff, 96, 1, 1, white);
  rect(ctx, 154 + puff, 94, 1, 1, white);

  // the coffee machine's light
  rect(ctx, 219, 147, 2, 2, Math.floor(t * 0.7) % 2 === 0 ? green : red);
};
