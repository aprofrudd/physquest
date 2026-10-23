// The Training Floor instrument's flow with a stand-in host: the brief, planning, the questions, the run, the
// debrief and the result it records. Drawing is not exercised here (the Playwright flows cover it).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { InputState } from '../src/engine/Input';
import type { DialogueOptions } from '../src/render/DialogueBox';
import { LEVEL_DATA } from '../src/data/sports';
import { RUNNING } from '../src/rooms/content/running';
import { DAY_COUNT, analyse, sessionFromChip } from '../src/rooms/training/model';
import { debriefLines } from '../src/rooms/training/text';
import { createTrainingInstrument } from '../src/rooms/training';
import type { RoomHost, RoomInstrument, RoomResult } from '../src/rooms/types';
import { announce } from '../src/ui/announce';

// Screen-reader lines are checked through this stand-in
vi.mock('../src/ui/announce', () => ({ announce: vi.fn() }));
const spoken = (): string[] => vi.mocked(announce).mock.calls.map(call => call[0]);
beforeEach(() => vi.mocked(announce).mockClear());

const content = RUNNING.training;
const sport = LEVEL_DATA[3]!;

const seeded = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const IDLE: InputState = {
  up: false, down: false, left: false, right: false, a: false, b: false, start: false, select: false,
  upPressed: false, downPressed: false, leftPressed: false, rightPressed: false,
  aPressed: false, bPressed: false, startPressed: false, selectPressed: false,
  upRepeat: false, downRepeat: false, leftRepeat: false, rightRepeat: false,
  action: false, actionPressed: false, escape: false, escapePressed: false, typed: [],
};
const keys = (...names: (keyof InputState)[]): InputState => ({ ...IDLE, ...Object.fromEntries(names.map(n => [n, true])) });

interface Shown {
  text: string;
  choices?: string[];
  onComplete?: (choice?: number) => void;
  onCancel?: () => void;
  options?: DialogueOptions;
}

/** A host that records what the room asks of it. `dialogue.show` calls pile up in `shown`; answer them with the helpers. */
const makeHost = (firstVisit = true) => {
  const shown: Shown[] = [];
  const said: string[][] = [];
  const completed: RoomResult[] = [];
  let quits = 0;
  const blockRepeats = vi.fn();
  const host = {
    sport,
    level: 3,
    input: { fill: (text: string) => text, label: (b: string) => b, blockRepeats, lastDevice: () => 'console' },
    dialogue: {
      show: (text: string, choices?: string[], onComplete?: (c?: number) => void, onCancel?: () => void, options?: DialogueOptions) => {
        shown.push({ text, choices, onComplete, onCancel, options });
      },
    },
    say: (text: string, _choices?: string[], onDone?: () => void) => {
      said.push([text]);
      shown.push({ text, onComplete: onDone, onCancel: () => { quits++; } });
    },
    sayAll: (texts: string[], onDone: () => void) => {
      said.push(texts);
      shown.push({ text: texts.join(' | '), onComplete: onDone, onCancel: () => { quits++; } });
    },
    quit: () => { quits++; },
    complete: (r: RoomResult) => { completed.push(r); },
    firstVisit,
    replay: false,
    rulesRead: () => {},
  } as unknown as RoomHost;
  return {
    host,
    shown,
    said,
    completed,
    blockRepeats,
    quits: () => quits,
    last: () => shown[shown.length - 1]!,
    /** Answer the open dialogue: a choice index, or A on plain text. */
    answer: (choice?: number) => { const s = shown[shown.length - 1]!; s.onComplete?.(choice); },
    /** B on the open dialogue. */
    cancel: () => { const s = shown[shown.length - 1]!; s.onCancel?.(); },
  };
};

/** What the instrument reports through debug(). */
interface DebugState {
  phase: string;
  away: number | null;
  cursor: number;
  order: string[];
  plan: string[];
  legs: number[];
  qualities: (number | null)[];
  stimulus: number;
  structure: number;
  checks: { sessions: boolean; rest: boolean; red: boolean };
  ready: boolean;
  runDay: number | null;
  daysDone: number | null;
  debriefAt: number;
  result: RoomResult | null;
}

type Rig = ReturnType<typeof makeHost> & { room: RoomInstrument; state: () => DebugState };

