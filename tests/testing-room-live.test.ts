// What the Testing Lab says to a screen reader and what its very first frame shows after a change of screen.
// The room runs end to end with a fake host; the announcements and the text drawn are recorded.
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';

// The game's sound module reads its saved mute setting when it loads; give Node a harmless store so it does not warn
vi.hoisted(() => {
  Object.defineProperty(globalThis, 'localStorage', { value: { getItem: () => null, setItem: () => undefined }, configurable: true });
});

const log = vi.hoisted(() => ({
  announced: [] as { text: string; step: number }[],
  texts: [] as string[],
  step: 0,
  updating: false,
}));

// The live region keeps only the last thing announced within a moment, so what the room announces is recorded
// with the update step it was announced in (-1: outside any step, e.g. when the test closes a line itself)
vi.mock('../src/ui/announce', () => ({
  announce: (text: string) => void log.announced.push({ text, step: log.updating ? log.step : -1 }),
}));

vi.mock('../src/render/PixelFont', async importOriginal => {
  const actual = await importOriginal<typeof import('../src/render/PixelFont')>();
  return { ...actual, drawText: (_ctx: unknown, text: string) => void log.texts.push(text) };
});

import { RUNNING } from '../src/rooms/content/running';
import type { AthleteCheck } from '../src/rooms/content/types';
import { createTestingRoomWith } from '../src/rooms/testing';
import { DECISION_LOCK, REBOOK_SECONDS, RUN_SECONDS, RUN_SKIP_AFTER } from '../src/rooms/testing/model';
import type { RoomInstrument } from '../src/rooms/types';
import { STEP, closeLast, inputOf, makeHost, seeded, type Button } from './testing-helpers';

/** One update step, the way the scene makes it. */
const step = (room: RoomInstrument, ...pressed: Button[]) => {
  log.step++;
  log.updating = true;
  room.update(STEP, inputOf(...pressed), false);
  log.updating = false;
};

const drive = (room: RoomInstrument, seconds: number, ...pressed: Button[]) => {
  step(room, ...pressed);
  for (let t = STEP; t < seconds; t += STEP) step(room);
};

const stateOf = (room: RoomInstrument) =>
  room.debug?.() as { phase: string; order: string[]; check: { says: string; call: 'run' | 'rebook'; answer: string | null } | null };

/** To the pick: the brief is closed and its lock has run out. */
const toPick = (seed: number, checks?: readonly AthleteCheck[]) => {
  const kit = makeHost();
  const saved = [...RUNNING.testing.checks];
  if (checks) (RUNNING.testing.checks as AthleteCheck[]).splice(0, saved.length, ...checks);
  const room = createTestingRoomWith(kit.host, seeded(seed));
  if (checks) (RUNNING.testing.checks as AthleteCheck[]).splice(0, checks.length, ...saved);
  closeLast(kit.said);
  drive(room, DECISION_LOCK + 0.05);
  return { ...kit, room };
};

const choose = (room: RoomInstrument, name: string) => {
  let target = stateOf(room).order.indexOf(name);
  while (target-- > 0) drive(room, 0.05, 'down');
  drive(room, 0.05, 'a');
};

const LT = 'Lactate Threshold Test';
const rebookCheck = RUNNING.testing.checks.find(c => c.call === 'rebook')!;
const runCheck = RUNNING.testing.checks.find(c => c.call === 'run')!;

/** Through test day with `answer` on the check, to the first steps of the run. */
const intoRun = (check: AthleteCheck, answer: 'run' | 'rebook', test = LT) => {
  const kit = toPick(7, [check]);
  choose(kit.room, test);
  closeLast(kit.said, answer === 'run' ? 0 : 1); // her call
  closeLast(kit.said); // the "why" line
  drive(kit.room, answer === 'rebook' ? REBOOK_SECONDS + 0.1 : 0.1);
  expect(stateOf(kit.room).phase).toBe('run');
  return kit;
};

/** Everything announced from inside the room's own steps (the dialogue's own lines are the scene's, not the room's). */
const announcedByRoom = () => log.announced.filter(a => a.step >= 0);

