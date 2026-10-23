// The instrument's button handling, driven the way RoomChallengeScene drives it (dialogue first, then the
// instrument with `busy` set while the dialogue had the step), with a fake host. No canvas, no browser.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InputState } from '../src/engine/Input';
import { createDialogueSystem, type DialogueSystem } from '../src/systems/Dialogue';
import { LEVEL_DATA } from '../src/data/sports';
import { RUNNING } from '../src/rooms/content/running';
import type { RoomHost, RoomInstrument, RoomResult } from '../src/rooms/types';

// Sounds and screen-reader announcements are recorded, not played
const played: string[] = [];
const announced: string[] = [];
vi.mock('../src/audio/Sfx', () => ({ sfx: { play: (name: string) => played.push(name) } }));
vi.mock('../src/ui/announce', () => ({ announce: (text: string) => announced.push(text) }));

const { createDataRoom } = await import('../src/rooms/datalab');

const sport = LEVEL_DATA[3]!;
const content = RUNNING.data;
const DT = 1 / 60;

type Button = 'a' | 'b' | 'left' | 'right' | 'up' | 'down' | 'start';

const idle = (): InputState => ({
  up: false, down: false, left: false, right: false, a: false, b: false, start: false, select: false,
  upPressed: false, downPressed: false, leftPressed: false, rightPressed: false, aPressed: false, bPressed: false, startPressed: false, selectPressed: false,
  upRepeat: false, downRepeat: false, leftRepeat: false, rightRepeat: false,
  action: false, actionPressed: false, escape: false, escapePressed: false, typed: [],
});

/** One step with `button` going down (an edge, and a repeat for directions). */
const tap = (button: Button): InputState => {
  const inp = idle() as unknown as Record<string, unknown>;
  inp[button] = true;
  inp[`${button}Pressed`] = true;
  if (['up', 'down', 'left', 'right'].includes(button)) inp[`${button}Repeat`] = true;
  return inp as unknown as InputState;
};

interface Rig {
  host: RoomHost;
  dialogue: DialogueSystem;
  room: RoomInstrument;
  quit: ReturnType<typeof vi.fn>;
  complete: ReturnType<typeof vi.fn>;
  debug: () => Debug;
  /** One scene step. */
  step(inp?: InputState, dt?: number): void;
  /** Press a button for one step, then let `wait` seconds pass. */
  press(button: Button, wait?: number): void;
  wait(seconds: number): void;
  /** Press A until the dialogue box closes. */
  closeDialogue(): void;
}

interface Debug {
  phase: string;
  view: number;
  decided: number;
  suspects: { kind: string; real: boolean; decided: string | null; right: boolean | null }[];
  cleanScore: number;
  pins: string[];
  list: { name: string; key: boolean; pinned: boolean; odd: boolean; shown: string }[];
  cursor: number;
  derived: { lt1Pace: string | null; lt2Pace: string | null; sprintKmh: number };
  result: RoomResult;
}

/** Seeded random source, so every test plays the same attempt. */
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

const makeRig = (options: { firstVisit?: boolean; seed?: number } = {}): Rig => {
  const dialogue = createDialogueSystem();
  const quit = vi.fn();
  const complete = vi.fn();
  const host: RoomHost = {
    sport,
    level: 3,
    input: { fill: (t: string) => t, label: () => 'A', blockRepeats: vi.fn() } as unknown as RoomHost['input'],
    dialogue,
    say: (text, choices, onDone, opts = { exitLabel: 'QUIT' }) => dialogue.show(text, choices, onDone, quit, opts),
    sayAll: (texts, onDone, opts = { exitLabel: 'QUIT' }) => dialogue.showSequence(texts, onDone, quit, { exitLabel: 'QUIT', ...opts }),
    quit,
    complete,
    firstVisit: options.firstVisit ?? true,
    replay: false,
    rulesRead: () => {},
  };
  const room = createDataRoom(host, seeded(options.seed ?? 7));
  const rig: Rig = {
    host,
    dialogue,
    room,
    quit,
    complete,
    debug: () => room.debug!() as Debug,
    step(inp = idle(), dt = DT) {
      const busy = dialogue.isActive();
      dialogue.update(dt, inp);
      room.update(dt, inp, busy || dialogue.isActive());
    },
    press(button, wait = 0) {
      rig.step(tap(button));
      rig.wait(wait);
    },
    wait(seconds) {
      for (let t = 0; t < seconds; t += DT) rig.step();
    },
    closeDialogue() {
      for (let guard = 0; guard < 80 && dialogue.isActive(); guard++) {
        rig.step(tap('a'));
        rig.wait(0.1);
      }
    },
  };
  return rig;
};

