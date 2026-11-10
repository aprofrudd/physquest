// The welcome after name entry: a sunny day outside the Sports Performance Centre. A glass tower with the centre's
// name, two glass wings under a gold roof line, flags, trees, a running track and a plaza where the player stands.
// The still scene is painted once into two cached canvases (the sky, and everything in front of it); the sun's rays, drifting clouds, birds, flags and glints
// on the glass are small cached canvases drawn between and over them, moved by the scene's own clock (frozen under reduced motion).
import { drawText, measureText } from './PixelFont';
import { GAME_W } from './DialogueBox';
import { ambientTime } from './motion';

/** The bottom of the visible scene: the dialogue box covers the rest. */
export const CENTRE_VIEW_H = 164;
/** Where the player's feet go: on the plaza, in front of the doors. */
export const CENTRE_FEET_Y = 152;

// Palette: a clear summer sky, warm sun, cool glass, white frames, gold trim
const SKY = ['#2f7fe0', '#3f8fea', '#52a0f2', '#68b2f6', '#80c4fa', '#9ad4fc', '#b6e2fd'];
const SUN_CORE = '#fffbe0';
const SUN = '#ffe04a';
const SUN_EDGE = '#ffc21e';
const RAY = '#fff09a';
const CLOUD = '#ffffff';
const CLOUD_SHADE = '#dceefc';
const HILL_FAR = '#7ccf8a';
const HILL_NEAR = '#4fb062';
const GLASS_DARK = '#2a6fb0';
const GLASS = '#4ea6dc';
const GLASS_LIGHT = '#8fd6f4';
const GLASS_GLINT = '#e8fbff';
const FRAME = '#f4f6f8';
const FRAME_SHADE = '#b8c4cc';
const STEEL = '#5c6a78';
const GOLD = '#f4b81c';
const GOLD_DARK = '#c2860a';
const SIGN_PLATE = '#16243a';
const SIGN_TEXT = '#ffffff';
const SIGN_ACCENT = '#ffd23c';
const DOOR = '#a8e4f8';
const PLAZA = '#efe4cc';
const PLAZA_LINE = '#ddcfb0';
const PLAZA_PATH = '#f8f2e2';
const GRASS = '#5cc04e';
const GRASS_DARK = '#3f9e3a';
const GRASS_LIGHT = '#86d86a';
const TRUNK = '#7a4a26';
const LEAF = '#3fa83e';
const LEAF_DARK = '#2a7f30';
const LEAF_LIGHT = '#7ad35a';
const TRACK = '#d8573a';
const TRACK_DARK = '#b84428';
const LANE = '#fff6ea';
const OUTLINE = '#1a2a3a';
const FLAG_COLORS = [
  ['#e8402c', '#ffffff'],
  ['#ffd23c', '#2f7fe0'],
  ['#2fb06a', '#ffffff'],
] as const;

// Layout (game pixels)
const HORIZON_Y = 78;
const GROUND_Y = 114; // the building's foot and the plaza's top edge
const TOWER_X = 88;
const TOWER_W = 80;
const TOWER_Y = 14;
const WING_Y = 48;
const LEFT_WING_X = 18;
const RIGHT_WING_X = TOWER_X + TOWER_W;
const WING_W = TOWER_X - LEFT_WING_X;
const DOOR_W = 32;
const DOOR_X = TOWER_X + (TOWER_W - DOOR_W) / 2;
const DOOR_Y = 90;
const TRACK_Y = 154;
const SUN_X = 222;
const FLAG_TOP = 96;
const FLAG_POLES = [74, 84, 172, 182] as const;
const SUN_Y = 22;

const makeCanvas = (w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] => {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return [canvas, canvas.getContext('2d')!];
};

const rect = (ctx: CanvasRenderingContext2D, color: string, x: number, y: number, w: number, h: number) => {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
};

