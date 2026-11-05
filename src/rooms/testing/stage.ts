// The test stage: the window the Testing Lab shows between the plates and the dialogue box. It is drawn from
// plain data (a "view"), never from the model, so the same functions draw the pick screen, the calendar, the
// run and the printout, and a gallery script can draw any moment. Layout is in game pixels; text is the
// game's 5x7 font. Nothing is allocated per frame: scratch objects are reused and text is wrapped once.
import { drawText, measureText } from '../../render/PixelFont';
import { wrapText } from '../../render/DialogueBox';
import { CHIP_H, COLORS, drawChip } from '../frame';
import type { EffortShape, TestCard } from '../content/types';
import { C, LABX, TILE_ART, fill, paintFloor, paintGrid } from './kit';
import { ALERT, CROSS, TICK } from './icons';
import { AISHA_COLORS, HIPS_RIGHT, STAND_RIGHT } from './people';
import { PREVIEW_SECONDS, SCENES, previewU, type Area, type SceneClock } from './scenes';
import { calmPreviewU, clamp01, effortProfile, profileColumns, readoutAt, trialCountOf } from './timeline';
import { PRINTOUT_SECONDS, REBOOK_SECONDS, WEEKDAYS, type PrintoutLines } from './model';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Height of the band across the top of the window (the needs line, or the test's name). */
export const BAND_H = 11;

/** The stage window in the pick screen: from the plates down to just above the list. */
export const pickWindow = (listTop: number): Rect => ({ x: 4, y: 38, w: 248, h: listTop - 2 - 38 });

/** The stage window in the run and the printout: the whole stage above the dialogue box. */
export const runWindow: Rect = { x: 4, y: 38, w: 248, h: 124 };

const color = (index: number): string => LABX[index] ?? '#000';

// ---- the window ------------------------------------------------------------------------------------------------------

// Scratch objects, refilled for each draw (the stage draws one window at a time)
const viewport: Rect = { x: 0, y: 0, w: 0, h: 0 };
const sceneArea: Area = { x: 0, y: 0, w: 0, h: 0 };
const clock: SceneClock = { t: 0, u: 0, seconds: 0, shaky: false, calm: false, stages: 0, trials: 0, large: false };

/** Draw the window's frame and floor, and set `viewport` to the floor's rectangle inside it. */
const drawWindow = (ctx: CanvasRenderingContext2D, r: Rect): Rect => {
  fill(ctx, C.outline, r.x, r.y, r.w, r.h);
  fill(ctx, C.dark, r.x + 1, r.y + 1, r.w - 2, r.h - 2);
  viewport.x = r.x + 4;
  viewport.y = r.y + BAND_H;
  viewport.w = r.w - 8;
  viewport.h = r.h - BAND_H - 3;
  fill(ctx, C.outline, viewport.x - 1, viewport.y - 1, viewport.w + 2, viewport.h + 2);
  paintFloor(ctx, viewport.x, viewport.y, viewport.w, viewport.h);
  return viewport;
};

/** One line in the band: a gold lead and a white rest, centred (leaving `right` pixels free at the right). */
const drawBandText = (ctx: CanvasRenderingContext2D, r: Rect, lead: string, rest: string, right = 0) => {
  const total = measureText(lead) + measureText(rest) - 1;
  const x = Math.round(r.x + (r.w - right - total) / 2);
  drawText(ctx, lead, x, r.y + 2, color(C.gold));
  drawText(ctx, rest, x + measureText(lead), r.y + 2, COLORS.paper);
};

/** Clip drawing to a rectangle until `unclip`. */
const clipTo = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
};
const unclip = (ctx: CanvasRenderingContext2D) => ctx.restore();

/** The lab's back wall as a strip 240 wide: cabinets, the board, a monitor, the window, the clock. */
const WALL_ROW = [
  'cabinet', 'cabinet', 'boardLeft', 'boardRight', 'wall', 'monitorLeft', 'monitorRight', 'wall', 'windowLeft', 'windowRight', 'clock', 'cabinet', 'cabinet', 'wall', 'wall',
] as const;

