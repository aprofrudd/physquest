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