/** A filled circle in pixel steps. */
const disc = (ctx: CanvasRenderingContext2D, color: string, cx: number, cy: number, r: number) => {
  ctx.fillStyle = color;
  for (let dy = -r; dy <= r; dy++) {
    const half = Math.floor(Math.sqrt(r * r - dy * dy) + 0.35);
    ctx.fillRect(cx - half, cy + dy, half * 2 + 1, 1);
  }
};

// ---- the still scene ---------------------------------------------------------------------------------------------

const paintSky = (ctx: CanvasRenderingContext2D) => {
  const band = Math.ceil(HORIZON_Y / SKY.length);
  for (let i = 0; i < SKY.length; i++) {
    rect(ctx, SKY[i]!, 0, i * band, GAME_W, band);
    // a dithered seam into the next band, so the sky reads as a smooth blend
    const next = SKY[i + 1];
    if (next) {
      ctx.fillStyle = next;
      const y = (i + 1) * band - 2;
      for (let x = (i % 2); x < GAME_W; x += 2) ctx.fillRect(x, y + (x % 4 === 0 ? 0 : 1), 1, 1);
    }
  }
};

const paintHills = (ctx: CanvasRenderingContext2D) => {
  for (let x = 0; x < GAME_W; x++) {
    const far = Math.round(HORIZON_Y - 10 - 6 * Math.sin(x / 23) - 3 * Math.sin(x / 9 + 1));
    rect(ctx, HILL_FAR, x, far, 1, GROUND_Y - far);
    const near = Math.round(HORIZON_Y + 2 - 5 * Math.sin(x / 31 + 2) - 2 * Math.sin(x / 13));
    rect(ctx, HILL_NEAR, x, near, 1, GROUND_Y - near);
  }
};

/** A glass panel grid with white mullions and a diagonal sheen across it. */
const paintGlass = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, pane: number) => {
  rect(ctx, GLASS, x, y, w, h);
  // darker toward the bottom: the sky reflects in the top panes
  rect(ctx, GLASS_DARK, x, y + Math.floor(h * 0.7), w, h - Math.floor(h * 0.7));
  rect(ctx, GLASS_LIGHT, x, y, w, Math.max(2, Math.floor(h * 0.18)));
  // diagonal sheen bands
  ctx.fillStyle = GLASS_LIGHT;
  for (let d = 0; d < w + h; d += 26) {
    for (let k = 0; k < 4; k++) {
      for (let j = 0; j < h; j++) {
        const px = x + d + k - j;
        if (px >= x && px < x + w) ctx.fillRect(px, y + j, 1, 1);
      }
    }
  }
  // mullions
  ctx.fillStyle = FRAME;
  for (let px = x; px <= x + w; px += pane) ctx.fillRect(Math.min(px, x + w - 1), y, 1, h);
  for (let py = y; py <= y + h; py += pane) ctx.fillRect(x, Math.min(py, y + h - 1), w, 1);
};

const paintWing = (ctx: CanvasRenderingContext2D, x: number, w: number, roofLeft: boolean) => {
  const h = GROUND_Y - WING_Y;
  // body and glass
  rect(ctx, OUTLINE, x - 1, WING_Y - 1, w + 2, h + 1);
  rect(ctx, FRAME, x, WING_Y, w, h);
  paintGlass(ctx, x + 3, WING_Y + 9, w - 6, h - 15, 10);
  // the gold roof line, sweeping up toward the tower
  for (let i = 0; i < w; i++) {
    const t = roofLeft ? i / w : 1 - i / w;
    const lift = Math.round(t * t * 6);
    rect(ctx, OUTLINE, x + i, WING_Y - 4 - lift, 1, 1);
    rect(ctx, GOLD, x + i, WING_Y - 3 - lift, 1, 3 + lift);
    rect(ctx, GOLD_DARK, x + i, WING_Y, 1, 1);
  }
  rect(ctx, FRAME_SHADE, x, WING_Y + 6, w, 1);
  // a base band
  rect(ctx, FRAME_SHADE, x, GROUND_Y - 6, w, 6);
  rect(ctx, FRAME, x, GROUND_Y - 6, w, 1);
};

