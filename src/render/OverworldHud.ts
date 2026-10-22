// Pixel-drawn HUD pieces for the overworld: hub label plates, prompt bubbles, map banner,
// ROOMS badge and the objectives panel. Everything is drawn with fillRect so it never depends on font glyphs.
import { drawText, CHAR_W } from './PixelFont';
import { drawPokemonBox } from './SpriteSheet';
import { GAME_W, GAME_H } from './DialogueBox';
import { TILE_SIZE } from './TileMap';
import { HUB_SIGNS } from '../data/maps';
import { LEVEL_DATA } from '../data/sports';
import {
  ROOM_KEYS,
  ROOM_LABEL,
  ROOM_STAT,
  STAT_KEYS,
  allRoomsComplete,
  roomKeyForMap,
  roomsCompleted,
  type GameState,
  type StatKey,
} from '../state/GameState';

const INK = '#101018';
const PLATE = '#f8f0d8';
const GOLD = '#f0c830';
const GREEN = '#1c7c34'; // 4.6:1 on PLATE
const DARK_PLATE = '#101828';
const LIGHT_EDGE = '#f0e8d8';

type Pixels = ReadonlyArray<readonly [number, number]>;

const CHECK: Pixels = [
  [6, 0], [5, 1], [6, 1], [0, 2], [4, 2], [5, 2], [0, 3], [1, 3], [3, 3], [4, 3], [1, 4], [2, 4], [3, 4], [2, 5],
];
const CHECK_W = 7;
const CHECK_H = 6;

const STAR: Pixels = [
  [3, 0], [2, 1], [3, 1], [4, 1], [0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2],
  [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [2, 4], [3, 4], [4, 4], [1, 5], [2, 5], [4, 5], [5, 5], [1, 6], [5, 6],
];

const ARROW: Pixels = [
  [2, 0], [3, 0], [4, 0], [2, 1], [3, 1], [4, 1], [2, 2], [3, 2], [4, 2],
  [0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3], [1, 4], [2, 4], [3, 4], [4, 4], [5, 4], [2, 5], [3, 5], [4, 5], [3, 6],
];

// Lock: shackle on top of a body with a keyhole (keyhole is left transparent so the plate shows through)
const LOCK: Pixels = [
  [2, 0], [3, 0], [4, 0], [1, 1], [5, 1], [1, 2], [5, 2],
  [0, 3], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3],
  [0, 4], [1, 4], [2, 4], [3, 4], [4, 4], [5, 4], [6, 4],
  [0, 5], [1, 5], [2, 5], [4, 5], [5, 5], [6, 5],
  [0, 6], [1, 6], [2, 6], [3, 6], [4, 6], [5, 6], [6, 6],
  [0, 7], [1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7],
];
const LOCK_W = 7;

const plot = (ctx: CanvasRenderingContext2D, pixels: Pixels, x: number, y: number, color: string) => {
  ctx.fillStyle = color;
  for (const [px, py] of pixels) ctx.fillRect(x + px, y + py, 1, 1);
};

/** Pixels with a 1px dark outline, so a small icon reads on any floor colour. */
const plotOutlined = (ctx: CanvasRenderingContext2D, pixels: Pixels, x: number, y: number, fill: string) => {
  for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) plot(ctx, pixels, x + ox, y + oy, INK);
  plot(ctx, pixels, x, y, fill);
};

const rect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, edge: string, fill: string) => {
  ctx.fillStyle = edge;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = fill;
  ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
};

const textWidth = (text: string, scale = 1): number => text.length * CHAR_W * scale - scale; // no trailing gap

// Cosmetic motion only (never feeds game logic)
const bobOffset = (periodMs: number, amplitude: number): number =>
  Math.round(Math.sin(Date.now() / periodMs) * amplitude);

export const levelLine = (state: GameState): string => {
  const sport = LEVEL_DATA[state.currentLevel]?.sport ?? '';
  return `LEVEL ${state.currentLevel + 1}: ${sport.toUpperCase()}`;
};

