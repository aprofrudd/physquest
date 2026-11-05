// 16x16 pixel sprites defined as palette index arrays
// 0 = transparent, 1=outline(black), 2=hair/dark, 3=skin, 4=shirt primary, 5=shirt secondary/highlight

// Coach sprite — 4 directions, 2 frames each
// Pokemon-style: consistent 1px black outline, lighter top, darker feet

export const COACH_DOWN: number[][][] = [
  // Frame 0
  [
    [0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0],
    [0,0,0,0,1,2,2,2,2,2,2,1,0,0,0,0],
    [0,0,0,1,2,2,2,2,2,2,2,2,1,0,0,0],
    [0,0,0,1,3,3,1,3,3,1,3,3,1,0,0,0],
    [0,0,0,1,3,3,3,3,3,3,3,3,1,0,0,0],
    [0,0,0,1,3,3,3,1,1,3,3,3,1,0,0,0],
    [0,0,0,0,1,1,3,3,3,3,1,1,0,0,0,0],
    [0,0,0,1,4,4,4,4,4,4,4,4,1,0,0,0],
    [0,0,1,4,4,5,4,4,4,4,5,4,4,1,0,0],
    [0,0,1,4,4,4,4,4,4,4,4,4,4,1,0,0],
    [0,0,1,3,1,4,4,4,4,4,4,1,3,1,0,0],
    [0,0,0,1,0,1,4,4,4,4,1,0,1,0,0,0],
    [0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0],
    [0,0,0,0,0,1,1,0,0,1,1,0,0,0,0,0],
    [0,0,0,0,1,1,1,0,0,1,1,1,0,0,0,0],
    [0,0,0,0,1,1,1,0,0,1,1,1,0,0,0,0],
  ],
  // Frame 1 (walk — legs shifted)
  [
    [0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0],
    [0,0,0,0,1,2,2,2,2,2,2,1,0,0,0,0],
    [0,0,0,1,2,2,2,2,2,2,2,2,1,0,0,0],
    [0,0,0,1,3,3,1,3,3,1,3,3,1,0,0,0],
    [0,0,0,1,3,3,3,3,3,3,3,3,1,0,0,0],
    [0,0,0,1,3,3,3,1,1,3,3,3,1,0,0,0],
    [0,0,0,0,1,1,3,3,3,3,1,1,0,0,0,0],
    [0,0,0,1,4,4,4,4,4,4,4,4,1,0,0,0],
    [0,0,1,4,4,5,4,4,4,4,5,4,4,1,0,0],
    [0,0,1,4,4,4,4,4,4,4,4,4,4,1,0,0],
    [0,0,1,3,1,4,4,4,4,4,4,1,3,1,0,0],
    [0,0,0,1,0,1,4,4,4,4,1,0,1,0,0,0],
    [0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0],
    [0,0,0,0,1,1,0,0,0,0,1,1,0,0,0,0],
    [0,0,0,1,1,1,0,0,0,0,0,1,1,0,0,0],
    [0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0],
  ],
];