/** To the first suspect with the lens on it and the lock passed. */
const toCleanup = (rig: Rig) => {
  rig.closeDialogue(); // the brief, then (first visit) the lens rule
  rig.wait(0.5);
};

const cleanPerfectly = (rig: Rig) => {
  const { suspects } = rig.debug();
  suspects.forEach((s, i) => {
    rig.press(s.real ? 'right' : 'a', 0.4);
    if (i < suspects.length - 1) rig.press('a', 0.4);
  });
};

/** Move the pin cursor down to `row` (a bounded loop: a test that cannot get there fails instead of hanging). */
const moveTo = (rig: Rig, row: number) => {
  for (let guard = 0; guard < 12 && rig.debug().cursor !== row; guard++) rig.press('down', 0.05);
  expect(rig.debug().cursor).toBe(row);
};

const toPin = (rig: Rig) => {
  toCleanup(rig);
  cleanPerfectly(rig);
  rig.press('a', 0.1); // on from the last verdict
  rig.closeDialogue(); // the room's question
  rig.wait(0.5);
};

beforeEach(() => {
  played.length = 0;
  announced.length = 0;
});

describe('the brief', () => {
  it('says the protocol and the rules on a first visit, then the lens rule, then waits for a decision', () => {
    const rig = makeRig();
    const pages: string[] = [];
    // read every page as it opens
    for (let guard = 0; guard < 60 && rig.dialogue.isActive(); guard++) {
      const text = rig.dialogue.state.pages.flat().join(' ');
      if (pages.at(-1) !== text) pages.push(text);
      rig.step(tap('a'));
      rig.wait(0.05);
    }
    expect(pages[0]).toBe(content.protocol);
    expect(pages[1]).toContain('Press A to remove a glitch, or RIGHT to keep real data.');
    expect(pages[2]).toBe('Then pin the 3 variables that should guide her training.');
    expect(pages[3]).toBe(content.lensRule);
    expect(rig.debug().phase).toBe('cleanup');
    expect(rig.debug().decided).toBe(0);
  });

  it('says the short rules on a replay and no lens rule', () => {
    const rig = makeRig({ firstVisit: false });
    expect(rig.dialogue.state.pages.flat().join(' ')).toContain('Clean the file (A: remove, RIGHT: keep), then pin 3 variables.');
    rig.closeDialogue();
    expect(rig.dialogue.isActive()).toBe(false);
    expect(rig.debug().phase).toBe('cleanup');
  });

  it('quits at once on B (nothing is decided)', () => {
    const rig = makeRig();
    rig.press('b', 0.1);
    expect(rig.quit).toHaveBeenCalledTimes(1);
  });
});

