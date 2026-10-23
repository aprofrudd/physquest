// The floor stage: a row of the four wall screens, and under it a strip of track where the athlete does the day's
// session (an easy jog, a steady run, fast reps, sprints, a rest, or a day away with a suitcase). Drawing only.
import { drawSprite } from '../../render/SpriteSheet';
import { drawText } from '../../render/PixelFont';
import { renderTileMap, T } from '../../render/TileMap';
import { COACH_DOWN, COACH_RIGHT, SPRITE_COLORS } from '../../data/sprites';
import type { SessionStyle, Phase } from './style';
import { LOOK, type DayCell, type LegsLines } from './look';
import {
  drawIntervalBody,
  drawLegsBody,
  drawWeekBody,
  drawZonesBody,
  drawStationFrame,
  fillRect,
  stationBody,
  type Rect,
  type Rung,
} from './widgets';

/** Where the four wall screens sit (a row under the sport plate) and where the athlete's strip runs under them. */
export const STATIONS = { y: 38, w: 56, h: 24, xs: [4, 68, 132, 196] } as const;
export const STRIP = { x: 4, y: 64, w: 248, h: 24 } as const;

// ---- the wall behind the screens ------------------------------------------------------------------------------

const BACKDROP_TOP = 36; // the sport plate ends here
const BACKDROP_ROWS = 8; // down to the dialogue box at 164
const WALL_ROWS: number[][] = Array.from({ length: BACKDROP_ROWS }, () => Array.from({ length: 16 }, () => T.WALL));
let backdrop: HTMLCanvasElement | null = null;

/** A dimmed brick wall under the instrument, so the screens hang on one clean wall instead of over the busy room map. */
export const drawBackdrop = (ctx: CanvasRenderingContext2D) => {
  if (!backdrop) {
    backdrop = document.createElement('canvas');
    backdrop.width = 256;
    backdrop.height = BACKDROP_ROWS * 16;
    const bctx = backdrop.getContext('2d');
    if (bctx) {
      renderTileMap(bctx, WALL_ROWS, 'track', 0, 0, backdrop.width, backdrop.height);
      bctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      bctx.fillRect(0, 0, backdrop.width, backdrop.height);
    }
  }
  ctx.drawImage(backdrop, 0, BACKDROP_TOP);
};

export interface StationsView {
  rungs: readonly Rung[];
  /** The ladder rung to point at, or -1. */
  focusRung: number;
  phase: Phase;
  legs: readonly number[];
  legsFocus: number;
  /** How many days of the legs trace and the mini planner are drawn (the run reveals them). */
  shown: number;
  lines: LegsLines;
  cells: readonly DayCell[];
  weekFocus: number;
  /** Room clock, for the lamp's blink. */
  t: number;
}

const BODIES: readonly Rect[] = STATIONS.xs.map(x => stationBody(x, STATIONS.y, STATIONS.w, STATIONS.h));
const [ZONES_BODY, INTERVAL_BODY, LEGS_BODY, WEEK_BODY] = BODIES as [Rect, Rect, Rect, Rect];

/** The four wall screens in a row: ZONES, INTERVAL, LEGS, WEEK. */
export const drawStations = (ctx: CanvasRenderingContext2D, v: StationsView) => {
  const [zonesX, intervalX, legsX, weekX] = STATIONS.xs;
  const { y, w, h } = STATIONS;
  drawStationFrame(ctx, zonesX, y, w, h, 'ZONES', LOOK.floor);
  drawZonesBody(ctx, ZONES_BODY, v.rungs, v.focusRung);
  drawStationFrame(ctx, intervalX, y, w, h, 'INTERVAL', LOOK.lcd);
  drawIntervalBody(ctx, INTERVAL_BODY, v.phase, Math.floor(v.t / 0.3) % 2 === 0);
  drawStationFrame(ctx, legsX, y, w, h, 'LEGS', LOOK.glass);
  drawLegsBody(ctx, LEGS_BODY, v.legs, v.legsFocus, v.shown, v.lines);
  drawStationFrame(ctx, weekX, y, w, h, 'WEEK', LOOK.floor);
  drawWeekBody(ctx, WEEK_BODY, v.cells, v.weekFocus, v.shown, v.lines);
};

// ---- the strip --------------------------------------------------------------------------------------------------

export interface StripView {
  style: SessionStyle;
  phase: Phase;
  /** A key session that will not be at full quality: sweat and a "!". */
  tired: boolean;
  /** Animation clock in seconds (frozen under reduced motion, so the athlete holds a pose). */
  t: number;
  /** How far the track has slid past, in px (see TRACK_SPACING): the room adds `gaitFor(...).scroll` each step. */
  scroll: number;
  /** The week is being fast-forwarded: a ">>" tag in the corner. */
  fast: boolean;
}