export const COACH_UP: number[][][] = [
  [
    [0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0],
    [0,0,0,0,1,2,2,2,2,2,2,1,0,0,0,0],
    [0,0,0,1,2,2,2,2,2,2,2,2,1,0,0,0],
    [0,0,0,1,2,2,2,2,2,2,2,2,1,0,0,0],
    [0,0,0,1,2,2,2,2,2,2,2,2,1,0,0,0],
    [0,0,0,0,1,2,2,2,2,2,2,1,0,0,0,0],
    [0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0],
    [0,0,0,1,4,4,4,4,4,4,4,4,1,0,0,0],
    [0,0,1,4,4,5,4,4,4,4,5,4,4,1,0,0],
    [0,0,1,4,4,4,4,4,4,4,4,4,4,1,0,0],
    [0,0,1,3,1,4,4,4,4,4,4,1,3,1,0,0],
    [0,0,0,1,0,1,4,4,4,4,1,0,1,0,0,0],
    [0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0],
    [0,0,0,0,0,1,1,0,0,1,1,0,0,0,0,0],
    [0,0,0,0,1,1,1,0,0,1,1,1,0,0,0,0],
    [0,0,0,0,1,1,1,0,0,1,1,1,0,0,0,0],
  ],
  [
    [0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0],
    [0,0,0,0,1,2,2,2,2,2,2,1,0,0,0,0],
    [0,0,0,1,2,2,2,2,2,2,2,2,1,0,0,0],
    [0,0,0,1,2,2,2,2,2,2,2,2,1,0,0,0],
    [0,0,0,1,2,2,2,2,2,2,2,2,1,0,0,0],
    [0,0,0,0,1,2,2,2,2,2,2,1,0,0,0,0],
    [0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0],
    [0,0,0,1,4,4,4,4,4,4,4,4,1,0,0,0],
    [0,0,1,4,4,5,4,4,4,4,5,4,4,1,0,0],
    [0,0,1,4,4,4,4,4,4,4,4,4,4,1,0,0],
    [0,0,1,3,1,4,4,4,4,4,4,1,3,1,0,0],
    [0,0,0,1,0,1,4,4,4,4,1,0,1,0,0,0],
    [0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0],
    [0,0,0,0,1,1,0,0,0,0,1,1,0,0,0,0],
    [0,0,0,1,1,1,0,0,0,0,0,1,1,0,0,0],
    [0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0],
  ],
];

export const COACH_LEFT: number[][][] = [
  [
    [0,0,0,0,0,1,1,1,1,1,0,0,0,0,0,0],
    [0,0,0,0,1,2,2,2,2,2,1,0,0,0,0,0],
    [0,0,0,1,2,2,2,2,2,2,2,1,0,0,0,0],
    [0,0,1,3,3,1,3,3,2,2,2,1,0,0,0,0],
    [0,0,1,3,3,3,3,3,2,2,2,1,0,0,0,0],
    [0,0,0,1,3,1,1,3,3,1,0,0,0,0,0,0],
    [0,0,0,0,1,1,1,1,1,0,0,0,0,0,0,0],
    [0,0,0,1,4,4,4,4,4,4,1,0,0,0,0,0],
    [0,0,1,4,4,5,4,4,4,5,4,1,0,0,0,0],
    [0,0,1,4,4,4,4,4,4,4,4,1,0,0,0,0],
    [0,0,1,3,1,4,4,4,4,1,3,1,0,0,0,0],
    [0,0,0,1,1,4,4,4,4,1,0,0,0,0,0,0],
    [0,0,0,0,1,1,1,1,1,0,0,0,0,0,0,0],
    [0,0,0,0,1,1,0,1,1,0,0,0,0,0,0,0],
    [0,0,0,1,1,1,0,0,1,1,0,0,0,0,0,0],
    [0,0,0,1,1,0,0,0,0,1,1,0,0,0,0,0],
  ],
  [
    [0,0,0,0,0,1,1,1,1,1,0,0,0,0,0,0],
    [0,0,0,0,1,2,2,2,2,2,1,0,0,0,0,0],
    [0,0,0,1,2,2,2,2,2,2,2,1,0,0,0,0],
    [0,0,1,3,3,1,3,3,2,2,2,1,0,0,0,0],
    [0,0,1,3,3,3,3,3,2,2,2,1,0,0,0,0],
    [0,0,0,1,3,1,1,3,3,1,0,0,0,0,0,0],
    [0,0,0,0,1,1,1,1,1,0,0,0,0,0,0,0],
    [0,0,0,1,4,4,4,4,4,4,1,0,0,0,0,0],
    [0,0,1,4,4,5,4,4,4,5,4,1,0,0,0,0],
    [0,0,1,4,4,4,4,4,4,4,4,1,0,0,0,0],
    [0,0,1,3,1,4,4,4,4,1,3,1,0,0,0,0],
    [0,0,0,1,1,4,4,4,4,1,0,0,0,0,0,0],
    [0,0,0,0,1,1,1,1,1,0,0,0,0,0,0,0],
    [0,0,0,1,1,0,0,0,1,1,0,0,0,0,0,0],
    [0,0,1,1,0,0,0,0,0,1,1,0,0,0,0,0],
    [0,0,1,1,0,0,0,0,0,0,1,0,0,0,0,0],
  ],
];

