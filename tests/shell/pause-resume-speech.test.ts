// Round 3 (regress). FINDING R3-REG-2 (polish): "Resumed." re-reads only the PAGE that was on screen (PauseMenu.resume: s.pages[s.page]).
// A text that runs over to a second page is cut mid-sentence at the page break, so pausing on page 2 and resuming says
// "Resumed. and critical power for race performance." The dialogue itself announces the WHOLE text when it opens (DialogueBox.startDialogue)
// precisely so that no sentence is read from its middle. The control test (a one-page text) passes; the second one fails on purpose.
import { beforeAll, describe, expect, it, vi } from 'vitest';
vi.mock('../../src/audio/Sfx', () => ({ sfx: { play: () => {}, isMuted: () => false, toggleMuted: () => {} } }));
const said: string[] = [];
vi.mock('../../src/ui/announce', () => ({ announce: (t: string) => void said.push(t) }));
const H = await import('../shell/harness');
beforeAll(() => H.installFakeDom());

const waitTyped = (w: Awaited<ReturnType<typeof H.makeWorld>>) => {
  for (let g = 0; g < 900 && !w.dialogue.state.waitingForInput; g++) w.step(1);
};

describe('"Resumed." in a classic room (Cycling, level 2) that opens with a two-page profile', () => {
  it('paused on the first page of two, it says the whole text', async () => {
    const w = await H.makeWorld(1);
    w.enter('room1');
    waitTyped(w);
    expect(w.dialogue.state.pages.length, 'the Cycling profile has two pages').toBe(2);
    const whole = w.dialogue.state.pages.map(p => p.join(' ')).join(' ');
    said.length = 0;
    w.press('start', 2, 4);
    w.press('b', 2, 4);
    expect(said.find(s => s.startsWith('Resumed.'))).toBe(`Resumed. ${whole}`);
  });

  it('paused on the SECOND page it says the whole text (as when the dialogue opened), not a fragment that starts mid-sentence', async () => {
    const w = await H.makeWorld(1);
    w.enter('room1');
    waitTyped(w);
    const whole = w.dialogue.state.pages.map(p => p.join(' ')).join(' ');
    w.press('a', 2, 6); // next page
    expect(w.dialogue.state.page).toBe(1);
    said.length = 0;
    w.press('start', 2, 4);
    w.press('b', 2, 4);
    expect(said.find(s => s.startsWith('Resumed.'))).toBe(`Resumed. ${whole}`);
  });
});
