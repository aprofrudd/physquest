// The stage's layout facts: what fits where, the calendar's turns, and the words read to a screen reader.
import { describe, expect, it, vi } from 'vitest';
import { measureText } from '../src/render/PixelFont';
import { LEVEL_DATA } from '../src/data/sports';
import { RUNNING } from '../src/rooms/content/running';
import { chipWidth } from '../src/rooms/frame';
import { REBOOK_SECONDS, TEST_DAYS, createTestingModel, spoken, WEEKDAYS } from '../src/rooms/testing/model';
import { BAND_H, calendarAt, givesLinesOf, pickWindow, runWindow, trialsOf } from '../src/rooms/testing/stage';
import { beatCount, BEEP_TIMES } from '../src/rooms/testing/timeline';
import { optionListHeight } from '../src/render/DialogueBox';


// The game's sound module reads its saved mute setting when it loads; give Node a harmless store so it does not warn
vi.hoisted(() => {
  Object.defineProperty(globalThis, 'localStorage', { value: { getItem: () => null, setItem: () => undefined }, configurable: true });
});

const sport = LEVEL_DATA[3]!;
const content = RUNNING.testing;

describe('what fits on the pick screen', () => {
  const listTop = 162 - optionListHeight(sport.tests.map(t => t.name), 2);
  const window = pickWindow(listTop);

  it('leaves the stage window 68 px between the plates and the list, with two clear pixels either side', () => {
    expect(listTop).toBe(108);
    expect(window).toEqual({ x: 4, y: 38, w: 248, h: 68 });
    expect(window.y).toBeGreaterThanOrEqual(38); // the plates end at 36
    expect(window.y + window.h + 2).toBe(listTop);
  });

  it('is the whole stage for the run', () => {
    expect(runWindow).toEqual({ x: 4, y: 38, w: 248, h: 124 });
  });

  it('fits the needs line in the band: 40 characters of 5x7 text across the 248 px window', () => {
    const line = `AISHA NEEDS: ${content.needs}`;
    expect(measureText(line) - 1).toBeLessThanOrEqual(window.w - 8);
    expect(BAND_H).toBe(11); // 7px text with 2px clear above and below
  });

  it('fits every card\'s three chips in the left column (240 - 84 - 6 = 150 px)', () => {
    for (const card of content.cards) {
      const widths = card.chips.map(c => chipWidth(c));
      const total = widths.reduce((a, b) => a + b, 0) + 3 * (widths.length - 1);
      expect(total, card.name).toBeLessThanOrEqual(150);
    }
  });

  it('fits what each test gives in two lines of the right-hand column (14 characters, with "GIVES:" in front)', () => {
    for (const card of content.cards) {
      const lines = givesLinesOf(card);
      expect(lines.length, card.name).toBeLessThanOrEqual(2);
      expect(lines[0]!.startsWith('GIVES: ')).toBe(true);
      for (const line of lines) expect(line.length).toBeLessThanOrEqual(14);
      expect(lines.join(' ')).toBe(`GIVES: ${card.gives}`);
    }
  });

  it('reads the number of trials from the chips once per card', () => {
    const cs = content.cards.find(c => c.name === 'Critical Speed Test')!;
    expect(trialsOf(cs)).toBe(3);
    expect(trialsOf(cs)).toBe(3);
    expect(trialsOf(content.cards[0]!)).toBe(3); // no trials in its chips: the default
  });
});

describe('the calendar', () => {
  it('shows test day and nothing else until a test is re-booked', () => {
    for (const flip of [0, 0.5, 5]) expect(calendarAt(2, false, flip)).toEqual({ scale: 1, day: 2, stamp: false });
  });

  it('turns twice, two days on, and then stamps RE-BOOKED', () => {
    const days = new Set<number>();
    let stampedAt = -1;
    let thin = 0;
    for (let i = 0; i <= 160; i++) {
      const at = calendarAt(1, true, (REBOOK_SECONDS * i) / 160);
      days.add(at.day);
      if (at.stamp && stampedAt < 0) stampedAt = i / 160;
      if (at.scale < 0.2) thin++;
    }
    expect([...days].sort()).toEqual([1, 2, 3]);
    expect(stampedAt).toBeGreaterThan(0.8);
    expect(thin).toBeGreaterThan(2); // the page really does go thin at each turn
    const end = calendarAt(1, true, REBOOK_SECONDS);
    expect(end).toEqual({ scale: 1, day: 3, stamp: true });
  });

  it('never runs off the end of the week, and lands on a weekday from any test day the room draws', () => {
    for (let day = 0; day < TEST_DAYS; day++) expect(calendarAt(day, true, REBOOK_SECONDS).day).toBeLessThan(5);
    for (let day = 0; day < 5; day++) expect(calendarAt(day, true, REBOOK_SECONDS).day).toBeLessThan(WEEKDAYS.length);
    expect(WEEKDAYS).toEqual(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']);
  });

  it('reuses the object it is given, so drawing allocates nothing', () => {
    const out = { scale: 1, day: 0, stamp: false };
    expect(calendarAt(0, true, 0.5, out)).toBe(out);
  });
});

describe('sounds and speech', () => {
  const counts = { stages: 7, trials: 3 };

  it('makes a sound for each stage, each trial, the all-out start and each beep, and never goes back', () => {
    for (const shape of ['stages', 'trials', 'allout', 'shuttles'] as const) {
      let last = 0;
      for (let i = 0; i <= 500; i++) {
        const n = beatCount(shape, i / 500, counts);
        expect(n).toBeGreaterThanOrEqual(last);
        last = n;
      }
    }
    expect(beatCount('stages', 1, counts)).toBe(7);
    expect(beatCount('trials', 1, counts)).toBe(3);
    expect(beatCount('allout', 0.9, counts)).toBe(1);
    expect(beatCount('shuttles', 0, counts)).toBe(1);
    expect(beatCount('shuttles', 1, counts)).toBe(1 + BEEP_TIMES.length);
  });

  it('keeps digits in capitals and lower-cases the rest when speaking', () => {
    expect(spoken('LT1 AND LT2 PACES')).toBe('LT1 and LT2 paces');
    expect(spoken('VO2MAX ESTIMATE')).toBe('VO2MAX estimate');
    expect(spoken('PEAK AND MEAN POWER')).toBe('peak and mean power');
  });

  it('reads the printout as a sentence, with her name only for a wrong test', () => {
    const model = createTestingModel({ sport, content: { ...content, checks: [] }, rng: () => 0.5 });
    model.startPick();
    model.update(1);
    model.moveCursor(model.state.order.findIndex(t => t.name === 'Lactate Threshold Test'));
    model.choose();
    expect(model.printoutSpoken()).toBe('Lab printout. Lactate Threshold Test. Records LT1 and LT2 paces. Sent to the Data Lab.');

    const wrong = createTestingModel({ sport, content: { ...content, checks: [] }, rng: () => 0.5 });
    wrong.startPick();
    wrong.update(1);
    wrong.moveCursor(wrong.state.order.findIndex(t => t.name === 'Wingate Test'));
    wrong.choose();
    expect(wrong.printoutSpoken()).toBe('Lab printout. Wingate Test. Records peak and mean power. Not what Aisha needs.');
  });
});
