// The ATHLETE room's rules (src/rooms/meet/model.ts) and its content (src/rooms/content/meet-running.ts).
import { describe, expect, it } from 'vitest';
import { MEET_RUNNING } from '../src/rooms/content/meet-running';
import type { MeetContent } from '../src/rooms/content/meet-types';
import {
  afterAnswer,
  askCurrent,
  asksAllowed,
  asksLeft,
  createMeet,
  current,
  debriefFor,
  finished,
  goodAsked,
  moveCursor,
  overviewLabel,
  shuffled,
} from '../src/rooms/meet/model';
import { OPTION_LIST_CHARS, wrapText } from '../src/render/DialogueBox';

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

const C: MeetContent = MEET_RUNNING;

describe('shuffled', () => {
  it('keeps every item exactly once, for any rng (even one that returns 1)', () => {
    for (const rng of [seeded(1), seeded(99), () => 0, () => 0.999999, () => 1]) {
      const out = shuffled([1, 2, 3, 4, 5, 6], rng);
      expect([...out].sort()).toEqual([1, 2, 3, 4, 5, 6]);
    }
  });

  it('gives different orders for different seeds', () => {
    const orders = new Set([1, 2, 3, 4, 5, 6, 7, 8].map(s => shuffled(C.questions, seeded(s)).map(q => q.id).join()));
    expect(orders.size).toBeGreaterThan(4);
  });
});

describe('a visit', () => {
  it('starts with every question, nothing asked and an empty notebook', () => {
    const m = createMeet(C, seeded(3));
    expect(m.options.length).toBe(C.questions.length);
    expect(m.labels).toEqual(m.options.map(q => q.ask));
    expect(m.asked).toEqual([]);
    expect(m.notes).toEqual([]);
    expect(asksLeft(m)).toBe(C.asks);
    expect(finished(m)).toBe(false);
  });

  it('moves the cursor with wrapping and asks the question under it', () => {
    const m = createMeet(C, seeded(4));
    expect(moveCursor(m, -1)).toBe(true);
    expect(m.cursor).toBe(m.options.length - 1);
    expect(moveCursor(m, 1)).toBe(true);
    expect(m.cursor).toBe(0);
    moveCursor(m, 1);
    const q = current(m)!;
    expect(askCurrent(m)).toBe(q);
    expect(m.options).not.toContain(q);
    expect(m.labels).not.toContain(q.ask);
    expect(m.asked).toEqual([q]);
    expect(m.notes).toEqual(q.good ? [q.note] : []);
  });

  it('writes a note for a good question only, and counts the good ones', () => {
    const m = createMeet(C, seeded(5));
    let good = 0;
    while (!finished(m)) {
      const q = askCurrent(m)!;
      if (q.good) good++;
    }
    expect(goodAsked(m)).toBe(good);
    expect(m.notes.length).toBe(good);
    expect(m.asked.length).toBe(C.asks);
    expect(askCurrent(m), 'nothing more can be asked').toBeNull();
  });

  it('can reach a full notebook by picking only good questions', () => {
    const m = createMeet(C, seeded(6));
    while (!finished(m)) {
      while (!current(m)!.good) moveCursor(m, 1);
      askCurrent(m);
    }
    expect(goodAsked(m)).toBe(C.asks);
    expect(overviewLabel(goodAsked(m), asksAllowed(C))).toBe(`OVERVIEW ${C.asks}/${C.asks}`);
  });

  it('keeps the cursor on the list when the last option is asked', () => {
    const m = createMeet(C, seeded(7));
    m.cursor = m.options.length - 1;
    askCurrent(m);
    expect(m.cursor).toBe(m.options.length - 1);
  });

  it('never allows more asks than there are questions', () => {
    const tiny: MeetContent = { ...C, questions: C.questions.slice(0, 2), asks: 5 };
    expect(asksAllowed(tiny)).toBe(2);
    const m = createMeet(tiny, seeded(8));
    askCurrent(m);
    askCurrent(m);
    expect(finished(m)).toBe(true);
  });
});

