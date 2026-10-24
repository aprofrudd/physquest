// A keyboard emulator with the shape of Input.read() (edge presses, holds, auto-repeat): the same one tests/shell/harness.ts uses,
// without that file's side effects (it loads the room chunk and stubs the loader's callers).
import type { Button, InputState } from '../../src/engine/Input';

const BUTTONS: Button[] = ['up', 'down', 'left', 'right', 'a', 'b', 'start', 'select'];
const DIRS: Button[] = ['up', 'down', 'left', 'right'];
const REPEAT_DELAY = 18;
const REPEAT_RATE = 5;

export const makeEmulator = () => {
  const holdLeft: Record<string, number> = {};
  const heldFor: Record<string, number> = {};
  const justDown: Record<string, boolean> = {};
  const blocked: Record<string, boolean> = {};
  for (const b of BUTTONS) {
    holdLeft[b] = 0;
    heldFor[b] = 0;
    justDown[b] = false;
    blocked[b] = false;
  }
  return {
    tap(button: Button, steps = 1) {
      if (holdLeft[button]! > 0) return;
      holdLeft[button] = Math.max(1, steps);
      heldFor[button] = 0;
      justDown[button] = true;
    },
    blockRepeats() {
      for (const d of DIRS) if (holdLeft[d]! > 0) blocked[d] = true;
    },
    read(): InputState {
      const out: Record<string, boolean> = {};
      for (const b of BUTTONS) {
        const down = holdLeft[b]! > 0;
        const pressed = justDown[b]!;
        out[b] = down;
        out[`${b}Pressed`] = pressed;
        if (down) heldFor[b]!++;
        if (DIRS.includes(b)) {
          let repeat = false;
          if (pressed) {
            blocked[b] = false;
            repeat = true;
          } else if (!down) {
            blocked[b] = false;
          } else if (!blocked[b]) {
            const n = heldFor[b]!;
            if (n >= REPEAT_DELAY && (n - REPEAT_DELAY) % REPEAT_RATE === 0) repeat = true;
          }
          out[`${b}Repeat`] = repeat;
        }
        justDown[b] = false;
        if (down) holdLeft[b]!--;
      }
      out.action = out.a!;
      out.actionPressed = out.aPressed!;
      out.escape = out.start!;
      out.escapePressed = out.startPressed!;
      (out as unknown as { typed: string[] }).typed = [];
      return out as unknown as InputState;
    },
  };
};
