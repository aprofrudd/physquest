// The screens of the Trace Desk, drawn on chart paper between the plates and the dialogue box. The CLEAN-UP view
// shows one file at a time under its own header plate: the lactate profile as a labelled chart of lactate (mmol/L)
// against treadmill speed (km/h) with the zoom lens beside it, the critical speed trials as a labelled table of
// distance (m), time (min:s) and pace (min:s per km) with critical speed and D prime under it once the file is clean.
// The KEY VARIABLES view shows the slots being filled and the candidates grouped by file. Pure drawing: the
// instrument passes in everything that changes (the desk, the eased numbers, strings it has already built), and
// nothing here allocates per frame.
import { drawText, measureText } from '../../render/PixelFont';
import { PALETTES } from '../../render/Palettes';
import { COLORS, STAGE, drawBrackets, drawCross, drawPanel, drawTick } from '../frame';
import type { DataFileKind } from '../content/types';
import { clockText, secondsPerKm, type Suspect, type TraceDesk } from './model';
import { paceText, partsOf, shortLabel } from './names';
import {
  PAPER,
  drawAxes,
  drawDot,
  drawGrid,
  drawRefLine,
  drawRing,
  drawTrace,
  drawXTicks,
  drawYTicks,
  plotX,
  plotY,
  type DataPoint,
  type Plot,
  type Tick,
} from './chart';
import { LENS_BOX, drawEmptyLens, drawLens } from './lens';

const BORDER = PALETTES.data.colors[1]!;

/** The paper panel: the whole stage between the sport plate and the dialogue box. */
export const PANEL = { x: STAGE.x, y: STAGE.y, w: STAGE.w, h: STAGE.h } as const;

/** Each file's header plate: its own colour, always with its words ("FILE 1/2: LACTATE PROFILE (TREADMILL)"). */
export const PLATE = { x: 9, y: 43, w: 238, h: 11 } as const;
export const PLATE_COLORS: Readonly<Record<DataFileKind, string>> = { lactate: '#1f5f6a', trials: '#6a3a8a' };

/** The top of the KEEP / REMOVE list while a reading waits for a decision: nothing the player must read sits below it. */
export const OPTIONS_TOP = 128;

const rect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) => {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
};

const width = (text: string): number => measureText(text) - 1;

const isRight = (s: Suspect): boolean => s.decision !== null && s.real === (s.decision === 'kept');

const drawPlate = (ctx: CanvasRenderingContext2D, text: string, kind: DataFileKind) => {
  rect(ctx, PLATE.x, PLATE.y, PLATE.w, PLATE.h, COLORS.ink);
  rect(ctx, PLATE.x + 1, PLATE.y + 1, PLATE.w - 2, PLATE.h - 2, PLATE_COLORS[kind]);
  drawText(ctx, text, Math.round(PLATE.x + (PLATE.w - width(text)) / 2), PLATE.y + 2, COLORS.paper);
};

/** KEPT / REMOVED as a word with its symbol on a paper plate (never colour alone). Returns its width. */
const STATUS_KEPT = 'KEPT';
const STATUS_REMOVED = 'REMOVED';
export const statusWidth = (removed: boolean): number => 9 + width(removed ? STATUS_REMOVED : STATUS_KEPT) + 2;
const drawStatus = (ctx: CanvasRenderingContext2D, x: number, y: number, s: Suspect) => {
  const removed = s.decision === 'removed';
  const tone = isRight(s) ? PAPER.goodText : PAPER.badText;
  rect(ctx, x - 1, y - 1, statusWidth(removed) + 1, 9, PAPER.paper);
  if (removed) drawCross(ctx, x, y, tone);
  else drawTick(ctx, x, y, tone);
  drawText(ctx, removed ? STATUS_REMOVED : STATUS_KEPT, x + 9, y, tone);
};

// Where the chart's tags and labels already are (reused every frame): x, y, width, for 9 px tall rows
const placedX = new Array<number>(8).fill(0);
const placedY = new Array<number>(8).fill(0);
const placedW = new Array<number>(8).fill(0);
let placedCount = 0;
const place = (x: number, y: number, w: number) => {
  if (placedCount >= placedX.length) return;
  placedX[placedCount] = x;
  placedY[placedCount] = y;
  placedW[placedCount] = w;
  placedCount++;
};
const collides = (x: number, y: number, w: number): boolean => {
  for (let k = 0; k < placedCount; k++) {
    if (x < placedX[k]! + placedW[k]! + 2 && placedX[k]! < x + w + 2 && y < placedY[k]! + 9 && placedY[k]! < y + 9) return true;
  }
  return false;
};
/** Rows a KEPT / REMOVED label may take, nearest first. */
const LABEL_ROWS: readonly number[] = [0, -9, 9, -18, 18, -27];

