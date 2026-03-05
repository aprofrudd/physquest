import type { GameState } from '../state/GameState';

interface SaveData {
  version: 1;
  playerName: string;
  bossDefeated: boolean[];
  gameComplete: boolean;
}

const SAVE_KEY = 'physquest_save';

export const saveGame = (state: GameState): void => {
  const data: SaveData = {
    version: 1,
    playerName: state.playerName,
    bossDefeated: [...state.bossDefeated],
    gameComplete: state.gameComplete,
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // localStorage full or unavailable — silently fail
  }
};

export const loadSave = (): SaveData | null => {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SaveData;
    if (data.version !== 1) return null;
    if (typeof data.playerName !== 'string') return null;
    if (!Array.isArray(data.bossDefeated)) return null;
    return data;
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

export const applySave = (state: GameState, save: SaveData): void => {
  state.playerName = save.playerName;
  state.bossDefeated = [...save.bossDefeated];
  state.gameComplete = save.gameComplete;
};
