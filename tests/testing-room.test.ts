// The Testing Lab instrument driven end to end with a fake host: the lines it says, the presses it accepts and
// ignores, and what it records. (Drawing is covered by the browser flow, which needs a canvas.)
import { describe, expect, it, vi } from 'vitest';
import type { Input, InputState } from '../src/engine/Input';
import { LEVEL_DATA } from '../src/data/sports';
import { RUNNING } from '../src/rooms/content/running';
import { MEET_RUNNING } from '../src/rooms/content/meet-running';
import type { AthleteCheck } from '../src/rooms/content/types';
import { createTestingRoomWith } from '../src/rooms/testing';
import { DECISION_LOCK, REBOOK_SECONDS, RUN_SECONDS, RUN_SKIP_AFTER, type Rng } from '../src/rooms/testing/model';
import type { RoomHost, RoomInstrument, RoomResult } from '../src/rooms/types';


// The game's sound module reads its saved mute setting when it loads; give Node a harmless store so it does not warn
vi.hoisted(() => {
  Object.defineProperty(globalThis, 'localStorage', { value: { getItem: () => null, setItem: () => undefined }, configurable: true });
});

const sport = LEVEL_DATA[3]!;
// The goal is replaced by what testing is for, as agreed with the Director in the needs chat
const profile = `${sport.athleteProfile} ${MEET_RUNNING.needs.testingBrief}`;
const STEP = 1 / 60;

const seeded = (seed: number): Rng => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

type Button = 'a' | 'b' | 'up' | 'down';

/** One step's input: nothing held, except what is pressed. */
const inputOf = (...pressed: Button[]): InputState => {
  const has = (b: Button) => pressed.includes(b);
  return {
    up: has('up'), down: has('down'), left: false, right: false, a: has('a'), b: has('b'), start: false, select: false,
    upPressed: has('up'), downPressed: has('down'), leftPressed: false, rightPressed: false, aPressed: has('a'), bPressed: has('b'),
    startPressed: false, selectPressed: false,
    upRepeat: has('up'), downRepeat: has('down'), leftRepeat: false, rightRepeat: false,
    action: has('a'), actionPressed: has('a'), escape: false, escapePressed: false, typed: [],
  };
};

interface Said {
  speaker?: string;
  text: string;
  choices?: string[];
  done?: (choice?: number) => void;
}

/** A host that records what the room says and lets the test close each line as the player would. */
const makeHost = (options: { firstVisit?: boolean } = {}) => {
  const said: Said[] = [];
  const completed: RoomResult[] = [];
  const quit = vi.fn();
  const blockRepeats = vi.fn();
  const host: RoomHost = {
    sport,
    level: 3,
    input: { fill: (t: string) => t, label: (b: string) => b, blockRepeats, lastDevice: () => 'keyboard' } as unknown as Input,
    dialogue: {} as RoomHost['dialogue'],
    say: (text, choices, done, options) => void said.push({ text, choices, done, speaker: options?.speaker?.name }),
    sayAll: (texts, done) => {
      texts.forEach((text, i) => said.push({ text, done: i === texts.length - 1 ? done : undefined }));
    },
    quit,
    complete: result => void completed.push(result),
    firstVisit: options.firstVisit ?? false,
    replay: false,
    rulesRead: () => {},
    tests: [],
  };
  return { host, said, completed, quit, blockRepeats };
};

/** Drive a room: advance time with the dialogue idle (as the scene does when nothing is on screen). */
const drive = (room: RoomInstrument, seconds: number, ...pressed: Button[]) => {
  room.update(STEP, inputOf(...pressed), false);
  for (let t = STEP; t < seconds; t += STEP) room.update(STEP, inputOf(), false);
};
const phaseOf = (room: RoomInstrument): string => (room.debug?.() as { phase: string }).phase;
const stateOf = (room: RoomInstrument) =>
  room.debug?.() as { phase: string; order: string[]; selected: number; battery: string[]; running: number; check: { says: string; call: string; answer: string | null } | null; factor: number; result: RoomResult | null };

/** The last thing said: close it as the player would (with `choice` for a list). */
const closeLast = (said: Said[], choice?: number) => said[said.length - 1]?.done?.(choice);

/** Get to the pick screen. */
const toPick = (seed: number, firstVisit = false) => {
  const kit = makeHost({ firstVisit });
  const room = createTestingRoomWith(kit.host, seeded(seed));
  const last = kit.said[kit.said.length - 1];
  last?.done?.();
  drive(room, DECISION_LOCK + 0.05);
  return { ...kit, room };
};

