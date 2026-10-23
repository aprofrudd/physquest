// Alan reviews every word of physiology: the Testing Lab must say and draw only what the content files and
// sports.ts give it, plus plain UI words. This plays the room through every test, every test day check and both
// calls, and checks each line it says and each string it draws against those files.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// The game's sound module reads its saved mute setting when it loads; give Node a harmless store so it does not warn
vi.hoisted(() => {
  Object.defineProperty(globalThis, 'localStorage', { value: { getItem: () => null, setItem: () => undefined }, configurable: true });
});

const drawn = vi.hoisted(() => ({ texts: [] as string[] }));

vi.mock('../src/render/PixelFont', async importOriginal => {
  const actual = await importOriginal<typeof import('../src/render/PixelFont')>();
  return { ...actual, drawText: (_ctx: unknown, text: string) => void drawn.texts.push(text) };
});

import { wrapText } from '../src/render/DialogueBox';
import { RUNNING } from '../src/rooms/content/running';
import type { AthleteCheck } from '../src/rooms/content/types';
import { createTestingRoomWith } from '../src/rooms/testing';
import { DECISION_LOCK, RUN_SECONDS, WEEKDAYS, factorFor } from '../src/rooms/testing/model';
import type { RoomInstrument } from '../src/rooms/types';
import { choose, closeLast, drive, makeHost, seeded, sport, stateOf, toPickWith } from './testing-helpers';

const content = RUNNING.testing;
const upper = (text: string) => text.toUpperCase();

/** A canvas that takes any drawing call: only the words drawn matter here. */
const noop = new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D;

const realDocument = (globalThis as { document?: unknown }).document;
afterAll(() => {
  (globalThis as { document?: unknown }).document = realDocument;
});

// ---- what the room may draw ---------------------------------------------------------------------------------------

/** Words the lab adds that carry no physiology (UI), and the hints (their button names are filled in by the scene). */
const UI_WORDS: readonly string[] = [
  'AISHA NEEDS: ', 'EFFORT', 'GIVES:', 'RUNNING: ', 'DONE: ', 'LAB PRINTOUT', 'DATA QUALITY: SHAKY', 'SENT TO THE DATA LAB',
  'NOT WHAT AISHA NEEDS', 'TEST DAY', 'RE-BOOKED', 'SHAKY', '!', '>', 'REST', 'ALL-OUT', 'OF 3',
  'Which test should we use?', 'The lab printout is ready.',
  '{A}: CHOOSE   {B}: QUIT', '{A}: SKIP   {B}: QUIT', '{A}: CONTINUE   {B}: QUIT',
  ...WEEKDAYS,
];

const allowed = new Set<string>([...UI_WORDS, content.needs]);
for (const test of sport.tests) {
  const card = content.cards.find(c => c.name === test.name)!;
  allowed.add(test.name);
  allowed.add(upper(test.name));
  for (const line of wrapText(test.description)) allowed.add(line);
  for (const chip of card.chips) allowed.add(chip);
  allowed.add(`RECORDS: ${card.gives}`);
  for (const line of wrapText(`GIVES: ${card.gives}`, 14)) allowed.add(line.startsWith('GIVES: ') ? line.slice(6) : line);
  for (const line of wrapText(`Aisha is running the ${test.name}.`)) allowed.add(line);
}
/** Counters on the run's readout: STAGE 3, TRIAL 2 (then OF 3), LEVEL 4. */
const COUNTERS = [/^STAGE \d$/, /^TRIAL \d$/, /^LEVEL \d$/];
const isAllowed = (text: string) => allowed.has(text) || COUNTERS.some(pattern => pattern.test(text));

/** Everything drawn so far in this file, by what it was drawn during. */
const seen = new Set<string>();
const look = (room: RoomInstrument) => {
  drawn.texts.length = 0;
  room.render(noop);
  for (const text of drawn.texts) seen.add(text);
};
/** Advance in quarter seconds, looking at the screen each time. */
const watch = (room: RoomInstrument, seconds: number) => {
  for (let t = 0; t < seconds; t += 0.25) {
    drive(room, 0.25);
    look(room);
  }
};

// ---- play every combination ---------------------------------------------------------------------------------------

interface Played {
  test: string;
  check: AthleteCheck;
  call: 'run' | 'rebook';
  question: string;
  choices: string[] | undefined;
  why: string;
  verdict: string;
  insight: string;
  result: { dataQuality: number; variableAccuracy: number } | undefined;
}

