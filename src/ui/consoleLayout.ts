// Pure layout maths for the console shell (no DOM access).
//
// The CSS in console.css lays the handheld out with a grid whose sizes are multiples of two
// lengths this module chooses: `u` (plastic details, type) and `c` (the D-pad arm / button size,
// never below the 44px touch minimum). The numbers below mirror the grid rows in console.css;
// keep the two in step.

export type ConsoleMode = 'portrait' | 'landscape' | 'compact';

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
  /** Width of the D-pad / A-B columns in the landscape modes. */
  side: number;
  /** Plastic between the console edge and the bezel (left and right). */
  pad: number;
  /** Bezel column beside the screen: holds the power LED. */
  led: number;
  /** Bezel edge on the other side of the screen. */
  edge: number;
  /** The LED column is wide enough for the "POWER" label at its minimum size; otherwise just the dot. */
  ledLabel: boolean;
  /** The bezel caption ("DOT MATRIX ...") fits at its minimum size; otherwise it is dropped. */
  caps: boolean;
  /** Compact landscape only: the brand row has room (on very short windows it makes way for the pad). */
  brand: boolean;
  /** Smallest phones: whole-pixel snapping must cost very little before it is worth a smaller screen. */
  tight: boolean;
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
/** Desktop cap: the screen never grows past 3 CSS px per game pixel (768x672 for a 256x224 game). */
export const MAX_CSS_SCALE = 3;
/** Snap to whole device pixels per game pixel when that costs no more than 15% of the size. */
const SNAP_RATIO = 0.85;
/** ...but on the smallest phones every CSS pixel of glass counts: only snap for a 5% cost or less. */
const TIGHT_SNAP_RATIO = 0.95;
/** Layout rounds to 1/64 px; without this slack an exact whole scale could floor to the one below. */
const SNAP_SLACK = 0.005;
/** Smallest type on the plastic (CSS px): every visible console label stays at or above this. */
export const MIN_LABEL = 8;

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** d (device px per game px) -> d', whole when the snap is cheap enough. */
const snapScale = (d: number, ratio: number = SNAP_RATIO): number => {
  const whole = Math.floor(d + SNAP_SLACK);
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
  tight = false,
): DisplayScale => {
  const s = Math.min(availW / gameW, availH / gameH);
  const dp = snapScale(Math.max(s * dpr, 0.01), tight ? TIGHT_SNAP_RATIO : SNAP_RATIO);
  const k = clamp(Math.ceil(dp - 1e-9), 1, 8);
  return {
    d: dp,
    k,
    cssW: (gameW * dp) / dpr,
    cssH: (gameH * dp) / dpr,
    pixelated: Number.isInteger(dp) && dp === k,
  };
};

// Bezel chrome around the screen slot, in u: 10 LED column + 4.5 right edge; 6.5 head + 4.5 foot.
const LED_U = 10;
const EDGE_U = 4.5;
const BEZEL_X_U = LED_U + EDGE_U;
const BEZEL_Y_U = 11;

/**
 * Does the bezel caption fit between the head's padding and its two rules (>= 14px each)?
 * Width of the caption: about 26 em at the type size console.css gives it.
 */
const CAPS_EM = 26;
const capsFit = (bezelW: number, u: number): boolean => {
  const size = Math.max(MIN_LABEL, 1.95 * u);
  return bezelW - 2 * 3.2 * u - 2 * 1.8 * u - CAPS_EM * size >= 28;
};

/** The "POWER" label is about 4 em wide (heavy sans, letter-spaced); it needs the LED column to itself. */
const LED_LABEL_EM = 4.1;
const ledLabelFit = (led: number, u: number): boolean =>
  led >= LED_LABEL_EM * Math.max(MIN_LABEL, 1.75 * u) + 4;

// --- Portrait: a vertical handheld, width-driven -------------------------------------------
// Console width = 100u. The grid rows (console.css) are: top strip 5u | bezel (11u + screen) |
// brand 9u | D-pad/AB 3.4c + 3.5u gap | bottom row max(46px, 9u), plus 3.5u of bottom padding.
const PORTRAIT_FIXED_U = 5 + BEZEL_Y_U + 9 + 3.5 + 3.5;
/** Narrowest portrait body whose controls (44px arms and buttons) still fit side by side. */
const PORTRAIT_MIN_W = 308;
/** Never stretch the body past a 1 : 1.9 brick: spare height on tall phones stays page, not plastic. */
const PORTRAIT_MAX_ASPECT = 1.9;

// Narrow phones. The standard chrome (5u of plastic each side, a 10u LED column, a 4.5u bezel edge)
// leaves the screen 75.5% of the body: about 232px on a 320px-wide phone, under one CSS pixel per game
// pixel. Up to SLIM_END_W the chrome thins out (the LED column shrinks to a dot) until the screen
// reaches about 90% of the body. The ramp keeps the screen size smooth between phones.
const SLIM_START_W = 316;
const SLIM_END_W = 350;
/** Chrome in u at the thin end of the ramp: plastic each side, LED column, bezel edge. */
const SLIM_PAD_U = 2;
const SLIM_LED_U = 3.4;
const SLIM_EDGE_U = 2.2;
/** Body widths up to this count as the smallest phones (viewports up to ~340px). */
const TIGHT_MAX_W = 336;