const drawWallStrip = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
  for (let i = 0; i < WALL_ROW.length; i++) paintGrid(ctx, TILE_ART[WALL_ROW[i] ?? 'wall'], x + i * 16, y);
};

/** Fill `clock` for a scene and return it. */
const sceneClock = (card: TestCard, t: number, u: number, seconds: number, shaky: boolean, calm: boolean, stages: number, large: boolean): SceneClock => {
  clock.t = t;
  clock.u = u;
  clock.seconds = seconds;
  clock.shaky = shaky;
  clock.calm = calm;
  clock.stages = stages;
  clock.trials = trialsOf(card);
  clock.large = large;
  return clock;
};

const areaAt = (x: number, y: number, w: number, h: number): Area => {
  sceneArea.x = x;
  sceneArea.y = y;
  sceneArea.w = w;
  sceneArea.h = h;
  return sceneArea;
};

// ---- the effort chart -----------------------------------------------------------------------------------------------

const trialCounts = new WeakMap<TestCard, number>();

/** How many separate efforts a card's test has (read from its chips once). */
export const trialsOf = (card: TestCard): number => {
  let n = trialCounts.get(card);
  if (n === undefined) {
    n = trialCountOf(card.chips);
    trialCounts.set(card, n);
  }
  return n;
};

const profiles = new Map<string, number[]>();

/** The chart's values, worked out once per shape. */
const profileFor = (shape: EffortShape, steps: number, trials: number): number[] => {
  const key = `${shape}|${steps}|${trials}`;
  let profile = profiles.get(key);
  if (!profile) {
    profile = effortProfile(shape, steps, trials);
    profiles.set(key, profile);
  }
  return profile;
};

/**
 * The effort chart: one bar per column, from the baseline up. The current column is gold; `until` (0-1) hides
 * the columns beyond it (a run drawing itself). A shuttle test ends in a cross: she stopped.
 */
const drawEffortChart = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  h: number,
  shape: EffortShape,
  steps: number,
  trials: number,
  u: number,
  until: number,
  columnW: number,
  unsteady = 0,
) => {
  const profile = profileFor(shape, steps, trials);
  const n = profile.length;
  const current = Math.min(n - 1, Math.floor(u * n));
  const base = y + h;
  for (let i = 0; i < n; i++) {
    if (i / n > until) break;
    const v = profile[i] ?? 0;
    // shaky data: each bar is a pixel out, in a pattern that shifts a few times a second
    const wobble = unsteady > 0 && v > 0 ? ((i * 5 + unsteady) % 3) - 1 : 0;
    const bar = Math.max(v > 0 ? 1 : 0, Math.round(v * (h - 2)) + wobble);
    const bx = x + i * columnW;
    if (bar > 0) {
      fill(ctx, i === current ? C.gold : C.mid, bx, base - bar, columnW, bar);
      fill(ctx, i === current ? C.white : C.light, bx, base - bar, columnW, 1);
    } else if (shape === 'shuttles' && i === n - 4) {
      // the staircase stops: a cross where the next step would be
      for (let k = 0; k < 5; k++) {
        fill(ctx, C.red, bx + k * 2, base - 10 + k * 2, 2, 2);
        fill(ctx, C.red, bx + 8 - k * 2, base - 10 + k * 2, 2, 2);
      }
    }
  }
  fill(ctx, C.outline, x - 1, base, n * columnW + 2, 1);
  fill(ctx, C.outline, x - 1, y, 1, h + 1);
};

// ---- the pick screen's window -------------------------------------------------------------------------------------------

export interface PickView {
  window: Rect;
  /** "AISHA NEEDS: " and what she needs. */
  lead: string;
  needs: string;
  card: TestCard;
  /** Seconds the highlighted test has been playing (the preview loops from its start). */
  clock: number;
  calm: boolean;
  stages: number;
}

/** The right-hand column of the pick window (the chart and what the test gives), and how many characters a line of it holds. */
const CHART_COLUMN_W = 84;
const GIVES_CHARS = 14;

const gives = new WeakMap<TestCard, string[]>();

/** "GIVES: ..." wrapped to the right-hand column, once per card. */
export const givesLinesOf = (card: TestCard): string[] => {
  let lines = gives.get(card);
  if (!lines) {
    lines = wrapText(`GIVES: ${card.gives}`, GIVES_CHARS);
    gives.set(card, lines);
  }
  return lines;
};

