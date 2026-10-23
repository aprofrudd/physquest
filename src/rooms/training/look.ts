// How the Training Floor looks: the colours its screens and chips use (the track palette's greens and orange,
// plus the shared ink, paper and meaning colours), and the day cells the board and the wall screens draw.
// Colour never carries a meaning alone: every use here is paired with a label, a number or a mark.
import { PALETTES } from '../../render/Palettes';
import { COLORS } from '../frame';

const TRACK = PALETTES.track.colors;

export const LOOK = {
  ink: COLORS.ink,
  inkSoft: COLORS.inkSoft,
  paper: COLORS.paper,
  outline: TRACK[0],
  darkGreen: TRACK[1],
  midGreen: TRACK[2],
  lightGreen: TRACK[3],
  floor: TRACK[4],
  orange: TRACK[5],
  orangeLight: '#f0a060',
  orangeTint: '#ffe8d0',
  gold: COLORS.gold,
  good: COLORS.good,
  /** Legs between the two lines: not full quality, not worthless. */
  warn: '#d8a020',
  warnInk: '#9a6a00',
  bad: COLORS.bad,
  grey: '#98a090',
  greyInk: '#586050',
  restFill: '#e0e8d8',
  awayFill: '#767e76',
  awayHatch: '#5a625a',
  /** Wall screens: dark glass with bright traces. */
  glass: '#10281c',
  glassGrid: '#1c4a30',
  trace: '#a0f0a8',
  ledGreen: '#58e060',
  ledAmber: '#ffb030',
  ledRed: '#ff6050',
  ledOff: '#3a5a48',
  lcd: '#14201a',
} as const;

/** What kind of day a cell is (the board's colours and the mini planner's). */
export type CellKind = 'key' | 'support' | 'rest' | 'away' | 'empty';

/** How a morning's legs read: full-quality, in between, or low. */
export type LegsTone = 'good' | 'warn' | 'bad';

/** The two lines the screens colour a morning's legs by. */
export interface LegsLines {
  /** At or above this a key session is at full quality. */
  fullAt: number;
  /** Below this the morning is a red morning (the number turns red, and the RED check counts it). */
  redBelow: number;
}

export const legsTone = (legs: number, lines: LegsLines): LegsTone =>
  legs >= lines.fullAt ? 'good' : legs < lines.redBelow ? 'bad' : 'warn';

export const toneFill = (tone: LegsTone): string => (tone === 'good' ? LOOK.good : tone === 'warn' ? LOOK.warn : LOOK.bad);

/** Colour for a legs number's digits on paper: the amber is darkened so it reads. */
export const toneInk = (tone: LegsTone): string => (tone === 'good' ? LOOK.inkSoft : tone === 'warn' ? LOOK.warnInk : LOOK.bad);

/** One day as the board and the mini planner draw it. */
export interface DayCell {
  kind: CellKind;
  /** The chip text: a card's label, REST, the away label or --. */
  label: string;
  /** The morning's legs, 0-100. */
  legs: number;
  /** A key session that will not be at full quality. */
  flagged: boolean;
}
