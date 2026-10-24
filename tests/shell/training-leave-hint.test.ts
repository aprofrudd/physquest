// With 'Leave now? This week will be lost.' up during the run, the run keeps its picture but draws no hint tag of its own under
// the question's (found by the third verification round).
import { beforeAll, describe, expect, it, vi } from 'vitest';
vi.mock('../../src/audio/Sfx', () => ({ sfx: { play: () => {}, isMuted: () => false, toggleMuted: () => {} } }));
vi.mock('../../src/ui/announce', () => ({ announce: () => {} }));
const drawn: { hint: string | undefined; leaving: boolean }[] = [];
let leavingNow = () => false;
vi.mock('../../src/render/DialogueBox', async importOriginal => {
  const real = await importOriginal<typeof import('../../src/render/DialogueBox')>();
  return {
    ...real,
    drawPromptBox: (ctx: CanvasRenderingContext2D, text: string | readonly string[], hint?: string, colors?: readonly (string | undefined)[]) => {
      drawn.push({ hint, leaving: leavingNow() });
      real.drawPromptBox(ctx, text, hint, colors);
    },
  };
});
const H = await import('./../shell/harness');
beforeAll(() => H.installFakeDom());

describe('Training Floor: the run, with the leave question up', () => {
  it('draws no second hint tag under the dialogue box', async () => {
    vi.spyOn(Math, 'random').mockImplementation(H.seeded(3));
    const w = await H.makeWorld(3);
    w.enter('room3');
    const state = () => w.scene.debug() as { phase: string; leaving: boolean; runDay: number | null };
    leavingNow = () => w.scene.debug() !== null && (state().leaving === true);
    const tap = (b: 'a' | 'b' | 'down' | 'left', after = 6) => {
      w.emu.tap(b, 2);
      w.step(2 + after);
    };
    for (let g = 0; g < 200 && w.dialogue.isActive(); g++) tap('a', 10); // the rules
    expect(state().phase).toBe('plan');
    w.step(30);
    tap('down');
    tap('left');
    w.step(30);
    tap('a');
    for (let g = 0; g < 900 && !(w.dialogue.state.choices && w.dialogue.state.waitingForInput); g++) w.step(1);
    w.step(30);
    tap('down');
    tap('a'); // YES
    w.step(30);
    expect(state().phase).toBe('run');
    w.step(40);
    // before the question: the run shows its hint (control)
    drawn.length = 0;
    w.step(3);
    expect(drawn.some(d => d.hint?.includes('FAST-FORWARD')), 'the run draws its hint').toBe(true);
    tap('b', 4);
    expect(state().leaving).toBe(true);
    expect(w.dialogue.isActive()).toBe(true);
    drawn.length = 0;
    w.step(5);
    const withHint = drawn.filter(d => d.leaving && d.hint);
    expect(withHint.map(d => d.hint), 'a hint tag is drawn beneath the leave question').toEqual([]);
  });
});