describe('clean-up input', () => {
  it('ignores A and RIGHT for 0.35 s after a suspect appears, then decides', () => {
    const rig = makeRig();
    rig.closeDialogue(); // the brief and the lens rule: the last press closed the box a moment ago
    const first = rig.debug().suspects[0]!;
    rig.press('a');
    rig.press('right');
    expect(rig.debug().decided).toBe(0);
    rig.wait(0.4);
    rig.press(first.real ? 'right' : 'a');
    expect(rig.debug().decided).toBe(1);
  });

  it('only a fresh RIGHT press keeps: a held, repeating RIGHT does nothing', () => {
    const rig = makeRig();
    toCleanup(rig);
    const held = idle();
    held.right = true;
    held.rightRepeat = true; // no rightPressed edge
    for (let i = 0; i < 30; i++) rig.step(held);
    expect(rig.debug().decided).toBe(0);
    rig.press('right');
    expect(rig.debug().decided).toBe(1);
  });

  it('A removes and RIGHT keeps, and the verdict follows the content', () => {
    const rig = makeRig();
    toCleanup(rig);
    const first = rig.debug().suspects[0]!;
    rig.press(first.real ? 'a' : 'right', 0.1); // the wrong call on purpose
    const d = rig.debug();
    expect(d.suspects[0]!.right).toBe(false);
    expect(d.cleanScore).toBe(0);
    expect(played).toContain('wrong');
    expect(announced.at(-1)).toContain(first.real ? 'That was real' : 'Missed');
  });

  it('shows a verdict first, then A moves to the next suspect after the lock', () => {
    const rig = makeRig();
    toCleanup(rig);
    const first = rig.debug().suspects[0]!;
    rig.press(first.real ? 'right' : 'a');
    rig.press('a'); // inside the lock: ignored
    expect(rig.debug().view).toBe(0);
    rig.wait(0.4);
    rig.press('a');
    expect(rig.debug().view).toBe(1);
  });

  it('looks back with LEFT (read-only) and returns to the pending suspect with A', () => {
    const rig = makeRig();
    toCleanup(rig);
    const s0 = rig.debug().suspects[0]!;
    rig.press(s0.real ? 'right' : 'a', 0.4);
    rig.press('a', 0.4); // suspect 2 pending
    expect(rig.debug().view).toBe(1);
    rig.press('left', 0.1);
    expect(rig.debug().view).toBe(0);
    rig.press('a', 0.4); // review: forward, never a decision
    expect(rig.debug().view).toBe(1);
    expect(rig.debug().decided).toBe(1);
    rig.press('left', 0.1);
    rig.press('right', 0.4); // RIGHT forward in a review too, never "keep"
    expect(rig.debug().decided).toBe(1);
  });

  it('LEFT does nothing at the first suspect', () => {
    const rig = makeRig();
    toCleanup(rig);
    rig.press('left', 0.1);
    expect(rig.debug().view).toBe(0);
  });

  it('asks before leaving once a decision is made: B again stays, LEAVE quits', () => {
    const rig = makeRig();
    toCleanup(rig);
    const s0 = rig.debug().suspects[0]!;
    rig.press(s0.real ? 'right' : 'a', 0.4);
    rig.press('b', 0.1);
    expect(rig.quit).not.toHaveBeenCalled();
    expect(rig.dialogue.isActive()).toBe(true);
    expect(rig.dialogue.state.pages.flat().join(' ')).toBe('Leave the data desk? Your clean-up will be lost.');
    rig.press('a', 0.1); // finish typing: the list appears
    rig.wait(0.5);
    expect(rig.dialogue.state.choices).toEqual(['STAY', 'LEAVE']);
    rig.press('b', 0.1); // B again stays
    expect(rig.dialogue.isActive()).toBe(false);
    expect(rig.quit).not.toHaveBeenCalled();
    rig.wait(0.4);
    rig.press('b', 0.1);
    rig.press('a', 0.1);
    rig.wait(0.5);
    rig.press('down', 0.1);
    rig.press('a', 0.1);
    expect(rig.quit).toHaveBeenCalledTimes(1);
    expect(rig.complete).not.toHaveBeenCalled();
  });

  it('ignores B for 0.35 s after a decision appears, like A', () => {
    const rig = makeRig();
    toCleanup(rig);
    const s0 = rig.debug().suspects[0]!;
    rig.press(s0.real ? 'right' : 'a');
    rig.press('b'); // inside the lock
    expect(rig.dialogue.isActive()).toBe(false);
    expect(rig.quit).not.toHaveBeenCalled();
  });

  it('does nothing on the START button (the scene handles the pause menu)', () => {
    const rig = makeRig();
    toCleanup(rig);
    rig.press('start', 0.1);
    expect(rig.debug().decided).toBe(0);
  });
});

describe('the pin list', () => {
  it('opens after the last verdict with the room\'s question, then a list with the cursor on the first row', () => {
    const rig = makeRig();
    toCleanup(rig);
    cleanPerfectly(rig);
    rig.press('a', 0.1);
    expect(rig.debug().phase).toBe('pin');
    expect(rig.dialogue.isActive()).toBe(true);
    expect(rig.dialogue.state.pages.flat().join(' ')).toBe('Then pin the 3 variables that should guide her training.');
    rig.closeDialogue();
    rig.wait(0.5);
    expect(rig.debug().cursor).toBe(0);
    expect(rig.debug().list.length).toBe(5);
  });

  it('asks before leaving from the question too (B there is not a free exit)', () => {
    const rig = makeRig();
    toCleanup(rig);
    cleanPerfectly(rig);
    rig.press('a', 0.1);
    rig.press('b', 0.1);
    expect(rig.quit).not.toHaveBeenCalled();
    expect(rig.dialogue.state.pages.flat().join(' ')).toBe('Leave the data desk? Your clean-up will be lost.');
  });

  it('moves the cursor with the arrows (wrapping) and pins with A, refusing a fourth', () => {
    const rig = makeRig();
    toPin(rig);
    rig.press('up', 0.05);
    expect(rig.debug().cursor).toBe(4);
    rig.press('down', 0.05);
    expect(rig.debug().cursor).toBe(0);
    for (let row = 0; row < 3; row++) {
      rig.press('a', 0.2);
      rig.press('down', 0.05);
    }
    expect(rig.debug().pins.length).toBe(3);
    rig.press('a', 0.2); // the fourth row
    expect(rig.debug().pins.length).toBe(3);
    expect(played).toContain('wrong');
  });

  it('reaches LOCK IN only with three pins', () => {
    const rig = makeRig();
    toPin(rig);
    for (let i = 0; i < 6; i++) rig.press('down', 0.05);
    expect(rig.debug().cursor).toBeLessThan(5); // never on LOCK IN with no pins
    for (let row = 0; row < 3; row++) {
      rig.press('a', 0.2);
      rig.press('down', 0.05);
    }
    let reached = false;
    for (let i = 0; i < 6; i++) {
      rig.press('down', 0.05);
      if (rig.debug().cursor === 5) reached = true;
    }
    expect(reached).toBe(true);
  });

  it('shows the player\'s own number with a ? and the hint, after a poor clean-up', () => {
    const rig = makeRig();
    toCleanup(rig);
    const { suspects } = rig.debug();
    suspects.forEach((s, i) => {
      rig.press(s.real ? 'a' : 'right', 0.4); // every call wrong
      if (i < suspects.length - 1) rig.press('a', 0.4);
    });
    rig.press('a', 0.1);
    rig.closeDialogue();
    rig.wait(0.5);
    const odd = rig.debug().list.findIndex(r => r.odd);
    expect(odd).toBeGreaterThanOrEqual(0);
    expect(rig.debug().list[odd]!.shown.endsWith('?')).toBe(true);
  });
});

