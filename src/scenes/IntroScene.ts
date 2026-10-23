import type { Scene } from '../engine/GameLoop';
import type { Input } from '../engine/Input';
import type { SceneManager } from '../engine/SceneManager';
import type { GameState } from '../state/GameState';
import type { DialogueSystem } from '../systems/Dialogue';
import { saveGame } from '../systems/SaveSystem';
import { drawText, measureText } from '../render/PixelFont';
import { drawPokemonBox, drawSprite } from '../render/SpriteSheet';
import { GAME_W, GAME_H } from '../render/DialogueBox';
import { PALETTES } from '../render/Palettes';
import { NPC_SPRITE, SPRITE_COLORS, getCoachSprite } from '../data/sprites';
import { sfx } from '../audio/Sfx';
import { announce } from '../ui/announce';

type Phase = 'dialogue' | 'nameEntry';
type CellKind = 'char' | 'del' | 'done';

interface Cell {
  label: string;
  kind: CellKind;
  col: number; // first grid column the cell covers
  span: number; // how many columns it covers
}

const GRID_COLS = 9;
const MAX_NAME = 8;

// Every cell is a real action, so the cursor can never rest on an empty square. DEL and DONE are
// wide (they split the last row's remaining 7 columns; DONE, the main action, gets the bigger share).
const ROWS: string[][] = [
  ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'],
  ['J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R'],
  ['S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '.'],
  ['-', '0', '1', '2', '3', '4', '5', '6', '7'],
  ['8', '9', 'DEL', 'DONE'],
];
const SPANS: Record<string, number> = { DEL: 3, DONE: 4 };

const GRID: Cell[][] = ROWS.map(labels => {
  let col = 0;
  return labels.map(label => {
    const span = SPANS[label] ?? 1;
    const kind: CellKind = label === 'DEL' ? 'del' : label === 'DONE' ? 'done' : 'char';
    const cell: Cell = { label, kind, col, span };
    col += span;
    return cell;
  });
});
const DONE_ROW = GRID.length - 1;

// Spoken names for the cells (the canvas itself is invisible to screen readers)
const SPOKEN: Record<string, string> = { '.': 'period', '-': 'dash', DEL: 'delete', DONE: 'done' };

const NAME_CHAR = /^[A-Z0-9.-]$/;

// Layout (game pixels)
const CELL_W = 24;
const CELL_H = 22;
const GRID_X = (GAME_W - GRID_COLS * CELL_W) / 2;
const GRID_Y = 82;
const SLOT_W = 14; // name slot pitch: a 10px scale-2 glyph plus breathing room
const NAME_BOX_W = MAX_NAME * SLOT_W + 16;
const NAME_BOX_H = 30;
const NAME_BOX_Y = 28;

const SHAKE_TIME = 0.3;
const FLASH_TIME = 1.2;

// Typed characters, A, B and START are ignored for this long once name entry opens, so the presses that
// carried the player through the coach's speech (a mashed A, a key held down) can't land in the name.
const ENTRY_LOCK = 0.4;

// Dark enough to read on the cream background (6.5:1)
const WARN_COLOR = '#a01818';
const ACTION_PLATE = '#dfe6f3';

// Coach briefing: the coach and an athlete stand on a faint floor above the dialogue box and shift their
// weight, so the pages are more than text on an empty screen.
const HEADER_Y = 20; // top of the 3x title (same as the title screen)
const STAGE_SCALE = 2;
const STAGE_SIZE = 16 * STAGE_SCALE; // both sprites are 16x16 cells
const STAGE_GAP = 20; // between the two sprites
const STAGE_Y = 90; // top of the sprites; their feet are at STAGE_Y + STAGE_SIZE
const STAGE_STEP = 0.5; // seconds per idle pose
const FLOOR_END_Y = 160; // clear of the dialogue box (y = 164)
const FLOOR_LINE = '#e2d8c0'; // a shade darker than the cream background
const FLOOR_SHADOW = '#d3c8ae';

// The room names are the hub signs' (ROOM_LABEL). Button tokens are filled in for the player's device
// as each line opens (see DialogueSystem).
const COACH_LINES = [
  'Welcome, Coach. Your job is to guide athletes through science-based training.',
  'Each sport has four rooms: TESTING, DATA, TRAINING and ANALYSIS. Do them in order: walk through a door and press {A} to talk to the athlete.',
  'Every answer counts: good answers raise your athlete\'s stats. Finish all four rooms to open the ARENA, then beat the rival scientist there.',
  'Press {SELECT} for your objectives and {START} to pause. {B} leaves any chat. Progress saves automatically.',
];

// Under the name grid: console buttons, or the keyboard (where letters type straight into the name)
const FOOTER_CONSOLE = 'A: ADD   B: DELETE   START: DONE';
const FOOTER_KEYBOARD = 'TYPE YOUR NAME   ENTER: DONE';

const drawStage = (ctx: CanvasRenderingContext2D, t: number) => {
  // Floor lines, as on the boss arena
  ctx.fillStyle = FLOOR_LINE;
  for (let y = STAGE_Y + STAGE_SIZE + 8; y < FLOOR_END_Y; y += 6) ctx.fillRect(3, y, GAME_W - 6, 1);

  const pose = Math.floor(t / STAGE_STEP) % 2; // 0 = standing, 1 = weight shifted
  const left = Math.round((GAME_W - (STAGE_SIZE * 2 + STAGE_GAP)) / 2);
  const people = [
    { x: left, sprite: getCoachSprite('down', pose), colors: SPRITE_COLORS['default']!, dip: pose },
    { x: left + STAGE_SIZE + STAGE_GAP, sprite: NPC_SPRITE, colors: SPRITE_COLORS['npc_athlete']!, dip: 1 - pose },
  ];
  for (const person of people) {
    // Shadow first, so the feet stand on it
    const cx = person.x + STAGE_SIZE / 2;
    ctx.fillStyle = FLOOR_SHADOW;
    ctx.fillRect(cx - 10, STAGE_Y + STAGE_SIZE - 1, 20, 1);
    ctx.fillRect(cx - 13, STAGE_Y + STAGE_SIZE, 26, 2);
    ctx.fillRect(cx - 10, STAGE_Y + STAGE_SIZE + 2, 20, 1);
    drawSprite(ctx, person.sprite, person.x, STAGE_Y + person.dip * STAGE_SCALE, person.colors, STAGE_SCALE);
  }
};

export const createIntroScene = (
  input: Input,
  sceneManager: SceneManager,
  gameState: GameState,
  dialogue: DialogueSystem,
): Scene => {
  let phase: Phase = 'dialogue';
  let name = '';
  let cursorRow = 0;
  let cursorIdx = 0; // index into GRID[cursorRow]
  let anchorCol = 0; // column to aim for on up/down, so wide cells don't lose your place
  let blinkTimer = 0;
  let shakeTimer = 0;
  let flashText = '';
  let flashTimer = 0;
  let entryLock = 0; // seconds left in which name entry ignores typing, A, B and START

  const currentCell = (): Cell => GRID[cursorRow]?.[cursorIdx] ?? { label: 'A', kind: 'char', col: 0, span: 1 };

  const anchorOf = (cell: Cell): number => cell.col + Math.floor((cell.span - 1) / 2);

  const cellIndexAt = (row: number, col: number): number => {
    const idx = (GRID[row] ?? []).findIndex(cell => col >= cell.col && col < cell.col + cell.span);
    return Math.max(0, idx);
  };

  const spoken = (cell: Cell): string => SPOKEN[cell.label] ?? cell.label;

  const moveCursor = (dRow: number, dCol: number) => {
    if (dRow !== 0) {
      cursorRow = (cursorRow + dRow + GRID.length) % GRID.length;
      cursorIdx = cellIndexAt(cursorRow, anchorCol);
    }
    if (dCol !== 0) {
      const count = GRID[cursorRow]?.length ?? 1;
      cursorIdx = (cursorIdx + dCol + count) % count;
      anchorCol = anchorOf(currentCell());
    }
    sfx.play('blip');
    announce(spoken(currentCell()));
  };

  const parkOnDone = () => {
    cursorRow = DONE_ROW;
    cursorIdx = (GRID[DONE_ROW]?.length ?? 1) - 1;
    anchorCol = anchorOf(currentCell());
  };

  const reject = (message: string) => {
    sfx.play('wrong');
    shakeTimer = SHAKE_TIME;
    flashText = message;
    flashTimer = FLASH_TIME;
    announce(message);
  };

  const addChars = (chars: readonly string[]) => {
    let added = 0;
    let refused = false;
    for (const ch of chars) {
      if (!NAME_CHAR.test(ch)) continue;
      if (name.length >= MAX_NAME) {
        refused = true;
        continue;
      }
      name += ch;
      added++;
    }
    if (added > 0) {
      sfx.play('select'); // once per step, even if a whole word arrived at once
      announce(`Name: ${name}`);
    }
    if (refused) reject(`MAX ${MAX_NAME} CHARACTERS`);
  };

  const deleteChar = () => {
    if (name.length === 0) {
      sfx.play('bump');
      return;
    }
    name = name.slice(0, -1);
    sfx.play('back');
    announce(name ? `Name: ${name}` : 'Name empty');
  };

  /** Returns true when the scene was left. */
  const confirm = (): boolean => {
    if (name.length === 0) {
      reject('ENTER A NAME');
      return false;
    }
    gameState.playerName = name;
    saveGame(gameState); // first save of a new game: this is where it replaces any old one
    sfx.play('select');
    sceneManager.switchTo('levelSelect');
    return true;
  };

  /** Returns true when the scene was left. */
  const activateCell = (): boolean => {
    const cell = currentCell();
    if (cell.kind === 'del') deleteChar();
    else if (cell.kind === 'done') return confirm();
    else addChars([cell.label]);
    return false;
  };

  return {
    onEnter() {
      phase = 'dialogue';
      name = '';
      cursorRow = 0;
      cursorIdx = 0;
      anchorCol = 0;
      blinkTimer = 0;
      shakeTimer = 0;
      flashText = '';
      flashTimer = 0;
      entryLock = 0;
      input.setTextMode(false);

      // Start coach dialogue sequence (B skips it straight to name entry)
      dialogue.showSequence(
        COACH_LINES,
        () => {
          phase = 'nameEntry';
          entryLock = ENTRY_LOCK;
          input.setTextMode(true); // from here on letters and digits type into the name
          announce(
            input.lastDevice() === 'keyboard'
              ? `Enter your name, up to ${MAX_NAME} characters. Type it, Backspace deletes, Enter when done.`
              : `Enter your name, up to ${MAX_NAME} characters. D-pad moves, A adds, B deletes, Start when done.`,
          );
        },
        undefined,
        { exitLabel: 'SKIP' },
      );
    },

    onExit() {
      input.setTextMode(false);
      dialogue.reset(); // clear dialogue state to prevent leaks
    },

    update(dt: number) {
      const inp = input.read();
      blinkTimer += dt;
      shakeTimer = Math.max(0, shakeTimer - dt);
      flashTimer = Math.max(0, flashTimer - dt);

      if (phase === 'dialogue') {
        dialogue.update(dt, inp);
        return;
      }

      // The lock only guards typing, A, B and START; the D-pad answers at once
      const unlocked = entryLock <= 0;
      entryLock = Math.max(0, entryLock - dt);

      // Physical keyboard: typing parks the cursor on DONE, so Enter (START) finishes in one press
      if (unlocked && inp.typed.length > 0) {
        addChars(inp.typed);
        parkOnDone();
      }
      if (unlocked && inp.bPressed) deleteChar();

      if (inp.upRepeat) moveCursor(-1, 0);
      if (inp.downRepeat) moveCursor(1, 0);
      if (inp.leftRepeat) moveCursor(0, -1);
      if (inp.rightRepeat) moveCursor(0, 1);

      if (unlocked && inp.aPressed && activateCell()) return;

      if (unlocked && inp.startPressed) {
        // START is DONE: with a name it finishes in one press, wherever the cursor is. With no name
        // yet there is nothing to finish, so it jumps to DONE and says why it can't.
        if (name.length === 0) parkOnDone();
        confirm();
      }
    },

    render(ctx: CanvasRenderingContext2D) {
      const pal = PALETTES.title;

      // Background
      ctx.fillStyle = pal.colors[4];
      ctx.fillRect(0, 0, GAME_W, GAME_H);

      // Border frame
      ctx.fillStyle = pal.colors[0];
      ctx.fillRect(0, 0, GAME_W, 3);
      ctx.fillRect(0, GAME_H - 3, GAME_W, 3);
      ctx.fillRect(0, 0, 3, GAME_H);
      ctx.fillRect(GAME_W - 3, 0, 3, GAME_H);

      if (phase === 'dialogue') {
        // The title screen's header, so the briefing carries on from it: the name with its navy drop
        // shadow (gold alone is only ~2:1 on cream), the tagline, and the rule under them
        const title = 'PHYSQUEST';
        const titleX = (GAME_W - measureText(title, 3)) / 2;
        drawText(ctx, title, titleX + 1, HEADER_Y + 1, pal.colors[1], 3);
        drawText(ctx, title, titleX, HEADER_Y, pal.colors[5], 3);
        const tagline = 'SPORTS SCIENCE ADVENTURE';
        drawText(ctx, tagline, (GAME_W - measureText(tagline)) / 2, HEADER_Y + 26, pal.colors[1]);
        ctx.fillStyle = pal.colors[2];
        ctx.fillRect(30, HEADER_Y + 39, GAME_W - 60, 2);

        drawStage(ctx, blinkTimer);
        dialogue.render(ctx);
        return;
      }

      // Name entry phase
      const headerText = 'ENTER YOUR NAME';
      const headerW = measureText(headerText, 2);
      drawText(ctx, headerText, (GAME_W - headerW) / 2, 8, pal.colors[0], 2);

      // Name display box (shakes on a refused entry). Its interior is 22px tall (+4..+26): glyphs
      // at +8 run 14px, and the 2px caret/underline at +23 stays inside with 1px to spare.
      const shakeDx = shakeTimer > 0 ? (Math.floor(shakeTimer * 40) % 2 === 0 ? -2 : 2) : 0;
      const nameBoxX = (GAME_W - NAME_BOX_W) / 2 + shakeDx;
      drawPokemonBox(ctx, nameBoxX, NAME_BOX_Y, NAME_BOX_W, NAME_BOX_H);

      const showCaret = Math.floor(blinkTimer * 3) % 2 === 0;
      for (let i = 0; i < MAX_NAME; i++) {
        const slotX = nameBoxX + 8 + i * SLOT_W;
        const charY = NAME_BOX_Y + 8;
        const ch = name[i];

        if (ch) drawText(ctx, ch, slotX + 2, charY, '#080808', 2);

        if (i === name.length && showCaret) {
          ctx.fillStyle = '#080808';
          ctx.fillRect(slotX + 1, charY + 15, 12, 2);
        } else if (i >= name.length) {
          // Dim underline marks the slots still free
          ctx.fillStyle = '#909090';
          ctx.fillRect(slotX + 1, charY + 16, 12, 1);
        }
      }

      // Hint / refusal message under the box
      const message = flashTimer > 0 ? flashText : `UP TO ${MAX_NAME} CHARACTERS`;
      const messageColor = flashTimer > 0 ? WARN_COLOR : pal.colors[2];
      drawText(ctx, message, (GAME_W - measureText(message)) / 2, NAME_BOX_Y + NAME_BOX_H + 5, messageColor);

      // Character grid
      const boxY = GRID_Y - 8;
      drawPokemonBox(ctx, GRID_X - 8, boxY, GRID_COLS * CELL_W + 16, GRID.length * CELL_H + 16);

      for (let row = 0; row < GRID.length; row++) {
        const cells = GRID[row] ?? [];
        for (let idx = 0; idx < cells.length; idx++) {
          const cell = cells[idx]!;
          const x = GRID_X + cell.col * CELL_W;
          const y = GRID_Y + row * CELL_H;
          const w = cell.span * CELL_W;
          const isSelected = row === cursorRow && idx === cursorIdx;

          if (isSelected) {
            // Dark plate with a gold rim: legible on both the white box and the light action plates
            ctx.fillStyle = pal.colors[5];
            ctx.fillRect(x + 1, y + 1, w - 2, CELL_H - 2);
            ctx.fillStyle = pal.colors[1];
            ctx.fillRect(x + 2, y + 2, w - 4, CELL_H - 4);
          } else if (cell.kind !== 'char') {
            ctx.fillStyle = ACTION_PLATE;
            ctx.fillRect(x + 1, y + 1, w - 2, CELL_H - 2);
          }

          const color = isSelected ? '#f8f8f0' : cell.kind === 'char' ? '#080808' : pal.colors[1];
          const textW = measureText(cell.label, 2) - 2; // visible width, minus the trailing gap
          drawText(ctx, cell.label, x + Math.floor((w - textW) / 2), y + Math.floor((CELL_H - 14) / 2), color, 2);
        }
      }

      // Instructions, in the wording of the player's device
      const inst = input.lastDevice() === 'keyboard' ? FOOTER_KEYBOARD : FOOTER_CONSOLE;
      drawText(ctx, inst, (GAME_W - measureText(inst)) / 2, GAME_H - 16, pal.colors[2]);
    },
  };
};
