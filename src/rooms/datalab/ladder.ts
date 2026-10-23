// The speed ladder: the rungs a file gives (LT1, LT2, vVO2max, max sprint speed) on one vertical speed scale,
// with the gap between vVO2max and max sprint speed bracketed and labelled. Rungs are placed to scale, so the
// speed reserve looks as big as it is. Names sit left of the rail, speeds right of it, and the reserve's
// label fills the empty left side of the gap.
import { drawText, measureText } from '../../render/PixelFont';
import { COLORS } from '../frame';
import type { FeatureKind } from './names';
import { PAPER } from './chart';

export interface Rung {
  feature: FeatureKind;
  /** Short name left of the rail: 'LT1'. */
  label: string;
  kmh: number;
}

/** The ladder's frame in game pixels (the reserve's label starts 7px clear of the chart beside it). */
export const LADDER_BOX = { x: 154, y: 44, w: 92, h: 52 } as const;

const NAME_RIGHT = 42; // where names (and the reserve label) end, from the box's left edge
const BRACKET = NAME_RIGHT + 3;
const RAIL = NAME_RIGHT + 6;
const VALUE_X = RAIL + 5;
const TOP = 5; // the fastest rung's centre, from the box's top
const BOTTOM = LADDER_BOX.h - 5; // the slowest rung's centre
const LABEL_PITCH = 8; // two labels never sit closer than this
const MAX_RUNGS = 6;

// A label is split at its first space once, not on every frame
const splits = new Map<string, readonly [string, string]>();
const splitLabel = (label: string): readonly [string, string] => {
  let parts = splits.get(label);
  if (!parts) {
    const space = label.indexOf(' ');
    parts = space > 0 ? [label.slice(0, space), label.slice(space + 1)] : [label, ''];
    splits.set(label, parts);
  }
  return parts;
};

// Scratch space for the label positions, reused every frame
const placed = new Array<number>(MAX_RUNGS).fill(0);
const order = new Array<number>(MAX_RUNGS).fill(0);

const rect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) => {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
};

export interface LadderMarks {
  /** The rung the cursor is on. */
  lit: FeatureKind | null;
  /** Rungs the player has pinned (blue). */
  pinned: readonly FeatureKind[];
}

/** A label plate: a flat fill with 1px above and below the text, which is as much as the label pitch allows. */
const plate = (ctx: CanvasRenderingContext2D, text: string, right: number, y: number, fill: string, ink: string) => {
  const w = measureText(text) - 1;
  rect(ctx, right - w - 2, y - 1, w + 4, 9, fill);
  drawText(ctx, text, right - w, y, ink);
};

/**
 * Draw the ladder. `rungs` may be in any order; they are placed by speed. `reserve` is the gap's label
 * ('SPEED RESERVE', from the content), drawn in two lines left of the bracket.
 */
export const drawLadder = (ctx: CanvasRenderingContext2D, rungs: readonly Rung[], marks: LadderMarks, reserve: string) => {
  const n = Math.min(rungs.length, MAX_RUNGS);
  if (n === 0) return;
  const bx = LADDER_BOX.x;
  const by = LADDER_BOX.y;

  // Rungs by speed, slowest first (insertion sort on a few items, no allocation)
  for (let i = 0; i < n; i++) order[i] = i;
  for (let i = 1; i < n; i++) {
    const v = order[i]!;
    let j = i - 1;
    while (j >= 0 && rungs[order[j]!]!.kmh > rungs[v]!.kmh) {
      order[j + 1] = order[j]!;
      j--;
    }
    order[j + 1] = v;
  }
  const slowest = rungs[order[0]!]!.kmh;
  const fastest = rungs[order[n - 1]!]!.kmh;
  const span = Math.max(fastest - slowest, 0.0001);
  const yOf = (kmh: number) => Math.round(by + BOTTOM - ((kmh - slowest) / span) * (BOTTOM - TOP));

  // Label rows, nudged apart from the bottom up so close rungs stay readable
  for (let i = 0; i < n; i++) {
    const want = yOf(rungs[order[i]!]!.kmh);
    placed[i] = i === 0 ? want : Math.min(want, placed[i - 1]! - LABEL_PITCH);
  }

  rect(ctx, bx + RAIL, yOf(fastest) - 3, 1, yOf(slowest) - yOf(fastest) + 7, PAPER.inkSoft);

  for (let i = 0; i < n; i++) {
    const rung = rungs[order[i]!]!;
    const y = yOf(rung.kmh);
    const ly = placed[i]! - 3; // top of the label text, centred on the rung
    const lit = marks.lit === rung.feature;
    const pinned = marks.pinned.includes(rung.feature);
    const value = rung.kmh.toFixed(1);

    // The rung itself, at its true height
    rect(ctx, bx + RAIL - 3, y, 7, 2, lit ? COLORS.gold : pinned ? COLORS.blue : COLORS.ink);
    if (lit) rect(ctx, bx + RAIL - 3, y - 1, 7, 1, COLORS.ink);

    // Name (right-aligned left of the rail) and speed (right of it); lit or pinned ones sit on a plate
    if (lit || pinned) {
      const fill = lit ? COLORS.gold : COLORS.blue;
      const ink = lit ? COLORS.ink : COLORS.paper;
      plate(ctx, rung.label, bx + NAME_RIGHT, ly, fill, ink);
      const w = measureText(value) - 1;
      plate(ctx, value, bx + VALUE_X + w, ly, fill, ink);
    } else {
      drawText(ctx, rung.label, bx + NAME_RIGHT - (measureText(rung.label) - 1), ly, PAPER.inkSoft);
      drawText(ctx, value, bx + VALUE_X, ly, COLORS.ink);
    }
  }

  // The speed reserve: the gap between vVO2max and max sprint speed, bracketed and labelled
  let low = -1;
  let high = -1;
  for (let i = 0; i < n; i++) {
    const f = rungs[order[i]!]!.feature;
    if (f === 'vvo2max') low = i;
    if (f === 'sprint') high = i;
  }
  if (low >= 0 && high > low) {
    const top = yOf(rungs[order[high]!]!.kmh);
    const bottom = yOf(rungs[order[low]!]!.kmh);
    // Bracket just left of the rail, its serifs pointing at the rungs' ends
    rect(ctx, bx + BRACKET, top, 1, bottom - top + 2, COLORS.ink);
    rect(ctx, bx + BRACKET, top, 3, 1, COLORS.ink);
    rect(ctx, bx + BRACKET, bottom + 1, 3, 1, COLORS.ink);
    // The label sits between the two end labels (which may have been nudged away from their rungs)
    const mid = Math.round((placed[high]! + 4 + placed[low]! - 4) / 2);
    const [first, second] = splitLabel(reserve);
    const right = bx + NAME_RIGHT - 3;
    if (second) {
      drawText(ctx, first, right - (measureText(first) - 1), mid - 8, COLORS.ink);
      drawText(ctx, second, right - (measureText(second) - 1), mid, COLORS.ink);
    } else {
      drawText(ctx, first, right - (measureText(first) - 1), mid - 3, COLORS.ink);
    }
  }
};
