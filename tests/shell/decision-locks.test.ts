// Looks for A presses that change an instrument's decision state within 0.3 s of the previous change (a missing 0.35 s lock).
import { beforeAll, describe, it, vi } from 'vitest';
vi.mock('../../src/audio/Sfx', () => ({ sfx: { play: () => {}, isMuted: () => false, toggleMuted: () => {} } }));
vi.mock('../../src/ui/announce', () => ({ announce: () => {} }));
const H = await import('./harness');
beforeAll(() => H.installFakeDom());

type Dbg = Record<string, unknown>;
const sig = (room: string, d: Dbg): string => {
  switch (room) {
    case 'room1': return JSON.stringify([d.phase, d.chosen]);
    case 'room2': return JSON.stringify([d.phase, d.view, d.decided]);
    case 'room3': return JSON.stringify([d.phase, d.debriefAt]);
    default: return JSON.stringify([d.step, d.phase, (d.verdicts as unknown[] | undefined)?.length]);
  }
};

describe('locks', () => {
  it('reports quick A-driven changes', async () => {
    const found = new Map<string, number>();
    for (const room of ['room1', 'room2', 'room3', 'room4']) {
      for (let seed = 1; seed <= 120; seed++) {
        const rng = H.seeded(seed * 3571 + room.charCodeAt(4));
        vi.spyOn(Math, 'random').mockImplementation(rng);
        const w = await H.makeWorld(3);
        w.enter(room);
        let last = sig(room, w.scene.debug() as Dbg);
        let lastChangeStep = 0;
        for (let s = 1; s < 60 * 150; s++) {
          const pressA = rng() < 0.2; // a fast masher: about 12 presses a second
          const dir = !pressA && rng() < 0.08 ? (['up', 'down', 'left', 'right'] as const)[Math.floor(rng() * 4)]! : null;
          const dialogueBefore = w.dialogue.isActive();
          if (pressA) w.emu.tap('a', 1);
          else if (dir) w.emu.tap(dir, 1);
          w.step(1);
          if (w.current() !== 'roomChallenge') break;
          const now = sig(room, (w.scene.debug() as Dbg) ?? {});
          if (now !== last) {
            const dt = (s - lastChangeStep) / 60;
            if (pressA && !dialogueBefore && dt < 0.3) {
              const key = `${room}: ${last}  ->  ${now}  (after ${dt.toFixed(2)} s)`;
              found.set(key.replace(/\(after [0-9.]+ s\)/, ''), (found.get(key.replace(/\(after [0-9.]+ s\)/, '')) ?? 0) + 1);
            }
            last = now;
            lastChangeStep = s;
          }
        }
        vi.restoreAllMocks();
      }
    }
    const rows = [...found.entries()].sort((a, b) => b[1] - a[1]);
    if (process.env.FUZZ_LOG) console.log(rows.length, 'distinct quick A-driven changes');
    for (const [k, n] of rows.slice(0, 60)) console.log(String(n).padStart(5), k.slice(0, 230));
  }, 600000);
});
