// FINDING (minor): START > QUIT TO TITLE throws away a half-done Data Lab clean-up (or a half-planned week, or a locked
// forecast) at once. B asks "Leave the data desk? Your clean-up will be lost." first, but the pause menu's quit
// (src/systems/PauseMenu.ts, choose('quit')) does not, and its own note says PROGRESS SAVES AUTOMATICALLY.
import { beforeAll, describe, expect, it, vi } from 'vitest';
vi.mock('../../src/audio/Sfx', () => ({ sfx: { play: () => {}, isMuted: () => false, toggleMuted: () => {} } }));
vi.mock('../../src/ui/announce', () => ({ announce: () => {} }));
const H = await import('./harness');
beforeAll(() => H.installFakeDom());

describe('pause menu quit in a room with decisions made', () => {
  it('asks before it throws a half-done clean-up away (as B does)', async () => {
    vi.spyOn(Math, 'random').mockImplementation(H.seeded(2));
    const w = await H.makeWorld(3);
    w.enter('room2');
    const d = () => w.scene.debug() as { phase: string; decided: number };
    const tap = (b: 'a' | 'down' | 'start', after = 8) => {
      w.emu.tap(b, 2);
      w.step(2 + after);
    };
    for (let g = 0; g < 600 && d().phase !== 'cleanup'; g++) tap('a', 6);
    for (let g = 0; g < 60 && w.dialogue.isActive(); g++) tap('a', 6);
    w.step(40);
    tap('a', 40); // remove the first suspect: a decision
    expect(d().decided).toBe(1);
    tap('start'); // pause
    expect(w.pauseMenu.isActive()).toBe(true);
    tap('down');
    tap('down');
    tap('down'); // QUIT TO TITLE
    tap('a');
    expect(w.current(), 'the clean-up was thrown away without a question').toBe('roomChallenge');
  });
});
