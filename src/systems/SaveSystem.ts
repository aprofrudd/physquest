import {
  ROOM_KEYS,
  STAT_KEYS,
  activateLevel,
  freshMeet,
  resetGameState,
  stashLevel,
  type GameState,
  type LevelProgress,
  type MeetProgress,
} from '../state/GameState';
import { allPlayableCleared } from '../data/levels';

interface SaveDataV1 {
  version: 1;
  playerName: string;
  bossDefeated: boolean[];
  gameComplete: boolean;
}

interface SaveDataV2 {
  version: 2;
  playerName: string;
  bossDefeated: boolean[];
  gameComplete: boolean;
  currentLevel: number;
  levelProgress: (LevelProgress | null)[];
}

/** v3 adds `meet`: the Performance Director's welcome and the athlete meeting, per level. v1 and v2 saves load with none. */
export interface SaveData {
  version: 3;
  playerName: string;
  bossDefeated: boolean[];
  gameComplete: boolean;
  currentLevel: number;
  levelProgress: (LevelProgress | null)[];
  meet: MeetProgress[];
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
    version: 3,
    playerName: state.playerName,
    bossDefeated: [...state.bossDefeated],
    gameComplete: state.gameComplete,
    currentLevel: state.currentLevel,
    levelProgress: state.levelProgress.map(p =>
      p ? { roomProgress: { ...p.roomProgress }, playerStats: { ...p.playerStats } } : null
    ),
    meet: padLevels(state.meet, null).map(m => (m ? { ...m } : freshMeet())),
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

const padLevels = <T>(arr: readonly T[], fill: T): T[] =>
  Array.from({ length: LEVEL_COUNT }, (_, i) => (i < arr.length ? (arr[i] as T) : fill));

const count = (v: unknown, max: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(max, Math.floor(v))) : 0;

/** A level's welcome and meeting from a save; anything malformed reads as not done yet. */
const sanitizeMeet = (m: unknown): MeetProgress => {
  if (!m || typeof m !== 'object') return freshMeet();
  const { welcomed, met, best, of } = m as Partial<MeetProgress>;
  const asks = count(of, 99);
  return { welcomed: welcomed === true, met: met === true, best: count(best, asks), of: asks };
};

export const loadSave = (): SaveData | null => {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<SaveData> | Partial<SaveDataV2> | Partial<SaveDataV1>;
    if (typeof data.playerName !== 'string' || !isBoolArray(data.bossDefeated)) return null;
    const bossDefeated = padLevels(data.bossDefeated, false);

    const noMeet = (): MeetProgress[] => padLevels([], null).map(() => freshMeet());

    if (data.version === 1) {
      return {
        version: 3,
        playerName: cleanName(data.playerName),
        bossDefeated,
        gameComplete: allPlayableCleared(bossDefeated),
        currentLevel: 0,
        levelProgress: [null, null, null, null],
        meet: noMeet(),
      };
    }
    if (data.version !== 2 && data.version !== 3) return null;
    const v = data as Partial<SaveData>;
    const level = typeof v.currentLevel === 'number' ? Math.floor(v.currentLevel) : 0;
    const levelProgress = padLevels(Array.isArray(v.levelProgress) ? v.levelProgress.map(sanitizeProgress) : [], null);
    // A v2 save has no meetings. A level already under way (a room finished) or won counts as welcomed and
    // met, with no overview score (of 0), so its open rooms and arena stay open; any other level starts
    // with the Director's welcome and the ATHLETE room.
    const migrateMeet = (): MeetProgress[] =>
      levelProgress.map((p, i) =>
        bossDefeated[i] || (p && ROOM_KEYS.some(k => p.roomProgress[k]))
          ? { welcomed: true, met: true, best: 0, of: 0 }
          : freshMeet(),
      );
    return {
      version: 3,
      playerName: cleanName(data.playerName),
      bossDefeated,
      gameComplete: allPlayableCleared(bossDefeated),
      currentLevel: level >= 0 && level < LEVEL_COUNT ? level : 0,
      levelProgress,
      meet: data.version === 3 ? (Array.isArray(v.meet) ? padLevels(v.meet.map(sanitizeMeet), freshMeet()) : noMeet()) : migrateMeet(),
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
  state.meet = save.meet.map(m => ({ ...m }));
  // Load the last level's progress into the active fields so a later save doesn't wipe it
  activateLevel(state, save.currentLevel);
};
