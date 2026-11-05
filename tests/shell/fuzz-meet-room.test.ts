// Fuzz the real RoomChallengeScene with the ATHLETE room: random buttons (with holds and auto-repeat), the pause menu,
// B at any moment, leaving and re-entering. Looks for exceptions, non-finite drawing numbers, dead ends, and any change
// to the four stats or the room progress (the overview must never feed them). FUZZ_SEEDS=400 for a long soak.
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Button } from '../../src/engine/Input';

vi.mock('../../src/audio/Sfx', () => ({ sfx: { play: () => {}, isMuted: () => false, toggleMuted: () => {} } }));
vi.mock('../../src/ui/announce', () => ({ announce: () => {} }));

const H = await import('./harness');
const GS = await import('../../src/state/GameState');

beforeAll(() => {
  H.installFakeDom();
});
afterEach(() => {
  vi.restoreAllMocks();
});

type Mode = 'mash' | 'wander' | 'chaos';

const pick = (rng: () => number, mode: Mode): Button => {
  const r = rng();
  if (mode === 'mash') return r < 0.6 ? 'a' : r < 0.75 ? 'down' : r < 0.85 ? 'up' : r < 0.925 ? 'left' : 'right';
  if (mode === 'wander') return r < 0.3 ? 'a' : r < 0.45 ? 'down' : r < 0.6 ? 'up' : r < 0.75 ? 'left' : r < 0.93 ? 'right' : r < 0.96 ? 'b' : 'start';
  return r < 0.18 ? 'a' : r < 0.3 ? 'down' : r < 0.42 ? 'up' : r < 0.54 ? 'left' : r < 0.66 ? 'right' : r < 0.78 ? 'b' : r < 0.9 ? 'start' : 'select';
};

const MAX_STEPS = 60 * 60 * 6;
const SEEDS = Number(process.env.FUZZ_SEEDS ?? 6);

const playSeed = async (seed: number, mode: Mode) => {
  const rng = H.seeded(seed * 7919 + 77);
  vi.spyOn(Math, 'random').mockImplementation(rng);
  const w = await H.makeWorld(3);
  let stuck = 0;
  let completes = 0;
  for (let visit = 0; visit < 3; visit++) {
    w.log.switches.length = 0;
    const before = w.log.completes;
    w.enter('meet');
    let steps = 0;
    let left = false;
    const p = mode === 'mash' ? 0.12 : 0.07;
    while (steps < MAX_STEPS) {
      if (rng() < p) {
        const hold = rng() < 0.1 ? 20 + Math.floor(rng() * 90) : 1 + Math.floor(rng() * 6);
        w.emu.tap(pick(rng, mode), hold);
      }
      w.step(1);
      steps++;
      if (w.current() !== 'roomChallenge') {
        left = true;
        break;
      }
    }
    if (!left) {
      stuck++;
      break;
    }
    if (w.log.completes > before) completes++;
    for (const b of ['a', 'b', 'up', 'down', 'left', 'right', 'start', 'select'] as Button[]) w.emu.tap(b, 1);
    w.step(2);
    if (w.pauseMenu.isActive()) w.pauseMenu.close();
  }
  expect(w.gameState.playerStats).toEqual(GS.freshStats());
  expect(w.gameState.roomProgress).toEqual(GS.freshRoomProgress());
  const meet = GS.meetOf(w.gameState);
  expect(meet.best).toBeLessThanOrEqual(meet.of);
  if (completes > 0) expect(meet.met).toBe(true);
  return stuck;
};

describe('fuzz the ATHLETE room', () => {
  for (const mode of ['mash', 'wander', 'chaos'] as Mode[]) {
    it(`${mode}: no exceptions, no bad numbers, no dead ends, no stat changes`, async () => {
      H.problems.length = 0;
      let stuck = 0;
      for (let seed = 1; seed <= SEEDS; seed++) stuck += await playSeed(seed, mode);
      expect(H.problems.slice(0, 5)).toEqual([]);
      expect(stuck).toBe(0);
    }, 600000);
  }
});
