// The Data Lab's moving parts, drawn over the baked map every frame and under the characters: the video wall
// (one screen per variable of the level), workstation traces with blinking cursors, rack LEDs, the printer's
// paper, light pulsing along the floor cable, and the analysts typing. `t` is the room clock in seconds
// (it stops when the game is paused and is frozen under reduced motion).
import { drawText, measureText } from '../../render/PixelFont';
import { drawSprite } from '../../render/SpriteSheet';
import { PALETTES } from '../../render/Palettes';
import { COACH_UP } from '../sprites';
import type { SportData } from '../sports';
import { featureOf, screenText, type FeatureKind } from '../../rooms/datalab/names';
import { RACK_LEDS_BOTTOM, RACK_LEDS_TOP, printerPix } from './datalab-tiles';

const PAL = PALETTES.data.colors;
const [OUTLINE, , MID, LIGHT, BG, ACCENT] = [PAL[0]!, PAL[1]!, PAL[2]!, PAL[3]!, PAL[4]!, PAL[5]!];

const rect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) => {
  ctx.fillStyle = color;
  ctx.fillRect(Math.floor(x), Math.floor(y), w, h);
};

// ---- Where things are (tile units) --------------------------------------------------------------------------------

/** Workstation monitors (left tile of each pair): they show a scrolling trace. */
const MONITORS: ReadonlyArray<{ tx: number; ty: number; kind: TraceKind; seed: number }> = [
  { tx: 2, ty: 4, kind: 'wave', seed: 0 },
  { tx: 5, ty: 4, kind: 'noise', seed: 1.3 },
  { tx: 2, ty: 8, kind: 'ecg', seed: 2.1 },
  { tx: 10, ty: 5, kind: 'power', seed: 0.7 },
];

/** Rack columns and the tile rows their top halves sit on. */
const RACK_COLUMNS = [13, 14] as const;
const RACK_ROWS = [4, 6, 8] as const;

const PRINTER = { tx: 12, ty: 7 } as const;
const CABLE_ROW = 10;
/** Pixel columns of the cover plate where the way in crosses the cable (tile 7). */
const COVER = { from: 108, to: 128 } as const;

/** Analysts: tile, colours and typing frames. They stand behind a desk and are not interactive. */
const ANALYSTS: ReadonlyArray<{ tx: number; ty: number; colors: number; phase: number }> = [
  { tx: 2, ty: 6, colors: 0, phase: 0 },
  { tx: 6, ty: 6, colors: 1, phase: 1 },
  { tx: 3, ty: 10, colors: 2, phase: 0 },
];

// ---- Sprites: the coach's back view with different colours and typing arms --------------------------------------

type Sprite = number[][];

/** Copy of a sprite with string art patched in: digits set that index, '.' leaves it alone. */
const patch = (base: Sprite, ...patches: ReadonlyArray<readonly [number, number, readonly string[]]>): Sprite => {
  const out = base.map(row => row.slice());
  for (const [x, y, rows] of patches) {
    rows.forEach((row, j) => {
      [...row].forEach((ch, i) => {
        if (ch === '.') return;
        const line = out[y + j];
        if (line && x + i >= 0 && x + i < line.length) line[x + i] = Number(ch);
      });
    });
  }
  return out;
};

const BACK = COACH_UP[0]!;
/** Two frames of typing: hands up on the keys, then hands apart. */
const TYPING: readonly Sprite[] = [BACK, patch(BACK, [2, 9, ['1', '3']], [12, 9, ['3', '1']], [3, 10, ['1']], [12, 10, ['1']])];

// Index 1 outline, 2 hair, 3 skin, 4 shirt, 5 shirt detail
const ANALYST_COLORS: readonly string[][] = [
  ['', OUTLINE, '#583828', '#e0b088', '#58b0c8', BG], // hoodie
  ['', OUTLINE, '#a05020', '#c08860', ACCENT, '#f8d880'], // amber jumper
  ['', OUTLINE, '#c8c8c8', '#e0b088', '#f4f4f4', '#a8c0d8'], // lab coat
];

// ---- Screens ----------------------------------------------------------------------------------------------------

type TraceKind = 'ecg' | 'wave' | 'decay' | 'power' | 'noise' | 'bars';

interface Screen {
  label: string;
  value: string;
  kind: TraceKind;
  color: string;
}

