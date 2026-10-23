// Drawing without a browser: a recording canvas stands in for the real one, so every step of the review (and the
// room's own animation) can be drawn and checked for exceptions and for anything landing off the screen.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LEVEL_DATA } from '../src/data/sports';
import { BRIEFING_ROOM } from '../src/data/rooms/analysis';
import { RUNNING } from '../src/rooms/content/running';
import { createAnalysisInstrument } from '../src/rooms/analysis';
import { createDialogueSystem } from '../src/systems/Dialogue';
import { consoleLabel, fillButtonNames, type Input, type InputState } from '../src/engine/Input';
import type { RoomHost, RoomResult } from '../src/rooms/types';
import { renderTileMap } from '../src/render/TileMap';

const content = RUNNING.analysis;
const sport = LEVEL_DATA[3]!;
const DT = 1 / 60;
const W = 256;
const H = 224;

// ---- a canvas that remembers what was drawn on it ----

interface FakeCanvas {
  width: number;
  height: number;
  getContext(kind: string): FakeCtx;
}

class FakeCtx {
  fillStyle: unknown = '#000000';
  globalAlpha = 1;
  imageSmoothingEnabled = false;
  /** Everything drawn this frame that fell outside the screen. */
  outside: string[] = [];
  draws = 0;
  private clipped = false;

  constructor(readonly width: number, readonly height: number) {}

  fillRect(x: number, y: number, w: number, h: number) {
    this.draws++;
    if (w <= 0 || h <= 0 || this.clipped) return;
    if (x < 0 || y < 0 || x + w > this.width || y + h > this.height) this.outside.push(`fillRect(${x},${y},${w},${h})`);
  }

  drawImage(image: FakeCanvas, x: number, y: number) {
    this.draws++;
    if (image.width === 0 || image.height === 0) throw new Error('drawImage of an empty canvas');
    if (this.clipped) return;
    if (x < 0 || y < 0 || x + image.width > this.width || y + image.height > this.height) this.outside.push(`drawImage(${image.width}x${image.height} at ${x},${y})`);
  }

  save() {}
  restore() {
    this.clipped = false;
  }
  beginPath() {}
  rect() {}
  clip() {
    this.clipped = true; // the swap's fold: what is cut off is not "outside"
  }
  createPattern() {
    return {};
  }
}

const makeCanvas = (): FakeCanvas => {
  const canvas: FakeCanvas = {
    width: 0,
    height: 0,
    getContext: () => new FakeCtx(canvas.width, canvas.height),
  };
  return canvas;
};

const globals = globalThis as unknown as { document?: unknown };
let hadDocument = false;
let before: unknown;
beforeAll(() => {
  hadDocument = 'document' in globals;
  before = globals.document;
  globals.document = { createElement: () => makeCanvas() };
});
afterAll(() => {
  if (hadDocument) globals.document = before;
  else delete globals.document;
});

// ---- the same fake host as the flow tests ----

const idle = (): InputState => ({
  up: false, down: false, left: false, right: false, a: false, b: false, start: false, select: false,
  upPressed: false, downPressed: false, leftPressed: false, rightPressed: false, aPressed: false, bPressed: false, startPressed: false, selectPressed: false,
  upRepeat: false, downRepeat: false, leftRepeat: false, rightRepeat: false,
  action: false, actionPressed: false, escape: false, escapePressed: false, typed: [],
});

const pressing = (button: 'up' | 'down' | 'left' | 'right' | 'a' | 'b'): InputState => {
  const state = idle();
  state[button] = true;
  state[`${button}Pressed`] = true;
  if (button !== 'a' && button !== 'b') state[`${button}Repeat` as 'upRepeat'] = true;
  return state;
};

const seeded = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const setup = (firstVisit: boolean) => {
  const dialogue = createDialogueSystem();
  const log = { quits: 0, completed: [] as RoomResult[] };
  const input = { fill: (text: string) => fillButtonNames(text, consoleLabel), blockRepeats: () => {} } as unknown as Input;
  const host: RoomHost = {
    sport,
    level: 3,
    input,
    dialogue,
    say: (text, choices, onDone, opts) => dialogue.show(text, choices, onDone, () => host.quit(), { exitLabel: 'QUIT', ...opts }),
    sayAll: (texts, onDone, opts) => dialogue.showSequence(texts, onDone, () => host.quit(), { exitLabel: 'QUIT', ...opts }),
    quit: () => void log.quits++,
    complete: result => void log.completed.push(result),
    firstVisit,
    replay: false,
    rulesRead: () => {},
  };
  const instrument = createAnalysisInstrument(host, content, seeded(3));
  const ctx = new FakeCtx(W, H);
  const problems: string[] = [];
  const steps = new Set<string>();
  /** One step as the scene runs it, then a frame drawn the way the scene draws it. */
  const tick = (inp: InputState = idle()) => {
    const busy = dialogue.isActive();
    dialogue.update(DT, inp);
    instrument.update(DT, inp, busy || dialogue.isActive());
    ctx.outside = [];
    instrument.render(ctx as unknown as CanvasRenderingContext2D);
    dialogue.render(ctx as unknown as CanvasRenderingContext2D);
    const state = instrument.debug!() as { step: string; phase: string };
    steps.add(`${state.phase}/${state.step}`);
    if (ctx.outside.length > 0) problems.push(`${state.phase}/${state.step}: ${ctx.outside.slice(0, 3).join(' ')}`);
  };
  return { instrument, dialogue, log, tick, problems, steps, ctx, state: () => instrument.debug!() as { step: string; pinSteps: number } };
};