// --- Hub label plates -------------------------------------------------------------

type PlateIcon = 'check' | 'lock' | null;

const PLATE_MIN_W = 3 * TILE_SIZE; // covers a whole shelf-sign-shelf block, so every plate looks alike

const drawLabelPlate = (ctx: CanvasRenderingContext2D, label: string, cx: number, cy: number, icon: PlateIcon) => {
  const iconW = icon === 'check' ? CHECK_W : icon === 'lock' ? LOCK_W : 0;
  const w = Math.max(PLATE_MIN_W, textWidth(label) + (icon ? iconW + 3 : 0) + 8); // 3px padding + 1px edge each side
  const h = 13;
  const x = Math.round(cx - w / 2);
  const y = Math.floor(cy - h / 2);
  // Content is centred in the plate (the plate may be wider than its content)
  const contentW = textWidth(label) + (icon ? iconW + 3 : 0);
  rect(ctx, x, y, w, h, INK, PLATE);
  let tx = x + Math.round((w - contentW) / 2);
  if (icon === 'check') plot(ctx, CHECK, tx, y + 4, GREEN);
  if (icon === 'lock') plot(ctx, LOCK, tx, y + 3, INK);
  if (icon) tx += iconW + 3;
  drawText(ctx, label, tx, y + 3, INK);
};

/** Opaque plates on the hub's sign rows: readable on top of the dark bookshelves. */
export const drawHubLabels = (ctx: CanvasRenderingContext2D, state: GameState) => {
  for (const sign of HUB_SIGNS) {
    const roomKey = sign.door === 'boss' ? null : roomKeyForMap(sign.door);
    if (roomKey) {
      drawLabelPlate(ctx, ROOM_LABEL[roomKey], sign.cx * TILE_SIZE, sign.cy * TILE_SIZE, state.roomProgress[roomKey] ? 'check' : null);
    } else {
      drawLabelPlate(ctx, 'ARENA', sign.cx * TILE_SIZE, sign.cy * TILE_SIZE, allRoomsComplete(state) ? null : 'lock');
    }
  }
};

/** Bobbing gold arrow above the boss doors (7,12)-(8,12) once every room is done. */
export const drawArenaArrow = (ctx: CanvasRenderingContext2D) => {
  const bob = Math.round((Math.sin(Date.now() / 220) + 1) * 2); // 0..4
  plotOutlined(ctx, ARROW, 8 * TILE_SIZE - 3, 11 * TILE_SIZE + 1 + bob, GOLD);
};

// --- Prompt bubbles and markers above characters ---------------------------------------

const BUBBLE_W = 11;
const BUBBLE_H = 13; // 11px body + 2px tail
const BUBBLE_DX = 3; // centres the bubble's tail on the 16px tile

const drawBubble = (ctx: CanvasRenderingContext2D, x: number, y: number, glyph: string, glyphColor: string) => {
  // Rounded body: black outline, white inside, corners trimmed
  ctx.fillStyle = INK;
  ctx.fillRect(x + 1, y, BUBBLE_W - 2, BUBBLE_W);
  ctx.fillRect(x, y + 1, BUBBLE_W, BUBBLE_W - 2);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x + 2, y + 1, BUBBLE_W - 4, BUBBLE_W - 2);
  ctx.fillRect(x + 1, y + 2, BUBBLE_W - 2, BUBBLE_W - 4);
  // Tail, open at the top so it joins the white interior
  ctx.fillStyle = INK;
  ctx.fillRect(x + 4, y + BUBBLE_W, 1, 1);
  ctx.fillRect(x + 6, y + BUBBLE_W, 1, 1);
  ctx.fillRect(x + 5, y + BUBBLE_W + 1, 1, 1);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x + 5, y + BUBBLE_W - 1, 1, 2);
  drawText(ctx, glyph, x + 3, y + 2, glyphColor);
};

