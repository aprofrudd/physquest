// Pixel-drawn HUD pieces for the overworld: hub label plates, door arrow, prompt bubbles, map banner,
// ROOMS badge (and its SELECT hint) and the objectives panel. Everything is drawn with fillRect so it never
// depends on font glyphs.
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
  nextRoom,
  roomKeyForMap,
  roomUnlocked,
  roomsCompleted,
  type GameState,
  type HubDoor,
  type RoomKey,
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

const ARROW_H = 7;
const ARROW_UP: Pixels = ARROW.map(([px, py]) => [px, ARROW_H - 1 - py] as const); // the same arrow, tip up

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
      const icon = state.roomProgress[roomKey] ? 'check' : roomUnlocked(state, roomKey) ? null : 'lock';
      drawLabelPlate(ctx, ROOM_LABEL[roomKey], sign.cx * TILE_SIZE, sign.cy * TILE_SIZE, icon);
    } else {
      drawLabelPlate(ctx, 'ARENA', sign.cx * TILE_SIZE, sign.cy * TILE_SIZE, allRoomsComplete(state) ? null : 'lock');
    }
  }
};

// Where each hub door's arrow stands: its centre x and the tile edge it faces (both in tiles), and which way it
// points. The north doors (row 2) are entered from below, so their arrow points up; the others are entered from above.
const DOOR_ARROWS: Record<HubDoor, { x: number; edge: number; up: boolean }> = {
  room1: { x: 5.5, edge: 3, up: true },
  room2: { x: 10.5, edge: 3, up: true },
  room3: { x: 5.5, edge: 8, up: false },
  room4: { x: 10.5, edge: 8, up: false },
  boss: { x: 8, edge: 12, up: false }, // the arena doors (7,12)-(8,12)
};

