import { LEVEL_DATA } from '../data/sports';

export interface PlayerStats {
  speed: number;
  strength: number;
  endurance: number;
  power: number;
}

export type StatKey = keyof PlayerStats;

export interface RoomProgress {
  testSelection: boolean;
  variableId: boolean;
  trainingPrescription: boolean;
  performancePrediction: boolean;
}

export type RoomKey = keyof RoomProgress;

export interface ChallengeResult {
  dataQuality: number; // 0-1
  variableAccuracy: number; // 0-1
}

/** Room progress + stats for a level that has been started but not yet won. */
export interface LevelProgress {
  roomProgress: RoomProgress;
  playerStats: PlayerStats;
}

/** Hub doors the player can leave through; used to put them back outside the same door. */
export type HubDoor = 'room1' | 'room2' | 'room3' | 'room4' | 'boss';

/** Every hub door, with the ATHLETE room's (only in levels that have one: see GameState.meetRoom). */
export type HubExit = HubDoor | 'meet';

/** Map id (and hub door) of the ATHLETE room, where the player first meets the level's athlete. */
export const MEET_MAP = 'meet';

/** Hub sign label of the ATHLETE room. */
export const MEET_LABEL = 'ATHLETE';

/**
 * The Performance Director's welcome and the first meeting with the athlete, per level. Kept when the level is won
 * (the athlete has been met), saved with the game. It never feeds the stats or the showdown rating.
 */
export interface MeetProgress {
  /** The Director's welcome has been given (it starts by itself on the first hub entry until then). */
  welcomed: boolean;
  /** The ATHLETE room has been finished at least once: the TESTING room is open. */
  met: boolean;
  /** Best number of good questions asked in one visit, out of `of`. */
  best: number;
  /** How many questions a visit allowed when `best` was set (0 until the room is finished). */
  of: number;
  /** The needs chat with the Director has been read to the end: the TESTING room is open. */
  needs: boolean;
  /**
   * The Director's check-in after each room has been heard to the end: the room after it (or the ARENA) is open.
   * Cleared with the room progress when the level is won.
   */
  heard: RoomProgress;
  /**
   * The Testing Lab's last finished battery, for its check-in and the Data Lab's files: the tests' names in sports.ts
   * (empty before any) and the test-day call.
   */
  tests: string[];
  call: TestCall | '';
}

/** How the Testing Lab's test-day call went: the right one, ran on a day to re-book, or re-booked a ready athlete. */
export type TestCall = 'right' | 'ranAnyway' | 'needlessRebook';

/** What the Director has to say before the next room opens: the needs chat, or the check-in after a room. */
export type CheckInKey = 'needs' | RoomKey;

export interface GameState {
  playerName: string;
  /** The player's look (index into PLAYER_LOOKS), picked after name entry. */
  playerLook: number;
  currentLevel: number; // 0-3
  maxLevelUnlocked: number;
  // Active level (the one currently being played)
  playerStats: PlayerStats;
  roomProgress: RoomProgress;
  challengeResults: ChallengeResult[];
  // Unfinished levels, by level index (null = not started or already won)
  levelProgress: (LevelProgress | null)[];
  returnDoor: HubExit | null;
  /** The player left a room challenge with B: the overworld keeps them in that room, where they stood. */
  resumeRoom: boolean;
  playerPos: { x: number; y: number };
  playerDir: 'up' | 'down' | 'left' | 'right';
  playerMoving: boolean;
  bossDefeated: boolean[];
  gameComplete: boolean;
  /** The Director's welcome and the athlete meeting, by level index. */
  meet: MeetProgress[];
  /**
   * The current visit to this level has the ATHLETE room (and the Performance Director in the hub): set when the
   * level starts, from the redesigned rooms (see rooms/loader.ts meetRoomFor). Not saved. Off, every level plays
   * exactly as before.
   */
  meetRoom: boolean;
}

export const ROOM_KEYS: readonly RoomKey[] = ['testSelection', 'variableId', 'trainingPrescription', 'performancePrediction'];

