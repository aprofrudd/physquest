// Fuzz the real RoomChallengeScene with each redesigned room: random buttons (with holds and auto-repeat), the pause
// menu, B at any moment, leaving and re-entering. Looks for exceptions, non-finite drawing numbers, double completion
// and dead ends (a visit that neither completes nor can be left within a generous time).
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Button } from '../../src/engine/Input';

const announced: string[] = [];
vi.mock('../../src/audio/Sfx', () => ({ sfx: { play: () => {}, isMuted: () => false, toggleMuted: () => {} } }));
vi.mock('../../src/ui/announce', () => ({ announce: (t: string) => void announced.push(t) }));

const H = await import('./harness');

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

interface Outcome {
  room: string;
  seed: number;
  mode: Mode;
  visits: number;
  completes: number;
  leaves: number;
  timeouts: number;
  titles: number;
  detail: string[];
}

const MAX_STEPS = 60 * 60 * 6; // six minutes of play per visit

const playSeed = async (room: string, seed: number, mode: Mode, LEVEL: number): Promise<Outcome> => {
  const rng = H.seeded(seed * 7919 + room.charCodeAt(4));
  vi.spyOn(Math, 'random').mockImplementation(rng);
  const w = await H.makeWorld(LEVEL);
  const out: Outcome = { room, seed, mode, visits: 0, completes: 0, leaves: 0, timeouts: 0, titles: 0, detail: [] };
  for (let visit = 0; visit < 3; visit++) {
    out.visits++;
    w.log.switches.length = 0;
    const before = w.log.completes;
    w.enter(room);
    let steps = 0;
    let left = false;
    // P(press per step): a human mashes about 5-8 presses a second at the most
    const p = mode === 'mash' ? 0.12 : 0.07;
    while (steps < MAX_STEPS) {
      if (rng() < p) {
        const b = pick(rng, mode);
        const hold = rng() < 0.1 ? 20 + Math.floor(rng() * 90) : 1 + Math.floor(rng() * 6);
        w.emu.tap(b, hold);
      }
      w.step(1);
      steps++;
      if (w.current() !== 'roomChallenge') {
        left = true;
        break;
      }
    }
    if (!left) {
      out.timeouts++;
      out.detail.push(`visit ${visit}: still in ${room} after ${steps} steps; instrument=${JSON.stringify(w.scene.debug()).slice(0, 300)}; dialogue=${w.dialogue.isActive() ? JSON.stringify(w.dialogue.state.pages) : 'idle'}; pause=${w.pauseMenu.isActive()}`);
      break;
    }
    if (w.log.completes > before) out.completes++;
    else if (w.log.switches.includes('title')) out.titles++;
    else out.leaves++;
    // the scene handed back control; release everything for the next visit
    for (const b of ['a', 'b', 'up', 'down', 'left', 'right', 'start', 'select'] as Button[]) w.emu.tap(b, 1);
    w.step(2);
    if (w.pauseMenu.isActive()) w.pauseMenu.close();
    // A room can only be replayed from the hub; the harness opens it directly
  }
  // invariants after all visits
  expect(w.gameState.challengeResults.length, 'a challengeResults entry per recorded completion').toBeGreaterThanOrEqual(w.log.completes);
  for (const k of Object.keys(w.gameState.playerStats) as (keyof typeof w.gameState.playerStats)[]) {
    const v = w.gameState.playerStats[k];
    expect(Number.isFinite(v) && v >= 0 && v <= 1, `${k} stat ${v}`).toBe(true);
  }
  return out;
};

const ROOMS = ['room1', 'room2', 'room3', 'room4'];
const SEEDS = Number(process.env.FUZZ_SEEDS ?? 6); // FUZZ_SEEDS=400 for a long soak

// Levels 1-3 always play the classic rooms
describe.each([0, 1, 2].flatMap(LEVEL => ROOMS.map(room => ({ LEVEL, room }))))('fuzz classic rooms: level $LEVEL $room', ({ LEVEL, room }) => {
  for (const mode of ['mash', 'wander', 'chaos'] as Mode[]) {
    it(`${mode}: no exceptions, no bad numbers, no dead ends`, async () => {
      H.problems.length = 0;
      const outcomes: Outcome[] = [];
      for (let seed = 1; seed <= SEEDS; seed++) outcomes.push(await playSeed(room, seed, mode, LEVEL));
      const total = outcomes.reduce((n, o) => ({ completes: n.completes + o.completes, leaves: n.leaves + o.leaves, titles: n.titles + o.titles, timeouts: n.timeouts + o.timeouts, visits: n.visits + o.visits }), { completes: 0, leaves: 0, titles: 0, timeouts: 0, visits: 0 });
      if (process.env.FUZZ_LOG) console.log(`CLASSIC L${LEVEL} ${room} ${mode}`, JSON.stringify(total));
      const stuck = outcomes.filter(o => o.timeouts > 0);
      if (stuck.length) console.log(stuck.map(s => `seed ${s.seed}: ${s.detail.join(' | ')}`).join('\n'));
      expect(H.problems.slice(0, 5)).toEqual([]);
      // a random player may never finish, but must not be stuck for ever in "mash" mode (A-heavy) if B works
      expect(stuck.length, `stuck seeds ${stuck.map(s => s.seed).join(',')}`).toBe(0);
    }, 600000);
  }
});
