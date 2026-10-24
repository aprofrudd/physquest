// The Data Lab's LOCK IN row ignores A for 0.35 s after the cursor lands on it (locking in cannot be undone), and that
// wait belongs to LOCK IN alone: the pin rows keep answering at once (both found by the verification reviews).
import { beforeAll, describe, expect, it, vi } from 'vitest';
vi.mock('../../src/audio/Sfx', () => ({ sfx: { play: () => {}, isMuted: () => false, toggleMuted: () => {} } }));
vi.mock('../../src/ui/announce', () => ({ announce: () => {} }));
const H = await import('./harness');
beforeAll(() => H.installFakeDom());

describe('Data Lab LOCK IN row', () => {
  it('does not lock in the pins on an A pressed one step after the cursor lands on it', async () => {
    vi.spyOn(Math, 'random').mockImplementation(H.seeded(11));
    const w = await H.makeWorld(3);
    w.enter('room2');
    const d = () => w.scene.debug() as { phase: string; cursor: number; pins: unknown[] };
    const tap = (b: 'a' | 'down' | 'right', after = 8) => {
      w.emu.tap(b, 1);
      w.step(1 + after);
    };
    for (let g = 0; g < 600 && d().phase !== 'cleanup'; g++) tap('a', 6);
    for (let g = 0; g < 60 && d().phase === 'cleanup'; g++) {
      if (w.dialogue.isActive()) tap('a', 6);
      else {
        w.step(30);
        tap('a', 30); // decide (the answers do not matter here)
        w.step(30);
        tap('a', 30); // continue to the next suspect
      }
    }
    for (let g = 0; g < 100 && w.dialogue.isActive(); g++) tap('a', 6);
    expect(d().phase).toBe('pin');
    w.step(60);
    for (let i = 0; i < 3; i++) {
      tap('a', 30); // pin the row under the cursor
      tap('down', 30);
    }
    expect(d().pins.length).toBe(3);
    while (d().cursor < 4) tap('down', 30); // on the last variable
    w.step(60);
    // DOWN lands on LOCK IN; an A one step later must not commit it
    w.emu.tap('down', 1);
    w.step(1);
    expect(d().cursor).toBe(5);
    w.emu.tap('a', 1);
    w.step(2);
    expect(d().phase, 'locked in unseen').toBe('pin');
    // Straight back up to a pinned row: an A there (well inside LOCK IN's wait) unpins it at once
    for (let i = 0; i < 3; i++) {
      w.emu.tap('up', 1);
      w.step(1);
    }
    expect(d().cursor).toBe(2); // rows 0-2 hold the pins
    w.emu.tap('a', 1);
    w.step(2);
    expect(d().pins.length, 'pin row ignored A').toBe(2);
    // Pin it again (after the toggle's own short lock), then LOCK IN after its wait locks in
    w.step(20);
    tap('a', 30);
    expect(d().pins.length).toBe(3);
    for (let g = 0; g < 8 && d().cursor < 5; g++) tap('down', 30);
    expect(d().cursor).toBe(5);
    tap('a', 30);
    expect(d().phase).toBe('reveal');
  });
});
