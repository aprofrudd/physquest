// Pure layout maths for the console shell (no DOM access).
//
// The screen comes first: the handheld keeps only a thin bezel, a compact brand row (shown when there
// is height to spare) and the controls, and every remaining pixel goes to the picture. The CSS in
// console.css lays the handheld out with a grid sized from the lengths chosen here: `u` (plastic
// details, type), `c` (the D-pad arm / button size, never below the 44px touch minimum), `bz` (bezel
// thickness), `pad` (plastic margin) and `gap` (between rows). Keep the two files in step.

export type ConsoleMode = 'portrait' | 'compact';

export interface ConsoleLayout {
  mode: ConsoleMode;
  /** Base unit in CSS px. */
  u: number;
  /** Control unit in CSS px: D-pad arm and action-button size. */
  c: number;
  /** Console body box. */
  cw: number;
  ch: number;
  /** Screen slot (the room the display canvas is centred in). */
  sw: number;
  sh: number;
  /** Width of the D-pad / A-B columns beside the screen (landscape). */
  side: number;
  /** Plastic between the console edge and everything inside it. */
  pad: number;
  /** Bezel thickness around the screen. */
  bz: number;
  /** Space between the rows of the portrait handheld. */
  gap: number;
  /** Height of the portrait brand row. */
  brandH: number;
  /** The brand row has room; on short windows it makes way for the screen and controls. */
  brand: boolean;
  /** Uniform shrink (<= 1) applied only when the viewport is too small for the smallest layout. */
  fit: number;
}

type Metrics = Omit<ConsoleLayout, 'fit'>;

export interface DisplayScale {
  /** Device pixels per game pixel actually drawn (d'). */
  d: number;
  /** Backing-store multiplier: the display canvas is gameW*k x gameH*k. */
  k: number;
  /** CSS size of the display canvas. */
  cssW: number;
  cssH: number;
  /** True when every game pixel is an exact block of device pixels (nearest-neighbour is lossless). */
  pixelated: boolean;
}

export const MIN_TOUCH = 44;
/** Largest screen: 4 CSS px per game pixel (1024x896 for a 256x224 game). */
export const MAX_CSS_SCALE = 4;
/**
 * Snap to whole device pixels per game pixel only when that is cheap. On high-density screens a
 * fractional ("sharp bilinear") picture is barely distinguishable, so size wins; at 1x a fractional
 * scale visibly softens the pixels, so a bigger cut is worth paying for crispness.
 */
const SNAP_RATIO_HIGH_DPR = 0.94;
const SNAP_RATIO_LOW_DPR = 0.85;
/** Layout rounds to 1/64 px; without this slack an exact whole scale could floor to the one below. */
const SNAP_SLACK = 0.005;
/** Smallest type on the plastic (CSS px): every visible console label stays at or above this. */
export const MIN_LABEL = 8;

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** d (device px per game px) -> d', whole when the snap is cheap enough. */
const snapScale = (d: number, dpr: number): number => {
  const whole = Math.floor(d + SNAP_SLACK);
  const ratio = dpr >= 2 ? SNAP_RATIO_HIGH_DPR : SNAP_RATIO_LOW_DPR;
  return whole >= 1 && whole / d >= ratio ? whole : d;
};

/**
 * "Sharp bilinear" scale choice for the display canvas.
 * Whole device pixels per game pixel when that is cheap; otherwise the exact fractional size, drawn
 * from an integer-upscaled backing store so the browser's smooth downscale only softens the edges
 * of game pixels instead of making some of them wider than others.
 */
export const pickDisplayScale = (
  availW: number,
  availH: number,
  dpr: number,
  gameW: number,
  gameH: number,
): DisplayScale => {
  const s = Math.min(availW / gameW, availH / gameH, MAX_CSS_SCALE);
  const dp = snapScale(Math.max(s * dpr, 0.01), dpr);
  const k = clamp(Math.ceil(dp - 1e-9), 1, 8);
  return {
    d: dp,
    k,
    cssW: (gameW * dp) / dpr,
    cssH: (gameH * dp) / dpr,
    pixelated: Number.isInteger(dp) && dp === k,
  };
};

// --- Portrait: screen on top, controls below, width-driven -----------------------------------
// Grid rows (console.css): bezel | brand | spacer (1fr) | D-pad and A-B | SOUND, SELECT, START.
const PORTRAIT_MIN_W = 308; // narrowest body whose 44px controls still fit side by side
const CONTROLS_C = 3.4; // D-pad box (3 arms + tap slop) and the A-B pill with its downward shift, in c
const META_H = 46; // the SELECT / START row (pill, label, touch target)
const PORTRAIT_MAX_ASPECT = 2.2; // never a taller brick than this; spare height stays page

