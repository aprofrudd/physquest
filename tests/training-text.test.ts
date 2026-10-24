// What the Training Floor says: the prompt box lines (verbatim content, at most four lines), the debrief, the
// question before a run, and the lines screen readers hear.
import { describe, expect, it } from 'vitest';
import { LEVEL_DATA } from '../src/data/sports';
import { RUNNING } from '../src/rooms/content/running';
import { fillButtonNames } from '../src/engine/Input';
import { wrapText } from '../src/render/DialogueBox';
import { DAY_COUNT, analyse, sessionFromChip, type Session } from '../src/rooms/training/model';
import {
  checkLines,
  checksSentence,
  dayAnnouncement,
  dayPrompt,
  debriefLines,
  goAnnouncement,
  goPrompt,
  runDayAnnouncement,
  runQuestion,
  zoneName,
} from '../src/rooms/training/text';

const content = RUNNING.training;
const sport = LEVEL_DATA[3]!;
const week = (...chips: string[]): Session[] =>
  Array.from({ length: DAY_COUNT }, (_, d) => sessionFromChip(content, chips[d] ?? '--'));
const consoleFill = (text: string) => fillButtonNames(text, button => ({ up: 'UP', down: 'DOWN', left: 'LEFT', right: 'RIGHT', a: 'A', b: 'B', start: 'START', select: 'SELECT', dpad: 'D-PAD' })[button]);
const keyboardFill = (text: string) => fillButtonNames(text, button => ({ up: 'UP', down: 'DOWN', left: 'LEFT', right: 'RIGHT', a: 'SPACE', b: 'X', start: 'ESC', select: 'SHIFT', dpad: 'ARROWS' })[button]);

const textOf = (lines: { text: string }[]) => lines.map(l => l.text).join(' ');

