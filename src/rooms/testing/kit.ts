// The Testing Lab's apparatus, drawn once: the walk-around map slices these into 16x16 tiles and the test
// stage draws the same pieces, so the lab and the stage always match. Everything is built at start-up from
// pixel grids (see pixels.ts); nothing here touches the DOM until a piece is painted.
import { createPixels, type Grid, type Pixels } from './pixels';

/**
 * The lab palette plus the few extra colours the equipment needs (cone orange, LED green, a pale LCD...).
 * Indices 0-5 are the `lab` palette itself, so tiles drawn with only those still match the room.
 */
export const LABX: readonly string[] = [
  '#080808', // 0 outline
  '#1b3a5c', // 1 dark blue
  '#4878a8', // 2 mid blue
  '#88b8d8', // 3 light blue
  '#f0e8d8', // 4 cream floor
  '#d0a830', // 5 gold
  '#c83030', // 6 red
  '#e87820', // 7 orange
  '#38a848', // 8 green
  '#f8f8f0', // 9 white
  '#a8b0b8', // 10 grey metal
  '#505868', // 11 steel
  '#0e2038', // 12 dark screen
  '#b0d8a8', // 13 pale LCD
  '#cdeed3', // 14 pale green (a good result)
  '#f0b8a8', // 15 pale red (a poor one)
];

/** Names for the palette indices, so the art below reads. */
export const C = {
  outline: 0,
  dark: 1,
  mid: 2,
  light: 3,
  cream: 4,
  gold: 5,
  red: 6,
  orange: 7,
  green: 8,
  white: 9,
  grey: 10,
  steel: 11,
  screen: 12,
  lcd: 13,
  paleGreen: 14,
  paleRed: 15,
} as const;

// ---- painting grids ------------------------------------------------------------------------------

// Each (grid, colour list) is rasterised once; colour lists are module constants, so the cache is keyed by the list itself
const canvases = new WeakMap<Grid, Map<readonly string[], HTMLCanvasElement>>();

/** Draw a grid at (x, y), clear pixels left alone. */
export const paintGrid = (
  ctx: CanvasRenderingContext2D,
  grid: Grid,
  x: number,
  y: number,
  colors: readonly string[] = LABX,
): void => {
  let byColors = canvases.get(grid);
  if (!byColors) {
    byColors = new Map();
    canvases.set(grid, byColors);
  }
  let canvas = byColors.get(colors);
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.width = grid[0]?.length ?? 0;
    canvas.height = grid.length;
    const c = canvas.getContext('2d');
    if (c) {
      grid.forEach((row, j) =>
        row.forEach((v, i) => {
          const color = colors[v];
          if (v < 0 || !color) return;
          c.fillStyle = color;
          c.fillRect(i, j, 1, 1);
        }),
      );
    }
    byColors.set(colors, canvas);
  }
  if (canvas.width === 0 || canvas.height === 0) return;
  ctx.drawImage(canvas, Math.floor(x), Math.floor(y));
};

/** Fill a rectangle with a lab palette colour. */
export const fill = (ctx: CanvasRenderingContext2D, index: number, x: number, y: number, w: number, h: number): void => {
  ctx.fillStyle = LABX[index] ?? '#000';
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
};

// Backgrounds are painted once per size and blitted
const backdrops = new Map<string, HTMLCanvasElement>();

const backdrop = (key: string, w: number, h: number, paint: (c: CanvasRenderingContext2D) => void): HTMLCanvasElement => {
  let canvas = backdrops.get(key);
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const c = canvas.getContext('2d');
    if (c) paint(c);
    backdrops.set(key, canvas);
  }
  return canvas;
};

// ---- floor and wall -------------------------------------------------------------------------------

/** Floor tile with a light grid line on two edges: reads as lab tiles. */
const floorGrid = (): Grid => {
  const c = createPixels(16, 16, C.cream);
  c.hline(0, 15, 16, C.light).vline(15, 0, 16, C.light);
  c.px(15, 15, C.mid).px(7, 7, C.light);
  return c.grid;
};
export const FLOOR: Grid = floorGrid();

