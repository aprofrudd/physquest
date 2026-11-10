// The player's looks: every frame the right size and colours, the first look the original sport scientist, and the
// look kept in the save (older saves load with the first look).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { COACH_DOWN, COACH_LEFT, COACH_RIGHT, COACH_UP, SPRITE_COLORS } from '../src/data/sprites';
import { LOOK_COUNT, PLAYER_LOOKS, cleanLook, playerColors, playerSprite } from '../src/data/playerLooks';
import { createInitialState } from '../src/state/GameState';
import { applySave, loadSave, saveGame } from '../src/systems/SaveSystem';

const DIRS = ['up', 'down', 'left', 'right'] as const;

describe('player looks', () => {
  it('are 16 by 16 in every facing and frame, using only their own colours', () => {
    for (let look = 0; look < LOOK_COUNT; look++) {
      const colors = playerColors(look);
      for (const dir of DIRS) {
        for (const frame of [0, 1]) {
          const sprite = playerSprite(look, dir, frame);
          expect(sprite).toHaveLength(16);
          for (const row of sprite) {
            expect(row).toHaveLength(16);
            for (const v of row) expect(v === 0 || Boolean(colors[v])).toBe(true);
          }
        }
      }
    }
  });

  it('start with the original sport scientist', () => {
    expect(playerColors(0)).toEqual(SPRITE_COLORS['default']);
    expect(playerSprite(0, 'down', 0)).toBe(COACH_DOWN[0]);
  });

  it('give long hair its own frames', () => {
    const long = PLAYER_LOOKS.findIndex(l => l.hair === 'long');
    expect(long).toBeGreaterThan(0);
    for (const [dir, base] of [['down', COACH_DOWN], ['up', COACH_UP], ['left', COACH_LEFT], ['right', COACH_RIGHT]] as const) {
      expect(playerSprite(long, dir, 0)).not.toEqual(base[0]);
    }
  });

  it('hand drawSprite the same arrays every call (its cache is keyed by the array)', () => {
    expect(playerSprite(3, 'left', 1)).toBe(playerSprite(3, 'left', 1));
    expect(playerColors(3)).toBe(playerColors(3));
  });

  it('are all different, with a description each', () => {
    const keys = PLAYER_LOOKS.map(l => `${l.hair}|${l.colors.join(',')}`);
    expect(new Set(keys).size).toBe(LOOK_COUNT);
    expect(new Set(PLAYER_LOOKS.map(l => l.spoken)).size).toBe(LOOK_COUNT);
  });

  it('treat anything unknown as the first look', () => {
    for (const bad of [-1, LOOK_COUNT, 1.5, '2', null, undefined, NaN]) expect(cleanLook(bad)).toBe(0);
    expect(cleanLook(LOOK_COUNT - 1)).toBe(LOOK_COUNT - 1);
    expect(playerSprite(99, 'down', 0)).toBe(playerSprite(0, 'down', 0));
  });
});

describe('the saved look', () => {
  let store: Record<string, string> = {};
  beforeEach(() => {
    store = {};
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => void (store[k] = v),
      removeItem: (k: string) => void delete store[k],
    });
  });

  it('is kept and restored', () => {
    const state = createInitialState();
    state.playerName = 'ALAN';
    state.playerLook = 4;
    saveGame(state);
    const restored = createInitialState();
    applySave(restored, loadSave()!);
    expect(restored.playerLook).toBe(4);
  });

  it('is the first look for a save made before looks, or a bad value', () => {
    const state = createInitialState();
    state.playerName = 'ALAN';
    saveGame(state);
    const data = JSON.parse(store['physquest_save']!);
    delete data.look;
    store['physquest_save'] = JSON.stringify(data);
    expect(loadSave()?.look).toBe(0);
    store['physquest_save'] = JSON.stringify({ ...data, look: 42 });
    expect(loadSave()?.look).toBe(0);
    store['physquest_save'] = JSON.stringify({ version: 1, playerName: 'ALAN', bossDefeated: [false, false, false, false], gameComplete: false });
    expect(loadSave()?.look).toBe(0);
  });
});
