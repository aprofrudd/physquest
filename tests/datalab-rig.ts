// Shared test rig for the Data Lab's instrument: a fake host and the dialogue system, driven the way
// RoomChallengeScene drives a room (the dialogue first, then the instrument with `busy` while the dialogue had the step).
// A test file that uses it mocks the sound and announcement modules itself (vi.mock is per test file).
import { consoleLabel, fillButtonNames, type InputState } from '../src/engine/Input';
import { createDialogueSystem } from '../src/systems/Dialogue';
import { LEVEL_DATA } from '../src/data/sports';
import type { RoomHost, RoomResult } from '../src/rooms/types';
import type { Rng } from '../src/rooms/datalab/model';
import { createDataRoom } from '../src/rooms/datalab';
import { calcStat } from '../src/state/GameState';

export const sport = LEVEL_DATA[3]!;
export const DT = 1 / 60;

/** A small seeded random source (mulberry32): the same seed always plays the same attempt. */
export const seeded = (seed: number): Rng => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export type Button = 'a' | 'b' | 'left' | 'right' | 'up' | 'down';

export const idle = (): InputState =>
  ({
    up: false, down: false, left: false, right: false, a: false, b: false, start: false, select: false,
    upPressed: false, downPressed: false, leftPressed: false, rightPressed: false, aPressed: false, bPressed: false, startPressed: false, selectPressed: false,
    upRepeat: false, downRepeat: false, leftRepeat: false, rightRepeat: false,
    action: false, actionPressed: false, escape: false, escapePressed: false, typed: [],
  }) as InputState;

/** One step with `button` going down (an edge, and a repeat for directions). */
export const tap = (button: Button): InputState => {
  const inp = idle() as unknown as Record<string, unknown>;
  inp[button] = true;
  inp[`${button}Pressed`] = true;
  if (['up', 'down', 'left', 'right'].includes(button)) inp[`${button}Repeat`] = true;
  return inp as unknown as InputState;
};

export interface DebugState {
  phase: string;
  view: number;
  decided: number;
  suspects: { kind: string; real: boolean; decided: string | null; right: boolean | null }[];
  cleanScore: number;
  pins: string[];
  list: { name: string; key: boolean; pinned: boolean; odd: boolean; shown: string }[];
  cursor: number;
  result: RoomResult;
}

/** A room on `seed` (the attempt it builds), on a first visit or a replay. */
export const makeRig = (seed: number, options: { firstVisit?: boolean } = {}) => {
  const dialogue = createDialogueSystem();
  const results: RoomResult[] = [];
  let quits = 0;
  const host: RoomHost = {
    sport,
    level: 3,
    input: { fill: (t: string) => fillButtonNames(t, consoleLabel), label: () => 'A', blockRepeats: () => {} } as unknown as RoomHost['input'],
    dialogue,
    say: (text, choices, onDone, opts = { exitLabel: 'QUIT' }) => dialogue.show(text, choices, onDone, () => void quits++, opts),
    sayAll: (texts, onDone, opts = { exitLabel: 'QUIT' }) => dialogue.showSequence(texts, onDone, () => void quits++, { exitLabel: 'QUIT', ...opts }),
    quit: () => void quits++,
    complete: result => void results.push(result),
    firstVisit: options.firstVisit ?? false,
    replay: false,
    rulesRead: () => {},
  };
  const room = createDataRoom(host, seeded(seed));
  const step = (inp: InputState = idle()) => {
    const busy = dialogue.isActive();
    dialogue.update(DT, inp);
    room.update(DT, inp, busy || dialogue.isActive());
  };
  const wait = (seconds: number) => {
    for (let t = 0; t < seconds; t += DT) step();
  };
  return {
    step,
    wait,
    /** Press a button for one step, then let `after` seconds pass. */
    press(button: Button, after = 0.5) {
      step(tap(button));
      wait(after);
    },
    /** Press A until the dialogue box closes. */
    closeDialogue() {
      for (let guard = 0; guard < 80 && dialogue.isActive(); guard++) {
        step(tap('a'));
        wait(0.1);
      }
    },
    debug: () => room.debug!() as DebugState,
    render: (ctx: CanvasRenderingContext2D) => room.render(ctx),
    talking: () => dialogue.isActive(),
    /** Every result the room recorded (at most one). */
    results,
    quits: () => quits,
  };
};
export type Rig = ReturnType<typeof makeRig>;

/** The stat the shell records for a result (its own calcStat). */
export const statOf = (r: RoomResult): number => calcStat(r.dataQuality, r.variableAccuracy);
