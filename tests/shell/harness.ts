// A harness that runs the REAL RoomChallengeScene (real dialogue system, real pause menu, real room instruments) in node,
// with a recording canvas that notices non-finite numbers, and a keyboard emulator that behaves like Input.read():
// edge presses, holds and auto-repeat. Sound and screen-reader modules are replaced by recorders.
import { vi } from 'vitest';
import { consoleLabel, fillButtonNames, type Button, type InputState } from '../../src/engine/Input';
import { loadRooms } from '../../src/rooms/loader';

// The redesigned rooms are a chunk the game loads after the title: load it before any test asks for a room
await loadRooms();

export const DT = 1 / 60;

// ---- recording canvas ----------------------------------------------------------------------------------------

export const problems: string[] = [];
export const spoken = new Map<string, { room: string; choices?: string[] }>();
let currentRoom = '';
export const noteProblem = (what: string) => {
  if (problems.length < 200) problems.push(`${what} @ ${(new Error().stack ?? '').split('\n').slice(3, 7).map(s => s.trim().replace(/\(.*\/(src|tests)\//, '($1/')).join(' < ')}`);
};

const finite = (name: string, args: unknown[]) => {
  for (const a of args) if (typeof a === 'number' && !Number.isFinite(a)) noteProblem(`${name}(${args.map(String).join(',')}) has a non-finite number`);
};

export class FakeCtx {
  fillStyle: unknown = '#000000';
  globalAlpha = 1;
  imageSmoothingEnabled = false;
  draws = 0;
  canvas: { width: number; height: number };
  saves = 0;
  constructor(width: number, height: number) {
    this.canvas = { width, height };
  }
  fillRect(...a: number[]) {
    this.draws++;
    finite('fillRect', a);
  }
  drawImage(img: { width: number; height: number }, ...a: number[]) {
    this.draws++;
    finite('drawImage', a);
    if (!img || img.width === 0 || img.height === 0) noteProblem('drawImage of an empty canvas');
  }
  save() {
    this.saves++;
  }
  restore() {
    this.saves--;
    if (this.saves < 0) noteProblem('restore without save');
  }
  beginPath() {}
  rect(...a: number[]) {
    finite('rect', a);
  }
  clip() {}
  createPattern() {
    return {};
  }
  setTransform() {}
}

export const makeCanvas = (): { width: number; height: number; getContext: () => FakeCtx } => {
  const c = {
    width: 0,
    height: 0,
    getContext: () => new FakeCtx(c.width, c.height),
  };
  return c;
};

export const installFakeDom = () => {
  vi.stubGlobal('document', { createElement: () => makeCanvas() });
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
};

// ---- seeded random ---------------------------------------------------------------------------------------------

export const seeded = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// ---- keyboard emulator (the shape of Input.read()) --------------------------------------------------------------

const BUTTONS: Button[] = ['up', 'down', 'left', 'right', 'a', 'b', 'start', 'select'];
const DIRS: Button[] = ['up', 'down', 'left', 'right'];
const REPEAT_DELAY = 18; // steps (300 ms)
const REPEAT_RATE = 5; // steps (85 ms)

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
    /** Press a button now, holding it for `steps` steps (at least 1). */
    tap(button: Button, steps = 1) {
      if (holdLeft[button]! > 0) return; // already down
      holdLeft[button] = Math.max(1, steps);
      heldFor[button] = 0;
      justDown[button] = true;
    },
    held: (button: Button) => holdLeft[button]! > 0,
    blockRepeats() {
      for (const d of DIRS) if (holdLeft[d]! > 0) blocked[d] = true;
    },
    /** One Input.read(): presses are edges, repeats follow the real timing in steps. */
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
export type Emulator = ReturnType<typeof makeEmulator>;

// ---- the real scene ---------------------------------------------------------------------------------------------