/** Add one test to the battery: wait out the pick's lock, move to it and press A. */
const add = (room: RoomInstrument, name: string) => {
  drive(room, DECISION_LOCK + 0.05);
  const s = stateOf(room);
  let steps = (s.order.indexOf(name) - s.selected + s.order.length) % s.order.length;
  while (steps-- > 0) drive(room, 0.05, 'down');
  drive(room, 0.05, 'a');
};

const PARTNER: Record<string, string> = {
  'Lactate Profile': 'Critical Speed Test',
  'Critical Speed Test': 'Lactate Profile',
  'Wingate Test': 'Beep Test',
  'Beep Test': 'Wingate Test',
};

/** Pick a full battery: the tests named, or one test and its partner (the other right one, or the other wrong one). */
const choose = (room: RoomInstrument, ...names: string[]) => {
  for (const name of names.length === 1 ? [names[0]!, PARTNER[names[0]!]!] : names) add(room, name);
};

describe('the brief', () => {
  it('says the athlete profile, then what testing is for (agreed in the needs chat)', () => {
    const kit = makeHost();
    createTestingRoomWith(kit.host, seeded(1));
    expect(kit.said).toHaveLength(1);
    expect(kit.said[0]!.text).toBe(profile);
  });

  it('adds a tip about the stage the first time only', () => {
    const first = makeHost({ firstVisit: true });
    createTestingRoomWith(first.host, seeded(1));
    expect(first.said.map(s => s.text)).toEqual([profile, 'Tip: press {UP} and {DOWN} to watch each test on the stage, then {A} to add it to her battery. {B} takes the last one out.']);
    const again = makeHost({ firstVisit: false });
    createTestingRoomWith(again.host, seeded(1));
    expect(again.said).toHaveLength(1);
  });

  it('opens the list when the brief closes, with the repeat guard on', () => {
    const { room, blockRepeats } = toPick(3);
    expect(phaseOf(room)).toBe('pick');
    expect(blockRepeats).toHaveBeenCalled();
  });

  it('quits with B at the pick (nothing recorded)', () => {
    const { room, quit, completed } = toPick(3);
    drive(room, 0.05, 'b');
    expect(quit).toHaveBeenCalledTimes(1);
    expect(completed).toHaveLength(0);
  });
});

describe('the pick', () => {
  it('ignores A for the first 0.35 s, then adds the highlighted test; the second test fills the battery', () => {
    const kit = makeHost();
    const room = createTestingRoomWith(kit.host, seeded(3));
    closeLast(kit.said);
    drive(room, 0.1, 'a');
    expect(stateOf(room).battery).toEqual([]);
    drive(room, 0.3); // the lock runs out
    drive(room, 0.05, 'a');
    expect(stateOf(room).battery).toEqual([stateOf(room).order[0]]);
    expect(phaseOf(room)).toBe('pick');
    expect(stateOf(room).selected).toBe(1); // the cursor moved on to the next test
    drive(room, 0.05, 'a'); // too soon after the last pick
    expect(stateOf(room).battery).toHaveLength(1);
    drive(room, DECISION_LOCK);
    drive(room, 0.05, 'a');
    expect(phaseOf(room)).not.toBe('pick');
    expect(stateOf(room).battery).toEqual(stateOf(room).order.slice(0, 2));
  });

  it('refuses the same test twice, and B takes the last test out before it quits', () => {
    const { room, quit } = toPick(4);
    const first = stateOf(room).order[0]!;
    add(room, first);
    add(room, first);
    expect(stateOf(room).battery).toEqual([first]);
    drive(room, 0.05, 'b');
    expect(stateOf(room).battery).toEqual([]);
    expect(quit).not.toHaveBeenCalled();
    drive(room, 0.05, 'b');
    expect(quit).toHaveBeenCalledTimes(1);
  });

  it('moves the cursor with the repeat fields and wraps', () => {
    const { room } = toPick(5);
    drive(room, 0.05, 'down');
    expect(stateOf(room).selected).toBe(1);
    drive(room, 0.05, 'up');
    drive(room, 0.05, 'up');
    expect(stateOf(room).selected).toBe(3);
  });

  it('lists the four tests under the names in sports.ts, shuffled', () => {
    const { room } = toPick(9);
    expect([...stateOf(room).order].sort()).toEqual(sport.tests.map(t => t.name).sort());
  });

  it('does nothing while the dialogue is using the step\'s presses', () => {
    const { room } = toPick(3);
    room.update(STEP, inputOf('down'), true);
    room.update(STEP, inputOf('a'), true);
    expect(stateOf(room).selected).toBe(0);
    expect(phaseOf(room)).toBe('pick');
  });
});