export const drawPickStage = (ctx: CanvasRenderingContext2D, view: PickView): void => {
  const { window: r, card } = view;
  const vp = drawWindow(ctx, r);
  drawBandText(ctx, r, view.lead, view.needs);

  const u = view.calm ? calmPreviewU(card.shape) : previewU(view.clock);
  const leftW = vp.w - CHART_COLUMN_W - 6;
  clipTo(ctx, vp.x, vp.y, leftW, vp.h);
  SCENES[card.kit](ctx, areaAt(vp.x, vp.y, leftW, 40), sceneClock(card, view.clock, u, PREVIEW_SECONDS, false, view.calm, view.stages, false));
  unclip(ctx);

  // what the test is made of: three chips under the scene
  let cx = vp.x + 1;
  const chipY = vp.y + vp.h - CHIP_H - 1;
  for (let i = 0; i < card.chips.length; i++) {
    const chip = card.chips[i];
    if (chip) cx += drawChip(ctx, cx, chipY, chip, COLORS.ink, color(C.light), COLORS.ink) + 3;
  }

  // the chart and what the test gives, on a plain panel so the words are not over the floor's grid
  const right = vp.x + vp.w - CHART_COLUMN_W;
  fill(ctx, C.outline, right - 4, vp.y, 1, vp.h);
  fill(ctx, C.white, right - 3, vp.y, CHART_COLUMN_W + 3, vp.h);
  // words start 2 px in from the divider, so a full line of 14 characters still ends 2 px short of the frame
  const textX = right - 1;
  drawText(ctx, 'EFFORT', textX, vp.y + 2, color(C.dark));
  const trials = trialsOf(card);
  const columnW = Math.min(4, Math.floor((CHART_COLUMN_W - 8) / profileColumns(card.shape, view.stages)));
  drawEffortChart(ctx, textX + 3, vp.y + 11, 20, card.shape, view.stages, trials, u, 1, columnW);
  const lines = givesLinesOf(card);
  for (let i = 0; i < Math.min(2, lines.length); i++) {
    const line = lines[i] ?? '';
    // two clear pixels between the lines (a 9 px pitch for 7 px letters), and the last one 3 px above the window's floor
    const lineY = vp.y + 35 + i * 9;
    if (i === 0 && line.startsWith('GIVES: ')) {
      drawText(ctx, 'GIVES:', textX, lineY, color(C.dark));
      drawText(ctx, line.slice(6), textX + 36, lineY, COLORS.ink);
    } else {
      drawText(ctx, line, textX, lineY, COLORS.ink);
    }
  }
};

// ---- test day: the calendar --------------------------------------------------------------------------------------------

export interface CheckView {
  window: Rect;
  lead: string;
  needs: string;
  /** The test she is about to do, and its name in capitals for the plate. */
  card: TestCard;
  plate: string;
  clock: number;
  calm: boolean;
  stages: number;
  /** Weekday of test day (0 = MON). */
  day: number;
  /** The player has called it: the run goes ahead on a bad day. */
  shaky: boolean;
  /** The player re-booked: the calendar moves on, `flip` seconds in. */
  rebooked: boolean;
  flip: number;
  /** A call has been made at all (so she is no longer waiting for one). */
  answered: boolean;
}

/** How a calendar page looks while it turns: its height as a share of full, and which day it shows. */
export interface CalendarAt {
  scale: number;
  day: number;
  stamp: boolean;
}

/** The page turns twice (each a squash and a stretch, the day changing at the thin point), then RE-BOOKED is stamped. */
export const calendarAt = (day: number, rebooked: boolean, flip: number, out: CalendarAt = { scale: 1, day, stamp: false }): CalendarAt => {
  out.scale = 1;
  out.day = day;
  out.stamp = false;
  if (!rebooked) return out;
  const p = clamp01(flip / REBOOK_SECONDS);
  const turn = (from: number, to: number, k: number): boolean => {
    if (p < from || p >= to) return false;
    const q = (p - from) / (to - from);
    out.scale = Math.abs(Math.cos(q * Math.PI));
    out.day = day + k + (q < 0.5 ? 0 : 1);
    return true;
  };
  if (turn(0.12, 0.48, 0) || turn(0.48, 0.84, 1)) return out;
  out.day = day + (p < 0.12 ? 0 : p < 0.84 ? 1 : 2);
  out.stamp = p >= 0.84;
  return out;
};