export const COACH_RIGHT: number[][][] = [
  [
    [0,0,0,0,0,0,1,1,1,1,1,0,0,0,0,0],
    [0,0,0,0,0,1,2,2,2,2,2,1,0,0,0,0],
    [0,0,0,0,1,2,2,2,2,2,2,2,1,0,0,0],
    [0,0,0,0,1,2,2,2,3,3,1,3,3,1,0,0],
    [0,0,0,0,1,2,2,2,3,3,3,3,3,1,0,0],
    [0,0,0,0,0,0,1,3,3,1,1,3,1,0,0,0],
    [0,0,0,0,0,0,0,1,1,1,1,1,0,0,0,0],
    [0,0,0,0,0,1,4,4,4,4,4,4,1,0,0,0],
    [0,0,0,0,1,4,5,4,4,4,5,4,4,1,0,0],
    [0,0,0,0,1,4,4,4,4,4,4,4,4,1,0,0],
    [0,0,0,0,1,3,1,4,4,4,4,1,3,1,0,0],
    [0,0,0,0,0,0,1,4,4,4,4,1,1,0,0,0],
    [0,0,0,0,0,0,1,1,1,1,1,0,0,0,0,0],
    [0,0,0,0,0,0,1,1,0,1,1,0,0,0,0,0],
    [0,0,0,0,0,1,1,0,0,0,1,1,1,0,0,0],
    [0,0,0,0,0,1,0,0,0,0,0,1,1,0,0,0],
  ],
  [
    [0,0,0,0,0,0,1,1,1,1,1,0,0,0,0,0],
    [0,0,0,0,0,1,2,2,2,2,2,1,0,0,0,0],
    [0,0,0,0,1,2,2,2,2,2,2,2,1,0,0,0],
    [0,0,0,0,1,2,2,2,3,3,1,3,3,1,0,0],
    [0,0,0,0,1,2,2,2,3,3,3,3,3,1,0,0],
    [0,0,0,0,0,0,1,3,3,1,1,3,1,0,0,0],
    [0,0,0,0,0,0,0,1,1,1,1,1,0,0,0,0],
    [0,0,0,0,0,1,4,4,4,4,4,4,1,0,0,0],
    [0,0,0,0,1,4,5,4,4,4,5,4,4,1,0,0],
    [0,0,0,0,1,4,4,4,4,4,4,4,4,1,0,0],
    [0,0,0,0,1,3,1,4,4,4,4,1,3,1,0,0],
    [0,0,0,0,0,0,1,4,4,4,4,1,1,0,0,0],
    [0,0,0,0,0,0,1,1,1,1,1,0,0,0,0,0],
    [0,0,0,0,0,1,1,0,0,0,1,1,0,0,0,0],
    [0,0,0,0,1,1,0,0,0,0,0,1,1,0,0,0],
    [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],
  ],
];

// NPC athlete sprite — different outfit (tank top/shorts), distinct from coach
export const NPC_SPRITE: number[][] = [
  [0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0],
  [0,0,0,0,1,2,2,2,2,2,2,1,0,0,0,0],
  [0,0,0,1,2,2,2,2,2,2,2,2,1,0,0,0],
  [0,0,0,1,3,3,1,3,3,1,3,3,1,0,0,0],
  [0,0,0,1,3,3,3,3,3,3,3,3,1,0,0,0],
  [0,0,0,0,1,3,3,3,3,3,3,1,0,0,0,0],
  [0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0],
  [0,0,0,0,1,4,4,4,4,4,4,1,0,0,0,0],
  [0,0,0,1,4,4,5,4,4,5,4,4,1,0,0,0],
  [0,0,1,3,1,4,4,4,4,4,4,1,3,1,0,0],
  [0,0,0,1,1,4,4,4,4,4,4,1,1,0,0,0],
  [0,0,0,0,1,4,4,4,4,4,4,1,0,0,0,0],
  [0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0],
  [0,0,0,0,0,1,1,0,0,1,1,0,0,0,0,0],
  [0,0,0,0,1,1,1,0,0,1,1,1,0,0,0,0],
  [0,0,0,0,1,1,1,0,0,1,1,1,0,0,0,0],
];