describe('the prompt box', () => {
  it('never needs more than four lines, whatever the day, session and legs', () => {
    const legsValues = [100, 95, 80, 75, 74, 50, 46, 45, 30, 0];
    for (const fill of [consoleFill, keyboardFill]) {
      for (let day = 0; day < DAY_COUNT; day++) {
        for (const chip of ['--', 'REST', 'AWAY', ...content.cards.map(c => c.label)]) {
          for (const legs of legsValues) {
            const lines = dayPrompt(content, sport, day, sessionFromChip(content, chip), legs, fill);
            expect(lines.length, `${day} ${chip} ${legs}`).toBeLessThanOrEqual(4);
            for (const line of lines) expect(line.text.length).toBeLessThanOrEqual(38);
          }
        }
      }
    }
  });

  it('names the day, the zone as sports.ts spells it, and the zone in the athlete\'s numbers', () => {
    for (const card of content.cards) {
      const lines = dayPrompt(content, sport, 1, sessionFromChip(content, card.label), 100);
      const zone = sport.zones.find(z => z.name === card.zone)!;
      expect(textOf(lines)).toContain(`TUE: ${zone.name} (${card.target})`.split(' ').slice(0, 3).join(' '));
      expect(lines.map(l => l.text).join(' ')).toContain(card.target.split(' ')[0]);
      expect(zoneName(sport, card)).toBe(zone.name);
    }
  });

  it('wraps the zone line exactly as the dialogue box would', () => {
    const card = content.cards.find(c => c.label === 'SUPR')!;
    const lines = dayPrompt(content, sport, 3, sessionFromChip(content, 'SUPR'), 100);
    const expected = wrapText(`THU: ${card.zone}, ${card.target}`); // one parenthesis is the zone's own
    expect(lines.slice(0, expected.length).map(l => l.text)).toEqual(expected);
  });

  it('says the key session\'s quality with the content\'s own words and the day\'s legs', () => {
    const card = content.cards.find(c => c.label === 'SPRT')!;
    const say = (legs: number) => textOf(dayPrompt(content, sport, 0, sessionFromChip(content, 'SPRT'), legs)).replace(/\s+/g, ' ');
    const compact = (text: string) => wrapText(text).join(' ');
    expect(say(100)).toContain(compact(`${card.label}: full quality (legs 100%).`));
    expect(say(75)).toContain(compact(`${card.label}: full quality (legs 75%).`));
    expect(say(50)).toContain(compact(`${card.label}: legs only 50%, so not full quality.`));
    expect(say(45)).toContain(compact(`${card.label}: legs 45%. Too tired for this to do its job.`));
    expect(say(30)).toContain(compact(`${card.label}: legs 30%. Too tired for this to do its job.`));
  });

  it('colours the verdict by band, and words carry it as well', () => {
    const tone = (legs: number) => dayPrompt(content, sport, 0, sessionFromChip(content, 'SUB'), legs).slice(-1)[0]!.tone;
    expect(tone(100)).toBe('good');
    expect(tone(60)).toBe('warn');
    expect(tone(30)).toBe('bad');
    // The head of the prompt is always plain ink
    expect(dayPrompt(content, sport, 0, sessionFromChip(content, 'SUB'), 30)[0]!.tone).toBe('ink');
  });

  it('shows the support note for a support session, and no quality line', () => {
    const lines = dayPrompt(content, sport, 2, sessionFromChip(content, 'EASY'), 50);
    expect(textOf(lines)).toContain(wrapText(content.supportNote).join(' '));
    expect(textOf(lines)).not.toContain('FULL QUALITY');
    expect(textOf(lines).toLowerCase()).not.toContain('legs only');
  });

  it('handles rest, away and empty days with plain words', () => {
    expect(textOf(dayPrompt(content, sport, 0, sessionFromChip(content, 'REST'), 100))).toContain('MON: REST');
    const away = textOf(dayPrompt(content, sport, 2, sessionFromChip(content, 'AWAY'), 75));
    expect(away).toContain(`WED: ${content.awayLabel}`);
    expect(away).toContain('No session is possible this day.');
    const empty = textOf(dayPrompt(content, sport, 4, sessionFromChip(content, '--'), 100, consoleFill));
    expect(empty).toContain('FRI: NO SESSION');
    expect(empty).toContain('Press UP or DOWN to pick a session.');
    expect(empty).toContain('Legs 100% this morning.');
  });

  it('fills the button names for the device in use', () => {
    expect(textOf(dayPrompt(content, sport, 4, sessionFromChip(content, '--'), 100, keyboardFill))).toContain('Press UP or DOWN');
  });

  it('does not tell the player to pick a session while the week is being run (nothing can be picked then)', () => {
    const empty = dayPrompt(content, sport, 4, sessionFromChip(content, '--'), 100, consoleFill, true);
    expect(textOf(empty)).toContain('FRI: NO SESSION');
    expect(textOf(empty)).toContain('Nothing planned.');
    expect(textOf(empty)).toContain('Legs 100% this morning.');
    expect(textOf(empty)).not.toMatch(/press|pick/i);
    // the other days read the same in a run as on the board
    for (const chip of ['REST', 'AWAY', ...content.cards.map(c => c.label)]) {
      const session = sessionFromChip(content, chip);
      expect(dayPrompt(content, sport, 2, session, 80, consoleFill, true)).toEqual(dayPrompt(content, sport, 2, session, 80, consoleFill));
    }
    expect(empty.length).toBeLessThanOrEqual(4);
  });

  it('asks about the week on the GO slot, naming the key sessions still missing', () => {
    const a = analyse(content, week('SUB'));
    const missing = [content.cards[1]!, content.cards[3]!];
    expect(textOf(goPrompt(a, missing))).toContain('No SUPR session yet. No SPRT session yet.');
    const full = analyse(content, week('SUB', 'EASY', 'SUPR', 'EASY', 'SPRT', 'EASY', 'REST'));
    expect(textOf(goPrompt(full, []))).toContain('6 sessions, 1 rest day.');
    const rested = analyse(content, week('SUB', 'EASY', 'SUPR', 'EASY', 'SPRT', 'REST', 'REST'));
    expect(textOf(goPrompt(rested, []))).toContain('5 sessions, 2 rest days.');
  });

  it('puts any missing key session before the question', () => {
    expect(runQuestion([])).toBe('Run the week?');
    // full names: the box is read aloud too, and a screen reader cannot say SPRT
    expect(runQuestion([content.cards[3]!])).toBe('No Sprint Training session yet. Run the week?');
    expect(runQuestion([content.cards[0]!, content.cards[3]!])).toBe('No Sub-threshold session yet. No Sprint Training session yet. Run the week?');
    // all three missing still fits the box with the YES / NO list on the same page
    expect(wrapText(runQuestion([content.cards[0]!, content.cards[1]!, content.cards[3]!])).length).toBeLessThanOrEqual(4);
  });
});