const ATHLETE = SPRITE_COLORS['npc_athlete'] ?? [];
const ATHLETE_X = Math.round(STRIP.x + STRIP.w / 2 - 8);
const FEET_Y = STRIP.y + 19; // the track's surface under the athlete's feet
const SPRITE_Y = FEET_Y - 16;

export interface Gait {
  /** Track scroll in px per second. */
  scroll: number;
  /** Leg cycles per second. */
  cadence: number;
}

/** The distance ticks along the track are this far apart: the scroll wraps at it. */
export const TRACK_SPACING = 24;

const GAITS: Readonly<Record<SessionStyle, Gait>> = {
  easy: { scroll: 28, cadence: 3 },
  steady: { scroll: 56, cadence: 4.5 },
  reps: { scroll: 110, cadence: 7 },
  sprints: { scroll: 190, cadence: 9 },
  rest: { scroll: 0, cadence: 0 },
  away: { scroll: 20, cadence: 2 },
  none: { scroll: 0, cadence: 0 },
};

/** The gait right now: reps and sprints slow to a walk (reps) or a stop (sprints) in their rest spells. */
export const gaitFor = (style: SessionStyle, phase: Phase): Gait => {
  if (style === 'reps' && phase === 'rest') return REST_REPS;
  if (style === 'sprints' && phase === 'rest') return STILL;
  return GAITS[style];
};

const REST_REPS: Gait = { scroll: 18, cadence: 2 };
const STILL: Gait = { scroll: 0, cadence: 0 };

const drawTrack = (ctx: CanvasRenderingContext2D, scroll: number) => {
  fillRect(ctx, STRIP.x, STRIP.y, STRIP.w, STRIP.h, LOOK.outline);
  const ix = STRIP.x + 1;
  const iy = STRIP.y + 1;
  const iw = STRIP.w - 2;
  const ih = STRIP.h - 2;
  fillRect(ctx, ix, iy, iw, ih, LOOK.orange);
  fillRect(ctx, ix, iy + 2, iw, 1, LOOK.floor); // lane line at the top
  fillRect(ctx, ix, iy + ih - 3, iw, 1, LOOK.floor); // lane line at the bottom
  // Distance ticks along the bottom line, sliding past as the athlete "runs"
  ctx.fillStyle = LOOK.floor;
  const offset = Math.floor(scroll) % TRACK_SPACING;
  for (let x = ix - offset; x < ix + iw; x += TRACK_SPACING) {
    if (x >= ix) ctx.fillRect(x, iy + ih - 6, 2, 4);
  }
  // Speckles, fixed
  ctx.fillStyle = '#e88a40';
  for (let i = 0; i < 18; i++) ctx.fillRect(ix + ((i * 37 + 11) % iw), iy + 4 + ((i * 7) % (ih - 9)), 1, 1);
  // The start line with a block on the left, a chequered finish on the right: she runs in place between them
  fillRect(ctx, ix + 8, iy, 2, ih, LOOK.floor);
  fillRect(ctx, ix + 12, iy + ih - 9, 3, 4, LOOK.darkGreen);
  for (let j = 0; j < ih; j += 3) {
    for (let i = 0; i < 6; i += 3) {
      fillRect(ctx, ix + iw - 9 + i, iy + j, 3, Math.min(3, ih - j), (i / 3 + j / 3) % 2 === 0 ? LOOK.outline : LOOK.floor);
    }
  }
};

const drawShadow = (ctx: CanvasRenderingContext2D, cx: number, width: number) => {
  ctx.globalAlpha = 0.3;
  fillRect(ctx, Math.round(cx - width / 2), FEET_Y, width, 2, LOOK.outline);
  ctx.globalAlpha = 1;
};

const drawSweat = (ctx: CanvasRenderingContext2D, x: number, y: number, phase: number) => {
  // Three drops flung from the head, each at a different point in its fall
  ctx.fillStyle = '#7ab8f0';
  for (let i = 0; i < 3; i++) {
    const p = (phase + i / 3) % 1;
    const dx = i === 0 ? -3 : i === 1 ? 17 : 19;
    const dy = (i === 1 ? 2 : 0) + Math.round(p * 6);
    ctx.fillRect(x + dx, y + 2 + dy, 2, 2);
    ctx.fillStyle = '#d8ecff';
    ctx.fillRect(x + dx, y + 2 + dy, 1, 1);
    ctx.fillStyle = '#7ab8f0';
  }
};

