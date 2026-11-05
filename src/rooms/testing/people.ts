// The people of the Testing Lab, as 16x16 pixel art: Aisha in the poses the tests need (running, standing,
// hands on hips, spent; a ponytail with a yellow tie, a racing vest, shorts, bare legs) and the technician with a
// clipboard. Drawn from text so each frame can be read and edited as a picture. Letters: k outline, h hair, s skin,
// r vest, y trim, d shorts, w shoes. Her
// riding pose is built in scenes.ts from the head cut-out below and drawn limbs.
import { AISHA_PALETTE } from '../../data/sprites';
import { createPixels, toSprite, type Grid } from './pixels';

/** Aisha's colours, shared with her overworld sprites (AISHA_PALETTE): dark hair, red vest, yellow trim. */
export const AISHA_COLORS: readonly string[] = AISHA_PALETTE.slice(0, 7); // outline, hair, skin, vest, trim, shorts, shoes

/** The technician's colours: white coat, fair hair, a brown clipboard. */
export const TECH_COLORS: readonly string[] = [
  '#080808', // 0 outline
  '#d8c070', // 1 hair
  '#e0b088', // 2 skin
  '#f4f4f4', // 3 coat
  '#a8c0d8', // 4 coat shade
  '#303848', // 5 trousers
  '#a06a38', // 6 clipboard
  '#ffffff', // 7 paper
];

const KEY: Readonly<Record<string, number>> = { k: 0, h: 1, s: 2, r: 3, y: 4, d: 5, w: 6 };

const art = (rows: readonly string[]): Grid => {
  const c = createPixels(16, 16);
  c.stamp(0, 0, rows, KEY);
  return c.grid;
};

/** The same picture facing the other way. */
const mirror = (g: Grid): Grid => g.map(row => row.slice().reverse());

// ---- Aisha facing right ------------------------------------------------------------------------------------------

// Running: the stride, the pass-through and the flight, with the ponytail swinging behind her.
const RUN_STRIDE = art([
  '......kkkkk.....',
  '.....khhhhhk....',
  '...kkhhhhhhhk...',
  '..khhyhhhssksk..',
  '..kkhhhhsssssk..',
  '....kkkhsskssk..',
  '.....kkkksssk...',
  '....kkrrrrrkk...',
  '...ksskrrrrrsk..',
  '...ksskrryrrssk.',
  '....kkkrrrrkssk.',
  '.....kkddddkkk..',
  '....kkdddddkk...',
  '...ksssk.kssk...',
  '..ksskk...kswk..',
  '..kwwk....kwwwk.',
]);

const RUN_PASS = art([
  '......kkkkk.....',
  '.....khhhhhk....',
  '....khhhhhhhk...',
  '..kkhhhhhssksk..',
  '.khhhyhhsssssk..',
  '..kkkkhhsskssk..',
  '.....kkkksssk...',
  '....kkrrrrrkk...',
  '....krrrrrrrsk..',
  '....krrryrrrsk..',
  '....kkrrrrrkk...',
  '.....kkddddk....',
  '.....kddddddk...',
  '.....ksskkssk...',
  '.....kssk.ksk...',
  '....kwwwk.kwwk..',
]);

const RUN_FLIGHT = art([
  '................',
  '......kkkkk.....',
  '.....khhhhhk....',
  '..kkkhhhhhhhk...',
  '.khhhyhhhssksk..',
  '..kkkhhhsssssk..',
  '....kkkhsskssk..',
  '.....kkkksssk...',
  '..kkkkrrrrrkk...',
  '.ksskkrrrryrk...',
  '..kkkkrrrrrksk..',
  '.....kkdddkkssk.',
  '....kkdddddkkk..',
  '..kksssk.ksskk..',
  '.kwwkkk...ksswk.',
  '.kwk.......kwwk.',
]);

/** Standing and breathing easy: feet together. */
const STAND = art([
  '......kkkkk.....',
  '.....khhhhhk....',
  '....khhhhhhhk...',
  '..kkhhhhhssksk..',
  '.khhhyhhsssssk..',
  '..kkkkhhsskssk..',
  '.....kkkksssk...',
  '....kkrrrrrkk...',
  '....krrrrrrrsk..',
  '....krrryrrrsk..',
  '....kkrrrrrkk...',
  '.....kkddddk....',
  '.....kddddddk...',
  '.....ksskkssk...',
  '.....kssk.ksk...',
  '....kwwwk.kwwk..',
]);

