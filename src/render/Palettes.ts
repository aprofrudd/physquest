// GBC-style palettes: 6 colors each
// [0] = outline (near-black)
// [1] = dark shade
// [2] = mid shade
// [3] = light shade
// [4] = background (lightest)
// [5] = accent (gold, red, etc)

export interface Palette {
  name: string;
  colors: string[];
}

export const PALETTES = {
  // Physiology Lab — cool blues on cream
  lab: {
    name: 'Physiology Lab',
    colors: ['#080808', '#1b3a5c', '#4878a8', '#88b8d8', '#f0e8d8', '#d0a830'],
  },
  // Gym Floor — warm reds on white
  gym: {
    name: 'Gym Floor',
    colors: ['#080808', '#5c1b1b', '#a83838', '#d88888', '#f8f0e8', '#d8c020'],
  },
  // Outdoor Track — greens on light
  track: {
    name: 'Outdoor Track',
    colors: ['#080808', '#1b5c28', '#38a848', '#88d898', '#f0f8e8', '#d87020'],
  },
  // Boss Arena — purples on lavender
  boss: {
    name: 'Boss Arena',
    colors: ['#080808', '#2a1a4a', '#6838a8', '#a878d8', '#e8e0f0', '#c83030'],
  },
  // UI / dialogue
  ui: {
    name: 'UI',
    colors: ['#080808', '#303030', '#606060', '#a0a0a0', '#f8f8f0', '#3868b8'],
  },
  // Title screen
  title: {
    name: 'Title',
    colors: ['#080808', '#182848', '#3858a8', '#88a8d8', '#f0e8d8', '#d0a830'],
  },
} as const;

export type PaletteId = keyof typeof PALETTES;
