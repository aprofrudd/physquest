// GBC-style palettes: 4-6 colors each (index 0 = transparent/bg)
export interface Palette {
  name: string;
  colors: string[];
}

export const PALETTES = {
  // Physiology Lab — cool blues
  lab: {
    name: 'Physiology Lab',
    colors: ['#0f1b2d', '#1b3a5c', '#2d6a9f', '#5ba3d9', '#a8d8f0', '#e8f4fd'],
  },
  // Gym Floor — warm reds
  gym: {
    name: 'Gym Floor',
    colors: ['#1a0a0a', '#5c1b1b', '#9f2d2d', '#d95b5b', '#f0a8a8', '#fde8e8'],
  },
  // Outdoor Track — greens
  track: {
    name: 'Outdoor Track',
    colors: ['#0a1a0a', '#1b5c1b', '#2d9f2d', '#5bd95b', '#a8f0a8', '#e8fde8'],
  },
  // Boss Arena — dark/high contrast
  boss: {
    name: 'Boss Arena',
    colors: ['#0a0a0a', '#2a1a3a', '#5c2d8a', '#9f5bd9', '#d9a8f0', '#f0e8fd'],
  },
  // UI / dialogue
  ui: {
    name: 'UI',
    colors: ['#0f0f0f', '#1a1a2e', '#333366', '#6666aa', '#aaaadd', '#eeeeff'],
  },
  // Title screen
  title: {
    name: 'Title',
    colors: ['#0a0a14', '#1a1a3a', '#2d2d6a', '#5b5bd9', '#a8a8f0', '#e8e8fd'],
  },
} as const;

export type PaletteId = keyof typeof PALETTES;