// Boss battle athlete sprite (32x32 for side view)
// More anatomical detail, athletic pose, limb shading
export const ATHLETE_SPRITE: number[][] = [
  [0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,1,1,2,2,2,2,2,2,2,2,1,1,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,1,2,2,2,2,2,2,2,2,2,2,2,2,1,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,1,2,2,2,2,2,2,2,2,2,2,2,2,1,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,1,3,3,3,1,3,3,3,3,1,3,3,3,1,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,1,3,3,3,3,3,3,3,3,3,3,3,3,1,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,1,3,3,3,3,3,3,3,3,3,3,1,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,1,3,3,1,1,1,1,3,3,1,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,1,4,4,4,4,4,4,4,4,1,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,1,4,4,5,4,4,4,4,5,4,4,1,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,1,4,4,4,4,4,4,4,4,4,4,4,4,1,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,1,4,4,4,4,4,4,4,4,4,4,4,4,4,4,1,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,1,3,1,4,4,4,4,4,4,4,4,4,4,4,4,1,3,1,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,1,3,3,1,4,4,4,4,4,4,4,4,4,4,4,4,1,3,3,1,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,1,1,0,1,4,4,4,4,4,4,4,4,4,4,1,0,1,1,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,1,4,4,4,4,4,4,4,4,4,4,1,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,1,4,4,4,4,4,4,4,4,1,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,1,4,4,4,4,4,4,4,4,1,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,1,1,1,0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,1,1,1,0,0,0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,0],
];

// Sprite color mapping — Pokemon-style with consistent black outlines
export const SPRITE_COLORS: Record<string, string[]> = {
  default:     ['', '#080808', '#384868', '#e0b088', '#3868b8', '#f0f0f0'],
  npc_athlete: ['', '#080808', '#583828', '#e0b088', '#c83030', '#f0d040'],
  boss_player: ['', '#080808', '#283868', '#e0b088', '#3858a8', '#88b8e8'],
  boss_rival:  ['', '#080808', '#582828', '#e0b088', '#a83030', '#e88888'],
};

export const getCoachSprite = (dir: 'up' | 'down' | 'left' | 'right', frame: number): number[][] => {
  const sprites = { down: COACH_DOWN, up: COACH_UP, left: COACH_LEFT, right: COACH_RIGHT };
  const dirSprites = sprites[dir];
  return dirSprites[frame % dirSprites.length]!;
};

// ---- people drawn from text art -------------------------------------------------------------------------------------
// Each letter is a colour index (see the keys below), '.' is see-through. Every row must be as wide as the sprite.

const fromArt = (rows: readonly string[], key: Readonly<Record<string, number>>, width = 16): number[][] =>
  rows.map((row, j) => {
    if (row.length !== width) throw new Error(`sprite row ${j} is ${row.length} wide, not ${width}: ${row}`);
    return [...row].map(ch => key[ch] ?? 0);
  });

const mirrored = (sprite: number[][]): number[][] => sprite.map(row => [...row].reverse());

/**
 * Aisha (Distance Running): dark brown hair in a high ponytail with a yellow tie, a red racing vest with a yellow
 * neckline, navy shorts, bare arms and legs, white running shoes. Indices 1-7 match the Testing Lab's AISHA_COLORS
 * (outline, hair, skin, vest, trim, shorts, shoes), so her side-on frames there and these sprites share one look.
 */
export const AISHA_PALETTE: readonly string[] = [
  '#080808', // outline
  '#583828', // hair
  '#e0b088', // skin
  '#c83030', // vest
  '#f0d040', // trim, hair tie
  '#303848', // shorts
  '#f8f8f0', // shoes, race bib
  '#b86858', // mouth
];
const AISHA_KEY: Readonly<Record<string, number>> = { k: 1, h: 2, s: 3, r: 4, y: 5, d: 6, w: 7, m: 8 };