const paintTower = (ctx: CanvasRenderingContext2D) => {
  const h = GROUND_Y - TOWER_Y;
  rect(ctx, OUTLINE, TOWER_X - 1, TOWER_Y - 1, TOWER_W + 2, h + 1);
  rect(ctx, FRAME, TOWER_X, TOWER_Y, TOWER_W, h);
  // the roof: a gold crown with a white canopy edge
  rect(ctx, OUTLINE, TOWER_X - 5, TOWER_Y - 5, TOWER_W + 10, 6);
  rect(ctx, GOLD, TOWER_X - 4, TOWER_Y - 4, TOWER_W + 8, 4);
  rect(ctx, GOLD_DARK, TOWER_X - 4, TOWER_Y - 1, TOWER_W + 8, 1);
  rect(ctx, '#fff2b0', TOWER_X - 4, TOWER_Y - 4, TOWER_W + 8, 1);
  // tall glass atrium
  paintGlass(ctx, TOWER_X + 4, TOWER_Y + 38, TOWER_W - 8, DOOR_Y - TOWER_Y - 44, 12);

  // the sign: SPORTS / PERFORMANCE / CENTRE on a dark plate, with gold rules
  const plateX = TOWER_X + 3;
  const plateY = TOWER_Y + 4;
  const plateW = TOWER_W - 6;
  const plateH = 31;
  rect(ctx, OUTLINE, plateX - 1, plateY - 1, plateW + 2, plateH + 2);
  rect(ctx, SIGN_PLATE, plateX, plateY, plateW, plateH);
  rect(ctx, SIGN_ACCENT, plateX + 2, plateY + 2, plateW - 4, 1);
  rect(ctx, SIGN_ACCENT, plateX + 2, plateY + plateH - 3, plateW - 4, 1);
  const line = (text: string, y: number, color: string) =>
    drawText(ctx, text, Math.round(TOWER_X + (TOWER_W - (measureText(text) - 1)) / 2), y, color);
  line('SPORTS', plateY + 5, SIGN_ACCENT);
  line('PERFORMANCE', plateY + 13, SIGN_TEXT);
  line('CENTRE', plateY + 21, SIGN_ACCENT);

  // the entrance: a gold canopy over sliding glass doors
  rect(ctx, OUTLINE, DOOR_X - 9, DOOR_Y - 5, DOOR_W + 18, 5);
  rect(ctx, GOLD, DOOR_X - 8, DOOR_Y - 4, DOOR_W + 16, 3);
  rect(ctx, '#fff2b0', DOOR_X - 8, DOOR_Y - 4, DOOR_W + 16, 1);
  rect(ctx, STEEL, DOOR_X - 1, DOOR_Y, DOOR_W + 2, GROUND_Y - DOOR_Y);
  rect(ctx, DOOR, DOOR_X, DOOR_Y + 1, DOOR_W / 2 - 1, GROUND_Y - DOOR_Y - 1);
  rect(ctx, DOOR, DOOR_X + DOOR_W / 2 + 1, DOOR_Y + 1, DOOR_W / 2 - 1, GROUND_Y - DOOR_Y - 1);
  rect(ctx, GLASS_GLINT, DOOR_X + 2, DOOR_Y + 3, 2, GROUND_Y - DOOR_Y - 6);
  rect(ctx, GLASS_GLINT, DOOR_X + DOOR_W / 2 + 3, DOOR_Y + 3, 2, GROUND_Y - DOOR_Y - 6);
  rect(ctx, STEEL, DOOR_X + DOOR_W / 2 - 3, DOOR_Y + 12, 2, 6);
  rect(ctx, STEEL, DOOR_X + DOOR_W / 2 + 1, DOOR_Y + 12, 2, 6);
  // pillars either side of the doors
  for (const px of [DOOR_X - 7, DOOR_X + DOOR_W + 3]) {
    rect(ctx, OUTLINE, px - 1, DOOR_Y - 1, 6, GROUND_Y - DOOR_Y + 1);
    rect(ctx, FRAME, px, DOOR_Y, 4, GROUND_Y - DOOR_Y);
    rect(ctx, FRAME_SHADE, px + 3, DOOR_Y, 1, GROUND_Y - DOOR_Y);
  }
};