describe('test day', () => {
  it('asks run or re-book with her words, and says why after the call', () => {
    const { room, said } = toPick(11);
    choose(room, 'Lactate Profile');
    const s = stateOf(room);
    expect(s.phase).toBe('check');
    const question = said[said.length - 1]!;
    expect(question.text).toBe(s.check!.says);
    expect(question.speaker).toBe('Aisha');
    expect(question.choices).toEqual(['RUN THE TESTS', 'RE-BOOK IT']);

    const right = s.check!.call === 'run' ? 0 : 1;
    closeLast(said, right);
    const why = said[said.length - 1]!;
    expect(why.text.startsWith('Good call. ')).toBe(true);
    expect(why.text).toBe(`Good call. ${RUNNING.testing.checks.find(c => c.says === s.check!.says)!.why}`);
  });

  it('says "Hmm." and marks the data down for the wrong call', () => {
    const { room, said } = toPick(11);
    choose(room, 'Lactate Profile');
    const s = stateOf(room);
    closeLast(said, s.check!.call === 'run' ? 1 : 0);
    expect(said[said.length - 1]!.text.startsWith('Hmm. ')).toBe(true);
    expect(stateOf(room).factor).toBeLessThan(1);
  });

  it('starts the run when the why is closed, or after the calendar has turned for a re-booking', () => {
    for (let seed = 1; seed < 40; seed++) {
      const { room, said } = toPick(seed);
      choose(room, 'Lactate Profile');
      const call = stateOf(room).check!.call;
      closeLast(said, call === 'run' ? 0 : 1); // the right call
      closeLast(said); // the why
      drive(room, STEP);
      if (call === 'run') {
        expect(phaseOf(room)).toBe('run');
      } else {
        drive(room, REBOOK_SECONDS / 2);
        expect(phaseOf(room)).toBe('check');
        drive(room, REBOOK_SECONDS / 2 + 0.1);
        expect(phaseOf(room)).toBe('run');
      }
    }
  });

  it('quits with B while waiting for the calendar', () => {
    for (let seed = 1; seed < 60; seed++) {
      const { room, said, quit } = toPick(seed);
      choose(room, 'Lactate Profile');
      if (stateOf(room).check!.call !== 'rebook') continue;
      closeLast(said, 1);
      closeLast(said);
      drive(room, 0.2, 'b');
      expect(quit).toHaveBeenCalled();
      return;
    }
    throw new Error('no re-book check in 60 seeds');
  });
});