/** Recovering between efforts: a hand on the hip, the chest rising and falling. */
const HIPS = [
  art([
    '......kkkkk.....',
    '.....khhhhhk....',
    '....khhhhhhhk...',
    '..kkhhhhhssksk..',
    '.khhhyhhsssssk..',
    '..kkkkhhsskssk..',
    '.....kkkksssk...',
    '....kkrrrrrkk...',
    '...kskrrrrrrsk..',
    '..ksskrrryrrrk..',
    '...kkkrrrrrrk...',
    '.....kkddddk....',
    '.....kddddddk...',
    '.....ksskkssk...',
    '.....kssk.ksk...',
    '....kwwwk.kwwk..',
  ]),
  art([
    '......kkkkk.....',
    '.....khhhhhk....',
    '....khhhhhhhk...',
    '..kkhhhhhssksk..',
    '.khhhyhhsssssk..',
    '..kkkkhhsskssk..',
    '.....kkkksssk...',
    '....kkrrrrrkk...',
    '..kkskrrrrrrsk..',
    '..ksskrrryrrrk..',
    '...kkkrrrrrrk...',
    '.....kkddddk....',
    '.....kddddddk...',
    '.....ksskkssk...',
    '.....kssk.ksk...',
    '....kwwwk.kwwk..',
  ]),
];

/** Spent: bent over with her hands on her knees, heaving. */
const SPENT = [
  art([
    '................',
    '................',
    '................',
    '.........kkkk...',
    '........khhhhk..',
    '...kkk..khhhhhk.',
    '..khhhkkhhhsssk.',
    '.krrrrrkkhhsksk.',
    '.krrrrrrkkssssk.',
    '.krryrrrrkkkkk..',
    '..krrrrrrkskk...',
    '...kkddddkssk...',
    '...kddkkddkk....',
    '...kssk.kssk....',
    '...kssk..ksk....',
    '..kwwwk.kwwk....',
  ]),
  art([
    '................',
    '................',
    '................',
    '................',
    '.........kkkk...',
    '...kkk..khhhhk..',
    '..khhhkkhhhhhhk.',
    '.krrrrrkkhhsssk.',
    '.krrrrrrkkskssk.',
    '.krryrrrrkkssk..',
    '..krrrrrrkskk...',
    '...kkddddkssk...',
    '...kddkkddkk....',
    '...kssk.kssk....',
    '...kssk..ksk....',
    '..kwwwk.kwwk....',
  ]),
];

/** Just her head and neck (the top seven rows), for poses that are drawn in pieces. */
export const HEAD_RIGHT: Grid = RUN_PASS.slice(0, 7);

export const RUN_FRAMES: readonly Grid[] = [RUN_STRIDE, RUN_PASS, RUN_FLIGHT, RUN_PASS];
export const RUN_FRAMES_LEFT: readonly Grid[] = RUN_FRAMES.map(mirror);
export const STAND_RIGHT: Grid = STAND;
export const HIPS_RIGHT: readonly Grid[] = HIPS;
export const SPENT_RIGHT: readonly Grid[] = SPENT;

/** Her running frames as drawSprite sprites (0 = see-through), for rooms that draw with drawSprite. Made once. */
export const RUN_SPRITES: readonly number[][][] = RUN_FRAMES.map(toSprite);
/** Colours for RUN_SPRITES (and for AISHA_SPRITE in data/sprites). */
export const AISHA_SPRITE_COLORS: string[] = ['', ...AISHA_PALETTE];

// ---- the technician (facing right, clipboard at the chest) --------------------------------------------------------

const TECH_KEY: Readonly<Record<string, number>> = { k: 0, h: 1, s: 2, c: 3, e: 4, t: 5, b: 6, p: 7 };

const techArt = (rows: readonly string[]): Grid => {
  const c = createPixels(16, 16);
  c.stamp(0, 0, rows, TECH_KEY);
  return c.grid;
};

/** Two frames: the pen hand moves, so he looks like he is writing. */
export const TECH_FRAMES: readonly Grid[] = [
  techArt([
    '......kkkkk.....',
    '.....khhhhhk....',
    '....khhhhhhhk...',
    '....khhhhhssksk.',
    '....khhhhsssssk.',
    '.....kkhhsskssk.',
    '......kkkksssk..',
    '.....kkcccccckk.',
    '.....kcccccckbbk',
    '.....kcceccckbpk',
    '.....kccccceskpk',
    '......kkcccckbbk',
    '......kkttttkkk.',
    '......kttkkttk..',
    '......kttk.kttk.',
    '.....kkkkk.kkkk.',
  ]),
  techArt([
    '......kkkkk.....',
    '.....khhhhhk....',
    '....khhhhhhhk...',
    '....khhhhhssksk.',
    '....khhhhsssssk.',
    '.....kkhhsskssk.',
    '......kkkksssk..',
    '.....kkcccccckk.',
    '.....kcccccckbbk',
    '.....kcceccckbpk',
    '.....kcccccekbpk',
    '......kkccccskbk',
    '......kkttttkkk.',
    '......kttkkttk..',
    '......kttk.kttk.',
    '.....kkkkk.kkkk.',
  ]),
];
