import {
  ROOM_KEYS,
  STAT_KEYS,
  activateLevel,
  freshMeet,
  freshRoomProgress,
  resetGameState,
  stashLevel,
  type GameState,
  type LevelProgress,
  type MeetProgress,
  type TestCall,
} from '../state/GameState';
import { allPlayableCleared } from '../data/levels';
import { cleanLook } from '../data/playerLooks';

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

/** v3 adds `meet`: the Performance Director's welcome and the athlete meeting, per level. */
interface SaveDataV3 {
  version: 3;
  playerName: string;
  bossDefeated: boolean[];
  gameComplete: boolean;
  currentLevel: number;
  levelProgress: (LevelProgress | null)[];
  meet: unknown[];
}

/**
 * v4 adds the Director's needs chat and check-ins to `meet` (needs, heard, and the Testing Lab's last battery and call:
 * `tests`, a list; early v4 saves kept one `test` name, read as a list of one).
 * Older saves load with every check-in for a room already finished counted as heard, so no one is locked out.
 * `look` (the player's look, PLAYER_LOOKS) came later in v4: a save without one loads with the first look.
 */
export interface SaveData {
  version: 4;
  playerName: string;
  look: number;
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
    version: 4,
    playerName: state.playerName,
    look: cleanLook(state.playerLook),
    bossDefeated: [...state.bossDefeated],
    gameComplete: state.gameComplete,
    currentLevel: state.currentLevel,
    levelProgress: state.levelProgress.map(p =>
      p ? { roomProgress: { ...p.roomProgress }, playerStats: { ...p.playerStats } } : null
    ),
    meet: padLevels(state.meet, null).map(m => (m ? copyMeet(m) : freshMeet())),
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    // localStorage full or unavailable (e.g. private mode) — play on without saving
    return false;
  }
};

const copyMeet = (m: MeetProgress): MeetProgress => ({ ...m, heard: { ...m.heard }, tests: [...m.tests] });

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

const CALLS: readonly TestCall[] = ['right', 'ranAnyway', 'needlessRebook'];

/** Test names that have changed since they were saved. */
const RENAMED_TESTS: Readonly<Record<string, string>> = { 'Lactate Threshold Test': 'Lactate Profile' };
const testName = (t: string): string => RENAMED_TESTS[t] ?? t.slice(0, 60);

/**
 * A level's welcome, meeting and check-ins from a save; anything malformed reads as not done yet. `progress` is the
 * level's unfinished rooms and `won` whether its boss is beaten: a save from before the check-ins (no `heard`) counts
 * the needs chat as done once a room is finished or the level won, and each finished room's check-in as heard.
 */
const sanitizeMeet = (m: unknown, progress: LevelProgress | null, won: boolean): MeetProgress => {
  if (!m || typeof m !== 'object') return freshMeet();
  const { welcomed, met, best, of, needs, heard, tests, call } = m as Partial<Record<keyof MeetProgress, unknown>>;
  // Saves from before the test battery kept one test ('test': its name, or '' before any)
  const legacy = (m as { test?: unknown }).test;
  const asks = count(of, 99);
  const base = { welcomed: welcomed === true, met: met === true, best: count(best, asks), of: asks };
  if (!heard || typeof heard !== 'object') {
    const started = !!progress && ROOM_KEYS.some(k => progress.roomProgress[k]);
    return {
      ...freshMeet(),
      ...base,
      needs: base.met && (started || won),
      heard: progress ? { ...progress.roomProgress } : freshRoomProgress(),
    };
  }
  const rooms = freshRoomProgress();
  for (const k of ROOM_KEYS) rooms[k] = (heard as Record<string, unknown>)[k] === true;
  return {
    ...base,
    needs: needs === true,
    heard: rooms,
    tests: Array.isArray(tests)
      ? tests.filter((t): t is string => typeof t === 'string').slice(0, 4).map(testName)
      : typeof legacy === 'string' && legacy
        ? [testName(legacy)]
        : [],
    call: CALLS.find(c => c === call) ?? '',
  };
};

export const loadSave = (): SaveData | null => {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<SaveData> | Partial<SaveDataV3> | Partial<SaveDataV2> | Partial<SaveDataV1>;
    if (typeof data.playerName !== 'string' || !isBoolArray(data.bossDefeated)) return null;
    const bossDefeated = padLevels(data.bossDefeated, false);

    const noMeet = (): MeetProgress[] => padLevels([], null).map(() => freshMeet());
    const look = cleanLook((data as { look?: unknown }).look);

    if (data.version === 1) {
      return {
        version: 4,
        playerName: cleanName(data.playerName),
        look,
        bossDefeated,
        gameComplete: allPlayableCleared(bossDefeated),
        currentLevel: 0,
        levelProgress: [null, null, null, null],
        meet: noMeet(),
      };
    }
    if (data.version !== 2 && data.version !== 3 && data.version !== 4) return null;
    const v = data as Partial<SaveDataV3>;
    const level = typeof v.currentLevel === 'number' ? Math.floor(v.currentLevel) : 0;
    const levelProgress = padLevels(Array.isArray(v.levelProgress) ? v.levelProgress.map(sanitizeProgress) : [], null);
    // A v2 save has no meetings. A level already under way (a room finished) or won counts as welcomed and
    // met, with no overview score (of 0), so its open rooms and arena stay open; any other level starts
    // with the Director's welcome and the ATHLETE room.
    // Their check-ins count as heard (see sanitizeMeet).
    const migrateMeet = (): MeetProgress[] =>
      levelProgress.map((p, i) =>
        sanitizeMeet(
          bossDefeated[i] || (p && ROOM_KEYS.some(k => p.roomProgress[k])) ? { welcomed: true, met: true, best: 0, of: 0 } : null,
          p,
          bossDefeated[i] === true,
        ),
      );
    return {
      version: 4,
      playerName: cleanName(data.playerName),
      look,
      bossDefeated,
      gameComplete: allPlayableCleared(bossDefeated),
      currentLevel: level >= 0 && level < LEVEL_COUNT ? level : 0,
      levelProgress,
      meet:
        data.version === 2
          ? migrateMeet()
          : Array.isArray(v.meet)
            ? padLevels(v.meet, null).map((m, i) => sanitizeMeet(m, levelProgress[i] ?? null, bossDefeated[i] === true))
            : noMeet(),
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
  state.playerLook = cleanLook(save.look);
  state.bossDefeated = [...save.bossDefeated];
  state.gameComplete = save.gameComplete;
  state.levelProgress = save.levelProgress.map(p =>
    p ? { roomProgress: { ...p.roomProgress }, playerStats: { ...p.playerStats } } : null
  );
  state.meet = save.meet.map(copyMeet);
  // Load the last level's progress into the active fields so a later save doesn't wipe it
  activateLevel(state, save.currentLevel);
};
