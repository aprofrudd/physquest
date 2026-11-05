// Drawing for the ATHLETE room: the athlete's card (her sprite, name and the overview score so far), the notebook
// (one note per good question), and either the question list or the question just asked. Everything drawn here is
// worked out by the instrument when something changes, so drawing builds no strings and no arrays.
import { drawOptionList } from '../../render/DialogueBox';
import { drawSprite } from '../../render/SpriteSheet';
import { drawText } from '../../render/PixelFont';
import { COLORS, STAGE, drawCentred, drawPanel, drawTick } from '../frame';

/** What one frame shows (the instrument keeps one and updates it in place). */
export interface MeetView {
  sprite: number[][];
  colors: string[];
  name: string; // AISHA
  overview: string; // OVERVIEW 2/5
  /** The notebook's notes, and how many of them are written so far (a note appears when it is said). */
  notes: readonly string[];
  shown: number;
  /** Seconds left of the gold flash on the newest note. */
  flash: number;
  /** The option list (choosing) or null. */
  list: readonly string[] | null;
  /** Index into `list` of the cursor. */
  cursor: number;
  /** More options above or below the visible ones. */
  moreAbove: boolean;
  moreBelow: boolean;
  /** The question being answered, or '' (drawn in place of the list). */
  asked: string;
  /** Room clock, for the athlete's idle bob. */
  clock: number;
  still: boolean;
}

export const CARD = { x: STAGE.x, y: STAGE.y + 2, w: 80, h: 60 } as const;
// wide enough for a 24-character note after its tick: 6 + 9 + 143 px inside a 4px double border
export const BOOK = { x: STAGE.x + 84, y: STAGE.y + 2, w: STAGE.w - 84, h: 60 } as const;
/** How many questions the list shows at once (it scrolls). */
export const VISIBLE = 5;
export const LIST_GAP = 1;
export const LIST_BOTTOM = STAGE.y + STAGE.h; // just above the dialogue box
const NOTE_PITCH = 8;
const NOTES_TOP = 15; // first note 1px under the rule; the fifth ends 2px clear of the bottom border
const SPRITE_SCALE = 2;
const NOTE_FLASH = '#f6e7a8';

const drawCard = (ctx: CanvasRenderingContext2D, v: MeetView) => {
  drawPanel(ctx, CARD.x, CARD.y, CARD.w, CARD.h);
  const bob = v.still ? 0 : Math.floor(v.clock / 0.6) % 2;
  const size = 16 * SPRITE_SCALE;
  const cx = CARD.x + CARD.w / 2;
  // a soft floor shadow, then the athlete standing on it
  ctx.fillStyle = '#d8d4c4';
  ctx.fillRect(Math.round(cx - 12), CARD.y + 5 + size - 1, 24, 2);
  drawSprite(ctx, v.sprite, Math.round(cx - size / 2), CARD.y + 4 + bob, v.colors, SPRITE_SCALE);
  drawCentred(ctx, v.name, cx, CARD.y + 39, COLORS.ink);
  drawCentred(ctx, v.overview, cx, CARD.y + 48, COLORS.blue);
};

const drawBook = (ctx: CanvasRenderingContext2D, v: MeetView) => {
  drawPanel(ctx, BOOK.x, BOOK.y, BOOK.w, BOOK.h);
  const left = BOOK.x + 6;
  drawText(ctx, 'NOTEBOOK', left, BOOK.y + 5, COLORS.ink);
  ctx.fillStyle = COLORS.grey;
  ctx.fillRect(left, BOOK.y + 13, BOOK.w - 16, 1);
  if (v.shown === 0) {
    drawText(ctx, 'NOTHING YET', left, BOOK.y + NOTES_TOP, COLORS.grey);
    return;
  }
  for (let i = 0; i < v.shown && i < v.notes.length; i++) {
    const y = BOOK.y + NOTES_TOP + i * NOTE_PITCH;
    const newest = i === v.shown - 1 && v.flash > 0;
    if (newest) {
      ctx.fillStyle = NOTE_FLASH;
      ctx.fillRect(left - 2, y - 1, BOOK.w - 12, NOTE_PITCH);
    }
    drawTick(ctx, left, y, COLORS.good);
    drawText(ctx, v.notes[i]!, left + 9, y, COLORS.ink);
  }
};

// A small up or down arrow beside the list, when it scrolls
const drawScrollArrow = (ctx: CanvasRenderingContext2D, x: number, y: number, up: boolean) => {
  ctx.fillStyle = COLORS.inkSoft;
  for (let i = 0; i < 3; i++) {
    const w = up ? 1 + i * 2 : 5 - i * 2;
    ctx.fillRect(x + 2 - Math.floor(w / 2), y + i, w, 1);
  }
};

const drawAsked = (ctx: CanvasRenderingContext2D, text: string) => {
  const y = CARD.y + CARD.h + 4;
  drawPanel(ctx, STAGE.x, y, STAGE.w, 26);
  drawText(ctx, 'YOU ASKED', STAGE.x + 8, y + 5, COLORS.grey);
  drawText(ctx, text, STAGE.x + 8, y + 14, COLORS.ink);
};

export const drawMeetStage = (ctx: CanvasRenderingContext2D, v: MeetView) => {
  drawCard(ctx, v);
  drawBook(ctx, v);
  if (v.list) {
    const top = drawOptionList(ctx, v.list, v.cursor, LIST_BOTTOM, undefined, LIST_GAP);
    const ax = STAGE.x + STAGE.w - 14;
    if (v.moreAbove) drawScrollArrow(ctx, ax, top + 6, true);
    if (v.moreBelow) drawScrollArrow(ctx, ax, LIST_BOTTOM - 9, false);
  } else if (v.asked) {
    drawAsked(ctx, v.asked);
  }
};
