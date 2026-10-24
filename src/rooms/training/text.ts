// Every sentence the room says, built from the level's content and the plan. Pure strings: the content files
// supply the physiology wording (used as written, with {label} and {legs} filled in); this file only adds
// plain UI words (day names, "Legs 50% this morning.", the good / too few verdicts).
import type { SportData } from '../../data/sports';
import type { TrainingContent, WeekCard } from '../content/types';
import { wrapText } from '../../render/DialogueBox';
import {
  DAYS,
  DAY_NAMES,
  bandOf,
  cardOf,
  qualityLine,
  shortZone,
  type QualityBand,
  type Session,
  type WeekAnalysis,
} from './model';

export type Tone = 'ink' | 'good' | 'warn' | 'bad';

/** One wrapped line of the prompt box, with the colour its words take. */
export interface PromptLine {
  text: string;
  tone: Tone;
}

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/** The zone's name as sports.ts spells it. */
export const zoneName = (sport: SportData, card: WeekCard): string =>
  sport.zones.find(z => z.name === card.zone)?.name ?? card.zone;

const TONE_BY_BAND: Readonly<Record<QualityBand, Tone>> = { full: 'good', part: 'warn', none: 'bad' };

const lines = (text: string, tone: Tone, fill: (text: string) => string): PromptLine[] =>
  wrapText(fill(text)).map(line => ({ text: line, tone }));

/**
 * The prompt box for a day, at most four lines of 38 characters: the day and its zone (name and target, from
 * the content), then what the legs mean for it. `fill` names the buttons for the player's device. `running` is
 * the week being played: nothing can be picked then, so an empty day does not say how to pick a session.
 */
export const dayPrompt = (
  content: TrainingContent,
  sport: SportData,
  day: number,
  session: Session,
  legs: number,
  fill: (text: string) => string = text => text,
  running = false,
): PromptLine[] => {
  const dayName = DAYS[day] ?? '';
  const card = cardOf(content, session);
  if (card) {
    const head = lines(`${dayName}: ${zoneName(sport, card)}, ${card.target}`, 'ink', fill);
    if (card.role === 'support') return [...head, ...lines(content.supportNote, 'ink', fill)];
    return [...head, ...lines(qualityLine(content, card, legs), TONE_BY_BAND[bandOf(content, legs)], fill)];
  }
  const legsLine = `Legs ${legs}% this morning.`;
  switch (session.kind) {
    case 'rest':
      return [...lines(`${dayName}: REST`, 'ink', fill), ...lines(legsLine, 'ink', fill)];
    case 'away':
      return [
        ...lines(`${dayName}: ${content.awayLabel}`, 'ink', fill),
        ...lines('No session is possible this day.', 'ink', fill),
        ...lines(legsLine, 'ink', fill),
      ];
    default:
      return [
        ...lines(`${dayName}: NO SESSION`, 'ink', fill),
        ...lines(running ? 'Nothing planned.' : 'Press {UP} or {DOWN} to pick a session.', 'ink', fill),
        ...lines(legsLine, 'ink', fill),
      ];
  }
};

/** The GO slot's prompt: what the week adds up to, and any key session still missing. */
export const goPrompt = (
  analysis: WeekAnalysis,
  missing: readonly WeekCard[],
  fill: (text: string) => string = text => text,
): PromptLine[] => {
  const out = lines('Ready to run the week?', 'ink', fill);
  if (missing.length > 0) {
    out.push(...lines(missing.map(c => `No ${c.label} session yet.`).join(' '), 'warn', fill));
  } else {
    out.push(...lines(`${plural(analysis.sessions, 'session', 'sessions')}, ${plural(analysis.restDays, 'rest day', 'rest days')}.`, 'ink', fill));
  }
  return out;
};

/** The question when A is pressed on GO: any missing key session is named first. */
// Sessions are named in full here: the box is also read aloud, and a screen reader cannot say SPRT or SUPR
export const runQuestion = (missing: readonly WeekCard[]): string =>
  [...missing.map(c => `No ${shortZone(c.zone)} session yet.`), 'Run the week?'].join(' ');

/** The footer's three checks, as the board shows them. */
export interface CheckLine {
  text: string;
  ok: boolean;
}

export const checkLines = (content: TrainingContent, analysis: WeekAnalysis): [CheckLine, CheckLine, CheckLine] => [
  { text: `SESSIONS ${analysis.sessions}/${content.checks.minSessions}`, ok: analysis.checks.sessions },
  { text: `REST ${analysis.restDays}`, ok: analysis.checks.rest },
  { text: `RED ${analysis.redMornings}`, ok: analysis.checks.red },
];