// The floor is painted once, at the largest size any window needs, and a corner of it is blitted for each window
const FLOOR_W = 256;
const FLOOR_H = 160;

/** The lab floor, tiled over a rectangle (from its top left corner: the pattern starts at the rectangle's origin). */
export const paintFloor = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void => {
  const canvas = backdrop('floor', FLOOR_W, FLOOR_H, c => {
    for (let ty = 0; ty < FLOOR_H; ty += 16) for (let tx = 0; tx < FLOOR_W; tx += 16) paintGrid(c, FLOOR, tx, ty);
  });
  const cw = Math.min(w, FLOOR_W);
  const ch = Math.min(h, FLOOR_H);
  if (cw > 0 && ch > 0) ctx.drawImage(canvas, 0, 0, cw, ch, Math.round(x), Math.round(y), cw, ch);
};

/** The painted wall under the brick row: plaster, a blue dado rail and dark skirting. `w` tiles wide. */
const wallFace = (w = 1): Pixels => {
  const c = createPixels(16 * w, 16, C.cream);
  c.hline(0, 0, 16 * w, C.dark).hline(0, 1, 16 * w, C.light);
  for (let i = 0; i < w; i++) c.vline(i * 16, 2, 8, C.light);
  c.hline(0, 10, 16 * w, C.light).rect(0, 11, 16 * w, 2, C.mid).rect(0, 13, 16 * w, 3, C.dark);
  return c;
};

/** An object drawn over a background, with its own 1px outline. */
const over = (bg: Pixels, obj: Pixels): Pixels => bg.clone().blit(obj.clone().outline());

const floorPixels = (w: number, h: number): Pixels => createPixels(w * 16, h * 16).tileFill(FLOOR);

const cabinet = (): Grid => {
  const o = createPixels(16, 16);
  o.rect(1, 1, 14, 15, C.mid).hline(1, 1, 14, C.light);
  o.rect(3, 3, 10, 7, C.dark).rect(4, 4, 8, 5, C.light);
  // folders and boxes seen through the glass
  o.rect(5, 5, 2, 4, C.gold).rect(8, 4, 2, 5, C.mid).rect(11, 5, 1, 4, C.gold).px(5, 4, C.dark).px(8, 3, C.dark);
  o.hline(3, 11, 10, C.dark).vline(8, 12, 3, C.dark).px(7, 13, C.gold).px(9, 13, C.gold);
  return over(wallFace(), o).slice(0, 0, C.cream);
};

const board = (): [Grid, Grid] => {
  const o = createPixels(32, 16);
  o.rect(1, 1, 30, 12, C.light).rect(2, 2, 28, 10, C.white).hline(3, 12, 26, C.mid);
  // scribbled notes on the left, a rising curve with two guide lines on the right
  o.hline(4, 4, 9, C.mid).hline(4, 6, 12, C.light).hline(4, 8, 7, C.light).hline(4, 10, 10, C.light);
  o.vline(18, 3, 8, C.dark).hline(18, 10, 11, C.dark);
  o.hline(19, 5, 10, C.red).hline(19, 8, 10, C.gold);
  [[19, 9], [21, 9], [23, 8], [25, 6], [26, 4], [27, 3]].forEach(([x, y]) => o.px(x ?? 0, y ?? 0, C.dark));
  const c = over(wallFace(2), o);
  return [c.slice(0, 0, C.cream), c.slice(1, 0, C.cream)];
};

const windowPair = (): [Grid, Grid] => {
  const o = createPixels(32, 16);
  o.rect(1, 1, 30, 12, C.mid).rect(3, 3, 12, 8, C.light).rect(17, 3, 12, 8, C.light);
  o.line(4, 9, 8, 4, C.white).line(5, 10, 9, 5, C.white).line(18, 9, 22, 4, C.white).line(19, 10, 23, 5, C.white);
  o.hline(0, 13, 32, C.mid);
  const c = over(wallFace(2), o);
  return [c.slice(0, 0, C.cream), c.slice(1, 0, C.cream)];
};

