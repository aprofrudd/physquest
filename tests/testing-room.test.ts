// The Testing Lab instrument driven end to end with a fake host: the lines it says, the presses it accepts and
// ignores, and what it records. (Drawing is covered by the browser flow, which needs a canvas.)
import { describe, expect, it, vi } from 'vitest';
import type { Input, InputState } from '../src/engine/Input';
import { LEVEL_DATA } from '../src/data/sports';
import { RUNNING } from '../src/rooms/content/running';
import type { AthleteCheck } from '../src/rooms/content/types';
import { createTestingRoomWith } from '../src/rooms/testing';
import { DECISION_LOCK, REBOOK_SECONDS, RUN_SECONDS, RUN_SKIP_AFTER, type Rng } from '../src/rooms/testing/model';
import type { RoomHost, RoomInstrument, RoomResult } from '../src/rooms/types';


// The game's sound module reads its saved mute setting when it loads; give Node a harmless store so it does not warn
vi.hoisted(() => {
  Object.defineProperty(globalThis, 'localStorage', { value: { getItem: () => null, setItem: () => undefined }, configurable: true });
});

const sport = LEVEL_DATA[3]!;
const profile = `${sport.athleteProfile} Goal: ${sport.goal}`;
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
    say: (text, choices, done) => void said.push({ text, choices, done }),
    sayAll: (texts, done) => {
      texts.forEach((text, i) => said.push({ text, done: i === texts.length - 1 ? done : undefined }));
    },
    quit,
    complete: result => void completed.push(result),
    firstVisit: options.firstVisit ?? false,
    replay: false,
    rulesRead: () => {},
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
  room.debug?.() as { phase: string; order: string[]; selected: number; chosen: string | null; check: { says: string; call: string; answer: string | null } | null; factor: number; result: RoomResult | null };

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

const choose = (room: RoomInstrument, name: string) => {
  const s = stateOf(room);
  let target = s.order.indexOf(name);
  while (target-- > 0) drive(room, 0.05, 'down');
  drive(room, 0.05, 'a');
};