/** A room on the plan screen (brief done, lock expired). */
const openPlan = (seed = 3, firstVisit = true): Rig => {
  const h = makeHost(firstVisit);
  const room = createTrainingInstrument(h.host, seeded(seed));
  h.answer(); // the brief
  const rig: Rig = { ...h, room, state: () => room.debug?.() as DebugState };
  step(rig, 0.5);
  return rig;
};

const step = (rig: Rig, seconds: number, input: InputState = IDLE, busy = false) => {
  const dt = 1 / 60;
  for (let t = 0; t < seconds - 1e-9; t += dt) rig.room.update(dt, input, busy);
};
const tap = (rig: Rig, ...names: (keyof InputState)[]) => rig.room.update(1 / 60, keys(...names), false);

/** Set the day under the cursor to a chip, by pressing DOWN, and move on with A. */
const place = (rig: Rig, chip: string) => {
  for (let i = 0; i < 8 && rig.state().plan[rig.state().cursor] !== chip; i++) tap(rig, 'downRepeat');
  tap(rig, 'aPressed');
};

const planWeek = (rig: Rig, chips: string[]) => {
  for (let d = 0; d < DAY_COUNT; d++) {
    if (rig.state().away === d) tap(rig, 'aPressed');
    else place(rig, chips[d]!);
  }
};

/** Plan, answer YES and play the week through to the first debrief line. */
const playWeek = (rig: Rig, chips: string[]) => {
  planWeek(rig, chips);
  tap(rig, 'aPressed'); // on GO
  expect(rig.last().text).toMatch(/Run the week\?$/);
  rig.answer(0);
  step(rig, 12);
};

const PERFECT: Record<number, string[]> = {
  1: ['SUB', 'AWAY', 'EASY', 'SUPR', 'EASY', 'SPRT', 'REST'],
  2: ['SUB', 'EASY', 'AWAY', 'SUPR', 'EASY', 'SPRT', 'REST'],
  3: ['SUB', 'EASY', 'SUPR', 'AWAY', 'EASY', 'SPRT', 'REST'],
};

describe('the brief', () => {
  it('shows the full rules on the first visit and starts planning when they are read', () => {
    const h = makeHost(true);
    const room = createTrainingInstrument(h.host, seeded(1));
    expect(h.said).toEqual([[...content.rules]]);
    expect((room.debug?.() as { phase: string }).phase).toBe('brief');
    h.answer();
    expect((room.debug?.() as { phase: string }).phase).toBe('plan');
    expect(h.blockRepeats).toHaveBeenCalled();
  });

  it('shows the short rule on later visits', () => {
    const h = makeHost(false);
    createTrainingInstrument(h.host, seeded(1));
    expect(h.said).toEqual([[content.rulesShort]]);
  });

  it('quits on B (no decisions yet)', () => {
    const h = makeHost();
    createTrainingInstrument(h.host, seeded(1));
    h.cancel();
    expect(h.quits()).toBe(1);
  });

  it('says there is nothing here when the level has no content', () => {
    const h = makeHost();
    (h.host as { level: number }).level = 0;
    createTrainingInstrument(h.host, seeded(1));
    expect(h.said[0]![0]).toMatch(/rebuilt/);
  });
});

