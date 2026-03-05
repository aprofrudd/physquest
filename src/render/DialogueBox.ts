import { drawBox } from './SpriteSheet';
import { drawText, CHAR_W, CHAR_H } from './PixelFont';

export const GAME_W = 256;
export const GAME_H = 224;
const BOX_H = 56;
const BOX_Y = GAME_H - BOX_H - 4;
const BOX_X = 4;
const BOX_W = GAME_W - 8;
const TEXT_X = BOX_X + 8;
const TEXT_Y = BOX_Y + 8;
const MAX_CHARS_PER_LINE = Math.floor((BOX_W - 16) / CHAR_W);
const MAX_LINES = 3;

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
  const lastLineOnPage = pageLines[pageLines.length - 1] ?? '';

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

  // Calculate box height — taller if choices are shown
  const choiceExtra = state.choices && state.waitingForInput
    ? state.choices.length * CHAR_H + 8
    : 0;
  const boxH = BOX_H + choiceExtra;
  const boxY = GAME_H - boxH - 4;

  // Draw box
  drawBox(ctx, BOX_X, boxY, BOX_W, boxH, '#0a0a14', '#aaaadd', 2);

  // Draw text with typewriter effect
  const pageStart = state.currentLine;
  const pageEnd = Math.min(pageStart + MAX_LINES, state.lines.length);
  const pageLines = state.lines.slice(pageStart, pageEnd);

  let charsDrawn = 0;
  for (let i = 0; i < pageLines.length; i++) {
    const line = pageLines[i]!;
    const lineY = boxY + 8 + i * CHAR_H;
    const visibleChars = Math.max(0, Math.min(line.length, state.charIndex - charsDrawn));
    const visibleText = line.slice(0, visibleChars);
    drawText(ctx, visibleText, TEXT_X, lineY, '#eeeeff');
    charsDrawn += line.length;
  }

  // Draw choices if text is done and choices exist
  if (state.choices && state.waitingForInput) {
    const choicesY = boxY + 8 + pageLines.length * CHAR_H + 4;
    for (let i = 0; i < state.choices.length; i++) {
      const prefix = i === state.selectedChoice ? '> ' : '  ';
      const color = i === state.selectedChoice ? '#5b5bd9' : '#aaaadd';
      drawText(ctx, prefix + state.choices[i]!, TEXT_X, choicesY + i * CHAR_H, color);
    }
  }

  // Draw advance indicator
  if (state.waitingForInput && !state.choices) {
    const blinkOn = Math.floor(Date.now() / 400) % 2 === 0;
    if (blinkOn) {
      drawText(ctx, 'V', BOX_X + BOX_W - 14, boxY + boxH - 12, '#aaaadd');
    }
  }
};
