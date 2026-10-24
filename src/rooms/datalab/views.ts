// The two screens of the Trace Desk, drawn on chart paper between the plates and the dialogue box:
// the CLEAN-UP view (the file with its flagged readings, the lens, the sprint runs) and the PIN view (the cleaned
// file beside the speed ladder, with the list of variables under it). Pure drawing: the instrument passes in
// everything that changes (the desk, the eased numbers, strings it has already built), and nothing here
// allocates per frame.
import { drawText, measureText } from '../../render/PixelFont';
import { PALETTES } from '../../render/Palettes';
import { COLORS, STAGE, drawBrackets, drawCross, drawPanel, drawTick } from '../frame';
import type { StagePoint, Suspect, TraceDesk } from './model';
import type { FeatureKind } from './names';
import {
  PAPER,
  drawAxes,
  drawDot,
  drawDrop,
  drawGrid,
  drawRefLine,
  drawRing,
  drawTag,
  drawTrace,
  drawVLine,
  drawXTicks,
  drawYTicks,
  plotX,
  plotY,
  type DataPoint,
  type Plot,
  type Tick,
} from './chart';
import { drawEmptyLens, drawLens } from './lens';
import { drawLadder, type LadderMarks, type Rung } from './ladder';

const BORDER = PALETTES.data.colors[1]!;

/** The paper panel: the whole stage between the sport plate and the dialogue box (the same 2px gap the choice lists leave). */
export const PANEL = { x: STAGE.x, y: STAGE.y, w: STAGE.w, h: STAGE.h } as const;
const INNER_X = 8;

const rect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) => {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
};

const isRight = (s: Suspect): boolean => s.decision !== null && s.real === (s.decision === 'kept');

// ---- The lactate plot ---------------------------------------------------------------------------------------------

/** Y range (mmol/L) that fits the readings still in the file, in even steps with a little headroom. */
export const yMaxFor = (desk: TraceDesk): number => {
  let top = 0;
  for (const s of desk.stages) if (s.present) top = Math.max(top, s.mmol);
  return Math.ceil(Math.max(desk.content.lt2Mmol + 2, top * 1.05) / 2) * 2;
};

/** Pixel x of a stage's speed on the clean-up plot (for the lens band and the instrument's easing). */
export const cleanStageX = (desk: TraceDesk, stageIndex: number): number => plotX(fitPlot(CLEAN_PLOT, desk, CLEAN_PLOT.yMax), desk.stages[stageIndex]!.kmh);

/** Where a sprint's bar is drawn (its middle), for effects at a removed run. */
export const sprintPixel = (index: number): { x: number; y: number } => ({
  x: SPRINT.barX + Math.round(SPRINT.barW / 2),
  y: SPRINT.rowY + index * SPRINT.pitch + 3,
});

/** Where a stage's reading is drawn on the clean-up plot at a given y range (for effects at a removed point). */
export const stagePixel = (desk: TraceDesk, stageIndex: number, yMax: number): { x: number; y: number } => {
  const plot = fitPlot(CLEAN_PLOT, desk, yMax);
  const stage = desk.stages[stageIndex]!;
  return { x: plotX(plot, stage.kmh), y: plotY(plot, stage.mmol) };
};

// yMin sits just under zero, so a reading of 0.0 is drawn clear of the axis and its ring clear of the speed labels
const Y_MIN = -0.5;
// The clean-up plot starts at x = 48 so the MMOL/L caption above its axis ends 2px clear of the axis line
const CLEAN_PLOT: Plot = { x: 48, y: 54, w: 116, h: 44, xMin: 13.5, xMax: 21, yMin: Y_MIN, yMax: 10 };
const PIN_PLOT: Plot = { x: 37, y: 48, w: 108, h: 34, xMin: 13.5, xMax: 21, yMin: Y_MIN, yMax: 10 };

/** The plot with its ranges set from the file: the stage speeds with half a stage before and a stage after. */
const fitPlot = (plot: Plot, desk: TraceDesk, yMax: number): Plot => {
  plot.xMin = desk.stages[0]!.kmh - 0.5;
  plot.xMax = desk.stages[desk.stages.length - 1]!.kmh + 1;
  plot.yMax = yMax;
  return plot;
};

