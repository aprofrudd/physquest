// Drawing the RACE TO THE LINE (see RaceModel.ts): the lap counter and distance to go, a track strip with both
// runners (a window that follows them, so a gap of a few metres shows), the KICK (D') gauge sized from the rating,
// and what Aisha is doing. The runner icons are cached canvases painted once; every label is built once and looked
// up, so a frame allocates nothing. Under reduced motion the lane marks do not scroll and the runners do not stride.
import { GAME_W } from '../render/DialogueBox';
import { drawText, measureText } from '../render/PixelFont';
import { prefersReducedMotion } from '../render/motion';
import { FINALE_RUNNING } from '../rooms/content/finale-running';
import { LAPS, LAP_LINES, RACE_M, raceClock, type RaceState } from './RaceModel';

const TEXT = FINALE_RUNNING.race;

const INK = '#2a1a4a';
const MUTED = '#5a4a7a';
const BAD = '#8a1f1f';
const GOOD = '#1f6a2c';
const PLAYER = '#3858a8';
const RIVAL_TEXT = '#8a1f1f';
const TRACK = '#f3d3bb';
const LANE_LINE = '#faf7ff';
const FILL_HIGH = '#2f9a45';
const FILL_MID = '#c0a830';
const FILL_LOW = '#a83030';
const GAUGE_BACK = '#faf7ff';

// Runners' colours: Aisha's red vest, the rival's royal blue (as on their name tabs)
const AISHA_VEST = '#c83030';
const RIVAL_VEST = '#3858a8';
const HAIR = '#2a1a12';
const LEGS = '#3a2a22';

// Layout (game pixels), between the prompt (y 80-94) and the result line (y 144)
export const RACE_INFO_Y = 97;
const STRIP_X = 36;
const STRIP_Y = 106;
const STRIP_W = GAME_W - 4 - STRIP_X; // to x = 252
const LANE_H = 9;
const STRIP_H = LANE_H * 2 + 3; // border, lane, divider, lane, border
const PX_PER_M = 1.5;
const GAUGE_Y = 130;
const GAUGE_X = 62;
const GAUGE_H = 9;
const GAUGE_MIN_W = 40;
const GAUGE_SPAN_W = 110; // a full rating's gauge is GAUGE_MIN_W + GAUGE_SPAN_W wide
const STATUS_Y = 142;
const LABEL_X = 4;

// ---- labels, built once ------------------------------------------------------------------------------------------

const fmtLaps = (v: number): string => (Number.isInteger(v) ? String(v) : v.toFixed(1));
/** LAP n/12.5 by lap lines crossed: 0, then 0.5 (the opening half lap), 1.5 ... 11.5 at the bell; 12.5 at the line. */
// (index LAP_LINES + 1 is the finish: 12.5/12.5)
const LAP_TEXT: readonly string[] = Array.from({ length: LAP_LINES + 2 }, (_, k) =>
  `LAP ${fmtLaps(k === 0 ? 0 : Math.min(LAPS, k - 0.5))}/${fmtLaps(LAPS)}`,
);
let toGoText: string[] | null = null;
const toGo = (m: number): string => {
  if (!toGoText) toGoText = Array.from({ length: RACE_M / 10 + 1 }, (_, i) => `${i * 10} M TO GO`);
  return toGoText[Math.max(0, Math.min(RACE_M / 10, Math.ceil(m / 10)))]!;
};
const METRES_MAX = 400;
let metresText: string[] | null = null;
const metres = (m: number): string => {
  if (!metresText) metresText = Array.from({ length: METRES_MAX + 1 }, (_, i) => `${i} M`);
  return metresText[Math.max(0, Math.min(METRES_MAX, Math.round(m)))]!;
};

// The finishing times, formatted once per race (the state object is the key)
let timesFor: RaceState | null = null;
let youTime = '';
let rivalTime = '';

// ---- runner icons (cached canvases) ------------------------------------------------------------------------------

const RUNNER: readonly (readonly string[])[] = [
  ['...hh..', '...hh..', '..vvv..', '.l.vv.l', '...vv..', '..l.l..', '.l...l.', 'l.....l'],
  ['...hh..', '...hh..', '..vvv..', '..lvvl.', '...vv..', '...ll..', '...ll..', '..l.l..'],
];
const RUNNER_W = 7;
const RUNNER_H = 8;
const icons = new Map<string, HTMLCanvasElement>();