const solvePortrait = (availW: number, availH: number, gameW: number, gameH: number): Metrics => {
  const maxW = clamp(0.58 * availH, 460, 600);
  const cw = Math.max(Math.min(availW, maxW), PORTRAIT_MIN_W); // narrower viewports shrink via `fit`
  const u = cw / 100;
  const c = clamp(0.14 * cw, MIN_TOUCH, 62);
  const t = clamp((cw - SLIM_START_W) / (SLIM_END_W - SLIM_START_W), 0, 1);
  const pad = lerp(SLIM_PAD_U, 5, t) * u;
  const led = lerp(SLIM_LED_U, LED_U, t) * u;
  const edge = lerp(SLIM_EDGE_U, EDGE_U, t) * u;
  const fixedH = PORTRAIT_FIXED_U * u + 3.4 * c + Math.max(46, 9 * u);
  // A short viewport shrinks the screen rather than the controls
  const swByHeight = ((availH - fixedH) * gameW) / gameH;
  const sw = Math.max(Math.min(cw - 2 * pad - led - edge, swByHeight), 160); // below this `fit` takes over
  const sh = (sw * gameH) / gameW;
  // Fill the height on phones, but never stretch past the brick cap
  const ch = Math.max(fixedH + sh, Math.min(availH, PORTRAIT_MAX_ASPECT * cw));
  return {
    mode: 'portrait',
    u,
    c,
    cw,
    ch,
    sw,
    sh,
    side: 0,
    pad,
    led,
    edge,
    ledLabel: ledLabelFit(led, u),
    caps: capsFit(led + sw + edge, u),
    brand: true,
    tight: cw <= TIGHT_MAX_W,
  };
};

// --- Landscape: D-pad | bezel | A-B, solved from the screen height -------------------------
// Compact (short windows) has three rows, shared by the side columns: brand | D-pad (A-B) | SELECT
// (START). Their sizes are mirrored in console.css, so the pad can never reach a neighbour.
const brandH = (u: number): number => 6.2 * u + 1.2 * u + Math.max(MIN_LABEL, 1.9 * u); // logo + gap + tag
const COMPACT_PILL_PAD_U = 2.5; // above and below the START/SELECT pill inside its button
const compactPillH = (u: number): number =>
  Math.max(
    46,
    (2 * COMPACT_PILL_PAD_U + 3.6) * u +
      Math.max(MIN_LABEL, 2.1 * u) + // label
      Math.max(MIN_LABEL, 1.85 * u) + 2, // room for the keyboard hint under the label
  );
/** Below this window height the compact brand row makes way for the pad and buttons. */
const COMPACT_BRAND_MIN_H = 236;

const landscapeMetrics = (
  sh: number,
  compact: boolean,
  brand: boolean,
  gameW: number,
  gameH: number,
): Metrics => {
  const u = clamp(3 + (sh - 300) * 0.008, 3, 6.2);
  const c = clamp(0.085 * sh, MIN_TOUCH, 62);
  const sw = (sh * gameW) / gameH;
  const side = 3.45 * c + 2 * u;
  const pad = compact ? 2.5 * u : 3 * u;
  const cw = 2 * side + BEZEL_X_U * u + sw + 2 * pad;
  // compact: bezel only (START/SELECT live in the side columns); tall: top strip, bezel, under-bezel row.
  // On narrow phones the screen is small, so the side columns set the height: the top row, the D-pad
  // box (arms plus tap slop) and the START/SELECT row, one above the other, plus the console padding.
  const sideColumnH = Math.max(brand ? brandH(u) : 0, 3.6 * u) + 3.3 * c + compactPillH(u) + 4 * u;
  const ch = compact
    ? Math.max(BEZEL_Y_U * u + sh + 4 * u, sideColumnH)
    : (5 + BEZEL_Y_U + 4.5) * u + sh + Math.max(46, 12 * u);
  return {
    mode: compact ? 'compact' : 'landscape',
    u,
    c,
    cw,
    ch,
    sw,
    sh,
    side,
    pad,
    led: LED_U * u,
    edge: EDGE_U * u,
    ledLabel: ledLabelFit(LED_U * u, u),
    caps: capsFit(BEZEL_X_U * u + sw, u),
    brand,
    tight: false,
  };
};

const solveLandscape = (
  availW: number,
  availH: number,
  gameW: number,
  gameH: number,
  dpr: number,
): Metrics => {
  const compact = availH < 560;
  const brand = !compact || availH >= COMPACT_BRAND_MIN_H;
  const fits = (sh: number): boolean => {
    const m = landscapeMetrics(sh, compact, brand, gameW, gameH);
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
  const d = snapScale((sh / gameH) * dpr);
  if (Number.isInteger(d)) sh = (d * gameH) / dpr;
  return landscapeMetrics(sh, compact, brand, gameW, gameH);
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