// Text that only changes with the file's own numbers, built once per desk
interface Labels {
  stages: string[];
  low: string;
  high: string;
  flying: string;
  runs: string[];
  meter: string[];
  pinned: string[];
}
const labelCache = new WeakMap<TraceDesk, Labels>();
const labelsFor = (desk: TraceDesk): Labels => {
  let labels = labelCache.get(desk);
  if (!labels) {
    const c = desk.content;
    const total = desk.suspects.length;
    labels = {
      stages: desk.stages.map(s => String(s.kmh)),
      low: String(c.lt1Mmol),
      high: String(c.lt2Mmol),
      flying: `FLYING ${c.sprintMetres} M`,
      runs: desk.sprints.map(run => `${run.time.toFixed(2)} S`),
      meter: Array.from({ length: total + 1 }, (_, right) => `CLEAN-UP ${right}/${total}`),
      pinned: Array.from({ length: desk.pinLimit + 1 }, (_, n) => `${n}/${desk.pinLimit} PINNED`),
    };
    labelCache.set(desk, labels);
  }
  return labels;
};

// Scratch buffers, reused every frame
const MAX_STAGES = 16;
const trace: DataPoint[] = Array.from({ length: MAX_STAGES }, () => ({ x: 0, y: 0 }));
const xTicks: Tick[] = Array.from({ length: MAX_STAGES }, () => ({ value: 0, label: '' }));
const yTicks: Tick[] = Array.from({ length: 2 }, () => ({ value: 0, label: '' }));
const gridXs: number[] = [];
const gridYs: number[] = [];
const pinnedKinds: FeatureKind[] = [];

/** Fill `trace` with the readings still in the file; returns how many. */
const loadTrace = (desk: TraceDesk): number => {
  let n = 0;
  for (const s of desk.stages) {
    if (!s.present || n >= MAX_STAGES) continue;
    const p = trace[n++]!;
    p.x = s.kmh;
    p.y = s.mmol;
  }
  return n;
};

/** Gridlines, the two threshold lines, axes and the numbers around the lactate plot. */
const drawPaperChart = (ctx: CanvasRenderingContext2D, desk: TraceDesk, plot: Plot, litStage: number) => {
  const c = desk.content;
  gridXs.length = 0;
  gridYs.length = 0;
  for (const s of desk.stages) gridXs.push(s.kmh);
  for (let v = 2; v < plot.yMax; v += 2) gridYs.push(v);
  drawGrid(ctx, plot, gridXs, gridYs);
  drawRefLine(ctx, plot, c.lt1Mmol, PAPER.inkSoft);
  drawRefLine(ctx, plot, c.lt2Mmol, PAPER.inkSoft);
  drawAxes(ctx, plot);

  // Speeds under the stages, lactate at the two thresholds' lines
  const labels = labelsFor(desk);
  const stages = Math.min(desk.stages.length, MAX_STAGES);
  for (let i = 0; i < stages; i++) {
    const t = xTicks[i]!;
    t.value = desk.stages[i]!.kmh;
    t.label = labels.stages[i]!;
    t.color = i === litStage ? COLORS.ink : PAPER.inkSoft;
  }
  drawXTicks(ctx, plot, xTicks, stages);
  const low = yTicks[0]!;
  low.value = c.lt1Mmol;
  low.label = labels.low;
  low.color = COLORS.ink;
  const high = yTicks[1]!;
  high.value = c.lt2Mmol;
  high.label = labels.high;
  high.color = COLORS.ink;
  drawYTicks(ctx, plot, yTicks, 2);
};

const drawStageDots = (ctx: CanvasRenderingContext2D, desk: TraceDesk, plot: Plot) => {
  for (const s of desk.stages) if (s.present) drawDot(ctx, plotX(plot, s.kmh), plotY(plot, s.mmol), PAPER.trace);
};

// ---- Clean-up -----------------------------------------------------------------------------------------------------

/** A removed point's goodbye: a ring that grows over POOF_TIME. */
export interface Poof {
  x: number;
  y: number;
  age: number;
  good: boolean;
  live: boolean;
}

export const POOF_TIME = 0.3;

export interface Banner {
  /** The verdict wrapped to the readout's width. */
  lines: readonly string[];
  good: boolean;
}

