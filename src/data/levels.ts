export interface LevelConfig {
  name: string;
  setting: string;
  bossName: string;
  sportIndex: number;
}

export const LEVELS: LevelConfig[] = [
  {
    name: 'Pre-Season Camp',
    setting: 'Club Speed Trial',
    bossName: 'SPRINT RACE',
    sportIndex: 0,
  },
  {
    name: 'Regional Championship',
    setting: 'Strength and Power Test',
    bossName: 'STRENGTH TEST',
    sportIndex: 1,
  },
  {
    name: 'National Finals',
    setting: 'Endurance Championship',
    bossName: 'ENDURANCE BOUT',
    sportIndex: 2,
  },
  {
    name: 'International Selection',
    setting: 'Combined Athletic Challenge',
    bossName: 'POWER SURGE',
    sportIndex: 3,
  },
];

/**
 * Sports a player can pick, by level index. Only Distance Running is open for now; the other cards show on the
 * level select as COMING SOON and the cursor skips them. Add an index here to open a sport again.
 */
export const PLAYABLE_LEVELS: ReadonlySet<number> = new Set([3]);

export const levelPlayable = (level: number): boolean => PLAYABLE_LEVELS.has(level);

/** The game is complete once every playable sport's showdown has been won. */
export const allPlayableCleared = (bossDefeated: readonly boolean[]): boolean =>
  [...PLAYABLE_LEVELS].every(level => bossDefeated[level] === true);
