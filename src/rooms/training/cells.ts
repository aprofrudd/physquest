// From the model's plan to what the screens draw: a cell per day, and the ladder of zones. No canvas here.
import type { TrainingContent } from '../content/types';
import { chipLabel, isKey, type Session, type WeekAnalysis } from './model';
import type { CellKind, DayCell } from './look';
import type { Rung } from './widgets';

export const kindOf = (content: TrainingContent, session: Session): CellKind => {
  switch (session.kind) {
    case 'card':
      return isKey(content, session) ? 'key' : 'support';
    case 'rest':
      return 'rest';
    case 'away':
      return 'away';
    case 'empty':
      return 'empty';
  }
};

/** One cell per day for the board and the mini planner (a key session below full quality is flagged). */
export const dayCells = (content: TrainingContent, plan: readonly Session[], analysis: WeekAnalysis): DayCell[] =>
  plan.map((session, day) => ({
    kind: kindOf(content, session),
    label: chipLabel(content, session),
    legs: analysis.legs[day] ?? 0,
    flagged: (analysis.quality[day] ?? 1) < 1,
  }));

/**
 * The zones as a ladder, the easiest rung first: support cards (the easy running), then the key cards in card
 * order. Presentation only: it fixes how the ZONES screen stacks its bars.
 */
export const ladderOrder = (content: TrainingContent): number[] => {
  const indices = content.cards.map((_, i) => i);
  return [...indices.filter(i => content.cards[i]?.role === 'support'), ...indices.filter(i => content.cards[i]?.role === 'key')];
};

export const ladderRungs = (content: TrainingContent): Rung[] =>
  ladderOrder(content).map(i => (content.cards[i]?.role === 'key' ? 'key' : 'support'));
