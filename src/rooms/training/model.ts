// The Hard-Easy Week rules, with no DOM and no canvas: what a plan does to the athlete's legs, how good
// each key session is, and the score. Every constant comes from the level's TrainingContent (running.ts).
import type { TrainingContent, WeekCard } from '../content/types';

export const DAY_COUNT = 7;
export const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;
export const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;

/** What is planned for one day. A card is an index into content.cards. */
export type Session =
  | { readonly kind: 'empty' }
  | { readonly kind: 'rest' }
  | { readonly kind: 'away' }
  | { readonly kind: 'card'; readonly card: number };

export const EMPTY: Session = { kind: 'empty' };
export const REST: Session = { kind: 'rest' };
export const AWAY: Session = { kind: 'away' };
export const cardSession = (card: number): Session => ({ kind: 'card', card });

export const sameSession = (a: Session, b: Session): boolean =>
  a.kind === b.kind && (a.kind !== 'card' || (b.kind === 'card' && a.card === b.card));

/** The card behind a day's session, or undefined for rest, away and empty days. */
export const cardOf = (content: TrainingContent, session: Session): WeekCard | undefined =>
  session.kind === 'card' ? content.cards[session.card] : undefined;

export const isKey = (content: TrainingContent, session: Session): boolean => cardOf(content, session)?.role === 'key';
export const isSupport = (content: TrainingContent, session: Session): boolean => cardOf(content, session)?.role === 'support';

/** Indices (into content.cards) of the key cards, in card order. */
export const keyCardIndices = (content: TrainingContent): number[] =>
  content.cards.flatMap((card, i) => (card.role === 'key' ? [i] : []));

/**
 * The score's own constants: the room's scoring rule, not physiology (every number about legs, sessions and rest
 * comes from the level's content). A week's data quality starts at BASE_QUALITY and gains up to STRUCTURE_BONUS for a
 * well-built week, but only when the key sessions did something (stimulus above STIMULUS_GATE). Each red morning
 * takes RED_MORNING_COST off the red check's share of the structure mark.
 */
const BASE_QUALITY = 0.5;
const STRUCTURE_BONUS = 0.4;
const STIMULUS_GATE = 0.5;
const RED_MORNING_COST = 0.5;

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/** Fill {name} gaps in a content line. Unknown names are left as they are. */
export const fillLine = (text: string, values: Readonly<Record<string, string | number>>): string =>
  text.replace(/\{(\w+)\}/g, (gap, name: string) => (name in values ? String(values[name]) : gap));

/** How a key session turns out at a given morning's legs. */
export type QualityBand = 'full' | 'part' | 'none';

export const qualityOf = (content: TrainingContent, legs: number): number => {
  const { fullAt, noneAt } = content.legs;
  return clamp((legs - noneAt) / (fullAt - noneAt), 0, 1);
};

export const bandOf = (content: TrainingContent, legs: number): QualityBand =>
  legs >= content.legs.fullAt ? 'full' : legs <= content.legs.noneAt ? 'none' : 'part';

/** The content line for a key session at `legs` (its {label} and {legs} filled in). */
export const qualityLine = (content: TrainingContent, card: WeekCard, legs: number): string => {
  const band = bandOf(content, legs);
  const text = band === 'full' ? content.fullQuality : band === 'part' ? content.partQuality : content.noQuality;
  return fillLine(text, { label: card.label, legs });
};

/** Morning legs (0-100) for every day of a plan. Monday starts fresh. */
export const legsFor = (content: TrainingContent, plan: readonly Session[]): number[] => {
  const { keyNextDay, keyTwoDays, supportNextDay } = content.legs;
  return plan.map((_, d) => {
    const yesterday = plan[d - 1];
    const before = plan[d - 2];
    let legs = 100;
    if (yesterday && isKey(content, yesterday)) legs -= keyNextDay;
    if (before && isKey(content, before)) legs -= keyTwoDays;
    if (yesterday && isSupport(content, yesterday)) legs -= supportNextDay;
    return clamp(legs, 0, 100);
  });
};

/** How one key card fared this week. */
export interface KeyResult {
  /** Index into content.cards. */
  card: number;
  /** Best quality (0-1) over the days it was placed; 0 when it was never placed. */
  best: number;
  /** The day of that best session (the one with the most legs; the earliest on a tie), or null if never placed. */
  day: number | null;
  /** The morning's legs on that day, or null if never placed. */
  legs: number | null;
}

export interface CheckResults {
  sessions: boolean;
  rest: boolean;
  red: boolean;
}

