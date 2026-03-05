import { drawText, CHAR_W, CHAR_H } from './PixelFont';

export const GAME_W = 256;
export const GAME_H = 224;
const BOX_H = 56;
const BOX_Y = GAME_H - BOX_H - 4;
const BOX_X = 4;
const BOX_W = GAME_W - 8;
const TEXT_X = BOX_X + 10;
const TEXT_Y = BOX_Y + 10;
const MAX_CHARS_PER_LINE = Math.floor((BOX_W - 20) / CHAR_W);
const MAX_LINES = 3;

// Pokemon-style double-line bordered box
const drawPokemonBox = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number
) => {
  // Outer border (black)
  ctx.fillStyle = '#080808';
  ctx.fillRect(x, y, w, h);
  // Inner border (dark)
  ctx.fillStyle = '#303030';
  ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
  // White interior
  ctx.fillStyle = '#f8f8f0';
  ctx.fillRect(x + 4, y + 4, w - 8, h - 8);
};

// Bouncing arrow sprite (small downward triangle)
const drawBouncingArrow = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number
) => {
  const bounce = Math.floor(Math.sin(Date.now() / 150) * 2);
  const ay = y + bounce;
  ctx.fillStyle = '#303030';
  // 7px wide triangle pointing down
  ctx.fillRect(x, ay, 7, 1);
  ctx.fillRect(x + 1, ay + 1, 5, 1);
  ctx.fillRect(x + 2, ay + 2, 3, 1);
  ctx.fillRect(x + 3, ay + 3, 1, 1);
};

export interface DialogueState {
  active: boolean;
  lines: string[];
  currentLine: number;
  charIndex: number;
  timer: number;
  speed: number; // chars per second
  choices: string[] | null;
  selectedChoice: number;
  onComplete: ((choiceIndex?: number) => void) | null;
  waitingForInput: boolean;
}

export const createDialogueState = (): DialogueState => ({
  active: false,
  lines: [],
  currentLine: 0,
  charIndex: 0,
  timer: 0,
  speed: 40,
  choices: null,
  selectedChoice: 0,
  onComplete: null,
  waitingForInput: false,
});

// Word-wrap text into lines that fit the dialogue box
export const wrapText = (text: string): string[] => {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    if (current.length + word.length + 1 > MAX_CHARS_PER_LINE) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = current ? current + ' ' + word : word;
    }
  }
  if (current) lines.push(current);
  return lines;
};

export const startDialogue = (
  state: DialogueState,
  text: string,
  choices?: string[],
  onComplete?: (choiceIndex?: number) => void
) => {
  state.active = true;
  state.lines = wrapText(text);
  state.currentLine = 0;
  state.charIndex = 0;
  state.timer = 0;
  state.choices = choices ?? null;
  state.selectedChoice = 0;
  state.onComplete = onComplete ?? null;
  state.waitingForInput = false;
};

export const updateDialogue = (
  state: DialogueState,
  dt: number,
  actionPressed: boolean,
  upPressed?: boolean,
  downPressed?: boolean
) => {
  if (!state.active) return;

  // Get the current page of lines (up to MAX_LINES)
  const pageStart = state.currentLine;
  const pageEnd = Math.min(pageStart + MAX_LINES, state.lines.length);
  const pageLines = state.lines.slice(pageStart, pageEnd);

  // Count total chars on this page
  const totalCharsOnPage = pageLines.reduce((sum, l) => sum + l.length, 0);

  if (state.charIndex < totalCharsOnPage) {
    // Still typing
    state.timer += dt;
    const charsToAdd = Math.floor(state.timer * state.speed);
    if (charsToAdd > 0) {
      state.charIndex = Math.min(state.charIndex + charsToAdd, totalCharsOnPage);
      state.timer = 0;
    }

    // Press action to skip typing
    if (actionPressed) {
      state.charIndex = totalCharsOnPage;
    }
  } else if (!state.waitingForInput) {
    state.waitingForInput = true;
  } else if (actionPressed) {
    // Advance to next page or finish
    if (pageEnd < state.lines.length && !state.choices) {
      state.currentLine = pageEnd;
      state.charIndex = 0;
      state.waitingForInput = false;
    } else if (state.choices) {
      // Choice made
      state.active = false;
      state.onComplete?.(state.selectedChoice);
    } else {
      state.active = false;
      state.onComplete?.();
    }
  }

  // Choice navigation
  if (state.choices && state.waitingForInput) {
    if (upPressed) {
      state.selectedChoice = Math.max(0, state.selectedChoice - 1);
    }
    if (downPressed) {
      state.selectedChoice = Math.min(state.choices.length - 1, state.selectedChoice + 1);
    }
  }
};

export const renderDialogue = (
  ctx: CanvasRenderingContext2D,
  state: DialogueState
) => {
  if (!state.active) return;

  // Choice window — separate Pokemon-style box above dialogue (right-aligned)
  if (state.choices && state.waitingForInput) {
    const choiceW = 120;
    const choiceH = state.choices.length * CHAR_H + 12;
    const choiceX = GAME_W - choiceW - 8;
    const choiceY = BOX_Y - choiceH - 4;
    drawPokemonBox(ctx, choiceX, choiceY, choiceW, choiceH);
    for (let i = 0; i < state.choices.length; i++) {
      const prefix = i === state.selectedChoice ? '>' : ' ';
      const color = i === state.selectedChoice ? '#080808' : '#606060';
      drawText(ctx, prefix + state.choices[i]!, choiceX + 8, choiceY + 6 + i * CHAR_H, color);
    }
  }

  // Main dialogue box
  drawPokemonBox(ctx, BOX_X, BOX_Y, BOX_W, BOX_H);

  // Draw text with typewriter effect — dark text on light background
  const pageStart = state.currentLine;
  const pageEnd = Math.min(pageStart + MAX_LINES, state.lines.length);
  const pageLines = state.lines.slice(pageStart, pageEnd);

  let charsDrawn = 0;
  for (let i = 0; i < pageLines.length; i++) {
    const line = pageLines[i]!;
    const lineY = TEXT_Y + i * CHAR_H;
    const visibleChars = Math.max(0, Math.min(line.length, state.charIndex - charsDrawn));
    const visibleText = line.slice(0, visibleChars);
    drawText(ctx, visibleText, TEXT_X, lineY, '#080808');
    charsDrawn += line.length;
  }

  // Bouncing advance arrow (Pokemon style)
  if (state.waitingForInput && !state.choices) {
    drawBouncingArrow(ctx, BOX_X + BOX_W - 16, BOX_Y + BOX_H - 14);
  }
};