export interface CleanupFrame {
  desk: TraceDesk;
  /** Which suspect the lens is on; -1 while the brief is read. */
  view: number;
  /** The y range shown, eased toward the file's own. */
  yMax: number;
  /** The lens band's centre x in pixels, eased. */
  bandX: number;
  poofs: readonly Poof[];
  /** What the readout says while a suspect waits for a decision (up to three short lines). */
  readout: readonly string[];
  /** The verdict, once the suspect under the lens is decided. */
  banner: Banner | null;
  /** The ring round the reading under the lens swells on this beat (off under reduced motion). */
  pulse: boolean;
}

const SPRINT = { x: 170, numberX: 182, titleY: 44, rowY: 56, pitch: 13, barX: 191, barW: 54 } as const;
const TAGS_Y = 109; // the tags end on row 117, clear of the lens's IF REMOVED caption on row 118
const METER_Y = 102;

const drawSuspectTag = (ctx: CanvasRenderingContext2D, x: number, y: number, number: number, s: Suspect, current: boolean) => {
  if (current && s.decision !== null) rect(ctx, x - 1, y - 1, 11, 11, COLORS.gold); // a decided one being looked at again
  if (s.decision !== null) {
    rect(ctx, x, y, 9, 9, COLORS.ink);
    rect(ctx, x + 1, y + 1, 7, 7, isRight(s) ? COLORS.good : COLORS.bad);
    if (isRight(s)) drawTick(ctx, x + 1, y + 1, COLORS.paper);
    else drawCross(ctx, x + 2, y + 1, COLORS.paper);
  } else if (current) {
    drawTag(ctx, x, y, String(number), COLORS.gold, COLORS.ink, COLORS.ink);
  } else {
    drawTag(ctx, x, y, String(number), PAPER.paper, PAPER.inkSoft, COLORS.ink);
  }
};

/** Ring colour for a flagged reading's point on the chart. */
const ringColor = (s: Suspect, current: boolean): string => {
  if (s.decision !== null) return isRight(s) ? COLORS.good : COLORS.bad;
  return current ? COLORS.gold : PAPER.inkSoft;
};

export const drawCleanup = (ctx: CanvasRenderingContext2D, f: CleanupFrame) => {
  const { desk } = f;
  const c = desk.content;
  drawPanel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, BORDER);

  const plot = fitPlot(CLEAN_PLOT, desk, f.yMax);
  const current = f.view >= 0 ? desk.suspects[f.view] : undefined;
  const litStage = current && current.place.type === 'stage' ? current.place.index : -1;

  // Title row: the file's name; the lactate unit sits at the top of its axis
  drawText(ctx, c.fileTitle, INNER_X + 4, 44, COLORS.ink);
  drawText(ctx, 'MMOL/L', INNER_X + 2, plot.y - 1, PAPER.inkSoft);
  drawText(ctx, 'KM/H', INNER_X + 2, plot.y + plot.h + 4, PAPER.inkSoft);

  // The lens band, behind the line: the stretch of the file under the lens
  if (litStage >= 0) {
    const bx = Math.round(f.bandX);
    rect(ctx, bx - 8, plot.y, 17, plot.h, PAPER.goldPale);
    rect(ctx, bx - 8, plot.y, 1, plot.h, COLORS.gold);
    rect(ctx, bx + 8, plot.y, 1, plot.h, COLORS.gold);
  }
  drawPaperChart(ctx, desk, plot, litStage);
  drawTrace(ctx, plot, trace, loadTrace(desk));
  drawStageDots(ctx, desk, plot);

  // Rings on the flagged readings, and their tags under the speed labels
  for (let i = 0; i < desk.suspects.length; i++) {
    const s = desk.suspects[i]!;
    const isCurrent = i === f.view;
    if (s.place.type === 'stage') {
      const stage = desk.stages[s.place.index] as StagePoint;
      const x = plotX(plot, stage.kmh);
      const y = plotY(plot, stage.mmol);
      if (stage.present) {
        if (isCurrent) drawRing(ctx, x, y, f.pulse && s.decision === null ? 6 : 5, COLORS.ink);
        drawRing(ctx, x, y, 4, ringColor(s, isCurrent));
      } else if (s.real) {
        // A real reading clipped from the file: a ring where it was (kept inside the plot if the chart has re-scaled)
        drawRing(ctx, x, Math.max(y, plot.y + 3), 4, COLORS.bad);
      }
      drawSuspectTag(ctx, x - 4, TAGS_Y, i + 1, s, isCurrent);
    } else {
      const rowY = SPRINT.rowY + s.place.index * SPRINT.pitch;
      drawSuspectTag(ctx, SPRINT.x, rowY - 1, i + 1, s, isCurrent);
      if (isCurrent && s.decision === null) drawBrackets(ctx, SPRINT.barX - 2, rowY - 2, SPRINT.barW + 4, 11, COLORS.gold);
    }
  }

  // The removal poofs
  for (const p of f.poofs) {
    if (p.live) drawRing(ctx, p.x, p.y, 2 + Math.round((p.age / POOF_TIME) * 6), p.good ? COLORS.good : COLORS.bad);
  }

  drawSprintPanel(ctx, desk);

  // Clean-up meter under the sprint rows
  drawText(ctx, labelsFor(desk).meter[desk.rightCount()]!, SPRINT.x, METER_Y, COLORS.ink);
  drawMeter(ctx, SPRINT.x, METER_Y + 9, 76, 6, desk);

  // The lens and the readout beside it
  if (current) drawLens(ctx, desk.lens(f.view));
  else drawEmptyLens(ctx);
  drawReadout(ctx, f);
};

