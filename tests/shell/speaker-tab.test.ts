// Spoken lines carry a name tab in the speaker's colour and are read as "Name: text"; the game's own lines
// (narration, rules, prompts) have no tab.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const H = vi.hoisted(() => ({ drawn: [] as string[], announced: [] as string[] }));

vi.mock('../../src/audio/Sfx', () => ({ sfx: { play: () => {}, isMuted: () => false, toggleMuted: () => {} } }));
vi.mock('../../src/ui/announce', () => ({ announce: (t: string) => void H.announced.push(t) }));
vi.mock('../../src/render/PixelFont', async importOriginal => {
  const real = await importOriginal<typeof import('../../src/render/PixelFont')>();
  return { ...real, drawText: (_ctx: unknown, text: string) => void H.drawn.push(text) };
});

import { createDialogueState, renderDialogue, startDialogue } from '../../src/render/DialogueBox';
import { athleteSpeaker, DIRECTOR_SPEAKER, rivalSpeaker } from '../../src/data/speakers';
import { MEET_RUNNING } from '../../src/rooms/content/meet-running';
import { LEVEL_DATA } from '../../src/data/sports';

const fills: string[] = [];
const ctx = {
  fillRect() {},
  set fillStyle(v: string) {
    fills.push(v);
  },
} as unknown as CanvasRenderingContext2D;

const luminance = (hex: string) => {
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(x => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
};
const contrast = (a: string, b: string) => {
  const [lo, hi] = [luminance(a), luminance(b)].sort((x, y) => x - y);
  return (hi! + 0.05) / (lo! + 0.05);
};

beforeEach(() => {
  H.drawn.length = 0;
  H.announced.length = 0;
  fills.length = 0;
});

describe('speaker tab', () => {
  it("draws the speaker's name on a tab in their colour, and reads it out first", () => {
    const state = createDialogueState();
    startDialogue(state, 'Hi, I am Aisha.', undefined, undefined, undefined, { speaker: athleteSpeaker(3) });
    renderDialogue(ctx, state);
    expect(H.drawn).toContain('AISHA');
    expect(fills).toContain(athleteSpeaker(3).color);
    expect(H.announced.at(-1)).toBe('Aisha: Hi, I am Aisha.');
  });

  it('gives the game its own plain box: no tab, no name read out', () => {
    const state = createDialogueState();
    startDialogue(state, 'Question 1 of 5.');
    renderDialogue(ctx, state);
    expect(H.drawn).not.toContain('AISHA');
    expect(H.announced.at(-1)).toBe('Question 1 of 5.');
  });

  it('drops the speaker when the next line has none', () => {
    const state = createDialogueState();
    startDialogue(state, 'Hello.', undefined, undefined, undefined, { speaker: DIRECTOR_SPEAKER });
    startDialogue(state, 'Two useful notes.');
    expect(state.speaker).toBeNull();
  });

  it('names the right people', () => {
    expect(athleteSpeaker(3).name).toBe('Aisha');
    expect(DIRECTOR_SPEAKER.name.toUpperCase()).toBe(MEET_RUNNING.director.name);
    LEVEL_DATA.forEach((sport, level) => expect(rivalSpeaker(level).name).toBe(sport.rivalName));
  });

  it('keeps white names readable on every tab (4.5:1)', () => {
    const tabs = [DIRECTOR_SPEAKER, ...LEVEL_DATA.flatMap((_, l) => [athleteSpeaker(l), rivalSpeaker(l)])];
    for (const t of tabs) expect(contrast(t.color, '#f8f8f0')).toBeGreaterThanOrEqual(4.5);
  });
});