describe('planning', () => {
  it('starts on Monday with the away day fixed and nothing else planned', () => {
    const rig = openPlan();
    const s = rig.state();
    expect(s.phase).toBe('plan');
    expect(s.cursor).toBe(0);
    expect(s.plan.filter((c: string) => c === '--')).toHaveLength(6);
    expect(s.plan[s.away]).toBe('AWAY');
    expect([1, 2, 3]).toContain(s.away);
  });

  it('moves the cursor with LEFT and RIGHT, wrapping round through the GO slot', () => {
    const rig = openPlan();
    tap(rig, 'leftPressed', 'leftRepeat');
    expect(rig.state().cursor).toBe(7);
    tap(rig, 'rightPressed', 'rightRepeat');
    expect(rig.state().cursor).toBe(0);
    tap(rig, 'rightPressed', 'rightRepeat');
    expect(rig.state().cursor).toBe(1);
  });

  it('stops a held direction at the ends of the board instead of circling round', () => {
    const rig = openPlan();
    tap(rig, 'leftRepeat'); // auto-repeat only: no fresh press
    expect(rig.state().cursor).toBe(0);
    for (let i = 0; i < 9; i++) tap(rig, 'rightRepeat');
    expect(rig.state().cursor).toBe(7);
    tap(rig, 'rightRepeat');
    expect(rig.state().cursor).toBe(7);
    tap(rig, 'rightPressed', 'rightRepeat'); // a fresh press wraps
    expect(rig.state().cursor).toBe(0);
  });

  it('cycles a day with DOWN through nothing, the shuffled cards and REST, and back with UP', () => {
    const rig = openPlan(5);
    const order = rig.state().order as string[];
    const seen = [rig.state().plan[0]];
    for (let i = 0; i < 6; i++) {
      tap(rig, 'downRepeat');
      seen.push(rig.state().plan[0]);
    }
    expect(seen).toEqual(['--', ...order, 'REST', '--']);
    tap(rig, 'upRepeat');
    expect(rig.state().plan[0]).toBe('REST');
  });

  it('shuffles the order differently from one attempt to the next', () => {
    const orders = new Set<string>();
    for (let seed = 0; seed < 30; seed++) orders.add(openPlan(seed).state().order.join(','));
    expect(orders.size).toBeGreaterThan(6);
  });

  it('puts the away day on TUE, WED or THU, and every one of them turns up', () => {
    const days = new Set<number>();
    for (let seed = 0; seed < 40; seed++) days.add(openPlan(seed).state().away);
    expect([...days].sort()).toEqual([1, 2, 3]);
  });

  it('refuses to change the away day', () => {
    const rig = openPlan();
    const away = rig.state().away as number;
    for (let d = 0; d < away; d++) tap(rig, 'rightPressed', 'rightRepeat');
    tap(rig, 'downRepeat');
    expect(rig.state().plan[away]).toBe('AWAY');
  });

  it('moves to the next day with A, and on to GO after Sunday', () => {
    const rig = openPlan();
    tap(rig, 'aPressed');
    expect(rig.state().cursor).toBe(1);
    for (let i = 0; i < 6; i++) tap(rig, 'aPressed');
    expect(rig.state().cursor).toBe(7);
  });

  it('keeps legs, checks and the stimulus up to date as sessions are placed', () => {
    const rig = openPlan();
    const hard = rig.state().order.includes('SUB') ? 'SUB' : 'SUPR';
    place(rig, hard);
    expect(rig.state().legs[1]).toBe(50);
    expect(rig.state().checks.sessions).toBe(false);
    expect(rig.state().stimulus).toBeGreaterThan(0);
  });

  it('ignores A and B in the first moments after the board appears, but not the cursor', () => {
    const h = makeHost();
    const room = createTrainingInstrument(h.host, seeded(1));
    h.answer();
    room.update(1 / 60, keys('aPressed'), false);
    room.update(1 / 60, keys('bPressed'), false);
    expect((room.debug?.() as { cursor: number }).cursor).toBe(0);
    expect(h.quits()).toBe(0);
    room.update(1 / 60, keys('rightPressed', 'rightRepeat'), false);
    expect((room.debug?.() as { cursor: number }).cursor).toBe(1);
  });

  it('does not act on any press while the dialogue is busy', () => {
    const rig = openPlan();
    step(rig, 0.2, keys('rightRepeat', 'aPressed', 'bPressed', 'downRepeat'), true);
    expect(rig.state().cursor).toBe(0);
    expect(rig.state().plan[0]).toBe('--');
    expect(rig.quits()).toBe(0);
  });
});

describe('leaving the plan', () => {
  it('quits straight away on B when nothing has been planned', () => {
    const rig = openPlan();
    tap(rig, 'bPressed');
    expect(rig.quits()).toBe(1);
  });

  it('asks first once something is planned, and B again means stay', () => {
    const rig = openPlan();
    tap(rig, 'downRepeat');
    tap(rig, 'bPressed');
    expect(rig.quits()).toBe(0);
    const q = rig.last();
    expect(q.text).toBe('Leave the plan? Your week will be lost.');
    expect(q.choices).toEqual(['STAY', 'LEAVE']);
    expect(q.options?.exitLabel).toBe('STAY');
    rig.cancel(); // B
    expect(rig.quits()).toBe(0);
    expect(rig.state().phase).toBe('plan');
    expect(rig.state().plan[0]).not.toBe('--'); // the plan is kept
  });

  it('keeps the plan on STAY and leaves without recording on LEAVE', () => {
    const rig = openPlan();
    tap(rig, 'downRepeat');
    tap(rig, 'bPressed');
    rig.answer(0);
    expect(rig.state().phase).toBe('plan');
    step(rig, 0.5);
    tap(rig, 'bPressed');
    rig.answer(1);
    expect(rig.quits()).toBe(1);
    expect(rig.completed).toEqual([]);
  });

  it('counts a rest day as planned too', () => {
    const rig = openPlan();
    tap(rig, 'upRepeat'); // REST on Monday
    tap(rig, 'bPressed');
    expect(rig.last().text).toBe('Leave the plan? Your week will be lost.');
  });
});