/** Where a bubble above a tile goes. If the player stands right above the tile, it moves beside it instead. */
const bubbleSpot = (tileX: number, tileY: number, playerX: number, playerY: number): { x: number; y: number } => {
  const x = tileX * TILE_SIZE + BUBBLE_DX;
  const y = tileY * TILE_SIZE - BUBBLE_H;
  const playerAbove = Math.round(playerX) === tileX && Math.round(playerY) === tileY - 1;
  return playerAbove ? { x: tileX * TILE_SIZE + TILE_SIZE, y: tileY * TILE_SIZE - BUBBLE_H + 6 } : { x, y };
};

/** "A" bubble over the thing the idle player is facing. */
export const drawTalkPrompt = (ctx: CanvasRenderingContext2D, tileX: number, tileY: number, playerX: number, playerY: number) => {
  const spot = bubbleSpot(tileX, tileY, playerX, playerY);
  drawBubble(ctx, spot.x, spot.y + bobOffset(260, 1), 'A', INK);
};

/** Bouncing "!" over a room athlete whose challenge is still open. */
export const drawAlertBubble = (ctx: CanvasRenderingContext2D, tileX: number, tileY: number) => {
  const hop = -Math.round(Math.abs(Math.sin(Date.now() / 190)) * 3);
  drawBubble(ctx, tileX * TILE_SIZE + BUBBLE_DX, tileY * TILE_SIZE - BUBBLE_H + hop, '!', '#c82828');
};

/** Small gold star over a room athlete whose challenge is done. */
export const drawDoneStar = (ctx: CanvasRenderingContext2D, tileX: number, tileY: number) => {
  plotOutlined(ctx, STAR, tileX * TILE_SIZE + 4, tileY * TILE_SIZE - 10 + bobOffset(420, 1), GOLD);
};

// --- Banner, badge ------------------------------------------------------------------

/** Map-name banner on a dark plate, hanging from the top edge or resting just above the hub's south doors. */
export const drawMapBanner = (ctx: CanvasRenderingContext2D, lines: string[], where: 'top' | 'bottom', alpha: number) => {
  if (alpha <= 0 || lines.length === 0) return;
  const w = Math.max(...lines.map(l => textWidth(l))) + 14;
  const h = lines.length * 10 + 5;
  const x = Math.round((GAME_W - w) / 2);
  const y = where === 'top' ? 4 : 189 - h;
  ctx.globalAlpha = Math.min(1, alpha);
  rect(ctx, x, y, w, h, LIGHT_EDGE, DARK_PLATE);
  lines.forEach((line, i) => {
    const lx = Math.round((GAME_W - textWidth(line)) / 2);
    drawText(ctx, line, lx, y + 4 + i * 10, i === 0 ? '#f8f8f0' : '#a8d0f0');
  });
  ctx.globalAlpha = 1;
};

/** Hub badge, top right: how many of the four rooms are done. */
export const drawRoomsBadge = (ctx: CanvasRenderingContext2D, state: GameState) => {
  const done = roomsCompleted(state);
  const label = `ROOMS ${done}/${ROOM_KEYS.length}`;
  const w = textWidth(label) + 10;
  const x = GAME_W - 4 - w;
  rect(ctx, x, 2, w, 13, LIGHT_EDGE, DARK_PLATE);
  drawText(ctx, label, x + 5, 5, done === ROOM_KEYS.length ? GOLD : '#f8f8f0');
};

// --- Objectives panel ---------------------------------------------------------------

const STAT_NAME: Record<StatKey, string> = {
  speed: 'SPEED',
  strength: 'STRENGTH',
  endurance: 'ENDURANCE',
  power: 'POWER',
};
const STAT_COLOR: Record<StatKey, string> = {
  speed: '#d03030',
  strength: '#d88020',
  endurance: '#30a040',
  power: '#3868b8',
};