const calendar: CalendarAt = { scale: 1, day: 0, stamp: false };

/** The calendar page's size. */
const CAL_W = 64;
const CAL_H = 46;
const PAGE_TITLE = 'TEST DAY';
/** Above this share of its height the page is whole and shows its words; below it, it is a blank page turning edge-on. */
const PAGE_WHOLE = 0.94;

const drawCalendar = (ctx: CanvasRenderingContext2D, x: number, y: number, view: CheckView) => {
  const { day, stamp } = calendarAt(view.day, view.rebooked, view.flip, calendar);
  const scale = view.calm ? 1 : calendar.scale; // reduced motion: the page does not squash, the day just changes
  const whole = scale >= PAGE_WHOLE;
  const shown = Math.max(4, Math.round(CAL_H * scale));
  const top = y + Math.round((CAL_H - shown) / 2);
  fill(ctx, C.outline, x, top, CAL_W, shown);
  fill(ctx, C.white, x + 1, top + 1, CAL_W - 2, shown - 2);
  fill(ctx, C.red, x + 1, top + 1, CAL_W - 2, Math.max(1, Math.min(11, Math.round(11 * scale))));
  if (whole) {
    // words and the week only on a whole page: a squashed one would cut them in half
    drawText(ctx, PAGE_TITLE, x + Math.round((CAL_W - (measureText(PAGE_TITLE) - 1)) / 2), top + 3, COLORS.paper);
    const label = WEEKDAYS[Math.min(WEEKDAYS.length - 1, day)] ?? '';
    drawText(ctx, label, x + Math.round((CAL_W - (measureText(label, 2) - 2)) / 2), top + 15, COLORS.ink, 2);
    // the week below: today's square is gold
    for (let k = 0; k < 7; k++) {
      fill(ctx, C.outline, x + 8 + k * 7, top + CAL_H - 9, 6, 6);
      fill(ctx, k === day ? C.gold : C.cream, x + 9 + k * 7, top + CAL_H - 8, 4, 4);
    }
  }
  // binder rings, which go with the page
  fill(ctx, C.outline, x + 15, top - 2, 3, 5);
  fill(ctx, C.outline, x + CAL_W - 18, top - 2, 3, 5);
  if (stamp) {
    const sw = measureText('RE-BOOKED') - 1 + 6; // a border, two clear pixels and the word
    const sx = x + Math.round((CAL_W - sw) / 2);
    fill(ctx, C.red, sx, y + 30, sw, 13);
    fill(ctx, C.white, sx + 1, y + 31, sw - 2, 11);
    drawText(ctx, 'RE-BOOKED', sx + 3, y + 34, color(C.red));
  }
};