export const STAT_KEYS: readonly StatKey[] = ['speed', 'strength', 'endurance', 'power'];

/** Which stat each room awards */
export const ROOM_STAT: Record<RoomKey, StatKey> = {
  testSelection: 'speed',
  variableId: 'strength',
  trainingPrescription: 'endurance',
  performancePrediction: 'power',
};

/** Hub sign label for each room */
export const ROOM_LABEL: Record<RoomKey, string> = {
  testSelection: 'TESTING',
  variableId: 'DATA',
  trainingPrescription: 'TRAINING',
  performancePrediction: 'ANALYSIS',
};

/** Map id of each room */
export const ROOM_MAP: Record<RoomKey, 'room1' | 'room2' | 'room3' | 'room4'> = {
  testSelection: 'room1',
  variableId: 'room2',
  trainingPrescription: 'room3',
  performancePrediction: 'room4',
};

export const roomKeyForMap = (mapId: string): RoomKey | null =>
  ROOM_KEYS.find(k => ROOM_MAP[k] === mapId) ?? null;

export const freshRoomProgress = (): RoomProgress => ({
  testSelection: false,
  variableId: false,
  trainingPrescription: false,
  performancePrediction: false,
});

export const freshStats = (): PlayerStats => ({ speed: 0, strength: 0, endurance: 0, power: 0 });

export const freshMeet = (): MeetProgress => ({
  welcomed: false,
  met: false,
  best: 0,
  of: 0,
  needs: false,
  heard: freshRoomProgress(),
  tests: [],
  call: '',
});

export const createInitialState = (): GameState => ({
  playerName: '',
  playerLook: 0,
  currentLevel: 0,
  maxLevelUnlocked: 0,
  playerStats: freshStats(),
  roomProgress: freshRoomProgress(),
  challengeResults: [],
  levelProgress: [null, null, null, null],
  returnDoor: null,
  resumeRoom: false,
  playerPos: { x: 7, y: 8 }, // starting tile
  playerDir: 'down',
  playerMoving: false,
  bossDefeated: [false, false, false, false],
  gameComplete: false,
  meet: [freshMeet(), freshMeet(), freshMeet(), freshMeet()],
  meetRoom: false,
});

/** Reset to a brand-new game in place (scenes hold a reference to this object). */
export const resetGameState = (state: GameState): void => {
  Object.assign(state, createInitialState());
};

/** The active level's welcome and meeting (created if missing). */
export const meetOf = (state: GameState): MeetProgress => {
  const level = state.currentLevel;
  let meet = state.meet[level];
  if (!meet) {
    meet = freshMeet();
    state.meet[level] = meet;
  }
  return meet;
};

/** The ATHLETE room is done, or this visit has none. */
export const athleteMet = (state: GameState): boolean => !state.meetRoom || meetOf(state).met;

/** How many hub rooms this visit has: the four, plus the ATHLETE room when there is one. */
export const roomsTotal = (state: GameState): number => ROOM_KEYS.length + (state.meetRoom ? 1 : 0);

/** Hub rooms done (the ATHLETE room counts when this visit has it). */
export const roomsCompleted = (state: GameState): number =>
  ROOM_KEYS.filter(k => state.roomProgress[k]).length + (state.meetRoom && meetOf(state).met ? 1 : 0);

/** Every hub room is done: the arena is open. */
export const allRoomsComplete = (state: GameState): boolean => roomsCompleted(state) === roomsTotal(state);

/**
 * What the Performance Director must say before the next room opens, in a visit with the ATHLETE room: the needs
 * chat once the athlete is met, then the check-in after the first completion of each room. Null when nothing is due
 * (and always in a visit without the ATHLETE room).
 */
export const checkInDue = (state: GameState): CheckInKey | null => {
  if (!state.meetRoom) return null;
  const meet = meetOf(state);
  if (!meet.met) return null;
  if (!meet.needs) return 'needs';
  return ROOM_KEYS.find(k => state.roomProgress[k] && !meet.heard[k]) ?? null;
};