describe('the run and the printout', () => {
  /** Through the check with the right call, into the run. */
  const toRun = (seed: number, test = 'Lactate Profile') => {
    const kit = toPick(seed);
    choose(kit.room, test);
    const call = stateOf(kit.room).check!.call;
    closeLast(kit.said, call === 'run' ? 0 : 1);
    closeLast(kit.said);
    drive(kit.room, call === 'rebook' ? REBOOK_SECONDS + 0.1 : STEP);
    return kit;
  };

  it('lets A skip each run only after half a second, test by test', () => {
    const { room } = toRun(21);
    expect(phaseOf(room)).toBe('run');
    drive(room, RUN_SKIP_AFTER - 0.1, 'a');
    expect(stateOf(room).running).toBe(0);
    drive(room, 0.2, 'a');
    expect(phaseOf(room)).toBe('run');
    expect(stateOf(room).running).toBe(1);
    drive(room, 0.1, 'a');
    expect(phaseOf(room)).toBe('run');
    drive(room, RUN_SKIP_AFTER);
    drive(room, 0.05, 'a');
    expect(phaseOf(room)).toBe('printout');
  });

  it('ends each run by itself after five seconds', () => {
    const { room } = toRun(22);
    drive(room, RUN_SECONDS - 0.2);
    expect(phaseOf(room)).toBe('run');
    drive(room, 0.4);
    expect(stateOf(room).running).toBe(1);
    drive(room, RUN_SECONDS);
    expect(phaseOf(room)).toBe('printout');
  });

  it('quits with B during the run and during the printout, recording nothing', () => {
    const run = toRun(23);
    drive(run.room, 1, 'b');
    expect(run.quit).toHaveBeenCalledTimes(1);
    expect(run.completed).toHaveLength(0);

    const print = toRun(24);
    drive(print.room, 2 * RUN_SECONDS + 0.5);
    expect(phaseOf(print.room)).toBe('printout');
    drive(print.room, DECISION_LOCK + 0.1, 'b');
    expect(print.quit).toHaveBeenCalledTimes(1);
    expect(print.completed).toHaveLength(0);
  });

  it('keeps A from carrying through the printout, then completes at once (no verdict line: the Director gives it), and records once', () => {
    const { room, said, completed } = toRun(25);
    drive(room, 2 * RUN_SECONDS + 0.05);
    expect(phaseOf(room)).toBe('printout');
    drive(room, 0.1, 'a'); // too soon: the lock is on
    expect(phaseOf(room)).toBe('printout');
    drive(room, DECISION_LOCK); // the lock runs out
    const before = said.length;
    drive(room, 0.05, 'a');
    expect(said.length, 'nothing more is said in the room').toBe(before);
    expect(said.some(s => /Good choice|Not ideal/.test(s.text) || s.text === sport.testInsight)).toBe(false);
    expect(completed).toEqual([{ dataQuality: 0.925, variableAccuracy: 1, testing: { tests: ['Lactate Profile', 'Critical Speed Test'], call: 'right' } }]);
    expect(phaseOf(room)).toBe('done');
    drive(room, 1, 'a');
    expect(completed).toHaveLength(1);
  });

  it('records a battery with no right test with its worse numbers and the tests it was', () => {
    const { room, completed } = toRun(26, 'Beep Test');
    drive(room, 2 * RUN_SECONDS + DECISION_LOCK + 0.1);
    drive(room, 0.05, 'a');
    expect(completed).toHaveLength(1);
    expect(completed[0]!.dataQuality).toBeCloseTo(0.55, 9);
    expect(completed[0]!.variableAccuracy).toBe(0.3);
    expect(completed[0]!.testing).toEqual({ tests: ['Beep Test', 'Wingate Test'], call: 'right' });
  });

  it('records a partial battery as partial', () => {
    const kit = toPick(27);
    choose(kit.room, 'Wingate Test', 'Lactate Profile');
    const call = stateOf(kit.room).check!.call;
    closeLast(kit.said, call === 'run' ? 0 : 1);
    closeLast(kit.said);
    drive(kit.room, (call === 'rebook' ? REBOOK_SECONDS : 0) + 2 * RUN_SECONDS + DECISION_LOCK + 0.2);
    drive(kit.room, 0.05, 'a');
    expect(kit.completed[0]!.variableAccuracy).toBe(0.65);
    expect(kit.completed[0]!.dataQuality).toBeCloseTo(0.725, 9);
  });
});

describe('without a readiness check', () => {
  it('goes straight from the pick to the run, with full data quality', () => {
    // The room reads its checks from the level's content: with none, there is no test day
    const content = RUNNING.testing;
    const saved = [...content.checks];
    (content.checks as AthleteCheck[]).length = 0;
    try {
      const kit = toPick(31);
      choose(kit.room, 'Critical Speed Test');
      expect(phaseOf(kit.room)).toBe('run');
      expect(stateOf(kit.room).check).toBeNull();
      drive(kit.room, 2 * RUN_SECONDS + DECISION_LOCK + 0.1);
      drive(kit.room, 0.05, 'a');
      expect(kit.completed).toEqual([{ dataQuality: 0.925, variableAccuracy: 1, testing: { tests: ['Critical Speed Test', 'Lactate Profile'], call: 'right' } }]);
    } finally {
      (content.checks as AthleteCheck[]).push(...saved);
    }
  });
});

describe('replays', () => {
  it('reshuffles the list into a different order, even when the generator would repeat itself', () => {
    const first = toPick(77);
    const shown = stateOf(first.room).order;
    const second = toPick(77); // the same seed gives the same shuffle, but that list was just shown
    expect(stateOf(second.room).order).not.toEqual(shown);
    expect([...stateOf(second.room).order].sort()).toEqual([...shown].sort());
  });

  it('draws a different test day check, because the last one shown is left out', () => {
    const first = toPick(41);
    const shown = stateOf(first.room).check!.says;
    choose(first.room, 'Lactate Profile');
    const seen = new Set<string>();
    for (let seed = 50; seed < 80; seed++) seen.add(stateOf(toPick(seed).room).check!.says);
    expect(seen.has(shown)).toBe(false);
  });
});
