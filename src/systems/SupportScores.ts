// The four support scores: what the player sees for the stats each room records. The save keeps the original keys
// (speed, strength, endurance, power: see PlayerStats), but none of them describes the athlete: each one grades the
// player's own work in one room, so that is how they are named on screen.
//
// The showdown also lives here: which score is the level's focus (70% of the rating, see showdownRating), which bout
// is played (still the sport's bossStat), and the rival's TARGET, so the hub's SUPPORT BOARD and the arena agree.
import { LEVEL_DATA } from '../data/sports';
import { MINIGAME_FOR_STAT, rivalFinalScore, type MinigameType } from './BossMinigame';
import {
  ROOM_KEYS,
  ROOM_LABEL,
  ROOM_STAT,
  showdownRating,
  type GameState,
  type RoomKey,
  type StatKey,
} from '../state/GameState';

/** On-screen name of each score (the room that records it is ROOM_LABEL of statRoom). */
export const SCORE_LABEL: Readonly<Record<StatKey, string>> = {
  speed: 'TEST CHOICE', // TESTING
  strength: 'DATA INSIGHT', // DATA
  endurance: 'TRAINING PLAN', // TRAINING
  power: 'EVALUATION', // ANALYSIS
};

/** Four-letter form, for tight spots (the board, the arena's comparison rows). */
export const SCORE_SHORT: Readonly<Record<StatKey, string>> = {
  speed: 'TEST',
  strength: 'DATA',
  endurance: 'PLAN',
  power: 'EVAL',
};

/** Spoken name of each score, for screen readers ("test choice score"). */
export const scoreSpoken = (stat: StatKey): string => `${SCORE_LABEL[stat].toLowerCase()} score`;

const STAT_ROOM = Object.fromEntries(ROOM_KEYS.map(k => [ROOM_STAT[k], k])) as Readonly<Record<StatKey, RoomKey>>;

/** The room that records a score (a lookup: the wall board asks every frame). */
export const statRoom = (stat: StatKey): RoomKey => STAT_ROOM[stat];

/**
 * The score that decides each sport's bout, where it is not the classic one (the sport's bossStat, relabelled).
 * Distance Running's bout is the RACE TO THE LINE: the plan from the TRAINING room decides how much D' (her KICK
 * gauge) and finishing speed Aisha brings to the race, not the ANALYSIS room's judgement of the change. See
 * docs/rooms.md.
 */
const FOCUS_ROOM: Readonly<Record<string, RoomKey>> = {
  'Distance Running': 'trainingPrescription',
};

/** The bout's stat: how strong the rival is, and the classic levels' minigame (MINIGAME_FOR_STAT). */
export const boutStat = (level: number): StatKey => LEVEL_DATA[level]?.bossStat ?? 'speed';

/** Sports with a bout of their own; the others play their bossStat's classic minigame. */
const BOUT_FOR_SPORT: Readonly<Record<string, MinigameType>> = {
  'Distance Running': 'race',
};

/** The minigame the level's showdown plays. */
export const boutType = (level: number): MinigameType =>
  BOUT_FOR_SPORT[LEVEL_DATA[level]?.sport ?? ''] ?? MINIGAME_FOR_STAT[boutStat(level)];

/** The level's focus score: 70% of the showdown rating. */
export const showdownFocus = (level: number): StatKey => {
  const room = FOCUS_ROOM[LEVEL_DATA[level]?.sport ?? ''];
  return room ? ROOM_STAT[room] : boutStat(level);
};

/** The player's showdown rating for the level being played. */
export const levelRating = (state: GameState): number =>
  showdownRating(state.playerStats, showdownFocus(state.currentLevel));

/** Rival ceilings scale with the level; the strength and power bouts get a small bonus. */
export const rivalCeilingFor = (level: number, stat: StatKey): number => {
  const base = 0.4 + level * 0.1;
  return stat === 'strength' || stat === 'power' ? base + 0.05 : base;
};

/** The rival's TARGET for the level: their final score in the level's bout, the number the arena shows. */
export const showdownTarget = (level: number): number => {
  return rivalFinalScore(boutType(level), rivalCeilingFor(level, boutStat(level)));
};

/** "TRAINING room", the room to replay to raise a score. */
export const roomOfScore = (stat: StatKey): string => ROOM_LABEL[statRoom(stat)];