const runnerIcon = (vest: string, frame: number): HTMLCanvasElement => {
  const key = `${vest}${frame}`;
  let canvas = icons.get(key);
  if (canvas) return canvas;
  canvas = document.createElement('canvas');
  canvas.width = RUNNER_W;
  canvas.height = RUNNER_H;
  const c = canvas.getContext('2d')!;
  const rows = RUNNER[frame]!;
  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < RUNNER_W; x++) {
      const ch = rows[y]![x];
      if (ch === '.' || ch === undefined) continue;
      c.fillStyle = ch === 'h' ? HAIR : ch === 'v' ? vest : LEGS;
      c.fillRect(x, y, 1, 1);
    }
  }
  icons.set(key, canvas);
  return canvas;
};
// Painted on the first race frame, then only looked up
const aishaIcons: HTMLCanvasElement[] = [];
const rivalIcons: HTMLCanvasElement[] = [];
const iconsReady = (): void => {
  if (aishaIcons.length > 0) return;
  aishaIcons.push(runnerIcon(AISHA_VEST, 0), runnerIcon(AISHA_VEST, 1));
  rivalIcons.push(runnerIcon(RIVAL_VEST, 0), runnerIcon(RIVAL_VEST, 1));
};

// ---- drawing -----------------------------------------------------------------------------------------------------

const centred = (ctx: CanvasRenderingContext2D, text: string, y: number, color: string): void => {
  drawText(ctx, text, Math.round((GAME_W - measureText(text)) / 2), y, color);
};

const rightAligned = (ctx: CanvasRenderingContext2D, text: string, y: number, color: string): void => {
  drawText(ctx, text, GAME_W - 4 - measureText(text) + 1, y, color);
};

const drawInfo = (ctx: CanvasRenderingContext2D, s: RaceState, complete: boolean, bellOn: boolean): void => {
  if (s.practice) {
    centred(ctx, TEXT.practice.banner, RACE_INFO_Y, INK);
    return;
  }
  if (complete && s.finished) {
    if (timesFor !== s) {
      timesFor = s;
      youTime = `YOU ${raceClock(s.time)}`;
      rivalTime = `RIVAL ${raceClock(s.rivalTime)}`;
    }
    drawText(ctx, youTime, LABEL_X, RACE_INFO_Y, PLAYER);
    rightAligned(ctx, rivalTime, RACE_INFO_Y, RIVAL_TEXT);
    return;
  }
  drawText(ctx, LAP_TEXT[s.finished ? LAP_LINES + 1 : s.laps]!, LABEL_X, RACE_INFO_Y, INK);
  rightAligned(ctx, toGo(RACE_M - s.pos), RACE_INFO_Y, INK);
  if (s.bell && bellOn) centred(ctx, 'BELL!', RACE_INFO_Y, BAD);
};