const play = (test: string, check: AthleteCheck, call: 'run' | 'rebook', seed: number): Played => {
  const kit = toPickWith(seed, [check]);
  look(kit.room);
  choose(kit.room, test);
  look(kit.room);
  const question = kit.said[kit.said.length - 1]!;
  closeLast(kit.said, call === 'run' ? 0 : 1);
  watch(kit.room, 2);
  const why = kit.said[kit.said.length - 1]!.text;
  closeLast(kit.said);
  watch(kit.room, RUN_SECONDS + 1); // the calendar, the run and its printout
  expect(stateOf(kit.room).phase).toBe('printout');
  drive(kit.room, DECISION_LOCK + 0.1);
  drive(kit.room, 0.05, 'a');
  look(kit.room);
  const verdict = kit.said[kit.said.length - 1]!.text;
  closeLast(kit.said);
  const insight = kit.said[kit.said.length - 1]!.text;
  closeLast(kit.said);
  return { test, check, call, question: question.text, choices: question.choices, why, verdict, insight, result: kit.completed[0] };
};

const played: Played[] = [];

beforeAll(() => {
  (globalThis as { document?: unknown }).document = { createElement: () => ({ width: 0, height: 0, getContext: () => noop }) };

  // every test with every check and both calls
  let seed = 100;
  for (const test of sport.tests) for (const check of content.checks) for (const call of ['run', 'rebook'] as const) played.push(play(test.name, check, call, seed++));

  // the brief: the stage tours the four tests while the profile is read
  watch(createTestingRoomWith(makeHost().host, seeded(3)), 11);

  // the pick: every test under the cursor, from the start of its loop to the end
  const kit = toPickWith(7);
  for (let i = 0; i < sport.tests.length; i++) {
    look(kit.room);
    watch(kit.room, 8);
    drive(kit.room, 0.05, 'down');
    look(kit.room);
  }
});

describe('every line the room says, for every test, every check and both calls', () => {
  it('plays all 40 combinations', () => {
    expect(played).toHaveLength(sport.tests.length * content.checks.length * 2);
  });

  it('asks test day in her own words, with the two choices', () => {
    for (const p of played) {
      expect(p.question).toBe(`Test day. Aisha says: "${p.check.says}"`);
      expect(p.choices).toEqual(['RUN THE TEST', 'RE-BOOK IT']);
    }
  });

  it('says why after the call: "Good call." for the right one and "Hmm." for the wrong, then the check\'s own reason', () => {
    for (const p of played) {
      expect(p.why).toBe(`${p.call === p.check.call ? 'Good call.' : 'Hmm.'} ${p.check.why}`);
    }
  });

  it('gives the classic verdict for the test, then the test insight', () => {
    for (const p of played) {
      const test = sport.tests.find(t => t.name === p.test)!;
      expect(p.verdict).toBe(test.correct ? `Good choice! ${test.description}` : `Not ideal. ${test.description} This isn't the best match for the athlete's needs.`);
      expect(p.insight).toBe(sport.testInsight);
    }
  });

  it('records the test\'s own data quality and accuracy, less the readiness factor, exactly once', () => {
    for (const p of played) {
      const test = sport.tests.find(t => t.name === p.test)!;
      expect(p.result, `${p.test} / ${p.check.says} / ${p.call}`).toEqual({
        dataQuality: test.dataQuality * factorFor(content, p.check, p.call),
        variableAccuracy: test.correct ? 1 : 0.3,
      });
    }
  });
});

describe('every word the room draws', () => {
  it('is from the content files, sports.ts, or the plain UI words', () => {
    expect(seen.size).toBeGreaterThan(40);
    expect([...seen].filter(text => !isAllowed(text))).toEqual([]);
  });

  it('includes every test name, chip and what each test gives, so none is left undrawn', () => {
    for (const test of sport.tests) {
      const card = content.cards.find(c => c.name === test.name)!;
      expect(seen.has(test.name), test.name).toBe(true);
      expect(seen.has(upper(test.name)), upper(test.name)).toBe(true);
      for (const chip of card.chips) expect(seen.has(chip), chip).toBe(true);
      expect(seen.has(`RECORDS: ${card.gives}`), card.gives).toBe(true);
    }
    for (const word of ['LAB PRINTOUT', 'SENT TO THE DATA LAB', 'NOT WHAT AISHA NEEDS', 'TEST DAY', 'RE-BOOKED', 'REST', 'ALL-OUT', ...WEEKDAYS.slice(0, 5)]) {
      expect(seen.has(word), word).toBe(true);
    }
    for (const counter of [/^STAGE 7$/, /^TRIAL 3$/, /^LEVEL 6$/]) expect([...seen].some(text => counter.test(text)), String(counter)).toBe(true);
  });
});
