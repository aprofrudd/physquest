// How each kind of day looks when it is played: a jog, a steady run, reps with rests, sprints, a rest, an away day.
// Presentation only: it decides what the athlete and the INTERVAL board show, never what a session is worth.
import type { TrainingContent } from '../content/types';
import type { Session } from './model';

export type SessionStyle = 'easy' | 'steady' | 'reps' | 'sprints' | 'rest' | 'away' | 'none';

/** What the INTERVAL board shows: no digits, just the phase. */
export type Phase = 'work' | 'rest' | 'steady' | 'off';

const STYLE_BY_LABEL: Readonly<Record<string, SessionStyle>> = {
  EASY: 'easy',
  THR: 'steady',
  SEV: 'reps',
  FAST: 'sprints', // fast reps with full recovery: short bursts and long rests
};

export const styleOf = (content: TrainingContent, session: Session): SessionStyle => {
  switch (session.kind) {
    case 'rest':
      return 'rest';
    case 'away':
      return 'away';
    case 'empty':
      return 'none';
    case 'card': {
      const card = content.cards[session.card];
      if (!card) return 'none';
      return STYLE_BY_LABEL[card.label] ?? (card.role === 'key' ? 'steady' : 'easy');
    }
  }
};

/** Two reps, each a spell of work then a spell of rest. */
const REPS = 2;
const REP_WORK = 0.6;
/** Three sprints: short bursts with long rests between them (full recovery). */
const SPRINTS = 3;
const SPRINT_WORK = 0.3;

/** WORK or REST at point `p` (0-1) through a day, for the styles that have intervals. */
export const phaseAt = (style: SessionStyle, p: number): Phase => {
  switch (style) {
    case 'reps': {
      const within = (p * REPS) % 1;
      return within < REP_WORK ? 'work' : 'rest';
    }
    case 'sprints': {
      const within = (p * SPRINTS) % 1;
      return within < SPRINT_WORK ? 'work' : 'rest';
    }
    case 'easy':
    case 'steady':
      return 'steady';
    default:
      return 'off';
  }
};