/** The wall clock's face: its hands are drawn live (see drawClock in data/rooms/testing-life.ts). */
const clock = (): Grid => {
  const o = createPixels(16, 16);
  o.disc(8, 7, 5, C.white).px(8, 2, C.gold).px(8, 12, C.dark).px(3, 7, C.dark).px(13, 7, C.dark);
  o.px(8, 7, C.outline);
  return over(wallFace(), o).slice(0, 0, C.cream);
};

// ---- the treadmill and gas cart ---------------------------------------------------------------------

/** Where the treadmill's moving belt is inside its 48x32 picture, between the rollers at each end (drawn live so it can move). */
export const TREADMILL_BELT = { x: 6, y: 24, w: 36, h: 4 } as const;

/** Side view, console at the front on the right (the runner faces right, like everything on the stage). */
const treadmillPixels = (): Pixels => {
  const o = createPixels(48, 32);
  // deck, belt and the rollers at each end (a pixel of margin all round, for the outline)
  o.rect(1, 24, 46, 7, C.mid).hline(1, 24, 46, C.light).rect(1, 29, 46, 2, C.dark);
  o.rect(3, 24, 42, 4, C.dark);
  o.disc(3, 26, 2, C.light).px(3, 26, C.dark).disc(44, 26, 2, C.light).px(44, 26, C.dark);
  // console tower and its screen
  o.rect(39, 12, 5, 12, C.mid).vline(39, 12, 12, C.light);
  o.rect(35, 2, 11, 10, C.dark).rect(37, 3, 7, 5, C.lcd);
  o.hline(38, 4, 5, C.dark).hline(38, 6, 3, C.dark); // a reading and a shorter bar under it
  o.px(37, 10, C.red).px(40, 10, C.gold).px(43, 10, C.light);
  // handrail back to a rear post
  o.rect(8, 13, 28, 2, C.light).hline(8, 14, 28, C.mid).rect(36, 13, 3, 2, C.mid);
  o.rect(6, 13, 3, 11, C.mid).vline(6, 13, 11, C.light);
  return o;
};

const TREADMILL_RAW: Pixels = treadmillPixels();
/** The treadmill with its belt blank (dark), outlined, for the stage. */
export const TREADMILL_PICTURE: Pixels = TREADMILL_RAW.clone().outline();

/** Six tiles: [rear, middle, console] for the upper row, then the same for the lower row. */
const treadmillTiles = (): Grid[] => {
  const c = over(floorPixels(3, 2), TREADMILL_RAW);
  return [0, 1].flatMap(ty => [0, 1, 2].map(tx => c.slice(tx, ty, C.cream)));
};

/** Gas analysis cart: a monitor on a trolley. The trace on its screen is drawn live. */
export const CART_SCREEN = { x: 3, y: 2, w: 10, h: 7 } as const;
const cartPixels = (): Pixels => {
  const o = createPixels(16, 32);
  o.rect(2, 1, 12, 10, C.dark).rect(3, 2, 10, 7, C.lcd);
  o.px(12, 3, C.green).px(11, 3, C.green);
  o.rect(7, 11, 2, 3, C.dark).rect(4, 13, 8, 2, C.mid);
  o.rect(1, 15, 14, 2, C.light).rect(2, 17, 12, 11, C.mid).vline(2, 17, 11, C.light).vline(13, 17, 11, C.dark);
  o.hline(3, 22, 10, C.dark).rect(6, 20, 4, 1, C.gold).rect(6, 25, 4, 1, C.gold);
  o.rect(14, 17, 1, 8, C.red);
  o.rect(3, 28, 3, 3, C.dark).rect(10, 28, 3, 3, C.dark);
  return o;
};
const CART_RAW: Pixels = cartPixels();
export const CART_PICTURE: Pixels = CART_RAW.clone().outline();
const cartTiles = (): [Grid, Grid] => {
  const c = over(floorPixels(1, 2), CART_RAW);
  return [c.slice(0, 0, C.cream), c.slice(0, 1, C.cream)];
};