/** The three checks in words, for the debrief: "5 sessions: good. 2 rest days: good. No red mornings: good." */
export const checksSentence = (content: TrainingContent, analysis: WeekAnalysis): string => {
  const { sessions, restDays, redMornings, checks } = analysis;
  const sessionsPart = `${plural(sessions, 'session', 'sessions')}: ${checks.sessions ? 'good' : 'too few'}.`;
  const restVerdict = checks.rest ? 'good' : restDays < content.checks.minRest ? 'too few' : 'too many';
  const restPart = `${plural(restDays, 'rest day', 'rest days')}: ${restVerdict}.`;
  const redPart = redMornings === 0 ? 'No red mornings: good.' : `${plural(redMornings, 'red morning', 'red mornings')}: not good.`;
  return `${sessionsPart} ${restPart} ${redPart}`;
};

/** One line of the debrief, and what the board should point at while it is said. */
export interface DebriefLine {
  text: string;
  /** A day to ring on the board, or null. */
  day: number | null;
  /** The checks footer is what is being talked about. */
  checks: boolean;
  /** Good news (a full-quality session, every check met) or bad, for the sound; null for the insight. */
  good: boolean | null;
}

/**
 * The debrief: each key card's line for its best day (in the order they fall on the board, cards never placed
 * last), then the three checks in words, then the zone insight from sports.ts.
 */
export const debriefLines = (content: TrainingContent, sport: SportData, analysis: WeekAnalysis): DebriefLine[] => {
  const placed = analysis.keys.filter(k => k.day !== null).sort((a, b) => (a.day ?? 0) - (b.day ?? 0));
  const unplaced = analysis.keys.filter(k => k.day === null);
  const out: DebriefLine[] = [];
  for (const key of [...placed, ...unplaced]) {
    const card = content.cards[key.card];
    if (!card) continue;
    out.push({
      text: key.legs === null ? `No ${card.label} session this week.` : qualityLine(content, card, key.legs),
      day: key.day,
      checks: false,
      good: key.legs !== null && bandOf(content, key.legs) === 'full',
    });
  }
  const { sessions, rest, red } = analysis.checks;
  out.push({ text: checksSentence(content, analysis), day: null, checks: true, good: sessions && rest && red });
  out.push({ text: sport.zoneInsight, day: null, checks: false, good: null });
  return out;
};

/** What a screen reader hears when the cursor rests on a day: "Tuesday. Sub-threshold. Legs 50 percent. Not full quality. Sessions 4 of 5." */
export const dayAnnouncement = (
  content: TrainingContent,
  sport: SportData,
  day: number,
  session: Session,
  analysis: WeekAnalysis,
): string => {
  const dayName = DAY_NAMES[day] ?? '';
  const legs = analysis.legs[day] ?? 0;
  const tail = `Sessions ${analysis.sessions} of ${content.checks.minSessions}.`;
  const card = cardOf(content, session);
  if (card) {
    const name = shortZone(zoneName(sport, card));
    if (card.role === 'support') return `${dayName}. ${name}. Legs ${legs} percent. Support session. ${tail}`;
    const band = bandOf(content, legs);
    const verdict = band === 'full' ? 'Full quality.' : band === 'part' ? 'Not full quality.' : 'Too tired.';
    return `${dayName}. ${name}. Legs ${legs} percent. ${verdict} ${tail}`;
  }
  switch (session.kind) {
    case 'rest':
      return `${dayName}. Rest. Legs ${legs} percent. ${tail}`;
    case 'away':
      return `${dayName}. ${content.awayLabel}. No session is possible. Legs ${legs} percent. ${tail}`;
    default:
      return `${dayName}. Nothing planned. Legs ${legs} percent. ${tail}`;
  }
};

/** What a screen reader hears as the run reaches a day: the plan's session for it, and how it went if it was a key session. */
export const runDayAnnouncement = (
  content: TrainingContent,
  sport: SportData,
  day: number,
  session: Session,
  analysis: WeekAnalysis,
): string => {
  const dayName = DAY_NAMES[day] ?? '';
  const card = cardOf(content, session);
  if (card) {
    const quality = analysis.quality[day];
    const verdict =
      quality === null || quality === undefined ? ' Support session.' : quality >= 1 ? ' Full quality.' : quality > 0 ? ' Not full quality.' : ' Too tired.';
    return `${dayName}. ${shortZone(zoneName(sport, card))}.${verdict}`;
  }
  switch (session.kind) {
    case 'rest':
      return `${dayName}. Rest.`;
    case 'away':
      return `${dayName}. ${content.awayLabel}.`;
    default:
      return `${dayName}. Nothing planned.`;
  }
};

/** What a screen reader hears for the GO slot. */
export const goAnnouncement = (analysis: WeekAnalysis, missing: readonly WeekCard[]): string => {
  const gaps = missing.length > 0 ? ` Missing: ${missing.map(c => shortZone(c.zone)).join(', ')}.` : '';
  const { sessions, restDays, redMornings } = analysis;
  return `Run the week. ${plural(sessions, 'session', 'sessions')}. ${plural(restDays, 'rest day', 'rest days')}. ${plural(redMornings, 'red morning', 'red mornings')}.${gaps}`;
};