describe('the footer checks', () => {
  it('shows each count with its tick or cross', () => {
    const good = checkLines(content, analyse(content, week('SUB', 'EASY', 'SUPR', 'EASY', 'SPRT', 'EASY', 'REST')));
    expect(good.map(c => c.text)).toEqual(['SESSIONS 6/5', 'REST 1', 'RED 0']);
    expect(good.map(c => c.ok)).toEqual([true, true, true]);
    const bad = checkLines(content, analyse(content, week('SUB', 'SUPR', 'SPRT')));
    expect(bad.map(c => c.text)).toEqual(['SESSIONS 3/5', 'REST 4', 'RED 2']);
    expect(bad.map(c => c.ok)).toEqual([false, false, false]);
  });
});

describe('the debrief', () => {
  const perfect = week('SUB', 'EASY', 'SUPR', 'EASY', 'SPRT', 'EASY', 'REST');

  it('goes through each key card, then the checks in words, then the insight from sports.ts', () => {
    const lines = debriefLines(content, sport, analyse(content, perfect));
    expect(lines.map(l => l.text)).toEqual([
      'SUB: full quality (legs 100%).',
      'SUPR: full quality (legs 75%).',
      'SPRT: full quality (legs 75%).',
      '6 sessions: good. 1 rest day: good. No red mornings: good.',
      sport.zoneInsight,
    ]);
    expect(lines.map(l => l.day)).toEqual([0, 2, 4, null, null]);
    expect(lines.map(l => l.checks)).toEqual([false, false, false, true, false]);
  });

  it('follows the order the sessions fall on the board, not the card order', () => {
    const lines = debriefLines(content, sport, analyse(content, week('SPRT', 'EASY', 'SUB', 'EASY', 'SUPR', 'EASY', 'REST')));
    expect(lines.slice(0, 3).map(l => l.text.split(':')[0])).toEqual(['SPRT', 'SUB', 'SUPR']);
  });

  it('says so when a key session was never planned, and puts it last', () => {
    const lines = debriefLines(content, sport, analyse(content, week('SPRT', 'EASY', 'SUB', 'EASY', 'EASY', 'EASY', 'REST')));
    expect(lines.slice(0, 3).map(l => l.text)).toEqual([
      'SPRT: full quality (legs 100%).',
      'SUB: full quality (legs 75%).',
      'No SUPR session this week.',
    ]);
    expect(lines[2]!.day).toBeNull();
  });

  it('reports a key session below full quality with its best day\'s legs', () => {
    const lines = debriefLines(content, sport, analyse(content, week('SUB', 'SUPR', 'REST', 'SPRT')));
    expect(lines[1]!.text).toBe('SUPR: legs only 50%, so not full quality.');
    expect(lines[1]!.day).toBe(1);
    expect(lines[0]!.text).toBe('SUB: full quality (legs 100%).');
  });

  it('uses the worthless line when the legs were gone', () => {
    const lines = debriefLines(content, sport, analyse(content, week('SUB', 'SUPR', 'SPRT')));
    expect(lines.map(l => l.text)).toContain('SPRT: legs 30%. Too tired for this to do its job.');
  });

  it('puts the checks in words, naming what failed', () => {
    const sentence = (plan: Session[]) => checksSentence(content, analyse(content, plan));
    expect(sentence(perfect)).toBe('6 sessions: good. 1 rest day: good. No red mornings: good.');
    expect(sentence(week('SUB', 'EASY', 'SUPR', 'EASY', 'REST', 'REST', 'REST'))).toBe(
      '4 sessions: too few. 3 rest days: good. No red mornings: good.',
    );
    expect(sentence(week('EASY', 'EASY', 'EASY', 'EASY', 'EASY', 'EASY', 'EASY'))).toBe(
      '7 sessions: good. 0 rest days: too few. No red mornings: good.',
    );
    expect(sentence(week('EASY', 'EASY', 'EASY', 'REST', 'REST', 'REST', 'AWAY'))).toBe(
      '3 sessions: too few. 4 rest days: too many. No red mornings: good.',
    );
    expect(sentence(week('SUB', 'SUPR', 'REST', 'SPRT', 'REST', 'EASY', 'EASY'))).toBe(
      '5 sessions: good. 2 rest days: good. 1 red morning: not good.',
    );
    expect(sentence(week('SUB', 'SUPR', 'SPRT', 'SUB', 'SUPR', 'SPRT', 'SUB'))).toBe(
      '7 sessions: good. 0 rest days: too few. 5 red mornings: not good.',
    );
  });

  it('marks good and bad news for the sound: full quality and met checks are good, the insight is neither', () => {
    const good = debriefLines(content, sport, analyse(content, perfect));
    expect(good.map(l => l.good)).toEqual([true, true, true, true, null]);
    const bad = debriefLines(content, sport, analyse(content, week('SUB', 'SUPR', 'REST', 'SPRT')));
    // SUB full, SUPR part, SPRT full (legs 80); 4 sessions fails a check
    expect(bad.map(l => l.good)).toEqual([true, false, true, false, null]);
    const missing = debriefLines(content, sport, analyse(content, week('SUB', 'EASY')));
    expect(missing.slice(0, 3).map(l => l.good)).toEqual([true, false, false]);
  });

  it('ends on the insight, verbatim', () => {
    const lines = debriefLines(content, sport, analyse(content, week()));
    expect(lines[lines.length - 1]!.text).toBe(sport.zoneInsight);
  });

  it('stays short enough for a few dialogue pages', () => {
    for (const line of debriefLines(content, sport, analyse(content, week('SUB', 'SUPR', 'SPRT', 'SUB', 'SUPR', 'SPRT', 'SUB')))) {
      expect(wrapText(line.text).length).toBeLessThanOrEqual(8);
    }
  });
});