// ---- the cycle ergometer -------------------------------------------------------------------------------

/** Where the flywheel's middle, the cranks' middle and the saddle are on the ergometer's 32x32 picture. */
export const ERGOMETER_PARTS = {
  flywheel: { x: 22, y: 21 },
  crank: { x: 13, y: 22 },
  saddle: { x: 9, y: 9 },
  grips: { x: 22, y: 7 },
} as const;

/** Side view at the athlete's own scale, handlebars and flywheel at the right (the rider faces right). */
const ergometerPixels = (): Pixels => {
  const o = createPixels(32, 32);
  o.rect(3, 29, 26, 2, C.dark).rect(1, 27, 6, 3, C.mid).rect(25, 27, 6, 3, C.mid);
  // flywheel at the front, a glint on its rim
  o.disc(22, 21, 6, C.mid).disc(22, 21, 4, C.dark).disc(22, 21, 1, C.light).px(22, 21, C.gold);
  o.px(18, 17, C.light).px(19, 16, C.light).px(20, 15, C.light);
  // frame: saddle post, the tube to the flywheel, the handlebar post
  o.rect(11, 21, 11, 2, C.mid).hline(11, 21, 11, C.light);
  o.rect(9, 11, 3, 16, C.mid).vline(9, 11, 16, C.light);
  o.rect(24, 8, 3, 9, C.mid).vline(24, 8, 9, C.light);
  // saddle and handlebar console
  o.rect(4, 9, 11, 3, C.dark).hline(4, 9, 11, C.mid);
  o.rect(20, 5, 10, 3, C.dark).rect(21, 6, 6, 1, C.lcd).px(28, 6, C.gold);
  // bottom bracket and a pedal
  o.disc(13, 22, 2, C.light).px(13, 22, C.dark);
  o.rect(10, 25, 6, 2, C.dark);
  return o;
};
const ERGOMETER_RAW: Pixels = ergometerPixels();
export const ERGOMETER_PICTURE: Pixels = ERGOMETER_RAW.clone().outline();
const ergometerTiles = (): Grid[] => {
  const c = over(floorPixels(2, 2), ERGOMETER_RAW);
  return [c.slice(0, 0, C.cream), c.slice(1, 0, C.cream), c.slice(0, 1, C.cream), c.slice(1, 1, C.cream)];
};

// ---- lane, gates, cones ---------------------------------------------------------------------------------

const rubber = (c: Pixels): Pixels => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (x % 4 === 1 && y % 4 === 2) c.px(x, y, C.mid);
  return c;
};

/** Lane tiles: the upper half has its edge line on top, the lower half at the bottom, a dashed centre between. */
const laneGrid = (upper: boolean): Grid => {
  const c = rubber(createPixels(16, 16, C.light));
  if (upper) {
    c.rect(0, 0, 16, 2, C.mid);
    for (let x = 0; x < 16; x++) if (x % 8 < 5) c.px(x, 15, C.cream);
  } else {
    c.rect(0, 14, 16, 2, C.mid);
    for (let x = 0; x < 16; x++) if (x % 8 < 5) c.px(x, 0, C.cream);
  }
  return c.grid;
};
const LANE_UPPER: Grid = laneGrid(true);
const LANE_LOWER: Grid = laneGrid(false);

/** A lane strip like the lab's (edge lines, rubber with its dots, a dashed centre), w wide and h tall. */
export const paintLane = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void => {
  const canvas = backdrop(`lane${w}x${h}`, w, h, c => {
    fill(c, C.mid, 0, 0, w, h);
    fill(c, C.light, 0, 2, w, h - 4);
    for (let j = 2; j < h - 2; j++) for (let i = 0; i < w; i++) if (i % 4 === 1 && j % 4 === 2) fill(c, C.mid, i, j, 1, 1);
    for (let i = 0; i < w; i++) if (i % 8 < 5) fill(c, C.cream, i, Math.floor(h / 2), 1, 1);
  });
  ctx.drawImage(canvas, Math.round(x), Math.round(y));
};