/** The "?" tag on the reading waiting for a decision. */
const drawQuery = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
  rect(ctx, x, y, 9, 9, COLORS.ink);
  rect(ctx, x + 1, y + 1, 7, 7, COLORS.gold);
  drawText(ctx, '?', x + 2, y + 1, COLORS.ink);
};

// ---- The lactate chart --------------------------------------------------------------------------------------------

/** Y range (mmol/L) that fits the readings still in the file, in even steps with a little headroom. */
export const yMaxFor = (desk: TraceDesk): number => {
  let top = 0;
  for (const s of desk.stages) if (s.present) top = Math.max(top, s.mmol);
  return Math.ceil(Math.max(desk.content.lactate.lt2Mmol + 2, top * 1.05) / 2) * 2;
};

// yMin sits just under zero, so a reading of 0.0 is drawn clear of the axis
const Y_MIN = -0.5;
export const CLEAN_PLOT: Plot = { x: 31, y: 67, w: 109, h: 35, xMin: 11.5, xMax: 19, yMin: Y_MIN, yMax: 10 };

const fitPlot = (plot: Plot, desk: TraceDesk, yMax: number): Plot => {
  if (desk.stages.length > 0) {
    plot.xMin = desk.stages[0]!.kmh - 0.5;
    plot.xMax = desk.stages[desk.stages.length - 1]!.kmh + 0.6;
  }
  plot.yMax = yMax;
  return plot;
};

/** Pixel x of a stage's speed on the clean-up plot (for the lens band and the instrument's easing). */
export const cleanStageX = (desk: TraceDesk, stageIndex: number): number =>
  plotX(fitPlot(CLEAN_PLOT, desk, CLEAN_PLOT.yMax), desk.stages[stageIndex]?.kmh ?? 0);

/** Axis titles, with their units. */
export const LACTATE_AXIS = 'LACTATE (MMOL/L)';
export const SPEED_AXIS = 'SPEED (KM/H)';

// Text that only changes with the file's own numbers, built once per desk
interface Labels {
  stages: string[];
  plates: string[];
  trialRows: { metres: string; time: string; pace: string }[];
  keyTitle: string[];
}
const labelCache = new WeakMap<TraceDesk, Labels>();
const labelsFor = (desk: TraceDesk): Labels => {
  let labels = labelCache.get(desk);
  if (!labels) {
    const n = desk.files.length;
    labels = {
      stages: desk.stages.map(s => String(s.kmh)),
      plates: desk.files.map((f, i) => `FILE ${i + 1}/${n}: ${f.content.title}`),
      trialRows: desk.trials.map(t => ({ metres: `${t.metres} M`, time: clockText(t.seconds), pace: `${paceText(secondsPerKm(t.metres, t.seconds))}/KM` })),
      keyTitle: Array.from({ length: desk.pinLimit + 1 }, (_, k) => `KEY VARIABLES ${k}/${desk.pinLimit}`),
    };
    labelCache.set(desk, labels);
  }
  return labels;
};

/** The header plate's words for file `f`. */
export const plateText = (desk: TraceDesk, f: number): string => labelsFor(desk).plates[f] ?? '';

// Scratch buffers, reused every frame
const MAX_STAGES = 16;
const trace: DataPoint[] = Array.from({ length: MAX_STAGES }, () => ({ x: 0, y: 0 }));
const xTicks: Tick[] = Array.from({ length: MAX_STAGES }, () => ({ value: 0, label: '' }));
const yTicks: Tick[] = [
  { value: 0, label: '' },
  { value: 0, label: '' },
];
const gridXs: number[] = [];
const gridYs: number[] = [];

/** LT1's lactate on the player's file: the lowest reading plus the rise. */
const lt1Line = (desk: TraceDesk): number => {
  let low = Infinity;
  for (const s of desk.stages) if (s.present) low = Math.min(low, s.mmol);
  return (Number.isFinite(low) ? low : 1) + desk.content.lactate.lt1Rise;
};
const lineLabels = new Map<number, string>();
const lineLabel = (v: number): string => {
  let t = lineLabels.get(v);
  if (t === undefined) {
    t = v.toFixed(1);
    lineLabels.set(v, t);
  }
  return t;
};

