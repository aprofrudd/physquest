// Only the sports in PLAYABLE_LEVELS can be picked: the others show as COMING SOON, the cursor skips them,
// and the game counts as complete once every playable sport is cleared.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { InputState } from '../../src/engine/Input';

const H = vi.hoisted(() => ({ drawn: [] as string[], announced: [] as string[] }));

vi.mock('../../src/audio/Sfx', () => ({ sfx: { play: () => {}, isMuted: () => false, toggleMuted: () => {} } }));
vi.mock('../../src/ui/announce', () => ({ announce: (t: string) => void H.announced.push(t) }));
vi.mock('../../src/render/PixelFont', async importOriginal => {
  const real = await importOriginal<typeof import('../../src/render/PixelFont')>();
  return { ...real, drawText: (_ctx: unknown, text: string) => void H.drawn.push(text) };
});
vi.mock('../../src/render/SpriteSheet', () => ({ drawPokemonBox: () => {} }));

import { createLevelSelectScene } from '../../src/scenes/LevelSelectScene';
import { createInitialState } from '../../src/state/GameState';
import { PLAYABLE_LEVELS, allPlayableCleared, levelPlayable } from '../../src/data/levels';
import { LEVEL_DATA } from '../../src/data/sports';
import type { Input } from '../../src/engine/Input';
import type { SceneManager } from '../../src/engine/SceneManager';

const RUNNING = LEVEL_DATA.findIndex(l => l.sport === 'Distance Running');

const idle = (): InputState => {
  const s: Record<string, boolean> = {};
  for (const k of ['up', 'down', 'left', 'right', 'a', 'b', 'start', 'select']) {
    s[k] = false;
    s[`${k}Pressed`] = false;
  }
  for (const k of ['upRepeat', 'downRepeat', 'leftRepeat', 'rightRepeat', 'action', 'actionPressed', 'escape', 'escapePressed']) s[k] = false;
  return s as unknown as InputState;
};

const setup = (prepare: (state: ReturnType<typeof createInitialState>) => void = () => {}) => {
  let next = idle();
  const input = { read: () => { const r = next; next = idle(); return r; }, fill: (t: string) => t } as unknown as Input;
  const state = createInitialState();
  state.playerName = 'TEST';
  prepare(state);
  const picked: number[] = [];
  const scene = createLevelSelectScene(input, { switchTo: () => {} } as unknown as SceneManager, state, l => void picked.push(l));
  scene.onEnter?.();
  const press = (fields: Partial<InputState>) => {
    next = { ...idle(), ...fields };
    scene.update(1 / 60);
  };
  for (let i = 0; i < 30; i++) scene.update(1 / 60); // past the entry lock
  return { scene, press, picked, state };
};

beforeEach(() => {
  H.drawn.length = 0;
  H.announced.length = 0;
});

describe('level lock', () => {
  it('only Distance Running is playable', () => {
    expect([...PLAYABLE_LEVELS]).toEqual([RUNNING]);
  });

  it('starts on Distance Running and the cursor never leaves it', () => {
    const { press, picked } = setup();
    for (let i = 0; i < 5; i++) press({ downRepeat: true, downPressed: true });
    press({ upRepeat: true, upPressed: true });
    press({ aPressed: true, a: true });
    expect(picked).toEqual([RUNNING]);
  });

  it('a save left in a locked sport still opens on Distance Running', () => {
    const { press, picked } = setup(state => {
      state.currentLevel = 0;
      state.levelProgress[0] = { roomProgress: { testSelection: true, variableId: false, trainingPrescription: false, performancePrediction: false }, playerStats: { speed: 1, strength: 0, endurance: 0, power: 0 } };
    });
    press({ startPressed: true, start: true });
    expect(picked).toEqual([RUNNING]);
  });

  it('shows the other sports as COMING SOON', () => {
    const { scene } = setup();
    scene.render({ fillRect() {}, set fillStyle(_v: unknown) {} } as unknown as CanvasRenderingContext2D);
    const locked = LEVEL_DATA.filter((_, i) => !levelPlayable(i)).length;
    expect(H.drawn.filter(t => t === 'COMING SOON')).toHaveLength(locked);
  });

  it('the game is complete once Distance Running is cleared', () => {
    const beaten = [false, false, false, false];
    expect(allPlayableCleared(beaten)).toBe(false);
    beaten[RUNNING] = true;
    expect(allPlayableCleared(beaten)).toBe(true);
  });
});
