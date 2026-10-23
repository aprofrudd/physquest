import { drawText, measureText, CHAR_W } from './PixelFont';
import { consoleLabel, type ButtonLabel, type InputState } from '../engine/Input';
import { sfx } from '../audio/Sfx';
import { announce } from '../ui/announce';

export const GAME_W = 256;
export const GAME_H = 224;
const BOX_H = 56;
const BOX_Y = GAME_H - BOX_H - 4;
const BOX_X = 4;
const BOX_W = GAME_W - 8;
const TEXT_X = BOX_X + 10;
// Four lines per page at a 10px pitch (7px glyphs, 3px between lines). The block is 37px tall inside the box's
// 48px of paper: starting 3px down leaves the bottom corner free for the advance arrow below the 4th line
const LINE_PITCH = 10;
const TEXT_Y = BOX_Y + 7;
const ARROW_X = BOX_X + BOX_W - 16;
const ARROW_Y = BOX_Y + BOX_H - 11; // the arrow bobs over rows 209..214: 1px clear of the 4th line and of the border
const MAX_CHARS_PER_LINE = Math.floor((BOX_W - 20) / CHAR_W);
const PAGE_LINES = 4;
const FAST_TYPING = 3; // typing speed multiplier while A is held

// Choice panel: full width, directly above the main box
const CHOICE_X = BOX_X;
const CHOICE_W = BOX_W;
const CHOICE_MIN_Y = 40; // never rise into the scene header
const CHOICE_GAP = 2; // panel to main box
const OPTION_GAP = 4; // between options (bar to bar): well over the 2px inside one, so a wrapped option reads as one item
const OPTION_PITCH = 9; // line pitch inside an option: 7px glyphs, 2px between lines
const CURSOR_X = CHOICE_X + 10; // fixed column for the '>' cursor
const CURSOR_GAP = 4; // from the cursor glyph's advance to the option text, as in every menu
const OPTION_X = CURSOR_X + CHAR_W + CURSOR_GAP;
const OPTION_CHARS = Math.floor((CHOICE_X + CHOICE_W - 10 - OPTION_X) / CHAR_W);
const OPTION_MAX_LINES = 2;
// A is ignored this long after a list appears, so mashing A can't confirm an answer unseen
const CHOICE_LOCK = 0.35;

const INK = '#080808';
const INK_SOFT = '#303030';
const PAPER = '#f8f8f0';

// Pokemon-style double-line bordered box
const drawPokemonBox = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number
) => {
  // Outer border (black)
  ctx.fillStyle = INK;
  ctx.fillRect(x, y, w, h);
  // Inner border (dark)
  ctx.fillStyle = INK_SOFT;
  ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
  // White interior
  ctx.fillStyle = PAPER;
  ctx.fillRect(x + 4, y + 4, w - 8, h - 8);
};

// Bouncing arrow sprite (small downward triangle)
const drawBouncingArrow = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number
) => {
  const bounce = Math.round(Math.sin(Date.now() / 150)) + 1; // 0..2
  const ay = y + bounce;
  ctx.fillStyle = INK_SOFT;
  // 7px wide triangle pointing down
  ctx.fillRect(x, ay, 7, 1);
  ctx.fillRect(x + 1, ay + 1, 5, 1);
  ctx.fillRect(x + 2, ay + 2, 3, 1);
  ctx.fillRect(x + 3, ay + 3, 1, 1);
};

export interface DialogueState {
  active: boolean;
  pages: string[][]; // wrapped lines, PAGE_LINES per page
  page: number;
  charIndex: number; // characters visible on the current page
  progress: number; // typewriter position including the fractional part (charIndex = floor)
  speed: number; // chars per second
  choices: string[] | null;
  choiceLines: string[][]; // each option wrapped for the choice panel
  selectedChoice: number;
  choiceLock: number; // seconds left in which A cannot confirm
  onComplete: ((choiceIndex?: number) => void) | null;
  onCancel: (() => void) | null; // B: leave the conversation (see cancelDialogue)
  exitLabel: string; // what B does here, shown on the box ('' hides it)
  nextLabel: string; // what A does on the last page when there is no question ('NEXT' by default)
  inputLock: number; // seconds left in which A and B are ignored (e.g. a mash carried over from a bout)
  waitingForInput: boolean; // current page fully typed
}