const paintTree = (ctx: CanvasRenderingContext2D, cx: number, baseY: number, r: number) => {
  rect(ctx, OUTLINE, cx - 2, baseY - r - 2, 5, r + 2);
  rect(ctx, TRUNK, cx - 1, baseY - r - 2, 3, r + 2);
  const cy = baseY - r - 6;
  disc(ctx, OUTLINE, cx, cy, r + 1);
  disc(ctx, LEAF_DARK, cx, cy, r);
  disc(ctx, LEAF, cx - 1, cy - 1, r - 2);
  disc(ctx, LEAF_LIGHT, cx - 3, cy - 3, Math.max(1, Math.floor(r / 3)));
};

const paintBush = (ctx: CanvasRenderingContext2D, cx: number, baseY: number) => {
  disc(ctx, OUTLINE, cx, baseY - 3, 5);
  disc(ctx, LEAF_DARK, cx, baseY - 3, 4);
  disc(ctx, LEAF, cx - 1, baseY - 4, 2);
  rect(ctx, '#ff7aa8', cx + 1, baseY - 5, 1, 1); // a flower or two
  rect(ctx, '#ffe04a', cx - 2, baseY - 2, 1, 1);
};

const paintGround = (ctx: CanvasRenderingContext2D) => {
  // grass all round
  rect(ctx, GRASS, 0, GROUND_Y, GAME_W, 224 - GROUND_Y);
  ctx.fillStyle = GRASS_DARK;
  for (let y = GROUND_Y + 2; y < 224; y += 4) for (let x = (y * 3) % 7; x < GAME_W; x += 7) ctx.fillRect(x, y, 1, 2);
  ctx.fillStyle = GRASS_LIGHT;
  for (let y = GROUND_Y + 4; y < 224; y += 6) for (let x = (y * 5) % 11; x < GAME_W; x += 11) ctx.fillRect(x, y, 1, 1);

  // the plaza: a stone apron along the building, widening to the path from the doors
  const apronY = GROUND_Y;
  rect(ctx, PLAZA, LEFT_WING_X - 4, apronY, GAME_W - 2 * (LEFT_WING_X - 4), 10);
  rect(ctx, PLAZA, 64, apronY, GAME_W - 128, TRACK_Y - apronY);
  ctx.fillStyle = PLAZA_LINE;
  for (let y = apronY + 5; y < TRACK_Y; y += 6) ctx.fillRect(64, y, GAME_W - 128, 1);
  for (let y = apronY; y < TRACK_Y; y += 6) {
    const off = ((y - apronY) / 6) % 2 === 0 ? 0 : 6;
    for (let x = 64 + off; x < GAME_W - 64; x += 12) ctx.fillRect(x, y, 1, 5);
  }
  // a pale path from the doors
  rect(ctx, PLAZA_PATH, DOOR_X - 2, apronY, DOOR_W + 4, TRACK_Y - apronY);
  rect(ctx, PLAZA_LINE, DOOR_X - 3, apronY, 1, TRACK_Y - apronY);
  rect(ctx, PLAZA_LINE, DOOR_X + DOOR_W + 2, apronY, 1, TRACK_Y - apronY);
  rect(ctx, OUTLINE, 63, apronY + 10, 1, TRACK_Y - apronY - 10);
  rect(ctx, OUTLINE, GAME_W - 64, apronY + 10, 1, TRACK_Y - apronY - 10);

  // the running track along the front, lanes and all
  rect(ctx, TRACK, 0, TRACK_Y, GAME_W, 224 - TRACK_Y);
  rect(ctx, TRACK_DARK, 0, TRACK_Y, GAME_W, 1);
  ctx.fillStyle = LANE;
  for (let y = TRACK_Y + 3; y < 224; y += 5) ctx.fillRect(0, y, GAME_W, 1);
  // a start line on the left, just in view
  for (let y = TRACK_Y + 1; y < CENTRE_VIEW_H; y++) rect(ctx, LANE, 22, y, 2, 1);
};