describe('words', () => {
  it('debriefs by good questions asked, clamped to the list', () => {
    expect(debriefFor(C, 0)).toBe(C.debrief[0]);
    expect(debriefFor(C, 3)).toBe(C.debrief[3]);
    expect(debriefFor(C, 99)).toBe(C.debrief[C.debrief.length - 1]);
    expect(debriefFor(C, -1)).toBe(C.debrief[0]);
  });

  it('says the note for a good question and why a weaker one can wait', () => {
    const good = C.questions.find(q => q.good)!;
    const weak = C.questions.find(q => !q.good)!;
    expect(afterAnswer(good)).toEqual([good.said ?? `Noted: ${good.note}.`, good.why]);
    expect(afterAnswer(weak)).toEqual([weak.note, weak.why]);
    // every good question says its note in sentence case, not the notebook's capitals
    for (const q of C.questions.filter(x => x.good)) {
      expect(q.said, q.id).toMatch(/^Noted: [a-z0-9]/);
      expect(q.said, q.id).not.toMatch(/[A-Z]{3,}/);
    }
  });
});

describe('the Distance Running content fits the room', () => {
  it('has more good questions than asks, and some weaker ones', () => {
    const good = C.questions.filter(q => q.good).length;
    expect(good).toBeGreaterThanOrEqual(C.asks);
    expect(C.questions.length - good).toBeGreaterThan(0);
    expect(C.debrief.length).toBe(C.asks + 1);
  });

  it('has unique ids, one-line options and notes that fit the notebook', () => {
    expect(new Set(C.questions.map(q => q.id)).size).toBe(C.questions.length);
    for (const q of C.questions) {
      expect(q.ask.length, q.ask).toBeLessThanOrEqual(Math.min(30, OPTION_LIST_CHARS));
      expect(q.answer.length, q.id).toBeGreaterThan(0);
      if (q.good) expect(q.note.length, q.note).toBeLessThanOrEqual(24);
    }
  });

  it('every page fits the dialogue box (4 lines) with an 8-letter name and the longest button names', () => {
    const fill = (t: string) =>
      t
        .replace(/\{NAME\}/g, 'Mckaylee')
        .replace(/\{A\}/g, 'SPACE')
        .replace(/\{B\}/g, 'X')
        .replace(/\{START\}/g, 'START')
        .replace(/\{SELECT\}/g, 'SELECT')
        .replace(/\{DPAD\}/g, 'D-PAD');
    const pages = [
      ...C.directorWelcome, ...C.directorReminder, ...C.directorAfter, ...C.athleteIntro, ...C.rules, C.rulesShort,
      ...C.debrief, ...C.farewell, ...C.questions.flatMap(q => [...q.answer, ...afterAnswer(q)]),
    ];
    for (const p of pages) expect(wrapText(fill(p)).length, p).toBeLessThanOrEqual(4);
  });

  it('names the player only with {NAME}, never as a coach', () => {
    const all = [...C.directorWelcome, ...C.directorReminder, ...C.directorAfter, ...C.athleteIntro, ...C.rules, C.rulesShort, ...C.debrief, ...C.farewell];
    expect(all.some(t => t.includes('{NAME}'))).toBe(true);
    for (const t of all) expect(t).not.toMatch(/\bcoach\b,|Coach[,.!]/);
  });
});

describe('the notebook fits its notes', async () => {
  const { BOOK } = await import('../src/rooms/meet/draw');
  const { measureText } = await import('../src/render/PixelFont');
  it('the longest good note, after its tick, stays inside the panel border', () => {
    const widest = Math.max(...C.questions.filter(q => q.good).map(q => measureText(q.note) - 1));
    expect(6 + 9 + widest).toBeLessThanOrEqual(BOOK.w - 4);
  });
});
