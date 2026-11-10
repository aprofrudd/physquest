// LEFT in the dialogue box goes back a page (and back to the previous line of a sequence), so a page skipped by
// accident can be read again without starting the conversation over.
import { describe, expect, it, vi } from 'vitest';
import type { InputState } from '../src/engine/Input';

vi.mock('../src/audio/Sfx', () => ({ sfx: { play: () => {} } }));
vi.mock('../src/ui/announce', () => ({ announce: () => {} }));
const { createDialogueSystem } = await import('../src/systems/Dialogue');

const press = (field: 'aPressed' | 'bPressed' | 'leftPressed'): InputState => ({ [field]: true }) as unknown as InputState;
const none = {} as unknown as InputState;
const LONG = Array.from({ length: 60 }, (_, i) => `word${i}`).join(' '); // several pages

const text = (d: ReturnType<typeof createDialogueSystem>) => d.state.pages[d.state.page]!.join(' ');

describe('dialogue BACK (LEFT)', () => {
  it('goes back a page within one text, shown in full at once', () => {
    const d = createDialogueSystem();
    d.show(LONG);
    expect(d.state.pages.length).toBeGreaterThan(2);
    const first = text(d);
    d.update(0.016, press('aPressed')); // finish typing
    d.update(0.016, press('aPressed')); // page 2
    expect(d.state.page).toBe(1);
    d.update(0.016, press('leftPressed'));
    expect(d.state.page).toBe(0);
    expect(text(d)).toBe(first);
    expect(d.state.waitingForInput).toBe(true);
    expect(d.state.charIndex).toBe(d.state.pages[0]!.join('').length);
  });

  it('on the first page of a line, goes back to the previous line of the sequence, on its last page', () => {
    const d = createDialogueSystem();
    const done = vi.fn();
    d.showSequence([LONG, 'Second line.', 'Third line.'], done);
    const lastPageOfFirst = d.state.pages.length - 1;
    // through the long first line to the second
    for (let i = 0; i < 20 && text(d) !== 'Second line.'; i++) d.update(0.016, press('aPressed'));
    expect(text(d)).toBe('Second line.');
    d.update(0.016, press('leftPressed'));
    expect(d.state.page).toBe(lastPageOfFirst);
    expect(d.state.waitingForInput).toBe(true);
    // A goes forward again, and the sequence still finishes
    d.update(0.016, press('aPressed'));
    expect(text(d)).toBe('Second line.');
    for (let i = 0; i < 10 && d.isActive(); i++) d.update(0.016, press('aPressed'));
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('does nothing on the very first page, and B still leaves', () => {
    const d = createDialogueSystem();
    const left = vi.fn();
    d.showSequence(['One.', 'Two.'], undefined, left);
    d.update(0.016, press('leftPressed'));
    expect(text(d)).toBe('One.');
    d.update(0.016, none);
    d.update(0.016, press('bPressed'));
    expect(d.isActive()).toBe(false);
    expect(left).toHaveBeenCalledTimes(1);
  });

  it('crosses to the caller onBack from the first line (e.g. the previous speaker)', () => {
    const d = createDialogueSystem();
    const back = vi.fn();
    d.showSequence(['Hers.'], undefined, undefined, { onBack: back });
    d.update(0.016, press('leftPressed'));
    expect(back).toHaveBeenCalledTimes(1);
  });
});
