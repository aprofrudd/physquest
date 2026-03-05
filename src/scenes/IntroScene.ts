import type { Scene } from '../engine/GameLoop';
import type { Input } from '../engine/Input';
import type { SceneManager } from '../engine/SceneManager';
import type { GameState } from '../state/GameState';
import type { DialogueSystem } from '../systems/Dialogue';
import { drawText, measureText } from '../render/PixelFont';
import { drawPokemonBox } from '../render/SpriteSheet';
import { GAME_W, GAME_H } from '../render/DialogueBox';
import { PALETTES } from '../render/Palettes';

type Phase = 'dialogue' | 'nameEntry';

const GRID_COLS = 9;
const GRID: string[][] = [
  ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'],
  ['J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R'],
  ['S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '.'],
  ['-', '1', '2', '3', '4', '5', '6', '7', '8'],
  ['9', '0', ' ', ' ', 'DEL', ' ', ' ', 'END', ' '],
];
const GRID_ROWS = GRID.length;
const MAX_NAME = 8;

const COACH_LINES = [
  'Welcome, Coach. Your job is to guide athletes through science-based training.',
  'Test selection, variable ID, training prescription, performance prediction. Get it right.',
  'Rival scientists will challenge you. Your data is your weapon.',
];

export const createIntroScene = (
  input: Input,
  sceneManager: SceneManager,
  gameState: GameState,
  dialogue: DialogueSystem,
): Scene => {
  let phase: Phase = 'dialogue';
  let name = '';
  let cursorRow = 0;
  let cursorCol = 0;
  let blinkTimer = 0;

  // Debounce tracking for arrow keys + action
  let upWasDown = false;
  let downWasDown = false;
  let leftWasDown = false;
  let rightWasDown = false;
  let actionWasDown = false;

  const getCellAt = (row: number, col: number): string => {
    const r = GRID[row];
    if (!r) return ' ';
    return r[col] ?? ' ';
  };

  // Find the actual column for DEL/END (they span cells)
  const isOnDel = (row: number, col: number): boolean =>
    row === 4 && col >= 4 && col <= 4;

  const isOnEnd = (row: number, col: number): boolean =>
    row === 4 && col >= 7 && col <= 7;

  return {
    onEnter() {
      phase = 'dialogue';
      name = '';
      cursorRow = 0;
      cursorCol = 0;
      blinkTimer = 0;
      upWasDown = false;
      downWasDown = false;
      leftWasDown = false;
      rightWasDown = false;
      actionWasDown = false;

      // Start coach dialogue sequence
      dialogue.showSequence(COACH_LINES, () => {
        phase = 'nameEntry';
      });
    },

    onExit() {
      // Clear dialogue state to prevent leaks
      dialogue.state.active = false;
      dialogue.state.onComplete = null;
    },

    update(dt: number) {
      const inp = input.read();
      blinkTimer += dt;

      if (phase === 'dialogue') {
        // Keep local debounce in sync so name entry doesn't fire on first frame
        actionWasDown = inp.action;
        upWasDown = inp.up;
        downWasDown = inp.down;
        leftWasDown = inp.left;
        rightWasDown = inp.right;
        dialogue.update(dt, inp);
        return;
      }

      // Name entry phase — debounced input
      const upPressed = inp.up && !upWasDown;
      const downPressed = inp.down && !downWasDown;
      const leftPressed = inp.left && !leftWasDown;
      const rightPressed = inp.right && !rightWasDown;
      const actionPressed = inp.action && !actionWasDown;
      upWasDown = inp.up;
      downWasDown = inp.down;
      leftWasDown = inp.left;
      rightWasDown = inp.right;
      actionWasDown = inp.action;

      if (upPressed) cursorRow = (cursorRow - 1 + GRID_ROWS) % GRID_ROWS;
      if (downPressed) cursorRow = (cursorRow + 1) % GRID_ROWS;
      if (leftPressed) cursorCol = (cursorCol - 1 + GRID_COLS) % GRID_COLS;
      if (rightPressed) cursorCol = (cursorCol + 1) % GRID_COLS;

      if (actionPressed) {
        if (isOnDel(cursorRow, cursorCol)) {
          // Delete last char
          if (name.length > 0) name = name.slice(0, -1);
        } else if (isOnEnd(cursorRow, cursorCol)) {
          // Confirm name
          if (name.length >= 1) {
            gameState.playerName = name;
            sceneManager.switchTo('levelSelect');
          }
        } else {
          // Add character
          const ch = getCellAt(cursorRow, cursorCol);
          if (ch !== ' ' && name.length < MAX_NAME) {
            name += ch;
          }
        }
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
        // Title
        const title = 'PHYSQUEST';
        const titleW = measureText(title, 2);
        drawText(ctx, title, (GAME_W - titleW) / 2, 20, pal.colors[5], 2);

        dialogue.render(ctx);
        return;
      }

      // Name entry phase
      const headerText = 'ENTER YOUR NAME';
      const headerW = measureText(headerText, 2);
      drawText(ctx, headerText, (GAME_W - headerW) / 2, 10, pal.colors[0], 2);

      // Name display box
      const nameBoxW = (MAX_NAME * 12) + 16;
      const nameBoxX = (GAME_W - nameBoxW) / 2;
      const nameBoxY = 32;
      drawPokemonBox(ctx, nameBoxX, nameBoxY, nameBoxW, 22);

      // Draw name with cursor
      const displayName = name.padEnd(MAX_NAME, ' ');
      for (let i = 0; i < MAX_NAME; i++) {
        const ch = displayName[i]!;
        const charX = nameBoxX + 8 + i * 12;
        const charY = nameBoxY + 7;

        if (ch !== ' ') {
          drawText(ctx, ch, charX, charY, '#080808', 2);
        }

        // Blinking underline at current position
        if (i === name.length && Math.floor(blinkTimer * 3) % 2 === 0) {
          ctx.fillStyle = '#080808';
          ctx.fillRect(charX, charY + 14, 10, 2);
        } else if (i >= name.length) {
          // Dim underline for remaining slots
          ctx.fillStyle = '#a0a0a0';
          ctx.fillRect(charX, charY + 14, 10, 1);
        }
      }

      // Character grid
      const gridStartX = 20;
      const gridStartY = 68;
      const cellW = 24;
      const cellH = 22;

      // Grid background box
      drawPokemonBox(ctx, gridStartX - 8, gridStartY - 8, GRID_COLS * cellW + 16, GRID_ROWS * cellH + 16);

      for (let row = 0; row < GRID_ROWS; row++) {
        for (let col = 0; col < GRID_COLS; col++) {
          const cell = getCellAt(row, col);
          const cx = gridStartX + col * cellW;
          const cy = gridStartY + row * cellH;

          // Handle special cells
          let label = cell;
          let isSpecial = false;

          if (row === 4 && col === 4) { label = 'DEL'; isSpecial = true; }
          else if (row === 4 && col === 7) { label = 'END'; isSpecial = true; }
          else if (cell === ' ') continue;

          // Highlight cursor position
          const isSelected = row === cursorRow && col === cursorCol;
          if (isSelected) {
            ctx.fillStyle = pal.colors[5];
            ctx.fillRect(cx - 2, cy - 1, isSpecial ? measureText(label) + 4 : 14, 10);
            drawText(ctx, label, cx, cy, '#f8f8f0');
          } else {
            drawText(ctx, label, cx, cy, isSpecial ? pal.colors[1] : '#080808');
          }
        }
      }

      // Instructions
      const inst = 'ARROWS:MOVE  SPACE:SELECT';
      drawText(ctx, inst, (GAME_W - measureText(inst)) / 2, GAME_H - 16, pal.colors[2]);
    },
  };
};