describe('what screen readers hear', () => {
  const analysis = analyse(content, week('SUB', 'SUPR', 'EASY', 'REST', '--', 'AWAY'));

  it('reads a key day with its legs and its verdict', () => {
    expect(dayAnnouncement(content, sport, 1, sessionFromChip(content, 'SUPR'), analysis)).toBe(
      'Tuesday. Supra-threshold Intervals. Legs 50 percent. Not full quality. Sessions 3 of 5.',
    );
    expect(dayAnnouncement(content, sport, 0, sessionFromChip(content, 'SUB'), analysis)).toBe(
      'Monday. Sub-threshold. Legs 100 percent. Full quality. Sessions 3 of 5.',
    );
  });

  it('says a worthless session is too tired', () => {
    const stacked = analyse(content, week('SUB', 'SUPR', 'SPRT'));
    expect(dayAnnouncement(content, sport, 2, sessionFromChip(content, 'SPRT'), stacked)).toBe(
      'Wednesday. Sprint Training. Legs 30 percent. Too tired. Sessions 3 of 5.',
    );
  });

  it('reads a support day, a rest day, an empty day and the away day', () => {
    expect(dayAnnouncement(content, sport, 2, sessionFromChip(content, 'EASY'), analysis)).toContain('Support session.');
    expect(dayAnnouncement(content, sport, 3, sessionFromChip(content, 'REST'), analysis)).toBe('Thursday. Rest. Legs 75 percent. Sessions 3 of 5.');
    expect(dayAnnouncement(content, sport, 4, sessionFromChip(content, '--'), analysis)).toContain('Nothing planned.');
    expect(dayAnnouncement(content, sport, 5, sessionFromChip(content, 'AWAY'), analysis)).toContain('Saturday. AWAY. No session is possible.');
  });

  it('reads each day of the run, and an empty day as nothing planned, never as dashes', () => {
    const run = (day: number, chip: string) => runDayAnnouncement(content, sport, day, sessionFromChip(content, chip), analysis);
    expect(run(0, 'SUB')).toBe('Monday. Sub-threshold. Full quality.');
    expect(run(1, 'SUPR')).toBe('Tuesday. Supra-threshold Intervals. Not full quality.');
    expect(run(2, 'EASY')).toBe('Wednesday. Easy Running. Support session.');
    expect(run(3, 'REST')).toBe('Thursday. Rest.');
    expect(run(4, '--')).toBe('Friday. Nothing planned.');
    expect(run(5, 'AWAY')).toBe('Saturday. AWAY.');
    for (const chip of ['--', 'REST', 'AWAY', ...content.cards.map(c => c.label)]) expect(run(1, chip)).not.toContain('--');
    const stacked = analyse(content, week('SUB', 'SUPR', 'SPRT'));
    expect(runDayAnnouncement(content, sport, 2, sessionFromChip(content, 'SPRT'), stacked)).toBe('Wednesday. Sprint Training. Too tired.');
  });

  it('reads the GO slot with the week\'s numbers and what is missing', () => {
    expect(goAnnouncement(analysis, [content.cards[3]!])).toBe('Run the week. 3 sessions. 4 rest days. 1 red morning. Missing: Sprint Training.');
    expect(goAnnouncement(analysis, [])).toBe('Run the week. 3 sessions. 4 rest days. 1 red morning.');
    const calm = analyse(content, week('SUB', 'EASY', 'SUPR', 'EASY', 'SPRT', 'EASY', 'REST'));
    expect(goAnnouncement(calm, [])).toBe('Run the week. 6 sessions. 1 rest day. 0 red mornings.');
  });
});