describe('lock-in and the reveal', () => {
  const pinKeys = (rig: Rig) => {
    const list = rig.debug().list;
    list.forEach((row, i) => {
      if (!row.key) return;
      moveTo(rig, i);
      rig.press('a', 0.2);
    });
  };

  it('records the stat after a perfect run: data quality 0.8, variable accuracy 1', () => {
    const rig = makeRig();
    toPin(rig);
    pinKeys(rig);
    moveTo(rig, 5);
    rig.press('a', 0.1);
    expect(rig.debug().phase).toBe('reveal');
    // the reveal: one line per pin, then the insight
    const lines: string[] = [];
    for (let guard = 0; guard < 40 && rig.dialogue.isActive(); guard++) {
      const text = rig.dialogue.state.pages.flat().join(' ');
      if (lines.at(-1) !== text) lines.push(text);
      rig.step(tap('a'));
      rig.wait(0.1);
    }
    expect(lines.length).toBe(4);
    for (const l of lines.slice(0, 3)) expect(l.startsWith('Correct! ')).toBe(true);
    expect(lines[3]).toBe(sport.variableInsight);
    expect(rig.complete).toHaveBeenCalledTimes(1);
    const result = rig.complete.mock.calls[0]![0] as RoomResult;
    expect(result.dataQuality).toBeCloseTo(0.8, 10);
    expect(result.variableAccuracy).toBe(1);
    expect(0.4 * result.dataQuality + 0.6 * result.variableAccuracy).toBeCloseTo(0.92, 10);
    expect(played.filter(n => n === 'correct').length).toBeGreaterThanOrEqual(3);
  });

  it('judges wrong pins, names the missed key variables, and scores them', () => {
    const rig = makeRig();
    toPin(rig);
    // pin the two wrong variables and one key one
    const list = rig.debug().list;
    const chosen = [...list.keys()].filter(i => !list[i]!.key).concat([...list.keys()].filter(i => list[i]!.key).slice(0, 1));
    for (const i of chosen) {
      moveTo(rig, i);
      rig.press('a', 0.2);
    }
    moveTo(rig, 5);
    rig.press('a', 0.1);
    const lines: string[] = [];
    for (let guard = 0; guard < 40 && rig.dialogue.isActive(); guard++) {
      const text = rig.dialogue.state.pages.flat().join(' ');
      if (lines.at(-1) !== text) lines.push(text);
      rig.step(tap('a'));
      rig.wait(0.1);
    }
    expect(lines.filter(l => l.startsWith('Not quite. ')).length).toBe(2);
    expect(lines.filter(l => l.startsWith('Missed: ')).length).toBe(2);
    const result = rig.complete.mock.calls[0]![0] as RoomResult;
    expect(result.variableAccuracy).toBeCloseTo(1 / 3, 10);
  });

  it('B during the reveal takes the result at once instead of throwing it away', () => {
    const rig = makeRig();
    toPin(rig);
    pinKeys(rig);
    moveTo(rig, 5);
    rig.press('a', 0.1);
    expect(rig.dialogue.isActive()).toBe(true);
    rig.press('b', 0.1);
    expect(rig.quit).not.toHaveBeenCalled();
    expect(rig.complete).toHaveBeenCalledTimes(1);
  });
});