/** Per-dialogue options. */
export interface DialogueOptions {
  /** What B does, for the box's hint: 'LEAVE' by default; '' when B shouldn't be advertised. */
  exitLabel?: string;
  /** What A does on the last page, for the box's hint, e.g. 'READY' before a bout: 'NEXT' by default. */
  nextLabel?: string;
  /** Ignore A and B for this long after the dialogue opens. */
  lock?: number;
}

export const createDialogueState = (): DialogueState => ({
  active: false,
  pages: [],
  page: 0,
  charIndex: 0,
  progress: 0,
  speed: 40,
  choices: null,
  choiceLines: [],
  selectedChoice: 0,
  choiceLock: 0,
  onComplete: null,
  onCancel: null,
  exitLabel: 'LEAVE',
  nextLabel: 'NEXT',
  inputLock: 0,
  waitingForInput: false,
});

/** Close the dialogue and drop its pending callback. */
export const clearDialogue = (state: DialogueState) => {
  state.active = false;
  state.onComplete = null;
  state.onCancel = null;
  state.inputLock = 0;
  state.choices = null;
  state.choiceLines = [];
  state.pages = [];
  state.page = 0;
  state.charIndex = 0;
  state.progress = 0;
  state.choiceLock = 0;
  state.waitingForInput = false;
};

// Word-wrap text into lines of at most maxChars characters (a word longer than a line is split)
export const wrapText = (text: string, maxChars: number = MAX_CHARS_PER_LINE): string[] => {
  const lines: string[] = [];
  let current = '';

  for (const word of text.split(' ')) {
    let rest = word;
    while (rest.length > maxChars) {
      if (current) {
        lines.push(current);
        current = '';
      }
      lines.push(rest.slice(0, maxChars));
      rest = rest.slice(maxChars);
    }
    if (!rest) continue;

    if (!current) {
      current = rest;
    } else if (current.length + 1 + rest.length <= maxChars) {
      current += ' ' + rest;
    } else {
      lines.push(current);
      current = rest;
    }
  }
  if (current) lines.push(current);
  return lines;
};

// Split lines into pages, never leaving a single orphan line on the last page
const paginate = (lines: string[]): string[][] => {
  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += PAGE_LINES) pages.push(lines.slice(i, i + PAGE_LINES));
  const last = pages[pages.length - 1];
  const before = pages[pages.length - 2];
  if (last && before && last.length === 1 && before.length > 2) {
    const moved = before.pop();
    if (moved !== undefined) last.unshift(moved);
  }
  return pages.length > 0 ? pages : [[]];
};

// Options get at most two lines in the choice panel; anything longer is cut with dots
const wrapOption = (text: string): string[] => {
  const lines = wrapText(text, OPTION_CHARS);
  if (lines.length === OPTION_MAX_LINES) {
    // Narrowest width that still fits on two lines, so the second never dangles one short word
    const longestWord = Math.max(...text.split(' ').map(word => word.length));
    for (let width = Math.max(Math.ceil(text.length / 2), longestWord); width < OPTION_CHARS; width++) {
      const balanced = wrapText(text, width);
      if (balanced.length === OPTION_MAX_LINES) return balanced;
    }
  }
  if (lines.length <= OPTION_MAX_LINES) return lines;
  const kept = lines.slice(0, OPTION_MAX_LINES);
  kept[OPTION_MAX_LINES - 1] = (kept[OPTION_MAX_LINES - 1] ?? '').slice(0, OPTION_CHARS - 3) + '...';
  return kept;
};

const pageLines = (state: DialogueState): string[] => state.pages[state.page] ?? [];
const pageChars = (state: DialogueState): number => pageLines(state).reduce((sum, line) => sum + line.length, 0);
const onLastPage = (state: DialogueState): boolean => state.page >= state.pages.length - 1;
// The list only appears once the question's last page is fully typed
const choicesVisible = (state: DialogueState): boolean =>
  state.choices !== null && state.waitingForInput && onLastPage(state);