const drawLactate = (ctx: CanvasRenderingContext2D, f: CleanupFrame) => {
  const { desk } = f;
  const c = desk.content.lactate;
  const plot = fitPlot(CLEAN_PLOT, desk, f.yMax);
  const current = f.view >= 0 ? desk.suspects[f.view] : undefined;
  const litStage = current && current.place.type === 'stage' ? current.place.index : -1;

  drawText(ctx, LACTATE_AXIS, 10, 57, COLORS.ink);
  // The lens band, behind the line: the stretch of the file under the lens
  if (litStage >= 0) {
    const bx = Math.round(f.bandX);
    rect(ctx, bx - 7, plot.y, 15, plot.h, PAPER.goldPale);
  }
  gridXs.length = 0;
  gridYs.length = 0;
  for (const s of desk.stages) gridXs.push(s.kmh);
  for (let v = 2; v < plot.yMax; v += 2) gridYs.push(v);
  drawGrid(ctx, plot, gridXs, gridYs);
  const low = lt1Line(desk);
  drawRefLine(ctx, plot, low, PAPER.inkSoft);
  drawRefLine(ctx, plot, c.lt2Mmol, PAPER.inkSoft);
  drawAxes(ctx, plot);
  const labels = labelsFor(desk);
  const n = Math.min(desk.stages.length, MAX_STAGES);
  for (let i = 0; i < n; i++) {
    const t = xTicks[i]!;
    t.value = desk.stages[i]!.kmh;
    t.label = labels.stages[i]!;
    t.color = i === litStage ? COLORS.ink : PAPER.inkSoft;
  }
  drawXTicks(ctx, plot, xTicks, n);
  yTicks[0]!.value = low;
  yTicks[0]!.label = lineLabel(Math.round(low * 10) / 10);
  yTicks[1]!.value = c.lt2Mmol;
  yTicks[1]!.label = lineLabel(c.lt2Mmol);
  drawYTicks(ctx, plot, yTicks, 2, COLORS.ink);
  drawText(ctx, SPEED_AXIS, Math.round(plot.x + (plot.w - width(SPEED_AXIS)) / 2), plot.y + plot.h + 12, COLORS.ink);

  // The line through the readings still in the file, then their dots
  let count = 0;
  for (const s of desk.stages) {
    if (!s.present || count >= MAX_STAGES) continue;
    const p = trace[count++]!;
    p.x = s.kmh;
    p.y = s.mmol;
  }
  drawTrace(ctx, plot, trace, count);
  for (const s of desk.stages) if (s.present) drawDot(ctx, plotX(plot, s.kmh), plotY(plot, s.mmol), PAPER.trace);

  // The flagged readings of this file: brackets and "?" on the one waiting; KEPT or REMOVED beside the decided ones
  // (placed clear of each other and of the "?"); a removed reading stays as a grey ring where it was, so the player
  // sees what the line lost
  const file = desk.files[f.file]!;
  placedCount = 0;
  for (let i = file.first; i < file.first + file.count; i++) {
    const s = desk.suspects[i]!;
    const stage = desk.stages[s.place.index]!;
    const x = plotX(plot, stage.kmh);
    const y = Math.max(plot.y + 3, plotY(plot, stage.mmol));
    if (!stage.present) drawRing(ctx, x, y, 3, COLORS.grey);
    if (i === f.view) drawBrackets(ctx, x - 5, y - 5, 11, 11, s.decision === null && f.pulse ? COLORS.ink : COLORS.gold);
    if (s.decision === null && i === f.view) {
      const qy = Math.max(plot.y - 2, y - 16);
      drawQuery(ctx, x - 4, qy);
      place(x - 4, qy, 9);
    }
  }
  for (let i = file.first; i < file.first + file.count; i++) {
    const s = desk.suspects[i]!;
    if (s.decision === null) continue;
    const stage = desk.stages[s.place.index]!;
    const x = plotX(plot, stage.kmh);
    const y = Math.max(plot.y + 3, plotY(plot, stage.mmol));
    const w = statusWidth(s.decision === 'removed');
    // right of the point, else left; level with it, else a row above or below
    let done = false;
    for (const dy of LABEL_ROWS) {
      for (const sx of [x + 5, x - 5 - w]) {
        const sy = y - 3 + dy;
        if (sx < plot.x + 1 || sx + w > plot.x + plot.w || sy < plot.y || sy + 8 > plot.y + plot.h + 1) continue;
        if (collides(sx, sy, w)) continue;
        place(sx, sy, w);
        drawStatus(ctx, sx, sy, s);
        done = true;
        break;
      }
      if (done) break;
    }
  }

  // The lens and the readout under it
  if (current) drawLens(ctx, desk.lens(f.view));
  else drawEmptyLens(ctx);
  drawSideReadout(ctx, f);
};