export const KEY_NAMES: Record<string, string> = { up: 'UP', down: 'DOWN', left: 'LEFT', right: 'RIGHT', a: 'SPACE', b: 'X', start: 'ESC', select: 'SHIFT', dpad: 'ARROWS' };

export const makeWorld = async (level = 3, device: 'console' | 'keyboard' = 'console') => {
  const { createInitialState, activateLevel } = await import('../../src/state/GameState');
  const { createDialogueSystem } = await import('../../src/systems/Dialogue');
  const { createPauseMenu } = await import('../../src/systems/PauseMenu');
  const { createRoomChallengeScene } = await import('../../src/scenes/RoomChallengeScene');

  const emu = makeEmulator();
  const gameState = createInitialState();
  gameState.playerName = 'TEST';
  activateLevel(gameState, level);

  const log = { switches: [] as string[], completes: 0, blocks: 0 };
  let current = 'roomChallenge';
  let sceneRef: { onExit?: () => void } | null = null;
  const sceneManager = {
    switchTo(id: string) {
      sceneRef?.onExit?.();
      current = id;
      log.switches.push(id);
    },
    getCurrentId: () => current,
  };

  const input = {
    read: () => emu.read(),
    fill: (text: string) => fillButtonNames(text, device === 'keyboard' ? b => KEY_NAMES[b]! : consoleLabel),
    label: device === 'keyboard' ? (b: string) => KEY_NAMES[b]! : consoleLabel,
    blockRepeats: () => {
      log.blocks++;
      emu.blockRepeats();
    },
    lastDevice: () => device,
  };

  const dialogue = createDialogueSystem(() => input.blockRepeats(), b => input.label(b));
  const realShow = dialogue.show.bind(dialogue);
  dialogue.show = (text, choices, onComplete, onCancel, options) => {
    if (!spoken.has(text)) spoken.set(text, { room: currentRoom, choices });
    realShow(text, choices, onComplete, onCancel, options);
  };
  const realSeq = dialogue.showSequence.bind(dialogue);
  dialogue.showSequence = (texts, onComplete, onCancel, options) => {
    for (const t of texts) if (!spoken.has(t)) spoken.set(t, { room: currentRoom });
    realSeq(texts, onComplete, onCancel, options);
  };
  // Wired like game.ts: quitting from a room still being played asks first
  let roomScene: { inProgress(): boolean } | null = null;
  const pauseMenu = createPauseMenu(sceneManager as never, gameState, dialogue, () => input.blockRepeats(), b => input.label(b), () =>
    sceneManager.getCurrentId() === 'roomChallenge' && roomScene?.inProgress() ? "THIS ROOM WON'T BE SAVED." : null,
  );
  const scene = createRoomChallengeScene(
    input as never,
    sceneManager as never,
    gameState,
    dialogue,
    () => {
      log.completes++;
      current = 'overworld';
    },
    pauseMenu,
  );
  sceneRef = scene;
  roomScene = scene;
  const ctx = new FakeCtx(256, 224) as unknown as CanvasRenderingContext2D;

  return {
    emu,
    gameState,
    dialogue,
    pauseMenu,
    scene,
    log,
    ctx,
    current: () => current,
    enter(room: string) {
      currentRoom = room;
      current = 'roomChallenge';
      scene.setRoom(room);
    },
    step(n = 1) {
      for (let i = 0; i < n; i++) {
        scene.update(DT);
        scene.render(ctx);
      }
    },
    /** Tap a button, then run `after` further steps. */
    press(button: Button, hold = 2, after = 4) {
      emu.tap(button, hold);
      this_step(scene, ctx, hold + after);
    },
  };
};

const this_step = (scene: { update(dt: number): void; render(ctx: CanvasRenderingContext2D): void }, ctx: CanvasRenderingContext2D, n: number) => {
  for (let i = 0; i < n; i++) {
    scene.update(DT);
    scene.render(ctx);
  }
};
export type World = Awaited<ReturnType<typeof makeWorld>>;
