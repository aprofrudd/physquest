// The four test scenes on the stage: the treadmill with its gas cart, the track with three runs and rests, the
// cycle ergometer with an all-out effort that fades, and the shuttle run between two cones that quickens until
// she stops. Each is a function of how far through the test it is (see timeline.ts), drawn at the game's own
// pixel scale from the lab's shared kit, so the stage is the lab you walked round.
import type { TestKit } from '../content/types';
import {
  C,
  CART_PICTURE,
  CART_SCREEN,
  ERGOMETER_PARTS,
  ERGOMETER_PICTURE,
  TILE_ART,
  TREADMILL_BELT,
  TREADMILL_PICTURE,
  drawGateMarks,
  fill,
  paintCone,
  paintGrid,
  paintLane,
} from './kit';
import { ALERT, CROSS, DROP, drawBeep, drawStopwatch, drawSweat } from './icons';
import { AISHA_COLORS, HEAD_RIGHT, HIPS_RIGHT, RUN_FRAMES, RUN_FRAMES_LEFT, SPENT_RIGHT, STAND_RIGHT, TECH_COLORS, TECH_FRAMES } from './people';
import { SHUTTLE_LEVELS, cycleAt, shuttleAt, stageAt, trialAt, trialDistance } from './timeline';

export interface Area {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Everything a scene needs to know about the moment it is drawing. */
export interface SceneClock {
  /** Seconds on the stage clock: breathing, blinking, sweat. */
  t: number;
  /** How far through the test (0-1). */
  u: number;
  /** How many real seconds u spans (the loop or the run), so strides keep one pace in both. */
  seconds: number;
  /** She is running on a day she should have been re-booked: sweat and a warning. */
  shaky: boolean;
  /** Reduced motion: no continuous animation (belts, strides, spinning), only the changes of state. */
  calm: boolean;
  /** Stages of the stepped test, trials of the trials test. */
  stages: number;
  trials: number;
  /** The run's big stage, with room for the technician; false for the small preview. */
  large: boolean;
}

/** The preview loop on the pick screen: the test, then a short hold on its last moment. */
export const PREVIEW_SECONDS = 7.2;
const PREVIEW_HOLD = 0.9;

/** u for the preview at stage clock time t (it holds at 1 for a moment, then starts again). */
export const previewU = (t: number): number => Math.min(1, (t % (PREVIEW_SECONDS + PREVIEW_HOLD)) / PREVIEW_SECONDS);

const motion = (s: SceneClock, v: number): number => (s.calm ? 0 : v);
/** A step counter that advances `rate` times a second, and stays at 0 under reduced motion. */
const tick = (s: SceneClock, rate: number): number => (s.calm ? 0 : Math.floor(s.t * rate));
/** A blink: on half the time, and always on under reduced motion. */
const lit = (s: SceneClock, rate: number): boolean => s.calm || Math.floor(s.t * rate) % 2 === 0;
const draw = (ctx: CanvasRenderingContext2D, grid: number[][], x: number, y: number) =>
  paintGrid(ctx, grid, Math.round(x), Math.round(y), AISHA_COLORS);
const frameAt = (frames: readonly number[][][], n: number): number[][] => frames[n % frames.length] ?? STAND_RIGHT;

/** Sweat flying off her head: two drops, the second half a beat behind (one drop, still, under reduced motion). */
const drawSweatOff = (ctx: CanvasRenderingContext2D, x: number, y: number, s: SceneClock, dir: 1 | -1) => {
  for (let k = 0; k < (s.calm ? 1 : 2); k++) {
    const p = s.calm ? 0.4 : (s.t * 1.6 + k * 0.5) % 1;
    if (p > 0.85) continue;
    drawSweat(ctx, Math.round(x + (dir === 1 ? 4 - p * 9 : 9 + p * 9)), Math.round(y + 1 + p * p * 9));
  }
};

/** A warning bubble over her head when the day was wrong. */
const drawWarning = (ctx: CanvasRenderingContext2D, x: number, y: number, s: SceneClock) => {
  if (lit(s, 3)) paintGrid(ctx, ALERT, Math.round(x), Math.round(y - 11));
};

/** The technician at his clipboard, feet on `groundY`, facing right: only on the big stage. */
const drawTech = (ctx: CanvasRenderingContext2D, x: number, groundY: number, s: SceneClock) =>
  paintGrid(ctx, TECH_FRAMES[tick(s, 2) % TECH_FRAMES.length] ?? STAND_RIGHT, Math.round(x), Math.round(groundY - 15), TECH_COLORS);

// ---- the treadmill ---------------------------------------------------------------------------------------------------

const TREADMILL_SCENE_W = 134;
const STRIDES_PER_TRAVEL = 240;
const BELT_PER_TRAVEL = 140;

const drawTreadmillScene = (ctx: CanvasRenderingContext2D, a: Area, s: SceneClock): void => {
  const at = stageAt(s.u, s.stages);
  const ground = a.y + a.h - 1;
  const x0 = a.x + Math.max(4, Math.round((a.w - TREADMILL_SCENE_W) / 2) + (s.large ? 14 : 0));
  const y0 = ground - 31;
  const pace = s.seconds / PREVIEW_SECONDS; // strides and belt keep one speed per second in the preview and the run
  const ended = s.u >= 1;
  if (s.large) drawTech(ctx, x0 - 20, ground, s);

  paintGrid(ctx, TREADMILL_PICTURE.grid, x0, y0);
  // the belt runs backwards under her feet
  const bx = x0 + TREADMILL_BELT.x;
  const by = y0 + TREADMILL_BELT.y;
  fill(ctx, C.dark, bx, by, TREADMILL_BELT.w, TREADMILL_BELT.h);
  const slide = Math.floor(motion(s, at.travel * BELT_PER_TRAVEL * pace)) % 8;
  for (let k = -1; k * 8 - slide < TREADMILL_BELT.w; k++) {
    const left = Math.max(0, k * 8 - slide);
    const right = Math.min(TREADMILL_BELT.w, k * 8 - slide + 2);
    if (right > left && !ended) fill(ctx, C.mid, bx + left, by, right - left, TREADMILL_BELT.h);
  }

  // the runner, in step with the belt
  const stride = Math.floor(motion(s, at.travel * STRIDES_PER_TRAVEL * pace));
  const flight = stride % RUN_FRAMES.length === 2 ? 1 : 0;
  const rx = x0 + 16;
  const ry = y0 + 10 - flight;
  if (ended) {
    draw(ctx, frameAt(SPENT_RIGHT, tick(s, 2.5)), rx, y0 + 10);
  } else {
    draw(ctx, frameAt(RUN_FRAMES, stride), rx, ry);
    if (at.stage >= Math.floor(s.stages / 2) || s.shaky) drawSweatOff(ctx, rx, ry, s, 1);
    if (s.shaky) drawWarning(ctx, rx + 4, ry, s);
  }

  // the gas cart beside the console, its trace running
  const cx = x0 + 49;
  paintGrid(ctx, CART_PICTURE.grid, cx, y0);
  fill(ctx, C.lcd, cx + CART_SCREEN.x, y0 + CART_SCREEN.y, CART_SCREEN.w, CART_SCREEN.h);
  for (let i = 0; i < CART_SCREEN.w; i++) {
    const wave = Math.sin((i + motion(s, s.t * 6)) * 0.75) + 0.5 * Math.sin((i + motion(s, s.t * 6)) * 1.9);
    fill(ctx, C.dark, cx + CART_SCREEN.x + i, y0 + CART_SCREEN.y + 3 + Math.round(wave * 1.4), 1, 1);
  }

  // the blood lactate analyser, and a drop going into it at the end of each stage
  const ax = cx + 21;
  const ay = ground - 15;
  paintGrid(ctx, TILE_ART.analyser, ax, ay);
  if (!ended && at.sample > 0) paintGrid(ctx, DROP, ax + 5, Math.round(ay - 9 + at.sample * 7));

  // one pip per stage, the current one blinking
  const pips = Math.min(s.stages, 9);
  for (let k = 0; k < pips; k++) {
    const px = ax - 6 + k * 7;
    const done = k < at.stage || ended;
    const current = k === at.stage && !ended;
    fill(ctx, C.outline, px, a.y + 2, 6, 6);
    fill(ctx, done || (current && lit(s, 3)) ? C.gold : C.cream, px + 1, a.y + 3, 4, 4);
  }
};

// ---- the track ------------------------------------------------------------------------------------------------------------

const drawTrackScene = (ctx: CanvasRenderingContext2D, a: Area, s: SceneClock): void => {
  const at = trialAt(s.u, s.trials);
  const ground = a.y + a.h - 1;
  const laneX = a.x + 4;
  const laneW = a.w - 8;
  const laneY = ground - 28;
  const laneH = 19;
  const startX = laneX + 16;
  const runLength = laneW - 46;
  const feetY = laneY + laneH - 4;

  paintLane(ctx, laneX, laneY, laneW, laneH);
  fill(ctx, C.outline, startX - 1, laneY + 2, 1, laneH - 4);
  fill(ctx, C.gold, startX, laneY + 2, 2, laneH - 4);
  fill(ctx, C.outline, startX + 2, laneY + 2, 1, laneH - 4);

  // a gate where each trial ends (over different distances), lit as she crosses it
  const count = Math.max(1, s.trials);
  for (let k = 0; k < count; k++) {
    const gx = startX + 8 + trialDistance(k, count) * runLength;
    const lit = at.trial === k && at.phase === 'rest' && at.within < 0.45;
    drawGateMarks(ctx, gx, laneY + 1, laneY + laneH - 1, lit);
  }
  paintCone(ctx, laneX + 3, ground);
  paintCone(ctx, laneX + laneW - 3, ground);

  // a stopwatch for each trial, running on the one she is doing
  for (let k = 0; k < count; k++) {
    const active = k === at.trial && at.phase === 'run';
    drawStopwatch(ctx, a.x + 6 + k * 13, a.y, active ? motion(s, s.t * 2) + at.within * 0.75 : 0, k <= at.trial);
  }

  // the runner: sprints her trial, recovers hands on hips, is back on the start line for the next
  const edge = startX + 8 + at.distance * runLength;
  let x = startX - 4;
  let sprite: number[][] = STAND_RIGHT;
  let visible = true;
  if (at.phase === 'run') {
    x = startX - 4 + (edge - startX) * at.within;
    sprite = frameAt(RUN_FRAMES, tick(s, 14));
  } else if (at.phase === 'rest') {
    // recovering hands on hips where she finished; then she is back on the start line, ready for the next
    const atStart = at.within >= 0.85;
    x = (atStart ? startX : edge) - 4;
    sprite = atStart ? STAND_RIGHT : frameAt(HIPS_RIGHT, tick(s, 3));
    visible = s.calm || at.within < 0.7 || atStart;
  } else {
    x = edge - 4;
    sprite = frameAt(SPENT_RIGHT, tick(s, 2.5));
  }
  if (visible) draw(ctx, sprite, x, feetY - 14);
  if (at.phase === 'run' && at.trial >= 1) drawSweatOff(ctx, x, feetY - 14, s, 1);
  if (s.shaky && at.phase !== 'end') drawWarning(ctx, x + 4, feetY - 14, s);
};

// ---- the cycle ergometer ---------------------------------------------------------------------------------------------------

/** A line of squares: `thick` wide, in `color` over a one-pixel outline in black (no allocation: it runs every frame). */
const thickLine = (ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, thick: number, color: string) => {
  const steps = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0)));
  ctx.fillStyle = AISHA_COLORS[0] ?? '#000';
  for (let i = 0; i <= steps; i++) {
    ctx.fillRect(Math.round(x0 + ((x1 - x0) * i) / steps) - 1, Math.round(y0 + ((y1 - y0) * i) / steps) - 1, thick + 2, thick + 2);
  }
  ctx.fillStyle = color;
  for (let i = 0; i <= steps; i++) {
    ctx.fillRect(Math.round(x0 + ((x1 - x0) * i) / steps), Math.round(y0 + ((y1 - y0) * i) / steps), thick, thick);
  }
};