export interface WeekAnalysis {
  /** Morning legs per day. */
  legs: number[];
  /** Quality (0-1) of the key session on each day, null where the day has none. */
  quality: (number | null)[];
  /** One entry per key card, in card order. */
  keys: KeyResult[];
  /** Key and support sessions in the week. */
  sessions: number;
  /** Days with REST, AWAY or nothing planned. */
  restDays: number;
  /** Mornings with legs below the red line. */
  redMornings: number;
  /** Mean of the key cards' best quality. */
  stimulus: number;
  /** Mean of the three structure checks (0-1). */
  structure: number;
  /** What the board's tick or cross says for each check. */
  checks: CheckResults;
  dataQuality: number;
  variableAccuracy: number;
}

/** Everything a plan means: legs, qualities, the checks and the score. */
export const analyse = (content: TrainingContent, plan: readonly Session[]): WeekAnalysis => {
  const legs = legsFor(content, plan);
  const quality = plan.map((session, d) => (isKey(content, session) ? qualityOf(content, legs[d] ?? 0) : null));

  const keys: KeyResult[] = keyCardIndices(content).map(card => {
    const result: KeyResult = { card, best: 0, day: null, legs: null };
    plan.forEach((session, d) => {
      if (session.kind !== 'card' || session.card !== card) return;
      const dayLegs = legs[d] ?? 0;
      if (result.legs === null || dayLegs > result.legs) {
        result.legs = dayLegs;
        result.day = d;
        result.best = qualityOf(content, dayLegs);
      }
    });
    return result;
  });

  const sessions = plan.filter(s => isKey(content, s) || isSupport(content, s)).length;
  const restDays = plan.length - sessions;
  const redMornings = legs.filter(l => l < content.checks.redBelow).length;

  const stimulus = keys.length === 0 ? 0 : keys.reduce((sum, k) => sum + k.best, 0) / keys.length;
  const sessionsOk = sessions >= content.checks.minSessions;
  const restOk = restDays >= content.checks.minRest && restDays <= content.checks.maxRest;
  const redTerm = Math.max(0, 1 - RED_MORNING_COST * redMornings);
  const structure = ((sessionsOk ? 1 : 0) + (restOk ? 1 : 0) + redTerm) / 3;

  return {
    legs,
    quality,
    keys,
    sessions,
    restDays,
    redMornings,
    stimulus,
    structure,
    checks: { sessions: sessionsOk, rest: restOk, red: redMornings === 0 },
    dataQuality: stimulus > STIMULUS_GATE ? BASE_QUALITY + STRUCTURE_BONUS * structure : BASE_QUALITY,
    variableAccuracy: stimulus,
  };
};

/** Key cards with no session in the plan yet, in card order. */
export const missingKeys = (content: TrainingContent, plan: readonly Session[]): WeekCard[] =>
  keyCardIndices(content).flatMap(i => {
    const card = content.cards[i];
    return card && !plan.some(s => s.kind === 'card' && s.card === i) ? [card] : [];
  });

/** The label a day's chip shows: a card's label, REST, the away label, or -- for nothing planned. */
export const chipLabel = (content: TrainingContent, session: Session): string => {
  switch (session.kind) {
    case 'card':
      return content.cards[session.card]?.label ?? '--';
    case 'rest':
      return 'REST';
    case 'away':
      return content.awayLabel;
    case 'empty':
      return '--';
  }
};

/** The session a chip text stands for: the inverse of chipLabel (a card's label, REST, the away label or --). */
export const sessionFromChip = (content: TrainingContent, text: string): Session => {
  if (text === 'REST') return REST;
  if (text === content.awayLabel) return AWAY;
  const card = content.cards.findIndex(c => c.label === text);
  return card >= 0 ? cardSession(card) : EMPTY;
};

/** Pick the away day (TUE, WED or THU) for an attempt, or null when the level has none. */
export const pickAway = (content: TrainingContent, rng: () => number): number | null =>
  content.awayDay ? 1 + Math.min(2, Math.floor(rng() * 3)) : null;

/** Fisher-Yates: a fresh order of the card indices for an attempt. */
export const shuffledCards = (content: TrainingContent, rng: () => number): number[] => {
  const order = content.cards.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(rng() * (i + 1)));
    const swap = order[i] as number;
    order[i] = order[j] as number;
    order[j] = swap;
  }
  return order;
};

/** The first part of a zone's name, before its bracket ("Sub-threshold (LT1-LT2 pace)" -> "Sub-threshold"). */
export const shortZone = (zone: string): string => zone.split(' (')[0] ?? zone;