/** Tests (by name in sports.ts) of `level` that give the Data Lab a file: the ones sports.ts marks correct. */
export const testGivesFile = (level: number, test: string): boolean =>
  LEVEL_DATA[level]?.tests.some(t => t.name === test && t.correct) ?? false;

/**
 * In a visit with the ATHLETE room: the Testing Lab's last battery gave the Data Lab no file (no test in it that
 * gives one), so DATA stays shut and the player goes back to TESTING. False before any battery is recorded.
 */
export const retestDue = (state: GameState): boolean => {
  if (!state.meetRoom || !state.roomProgress.testSelection) return false;
  const tests = meetOf(state).tests;
  return tests.length > 0 && !tests.some(t => testGivesFile(state.currentLevel, t));
};

/** The room before `key` in order has been talked over with the Director (always true without the ATHLETE room). */
const talkedOver = (state: GameState, key: RoomKey): boolean => {
  if (!state.meetRoom) return true;
  const meet = meetOf(state);
  const prev = ROOM_KEYS[ROOM_KEYS.indexOf(key) - 1];
  return prev ? meet.heard[prev] : meet.needs;
};

/**
 * Rooms are taken in order (ATHLETE when the visit has it, then TESTING, DATA, TRAINING, ANALYSIS): a room is open
 * once the room before it is done, and in a visit with the ATHLETE room once the Director has talked it over (the
 * needs chat before TESTING, a check-in before each later room). A finished room always stays open for replays.
 */
export const roomUnlocked = (state: GameState, key: RoomKey): boolean => {
  const i = ROOM_KEYS.indexOf(key);
  const prev = ROOM_KEYS[i - 1];
  if (key === 'variableId' && retestDue(state)) return false; // no file to work on: even a finished DATA room waits
  if (state.roomProgress[key]) return true;
  if (i <= 0) return athleteMet(state) && talkedOver(state, key);
  return prev !== undefined && state.roomProgress[prev] && talkedOver(state, key);
};

/** The room before `key` is done, but it stays shut until the Director's check-in (or the needs chat) is heard. */
export const waitingOnDirector = (state: GameState, key: RoomKey): boolean => {
  if (roomUnlocked(state, key)) return false;
  if (key === 'variableId' && retestDue(state)) return checkInDue(state) !== null; // after the check-in: re-test
  const prev = ROOM_KEYS[ROOM_KEYS.indexOf(key) - 1];
  return prev ? state.roomProgress[prev] : athleteMet(state);
};

/** Every room is done and talked over: the arena doors open. */
export const arenaOpen = (state: GameState): boolean =>
  allRoomsComplete(state) && (!state.meetRoom || meetOf(state).heard.performancePrediction) && !retestDue(state);

/** The next of the four rooms to do, in order (TESTING again while a re-test is due), or null when all four are done (see nextDoor for the ATHLETE room). */
export const nextRoom = (state: GameState): RoomKey | null =>
  retestDue(state) ? 'testSelection' : (ROOM_KEYS.find(k => !state.roomProgress[k]) ?? null);

/** The hub door to go to next: the ATHLETE room until the athlete is met, then the next room, then the arena. */
export const nextDoor = (state: GameState): HubExit => {
  if (!athleteMet(state)) return 'meet';
  const next = nextRoom(state);
  return next ? ROOM_MAP[next] : 'boss';
};

/** Where to go next in the hub: the Director while a check-in is due, else the next door (see nextDoor). */
export const nextStop = (state: GameState): HubExit | 'director' => (checkInDue(state) ? 'director' : nextDoor(state));

/** The room that comes after `key` in order, as its hub sign ('ARENA' after the last). */
export const labelAfter = (key: RoomKey): string => {
  const next = ROOM_KEYS[ROOM_KEYS.indexOf(key) + 1];
  return next ? ROOM_LABEL[next] : 'ARENA';
};