export const startDialogue = (
  state: DialogueState,
  text: string,
  choices?: string[],
  onComplete?: (choiceIndex?: number) => void,
  onCancel?: () => void,
  options?: DialogueOptions,
) => {
  state.active = true;
  state.pages = paginate(wrapText(text));
  state.page = 0;
  state.charIndex = 0;
  state.progress = 0;
  state.choices = choices && choices.length > 0 ? choices : null;
  state.choiceLines = state.choices ? state.choices.map(wrapOption) : [];
  state.selectedChoice = 0;
  state.choiceLock = 0;
  state.onComplete = onComplete ?? null;
  state.onCancel = onCancel ?? null;
  state.exitLabel = options?.exitLabel ?? 'LEAVE';
  state.nextLabel = options?.nextLabel ?? 'NEXT';
  state.inputLock = options?.lock ?? 0;
  state.waitingForInput = false;
  announce(pageLines(state).join(' '));
};

const finishPage = (state: DialogueState) => {
  const total = pageChars(state);
  state.charIndex = total;
  state.progress = total;
  state.waitingForInput = true;
  if (choicesVisible(state) && state.choices) {
    state.choiceLock = CHOICE_LOCK;
    announce(`Options: ${state.choices.join('; ')}`);
  }
};

// Close the dialogue, then report the result. The callback may start the next dialogue, so
// nothing may touch the state after it runs.
const finishDialogue = (state: DialogueState, choiceIndex?: number) => {
  const done = state.onComplete;
  state.active = false;
  state.onComplete = null;
  state.onCancel = null;
  state.choices = null;
  state.choiceLines = [];
  state.waitingForInput = false;
  done?.(choiceIndex);
};

/** B leaves a conversation part-way: whatever is still to come is skipped. */
const canCancel = (state: DialogueState): boolean => state.onCancel !== null || state.choices === null;

/**
 * B: the conversation's own exit if it has one; otherwise plain text simply closes (reporting it as
 * finished, so anything waiting on it, such as a step back off a door, still happens). A choice with no
 * exit has to be answered.
 */
const cancelDialogue = (state: DialogueState) => {
  if (!canCancel(state)) return;
  const cancel = state.onCancel;
  if (!cancel) {
    finishDialogue(state);
    return;
  }
  state.active = false;
  state.onComplete = null;
  state.onCancel = null;
  state.choices = null;
  state.choiceLines = [];
  state.waitingForInput = false;
  cancel();
};

export const updateDialogue = (state: DialogueState, dt: number, rawInp: InputState) => {
  if (!state.active) return;

  // While locked, the text keeps typing but A and B do nothing
  let inp = rawInp;
  if (state.inputLock > 0) {
    state.inputLock = Math.max(0, state.inputLock - dt);
    inp = { ...rawInp, a: false, aPressed: false, b: false, bPressed: false };
  }

  // B leaves the conversation at any point, even mid-sentence
  if (inp.bPressed && canCancel(state)) {
    sfx.play('back');
    cancelDialogue(state);
    return;
  }

  // A skips the typing, advances pages and confirms choices
  const skip = inp.aPressed;

  if (!state.waitingForInput) {
    const total = pageChars(state);
    if (skip) {
      state.progress = total;
    } else {
      // Keep the fractional part so the speed stays true at any frame rate
      const fast = inp.a;
      state.progress += dt * state.speed * (fast ? FAST_TYPING : 1);
    }
    // The epsilon absorbs float error, so 60 steps of 1/60s still add up to a whole second
    state.charIndex = Math.min(total, Math.floor(state.progress + 1e-6));
    if (state.charIndex >= total) finishPage(state);
    return;
  }

  if (state.choices && choicesVisible(state)) {
    const count = state.choices.length;
    const before = state.selectedChoice;
    if (inp.upRepeat) state.selectedChoice = (state.selectedChoice - 1 + count) % count;
    if (inp.downRepeat) state.selectedChoice = (state.selectedChoice + 1) % count;
    if (state.selectedChoice !== before) {
      sfx.play('blip');
      announce(state.choices[state.selectedChoice] ?? '');
    }

    const locked = state.choiceLock > 0;
    if (locked) state.choiceLock = Math.max(0, state.choiceLock - dt);
    if (inp.aPressed && !locked) {
      sfx.play('select');
      finishDialogue(state, state.selectedChoice);
    }
    return;
  }

  if (!skip) return;
  sfx.play('blip');
  if (!onLastPage(state)) {
    state.page++;
    state.charIndex = 0;
    state.progress = 0;
    state.waitingForInput = false;
    announce(pageLines(state).join(' '));
  } else {
    finishDialogue(state);
  }
};