const READOUT_X = LENS_BOX.x;
const READOUT_Y = LENS_BOX.y + LENS_BOX.h + 4;

const drawSideReadout = (ctx: CanvasRenderingContext2D, f: CleanupFrame) => {
  const b = f.banner;
  if (b) {
    rect(ctx, READOUT_X, READOUT_Y, 2, b.lines.length * 9 - 2, b.good ? COLORS.good : COLORS.bad);
    for (let i = 0; i < b.lines.length; i++) {
      drawText(ctx, b.lines[i]!, READOUT_X + 5, READOUT_Y + i * 9, b.good ? PAPER.goodText : PAPER.badText);
    }
    return;
  }
  for (let i = 0; i < f.readout.length; i++) {
    drawText(ctx, f.readout[i]!, READOUT_X, READOUT_Y + i * 9, i === 0 ? COLORS.ink : PAPER.inkSoft);
  }
};

// ---- The trials table ------------------------------------------------------------------------------------------------

export const TRIALS = { distX: 22, timeX: 76, paceX: 128, statusX: 188, headY: 56, unitY: 65, rowY: 77, pitch: 11, csY: 112, bannerY: 123 } as const;
export const TRIAL_HEADS = ['DISTANCE', 'TIME', 'PACE'] as const;
export const TRIAL_UNITS = ['(M)', '(MIN:S)', '(MIN:S/KM)'] as const;
/** What the CS line says until the trials file is clean. */
export const CS_PENDING = 'CS AND D PRIME: AFTER THE CLEAN-UP';

const drawTrials = (ctx: CanvasRenderingContext2D, f: CleanupFrame) => {
  const { desk } = f;
  const labels = labelsFor(desk);
  const xs = [TRIALS.distX, TRIALS.timeX, TRIALS.paceX];
  for (let k = 0; k < 3; k++) {
    drawText(ctx, TRIAL_HEADS[k]!, xs[k]!, TRIALS.headY, COLORS.ink);
    drawText(ctx, TRIAL_UNITS[k]!, xs[k]!, TRIALS.unitY, PAPER.inkSoft);
  }
  rect(ctx, 10, TRIALS.unitY + 9, 236, 1, PAPER.inkSoft);
  const file = desk.files[f.file]!;
  for (let i = 0; i < desk.trials.length; i++) {
    const t = desk.trials[i]!;
    const y = TRIALS.rowY + i * TRIALS.pitch;
    const row = labels.trialRows[i]!;
    const ink = t.present ? COLORS.ink : COLORS.grey;
    drawText(ctx, row.metres, TRIALS.distX, y, ink);
    drawText(ctx, row.time, TRIALS.timeX, y, ink);
    drawText(ctx, row.pace, TRIALS.paceX, y, ink);
    if (!t.present) rect(ctx, TRIALS.distX, y + 3, TRIALS.paceX + width(row.pace) - TRIALS.distX, 1, COLORS.grey);
  }
  for (let i = file.first; i < file.first + file.count; i++) {
    const s = desk.suspects[i]!;
    const y = TRIALS.rowY + s.place.index * TRIALS.pitch;
    if (i === f.view) drawBrackets(ctx, TRIALS.distX - 4, y - 3, TRIALS.statusX - TRIALS.distX, 13, s.decision === null && f.pulse ? COLORS.ink : COLORS.gold);
    if (s.decision === null) {
      if (i === f.view) drawQuery(ctx, 10, y - 1);
    } else {
      drawStatus(ctx, TRIALS.statusX, y, s);
    }
  }
  drawText(ctx, f.csLine, 10, TRIALS.csY, f.csLine === CS_PENDING ? PAPER.inkSoft : COLORS.ink);
  const b = f.banner;
  if (b) {
    rect(ctx, 10, TRIALS.bannerY, 2, b.lines.length * 9 - 2, b.good ? COLORS.good : COLORS.bad);
    for (let i = 0; i < b.lines.length; i++) drawText(ctx, b.lines[i]!, 15, TRIALS.bannerY + i * 9, b.good ? PAPER.goodText : PAPER.badText);
  } else {
    for (let i = 0; i < f.readout.length; i++) drawText(ctx, f.readout[i]!, 10, TRIALS.bannerY - 2 + i * 9, PAPER.inkSoft);
  }
};

