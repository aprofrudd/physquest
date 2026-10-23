// The Training Floor's moving parts, drawn over the map every frame (under the characters): the four coach boards
// on the wall, a jogger looping the fenced lane, the coach with his stopwatch, battle ropes and a skipping rope.
// `t` is the room clock in seconds: it stops while paused, and sits at 0 under reduced motion.
import { drawSprite } from '../../render/SpriteSheet';
import { drawText } from '../../render/PixelFont';
import { TILE_SIZE } from '../../render/TileMap';
import { COACH_LEFT, getCoachSprite } from '../sprites';
import { LEVEL_DATA, type SportData } from '../sports';
import { contentFor } from '../../rooms/content';
import { analyse, cardSession, keyCardIndices, REST, type Session } from '../../rooms/training/model';
import { dayCells, ladderRungs } from '../../rooms/training/cells';
import { LOOK, type DayCell, type LegsLines } from '../../rooms/training/look';
import {
  boardBody,
  drawBoardFrame,
  drawIntervalBody,
  drawLegsBody,
  drawWeekBody,
  drawZonesBody,
  type Rect,
  type Rung,
} from '../../rooms/training/widgets';

// ---- the wall boards ------------------------------------------------------------------------------------------

/** Where the four boards hang: x of each, and the shared row. They sit on the wall-face row (y 16-31). */
export const BOARD_XS = [50, 98, 146, 194] as const;
const BOARD_Y = 17;
export const BOARD_W = 44;
const BOARD_H = 13;
const [ZONES_BODY, INTERVAL_BODY, LEGS_BODY, WEEK_BODY] = BOARD_XS.map(x => boardBody(x, BOARD_Y, BOARD_W, BOARD_H)) as [Rect, Rect, Rect, Rect];

/** What the wall shows while nobody is planning: a hard-easy sample week, and the zones as a ladder. */
interface WallSample {
  cells: DayCell[];
  legs: number[];
  lines: LegsLines;
  rungs: Rung[];
}

const FALLBACK: WallSample = {
  cells: [],
  legs: [100, 50, 75, 50, 75, 50, 75],
  lines: { fullAt: 75, redBelow: 45 },
  rungs: ['support', 'key', 'key', 'key'],
};

const samples = new WeakMap<SportData, WallSample>();

const sampleFor = (sport: SportData): WallSample => {
  const cached = samples.get(sport);
  if (cached) return cached;
  const content = contentFor(LEVEL_DATA.indexOf(sport))?.training;
  let sample = FALLBACK;
  if (content) {
    // Key, support, key, support, key, support, rest: the shape of a good week, whatever the cards are
    const keys = keyCardIndices(content);
    const support = content.cards.findIndex(c => c.role === 'support');
    const pick = (i: number): Session => {
      const key = keys[i];
      return key === undefined ? REST : cardSession(key);
    };
    const easy: Session = support >= 0 ? cardSession(support) : REST;
    const plan = [pick(0), easy, pick(1), easy, pick(2), easy, REST];
    const analysis = analyse(content, plan);
    sample = {
      cells: dayCells(content, plan, analysis),
      legs: analysis.legs,
      lines: { fullAt: content.legs.fullAt, redBelow: content.checks.redBelow },
      rungs: ladderRungs(content),
    };
  }
  samples.set(sport, sample);
  return sample;
};

/** The wall's INTERVAL board swaps between WORK and REST every 1.2 s, ZONES moves its pointer up the ladder. */
const drawBoards = (ctx: CanvasRenderingContext2D, t: number, sport: SportData) => {
  const sample = sampleFor(sport);
  const days = sample.legs.length;

  drawBoardFrame(ctx, BOARD_XS[0], BOARD_Y, BOARD_W, BOARD_H, LOOK.floor);
  drawZonesBody(ctx, ZONES_BODY, sample.rungs, Math.floor(t / 1.2) % Math.max(1, sample.rungs.length));

  drawBoardFrame(ctx, BOARD_XS[1], BOARD_Y, BOARD_W, BOARD_H, LOOK.lcd);
  const working = Math.floor(t / 1.2) % 2 === 0;
  drawIntervalBody(ctx, INTERVAL_BODY, working ? 'work' : 'rest', Math.floor(t / 0.3) % 2 === 0);

  drawBoardFrame(ctx, BOARD_XS[2], BOARD_Y, BOARD_W, BOARD_H, LOOK.glass);
  drawLegsBody(ctx, LEGS_BODY, sample.legs, Math.floor(t / 0.6) % days, days, sample.lines);

  drawBoardFrame(ctx, BOARD_XS[3], BOARD_Y, BOARD_W, BOARD_H, LOOK.floor);
  drawWeekBody(ctx, WEEK_BODY, sample.cells, Math.floor(t / 0.6) % days, days, sample.lines);
};

// ---- the lane and its jogger ---------------------------------------------------------------------------------------

type Facing = 'up' | 'down' | 'left' | 'right';

const LANE_TOP = 2;
const LANE_BOTTOM = 11;
const LANE_LEFT = 1;
const LANE_RIGHT = 2;
const LANE_SPAN = LANE_BOTTOM - LANE_TOP; // 9 tiles up, and 9 back down
const LOOP = 2 * LANE_SPAN + 2;
const JOG_SPEED = 3; // tiles per second

const JOG_COLORS = ['', '#080808', '#583828', '#e0b088', '#8848b8', '#f0d040', '#ffffff', '#f0d040'];