/** The sign label of a hub door ('ARENA' for the arena). */
export const doorLabel = (door: HubExit): string => {
  if (door === 'meet') return MEET_LABEL;
  if (door === 'boss') return 'ARENA';
  const key = roomKeyForMap(door);
  return key ? ROOM_LABEL[key] : 'ARENA';
};

/** Copy the active level's progress into levelProgress (null if no room has been completed yet). */
export const stashLevel = (state: GameState): void => {
  const started = ROOM_KEYS.some(k => state.roomProgress[k]);
  state.levelProgress[state.currentLevel] = started
    ? { roomProgress: { ...state.roomProgress }, playerStats: { ...state.playerStats } }
    : null;
};

/** Make `level` the active level, restoring its unfinished progress if there is any. The ATHLETE room is off until the game sets meetRoom. */
export const activateLevel = (state: GameState, level: number): void => {
  state.currentLevel = level;
  const saved = state.levelProgress[level] ?? null;
  state.roomProgress = saved ? { ...saved.roomProgress } : freshRoomProgress();
  state.playerStats = saved ? { ...saved.playerStats } : freshStats();
  state.challengeResults = [];
  state.returnDoor = null;
  state.resumeRoom = false;
  state.meetRoom = false;
};

/** Forget the active level's progress (after the level is won). */
export const clearActiveLevel = (state: GameState): void => {
  state.roomProgress = freshRoomProgress();
  state.playerStats = freshStats();
  state.challengeResults = [];
  state.levelProgress[state.currentLevel] = null;
  // The athlete stays met and the needs chat stays done, but each room's check-in comes again with the rooms
  const meet = meetOf(state);
  meet.heard = freshRoomProgress();
  meet.tests = [];
  meet.call = '';
};

// Calculate stat from challenge results
export const calcStat = (dataQuality: number, variableAccuracy: number): number => {
  return dataQuality * 0.4 + variableAccuracy * 0.6;
};

/** What the boss battle reports when the bout ends. */
export interface BoutResult {
  won: boolean;
  focus: StatKey; // the level's boss stat
  rating: number; // player's showdown rating (ceiling), 0-1
  rivalRating: number; // rival's ceiling, 0-1
  playerScore: number; // final minigame scores, 0-1
  rivalScore: number;
  /** The player made no valid input during the bout (e.g. pressed the wrong key), so say how to play. */
  idle: boolean;
  /** The RACE TO THE LINE only (systems/RaceModel.ts): how it was run, for the defeat advice and the debrief. */
  race?: RaceSummary;
}

/** How a RACE TO THE LINE went: finishing times in race seconds, and how the kick was timed. */
export interface RaceSummary {
  time: number;
  rivalTime: number;
  /** good: the gauge was spent by the line; early: it ran dry before it; late: some was left at the line. */
  kick: 'good' | 'early' | 'late';
  /** Metres to go when the gauge ran dry (0 if it never did). */
  emptyToGo: number;
  /** Share of the gauge left at the line, 0-1. */
  unused: number;
}

export type LevelOutcome = 'win' | 'lose' | 'complete';

/** Snapshot shown on the level-clear screen. */
export interface LevelResult extends BoutResult {
  outcome: LevelOutcome; // 'complete' = this win finished the whole game
  level: number;
  stats: PlayerStats; // stats at the time of the bout
}

/** Weight of the level's focus stat in the showdown rating; the rest comes from all four rooms. */
export const FOCUS_WEIGHT = 0.7;

/**
 * Showdown rating (0-1): the ceiling on how well the player's athlete can perform in the boss
 * minigame. Dominated by the level's focus stat, but every room counts.
 */
export const showdownRating = (stats: PlayerStats, focus: StatKey): number => {
  const mean = STAT_KEYS.reduce((sum, k) => sum + stats[k], 0) / STAT_KEYS.length;
  return FOCUS_WEIGHT * stats[focus] + (1 - FOCUS_WEIGHT) * mean;
};
