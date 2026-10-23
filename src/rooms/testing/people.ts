// The people of the Testing Lab, as 16x16 pixel art: Aisha in the poses the tests need (running, standing,
// hands on hips, spent) and the technician with a clipboard. Drawn from text so each frame can be read and
// edited as a picture. Letters: k outline, h hair, s skin, r top, y trim, d shorts and legs, w shoes. Her
// riding pose is built in scenes.ts from the head cut-out below and drawn limbs.
import { createPixels, type Grid } from './pixels';

/** Aisha's colours (the same as the athlete in the overworld: dark hair, red top, yellow trim). */
export const AISHA_COLORS: readonly string[] = [
  '#080808', // 0 outline
  '#583828', // 1 hair
  '#e0b088', // 2 skin
  '#c83030', // 3 top
  '#f0d040', // 4 trim
  '#303848', // 5 shorts and legs
  '#f8f8f0', // 6 shoes
];

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
  '..khhhhhhssksk..',
  '..kkhhhhsssssk..',
  '....kkkhsskssk..',
  '.....kkkksssk...',
  '....kkrrrrrkk...',
  '...ksskrrrrrsk..',
  '...ksskrryrrssk.',
  '....kkkrrrrkssk.',
  '.....kkddddkkk..',
  '....kkdddddkk...',
  '...kdddk.kddk...',
  '..kddkk...kdwk..',
  '..kwwk....kwwwk.',
]);

const RUN_PASS = art([
  '......kkkkk.....',
  '.....khhhhhk....',
  '....khhhhhhhk...',
  '..kkhhhhhssksk..',
  '.khhhhhhsssssk..',
  '..kkkkhhsskssk..',
  '.....kkkksssk...',
  '....kkrrrrrkk...',
  '....krrrrrrrsk..',
  '....krrryrrrsk..',
  '....kkrrrrrkk...',
  '.....kkddddk....',
  '.....kddddddk...',
  '.....kddkkddk...',
  '.....kddk.kdk...',
  '....kwwwk.kwwk..',
]);

const RUN_FLIGHT = art([
  '................',
  '......kkkkk.....',
  '.....khhhhhk....',
  '..kkkhhhhhhhk...',
  '.khhhhhhhssksk..',
  '..kkkhhhsssssk..',
  '....kkkhsskssk..',
  '.....kkkksssk...',
  '..kkkkrrrrrkk...',
  '.ksskkrrrryrk...',
  '..kkkkrrrrrksk..',
  '.....kkdddkkssk.',
  '....kkdddddkkk..',
  '..kkdddk.kddkk..',
  '.kwwkkk...kddwk.',
  '.kwk.......kwwk.',
]);

/** Standing and breathing easy: feet together. */
const STAND = art([
  '......kkkkk.....',
  '.....khhhhhk....',
  '....khhhhhhhk...',
  '..kkhhhhhssksk..',
  '.khhhhhhsssssk..',
  '..kkkkhhsskssk..',
  '.....kkkksssk...',
  '....kkrrrrrkk...',
  '....krrrrrrrsk..',
  '....krrryrrrsk..',
  '....kkrrrrrkk...',
  '.....kkddddk....',
  '.....kddddddk...',
  '.....kddkkddk...',
  '.....kddk.kdk...',
  '....kwwwk.kwwk..',
]);

/** Recovering between efforts: a hand on the hip, the chest rising and falling. */
const HIPS = [
  art([
    '......kkkkk.....',
    '.....khhhhhk....',
    '....khhhhhhhk...',
    '..kkhhhhhssksk..',
    '.khhhhhhsssssk..',
    '..kkkkhhsskssk..',
    '.....kkkksssk...',
    '....kkrrrrrkk...',
    '...kskrrrrrrsk..',
    '..ksskrrryrrrk..',
    '...kkkrrrrrrk...',
    '.....kkddddk....',
    '.....kddddddk...',
    '.....kddkkddk...',
    '.....kddk.kdk...',
    '....kwwwk.kwwk..',
  ]),
  art([
    '......kkkkk.....',
    '.....khhhhhk....',
    '....khhhhhhhk...',
    '..kkhhhhhssksk..',
    '.khhhhhhsssssk..',
    '..kkkkhhsskssk..',
    '.....kkkksssk...',
    '....kkrrrrrkk...',
    '..kkskrrrrrrsk..',
    '..ksskrrryrrrk..',
    '...kkkrrrrrrk...',
    '.....kkddddk....',
    '.....kddddddk...',
    '.....kddkkddk...',
    '.....kddk.kdk...',
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
    '...kddk.kddk....',
    '...kddk..kdk....',
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
    '...kddk.kddk....',
    '...kddk..kdk....',
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