/** One post of a timing gate seen from above: a small box with a lens facing the lane. */
const drawGatePost = (ctx: CanvasRenderingContext2D, cx: number, top: number, lens: number, lit: boolean): void => {
  fill(ctx, C.outline, cx - 3, top, 6, 7);
  fill(ctx, C.mid, cx - 2, top + 1, 4, 5);
  fill(ctx, C.light, cx - 2, top + 1, 1, 5);
  fill(ctx, lit ? C.gold : C.red, cx, lens, 1, 1);
};

/**
 * A timing gate seen from above, across a lane: a small post each side and the beam between them. `lit`
 * is the moment the athlete cuts the beam (the beam flashes gold).
 */
export const drawGateMarks = (ctx: CanvasRenderingContext2D, x: number, yTop: number, yBottom: number, lit: boolean): void => {
  const cx = Math.round(x);
  if (lit) {
    fill(ctx, C.gold, cx - 1, yTop, 3, yBottom - yTop);
    fill(ctx, C.white, cx, yTop, 1, yBottom - yTop);
  } else {
    for (let y = yTop + 1; y < yBottom; y += 3) fill(ctx, C.red, cx, y, 1, 1);
  }
  drawGatePost(ctx, cx, yTop - 7, yTop - 3, lit);
  drawGatePost(ctx, cx, yBottom + 1, yBottom + 2, lit);
};

/** The start line sits at the left of its tile, so the athlete can wait on the tile before it. */
const startLine = (upper: boolean): Grid => {
  const c = createPixels(16, 16).tileFill(upper ? LANE_UPPER : LANE_LOWER);
  c.rect(2, 0, 3, 16, C.gold).vline(1, 0, 16, C.outline).vline(5, 0, 16, C.outline);
  return c.grid;
};

const finishLine = (upper: boolean): Grid => {
  const c = createPixels(16, 16).tileFill(upper ? LANE_UPPER : LANE_LOWER);
  for (let y = 0; y < 16; y++) {
    for (let x = 3; x < 11; x++) c.px(x, y, (Math.floor(y / 4) + Math.floor((x - 3) / 4)) % 2 ? C.outline : C.cream);
  }
  return c.grid;
};

/** A timing-gate post on the lane's edge; the lens faces the lane. */
const gatePost = (lensLow: boolean): Pixels => {
  const o = createPixels(16, 16);
  o.rect(6, 1, 4, 13, C.mid).vline(6, 1, 13, C.light).vline(9, 1, 13, C.dark).rect(5, 0, 6, 2, C.dark);
  o.rect(7, lensLow ? 9 : 4, 2, 2, C.red);
  o.rect(4, 13, 8, 2, C.dark);
  return o;
};

const gateTile = (lensLow: boolean): Grid => over(createPixels(16, 16).tileFill(FLOOR), gatePost(lensLow)).slice(0, 0, C.cream);

const cone = (): Pixels => {
  const o = createPixels(16, 16);
  o.rect(7, 3, 2, 3, C.orange).rect(6, 6, 4, 2, C.white).rect(6, 8, 4, 1, C.orange).rect(5, 9, 6, 2, C.orange).rect(4, 11, 8, 2, C.dark);
  return o;
};
const CONE_RAW: Pixels = cone();
const CONE_PICTURE: Pixels = CONE_RAW.clone().outline();
const coneTile = (): Grid => over(createPixels(16, 16).tileFill(FLOOR), CONE_RAW).slice(0, 0, C.cream);

/** A cone standing with its base on `groundY`, centred on x (it is 10 wide and 12 tall). */
export const paintCone = (ctx: CanvasRenderingContext2D, x: number, groundY: number): void =>
  paintGrid(ctx, CONE_PICTURE.grid, x - 8, groundY - 13);

// ---- the lactate bench ---------------------------------------------------------------------------------------

type BenchTop = 'analyser' | 'rack' | 'laptop' | 'centrifuge' | 'log' | 'watches';