describe('the brief', () => {
  it('says the athlete profile and goal exactly as the classic room does', () => {
    const kit = makeHost();
    createTestingRoomWith(kit.host, seeded(1));
    expect(kit.said).toHaveLength(1);
    expect(kit.said[0]!.text).toBe(profile);
  });

  it('adds a tip about the stage the first time only', () => {
    const first = makeHost({ firstVisit: true });
    createTestingRoomWith(first.host, seeded(1));
    expect(first.said.map(s => s.text)).toEqual([profile, 'Tip: press {UP} and {DOWN} to watch each test on the stage, then {A} to choose.']);
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
  it('ignores A for the first 0.35 s, then chooses the highlighted test', () => {
    const kit = makeHost();
    const room = createTestingRoomWith(kit.host, seeded(3));
    closeLast(kit.said);
    drive(room, 0.1, 'a');
    expect(phaseOf(room)).toBe('pick');
    drive(room, 0.3); // the lock runs out
    drive(room, 0.05, 'a');
    expect(phaseOf(room)).not.toBe('pick');
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
    choose(room, 'Lactate Threshold Test');
    const s = stateOf(room);
    expect(s.phase).toBe('check');
    const question = said[said.length - 1]!;
    expect(question.text).toBe(`Test day. Aisha says: "${s.check!.says}"`);
    expect(question.choices).toEqual(['RUN THE TEST', 'RE-BOOK IT']);

    const right = s.check!.call === 'run' ? 0 : 1;
    closeLast(said, right);
    const why = said[said.length - 1]!;
    expect(why.text.startsWith('Good call. ')).toBe(true);
    expect(why.text).toBe(`Good call. ${RUNNING.testing.checks.find(c => c.says === s.check!.says)!.why}`);
  });

  it('says "Hmm." and marks the data down for the wrong call', () => {
    const { room, said } = toPick(11);
    choose(room, 'Lactate Threshold Test');
    const s = stateOf(room);
    closeLast(said, s.check!.call === 'run' ? 1 : 0);
    expect(said[said.length - 1]!.text.startsWith('Hmm. ')).toBe(true);
    expect(stateOf(room).factor).toBeLessThan(1);
  });

  it('starts the run when the why is closed, or after the calendar has turned for a re-booking', () => {
    for (let seed = 1; seed < 40; seed++) {
      const { room, said } = toPick(seed);
      choose(room, 'Lactate Threshold Test');
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
      choose(room, 'Lactate Threshold Test');
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
  const toRun = (seed: number, test = 'Lactate Threshold Test') => {
    const kit = toPick(seed);
    choose(kit.room, test);
    const call = stateOf(kit.room).check!.call;
    closeLast(kit.said, call === 'run' ? 0 : 1);
    closeLast(kit.said);
    drive(kit.room, call === 'rebook' ? REBOOK_SECONDS + 0.1 : STEP);
    return kit;
  };

  it('lets A skip the run only after half a second', () => {
    const { room } = toRun(21);
    expect(phaseOf(room)).toBe('run');
    drive(room, RUN_SKIP_AFTER - 0.1, 'a');
    expect(phaseOf(room)).toBe('run');
    drive(room, 0.2, 'a');
    expect(phaseOf(room)).toBe('printout');
  });

  it('ends the run by itself after five seconds', () => {
    const { room } = toRun(22);
    drive(room, RUN_SECONDS - 0.2);
    expect(phaseOf(room)).toBe('run');
    drive(room, 0.4);
    expect(phaseOf(room)).toBe('printout');
  });

  it('quits with B during the run and during the printout, recording nothing', () => {
    const run = toRun(23);
    drive(run.room, 1, 'b');
    expect(run.quit).toHaveBeenCalledTimes(1);
    expect(run.completed).toHaveLength(0);

    const print = toRun(24);
    drive(print.room, RUN_SECONDS + 0.5);
    expect(phaseOf(print.room)).toBe('printout');
    drive(print.room, DECISION_LOCK + 0.1, 'b');
    expect(print.quit).toHaveBeenCalledTimes(1);
    expect(print.completed).toHaveLength(0);
  });

  it('keeps A from carrying through the printout, then gives the verdict and the insight, and records once', () => {
    const { room, said, completed } = toRun(25);
    drive(room, RUN_SECONDS + 0.05);
    expect(phaseOf(room)).toBe('printout');
    drive(room, 0.1, 'a'); // too soon: the lock is on
    expect(phaseOf(room)).toBe('printout');
    drive(room, DECISION_LOCK); // the lock runs out
    drive(room, 0.05, 'a');
    expect(phaseOf(room)).toBe('feedback');
    const lt = sport.tests.find(t => t.name === 'Lactate Threshold Test')!;
    expect(said[said.length - 1]!.text).toBe(`Good choice! ${lt.description}`);
    closeLast(said);
    expect(said[said.length - 1]!.text).toBe(sport.testInsight);
    expect(completed).toHaveLength(0);
    closeLast(said);
    expect(completed).toEqual([{ dataQuality: 0.95, variableAccuracy: 1 }]);
    expect(phaseOf(room)).toBe('done');
  });

  it('gives the classic "Not ideal" line for a wrong test and records its worse numbers', () => {
    const { room, said, completed } = toRun(26, 'Beep Test');
    drive(room, RUN_SECONDS + DECISION_LOCK + 0.1);
    drive(room, 0.05, 'a');
    const beep = sport.tests.find(t => t.name === 'Beep Test')!;
    expect(said[said.length - 1]!.text).toBe(`Not ideal. ${beep.description} This isn't the best match for the athlete's needs.`);
    closeLast(said);
    closeLast(said);
    expect(completed).toEqual([{ dataQuality: 0.6, variableAccuracy: 0.3 }]);
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
      drive(kit.room, RUN_SECONDS + DECISION_LOCK + 0.1);
      drive(kit.room, 0.05, 'a');
      closeLast(kit.said);
      closeLast(kit.said);
      expect(kit.completed).toEqual([{ dataQuality: 0.9, variableAccuracy: 1 }]);
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
    choose(first.room, 'Lactate Threshold Test');
    const seen = new Set<string>();
    for (let seed = 50; seed < 80; seed++) seen.add(stateOf(toPick(seed).room).check!.says);
    expect(seen.has(shown)).toBe(false);
  });
});
