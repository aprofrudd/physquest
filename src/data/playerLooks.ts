// The player's looks, picked after name entry (and changed later from the level select with SELECT).
// Every look is the same sport scientist's body (the sprites in sprites.ts) in its own colours, with short or
// long hair. Colour indices as in sprites.ts: 1 outline, 2 hair, 3 skin, 4 top, 5 top trim.

import { COACH_DOWN, COACH_LEFT, COACH_RIGHT, COACH_UP } from './sprites';

export type Facing = 'up' | 'down' | 'left' | 'right';
export type HairStyle = 'short' | 'long';

export interface PlayerLook {
  /** What a screen reader hears, e.g. "short dark hair, blue top". */
  spoken: string;
  hair: HairStyle;
  /** Palette for drawSprite: index 0 unused (transparent). */
  colors: readonly string[];
}

const OUTLINE = '#080808';

// Skin tones and hair colours, light to dark
const SKIN_LIGHT = '#f0c8a0';
const SKIN_MID = '#e0b088'; // the original look's
const SKIN_TAN = '#b07850';
const SKIN_DARK = '#7a4a2c';

const look = (spoken: string, hair: HairStyle, hairColor: string, skin: string, top: string, trim: string): PlayerLook => ({
  spoken,
  hair,
  colors: ['', OUTLINE, hairColor, skin, top, trim],
});

/**
 * The looks in picker order. The first is the original sport scientist (and the look of every save made before
 * looks existed). Tops avoid Aisha's red vest and the Director's charcoal blazer, so the player is never mistaken
 * for either.
 */
export const PLAYER_LOOKS: readonly PlayerLook[] = [
  look('short dark hair, blue top', 'short', '#384868', SKIN_MID, '#3868b8', '#f0f0f0'),
  look('long brown hair, green top', 'long', '#6a4028', SKIN_LIGHT, '#2f8a48', '#f0f0f0'),
  look('short black hair, orange top', 'short', '#202020', SKIN_DARK, '#d87020', '#f8e0a0'),
  look('long black hair, purple top', 'long', '#181818', SKIN_TAN, '#7848b0', '#f0d040'),
  look('short ginger hair, teal top', 'short', '#c05a20', SKIN_LIGHT, '#208888', '#f0f0f0'),
  look('long blonde hair, navy top', 'long', '#e0c060', SKIN_MID, '#283878', '#88b8e8'),
];

export const LOOK_COUNT = PLAYER_LOOKS.length;

/** A saved or typed look index made safe: anything unknown is the first look. */
export const cleanLook = (value: unknown): number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < LOOK_COUNT ? value : 0;

export const lookOf = (index: number): PlayerLook => PLAYER_LOOKS[cleanLook(index)]!;

// ---- long hair ----------------------------------------------------------------------------------------------------
// Pixels painted over the short-haired frames: [row, col, colour index]. Hair (2) frames the face and falls to the
// shoulders, with an outline (1) where it meets the background. The right-facing frames mirror the left-facing ones.

type Patch = readonly (readonly [number, number, number])[];

const LONG_DOWN: Patch = [
  // framing the face
  [3, 4, 2], [3, 11, 2],
  [4, 4, 2], [4, 11, 2],
  [5, 4, 2], [5, 11, 2],
  // down past the jaw to the shoulders
  [6, 3, 1], [6, 4, 2], [6, 11, 2], [6, 12, 1],
  [7, 3, 1], [7, 4, 2], [7, 11, 2], [7, 12, 1],
  [8, 3, 2], [8, 12, 2],
];

const LONG_UP: Patch = [
  // the back of the head carries on down over the shoulders
  [6, 4, 1], [6, 5, 2], [6, 6, 2], [6, 7, 2], [6, 8, 2], [6, 9, 2], [6, 10, 2], [6, 11, 1],
  [7, 4, 1], [7, 5, 2], [7, 6, 2], [7, 7, 2], [7, 8, 2], [7, 9, 2], [7, 10, 2], [7, 11, 1],
  [8, 5, 1], [8, 6, 2], [8, 7, 2], [8, 8, 2], [8, 9, 2], [8, 10, 1],
  [9, 6, 1], [9, 7, 1], [9, 8, 1], [9, 9, 1],
];

const LONG_LEFT: Patch = [
  // behind the ear and down the back
  [5, 9, 2], [5, 10, 1],
  [6, 8, 2], [6, 9, 2], [6, 10, 1],
  [7, 8, 2], [7, 9, 2],
  [8, 9, 2],
];

const mirrorPatch = (patch: Patch): Patch => patch.map(([r, c, v]) => [r, 15 - c, v] as const);

const patched = (frame: number[][], patch: Patch): number[][] => {
  const out = frame.map(row => [...row]);
  for (const [r, c, v] of patch) {
    const row = out[r];
    if (row && c >= 0 && c < 16) {
      while (row.length <= c) row.push(0);
      row[c] = v;
    }
  }
  return out;
};

const BASE: Readonly<Record<Facing, number[][][]>> = { down: COACH_DOWN, up: COACH_UP, left: COACH_LEFT, right: COACH_RIGHT };
const LONG_PATCH: Readonly<Record<Facing, Patch>> = {
  down: LONG_DOWN,
  up: LONG_UP,
  left: LONG_LEFT,
  right: mirrorPatch(LONG_LEFT),
};

// Built once, so every call hands drawSprite the same arrays (its cache is keyed by the array)
const FRAMES: Readonly<Record<HairStyle, Readonly<Record<Facing, number[][][]>>>> = {
  short: BASE,
  long: {
    down: COACH_DOWN.map(f => patched(f, LONG_PATCH.down)),
    up: COACH_UP.map(f => patched(f, LONG_PATCH.up)),
    left: COACH_LEFT.map(f => patched(f, LONG_PATCH.left)),
    right: COACH_RIGHT.map(f => patched(f, LONG_PATCH.right)),
  },
};

/** The player's frame for a look, facing and walk frame (the same array every call). */
export const playerSprite = (lookIndex: number, dir: Facing, frame: number): number[][] => {
  const frames = FRAMES[lookOf(lookIndex).hair][dir];
  return frames[frame % frames.length]!;
};

/** The palette to draw a look with (the same array every call). */
export const playerColors = (lookIndex: number): string[] => lookOf(lookIndex).colors as string[];