/** Where the analyser's little display is on its tile (drawn live so it can blink). */
export const ANALYSER_LCD = { x: 4, y: 3, w: 8, h: 4 } as const;
/** Where the laptop's screen is on its tile. */
export const LAPTOP_SCREEN = { x: 4, y: 2, w: 8, h: 6 } as const;

const benchTop = (kind: BenchTop): Grid => {
  const o = createPixels(16, 16);
  o.rect(0, 11, 16, 5, C.light).hline(0, 11, 16, C.cream).hline(0, 15, 16, C.mid);
  if (kind === 'analyser') {
    o.rect(2, 2, 12, 9, C.mid).hline(2, 2, 12, C.light).rect(4, 3, 8, 4, C.lcd);
    o.rect(6, 8, 4, 1, C.dark).px(12, 9, C.gold);
    o.px(3, 9, C.red).px(3, 8, C.red);
  } else if (kind === 'rack') {
    o.rect(2, 7, 12, 4, C.mid).hline(2, 7, 12, C.light);
    [[3, C.red], [6, C.gold], [9, C.red], [12, C.light]].forEach(([x, c]) => {
      o.rect((x ?? 0) - 1, 3, 2, 6, c ?? C.red).px((x ?? 0) - 1, 2, C.dark);
    });
  } else if (kind === 'laptop') {
    o.rect(3, 1, 10, 8, C.dark).rect(4, 2, 8, 6, C.lcd);
    o.hline(5, 4, 6, C.dark).hline(5, 6, 4, C.mid);
    o.rect(2, 9, 12, 2, C.steel);
  } else if (kind === 'log') {
    o.rect(2, 4, 8, 7, C.white).hline(3, 6, 5, C.mid).hline(3, 8, 4, C.mid);
    o.rect(11, 6, 3, 5, C.dark).rect(11, 6, 3, 1, C.light).px(12, 8, C.gold);
    o.rect(10, 3, 5, 2, C.mid);
  } else if (kind === 'watches') {
    o.disc(5, 8, 2, C.white).px(5, 5, C.dark).px(5, 8, C.dark).px(6, 7, C.dark);
    o.disc(11, 8, 2, C.white).px(11, 5, C.dark).px(11, 8, C.dark).px(12, 7, C.dark);
    o.hline(3, 10, 10, C.mid);
  } else {
    o.disc(8, 7, 5, C.mid).disc(8, 7, 3, C.dark).px(8, 7, C.gold).px(5, 5, C.light).px(6, 4, C.light);
  }
  return over(createPixels(16, 16).tileFill(FLOOR), o).slice(0, 0, C.cream);
};

const benchFront = (): Grid => {
  const c = createPixels(16, 16, C.mid);
  c.hline(0, 0, 16, C.cream).hline(0, 1, 16, C.light).hline(0, 2, 16, C.outline);
  c.vline(0, 3, 11, C.dark).vline(15, 3, 11, C.dark).hline(3, 6, 1, C.dark).rect(11, 6, 2, 3, C.gold);
  c.rect(0, 14, 16, 2, C.dark);
  return c.grid;
};

// ---- water cooler ----------------------------------------------------------------------------------------------

const cooler = (): Grid => {
  const o = createPixels(16, 16);
  o.stamp(0, 0, [
    '................',
    '.....kkkkkk.....',
    '....klllllllk...',
    '....klwwllllk...',
    '....klwlllllk...',
    '....klllllllk...',
    '.....kkkkkkk....',
    '....kggggggggk..',
    '....kggggggggk..',
    '....kgrgbgggk...',
    '....kggggggggk..',
    '....kgkkkkkgk...',
    '....kggggggggk..',
    '....kssssssssk..',
    '....kkkkkkkkkk..',
    '................',
  ], { k: C.outline, l: C.light, w: C.white, g: C.grey, r: C.red, b: C.mid, s: C.steel });
  return createPixels(16, 16).tileFill(FLOOR).blit(o).slice(0, 0, C.cream);
};

// ---- the wall monitor ------------------------------------------------------------------------------------------

/** The screen's area across the two wall-monitor tiles (the heart trace is drawn live). */
export const WALL_MONITOR = { x: 3, y: 3, w: 26, h: 8 } as const;