/** What each variable's screen draws: only flavour, a different moving picture per variable. */
const KIND_FOR: Readonly<Record<FeatureKind, TraceKind>> = {
  lt1: 'decay',
  lt2: 'power',
  vo2max: 'wave',
  vvo2max: 'ecg',
  sprint: 'bars',
};
const KIND_BY_INDEX: readonly TraceKind[] = ['wave', 'ecg', 'decay', 'power', 'bars'];

const screenCache = new WeakMap<SportData, readonly Screen[]>();

/** The five wall screens of a level: short labels and values taken from the variable names, built once. */
export const screensFor = (sport: SportData): readonly Screen[] => {
  let screens = screenCache.get(sport);
  if (!screens) {
    screens = sport.variables.slice(0, WALL_SLOTS).map((v, i) => {
      const feature = featureOf(v.name);
      const text = screenText(v.name);
      return { label: text.label, value: text.value, kind: feature ? KIND_FOR[feature] : KIND_BY_INDEX[i % KIND_BY_INDEX.length]!, color: i % 2 === 0 ? LIGHT : ACCENT };
    });
    screenCache.set(sport, screens);
  }
  return screens;
};

export const WALL_SLOTS = 5;
export const SCREEN = { x0: 20, pitch: 44, y: 20, w: 40, h: 26 } as const;

/** The wall tiles (row 2) that belong to each screen, for looking at them: tile column -> screen index. */
export const WALL_SCREEN_AT: Readonly<Record<number, number>> = {
  1: 0, 2: 0, 3: 0,
  4: 1, 5: 1, 6: 1,
  7: 2, 8: 2,
  9: 3, 10: 3, 11: 3,
  12: 4, 13: 4, 14: 4,
};

/** One column per pixel of a scrolling trace: `kind` picks the shape. */
const traceValue = (kind: TraceKind, s: number): number => {
  switch (kind) {
    case 'ecg': {
      const p = s % 22;
      return p < 1 ? 0.35 : p < 2 ? 0.95 : p < 3 ? 0.05 : p < 4 ? 0.5 : p > 12 && p < 15 ? 0.62 : 0.5;
    }
    case 'wave':
      return 0.5 + 0.32 * Math.sin(s * 0.28) + 0.12 * Math.sin(s * 0.9);
    case 'decay': {
      const p = (s % 44) / 44;
      return 0.1 + 0.8 * Math.exp(-p * 3.2);
    }
    case 'power': {
      const p = (s % 60) / 60;
      return p < 0.12 ? 0.15 + p * 6 : 0.9 * Math.exp(-(p - 0.12) * 1.8) + 0.08;
    }
    default:
      return 0.5 + 0.25 * Math.sin(s * 1.7) * Math.sin(s * 0.31) + 0.15 * Math.sin(s * 2.9);
  }
};

const drawTraceBox = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, t: number, color: string, kind: TraceKind, speed: number) => {
  const offset = t * speed;
  let previous = -1;
  ctx.fillStyle = color;
  for (let i = 0; i < w; i++) {
    const v = traceValue(kind, i + offset);
    const yy = Math.round(y + (h - 1) * (1 - Math.max(0, Math.min(1, v))));
    if (previous >= 0 && Math.abs(yy - previous) > 1) {
      const top = Math.min(yy, previous);
      ctx.fillRect(x + i, top, 1, Math.max(yy, previous) - top + 1);
    } else {
      ctx.fillRect(x + i, yy, 1, 1);
    }
    previous = yy;
  }
};

const drawVideoWall = (ctx: CanvasRenderingContext2D, t: number, screens: readonly Screen[]) => {
  for (let i = 0; i < screens.length; i++) {
    const s = screens[i]!;
    const x = SCREEN.x0 + i * SCREEN.pitch;
    const y = SCREEN.y;
    rect(ctx, x - 1, y - 1, SCREEN.w + 2, SCREEN.h + 2, MID);
    rect(ctx, x, y, SCREEN.w, SCREEN.h, OUTLINE);
    // The moving picture on top, the label and value below it: the challenge scene's plates cover the lower
    // half of this wall, so what peeks out behind them is the picture, not half a word
    if (s.kind === 'bars') {
      for (let b = 0; b < 9; b++) {
        const h = 2 + Math.round(4 * (0.5 + 0.5 * Math.sin(t * 2 + b * 0.9)));
        rect(ctx, x + 3 + b * 4, y + 8 - h, 3, h, s.color);
      }
    } else {
      drawTraceBox(ctx, x + 3, y + 2, 34, 7, t, s.color, s.kind, 14 + i * 3);
    }
    drawText(ctx, s.label, x + 3, y + 10, LIGHT);
    drawText(ctx, s.value, x + 3, y + 18, ACCENT);
    // A blinking cursor after the value, each screen on its own beat
    if (Math.floor(t * 2 + i * 0.37) % 2 === 1) rect(ctx, x + 5 + s.value.length * 6, y + 18, 4, 7, ACCENT);
  }
};