/** A limb of two bones from (x0, y0) to (x1, y1); the joint bends to the right of the way there (bend 1) or the left (-1). */
const drawLimb = (
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  upper: number,
  lower: number,
  bend: 1 | -1,
  thick: number,
  color: string,
) => {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const length = Math.max(0.001, Math.hypot(dx, dy));
  const reach = Math.min(upper + lower - 0.5, Math.max(2, length));
  const along = (upper * upper - lower * lower + reach * reach) / (2 * reach);
  const lift = Math.sqrt(Math.max(0, upper * upper - along * along));
  const ux = dx / length;
  const uy = dy / length;
  const jx = x0 + ux * along + bend * uy * lift;
  const jy = y0 + uy * along - bend * ux * lift;
  thickLine(ctx, x0, y0, jx, jy, thick, color);
  thickLine(ctx, jx, jy, x0 + ux * reach, y0 + uy * reach, Math.max(2, thick - 1), color);
};

const drawCycleScene = (ctx: CanvasRenderingContext2D, a: Area, s: SceneClock): void => {
  const { power, angle } = cycleAt(s.u);
  const { flywheel, crank, saddle, grips } = ERGOMETER_PARTS;
  const ground = a.y + a.h - 1;
  const x0 = a.x + (s.large ? Math.round((a.w - 100) / 2) + 14 : 36);
  const y0 = ground - 31;
  const spin = motion(s, angle * (s.seconds / PREVIEW_SECONDS)) + (s.calm ? 0.6 : 0);
  if (s.large) drawTech(ctx, x0 - 30, ground, s);
  const legColor = AISHA_COLORS[2] ?? '#e0b088'; // bare legs below her shorts, as in her other frames
  const farLeg = '#a87850'; // the far leg in shadow

  // far leg behind the machine, the machine, then the near leg
  const hx = x0 + saddle.x;
  const hy = y0 + saddle.y - 2;
  const nearX = x0 + crank.x + Math.cos(spin) * 3;
  const nearY = y0 + crank.y + Math.sin(spin) * 3;
  const farX = x0 + crank.x - Math.cos(spin) * 3;
  const farY = y0 + crank.y - Math.sin(spin) * 3;
  drawLimb(ctx, hx, hy, farX, farY, 8, 8, 1, 2, farLeg);
  paintGrid(ctx, ERGOMETER_PICTURE.grid, x0, y0);

  // spokes turning on the flywheel
  const fx = x0 + flywheel.x;
  const fy = y0 + flywheel.y;
  for (let k = 0; k < 3; k++) {
    const th = spin + (k * Math.PI * 2) / 3;
    for (let i = 1; i <= 3; i++) fill(ctx, C.light, fx + Math.round(Math.cos(th) * i), fy + Math.round(Math.sin(th) * i), 1, 1);
  }
  fill(ctx, C.gold, fx, fy, 1, 1);

  drawLimb(ctx, hx, hy, nearX, nearY, 8, 8, 1, 3, legColor);
  fill(ctx, C.white, Math.round(nearX) - 1, Math.round(nearY) + 1, 4, 2);
  fill(ctx, C.white, Math.round(farX) - 1, Math.round(farY) + 1, 4, 2);

  // the rider: torso from the saddle to her shoulders, arms to the grips, her head up front
  const bob = power > 0.7 && !s.calm && Math.floor(s.t * 12) % 2 === 0 ? 1 : 0;
  const shoulderX = x0 + saddle.x + 6;
  const shoulderY = y0 + saddle.y - 6 + bob;
  thickLine(ctx, hx, hy, shoulderX, shoulderY, 4, AISHA_COLORS[3] ?? '#c83030');
  ctx.fillStyle = AISHA_COLORS[5] ?? '#303848'; // her shorts, at the hip over the top of the thigh
  ctx.fillRect(Math.round(hx), Math.round(hy), 4, 3);
  drawLimb(ctx, shoulderX, shoulderY + 1, x0 + grips.x, y0 + grips.y, 5, 5, -1, 2, AISHA_COLORS[2] ?? '#e0b088');
  paintGrid(ctx, HEAD_RIGHT, Math.round(shoulderX - 6), Math.round(shoulderY - 9), AISHA_COLORS);
  if (power > 0.6 && !s.calm) {
    // speed lines behind her while she is flat out
    for (let k = 0; k < 3; k++) fill(ctx, C.mid, x0 - 4 - k * 3 - ((Math.floor(s.t * 20) + k) % 3) * 2, y0 + 2 + k * 5, 6 - k, 1);
  }
  if (s.shaky) drawWarning(ctx, shoulderX - 2, shoulderY - 9, s);
  if (s.u < 1 && power > 0.45) drawSweatOff(ctx, shoulderX - 6, shoulderY - 9, s, 1);

  // the stopwatch: the whole effort is one sweep of its hand
  drawStopwatch(ctx, x0 + 62, a.y + a.h - 28, s.u * 0.95, true);
};