const wallMonitor = (): [Grid, Grid] => {
  const o = createPixels(32, 16);
  o.rect(1, 1, 30, 12, C.steel).rect(2, 2, 28, 10, C.dark).rect(3, 3, 26, 8, C.screen);
  o.hline(3, 7, 26, C.dark);
  [8, 14, 20, 26].forEach(x => o.vline(x, 3, 8, C.dark));
  o.px(30, 12, C.green).hline(0, 13, 32, C.mid);
  const c = over(wallFace(2), o);
  return [c.slice(0, 0, C.cream), c.slice(1, 0, C.cream)];
};

// ---- a plant, to soften the corner --------------------------------------------------------------------------------

const plant = (): Grid => {
  const o = createPixels(16, 16);
  o.stamp(0, 0, [
    '................',
    '.......kk.......',
    '....kk.kgk.kk...',
    '...kgkkgggkgk...',
    '..kgggkgggkggk..',
    '..kglgkgglkggk..',
    '...kgggkgggk....',
    '....kggkggk.....',
    '.....kkkgkk.....',
    '.......kgk......',
    '......kkkkk.....',
    '.....kooooook...',
    '.....kooooook...',
    '......kooook....',
    '......kkkkkk....',
    '................',
  ], { k: C.outline, g: C.green, l: C.lcd, o: C.gold });
  return createPixels(16, 16).tileFill(FLOOR).blit(o).slice(0, 0, C.cream);
};

// ---- everything the map needs, by name ------------------------------------------------------------------------------

const [BOARD_LEFT, BOARD_RIGHT] = board();
const [WINDOW_LEFT, WINDOW_RIGHT] = windowPair();
const [TM_REAR_TOP, TM_MID_TOP, TM_CONSOLE_TOP, TM_REAR, TM_MID, TM_CONSOLE] = treadmillTiles() as [Grid, Grid, Grid, Grid, Grid, Grid];
const [MONITOR_LEFT, MONITOR_RIGHT] = wallMonitor();
const [CART_TOP, CART_BASE] = cartTiles();
const [ERGO_TL, ERGO_TR, ERGO_BL, ERGO_BR] = ergometerTiles() as [Grid, Grid, Grid, Grid];

/** One 16x16 pattern per map tile, by name. */
export const TILE_ART = {
  floor: FLOOR,
  wall: wallFace().slice(0, 0, C.cream),
  cabinet: cabinet(),
  boardLeft: BOARD_LEFT,
  boardRight: BOARD_RIGHT,
  windowLeft: WINDOW_LEFT,
  windowRight: WINDOW_RIGHT,
  clock: clock(),
  monitorLeft: MONITOR_LEFT,
  monitorRight: MONITOR_RIGHT,
  treadmillRearTop: TM_REAR_TOP,
  treadmillMidTop: TM_MID_TOP,
  treadmillConsoleTop: TM_CONSOLE_TOP,
  treadmillRear: TM_REAR,
  treadmillMid: TM_MID,
  treadmillConsole: TM_CONSOLE,
  cartTop: CART_TOP,
  cartBase: CART_BASE,
  ergoTopLeft: ERGO_TL,
  ergoTopRight: ERGO_TR,
  ergoBottomLeft: ERGO_BL,
  ergoBottomRight: ERGO_BR,
  laneUpper: LANE_UPPER,
  laneLower: LANE_LOWER,
  startUpper: startLine(true),
  startLower: startLine(false),
  finishUpper: finishLine(true),
  finishLower: finishLine(false),
  gateUpper: gateTile(true),
  gateLower: gateTile(false),
  cone: coneTile(),
  analyser: benchTop('analyser'),
  rack: benchTop('rack'),
  laptop: benchTop('laptop'),
  centrifuge: benchTop('centrifuge'),
  log: benchTop('log'),
  watches: benchTop('watches'),
  benchFront: benchFront(),
  cooler: cooler(),
  plant: plant(),
} as const;

export type TileArtName = keyof typeof TILE_ART;
