// Canvas creation per visit: after the first visits every cache is warm, so replays must not create canvases.
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { Button } from '../../src/engine/Input';
vi.mock('../../src/audio/Sfx', () => ({ sfx: { play: () => {}, isMuted: () => false, toggleMuted: () => {} } }));
vi.mock('../../src/ui/announce', () => ({ announce: () => {} }));
const H = await import('./harness');

let created = 0;
beforeAll(() => {
  H.installFakeDom();
  vi.stubGlobal('document', { createElement: () => { created++; return H.makeCanvas(); } });
});

const pick = (rng: () => number): Button => {
  const r = rng();
  return r < 0.5 ? 'a' : r < 0.62 ? 'down' : r < 0.72 ? 'up' : r < 0.86 ? 'left' : 'right';
};

describe('canvas creation', () => {
  it('stops after warm-up', async () => {
    const perVisit: Record<string, number[]> = {};
    for (const room of ['room1', 'room2', 'room3', 'room4']) {
      perVisit[room] = [];
      for (let visit = 0; visit < 25; visit++) {
        const rng = H.seeded(visit * 313 + room.charCodeAt(4));
        vi.spyOn(Math, 'random').mockImplementation(rng);
        const w = await H.makeWorld(3);
        const before = created;
        w.enter(room);
        for (let s = 0; s < 60 * 240; s++) {
          if (rng() < 0.09) w.emu.tap(pick(rng), 1 + Math.floor(rng() * 4));
          w.step(1);
          if (w.current() !== 'roomChallenge') break;
        }
        perVisit[room]!.push(created - before);
        vi.restoreAllMocks();
      }
    }
    if (process.env.FUZZ_LOG) console.log(JSON.stringify(perVisit));
    for (const room of Object.keys(perVisit)) {
      const late = perVisit[room]!.slice(10);
      expect(late.reduce((a, b) => a + b, 0), `${room} still creating canvases late: ${perVisit[room]}`).toBeLessThan(6);
    }
  }, 600000);
});
