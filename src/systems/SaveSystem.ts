import {
  ROOM_KEYS,
  STAT_KEYS,
  activateLevel,
  resetGameState,
  stashLevel,
  type GameState,
  type LevelProgress,
} from '../state/GameState';

interface SaveDataV1 {
  version: 1;
  playerName: string;
  bossDefeated: boolean[];
  gameComplete: boolean;
}

export interface SaveData {
  version: 2;
  playerName: string;
  bossDefeated: boolean[];
  gameComplete: boolean;
  currentLevel: number;
  levelProgress: (LevelProgress | null)[];
}

const SAVE_KEY = 'physquest_save';
const LEVEL_COUNT = 4;
const MAX_NAME = 8;

const cleanName = (name: string): string => name.toUpperCase().replace(/[^A-Z0-9.\- ]/g, '').slice(0, MAX_NAME);

/**
 * Persist the game. Also stashes the active level's room progress, so this is safe to call
 * any time after a meaningful change (name entered, room finished, boss result, pause menu).
 */
export const saveGame = (state: GameState): boolean => {
  stashLevel(state);
  const data: SaveData = {
    version: 2,
    playerName: state.playerName,
    bossDefeated: [...state.bossDefeated],
    gameComplete: state.gameComplete,
    currentLevel: state.currentLevel,
    levelProgress: state.levelProgress.map(p =>
      p ? { roomProgress: { ...p.roomProgress }, playerStats: { ...p.playerStats } } : null
    ),
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    // localStorage full or unavailable (e.g. private mode) — play on without saving
    return false;
  }
};

const isBoolArray = (v: unknown): v is boolean[] => Array.isArray(v) && v.every(b => typeof b === 'boolean');

const sanitizeProgress = (p: unknown): LevelProgress | null => {
  if (!p || typeof p !== 'object') return null;
  const { roomProgress, playerStats } = p as Partial<LevelProgress>;
  if (!roomProgress || !playerStats) return null;
  const rooms = { ...roomProgress };
  const stats = { ...playerStats };
  for (const k of ROOM_KEYS) if (typeof rooms[k] !== 'boolean') return null;
  for (const k of STAT_KEYS) {
    const v = stats[k];
    if (typeof v !== 'number' || !Number.isFinite(v)) return null;
    stats[k] = Math.max(0, Math.min(1, v));
  }
  return { roomProgress: rooms, playerStats: stats };
};

const padLevels = <T>(arr: T[], fill: T): T[] =>
  Array.from({ length: LEVEL_COUNT }, (_, i) => (i < arr.length ? (arr[i] as T) : fill));

export const loadSave = (): SaveData | null => {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<SaveData> | Partial<SaveDataV1>;
    if (typeof data.playerName !== 'string' || !isBoolArray(data.bossDefeated)) return null;
    const bossDefeated = padLevels(data.bossDefeated, false);

    if (data.version === 1) {
      return {
        version: 2,
        playerName: cleanName(data.playerName),
        bossDefeated,
        gameComplete: bossDefeated.every(Boolean),
        currentLevel: 0,
        levelProgress: [null, null, null, null],
      };
    }
    if (data.version !== 2) return null;
    const v2 = data as Partial<SaveData>;
    const level = typeof v2.currentLevel === 'number' ? Math.floor(v2.currentLevel) : 0;
    return {
      version: 2,
      playerName: cleanName(data.playerName),
      bossDefeated,
      gameComplete: bossDefeated.every(Boolean),
      currentLevel: level >= 0 && level < LEVEL_COUNT ? level : 0,
      levelProgress: padLevels(Array.isArray(v2.levelProgress) ? v2.levelProgress.map(sanitizeProgress) : [], null),
    };
  } catch {
    return null;
  }
};

export const hasSave = (): boolean => loadSave() !== null;

export const deleteSave = (): void => {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // silently fail
  }
};

/** Replace the in-memory game with the saved one (level select is the resume point). */
export const applySave = (state: GameState, save: SaveData): void => {
  resetGameState(state);
  state.playerName = save.playerName;
  state.bossDefeated = [...save.bossDefeated];
  state.gameComplete = save.gameComplete;
  state.levelProgress = save.levelProgress.map(p =>
    p ? { roomProgress: { ...p.roomProgress }, playerStats: { ...p.playerStats } } : null
  );
  // Load the last level's progress into the active fields so a later save doesn't wipe it
  activateLevel(state, save.currentLevel);
};
