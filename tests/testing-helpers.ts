// Shared by the Testing Lab's room tests: a seeded random generator, one step's input, and a fake host that
// records what the room says (the room itself, not the scene, so the dialogue box is not drawn).
import type { Input, InputState } from '../src/engine/Input';
import { LEVEL_DATA } from '../src/data/sports';
import { RUNNING } from '../src/rooms/content/running';
import type { AthleteCheck } from '../src/rooms/content/types';
import { createTestingRoomWith } from '../src/rooms/testing';
import { DECISION_LOCK, type Rng } from '../src/rooms/testing/model';
import type { RoomHost, RoomInstrument } from '../src/rooms/types';

export const sport = LEVEL_DATA[3]!;
export const STEP = 1 / 60;

/** A small seeded generator (mulberry32), so every run of a test sees the same "random" numbers. */
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

export type Button = 'a' | 'b' | 'up' | 'down';

/** One step's input: nothing held, except what is pressed. */
export const inputOf = (...pressed: Button[]): InputState => {
  const has = (b: Button) => pressed.includes(b);
  return {
    up: has('up'), down: has('down'), left: false, right: false, a: has('a'), b: has('b'), start: false, select: false,
    upPressed: has('up'), downPressed: has('down'), leftPressed: false, rightPressed: false, aPressed: has('a'), bPressed: has('b'),
    startPressed: false, selectPressed: false,
    upRepeat: has('up'), downRepeat: has('down'), leftRepeat: false, rightRepeat: false,
    action: has('a'), actionPressed: has('a'), escape: false, escapePressed: false, typed: [],
  };
};

export interface Said {
  speaker?: string;
  text: string;
  choices?: string[];
  done?: (choice?: number) => void;
}

/** A host that records what the room says and lets the test close each line as the player would. */
export const makeHost = (options: { firstVisit?: boolean } = {}) => {
  const said: Said[] = [];
  const completed: { dataQuality: number; variableAccuracy: number }[] = [];
  const host: RoomHost = {
    sport,
    level: 3,
    input: { fill: (t: string) => t, label: (b: string) => b, blockRepeats: () => undefined, lastDevice: () => 'keyboard' } as unknown as Input,
    dialogue: {} as RoomHost['dialogue'],
    say: (text, choices, done, options) => void said.push({ text, choices, done, speaker: options?.speaker?.name }),
    sayAll: (texts, done) => {
      texts.forEach((text, i) => said.push({ text, done: i === texts.length - 1 ? done : undefined }));
    },
    quit: () => undefined,
    complete: result => void completed.push(result),
    firstVisit: options.firstVisit ?? false,
    replay: false,
    rulesRead: () => {},
    tests: [],
  };
  return { host, said, completed };
};

/** The last thing said: close it as the player would (with `choice` for a list). */
export const closeLast = (said: Said[], choice?: number) => said[said.length - 1]?.done?.(choice);

// ---- driving a room -----------------------------------------------------------------------------------------------

/** What the room's debug() reports, for the parts these tests read. */
export interface RoomState {
  phase: string;
  order: string[];
  selected: number;
  /** The tests picked so far, in order, and which one is running. */
  battery: string[];
  running: number;
  check: { says: string; call: 'run' | 'rebook'; answer: string | null } | null;
  factor: number;
  result: { dataQuality: number; variableAccuracy: number } | null;
}

export const stateOf = (room: RoomInstrument): RoomState => room.debug?.() as RoomState;

/** Advance time with the dialogue idle (as the scene does when nothing is on screen); `pressed` goes in the first step only. */
export const drive = (room: RoomInstrument, seconds: number, ...pressed: Button[]) => {
  room.update(STEP, inputOf(...pressed), false);
  for (let t = STEP; t < seconds; t += STEP) room.update(STEP, inputOf(), false);
};

/**
 * A room at the pick: the brief is closed and the list's lock has run out. `checks` replaces the content's test day
 * checks for this room only (the room draws its check when it opens); an empty list means no test day.
 */
export const toPickWith = (seed: number, checks?: readonly AthleteCheck[]) => {
  const kit = makeHost();
  const list = RUNNING.testing.checks as AthleteCheck[];
  const saved = [...list];
  if (checks) list.splice(0, list.length, ...checks);
  const room = createTestingRoomWith(kit.host, seeded(seed));
  if (checks) list.splice(0, list.length, ...saved);
  closeLast(kit.said);
  drive(room, DECISION_LOCK + 0.05);
  return { ...kit, room };
};

/** The test a one-test call adds second, so the battery is full: the other right test, or the other wrong one. */
export const partnerOf = (name: string): string =>
  ({ 'Lactate Profile': 'Critical Speed Test', 'Critical Speed Test': 'Lactate Profile', 'Wingate Test': 'Beep Test', 'Beep Test': 'Wingate Test' })[name] ??
  'Beep Test';

/** Move the cursor to one test and add it to the battery (waiting out the pick's lock first). */
export const add = (room: RoomInstrument, name: string) => {
  drive(room, DECISION_LOCK + 0.05);
  const s = stateOf(room);
  const n = s.order.length;
  let steps = (s.order.indexOf(name) - s.selected + n) % n;
  while (steps-- > 0) drive(room, 0.05, 'down');
  drive(room, 0.05, 'a');
};

/**
 * Pick a full battery: the tests named, in order; with one name, its partner (partnerOf) is added second.
 */
export const choose = (room: RoomInstrument, ...names: string[]) => {
  const battery = names.length === 1 ? [names[0]!, partnerOf(names[0]!)] : names;
  for (const name of battery) add(room, name);
};