const drawMonitors = (ctx: CanvasRenderingContext2D, t: number) => {
  for (const m of MONITORS) {
    const x = m.tx * 16 + 3;
    const y = m.ty * 16 + 3;
    drawTraceBox(ctx, x, y + 1, 26, 8, t + m.seed, LIGHT, m.kind, 20);
    if (Math.floor(t * 2 + m.seed) % 2 === 1) rect(ctx, x + 22, y + 7, 3, 1, ACCENT); // the cursor blinks
  }
};

const drawLeds = (ctx: CanvasRenderingContext2D, t: number) => {
  for (const tx of RACK_COLUMNS) {
    for (const ty of RACK_ROWS) {
      for (let half = 0; half < 2; half++) {
        const leds = half === 0 ? RACK_LEDS_TOP : RACK_LEDS_BOTTOM;
        const row = ty + half;
        for (let k = 0; k < leds.length; k++) {
          const led = leds[k]!;
          const on = Math.sin(t * (2.2 + k * 0.9) + tx * 3 + row * 1.7 + k) > -0.2;
          rect(ctx, tx * 16 + led[0], row * 16 + led[1], 1, 1, on ? ((k + tx) % 3 === 0 ? ACCENT : LIGHT) : OUTLINE);
        }
      }
    }
  }
};

const drawCablePulses = (ctx: CanvasRenderingContext2D, t: number) => {
  for (let i = 0; i < 3; i++) {
    const x = 80 + ((t * 40 + i * 52) % 160);
    if (x > COVER.from && x < COVER.to) continue; // the light goes under the cover plate
    rect(ctx, x, CABLE_ROW * 16 + 7, 3, 2, ACCENT);
    rect(ctx, x - 3, CABLE_ROW * 16 + 7, 3, 2, LIGHT);
  }
};

// The printer's paper, a few pixels at a time: its frames are cached tiles drawn over the baked printer
const printerFrames = new Map<number, HTMLCanvasElement>();
const printerFrame = (paper: number): HTMLCanvasElement => {
  let canvas = printerFrames.get(paper);
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const c = canvas.getContext('2d')!;
    const pattern = printerPix(paper);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        c.fillStyle = PAL[pattern[y]![x]!]!;
        c.fillRect(x, y, 1, 1);
      }
    }
    printerFrames.set(paper, canvas);
  }
  return canvas;
};

const drawPrinter = (ctx: CanvasRenderingContext2D, t: number) => {
  const step = Math.floor(t * 1.5) % 6; // 0 1 2 3 4 3: the sheet inches out, then is torn off
  const paper = step <= 4 ? step : 0;
  ctx.drawImage(printerFrame(paper), PRINTER.tx * 16, PRINTER.ty * 16);
};

const drawAnalysts = (ctx: CanvasRenderingContext2D, t: number) => {
  for (const a of ANALYSTS) {
    const frame = (Math.floor(t * 3) + a.phase) % 2;
    drawSprite(ctx, TYPING[frame]!, a.tx * 16, a.ty * 16, ANALYST_COLORS[a.colors] as string[]);
  }
};

const INK = '#101018';
const PLATE = '#f8f0d8';

/** The room's name plate on the wall, like the hub's. */
const drawPlate = (ctx: CanvasRenderingContext2D, label: string, cx: number, cy: number) => {
  const textW = measureText(label) - 1;
  const w = Math.max(48, textW + 8);
  const x = Math.round(cx - w / 2);
  const y = Math.floor(cy - 6);
  rect(ctx, x, y, w, 13, INK);
  rect(ctx, x + 1, y + 1, w - 2, 11, PLATE);
  drawText(ctx, label, x + Math.round((w - textW) / 2), y + 3, INK);
};

export const dataLabLife = (ctx: CanvasRenderingContext2D, t: number, sport: SportData) => {
  drawVideoWall(ctx, t, screensFor(sport));
  drawMonitors(ctx, t);
  drawLeds(ctx, t);
  drawCablePulses(ctx, t);
  drawPrinter(ctx, t);
  drawAnalysts(ctx, t);
  drawPlate(ctx, 'DATA', 128, 8);
};