const solvePortrait = (availW: number, availH: number, gameW: number, gameH: number): Metrics => {
  const cw = Math.max(Math.min(availW, clamp(0.75 * availH, 460, 900)), PORTRAIT_MIN_W);
  const u = cw / 100;
  const pad = clamp(0.022 * cw, 5, 12);
  const bz = clamp(0.02 * cw, 5, 12);
  const gap = clamp(0.02 * cw, 6, 14);
  const brandH = clamp(0.07 * cw, 22, 40);
  const cMax = clamp(0.16 * cw, MIN_TOUCH, 66);

  const height = (sh: number, c: number, brand: boolean) =>
    2 * pad + sh + 2 * bz + (brand ? brandH : 0) + CONTROLS_C * c + META_H + 4 * gap;

  let sw = cw - 2 * pad - 2 * bz;
  let sh = (sw * gameH) / gameW;
  // Short window: controls give way first (down to the touch minimum), then the brand row, and only
  // then the screen
  let c = cMax;
  if (height(sh, c, true) > availH) c = clamp(cMax - (height(sh, cMax, true) - availH) / CONTROLS_C, MIN_TOUCH, cMax);
  const brand = height(sh, c, true) <= availH;
  if (height(sh, c, brand) > availH) {
    sh = Math.max(availH - height(0, c, brand), 140); // below this `fit` takes over
    sw = (sh * gameW) / gameH;
  }
  const ch = Math.max(height(sh, c, brand), Math.min(availH, PORTRAIT_MAX_ASPECT * cw));
  return { mode: 'portrait', u, c, cw, ch, sw, sh, side: 0, pad, bz, gap, brandH, brand };
};

// --- Landscape: D-pad | screen | A-B, solved from the screen height ---------------------------
// Three rows in each side column, beside a bezel that takes the full height: brand (left) and the
// SOUND switch (right) | D-pad (left) and A-B (right) | SELECT (left) and START (right).
const brandColumnH = (u: number): number => 6.2 * u + 1.2 * u + Math.max(MIN_LABEL, 1.9 * u); // logo + gap + tag
const PILL_PAD_U = 2.5; // above and below the START/SELECT pill inside its button
const pillRowH = (u: number): number =>
  Math.max(
    46,
    (2 * PILL_PAD_U + 3.6) * u +
      Math.max(MIN_LABEL, 2.1 * u) + // label
      Math.max(MIN_LABEL, 1.85 * u) + 2, // room for the keyboard hint under the label
  );
/** Below this window height the brand makes way for the pad and buttons. */
const BRAND_MIN_H = 236;

const landscapeMetrics = (sh: number, brand: boolean, gameW: number, gameH: number): Metrics => {
  const u = clamp(3 + (sh - 300) * 0.008, 3, 6.2);
  const c = clamp(0.1 * sh, MIN_TOUCH, 64);
  const bz = clamp(0.022 * sh, 5, 14);
  const pad = clamp(0.02 * sh, 5, 14);
  const sw = (sh * gameW) / gameH;
  const side = 3.45 * c + 2 * u;
  const cw = 2 * side + sw + 2 * bz + 2 * pad;
  const sideColumnH = Math.max(brand ? brandColumnH(u) : 0, 3.6 * u) + 3.3 * c + pillRowH(u) + 4 * u;
  const ch = Math.max(sh + 2 * bz + 2 * pad, sideColumnH + 2 * pad);
  return { mode: 'compact', u, c, cw, ch, sw, sh, side, pad, bz, gap: 0, brandH: 0, brand };
};

const solveLandscape = (availW: number, availH: number, gameW: number, gameH: number, dpr: number): Metrics => {
  const brand = availH >= BRAND_MIN_H;
  const fits = (sh: number): boolean => {
    const m = landscapeMetrics(sh, brand, gameW, gameH);
    return m.cw <= availW && m.ch <= availH;
  };
  let sh = gameH * MAX_CSS_SCALE;
  if (!fits(sh)) {
    let lo = 120;
    let hi = sh;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (fits(mid)) lo = mid;
      else hi = mid;
    }
    sh = lo;
  }
  // When whole device pixels per game pixel are cheap, size the screen to exactly that so the
  // bezel hugs the picture instead of growing a margin the picture cannot use
  const d = snapScale((sh / gameH) * dpr, dpr);
  if (Number.isInteger(d)) sh = (d * gameH) / dpr;
  return landscapeMetrics(sh, brand, gameW, gameH);
};

export const solveLayout = (
  availW: number,
  availH: number,
  gameW: number,
  gameH: number,
  dpr: number,
): ConsoleLayout => {
  const m =
    availW / availH < 1
      ? solvePortrait(availW, availH, gameW, gameH)
      : solveLandscape(availW, availH, gameW, gameH, dpr);
  // Below the smallest layout (tiny landscape windows) shrink everything a little rather than clip it
  return { ...m, fit: Math.min(1, availW / m.cw, availH / m.ch) };
};