const drawMeter = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, desk: TraceDesk) => {
  const total = desk.suspects.length;
  rect(ctx, x, y, w, h, COLORS.ink);
  rect(ctx, x + 1, y + 1, w - 2, h - 2, '#ffffff');
  const seg = (w - 2) / total;
  for (let i = 0; i < total; i++) {
    const s = desk.suspects[i]!;
    if (s.decision === null) continue;
    const x0 = x + 1 + Math.round(seg * i);
    const x1 = x + 1 + Math.round(seg * (i + 1));
    const gap = i > 0 ? 1 : 0;
    rect(ctx, x0 + gap, y + 1, x1 - x0 - gap, h - 2, isRight(s) ? COLORS.good : COLORS.bad);
  }
};

const drawSprintPanel = (ctx: CanvasRenderingContext2D, desk: TraceDesk) => {
  const c = desk.content;
  const labels = labelsFor(desk);
  drawText(ctx, labels.flying, SPRINT.x, SPRINT.titleY, COLORS.ink);
  let slowest = 0;
  for (const t of c.sprintTimes) slowest = Math.max(slowest, t);
  for (const run of desk.sprints) {
    const y = SPRINT.rowY + (run.n - 1) * SPRINT.pitch;
    drawText(ctx, String(run.n), SPRINT.numberX, y, PAPER.inkSoft); // which run it is
    if (run.present) {
      const w = Math.max(6, Math.round((run.time / slowest) * SPRINT.barW));
      rect(ctx, SPRINT.barX, y - 1, w, 9, PAPER.trace);
      drawText(ctx, labels.runs[run.n - 1]!, SPRINT.barX + 3, y, PAPER.paper);
    } else {
      // removed: an empty dashed slot where the bar was
      for (let i = 0; i < SPRINT.barW; i += 4) rect(ctx, SPRINT.barX + i, y + 3, 2, 1, PAPER.inkSoft);
    }
  }
};

const READOUT_X = 127; // 5px right of the lens; the longest verdict line (17 characters) then ends 5px short of the panel's edge

const drawReadout = (ctx: CanvasRenderingContext2D, f: CleanupFrame) => {
  const b = f.banner;
  if (b) {
    rect(ctx, READOUT_X, 120, 3, 34, b.good ? COLORS.good : COLORS.bad);
    if (b.good) drawTick(ctx, READOUT_X + 5, 121, COLORS.good);
    else drawCross(ctx, READOUT_X + 5, 121, COLORS.bad);
    for (let i = 0; i < b.lines.length; i++) {
      drawText(ctx, b.lines[i]!, READOUT_X + 14, 121 + i * 10, b.good ? PAPER.goodText : PAPER.badText);
    }
    return;
  }
  for (let i = 0; i < f.readout.length; i++) {
    drawText(ctx, f.readout[i]!, READOUT_X, 121 + i * 10, i === 0 ? COLORS.ink : PAPER.inkSoft);
  }
};