const drawChoicePanel = (ctx: CanvasRenderingContext2D, state: DialogueState) => {
  const rows = state.choiceLines;
  if (rows.length === 0) return;

  // An option's bar is OPTION_PITCH per line (the glyphs plus 1px above and below); the panel adds 4px border
  // and 2px padding each side
  const barHeight = (lines: string[]) => lines.length * OPTION_PITCH;
  const panelHeight = (gap: number) =>
    rows.reduce((sum, lines) => sum + barHeight(lines), 0) + (rows.length - 1) * gap + 12;
  const tooTall = (gap: number, boxGap: number) => BOX_Y - boxGap - panelHeight(gap) < CHOICE_MIN_Y;

  // Too tall to fit under the header: tighten the spacing until it does
  let gap = OPTION_GAP;
  let boxGap = CHOICE_GAP;
  while (gap > 0 && tooTall(gap, boxGap)) gap--;
  if (tooTall(gap, boxGap)) boxGap = 0;
  const panelH = panelHeight(gap);
  const panelY = BOX_Y - boxGap - panelH;
  drawPokemonBox(ctx, CHOICE_X, panelY, CHOICE_W, panelH);

  let y = panelY + 7;
  for (let i = 0; i < rows.length; i++) {
    const lines = rows[i]!;
    const barH = barHeight(lines);
    const selected = i === state.selectedChoice;
    if (selected) {
      // Dark bar, light text: obvious at a glance even at small sizes
      ctx.fillStyle = INK_SOFT;
      ctx.fillRect(CHOICE_X + 6, y - 1, CHOICE_W - 12, barH);
      drawText(ctx, '>', CURSOR_X, y, PAPER);
    }
    const color = selected ? PAPER : INK_SOFT;
    for (let k = 0; k < lines.length; k++) {
      drawText(ctx, lines[k]!, OPTION_X, y + k * OPTION_PITCH, color);
    }
    y += barH + gap;
  }
};

// A small tag hanging off the box's bottom edge naming what A and B do here. It sits below the 4th text
// line and left of the advance arrow, half on the frame and half on the margin under the box.
const drawHintTag = (ctx: CanvasRenderingContext2D, state: DialogueState, name: ButtonLabel) => {
  const aDoes = choicesVisible(state) ? 'CHOOSE' : onLastPage(state) ? state.nextLabel : 'NEXT';
  const showB = canCancel(state) && state.exitLabel !== '';
  const label = `${name('a')}: ${aDoes}${showB ? `   ${name('b')}: ${state.exitLabel}` : ''}`;
  const w = measureText(label) - 1 + 6;
  const x = BOX_X + 10;
  const y = BOX_Y + BOX_H - 6;
  ctx.fillStyle = INK;
  ctx.fillRect(x, y, w, 9);
  ctx.fillStyle = INK_SOFT;
  ctx.fillRect(x + 1, y + 1, w - 2, 7);
  drawText(ctx, label, x + 3, y + 1, PAPER);
};

export const renderDialogue = (
  ctx: CanvasRenderingContext2D,
  state: DialogueState,
  name: ButtonLabel = consoleLabel,
) => {
  if (!state.active) return;

  const showChoices = choicesVisible(state);
  if (showChoices) drawChoicePanel(ctx, state);

  // Main dialogue box
  drawPokemonBox(ctx, BOX_X, BOX_Y, BOX_W, BOX_H);

  // Draw text with typewriter effect — dark text on light background
  const lines = pageLines(state);
  let charsLeft = state.charIndex;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const visibleChars = Math.max(0, Math.min(line.length, charsLeft));
    drawText(ctx, line.slice(0, visibleChars), TEXT_X, TEXT_Y + i * LINE_PITCH, INK);
    charsLeft -= line.length;
  }

  // Bouncing advance arrow (Pokemon style)
  if (state.waitingForInput && !showChoices) {
    drawBouncingArrow(ctx, ARROW_X, ARROW_Y);
  }

  drawHintTag(ctx, state, name);
};