// ---- Clean-up -----------------------------------------------------------------------------------------------------

export interface Banner {
  /** The verdict wrapped to its column. */
  lines: readonly string[];
  good: boolean;
}

export interface CleanupFrame {
  desk: TraceDesk;
  /** Which file is shown (an index into desk.files). */
  file: number;
  /** Which suspect the player is on; -1 while a file's intro is read. */
  view: number;
  /** The y range shown, eased toward the file's own. */
  yMax: number;
  /** The lens band's centre x in pixels, eased. */
  bandX: number;
  /** What the readout says while a reading waits (lactate: beside the chart; trials: under the table). */
  readout: readonly string[];
  /** The verdict, once the reading is decided. */
  banner: Banner | null;
  /** The marks on the reading waiting for a decision swap colour on this beat (off under reduced motion). */
  pulse: boolean;
  /** The trials file's CS and D prime line (CS_PENDING until the file is clean). */
  csLine: string;
}

export const drawCleanup = (ctx: CanvasRenderingContext2D, f: CleanupFrame) => {
  const { desk } = f;
  drawPanel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, BORDER);
  const file = desk.files[f.file];
  if (!file) return;
  drawPlate(ctx, plateText(desk, f.file), file.kind);
  if (file.kind === 'lactate') drawLactate(ctx, f);
  else drawTrials(ctx, f);
};

// ---- Key variables ---------------------------------------------------------------------------------------------------

export type RevealMark = 'key' | 'notkey' | 'missed';

export interface PinFrame {
  desk: TraceDesk;
  /** The list cursor: a row index, or the number of rows for LOCK IN. */
  cursor: number;
  /** After lock-in: how each variable was judged so far, by variable index. */
  marks: ReadonlyArray<RevealMark | undefined>;
  locked: boolean;
  /** Which variable the dialogue is explaining during the reveal (-1 none). */
  explaining: number;
}

/** The KEY VARIABLES panel at the top, its slots, and the list under it. */
export const KEYS = { x: 9, y: 43, w: 238, titleY: 45, slotY: 55, slotPitch: 10, slotW: 116, slotH: 9 } as const;
export const LIST_Y = 77;
export const ROW_H = 8;
export const LOCK_TEXT = 'LOCK IN';

/** A chosen variable's slot text: its short name and its value with the unit, e.g. "LT2 3:34/KM". */
const slotTexts = new Map<string, string>();
export const slotText = (shown: string): string => {
  let t = slotTexts.get(shown);
  if (t === undefined) {
    const parts = partsOf(shown);
    const unit = parts.tail.replace(/[)?]/g, '').trim();
    const glue = parts.tail.startsWith('/') ? '' : ' ';
    t = `${shortLabel(shown)} ${parts.value}${unit ? glue + unit : ''}`.toUpperCase();
    slotTexts.set(shown, t);
  }
  return t;
};

/** Where each row (and each file's heading) sits in the list, by the desk's row order. */
export interface ListLayout {
  /** Row index -> y. */
  rowY: number[];
  /** Headings: text and y. */
  heads: { text: string; y: number }[];
}
const layoutCache = new WeakMap<TraceDesk, ListLayout>();
export const listLayout = (desk: TraceDesk): ListLayout => {
  let layout = layoutCache.get(desk);
  if (!layout) {
    const rows = desk.rows();
    const rowY: number[] = [];
    const heads: { text: string; y: number }[] = [];
    let y = LIST_Y;
    let last: DataFileKind | null = null;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]!;
      if (r.file !== last) {
        heads.push({ text: (r.file === 'lactate' ? desk.content.lactate : desk.content.trials).group, y });
        y += ROW_H;
        last = r.file;
      }
      rowY.push(y);
      y += ROW_H;
    }
    layout = { rowY, heads };
    layoutCache.set(desk, layout);
  }
  return layout;
};