describe('running the week', () => {
  it('asks "Run the week?" on GO, naming any key session still missing', () => {
    const rig = openPlan();
    tap(rig, 'leftPressed', 'leftRepeat');
    tap(rig, 'aPressed');
    const q = rig.last();
    expect(q.text).toBe('No SUB session yet. No SUPR session yet. No SPRT session yet. Run the week?');
    expect(q.choices).toEqual(['YES', 'NO']);
    expect(q.options?.exitLabel).toBe('NO');
  });

  it('asks the plain question when every key session has a day', () => {
    const rig = openPlan();
    planWeek(rig, PERFECT[rig.state().away]!);
    tap(rig, 'aPressed');
    expect(rig.last().text).toBe('Run the week?');
  });

  it('goes back to the board on NO, and on B', () => {
    const rig = openPlan();
    planWeek(rig, PERFECT[rig.state().away]!);
    tap(rig, 'aPressed');
    rig.answer(1);
    expect(rig.state().phase).toBe('plan');
    expect(rig.state().cursor).toBe(7);
    step(rig, 0.5);
    tap(rig, 'aPressed');
    rig.cancel();
    expect(rig.state().phase).toBe('plan');
    expect(rig.quits()).toBe(0);
  });

  it('plays seven days of 1.2 seconds, then the debrief begins', () => {
    const rig = openPlan();
    planWeek(rig, PERFECT[rig.state().away]!);
    tap(rig, 'aPressed');
    rig.answer(0);
    expect(rig.state().phase).toBe('run');
    step(rig, 1.3);
    expect(rig.state().runDay).toBe(1);
    expect(rig.state().daysDone).toBe(1);
    step(rig, 1.2 * 5);
    expect(rig.state().phase).toBe('run');
    step(rig, 1.2 + 0.8);
    expect(rig.state().phase).toBe('debrief');
  });

  it('goes four times faster while A is held, after the first moments', () => {
    const slow = openPlan();
    planWeek(slow, PERFECT[slow.state().away]!);
    tap(slow, 'aPressed');
    slow.answer(0);
    step(slow, 2.4);
    const fast = openPlan();
    planWeek(fast, PERFECT[fast.state().away]!);
    tap(fast, 'aPressed');
    fast.answer(0);
    step(fast, 0.6);
    step(fast, 1.8, keys('a'));
    expect(fast.state().daysDone).toBeGreaterThan(slow.state().daysDone! + 2);
  });

  it('ignores a held A in the first moments of the run (the press that said YES)', () => {
    const rig = openPlan();
    planWeek(rig, PERFECT[rig.state().away]!);
    tap(rig, 'aPressed');
    rig.answer(0);
    step(rig, 0.3, keys('a'));
    expect(rig.state().daysDone).toBe(0);
  });

  it('does nothing on B during the run', () => {
    const rig = openPlan();
    planWeek(rig, PERFECT[rig.state().away]!);
    tap(rig, 'aPressed');
    rig.answer(0);
    step(rig, 0.8, keys('bPressed'));
    expect(rig.quits()).toBe(0);
    expect(rig.state().phase).toBe('run');
  });
});