/** Aisha facing the player: hair framing her face to the jaw, the ponytail swinging out on her left. */
export const AISHA_SPRITE: number[][] = fromArt([
  '.....kkkkkk.....',
  '....khhhhhhkkk..',
  '...khhhhhhhhkyk.',
  '...khhhhhhhhkhhk',
  '...khhsssshhkhhk',
  '...khsksskshk.hk',
  '...khsssssshk.hk',
  '...khhsmmshhk.k.',
  '....khkssk.kk...',
  '...kskryyrksk...',
  '...kskrrrrksk...',
  '...kskrrrrksk...',
  '...ksddddddsk...',
  '....kddkkddk....',
  '....ksk..ksk....',
  '...kwwk..kwwk...',
], AISHA_KEY);

/** Aisha at 32 x 24 for the showdown: the same runner, with a race bib pinned to her vest. */
export const AISHA_BOSS_SPRITE: number[][] = fromArt([
  '...........kkkkkkkk.............',
  '..........khhhhhhhhk..kk........',
  '.........khhhhhhhhhhkkyk........',
  '.........khhhhhhhhhhkkhhk.......',
  '.........khhsssssshhkkhhk.......',
  '.........khsssssssshkkhhk.......',
  '.........khskksskkshk.khk.......',
  '.........khsssssssshk.khk.......',
  '.........khsssmmssshk..khk......',
  '.........khksssssskhk..kk.......',
  '.........khkksssskkhk...........',
  '........kskrryyyyrrksk..........',
  '.......ksskrrrrrrrrkssk.........',
  '.......ksskrwwwwwwrkssk.........',
  '.......ksskrwkwkkwrkssk.........',
  '.......ksskrwwwwwwrkssk.........',
  '.......ksskddddddddkssk.........',
  '........kkkddddddddkkk..........',
  '..........kdddkkdddk............',
  '...........ksskkssk.............',
  '...........ksskkssk.............',
  '...........ksskkssk.............',
  '..........kwwwkkwwwk............',
  '..........kkkk..kkkk............',
], AISHA_KEY, 32);

/** The rival's runner in the Distance Running showdown faces Aisha: the same build, mirrored, in other colours. */
export const AISHA_RIVAL_SPRITE: number[][] = mirrored(AISHA_BOSS_SPRITE);

/**
 * The Performance Director who runs the Sports Performance Centre: short grey hair, a charcoal blazer over a white
 * shirt, a teal staff lanyard with a gold pass, dark trousers and brown shoes. Clearly not the player (blue top)
 * nor an athlete (no kit).
 */
const DIRECTOR_KEY: Readonly<Record<string, number>> = { k: 1, h: 2, s: 3, c: 4, w: 5, t: 6, y: 7, d: 8, b: 9, m: 10 };

const DIRECTOR_DOWN_ART = [
  '.....kkkkkk.....',
  '....khhhhhhk....',
  '...khhhhhhhhk...',
  '...ksssssshhk...',
  '...kssksskssk...',
  '...kssssssssk...',
  '....kssmmssk....',
  '....kkksskkk....',
  '...kcctwwtcck...',
  '..kccctwwtccck..',
  '..kcckcyyckcck..',
  '..kskccccccksk..',
  '...kkkddddkkk...',
  '....kddkkddk....',
  '....kddkkddk....',
  '...kbbbkkbbbk...',
];

const DIRECTOR_UP_ART = [
  '.....kkkkkk.....',
  '....khhhhhhk....',
  '...khhhhhhhhk...',
  '...khhhhhhhhk...',
  '...khhhhhhhhk...',
  '...khhhhhhhhk...',
  '....khhhhhhk....',
  '....kkksskkk....',
  '...kcccttccck...',
  '..kcccccccccck..',
  '..kcckcccckcck..',
  '..kskccccccksk..',
  '...kkkddddkkk...',
  '....kddkkddk....',
  '....kddkkddk....',
  '...kbbbkkbbbk...',
];