export const drawCheckStage = (ctx: CanvasRenderingContext2D, view: CheckView): void => {
  const { window: r, card } = view;
  const vp = drawWindow(ctx, r);
  drawBandText(ctx, r, view.lead, view.needs);

  drawCalendar(ctx, vp.x + 4, vp.y + 5, view);

  // Aisha waits, breathing; if the test goes ahead on a bad day she shows it
  const ground = vp.y + vp.h - 4;
  const ax = vp.x + 72;
  const breathe = view.calm ? 0 : Math.floor(view.clock * 1.6) % 2;
  const sprite = (view.shaky ? HIPS_RIGHT[1] : HIPS_RIGHT[breathe]) ?? STAND_RIGHT;
  paintGrid(ctx, sprite, ax, ground - 15, AISHA_COLORS);
  if (view.shaky && (view.calm || Math.floor(view.clock * 3) % 2 === 0)) paintGrid(ctx, ALERT, ax + 5, ground - 28);
  else if (!view.answered) {
    // she is about to say how she is: a speech bubble
    fill(ctx, C.outline, ax + 8, ground - 31, 14, 9);
    fill(ctx, C.white, ax + 9, ground - 30, 12, 7);
    fill(ctx, C.outline, ax + 10, ground - 22, 2, 2);
    for (let k = 0; k < 3; k++) fill(ctx, C.dark, ax + 11 + k * 3, ground - 27, 2, 2);
  }

  // the test she is here for, waiting on its kit: faded, so it reads as the plan and not as a second Aisha
  const kitX = vp.x + 94;
  const kitW = vp.w - 96;
  clipTo(ctx, kitX, vp.y, kitW, vp.h);
  ctx.globalAlpha = 0.45;
  SCENES[card.kit](ctx, areaAt(kitX, vp.y, kitW, 42), sceneClock(card, view.clock, 0, PREVIEW_SECONDS, false, true, view.stages, false));
  ctx.globalAlpha = 1;
  unclip(ctx);
  const labelW = measureText(view.plate) - 1;
  const labelX = kitX + Math.round((kitW - labelW) / 2);
  fill(ctx, C.outline, labelX - 3, vp.y + vp.h - 12, labelW + 6, 11);
  fill(ctx, C.white, labelX - 2, vp.y + vp.h - 11, labelW + 4, 9);
  drawText(ctx, view.plate, labelX, vp.y + vp.h - 10, color(C.dark));
};

// ---- the run ----------------------------------------------------------------------------------------------------------------------

export interface RunView {
  window: Rect;
  card: TestCard;
  /** The test's name in capitals, for the band. */
  title: string;
  /** Seconds on the stage clock. */
  clock: number;
  /** How far through the run (0-1). */
  u: number;
  /** The test is running on a day she should have been re-booked. */
  shaky: boolean;
  calm: boolean;
  stages: number;
}

const SHAKY_TAG = 'SHAKY';

/** The red SHAKY tag at the right of the band: a word and a mark, never colour alone. */
const drawShakyTag = (ctx: CanvasRenderingContext2D, r: Rect) => {
  const w = measureText(SHAKY_TAG) - 1 + 16;
  const x = r.x + r.w - w - 5;
  fill(ctx, C.outline, x, r.y + 1, w, 9);
  fill(ctx, C.red, x + 1, r.y + 2, w - 2, 7);
  drawText(ctx, '!', x + 3, r.y + 2, COLORS.paper);
  drawText(ctx, SHAKY_TAG, x + 11, r.y + 2, COLORS.paper);
};

export const drawRunStage = (ctx: CanvasRenderingContext2D, view: RunView): void => {
  const { window: r, card } = view;
  const vp = drawWindow(ctx, r);
  drawBandText(ctx, r, 'RUNNING: ', view.title, view.shaky ? 48 : 0);
  if (view.shaky) drawShakyTag(ctx, r);

  const trials = trialsOf(card);
  clipTo(ctx, vp.x, vp.y, vp.w, vp.h);
  drawWallStrip(ctx, vp.x, vp.y);
  SCENES[card.kit](ctx, areaAt(vp.x, vp.y + 18, vp.w, 46), sceneClock(card, view.clock, view.u, 5, view.shaky, view.calm, view.stages, true));

  // the protocol readout (no numbers beyond the counters) and the effort chart drawing itself, on a plain panel
  const top = vp.y + 66;
  fill(ctx, C.outline, vp.x, top, vp.w, 1);
  fill(ctx, C.white, vp.x, top + 1, vp.w, vp.h);
  const readout = readoutAt(card.shape, view.u, { stages: view.stages, trials });
  const cut = readout.indexOf(' OF ');
  const big = cut < 0 ? readout : readout.slice(0, cut);
  drawText(ctx, big, vp.x + 10, top + 15, color(C.dark), 2);
  if (cut >= 0) drawText(ctx, readout.slice(cut + 1), vp.x + 10 + measureText(big, 2) + 2, top + 22, color(C.dark));
  const columns = profileColumns(card.shape, view.stages);
  const columnW = Math.max(1, Math.min(5, Math.floor(112 / columns)));
  const chartX = vp.x + vp.w - columns * columnW - 12;
  drawText(ctx, 'EFFORT', chartX, top + 4, color(C.dark));
  drawEffortChart(ctx, chartX, top + 14, 26, card.shape, view.stages, trials, view.u, view.u, columnW, view.shaky ? (view.calm ? 1 : 1 + Math.floor(view.clock * 6)) : 0);
  unclip(ctx);
};