/** Everything in front of the sky (the sky layer shows through where this is left clear). */
const paintFront = (ctx: CanvasRenderingContext2D) => {
  paintHills(ctx);
  paintGround(ctx);
  paintWing(ctx, LEFT_WING_X, WING_W, true);
  paintWing(ctx, RIGHT_WING_X, GAME_W - LEFT_WING_X - RIGHT_WING_X, false);
  paintTower(ctx);
  // planting along the front of the wings
  for (const x of [28, 40, 52, 204, 216, 228]) paintBush(ctx, x, GROUND_Y + 8);
  // trees framing the scene
  paintTree(ctx, 10, 150, 10);
  paintTree(ctx, 44, 152, 8);
  paintTree(ctx, GAME_W - 44, 152, 8);
  paintTree(ctx, GAME_W - 10, 150, 10);
  // flagpoles either side of the path
  for (const x of FLAG_POLES) {
    rect(ctx, OUTLINE, x - 1, FLAG_TOP - 1, 3, GROUND_Y + 14 - FLAG_TOP + 1);
    rect(ctx, FRAME, x, FLAG_TOP, 1, GROUND_Y + 14 - FLAG_TOP);
    rect(ctx, GOLD, x - 1, FLAG_TOP - 2, 3, 2);
  }
};

// ---- the moving parts --------------------------------------------------------------------------------------------

const paintSun = (ctx: CanvasRenderingContext2D, phase: number) => {
  const c = 20;
  // rays: eight spokes, long and short swapping each phase
  ctx.fillStyle = RAY;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + (phase ? Math.PI / 8 : 0);
    const len = i % 2 === phase ? 19 : 16;
    for (let r = 13; r < len; r++) ctx.fillRect(Math.round(c + Math.cos(a) * r), Math.round(c + Math.sin(a) * r), 2, 2);
  }
  disc(ctx, SUN_EDGE, c, c, 11);
  disc(ctx, SUN, c, c, 10);
  disc(ctx, SUN_CORE, c - 2, c - 2, 6);
};

const paintCloud = (ctx: CanvasRenderingContext2D, w: number) => {
  const h = 12;
  const puffs = Math.floor(w / 9);
  for (let i = 0; i < puffs; i++) {
    const cx = 6 + i * ((w - 12) / Math.max(1, puffs - 1));
    const r = i === Math.floor(puffs / 2) ? 6 : 4 + (i % 2);
    disc(ctx, CLOUD, Math.round(cx), h - r, r);
  }
  rect(ctx, CLOUD, 4, h - 4, w - 8, 4);
  rect(ctx, CLOUD_SHADE, 4, h - 2, w - 8, 2);
};

const paintFlag = (ctx: CanvasRenderingContext2D, colors: readonly [string, string], frame: number) => {
  // 12x8, rippling: frame 1 shifts the middle down a pixel
  for (let x = 0; x < 12; x++) {
    const dip = frame === 0 ? (x >= 4 && x < 8 ? 1 : 0) : x >= 8 ? 1 : x < 4 ? 0 : 0;
    rect(ctx, colors[0], x, dip, 1, 7);
    rect(ctx, colors[1], x, dip + 3, 1, 1);
  }
};

const paintBird = (ctx: CanvasRenderingContext2D, flap: number) => {
  ctx.fillStyle = OUTLINE;
  if (flap === 0) {
    ctx.fillRect(0, 0, 1, 1);
    ctx.fillRect(1, 1, 1, 1);
    ctx.fillRect(2, 2, 1, 1);
    ctx.fillRect(3, 1, 1, 1);
    ctx.fillRect(4, 0, 1, 1);
  } else {
    ctx.fillRect(0, 2, 2, 1);
    ctx.fillRect(2, 2, 1, 1);
    ctx.fillRect(3, 2, 2, 1);
  }
};

