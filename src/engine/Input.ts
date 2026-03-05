export interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  action: boolean; // Space / Enter / A button
  actionPressed: boolean; // true only on frame pressed
  escape: boolean;
  escapePressed: boolean; // true only on frame pressed
}

const KEY_MAP: Record<string, keyof Omit<InputState, 'actionPressed' | 'escapePressed'>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
  ' ': 'action',
  Enter: 'action',
  z: 'action',
  Escape: 'escape',
};

export const createInput = () => {
  const held: Record<string, boolean> = {};
  let actionWasDown = false;
  let escapeWasDown = false;

  const onKeyDown = (e: KeyboardEvent) => {
    if (KEY_MAP[e.key] !== undefined) {
      e.preventDefault();
      held[e.key] = true;
    }
  };

  const onKeyUp = (e: KeyboardEvent) => {
    if (KEY_MAP[e.key] !== undefined) {
      held[e.key] = false;
    }
  };

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  // Touch state
  let touchDir: { up: boolean; down: boolean; left: boolean; right: boolean } = {
    up: false, down: false, left: false, right: false,
  };
  let touchAction = false;
  let touchEscape = false;

  const setTouchDir = (dir: typeof touchDir) => { touchDir = dir; };
  const setTouchAction = (v: boolean) => { touchAction = v; };
  const setTouchEscape = (v: boolean) => { touchEscape = v; };

  const read = (): InputState => {
    const up = !!(held['ArrowUp'] || held['w']) || touchDir.up;
    const down = !!(held['ArrowDown'] || held['s']) || touchDir.down;
    const left = !!(held['ArrowLeft'] || held['a']) || touchDir.left;
    const right = !!(held['ArrowRight'] || held['d']) || touchDir.right;
    const action = !!(held[' '] || held['Enter'] || held['z']) || touchAction;
    const actionPressed = action && !actionWasDown;
    actionWasDown = action;
    const escape = !!held['Escape'] || touchEscape;
    const escapePressed = escape && !escapeWasDown;
    escapeWasDown = escape;
    return { up, down, left, right, action, actionPressed, escape, escapePressed };
  };

  const destroy = () => {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
  };

  return { read, destroy, setTouchDir, setTouchAction, setTouchEscape };
};

export type Input = ReturnType<typeof createInput>;
