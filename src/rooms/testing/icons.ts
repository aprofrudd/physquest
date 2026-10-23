// Small pictures for the test stage: a blood drop, a stopwatch, a speaker, sweat, the calendar's tear-off
// marks. Pixel art from text, drawn with the lab palette (kit.ts LABX).
import { C, LABX, paintGrid } from './kit';
import { createPixels, type Grid } from './pixels';

const KEY: Readonly<Record<string, number>> = {
  k: C.outline,
  r: C.red,
  w: C.white,
  l: C.light,
  m: C.mid,
  d: C.dark,
  g: C.gold,
  o: C.orange,
  n: C.green,
  s: C.steel,
  e: C.grey,
};

const icon = (rows: readonly string[]): Grid => {
  const width = Math.max(...rows.map(r => r.length));
  const c = createPixels(width, rows.length);
  c.stamp(0, 0, rows, KEY);
  return c.grid;
};

/** A fingertip blood sample: a red drop. 5x7. */
export const DROP: Grid = icon([
  '..k..',
  '.krk.',
  '.krk.',
  'krrrk',
  'krwrk',
  'krrrk',
  '.kkk.',
]);

/** A stopwatch face with its crown: 9x10. The hand is drawn live (see drawStopwatch). */
export const STOPWATCH: Grid = icon([
  '..kkkkk..',
  '....k....',
  '..kkkkk..',
  '.kwwwwwk.',
  'kwwwwwwwk',
  'kwwwwwwwk',
  'kwwwwwwwk',
  'kwwwwwwwk',
  '.kwwwwwk.',
  '..kkkkk..',
]);

const STOPWATCH_HAND = [
  [0, -3],
  [2, -2],
  [3, 0],
  [2, 2],
  [0, 3],
  [-2, 2],
  [-3, 0],
  [-2, -2],
] as const;

/** A stopwatch at (x, y) with its hand at `turn` (0-1 round the face); lit ones have a gold rim. */
export const drawStopwatch = (ctx: CanvasRenderingContext2D, x: number, y: number, turn: number, lit = true) => {
  paintGrid(ctx, STOPWATCH, x, y);
  if (lit) {
    ctx.fillStyle = LABX[C.gold] ?? '#000';
    ctx.fillRect(x + 4, y + 1, 1, 1);
    ctx.fillRect(x + 4, y + 9, 1, 1);
  }
  const round = ((turn % 1) + 1) % 1; // 0-1 round the face, whatever turn is
  const at = STOPWATCH_HAND[Math.floor(round * STOPWATCH_HAND.length)] ?? STOPWATCH_HAND[0];
  ctx.fillStyle = LABX[C.red] ?? '#000';
  ctx.fillRect(x + 4, y + 6, 1, 1);
  ctx.fillRect(x + 4 + Math.round(at[0] * 0.5), y + 6 + Math.round(at[1] * 0.5), 1, 1);
  ctx.fillRect(x + 4 + at[0], y + 6 + at[1], 1, 1);
};

/** A speaker: 8x8. Sound waves are drawn live (see drawBeep). */
export const SPEAKER: Grid = icon([
  '...k....',
  '..kk....',
  'kkwk....',
  'kwwk....',
  'kwwk....',
  'kkwk....',
  '..kk....',
  '...k....',
]);

/** A speaker at (x, y) with sound waves that grow with `beep` (0 = quiet, 1 = just sounded). */
export const drawBeep = (ctx: CanvasRenderingContext2D, x: number, y: number, beep: number) => {
  paintGrid(ctx, SPEAKER, x, y);
  if (beep <= 0) return;
  ctx.fillStyle = LABX[C.gold] ?? '#000';
  ctx.fillRect(x + 5, y + 3, 1, 2);
  if (beep > 0.35) ctx.fillRect(x + 7, y + 2, 1, 4);
  if (beep > 0.7) ctx.fillRect(x + 9, y + 1, 1, 6);
};

/** A drop of sweat flicked off her head: 2x3, pale blue with a white glint. */
export const drawSweat = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
  ctx.fillStyle = LABX[C.outline] ?? '#000';
  ctx.fillRect(x, y, 3, 4);
  ctx.fillStyle = LABX[C.light] ?? '#000';
  ctx.fillRect(x + 1, y, 1, 3);
  ctx.fillRect(x, y + 1, 3, 2);
  ctx.fillStyle = LABX[C.white] ?? '#000';
  ctx.fillRect(x + 1, y + 1, 1, 1);
};

/** A small "!" in a red bubble: 7x9, for something that is not right. */
export const ALERT: Grid = icon([
  '.kkkkk.',
  'krrwrrk',
  'krrwrrk',
  'krrwrrk',
  'krrrrrk',
  'krrwrrk',
  '.kkkkk.',
  '..kkk..',
  '...k...',
]);

/** A bold tick: 11x9, green with an outline. For "right". */
export const TICK: Grid = icon([
  '.........kk',
  '........knnk',
  '.......knnk.',
  '.kk...knnk..',
  'knnk.knnk...',
  '.knnknnk....',
  '..knnnk.....',
  '...knk......',
  '....k.......',
]);

/** A bold cross: 9x9, red with an outline. For "wrong". */
export const CROSS: Grid = icon([
  'kk.....kk',
  'krk...krk',
  '.krk.krk.',
  '..krkrk..',
  '...krk...',
  '..krkrk..',
  '.krk.krk.',
  'krk...krk',
  'kk.....kk',
]);
