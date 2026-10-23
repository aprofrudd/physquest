// Unified input: physical keyboard + the on-screen console buttons (pointer/touch).
// Scenes call read() exactly once per fixed update step.
//
// Every button can be held by several sources at once ("key:KeyZ", "ptr:3", ...).
// A press that starts and ends between two read() calls still reports as
// pressed AND held for one step, so quick taps are never lost.

export type Button = 'up' | 'down' | 'left' | 'right' | 'a' | 'b' | 'start' | 'select';

export const BUTTONS: readonly Button[] = ['up', 'down', 'left', 'right', 'a', 'b', 'start', 'select'];

export interface InputState {
  // Held this step
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  a: boolean;
  b: boolean;
  start: boolean;
  select: boolean;
  // Went down since the previous read()
  upPressed: boolean;
  downPressed: boolean;
  leftPressed: boolean;
  rightPressed: boolean;
  aPressed: boolean;
  bPressed: boolean;
  startPressed: boolean;
  selectPressed: boolean;
  // Direction pressed, or auto-repeating while held (for menus and cursors)
  upRepeat: boolean;
  downRepeat: boolean;
  leftRepeat: boolean;
  rightRepeat: boolean;
  // Legacy aliases: action = A, escape = START
  action: boolean;
  actionPressed: boolean;
  escape: boolean;
  escapePressed: boolean;
  // Characters typed on a physical keyboard since the previous read() (text mode only)
  typed: string[];
}

// Physical key positions (KeyboardEvent.code), so WASD/ZX work on any layout.
const CODE_TO_BUTTON: Record<string, Button> = {
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  KeyZ: 'a',
  Space: 'a',
  Enter: 'a',
  NumpadEnter: 'a',
  KeyX: 'b',
  Backspace: 'b',
  Escape: 'start',
  KeyP: 'start',
  ShiftLeft: 'select',
  ShiftRight: 'select',
};

// Fallback for keyboards that report an empty `code`
const KEY_TO_BUTTON: Record<string, Button> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ' ': 'a',
  Enter: 'a',
  Backspace: 'b',
  Escape: 'start',
  Shift: 'select',
};

// While typing a name, letters/digits become text and only these keys act as buttons
const TEXT_MODE_CODES: Record<string, Button> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  Backspace: 'b',
  Enter: 'start',
  Escape: 'start',
  NumpadEnter: 'start',
};

const TYPEABLE = /^[A-Za-z0-9.\-]$/;

// Held directions auto-repeat in menus: first repeat after REPEAT_DELAY, then every REPEAT_RATE (ms)
const REPEAT_DELAY = 300;
const REPEAT_RATE = 85;
const DIRECTIONS = ['up', 'down', 'left', 'right'] as const;

const isEditableTarget = (target: EventTarget | null): boolean => {
  const el = target as HTMLElement | null;
  if (!el || typeof el.tagName !== 'string') return false;
  return el.isContentEditable || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT';
};

const record = <T>(make: () => T): Record<Button, T> => ({
  up: make(),
  down: make(),
  left: make(),
  right: make(),
  a: make(),
  b: make(),
  start: make(),
  select: make(),
});

export type InputListener = (button: Button, isDown: boolean) => void;

/** What the player is using right now: the physical keyboard, or the on-screen console (touch or mouse). */
export type InputDevice = 'keyboard' | 'console';

// What to call each button in on-screen prompts when the player is on a keyboard
const KEY_LABEL: Record<Button | 'dpad', string> = {
  up: 'UP',
  down: 'DOWN',
  left: 'LEFT',
  right: 'RIGHT',
  a: 'SPACE',
  b: 'X',
  start: 'ESC',
  select: 'SHIFT',
  dpad: 'ARROWS',
};

const CONSOLE_LABEL: Record<Button | 'dpad', string> = {
  up: 'UP',
  down: 'DOWN',
  left: 'LEFT',
  right: 'RIGHT',
  a: 'A',
  b: 'B',
  start: 'START',
  select: 'SELECT',
  dpad: 'D-PAD',
};

/** Names a button for prompts. */
export type ButtonLabel = (button: Button | 'dpad') => string;

/** Console wording regardless of device (see createInput's label for the device-aware one). */
export const consoleLabel: ButtonLabel = button => CONSOLE_LABEL[button];

// Prompt text names buttons as {A}, {B}, {START}, {SELECT} or {DPAD}
const BUTTON_TOKEN = /\{(A|B|START|SELECT|DPAD)\}/g;

/** Replace the button tokens in `text` with the names `name` gives them. */
export const fillButtonNames = (text: string, name: ButtonLabel): string =>
  text.replace(BUTTON_TOKEN, (_, key: string) => name(key === 'DPAD' ? 'dpad' : (key.toLowerCase() as Button)));

