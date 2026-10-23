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

export interface GameState {
  playerName: string;
  currentLevel: number; // 0-3
  maxLevelUnlocked: number;
  // Active level (the one currently being played)
  playerStats: PlayerStats;
  roomProgress: RoomProgress;
  challengeResults: ChallengeResult[];
  // Unfinished levels, by level index (null = not started or already won)
  levelProgress: (LevelProgress | null)[];
  returnDoor: HubDoor | null;
  /** The player left a room challenge with B: the overworld keeps them in that room, where they stood. */
  resumeRoom: boolean;
  playerPos: { x: number; y: number };
  playerDir: 'up' | 'down' | 'left' | 'right';
  playerMoving: boolean;
  bossDefeated: boolean[];
  gameComplete: boolean;
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

export const createInitialState = (): GameState => ({
  playerName: '',
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
});

/** Reset to a brand-new game in place (scenes hold a reference to this object). */
export const resetGameState = (state: GameState): void => {
  Object.assign(state, createInitialState());
};

export const roomsCompleted = (state: GameState): number =>
  ROOM_KEYS.filter(k => state.roomProgress[k]).length;

export const allRoomsComplete = (state: GameState): boolean => roomsCompleted(state) === ROOM_KEYS.length;

/**
 * Rooms are taken in order (TESTING, DATA, TRAINING, ANALYSIS): a room is open once the room before it
 * is done. A finished room always stays open for replays.
 */
export const roomUnlocked = (state: GameState, key: RoomKey): boolean => {
  const i = ROOM_KEYS.indexOf(key);
  const prev = ROOM_KEYS[i - 1];
  return i <= 0 || state.roomProgress[key] || (prev !== undefined && state.roomProgress[prev]);
};

/** The next room to do, in order, or null when all four are done. */
export const nextRoom = (state: GameState): RoomKey | null => ROOM_KEYS.find(k => !state.roomProgress[k]) ?? null;

/** Copy the active level's progress into levelProgress (null if no room has been completed yet). */
export const stashLevel = (state: GameState): void => {
  const started = ROOM_KEYS.some(k => state.roomProgress[k]);
  state.levelProgress[state.currentLevel] = started
    ? { roomProgress: { ...state.roomProgress }, playerStats: { ...state.playerStats } }
    : null;
};

/** Make `level` the active level, restoring its unfinished progress if there is any. */
export const activateLevel = (state: GameState, level: number): void => {
  state.currentLevel = level;
  const saved = state.levelProgress[level] ?? null;
  state.roomProgress = saved ? { ...saved.roomProgress } : freshRoomProgress();
  state.playerStats = saved ? { ...saved.playerStats } : freshStats();
  state.challengeResults = [];
  state.returnDoor = null;
  state.resumeRoom = false;
};

/** Forget the active level's progress (after the level is won). */
export const clearActiveLevel = (state: GameState): void => {
  state.roomProgress = freshRoomProgress();
  state.playerStats = freshStats();
  state.challengeResults = [];
  state.levelProgress[state.currentLevel] = null;
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