const MARK_TEXT: Record<RevealMark, string> = { key: 'KEY', notkey: 'NOT KEY', missed: 'MISSED' };

export const drawPin = (ctx: CanvasRenderingContext2D, f: PinFrame) => {
  const { desk } = f;
  drawPanel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, BORDER);
  const rows = desk.rows();
  const pins = desk.pins();
  const labels = labelsFor(desk);

  // The KEY VARIABLES panel: its count, LOCK IN, and one slot per key variable, filled in the order chosen
  rect(ctx, KEYS.x, KEYS.y, KEYS.w, 31, COLORS.ink);
  rect(ctx, KEYS.x + 1, KEYS.y + 1, KEYS.w - 2, 29, '#ffffff');
  drawText(ctx, labels.keyTitle[pins.length] ?? '', KEYS.x + 4, KEYS.titleY, COLORS.ink);
  const onLock = f.cursor === rows.length && !f.locked;
  const lockX = KEYS.x + KEYS.w - 6 - width(LOCK_TEXT);
  if (onLock) {
    rect(ctx, lockX - 10, KEYS.titleY - 1, width(LOCK_TEXT) + 13, 9, COLORS.inkSoft);
    drawText(ctx, '>', lockX - 8, KEYS.titleY, COLORS.paper);
  }
  if (desk.canLock() || onLock) drawText(ctx, LOCK_TEXT, lockX, KEYS.titleY, onLock ? COLORS.paper : COLORS.ink);
  for (let k = 0; k < desk.pinLimit; k++) {
    const sx = KEYS.x + 2 + (k % 2) * (KEYS.slotW + 2);
    const sy = KEYS.slotY + Math.floor(k / 2) * KEYS.slotPitch;
    const variable = pins[k];
    const row = variable === undefined ? undefined : rows.find(r => r.variable === variable);
    if (row) {
      rect(ctx, sx, sy - 1, KEYS.slotW, KEYS.slotH, COLORS.blue);
      drawText(ctx, slotText(row.shown), sx + 2, sy, COLORS.paper);
    } else {
      for (let i = 0; i < KEYS.slotW; i += 4) {
        rect(ctx, sx + i, sy - 1, 2, 1, PAPER.inkSoft);
        rect(ctx, sx + i, sy + KEYS.slotH - 2, 2, 1, PAPER.inkSoft);
      }
      drawText(ctx, '---', sx + 2, sy, PAPER.inkSoft);
    }
  }

  // The candidates, under their file's heading
  const layout = listLayout(desk);
  for (const head of layout.heads) drawText(ctx, head.text, 12, head.y, PAPER.inkSoft);
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]!;
    const y = layout.rowY[i]!;
    const sel = i === f.cursor && !f.locked;
    if (r.variable === f.explaining) rect(ctx, 9, y - 1, 238, ROW_H, PAPER.goldPale);
    if (sel) {
      rect(ctx, 9, y - 1, 238, ROW_H, COLORS.inkSoft);
      drawText(ctx, '>', 12, y, COLORS.paper);
    }
    // Check box: a blue tick when chosen
    rect(ctx, 22, y, 7, 7, sel ? COLORS.paper : COLORS.inkSoft);
    rect(ctx, 23, y + 1, 5, 5, r.pinned ? COLORS.blue : PAPER.paper);
    if (r.pinned) drawTick(ctx, 22, y, COLORS.paper);
    drawText(ctx, r.shown, 34, y, sel ? COLORS.paper : r.odd ? PAPER.badText : COLORS.ink);

    const mark = f.marks[r.variable];
    if (mark) {
      const text = MARK_TEXT[mark];
      const tone = mark === 'key' ? COLORS.good : mark === 'notkey' ? COLORS.bad : COLORS.gold;
      const x = 244 - width(text);
      if (mark === 'notkey') drawCross(ctx, x - 9, y, tone);
      else if (mark === 'missed') drawText(ctx, '!', x - 8, y, '#8a6a00');
      else drawTick(ctx, x - 9, y, tone);
      drawText(ctx, text, x, y, mark === 'missed' ? COLORS.ink : tone);
    } else if (r.pinned) {
      drawText(ctx, 'KEY', 244 - width('KEY'), y, sel ? '#a8c8f8' : COLORS.blue);
    }
  }
};