describe('the debrief and the result', () => {
  it('says each key card\'s line, the checks in words and the insight, then records the result', () => {
    const rig = openPlan();
    const chips = PERFECT[rig.state().away]!;
    playWeek(rig, chips);
    const lines = debriefLines(content, sport, analyse(content, chips.map(c => sessionFromChip(content, c))));
    for (let i = 0; i < lines.length; i++) {
      expect(rig.last().text).toBe(lines[i]!.text);
      expect(rig.state().debriefAt).toBe(i);
      expect(rig.completed).toEqual([]);
      rig.answer();
    }
    expect(rig.completed).toHaveLength(1);
    expect(rig.completed[0]!.dataQuality).toBeCloseTo(0.9);
    expect(rig.completed[0]!.variableAccuracy).toBeCloseTo(1);
    expect(rig.state().phase).toBe('done');
  });

  it('records the model\'s own score for a poor week', () => {
    const rig = openPlan();
    const chips = ['SUB', 'SUPR', 'SPRT', 'SUB', 'SUPR', 'SPRT', 'SUB'];
    const plan = chips.map((c, d) => (d === rig.state().away ? 'AWAY' : c));
    playWeek(rig, plan);
    const a = analyse(content, plan.map(c => sessionFromChip(content, c)));
    while (rig.state().phase !== 'done') rig.answer();
    expect(rig.completed[0]).toEqual({ dataQuality: a.dataQuality, variableAccuracy: a.variableAccuracy });
  });

  it('asks before throwing a finished week away, and B again goes back to the same line', () => {
    const rig = openPlan();
    playWeek(rig, PERFECT[rig.state().away]!);
    rig.answer(); // line 0 done, line 1 open
    const open = rig.last().text;
    rig.cancel(); // B
    const q = rig.last();
    expect(q.text).toBe("Leave now? This week's result will be lost.");
    expect(q.choices).toEqual(['STAY', 'LEAVE']);
    expect(rig.quits()).toBe(0);
    rig.cancel(); // B = stay
    expect(rig.last().text).toBe(open);
    rig.cancel();
    rig.answer(1); // LEAVE
    expect(rig.quits()).toBe(1);
    expect(rig.completed).toEqual([]);
  });

  it('records nothing when the week is left half-way', () => {
    const rig = openPlan();
    tap(rig, 'downRepeat');
    tap(rig, 'bPressed');
    rig.answer(1);
    expect(rig.completed).toEqual([]);
  });

  it('shows the key sessions in the order they fall on the board', () => {
    const rig = openPlan();
    const away = rig.state().away as number;
    // SPRT on the first free day, then SUPR, then SUB
    const free = [0, 1, 2, 3].filter(d => d !== away);
    const chips: string[] = Array.from({ length: 7 }, () => 'REST');
    chips[away] = 'AWAY';
    chips[free[0]!] = 'SPRT';
    chips[free[1]!] = 'SUPR';
    chips[free[2]!] = 'SUB';
    playWeek(rig, chips);
    expect(rig.last().text.split(':')[0]).toBe('SPRT');
  });
});

describe('replaying', () => {
  it('starts every attempt fresh: a new instrument has a new away day and order', () => {
    const a = openPlan(1);
    const b = openPlan(2);
    expect(a.state().order.join()).not.toBe(b.state().order.join());
  });

  it('leaves nothing behind for the next attempt: a new instrument starts at the brief with an empty board', () => {
    const first = openPlan(1);
    playWeek(first, PERFECT[first.state().away]!);
    expect(first.state().phase).toBe('debrief');
    const next = makeHost(false);
    const room = createTrainingInstrument(next.host, seeded(2));
    const s = room.debug?.() as DebugState;
    expect(s.phase).toBe('brief');
    expect(s.cursor).toBe(0);
    expect(s.plan.filter(c => c === '--')).toHaveLength(DAY_COUNT - 1); // only the away day is filled in
    expect(s.result).toBeNull();
    expect(s.debriefAt).toBe(-1);
    expect(s.runDay).toBeNull();
    expect(next.said).toEqual([[content.rulesShort]]); // a later visit gets the one-line rule
  });

  it('records the result once, however many times the last debrief line is answered', () => {
    const rig = openPlan();
    playWeek(rig, PERFECT[rig.state().away]!);
    while (rig.state().phase !== 'done') rig.answer();
    rig.answer();
    rig.answer();
    expect(rig.completed).toHaveLength(1);
  });
});