describe('animation', () => {
  it('does not move on its own: the same attempt, the same state after the same steps', () => {
    const a = makeRig({ seed: 11 });
    const b = makeRig({ seed: 11 });
    toCleanup(a);
    toCleanup(b);
    expect(a.debug()).toEqual(b.debug());
  });

  it('eases the chart\'s y range when the peak is clipped, then settles on the new range', () => {
    const rig = makeRig();
    toCleanup(rig);
    const { suspects } = rig.debug();
    const peak = suspects.findIndex(s => s.kind === 'peak');
    for (let i = 0; i < peak; i++) {
      rig.press(suspects[i]!.real ? 'right' : 'a', 0.4);
      rig.press('a', 0.4);
    }
    expect((rig as unknown as { debug(): { yMax: number } }).debug().yMax).toBe(10);
    rig.press('a', 0.05); // clip the real peak
    const mid = (rig.debug() as unknown as { yMax: number }).yMax;
    expect(mid).toBeLessThan(10);
    expect(mid).toBeGreaterThan(8);
    rig.wait(1);
    expect((rig.debug() as unknown as { yMax: number }).yMax).toBe(8);
  });
});

describe('mashing buttons at random', () => {
  const BUTTONS: Button[] = ['a', 'a', 'a', 'b', 'left', 'right', 'right', 'up', 'down', 'down'];

  // Drawing goes to a recording context; the glyph and ring caches get tiny stand-in canvases
  const drawn = { calls: 0 };
  const ctx = {
    fillStyle: '',
    globalAlpha: 1,
    fillRect: () => void drawn.calls++,
    drawImage: () => void drawn.calls++,
  } as unknown as CanvasRenderingContext2D;
  beforeEach(() => {
    vi.stubGlobal('document', {
      createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillStyle: '', fillRect() {}, drawImage() {} }) }),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('never breaks: the state stays consistent and the stat is recorded at most once', () => {
    const reached = { pin: 0, complete: 0, quit: 0 };
    for (let seed = 1; seed <= 60; seed++) {
      const pick = seeded(seed * 31 + 5);
      const rig = makeRig({ seed, firstVisit: seed % 3 !== 0 });
      for (let n = 0; n < 2500 && rig.complete.mock.calls.length === 0 && rig.quit.mock.calls.length === 0; n++) {
        const roll = pick();
        if (roll < 0.35) rig.step(); // a quiet step
        else rig.step(tap(BUTTONS[Math.floor(pick() * BUTTONS.length)]!));
        if (n % 17 === 0) rig.room.render(ctx); // every screen the mashing reaches can be drawn
        if (n % 40 === 0) {
          const d = rig.debug();
          expect(['brief', 'cleanup', 'pin', 'reveal']).toContain(d.phase);
          expect(d.decided).toBeGreaterThanOrEqual(0);
          expect(d.decided).toBeLessThanOrEqual(d.suspects.length);
          expect(d.pins.length).toBeLessThanOrEqual(3);
          expect(d.cursor).toBeGreaterThanOrEqual(0);
          expect(d.cursor).toBeLessThanOrEqual(d.list.length);
          // decisions come in order: no gaps
          const decided = d.suspects.map(s => s.decided !== null);
          expect(decided.indexOf(false) === -1 || decided.slice(decided.indexOf(false)).every(x => !x)).toBe(true);
        }
      }
      expect(rig.complete.mock.calls.length).toBeLessThanOrEqual(1);
      expect(rig.quit.mock.calls.length).toBeLessThanOrEqual(1);
      if (['pin', 'reveal'].includes(rig.debug().phase)) reached.pin++;
      reached.complete += rig.complete.mock.calls.length;
      reached.quit += rig.quit.mock.calls.length;
      if (rig.complete.mock.calls.length === 1) {
        const r = rig.complete.mock.calls[0]![0] as RoomResult;
        expect(r.dataQuality).toBeGreaterThanOrEqual(0.5);
        expect(r.dataQuality).toBeLessThanOrEqual(0.8 + 1e-9);
        expect(r.variableAccuracy).toBeGreaterThanOrEqual(0);
        expect(r.variableAccuracy).toBeLessThanOrEqual(1);
      }
    }
    // the mashing gets deep enough to mean something: some runs reach the pin list, some finish, some leave
    expect(drawn.calls).toBeGreaterThan(10000);
    expect(reached.pin).toBeGreaterThan(5);
    expect(reached.complete + reached.quit).toBeGreaterThan(5);
  });
});