const drawStrip = (ctx: CanvasRenderingContext2D, s: RaceState, calm: boolean): void => {
  ctx.fillStyle = INK;
  ctx.fillRect(STRIP_X, STRIP_Y, STRIP_W, STRIP_H);
  ctx.fillStyle = TRACK;
  ctx.fillRect(STRIP_X + 1, STRIP_Y + 1, STRIP_W - 2, LANE_H);
  ctx.fillRect(STRIP_X + 1, STRIP_Y + 2 + LANE_H, STRIP_W - 2, LANE_H);
  ctx.fillStyle = LANE_LINE;
  ctx.fillRect(STRIP_X + 1, STRIP_Y + 1 + LANE_H, STRIP_W - 2, 1);

  drawText(ctx, 'YOU', LABEL_X, STRIP_Y + 2, PLAYER);
  if (!s.practice) drawText(ctx, 'RIVAL', LABEL_X, STRIP_Y + 3 + LANE_H, RIVAL_TEXT);

  // The window follows the pair (Aisha alone on the practice straight)
  const inner = STRIP_W - 2;
  const span = inner / PX_PER_M;
  const mid = s.practice ? s.pos : (s.pos + s.rivalPos) / 2;
  const left = mid - span / 2;
  const at = (m: number): number => STRIP_X + 1 + Math.round((m - left) * PX_PER_M);

  // Lane marks every 10 m slide past at her pace (held still under reduced motion: only the runners move)
  if (!calm) {
    ctx.fillStyle = LANE_LINE;
    const first = Math.ceil(left / 10) * 10;
    for (let m = first; m < left + span; m += 10) {
      const x = at(m);
      ctx.fillRect(x, STRIP_Y + 1, 1, 2);
      ctx.fillRect(x, STRIP_Y + STRIP_H - 3, 1, 2);
    }
  }

  // The finish line, checkered, once it is in view
  if (!s.practice) {
    const fx = at(RACE_M);
    if (fx >= STRIP_X + 1 && fx < STRIP_X + STRIP_W - 2) {
      for (let y = STRIP_Y + 1; y < STRIP_Y + STRIP_H - 1; y += 2) {
        ctx.fillStyle = '#080808';
        ctx.fillRect(fx, y, 1, 1);
        ctx.fillRect(fx + 1, y + 1, 1, 1);
        ctx.fillStyle = '#f8f8f0';
        ctx.fillRect(fx + 1, y, 1, 1);
        ctx.fillRect(fx, y + 1, 1, 1);
      }
    }
  }

  iconsReady();
  // A runner's front foot is at their distance; one off the window waits at its edge
  const lo = STRIP_X + 1;
  const hi = STRIP_X + STRIP_W - 1 - RUNNER_W;
  const frameOf = (m: number): number => (calm ? 0 : Math.floor(m / 3) % 2);
  const ax = Math.max(lo, Math.min(hi, at(s.pos) - RUNNER_W));
  if (!s.practice) {
    const rx = Math.max(lo, Math.min(hi, at(s.rivalPos) - RUNNER_W));
    ctx.drawImage(rivalIcons[frameOf(s.rivalPos)]!, rx, STRIP_Y + 2 + LANE_H);
  }
  ctx.drawImage(aishaIcons[frameOf(s.pos)]!, ax, STRIP_Y + 1);
};

/** The KICK (D') gauge: its length is her D' (from the rating), its fill what is left. */
const drawGauge = (ctx: CanvasRenderingContext2D, s: RaceState): void => {
  drawText(ctx, TEXT.gauge, LABEL_X, GAUGE_Y + 1, INK);
  const w = Math.round(GAUGE_MIN_W + GAUGE_SPAN_W * Math.min(1, s.rating));
  ctx.fillStyle = INK;
  ctx.fillRect(GAUGE_X, GAUGE_Y, w, GAUGE_H);
  ctx.fillStyle = GAUGE_BACK;
  ctx.fillRect(GAUGE_X + 1, GAUGE_Y + 1, w - 2, GAUGE_H - 2);
  const share = s.dMax > 0 ? s.d / s.dMax : 0;
  const fill = Math.round((w - 2) * share);
  if (fill > 0) {
    ctx.fillStyle = share > 0.5 ? FILL_HIGH : share > 0.2 ? FILL_MID : FILL_LOW;
    ctx.fillRect(GAUGE_X + 1, GAUGE_Y + 1, fill, GAUGE_H - 2);
  }
  // In the race, what is left in metres of D' (the practice gauge is a toy one)
  if (!s.practice) drawText(ctx, metres(s.d), GAUGE_X + w + 4, GAUGE_Y + 1, INK);
};

const drawStatus = (ctx: CanvasRenderingContext2D, s: RaceState): void => {
  if (s.surging) centred(ctx, TEXT.status.surging, STATUS_Y, GOOD);
  else if (s.faded) centred(ctx, TEXT.status.faded, STATUS_Y, BAD);
  else centred(ctx, s.practice ? TEXT.status.settled : TEXT.status.onPace, STATUS_Y, MUTED);
};

/** The whole race HUD (the prompt above it is the minigame's). `bellOn`: the BELL! cue is lit this frame. */
export const drawRace = (ctx: CanvasRenderingContext2D, s: RaceState, complete: boolean, bellOn: boolean): void => {
  const calm = prefersReducedMotion();
  drawInfo(ctx, s, complete, bellOn);
  drawStrip(ctx, s, calm);
  drawGauge(ctx, s);
  if (!complete) drawStatus(ctx, s);
};

/** The gauge's full width for a rating (for tests: a higher rating draws a longer gauge). */
export const gaugeWidth = (rating: number): number => Math.round(GAUGE_MIN_W + GAUGE_SPAN_W * Math.min(1, rating));