/** A scripted player: reads everything, moves the pin where told, picks the options at the given places. */
const play = (t: ReturnType<typeof setup>, pin: number, picks: [number, number]) => {
  let pick = 0;
  for (let frame = 0; frame < 30000 && t.log.completed.length === 0 && t.log.quits === 0; frame++) {
    const state = t.state();
    if (t.dialogue.state.active && !t.dialogue.state.waitingForInput) t.tick(pressing('a'));
    else if (t.dialogue.state.active && t.dialogue.state.choices) {
      if (t.dialogue.state.choiceLock > 0) t.tick();
      else {
        const want = picks[pick] ?? 0;
        if (t.dialogue.state.selectedChoice === want) {
          t.tick(pressing('a'));
          pick++;
        } else t.tick(pressing('down'));
      }
    } else if (t.dialogue.state.active) t.tick(pressing('a'));
    else if (state.step === 'forecast') t.tick(state.pinSteps === pin ? pressing('a') : pressing(state.pinSteps < pin ? 'right' : 'left'));
    else t.tick();
  }
};

describe('the recording canvas', () => {
  it('notices drawing that lands off the screen, and empty images', () => {
    const ctx = new FakeCtx(W, H);
    ctx.fillRect(250, 10, 10, 2);
    ctx.fillRect(-1, 0, 2, 2);
    ctx.fillRect(10, 10, 0, 0); // nothing drawn: fine
    ctx.drawImage({ width: 8, height: 8, getContext: () => ctx }, 252, 0);
    expect(ctx.outside).toHaveLength(3);
    expect(() => ctx.drawImage({ width: 0, height: 4, getContext: () => ctx }, 0, 0)).toThrow();
  });
});

describe('drawing the review', () => {
  it('draws every step of a full play on the screen, without errors', () => {
    for (const [pin, picks] of [[10, [0, 1]], [0, [2, 0]], [-15, [1, 2]], [25, [0, 0]]] as Array<[number, [number, number]]>) {
      for (const firstVisit of [true, false]) {
        const t = setup(firstVisit);
        play(t, pin, picks);
        expect(t.log.completed, `pin ${pin}`).toHaveLength(1);
        expect(t.problems, `pin ${pin} first visit ${firstVisit}`).toEqual([]);
        // the whole story was told: each phase was on screen
        for (const seen of ['brief/brief', 'block/block', 'forecast/forecast', 'retest/retest', 'verdict1/asking', 'verdict1/explaining', 'verdict2/swap', 'verdict2/asking', 'verdict2/explaining', 'summary/summary']) {
          expect(t.steps.has(seen), `${seen} was drawn`).toBe(true);
        }
        expect(t.ctx.draws).toBeGreaterThan(100);
      }
    }
  });

  it('draws while the leave question is up, and after staying', () => {
    const t = setup(true);
    // to the forecast and lock
    for (let frame = 0; frame < 20000 && t.state().step !== 'forecast'; frame++) t.tick(t.dialogue.state.active ? pressing('a') : idle());
    for (let i = 0; i < 30; i++) t.tick();
    for (let i = 0; i < 8; i++) {
      t.tick(pressing('right'));
      t.tick();
    }
    t.tick(pressing('a'));
    for (let i = 0; i < 40; i++) t.tick();
    t.tick(pressing('b'));
    for (let i = 0; i < 80; i++) t.tick();
    expect(t.dialogue.state.choices).toEqual(['STAY', 'LEAVE']);
    t.tick(pressing('b'));
    for (let i = 0; i < 30; i++) t.tick();
    expect(t.problems).toEqual([]);
  });
});

describe('drawing the room', () => {
  it('bakes the map and animates its life on the screen at any time, even after a long session', () => {
    const ctx = new FakeCtx(W, H);
    const draw = () => {
      renderTileMap(ctx as unknown as CanvasRenderingContext2D, BRIEFING_ROOM.tiles, BRIEFING_ROOM.palette, 0, 0, W, H, BRIEFING_ROOM.npcFloor);
    };
    expect(draw).not.toThrow();
    for (const t of [0, 0.1, 1, 3.7, 7, 8.9, 12, 50.5, 1234.5]) {
      ctx.outside = [];
      expect(() => BRIEFING_ROOM.life!(ctx as unknown as CanvasRenderingContext2D, t, sport)).not.toThrow();
      expect(ctx.outside, `t=${t}`).toEqual([]);
    }
  });
});