interface Spot {
  x: number;
  y: number;
  dir: Facing;
}
const jogger: Spot = { x: 0, y: 0, dir: 'up' };

/** The jogger `d` tiles into the loop: up the left lane, across the top, down the right lane, across the bottom. */
const joggerAt = (distance: number, out: Spot): Spot => {
  let d = distance % LOOP;
  if (d < LANE_SPAN) {
    out.x = LANE_LEFT;
    out.y = LANE_BOTTOM - d;
    out.dir = 'up';
  } else if ((d -= LANE_SPAN) < 1) {
    out.x = LANE_LEFT + d;
    out.y = LANE_TOP;
    out.dir = 'right';
  } else if ((d -= 1) < LANE_SPAN) {
    out.x = LANE_RIGHT;
    out.y = LANE_TOP + d;
    out.dir = 'down';
  } else {
    d -= LANE_SPAN;
    out.x = LANE_RIGHT - d;
    out.y = LANE_BOTTOM;
    out.dir = 'left';
  }
  return out;
};

const drawJogger = (ctx: CanvasRenderingContext2D, t: number) => {
  const spot = joggerAt(t * JOG_SPEED, jogger);
  drawSprite(ctx, getCoachSprite(spot.dir, Math.floor(t * 6) % 2), Math.round(spot.x * TILE_SIZE), Math.round(spot.y * TILE_SIZE), JOG_COLORS);
};

/** Lane numbers on the start tiles. */
const drawLaneNumbers = (ctx: CanvasRenderingContext2D) => {
  drawText(ctx, '1', LANE_LEFT * TILE_SIZE + 6, LANE_BOTTOM * TILE_SIZE + 2, LOOK.floor);
  drawText(ctx, '2', LANE_RIGHT * TILE_SIZE + 5, LANE_BOTTOM * TILE_SIZE + 2, LOOK.floor);
};

// ---- the coach ------------------------------------------------------------------------------------------------------

/** Where the coach stands, in tiles (a solid tile: not something to talk to). */
export const COACH_TILE = { x: 5, y: 5 } as const;

const TRACKSUIT = ['', '#080808', '#202020', '#e0b088', '#1b5c28', '#88d898', '#ffffff', '#f0d040'];

const patchSprite = (base: number[][], x: number, y: number, rows: readonly string[]): number[][] => {
  const copy = base.map(row => row.slice());
  rows.forEach((row, j) => {
    [...row].forEach((ch, i) => {
      const target = copy[y + j];
      if (ch !== '.' && target) target[x + i] = Number(ch);
    });
  });
  return copy;
};

const STOPWATCH = ['.77', '766', '766', '.77'];
const COACH_BASE = COACH_LEFT[0] ?? [];
/** The coach faces the lane with a stopwatch held out; it dips a pixel every so often. */
const COACH_WATCH: readonly number[][][] = [patchSprite(COACH_BASE, 0, 7, STOPWATCH), patchSprite(COACH_BASE, 0, 8, STOPWATCH)];

const drawCoach = (ctx: CanvasRenderingContext2D, t: number) => {
  const sprite = COACH_WATCH[Math.floor(t * 1.5) % 2];
  if (sprite) drawSprite(ctx, sprite, COACH_TILE.x * TILE_SIZE, COACH_TILE.y * TILE_SIZE, TRACKSUIT);
};

// ---- ropes ----------------------------------------------------------------------------------------------------------

/** Battle ropes tied to the post, waving along the floor to the left of it. */
const ROPE_POST = { x: 9, y: 3 } as const;
const ROPE_LENGTH = 52;

const drawBattleRopes = (ctx: CanvasRenderingContext2D, t: number) => {
  const baseX = ROPE_POST.x * TILE_SIZE + 4;
  const baseY = ROPE_POST.y * TILE_SIZE + 9;
  for (let r = 0; r < 2; r++) {
    ctx.fillStyle = r ? LOOK.darkGreen : LOOK.orange;
    for (let i = 0; i < ROPE_LENGTH; i++) {
      const y = Math.round(baseY + (r ? 3 : -2) + Math.sin(i * 0.3 - t * 9 + r * 1.6) * (1 + i * 0.07));
      ctx.fillRect(baseX - i, y, 1, 2);
    }
  }
};

/** Where the athlete stands (the map's NPC), in tiles. */
export const ATHLETE_TILE = { x: 11, y: 7 } as const;

/** The athlete's skipping rope: a loop over the head, then under the feet, round the standing sprite. */
const drawSkippingRope = (ctx: CanvasRenderingContext2D, t: number) => {
  const x = ATHLETE_TILE.x * TILE_SIZE;
  const y = ATHLETE_TILE.y * TILE_SIZE;
  const over = Math.floor(t * 4) % 2 === 0;
  ctx.fillStyle = LOOK.orange;
  for (let i = 0; i <= 20; i++) {
    const a = (Math.PI * i) / 20;
    const px = Math.round(x + 7 - Math.cos(a) * 9);
    const py = over ? Math.round(y + 8 - Math.sin(a) * 13) : Math.round(y + 12 + Math.sin(a) * 5);
    ctx.fillRect(px, py, 1, 2);
  }
};

/** Everything that moves in the room, in drawing order. */
export const drawTrainingLife = (ctx: CanvasRenderingContext2D, t: number, sport: SportData) => {
  drawBoards(ctx, t, sport);
  drawBattleRopes(ctx, t);
  drawLaneNumbers(ctx);
  drawJogger(ctx, t);
  drawCoach(ctx, t);
  drawSkippingRope(ctx, t);
};