// ---- Pin ----------------------------------------------------------------------------------------------------------

export type RevealMark = 'key' | 'notkey' | 'missed';

export interface PinFrame {
  desk: TraceDesk;
  /** The list cursor: a row index, or the number of rows for LOCK IN. */
  cursor: number;
  yMax: number;
  /** The rungs of the ladder, from the cleaned file. */
  rungs: readonly Rung[];
  /** After lock-in: how each variable was judged so far, by variable index. */
  marks: ReadonlyArray<RevealMark | undefined>;
  locked: boolean;
  /** Which variable the dialogue is explaining during the reveal (-1 none). */
  explaining: number;
}

const LIST_Y = 97;
const ROW_H = 9;
const LOCK_Y = 144;

const ladderMarks: LadderMarks = { lit: null, pinned: pinnedKinds };

export const drawPin = (ctx: CanvasRenderingContext2D, f: PinFrame) => {
  const { desk } = f;
  const c = desk.content;
  drawPanel(ctx, PANEL.x, PANEL.y, PANEL.w, PANEL.h, BORDER);
  const rows = desk.rows();
  const row = f.cursor < rows.length && !f.locked ? rows[f.cursor] : undefined;
  let explained: (typeof rows)[number] | undefined;
  if (f.explaining >= 0) {
    for (let i = 0; i < rows.length; i++) if (rows[i]!.variable === f.explaining) explained = rows[i];
  }
  const lit: FeatureKind | undefined = (row ?? explained)?.feature;

  const plot = fitPlot(PIN_PLOT, desk, f.yMax);
  drawPaperChart(ctx, desk, plot, -1);
  drawText(ctx, 'KM/H', INNER_X + 2, plot.y + plot.h + 4, PAPER.inkSoft);
  drawTrace(ctx, plot, trace, loadTrace(desk));
  drawStageDots(ctx, desk, plot);

  // The feature under the cursor lights up on the chart
  const d = desk.derived();
  if (lit === 'lt1' && d.lt1Kmh !== null) drawCrossing(ctx, plot, d.lt1Kmh, c.lt1Mmol);
  if (lit === 'lt2' && d.lt2Kmh !== null) drawCrossing(ctx, plot, d.lt2Kmh, c.lt2Mmol);
  if (lit === 'vvo2max') {
    // The dashed line, named at its foot (the empty corner of a rising curve), where the border cannot touch the text
    const lineX = plotX(plot, d.vvo2Kmh);
    drawVLine(ctx, plot, d.vvo2Kmh, COLORS.gold);
    const w = measureText('VVO2') - 1;
    rect(ctx, lineX - w - 4, plot.y + plot.h - 9, w + 3, 9, PAPER.paper);
    drawText(ctx, 'VVO2', lineX - w - 3, plot.y + plot.h - 8, COLORS.ink);
  }
  if (lit === 'vo2max') drawGasChip(ctx, plot, (row ?? explained)?.name ?? '');

  // The ladder, with the lit and pinned rungs marked
  pinnedKinds.length = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]!;
    if (r.pinned && r.feature) pinnedKinds.push(r.feature);
  }
  ladderMarks.lit = lit ?? null;
  drawLadder(ctx, f.rungs, ladderMarks, c.reserveLabel);

  drawList(ctx, f);
};

/** A ring where the curve crosses a threshold's lactate, with a dashed drop to the speed axis. */
const drawCrossing = (ctx: CanvasRenderingContext2D, plot: Plot, kmh: number, mmol: number) => {
  const x = plotX(plot, kmh);
  const y = plotY(plot, mmol);
  drawDrop(ctx, plot, kmh, mmol, COLORS.ink);
  drawRing(ctx, x, y, 5, COLORS.ink);
  drawRing(ctx, x, y, 4, COLORS.gold);
};