/** Bobbing gold arrow in front of a hub door: the next room's, or the arena's once every room is done. */
export const drawDoorArrow = (ctx: CanvasRenderingContext2D, door: HubDoor) => {
  const { x, edge, up } = DOOR_ARROWS[door];
  const bob = Math.round((Math.sin(Date.now() / 220) + 1) * 2); // 0..4, towards the door and back
  const left = Math.round(x * TILE_SIZE) - 3;
  // The tip comes within 4px of the door at the nearest point of the bob
  const top = up ? edge * TILE_SIZE + 9 - bob : edge * TILE_SIZE - 15 + bob;
  plotOutlined(ctx, up ? ARROW_UP : ARROW, left, top, GOLD);
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

export type BannerSpot = 'top' | 'bottom' | 'signs';

// The hub's north sign plates (HUB_SIGNS row 1.5) run y=17..29
const SIGNS_BOTTOM = 30;

/**
 * Banner on a dark plate: hanging from the top edge, resting just above the hub's south doors, or ('signs') in
 * the hub's top band with its bottom edge level with the north sign plates', so it covers them whole. A third
 * line is drawn gold, as the thing to do.
 */
export const drawMapBanner = (ctx: CanvasRenderingContext2D, lines: string[], where: BannerSpot, alpha: number) => {
  if (alpha <= 0 || lines.length === 0) return;
  const w = Math.max(...lines.map(l => textWidth(l))) + 14;
  const h = lines.length * 10 + 5;
  const x = Math.round((GAME_W - w) / 2);
  const y = where === 'top' ? 4 : where === 'signs' ? SIGNS_BOTTOM - h : 189 - h;
  ctx.globalAlpha = Math.min(1, alpha);
  rect(ctx, x, y, w, h, LIGHT_EDGE, DARK_PLATE);
  lines.forEach((line, i) => {
    const lx = Math.round((GAME_W - textWidth(line)) / 2);
    drawText(ctx, line, lx, y + 4 + i * 10, i === 0 ? '#f8f8f0' : i === 1 ? '#a8d0f0' : GOLD);
  });
  ctx.globalAlpha = 1;
};

const BADGE_Y = 2;
const BADGE_H = 13;
const BADGE_GAP = 4; // from the screen edge, and between the badge and its hint

const badgeLabel = (state: GameState): string => `ROOMS ${roomsCompleted(state)}/${ROOM_KEYS.length}`;
const badgeX = (state: GameState): number => GAME_W - BADGE_GAP - (textWidth(badgeLabel(state)) + 10);

/** Hub badge, top right: how many of the four rooms are done. */
export const drawRoomsBadge = (ctx: CanvasRenderingContext2D, state: GameState) => {
  const label = badgeLabel(state);
  const x = badgeX(state);
  rect(ctx, x, BADGE_Y, textWidth(label) + 10, BADGE_H, LIGHT_EDGE, DARK_PLATE);
  drawText(ctx, label, x + 5, BADGE_Y + 3, allRoomsComplete(state) ? GOLD : '#f8f8f0');
};

/**
 * Hint plate just left of the ROOMS badge, in the badge's style. It sits on the hub's top wall, clear of the
 * sign plates (which start 2px below), so nothing a player walks to is covered.
 */
export const drawSelectHint = (ctx: CanvasRenderingContext2D, state: GameState, text: string) => {
  const w = textWidth(text) + 10;
  const x = badgeX(state) - BADGE_GAP - w;
  rect(ctx, x, BADGE_Y, w, BADGE_H, LIGHT_EDGE, DARK_PLATE);
  drawText(ctx, text, x + 5, BADGE_Y + 3, '#f8f8f0');
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
  const next = nextRoom(state);
  return next ? `NEXT: VISIT THE ${ROOM_LABEL[next]} ROOM` : 'ALL ROOMS DONE - HEAD TO THE ARENA!';
};

/** A room's row in the panel: its sign name and the stat it raises, e.g. "TRAINING (ENDURANCE)". */
const roomRowLabel = (key: RoomKey): string => `${ROOM_LABEL[key]} (${STAT_NAME[ROOM_STAT[key]]})`;

/** Plain-text version of the panel, for the screen-reader live region. `closeName` is the player's name for the SELECT button. */
export const objectivesSummary = (state: GameState, closeName = 'SELECT'): string => {
  const rooms = ROOM_KEYS.map(k => {
    const status = state.roomProgress[k]
      ? `${percent(state.playerStats[ROOM_STAT[k]])} percent`
      : roomUnlocked(state, k) ? 'not done' : 'locked';
    return `${ROOM_LABEL[k]} raises ${STAT_NAME[ROOM_STAT[k]].toLowerCase()}, ${status}`;
  }).join('. ');
  return `Objectives. Coach ${state.playerName}. ${levelLine(state)}. ${rooms}. ${objectivesHint(state)}. ${closeName} closes.`;
};

/** `footer` is the close hint in the player's button names, e.g. "SELECT: CLOSE". */
export const drawObjectivesPanel = (ctx: CanvasRenderingContext2D, state: GameState, footer: string) => {
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
  const next = nextRoom(state);
  ROOM_KEYS.forEach((key, i) => {
    const y = 61 + i * 13;
    const done = state.roomProgress[key];
    drawText(ctx, roomRowLabel(key), left, y, done || key === next ? TEXT : DIM);
    if (done) {
      const pct = `${percent(state.playerStats[ROOM_STAT[key]])}%`;
      const pw = textWidth(pct);
      drawText(ctx, pct, right - pw, y, TEXT);
      plot(ctx, CHECK, right - pw - CHECK_W - 4, y + 1, GREEN);
    } else if (key === next) {
      drawText(ctx, 'NEXT', right - textWidth('NEXT'), y, NEXT_BLUE);
    } else if (!roomUnlocked(state, key)) {
      plot(ctx, LOCK, right - LOCK_W, y, DIM);
    } else {
      drawText(ctx, '-', right - textWidth('-'), y, DIM); // open, but not the next one (an older save)
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

  drawText(ctx, footer, Math.round((GAME_W - textWidth(footer)) / 2), 201, DIM);
};