const TEXT = '#080808';
const DIM = '#606060'; // 5.9:1 on the panel's #f8f8f0
const NEXT_BLUE = '#2858a8';

const percent = (v: number): number => Math.max(0, Math.min(100, Math.round(v * 100)));

export const objectivesHint = (state: GameState): string => {
  const next = ROOM_KEYS.find(k => !state.roomProgress[k]);
  return next ? `NEXT: VISIT THE ${ROOM_LABEL[next]} ROOM` : 'ALL ROOMS DONE - HEAD TO THE ARENA!';
};

/** Plain-text version of the panel, for the screen-reader live region. */
export const objectivesSummary = (state: GameState): string => {
  const rooms = ROOM_KEYS.map(k =>
    `${ROOM_LABEL[k]} ${state.roomProgress[k] ? `${percent(state.playerStats[ROOM_STAT[k]])} percent` : 'not done'}`,
  ).join(', ');
  return `Objectives. Coach ${state.playerName}. ${levelLine(state)}. ${rooms}. ${objectivesHint(state)}. Select closes.`;
};

export const drawObjectivesPanel = (ctx: CanvasRenderingContext2D, state: GameState) => {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(0, 0, GAME_W, GAME_H);
  drawPokemonBox(ctx, 8, 8, GAME_W - 16, GAME_H - 16);

  const left = 20;
  const right = GAME_W - 20;
  const divider = (y: number) => {
    ctx.fillStyle = '#a0a0a0';
    ctx.fillRect(left, y, right - left, 1);
  };

  const coach = `COACH ${state.playerName}`.trimEnd();
  drawText(ctx, coach, left, 16, TEXT, 2);
  drawText(ctx, levelLine(state), left, 33, '#303030');
  divider(45);

  // Rooms
  drawText(ctx, 'ROOMS', left, 50, DIM);
  const nextRoom = ROOM_KEYS.find(k => !state.roomProgress[k]);
  ROOM_KEYS.forEach((key, i) => {
    const y = 61 + i * 13;
    const done = state.roomProgress[key];
    drawText(ctx, ROOM_LABEL[key], left, y, done || key === nextRoom ? TEXT : DIM);
    if (done) {
      const pct = `${percent(state.playerStats[ROOM_STAT[key]])}%`;
      const pw = textWidth(pct);
      drawText(ctx, pct, right - pw, y, TEXT);
      plot(ctx, CHECK, right - pw - CHECK_W - 4, y + 1, GREEN);
    } else if (key === nextRoom) {
      drawText(ctx, 'NEXT', right - textWidth('NEXT'), y, NEXT_BLUE);
    } else {
      drawText(ctx, '-', right - textWidth('-'), y, DIM);
    }
  });
  divider(114);

  // Stats
  drawText(ctx, 'STATS', left, 119, DIM);
  const barX = left + 68;
  const barW = 112;
  STAT_KEYS.forEach((key, i) => {
    const y = 130 + i * 12;
    const value = Math.max(0, Math.min(1, state.playerStats[key]));
    drawText(ctx, STAT_NAME[key], left, y, TEXT);
    rect(ctx, barX, y - 1, barW, 9, TEXT, '#d8d8c8');
    const fill = Math.round((barW - 2) * value);
    if (fill > 0) {
      ctx.fillStyle = STAT_COLOR[key];
      ctx.fillRect(barX + 1, y, fill, 7);
    }
    const pct = `${percent(value)}%`;
    drawText(ctx, pct, right - textWidth(pct), y, TEXT);
  });
  divider(181);

  const hint = objectivesHint(state);
  drawText(ctx, hint, Math.round((GAME_W - textWidth(hint)) / 2), 188, TEXT);

  const footer = 'SELECT: CLOSE';
  drawText(ctx, footer, Math.round((GAME_W - textWidth(footer)) / 2), 201, DIM);
};