// ---- the printout -----------------------------------------------------------------------------------------------------------------

export interface PrintoutView {
  window: Rect;
  calm: boolean;
  lines: PrintoutLines;
  /** Seconds since the printout started sliding out. */
  slide: number;
}

export const drawPrintoutStage = (ctx: CanvasRenderingContext2D, view: PrintoutView): void => {
  const { window: r, lines } = view;
  const vp = drawWindow(ctx, r);
  drawBandText(ctx, r, 'DONE: ', lines.testName);

  clipTo(ctx, vp.x, vp.y, vp.w, vp.h);
  drawWallStrip(ctx, vp.x, vp.y);

  // the printer along the bottom, the paper coming up out of its slot
  const ground = vp.y + vp.h - 1;
  const printerY = ground - 18;
  const slotY = printerY + 4;
  const cardW = 196;
  const cardX = vp.x + Math.round((vp.w - cardW) / 2);
  const finalTop = vp.y + 5;
  const p = view.calm ? 1 : clamp01(view.slide / PRINTOUT_SECONDS);
  const eased = 1 - (1 - p) * (1 - p);
  const top = Math.round(slotY - 4 - (slotY - 4 - finalTop) * eased);
  fill(ctx, C.outline, cardX, top, cardW, slotY - top);
  fill(ctx, C.white, cardX + 1, top + 1, cardW - 2, slotY - top - 1);
  // tractor holes down both edges, like printer paper
  for (let y = top + 4; y < slotY - 3; y += 6) {
    fill(ctx, C.grey, cardX + 3, y, 2, 2);
    fill(ctx, C.grey, cardX + cardW - 5, y, 2, 2);
  }
  const lineX = cardX + 12;
  let y = top + 6;
  drawText(ctx, lines.title, cardX + Math.round((cardW - (measureText(lines.title) - 1)) / 2), y, color(C.dark));
  fill(ctx, C.light, cardX + 12, y + 9, cardW - 24, 1);
  y += 13;
  // each test: a tick when it gives the Data Lab a file, a cross when not, then what it records
  for (const test of lines.tests) {
    paintGrid(ctx, test.good ? TICK : CROSS, lineX, y - 1);
    drawText(ctx, test.name, lineX + 13, y, COLORS.ink);
    y += 10;
    drawText(ctx, test.records, lineX + 13, y, color(C.dark));
    y += 11;
  }
  if (lines.shaky) {
    paintGrid(ctx, ALERT, lineX, y - 1);
    drawText(ctx, lines.shaky, lineX + 11, y + 1, color(C.red));
    y += 12;
  }
  // the verdict, on a strip: green and a tick for every right test, cream and a warning for some, red and a cross for none
  const stripW = cardW - 24;
  const tone = lines.verdictTone;
  fill(ctx, C.outline, lineX, y, stripW, 15);
  fill(ctx, tone === 'full' ? C.paleGreen : tone === 'partial' ? C.cream : C.paleRed, lineX + 1, y + 1, stripW - 2, 13);
  paintGrid(ctx, tone === 'full' ? TICK : tone === 'partial' ? ALERT : CROSS, lineX + 5, y + 3);
  drawText(ctx, lines.verdict, lineX + 20, y + 4, COLORS.ink);

  // printer body over the bottom of the paper
  fill(ctx, C.outline, vp.x + 20, printerY, vp.w - 40, 19);
  fill(ctx, C.mid, vp.x + 21, printerY + 1, vp.w - 42, 17);
  fill(ctx, C.light, vp.x + 21, printerY + 1, vp.w - 42, 2);
  fill(ctx, C.outline, vp.x + 30, slotY, vp.w - 60, 3);
  fill(ctx, C.dark, vp.x + 21, printerY + 9, vp.w - 42, 9);
  fill(ctx, C.green, vp.x + 28, printerY + 12, 3, 3);
  fill(ctx, C.gold, vp.x + 34, printerY + 12, 3, 3);
  unclip(ctx);
};