const paintGlint = (ctx: CanvasRenderingContext2D) => {
  ctx.fillStyle = GLASS_GLINT;
  ctx.fillRect(2, 0, 1, 5);
  ctx.fillRect(0, 2, 5, 1);
};

interface Sprites {
  sky: HTMLCanvasElement;
  front: HTMLCanvasElement;
  sun: HTMLCanvasElement[];
  clouds: HTMLCanvasElement[];
  flags: HTMLCanvasElement[][];
  bird: HTMLCanvasElement[];
  glint: HTMLCanvasElement;
}

let sprites: Sprites | null = null;

const build = (): Sprites => {
  const [sky, skyCtx] = makeCanvas(GAME_W, HORIZON_Y);
  paintSky(skyCtx);
  const [front, frontCtx] = makeCanvas(GAME_W, 224);
  paintFront(frontCtx);
  const sun = [0, 1].map(phase => {
    const [c, x] = makeCanvas(42, 42);
    paintSun(x, phase);
    return c;
  });
  const clouds = [40, 28, 52].map(w => {
    const [c, x] = makeCanvas(w, 12);
    paintCloud(x, w);
    return c;
  });
  const flags = FLAG_COLORS.map(colors =>
    [0, 1].map(frame => {
      const [c, x] = makeCanvas(12, 9);
      paintFlag(x, colors, frame);
      return c;
    }),
  );
  const bird = [0, 1].map(flap => {
    const [c, x] = makeCanvas(5, 3);
    paintBird(x, flap);
    return c;
  });
  const [glint, gx] = makeCanvas(5, 5);
  paintGlint(gx);
  return { sky, front, sun, clouds, flags, bird, glint };
};

// Where the clouds sit and how fast they drift (px/s); they wrap round the sky
const CLOUDS = [
  { y: 4, x: 100, speed: 3 },
  { y: 22, x: 262, speed: 5 },
  { y: 30, x: 70, speed: 4 },
] as const;
const BIRDS = [
  { y: 40, x: 0, speed: 14, phase: 0 },
  { y: 46, x: 10, speed: 14, phase: 1 },
] as const;
// Glass glints: each sparkles in turn
const GLINTS = [
  [30, 62],
  [146, 60],
  [210, 74],
  [110, 66],
  [64, 84],
] as const;

/** Draw the scene at time `t` (seconds). Only the top CENTRE_VIEW_H rows matter; the dialogue box covers the rest. */
export const drawCentreScene = (ctx: CanvasRenderingContext2D, t: number) => {
  sprites ??= build();
  const s = sprites;
  const time = ambientTime(t);
  // Sky, sun, clouds and birds first: the building stands in front of them
  ctx.drawImage(s.sky, 0, 0);

  ctx.drawImage(s.sun[Math.floor(time / 0.5) % 2]!, SUN_X - 20, SUN_Y - 20);

  const span = GAME_W + 60;
  for (let i = 0; i < CLOUDS.length; i++) {
    const c = CLOUDS[i]!;
    ctx.drawImage(s.clouds[i]!, Math.round(((c.x + time * c.speed) % span) - 56), c.y);
  }

  // two birds cross every 30 seconds or so
  for (const b of BIRDS) {
    const x = Math.round(((b.x + time * b.speed) % (GAME_W * 2)) - 20);
    if (x < GAME_W) ctx.drawImage(s.bird[(Math.floor(time * 4) + b.phase) % 2]!, x, b.y + Math.round(Math.sin(time * 2 + b.phase) * 2));
  }

  ctx.drawImage(s.front, 0, 0);

  const flap = Math.floor(time / 0.3) % 2;
  for (let i = 0; i < FLAG_POLES.length; i++) {
    const frames = s.flags[i % s.flags.length]!;
    ctx.drawImage(frames[(flap + i) % 2]!, FLAG_POLES[i]! + 1, FLAG_TOP);
  }

  if (time > 0) {
    const g = GLINTS[Math.floor(time / 0.7) % GLINTS.length]!;
    if (time % 0.7 < 0.35) ctx.drawImage(s.glint, g[0], g[1]);
  }
};