describe('what a screen reader hears as the run starts', () => {
  it('gets the re-booking, the test and its first stage in one announcement', () => {
    log.announced.length = 0;
    intoRun(rebookCheck, 'rebook');
    const heard = announcedByRoom().map(a => a.text);
    const first = heard.find(t => /^Re-booked/.test(t));
    expect(first).toBe('Re-booked: the calendar moves on two days. Running the Lactate Threshold Test. stage 1');
    expect(heard.filter(t => /Re-booked|Running the/.test(t))).toHaveLength(1);
  });

  it('warns that the data will be shaky when she runs on a day she should have been re-booked', () => {
    log.announced.length = 0;
    intoRun(rebookCheck, 'run');
    const heard = announcedByRoom().map(a => a.text);
    expect(heard).toContain('Running the Lactate Threshold Test. Data quality: shaky. stage 1');
  });

  it('just names the test and the stage on a good day', () => {
    log.announced.length = 0;
    intoRun(runCheck, 'run', 'Critical Speed Test');
    expect(announcedByRoom().map(a => a.text)).toContain('Running the Critical Speed Test. trial 1 of 3');
  });

  it('does the same with no test day at all', () => {
    log.announced.length = 0;
    const kit = toPick(9, []);
    choose(kit.room, 'Beep Test');
    drive(kit.room, 0.1);
    expect(stateOf(kit.room).phase).toBe('run');
    expect(announcedByRoom().map(a => a.text)).toContain('Running the Beep Test. level 1');
  });

  it('drops a cursor announcement still waiting for the cursor to rest when the test is chosen', () => {
    log.announced.length = 0;
    const kit = toPick(13, [runCheck]);
    drive(kit.room, 0.05, 'down'); // the cursor moves: its announcement waits for the cursor to rest
    drive(kit.room, 0.05, 'a'); // and the test is chosen before that
    expect(stateOf(kit.room).phase).toBe('check');
    drive(kit.room, 1);
    expect(announcedByRoom().filter(a => /Test\. .*Gives /.test(a.text))).toEqual([]);
  });

  it('never announces twice in one step, so nothing it says is replaced by the next thing', () => {
    log.announced.length = 0;
    const kit = intoRun(rebookCheck, 'run', 'Beep Test');
    drive(kit.room, RUN_SECONDS + 0.2); // the whole run and its printout
    const steps = announcedByRoom().map(a => a.step);
    expect(steps.length).toBeGreaterThan(6);
    expect(new Set(steps).size).toBe(steps.length);
  });
});

/** A canvas that takes any drawing call: only the words drawn matter here. */
const noop = new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D;

const realDocument = (globalThis as { document?: unknown }).document;
beforeAll(() => {
  (globalThis as { document?: unknown }).document = { createElement: () => ({ width: 0, height: 0, getContext: () => noop }) };
});
afterAll(() => {
  (globalThis as { document?: unknown }).document = realDocument;
});

describe('the first frame of the printout', () => {
  it('already shows the test that was run, when A skips the run', () => {
    const kit = toPick(11, [runCheck]);
    const order = stateOf(kit.room).order;
    const chosen = order.find(name => name !== order[0])!; // not the first in the list: the one a stale printout would show
    choose(kit.room, chosen);
    closeLast(kit.said, 0); // RUN THE TEST (a ready day, so the right call)
    closeLast(kit.said);
    drive(kit.room, RUN_SKIP_AFTER + 0.1);
    expect(stateOf(kit.room).phase).toBe('run');

    step(kit.room, 'a'); // skip
    expect(stateOf(kit.room).phase).toBe('printout');
    log.texts.length = 0;
    kit.room.render(noop); // the very next frame, before the next step
    expect(log.texts).toContain('LAB PRINTOUT');
    expect(log.texts).toContain(chosen.toUpperCase());
    expect(log.texts).not.toContain(order[0]!.toUpperCase());
  });

  it('shows the test that was run when the run ends by itself too', () => {
    const kit = toPick(12, [runCheck]);
    const order = stateOf(kit.room).order;
    const chosen = order[order.length - 1]!;
    choose(kit.room, chosen);
    closeLast(kit.said, 0);
    closeLast(kit.said);
    drive(kit.room, RUN_SECONDS + 0.2);
    expect(stateOf(kit.room).phase).toBe('printout');
    log.texts.length = 0;
    kit.room.render(noop);
    expect(log.texts).toContain(chosen.toUpperCase());
  });
});