/** A white-faced red badge with an "!": the athlete knows this one will be a struggle. */
const drawAlert = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
  fillRect(ctx, x + 1, y, 9, 11, LOOK.outline);
  fillRect(ctx, x, y + 1, 11, 9, LOOK.outline);
  fillRect(ctx, x + 1, y + 1, 9, 9, '#ffffff');
  drawText(ctx, '!', x + 4, y + 2, LOOK.bad);
};

const drawSuitcase = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
  fillRect(ctx, x + 2, y, 4, 1, LOOK.outline); // handle
  fillRect(ctx, x, y + 1, 8, 7, LOOK.outline);
  fillRect(ctx, x + 1, y + 2, 6, 5, '#a06a38');
  fillRect(ctx, x + 1, y + 4, 6, 1, '#704020');
  fillRect(ctx, x + 3, y + 3, 2, 3, '#f0d040'); // clasp
};

// Zs in three sizes (3, 4 and 5 px square), as rows of lit pixels
const Z_ROWS: Readonly<Record<number, readonly string[]>> = {
  3: ['###', '.#.', '###'],
  4: ['####', '..#.', '.#..', '####'],
  5: ['#####', '...#.', '..#..', '.#...', '#####'],
};

/** A small "Z" of `size` pixels with a black outline. */
const drawZ = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number) => {
  const rows = Z_ROWS[size];
  if (!rows) return;
  ctx.fillStyle = LOOK.outline; // a 1px outline round every lit pixel, then the white letter on top
  for (let j = 0; j < rows.length; j++) {
    const row = rows[j] ?? '';
    for (let i = 0; i < row.length; i++) if (row[i] === '#') ctx.fillRect(x + i - 1, y + j - 1, 3, 3);
  }
  ctx.fillStyle = '#ffffff';
  for (let j = 0; j < rows.length; j++) {
    const row = rows[j] ?? '';
    for (let i = 0; i < row.length; i++) if (row[i] === '#') ctx.fillRect(x + i, y + j, 1, 1);
  }
};

/** Sleeping: Zs of growing size drifting up from the athlete's head, one more every moment. */
const drawSleep = (ctx: CanvasRenderingContext2D, x: number, y: number, t: number) => {
  const count = 1 + (Math.floor(t * 1.2) % 3);
  if (count >= 1) drawZ(ctx, x, y + 6, 3);
  if (count >= 2) drawZ(ctx, x + 6, y + 2, 4);
  if (count >= 3) drawZ(ctx, x + 13, y - 2, 5);
};

/** The athlete on the track doing `style`. */
export const drawStrip = (ctx: CanvasRenderingContext2D, v: StripView) => {
  const gait = gaitFor(v.style, v.phase);
  drawTrack(ctx, v.scroll);

  const cycle = Math.floor(v.t * gait.cadence * 2);
  const running = gait.cadence > 0 && v.style !== 'away';
  let sprite: number[][] | undefined;
  let lift = 0;
  if (running || v.style === 'away') {
    sprite = COACH_RIGHT[cycle % 2];
    lift = cycle % 2 === 0 ? 0 : -1;
  } else {
    sprite = COACH_DOWN[0];
    lift = Math.floor(v.t * 1.5) % 2 === 0 ? 0 : -1; // breathing
  }

  drawShadow(ctx, ATHLETE_X + 8, 12);
  if (v.style === 'sprints' && v.phase === 'work') {
    // Speed lines streaming back from the athlete
    ctx.fillStyle = LOOK.floor;
    for (let i = 0; i < 3; i++) {
      const len = 10 + i * 4;
      const x = ATHLETE_X - 4 - len - Math.floor((v.t * 120 + i * 17) % 14);
      ctx.fillRect(x, SPRITE_Y + 5 + i * 4, len, 1);
    }
  }
  if (sprite) drawSprite(ctx, sprite, ATHLETE_X, SPRITE_Y + lift, ATHLETE);
  if (v.style === 'away') drawSuitcase(ctx, ATHLETE_X + 11, SPRITE_Y + 8 + (cycle % 2 === 0 ? 0 : 1));
  if (v.style === 'rest') drawSleep(ctx, ATHLETE_X + 15, SPRITE_Y + 2, v.t);
  if (v.tired) {
    drawSweat(ctx, ATHLETE_X, SPRITE_Y + lift, (v.t * 1.6) % 1);
    drawAlert(ctx, ATHLETE_X + 20, STRIP.y + 2);
  }
  if (v.fast) {
    // Fast-forward: a shadowed ">>" in the corner, clear of the finish line
    const x = STRIP.x + STRIP.w - 30;
    drawText(ctx, '>>', x + 1, STRIP.y + 7, LOOK.ink);
    drawText(ctx, '>>', x, STRIP.y + 6, '#ffffff');
  }
};
