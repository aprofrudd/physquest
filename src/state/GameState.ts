export interface PlayerStats {
  speed: number;
  strength: number;
  endurance: number;
  power: number;
}

export interface RoomProgress {
  testSelection: boolean;
  variableId: boolean;
  trainingPrescription: boolean;
  performancePrediction: boolean;
}

export interface ChallengeResult {
  dataQuality: number; // 0-1
  variableAccuracy: number; // 0-1
}

export interface GameState {
  currentLevel: number; // 0-3
  maxLevelUnlocked: number;
  playerStats: PlayerStats;
  roomProgress: RoomProgress;
  challengeResults: ChallengeResult[];
  playerPos: { x: number; y: number };
  playerDir: 'up' | 'down' | 'left' | 'right';
  playerMoving: boolean;
  bossDefeated: boolean[];
  gameComplete: boolean;
}

export const createInitialState = (): GameState => ({
  currentLevel: 0,
  maxLevelUnlocked: 0,
  playerStats: { speed: 0, strength: 0, endurance: 0, power: 0 },
  roomProgress: {
    testSelection: false,
    variableId: false,
    trainingPrescription: false,
    performancePrediction: false,
  },
  challengeResults: [],
  playerPos: { x: 7, y: 8 }, // starting tile
  playerDir: 'down',
  playerMoving: false,
  bossDefeated: [false, false, false, false],
  gameComplete: false,
});

// Calculate stat from challenge results
export const calcStat = (dataQuality: number, variableAccuracy: number): number => {
  return dataQuality * 0.4 + variableAccuracy * 0.6;
};