export const createInput = () => {
  const sources = record(() => new Set<string>());
  const pressSerial = record(() => 0);
  const seenSerial = record(() => 0);
  const listeners = new Set<InputListener>();
  const nextRepeatAt = record(() => 0); // performance.now() timestamp of the next auto-repeat
  const repeatBlocked = record(() => false); // held since before the current menu appeared
  const keyButtons = new Map<string, Button>(); // key source -> button it is holding
  let textMode = false;
  let typed: string[] = [];
  // Desktops start on keyboard wording; the first touch or click of a console button switches it
  let device: InputDevice =
    typeof window.matchMedia === 'function' && window.matchMedia('(hover: hover) and (pointer: fine)').matches
      ? 'keyboard'
      : 'console';

  const press = (button: Button, source: string) => {
    if (!source.startsWith('key:')) device = 'console';
    const set = sources[button];
    if (set.has(source)) return;
    const wasUp = set.size === 0;
    set.add(source);
    if (wasUp) {
      pressSerial[button]++;
      listeners.forEach(fn => fn(button, true));
    }
  };

  const release = (button: Button, source: string) => {
    const set = sources[button];
    if (!set.delete(source)) return;
    if (set.size === 0) listeners.forEach(fn => fn(button, false));
  };

  const releaseSource = (source: string) => {
    for (const button of BUTTONS) release(button, source);
  };

  const releaseAll = () => {
    for (const button of BUTTONS) {
      const set = sources[button];
      if (set.size === 0) continue;
      set.clear();
      listeners.forEach(fn => fn(button, false));
    }
    keyButtons.clear();
  };

  const buttonForEvent = (e: KeyboardEvent): Button | undefined => {
    if (textMode) return TEXT_MODE_CODES[e.code];
    return CODE_TO_BUTTON[e.code] ?? (e.code ? undefined : KEY_TO_BUTTON[e.key]);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (!e.ctrlKey && !e.metaKey && !e.altKey && !isEditableTarget(e.target)) device = 'keyboard';
    if (isEditableTarget(e.target)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return; // leave browser shortcuts alone

    if (textMode && TYPEABLE.test(e.key) && !TEXT_MODE_CODES[e.code]) {
      e.preventDefault();
      if (!e.repeat) typed.push(e.key.toUpperCase());
      return;
    }
    if (textMode && e.code === 'Space') {
      e.preventDefault(); // names have no spaces; never let Space submit or click anything
      return;
    }

    const button = buttonForEvent(e);
    if (!button) return;
    e.preventDefault(); // stop arrows/space scrolling, backspace navigating
    if (e.repeat) return;
    const source = `key:${e.code || e.key}`;
    keyButtons.set(source, button);
    press(button, source);
  };

  const onKeyUp = (e: KeyboardEvent) => {
    const source = `key:${e.code || e.key}`;
    const button = keyButtons.get(source);
    if (!button) return;
    keyButtons.delete(source);
    release(button, source);
  };

  const onVisibility = () => {
    if (document.visibilityState === 'hidden') releaseAll();
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', releaseAll);
  document.addEventListener('visibilitychange', onVisibility);

  const read = (): InputState => {
    const pressed = record(() => false);
    const held = record(() => false);
    for (const button of BUTTONS) {
      pressed[button] = pressSerial[button] !== seenSerial[button];
      seenSerial[button] = pressSerial[button];
      held[button] = sources[button].size > 0 || pressed[button];
    }
    const now = performance.now();
    const repeat = record(() => false);
    for (const dir of DIRECTIONS) {
      if (pressed[dir]) {
        repeatBlocked[dir] = false;
        repeat[dir] = true;
        nextRepeatAt[dir] = now + REPEAT_DELAY;
      } else if (sources[dir].size === 0) {
        repeatBlocked[dir] = false;
      } else if (!repeatBlocked[dir] && now >= nextRepeatAt[dir]) {
        repeat[dir] = true;
        nextRepeatAt[dir] = now + REPEAT_RATE;
      }
    }
    const out: InputState = {
      up: held.up,
      down: held.down,
      left: held.left,
      right: held.right,
      a: held.a,
      b: held.b,
      start: held.start,
      select: held.select,
      upPressed: pressed.up,
      downPressed: pressed.down,
      leftPressed: pressed.left,
      rightPressed: pressed.right,
      aPressed: pressed.a,
      bPressed: pressed.b,
      startPressed: pressed.start,
      selectPressed: pressed.select,
      upRepeat: repeat.up,
      downRepeat: repeat.down,
      leftRepeat: repeat.left,
      rightRepeat: repeat.right,
      action: held.a,
      actionPressed: pressed.a,
      escape: held.start,
      escapePressed: pressed.start,
      typed,
    };
    typed = [];
    return out;
  };

  /** While on, physical letter/digit keys produce `typed` characters instead of button presses. */
  const setTextMode = (on: boolean) => {
    if (textMode === on) return;
    releaseAll();
    textMode = on;
    typed = [];
  };

  /**
   * Directions held right now stop auto-repeating until they are released, so a thumb resting on the
   * D-pad can't scroll a menu or choice list that has only just appeared. Call when one opens.
   */
  const blockRepeats = () => {
    for (const dir of DIRECTIONS) if (sources[dir].size > 0) repeatBlocked[dir] = true;
  };

  /** Fires when a button goes down (no sources -> some) or up (some -> none). */
  const onChange = (fn: InputListener) => {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  };

  const destroy = () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', releaseAll);
    document.removeEventListener('visibilitychange', onVisibility);
    listeners.clear();
  };

  /** What to call a button in a prompt: console names (A, B, START, SELECT, D-PAD), or key names on a keyboard. */
  const label: ButtonLabel = button => (device === 'keyboard' ? KEY_LABEL : CONSOLE_LABEL)[button];
  /** `text` with its {A}/{B}/{START}/{SELECT}/{DPAD} tokens named for the player's device. */
  const fill = (text: string): string => fillButtonNames(text, label);

  return {
    read,
    press,
    release,
    releaseSource,
    releaseAll,
    setTextMode,
    blockRepeats,
    onChange,
    destroy,
    label,
    fill,
    lastDevice: (): InputDevice => device,
  };
};

export type Input = ReturnType<typeof createInput>;