describe('what screen readers hear', () => {
  it('says who is away when the board opens', () => {
    const rig = openPlan();
    const away = rig.state().away as number;
    expect(spoken()).toContain(`Plan the week. ${['Monday', 'Tuesday', 'Wednesday', 'Thursday'][away]} is an away day.`);
  });

  it('reads the day under the cursor once it has rested for a moment', () => {
    const rig = openPlan();
    vi.mocked(announce).mockClear();
    tap(rig, 'downRepeat');
    expect(spoken()).toEqual([]); // not yet: the cursor may still be moving
    step(rig, 0.4);
    const line = spoken().pop()!;
    expect(line).toMatch(/^Monday\. .+\. Legs 100 percent\. (Full quality|Support session)\. Sessions 1 of 5\.$|^Monday\. Rest\. Legs 100 percent\. Sessions 0 of 5\.$/);
  });

  it('reads each change of day only once the cursor rests, not on every press', () => {
    const rig = openPlan();
    vi.mocked(announce).mockClear();
    for (let i = 0; i < 4; i++) {
      tap(rig, 'rightPressed', 'rightRepeat');
      step(rig, 0.1);
    }
    expect(spoken()).toEqual([]);
    step(rig, 0.4);
    expect(spoken()).toHaveLength(1);
  });

  it('reads the GO slot with what is missing', () => {
    const rig = openPlan();
    vi.mocked(announce).mockClear();
    tap(rig, 'leftPressed', 'leftRepeat');
    step(rig, 0.4);
    expect(spoken().pop()).toBe('Run the week. 0 sessions. 7 rest days. 0 red mornings. Missing: SUB, SUPR, SPRT.');
  });

  it('reads each day of the run, support days as support sessions', () => {
    const rig = openPlan();
    const chips = PERFECT[rig.state().away as number]!;
    planWeek(rig, chips);
    tap(rig, 'aPressed');
    rig.answer(0);
    vi.mocked(announce).mockClear();
    step(rig, 8.6);
    const lines = spoken();
    expect(lines[0]).toBe('Monday. Sub-threshold. Full quality.');
    expect(lines.some(l => /Easy Running\. Support session\.$/.test(l))).toBe(true);
    expect(lines.some(l => /AWAY\.$/.test(l))).toBe(true);
    expect(lines.filter(l => /^\w+day\./.test(l))).toHaveLength(DAY_COUNT);
  });

  it('reads an empty day of the run as nothing planned, never as dashes', () => {
    const rig = openPlan();
    const away = rig.state().away as number;
    // One session on Monday and every other free day left empty
    planWeek(rig, ['SUB', '--', '--', '--', '--', '--', '--'].map((chip, d) => (d === away ? 'AWAY' : chip)));
    tap(rig, 'aPressed');
    rig.answer(0);
    vi.mocked(announce).mockClear();
    step(rig, 8.6);
    const lines = spoken();
    expect(lines.filter(l => l.includes('--'))).toEqual([]);
    expect(lines.filter(l => /\. Nothing planned\.$/.test(l))).toHaveLength(DAY_COUNT - 2); // all but Monday and the away day
  });
});

describe('random play', () => {
  const BUTTONS: (keyof InputState)[] = ['upRepeat', 'downRepeat', 'leftRepeat', 'rightRepeat', 'aPressed', 'bPressed', 'a', 'startPressed'];
  const PHASES = ['brief', 'plan', 'asking', 'run', 'debrief', 'done'];

  it('never throws, never records twice and keeps the cursor on the board, whatever is pressed and answered', () => {
    const reached = new Set<string>();
    const problems: string[] = [];
    for (let seed = 0; seed < 30; seed++) {
      const rng = seeded(seed + 1000);
      const h = makeHost(rng() < 0.5);
      const room = createTrainingInstrument(h.host, seeded(seed));
      let answered = 0;
      for (let step = 0; step < 2500; step++) {
        // Now and then answer or cancel whatever the room asked
        if (h.shown.length > answered && rng() < 0.04) {
          const top = h.shown[h.shown.length - 1]!;
          answered = h.shown.length;
          if (rng() < 0.3) top.onCancel?.();
          else top.onComplete?.(top.choices ? Math.floor(rng() * top.choices.length) : undefined);
        }
        const pressed = BUTTONS.filter(() => rng() < 0.08);
        room.update(1 / 60, rng() < 0.2 ? keys(...pressed, 'a') : keys(...pressed), h.shown.length > answered);
        // The invariants are collected, not asserted a million times (expect is slow in a loop this long)
        if (step % 10 === 0) {
          const s = room.debug?.() as DebugState;
          if (s.cursor < 0 || s.cursor > 7) problems.push(`seed ${seed}: cursor ${s.cursor}`);
          if (s.plan.length !== DAY_COUNT) problems.push(`seed ${seed}: plan of ${s.plan.length} days`);
          if (!PHASES.includes(s.phase)) problems.push(`seed ${seed}: phase ${s.phase}`);
          reached.add(s.phase);
        }
        if (h.completed.length > 1) problems.push(`seed ${seed}: recorded ${h.completed.length} times`);
      }
    }
    expect(problems).toEqual([]);
    // The random presses get all the way through the week at least once
    expect(reached.has('run')).toBe(true);
    expect(reached.has('debrief')).toBe(true);
  }, 30000);
});
