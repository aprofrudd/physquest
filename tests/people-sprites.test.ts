// Aisha's and the Performance Director's sprites: their shapes, their colours and the level-aware accessors.
import { describe, expect, it } from 'vitest';
import {
  AISHA_BOSS_SPRITE,
  AISHA_PALETTE,
  AISHA_RIVAL_SPRITE,
  AISHA_SPRITE,
  ATHLETE_SPRITE,
  DIRECTOR_SPRITE,
  NPC_SPRITE,
  SPRITE_COLORS,
  athleteColorsFor,
  athleteSpriteFor,
  bossAthletesFor,
  getDirectorSprite,
} from '../src/data/sprites';
import { AISHA_COLORS, AISHA_SPRITE_COLORS, RUN_FRAMES, RUN_SPRITES } from '../src/rooms/testing/people';

const DIRS = ['up', 'down', 'left', 'right'] as const;

const expectShape = (sprite: number[][], w: number, h: number, colors: readonly string[]) => {
  expect(sprite).toHaveLength(h);
  for (const row of sprite) {
    expect(row).toHaveLength(w);
    for (const v of row) expect(v === 0 || Boolean(colors[v])).toBe(true);
  }
  // feet on the bottom row, so nobody floats
  expect(sprite[h - 1]!.some(v => v !== 0)).toBe(true);
};

describe('Aisha', () => {
  it('is 16 by 16 in the overworld and 32 by 24 in the showdown, using only her colours', () => {
    expectShape(AISHA_SPRITE, 16, 16, SPRITE_COLORS['npc_aisha']!);
    expectShape(AISHA_BOSS_SPRITE, 32, 24, SPRITE_COLORS['boss_aisha']!);
    expectShape(AISHA_RIVAL_SPRITE, 32, 24, SPRITE_COLORS['boss_rival_runner']!);
    expect(AISHA_RIVAL_SPRITE).toEqual(AISHA_BOSS_SPRITE.map(row => [...row].reverse()));
  });

  it('shares one palette with her Testing Lab frames, everywhere she is drawn with drawSprite', () => {
    expect(AISHA_COLORS).toEqual(AISHA_PALETTE.slice(0, 7));
    expect(AISHA_SPRITE_COLORS).toEqual(['', ...AISHA_PALETTE]);
    expect(SPRITE_COLORS['npc_aisha']).toEqual(AISHA_SPRITE_COLORS);
    RUN_SPRITES.forEach((sprite, i) => {
      expectShape(sprite, 16, 16, AISHA_SPRITE_COLORS);
      expect(sprite).toEqual(RUN_FRAMES[i]!.map(row => row.map(v => (v < 0 ? 0 : v + 1))));
    });
  });

  it('has the ponytail tie and the mouth that set her apart from the classic athlete', () => {
    const flat = AISHA_SPRITE.flat();
    expect(flat).toContain(5); // yellow tie and neckline
    expect(flat).toContain(8); // mouth
    expect(flat).toContain(6); // shorts
    expect(AISHA_SPRITE).not.toEqual(NPC_SPRITE);
  });
});

describe('the Performance Director', () => {
  it('faces all four ways in 16 by 16 frames using only the director colours, the same array every call', () => {
    for (const dir of DIRS) {
      const sprite = getDirectorSprite(dir);
      expectShape(sprite, 16, 16, SPRITE_COLORS['npc_director']!);
      expect(getDirectorSprite(dir)).toBe(sprite);
    }
    expect(getDirectorSprite('down')).toBe(DIRECTOR_SPRITE);
    expect(getDirectorSprite('right')).toEqual(getDirectorSprite('left').map(row => [...row].reverse()));
  });

  it('wears a lanyard with a pass, and no athlete or player colours for top or hair', () => {
    const flat = DIRECTOR_SPRITE.flat();
    expect(flat).toContain(6);
    expect(flat).toContain(7);
    const d = SPRITE_COLORS['npc_director']!;
    for (const other of [SPRITE_COLORS['default']!, SPRITE_COLORS['npc_aisha']!]) {
      expect(d[4]).not.toBe(other[4]);
      expect(d[2]).not.toBe(other[2]);
    }
  });
});

describe('who is drawn, by level', () => {
  it('draws Aisha for Distance Running and keeps the classic athlete elsewhere', () => {
    expect(athleteSpriteFor(3)).toBe(AISHA_SPRITE);
    expect(athleteColorsFor(3)).toBe(SPRITE_COLORS['npc_aisha']);
    for (const level of [0, 1, 2]) {
      expect(athleteSpriteFor(level)).toBe(NPC_SPRITE);
      expect(athleteColorsFor(level)).toBe(SPRITE_COLORS['npc_athlete']);
      expect(bossAthletesFor(level).player.sprite).toBe(ATHLETE_SPRITE);
      expect(bossAthletesFor(level).player.colors).toBe(SPRITE_COLORS['boss_player']);
      expect(bossAthletesFor(level).rival.colors).toBe(SPRITE_COLORS['boss_rival']);
    }
    expect(bossAthletesFor(3).player.sprite).toBe(AISHA_BOSS_SPRITE);
    expect(bossAthletesFor(3).rival.sprite).toBe(AISHA_RIVAL_SPRITE);
    expect(bossAthletesFor(3)).toBe(bossAthletesFor(3)); // made once, no allocation per frame
  });
});