// ---- the shuttle run ------------------------------------------------------------------------------------------------------------

const drawShuttleScene = (ctx: CanvasRenderingContext2D, a: Area, s: SceneClock): void => {
  const at = shuttleAt(s.u);
  const ground = a.y + a.h - 1;
  const laneX = a.x + 4;
  const laneW = a.w - 8;
  const laneY = ground - 28;
  const laneH = 19;
  const leftLine = laneX + 14;
  const rightLine = laneX + laneW - 14;
  const feetY = laneY + laneH - 4;

  paintLane(ctx, laneX, laneY, laneW, laneH);
  // a turning line and a cone at each end: she must touch the line on the beep
  for (const lx of [leftLine, rightLine]) {
    fill(ctx, C.outline, lx - 1, laneY + 2, 1, laneH - 4);
    fill(ctx, C.gold, lx, laneY + 2, 2, laneH - 4);
    fill(ctx, C.outline, lx + 2, laneY + 2, 1, laneH - 4);
  }
  paintCone(ctx, laneX + 3, ground);
  paintCone(ctx, laneX + laneW - 3, ground);

  // beeps: the speaker sounds at each turn, and the level count climbs
  drawBeep(ctx, a.x + 6, a.y + 2, at.beep);
  for (let k = 0; k < SHUTTLE_LEVELS; k++) {
    const px = a.x + a.w - 6 - (SHUTTLE_LEVELS - k) * 7;
    fill(ctx, C.outline, px, a.y + 3, 6, 6);
    fill(ctx, k < at.level ? C.gold : C.cream, px + 1, a.y + 4, 4, 4);
  }

  const span = rightLine - leftLine - 8;
  const x = leftLine + 2 + at.x * span;
  const spriteY = feetY - 14;
  if (at.spent) {
    draw(ctx, frameAt(SPENT_RIGHT, tick(s, 2.5)), x - 4, spriteY);
    // the last beep went and she was not at the line she was heading for: a bold red cross there
    paintGrid(ctx, CROSS, (at.dir === 1 ? rightLine : leftLine) - 4, laneY + 5);
  } else {
    const cadence = 6 + at.level * 1.8;
    const stride = tick(s, cadence * Math.max(0.15, at.pace));
    const frames = at.dir === 1 ? RUN_FRAMES : RUN_FRAMES_LEFT;
    const flight = stride % frames.length === 2 ? 1 : 0;
    draw(ctx, frameAt(frames, stride), x - 4, spriteY - flight);
    if (at.level >= 4) drawSweatOff(ctx, x - 4, spriteY, s, at.dir);
    if (s.shaky) drawWarning(ctx, x, spriteY, s);
  }
};

export const SCENES: Readonly<Record<TestKit, (ctx: CanvasRenderingContext2D, a: Area, s: SceneClock) => void>> = {
  treadmill: drawTreadmillScene,
  track: drawTrackScene,
  cycle: drawCycleScene,
  shuttle: drawShuttleScene,
};