/** VO2max is not on the lactate curve: a dashed chip says where it comes from. */
const drawGasChip = (ctx: CanvasRenderingContext2D, plot: Plot, name: string) => {
  const text = `GAS: ${gasValue(name)}`;
  const w = measureText(text) + 5;
  const x = plot.x + 6;
  const y = plot.y + 3;
  rect(ctx, x, y, w, 13, PAPER.paper);
  for (let i = 0; i < w; i += 4) {
    rect(ctx, x + i, y, Math.min(2, w - i), 1, COLORS.ink);
    rect(ctx, x + i, y + 12, Math.min(2, w - i), 1, COLORS.ink);
  }
  for (let i = 0; i < 13; i += 4) {
    rect(ctx, x, y + i, 1, Math.min(2, 13 - i), COLORS.ink);
    rect(ctx, x + w - 1, y + i, 1, Math.min(2, 13 - i), COLORS.ink);
  }
  drawText(ctx, text, x + 3, y + 3, COLORS.ink);
};

const gasValues = new Map<string, string>();
const gasValue = (name: string): string => {
  let v = gasValues.get(name);
  if (v === undefined) {
    v = /\((\d+(?:\.\d+)?)/.exec(name)?.[1] ?? '';
    gasValues.set(name, v);
  }
  return v;
};

const MARK_TEXT: Record<RevealMark, string> = { key: 'KEY', notkey: 'NOT KEY', missed: 'MISSED' };

const drawList = (ctx: CanvasRenderingContext2D, f: PinFrame) => {
  const rows = f.desk.rows();
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]!;
    const y = LIST_Y + i * ROW_H;
    const sel = i === f.cursor && !f.locked;
    if (r.variable === f.explaining) rect(ctx, 9, y - 1, 238, ROW_H, PAPER.goldPale);
    if (sel) {
      rect(ctx, 9, y - 1, 238, ROW_H, COLORS.inkSoft);
      drawText(ctx, '>', 12, y, COLORS.paper);
    }
    // Check box: a blue tick when pinned
    rect(ctx, 22, y, 7, 7, sel ? COLORS.paper : COLORS.inkSoft);
    rect(ctx, 23, y + 1, 5, 5, r.pinned ? COLORS.blue : PAPER.paper);
    if (r.pinned) drawTick(ctx, 22, y, COLORS.paper);
    drawText(ctx, r.shown, 34, y, sel ? COLORS.paper : r.odd ? PAPER.badText : COLORS.ink);

    const mark = f.marks[r.variable];
    if (mark) {
      const text = MARK_TEXT[mark];
      const tone = mark === 'key' ? COLORS.good : mark === 'notkey' ? COLORS.bad : COLORS.gold;
      const x = 244 - (measureText(text) - 1);
      if (mark === 'notkey') drawCross(ctx, x - 9, y, tone);
      else if (mark === 'missed') drawText(ctx, '!', x - 8, y, '#8a6a00'); // a dark amber: readable on paper and the gold row
      else drawTick(ctx, x - 9, y, tone);
      drawText(ctx, text, x, y, mark === 'missed' ? COLORS.ink : tone);
    } else if (r.pinned) {
      drawText(ctx, 'PINNED', 244 - (measureText('PINNED') - 1), y, sel ? '#a8c8f8' : COLORS.blue);
    }
  }
  drawLockRow(ctx, f);
};

const drawLockRow = (ctx: CanvasRenderingContext2D, f: PinFrame) => {
  const { desk } = f;
  const pins = desk.pins().length;
  const limit = desk.pinLimit;
  const sel = f.cursor === desk.rows().length && !f.locked;
  const y = LOCK_Y;
  if (sel) {
    rect(ctx, 9, y - 1, 238, ROW_H, COLORS.inkSoft);
    drawText(ctx, '>', 12, y, COLORS.paper);
  }
  const color = sel ? COLORS.paper : pins === limit ? COLORS.ink : '#606060'; // still readable before it can be used
  drawText(ctx, 'LOCK IN', 34, y, color);
  for (let i = 0; i < limit; i++) {
    const cx = 100 + i * 11;
    drawRing(ctx, cx, y + 3, 4, sel ? COLORS.paper : COLORS.inkSoft);
    if (i < pins) {
      rect(ctx, cx - 2, y + 1, 5, 5, COLORS.blue);
      rect(ctx, cx - 1, y, 3, 7, COLORS.blue);
    }
  }
  drawText(ctx, labelsFor(desk).pinned[pins]!, 140, y, color);
};
