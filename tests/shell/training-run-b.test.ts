// B during the Training Floor's ~9 s run asks before throwing the week away, like B everywhere else in the room
// (found by the verification review: it used to do nothing).
import { beforeAll, describe, expect, it, vi } from 'vitest';
vi.mock('../../src/audio/Sfx', () => ({ sfx: { play: () => {}, isMuted: () => false, toggleMuted: () => {} } }));
vi.mock('../../src/ui/announce', () => ({ announce: () => {} }));
const H = await import('./harness');
beforeAll(() => H.installFakeDom());

describe('Training Floor: B during the run', () => {
  it('asks before leaving', async () => {
    vi.spyOn(Math, 'random').mockImplementation(H.seeded(3));
    const w = await H.makeWorld(3);
    w.enter('room3');
    const state = () => w.scene.debug() as { phase: string; runDay: number | null };
    const tap = (b: 'a' | 'b' | 'down' | 'left', after = 6) => {
      w.emu.tap(b, 2);
      w.step(2 + after);
    };
    for (let g = 0; g < 200 && w.dialogue.isActive(); g++) tap('a', 10); // the rules
    expect(state().phase).toBe('plan');
    w.step(30);
    tap('down'); // a session on Monday
    tap('left'); // wraps to GO
    w.step(30);
    tap('a'); // "Run the week?" (key sessions are missing, so NO comes first)
    for (let g = 0; g < 900 && !(w.dialogue.state.choices && w.dialogue.state.waitingForInput); g++) w.step(1);
    w.step(30); // the list's 0.35 s lock
    expect(w.dialogue.state.choices).toEqual(['NO', 'YES']);
    tap('down');
    tap('a'); // YES
    w.step(30);
    expect(state().phase).toBe('run');
    const dayBefore = state().runDay;
    w.step(40); // the week is under way
    expect(state().runDay).not.toBe(dayBefore);
    tap('b', 4); // one B press
    expect(w.current()).toBe('roomChallenge');
    expect(w.dialogue.isActive(), 'B put no question up').toBe(true);
    expect(w.dialogue.state.choices).toEqual(['STAY', 'LEAVE']);
  });
});