const DIRECTOR_LEFT_ART = [
  '.....kkkkkk.....',
  '....khhhhhhk....',
  '...khhhhhhhhk...',
  '..ksssshhhhhk...',
  '..kskssshhhhk...',
  '..ksssssshhk....',
  '...kmssssk......',
  '....kkkssk......',
  '....kwtccck.....',
  '...kwtcccccck...',
  '...kycccckck....',
  '...kkcccckskk...',
  '....kkdddkkk....',
  '.....kddkdk.....',
  '.....kddkdk.....',
  '....kbbbkbbk....',
];

const DIRECTOR_SPRITES = {
  down: fromArt(DIRECTOR_DOWN_ART, DIRECTOR_KEY),
  up: fromArt(DIRECTOR_UP_ART, DIRECTOR_KEY),
  left: fromArt(DIRECTOR_LEFT_ART, DIRECTOR_KEY),
  right: mirrored(fromArt(DIRECTOR_LEFT_ART, DIRECTOR_KEY)),
} as const;

/** The Performance Director facing the player. */
export const DIRECTOR_SPRITE: number[][] = DIRECTOR_SPRITES.down;

/** The Performance Director facing `dir` (one frame each, the same array every call). */
export const getDirectorSprite = (dir: 'up' | 'down' | 'left' | 'right'): number[][] => DIRECTOR_SPRITES[dir];

SPRITE_COLORS['npc_aisha'] = ['', ...AISHA_PALETTE];
SPRITE_COLORS['boss_aisha'] = ['', ...AISHA_PALETTE];
// the rival's runner: fair hair, a royal-blue vest with sky trim, black shorts
SPRITE_COLORS['boss_rival_runner'] = ['', '#080808', '#d8c070', '#e0b088', '#3858a8', '#88b8e8', '#202028', '#f8f8f0', '#b86858'];
SPRITE_COLORS['npc_director'] = [
  '',
  '#080808', // 1 outline
  '#9098a0', // 2 hair (grey)
  '#b07850', // 3 skin
  '#3c3c48', // 4 blazer
  '#f0f0f0', // 5 shirt
  '#30a8a0', // 6 lanyard
  '#f0d040', // 7 pass
  '#26262e', // 8 trousers
  '#704828', // 9 shoes
  '#804838', // 10 mouth
];

// ---- who stands where, by level -------------------------------------------------------------------------------------

/** Distance Running's level index: its athlete is Aisha. */
const AISHA_LEVEL = 3;

/** The level's athlete facing the player (overworld NPC, intro stage). Distance Running: Aisha. */
export const athleteSpriteFor = (level: number): number[][] => (level === AISHA_LEVEL ? AISHA_SPRITE : NPC_SPRITE);

/** Colours for athleteSpriteFor(level). */
export const athleteColorsFor = (level: number): string[] =>
  SPRITE_COLORS[level === AISHA_LEVEL ? 'npc_aisha' : 'npc_athlete']!;

export interface BossLook {
  sprite: number[][];
  colors: string[];
}

const BOSS_LOOKS: Readonly<Record<'classic' | 'aisha', { player: BossLook; rival: BossLook }>> = {
  classic: {
    player: { sprite: ATHLETE_SPRITE, colors: SPRITE_COLORS['boss_player']! },
    rival: { sprite: ATHLETE_SPRITE.map(row => [...row].reverse()), colors: SPRITE_COLORS['boss_rival']! },
  },
  aisha: {
    player: { sprite: AISHA_BOSS_SPRITE, colors: SPRITE_COLORS['boss_aisha']! },
    rival: { sprite: AISHA_RIVAL_SPRITE, colors: SPRITE_COLORS['boss_rival_runner']! },
  },
};

/** The two athletes on the showdown platforms (32 x 24, figure centred on column 14.5; the rival's is mirrored). */
export const bossAthletesFor = (level: number): { player: BossLook; rival: BossLook } =>
  BOSS_LOOKS[level === AISHA_LEVEL ? 'aisha' : 'classic'];
