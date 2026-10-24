// Records every drawText call while fuzzing each room with BOTH label sets (console: A/B, keyboard: SPACE/X/ARROWS), and
// reports text that leaves the screen or runs onto a panel border, plus glyphs the 5x7 font does not have.
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { Button } from '../../src/engine/Input';
import { readFileSync } from 'node:fs';

const texts = new Map<string, { text: string; x: number; y: number; scale: number }>();
vi.mock('../../src/audio/Sfx', () => ({ sfx: { play: () => {}, isMuted: () => false, toggleMuted: () => {} } }));
vi.mock('../../src/ui/announce', () => ({ announce: () => {} }));
vi.mock('../../src/render/PixelFont', async importOriginal => {
  const real = await importOriginal<typeof import('../../src/render/PixelFont')>();
  return {
    ...real,
    drawText: (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, scale = 1) => {
      const key = `${text}|${x}|${y}|${scale}`;
      if (!texts.has(key)) texts.set(key, { text, x, y, scale });
      real.drawText(ctx, text, x, y, color, scale);
    },
  };
});

const promptBoxes = new Map<string, string>();
vi.mock('../../src/render/DialogueBox', async importOriginal => {
  const real = await importOriginal<typeof import('../../src/render/DialogueBox')>();
  return {
    ...real,
    drawPromptBox: (ctx: CanvasRenderingContext2D, text: string | readonly string[], hint?: string, colors?: readonly (string | undefined)[]) => {
      const lines = typeof text === 'string' ? real.wrapText(text) : text;
      const bad = lines.length > 4 || lines.some(l => l.length > 38) || (hint !== undefined && 14 + hint.length * 6 + 5 > 250);
      if (bad) promptBoxes.set(JSON.stringify([lines, hint]), `${lines.length} lines; hint ${hint?.length}`);
      real.drawPromptBox(ctx, text, hint, colors);
    },
  };
});

const H = await import('./harness');

beforeAll(() => {
  H.installFakeDom();
});

// the font's glyphs, read from the source
const fontSource = readFileSync(new URL('../../src/render/PixelFont.ts', import.meta.url), 'utf8');
const glyphs = new Set<string>();
for (const m of fontSource.matchAll(/^\s*(?:'(.)'|"(.)"|([A-Z0-9])):\s*\[/gm)) glyphs.add((m[1] ?? m[2] ?? m[3])!);
glyphs.add(' ');

const pick = (rng: () => number): Button => {
  const r = rng();
  return r < 0.4 ? 'a' : r < 0.55 ? 'down' : r < 0.65 ? 'up' : r < 0.78 ? 'left' : r < 0.9 ? 'right' : r < 0.93 ? 'b' : r < 0.96 ? 'start' : 'select';
};

const play = async (room: string, seed: number, device: 'console' | 'keyboard') => {
  const rng = H.seeded(seed * 104729 + room.charCodeAt(4));
  vi.spyOn(Math, 'random').mockImplementation(rng);
  const w = await H.makeWorld(3, device);
  for (let visit = 0; visit < 4; visit++) {
    w.enter(room);
    for (let steps = 0; steps < 60 * 90; steps++) {
      if (rng() < 0.09) w.emu.tap(pick(rng), rng() < 0.08 ? 25 + Math.floor(rng() * 60) : 1 + Math.floor(rng() * 5));
      w.step(1);
      if (w.current() !== 'roomChallenge') break;
    }
    if (w.pauseMenu.isActive()) w.pauseMenu.close();
  }
  vi.restoreAllMocks();
};

describe('text fits the screen and the font', () => {
  it('every drawn string, both label sets', async () => {
    for (const device of ['console', 'keyboard'] as const)
      for (const room of ['room1', 'room2', 'room3', 'room4'])
        for (let seed = 1; seed <= 25; seed++) await play(room, seed, device);
    const over: string[] = [];
    const missing = new Map<string, string>();
    for (const t of texts.values()) {
      const w = t.text.length * 6 * t.scale - t.scale;
      if (t.x + w > 256 || t.x < 0) over.push(`OFF SCREEN "${t.text}" x=${t.x} y=${t.y} right=${t.x + w}`);
      else if (t.x + w > 252 && t.y > 36 && t.y < 224) over.push(`ON BORDER "${t.text}" x=${t.x} y=${t.y} right=${t.x + w}`);
      for (const ch of t.text.toUpperCase()) if (!glyphs.has(ch)) missing.set(ch, `${missing.get(ch) ?? ''} "${t.text}"`.slice(0, 200));
    }
    if (process.env.FUZZ_LOG) console.log(`${texts.size} distinct strings recorded`);
    if (process.env.FUZZ_LOG) console.log('OVERFLOW', JSON.stringify(over, null, 1));
    if (process.env.FUZZ_LOG) console.log('MISSING GLYPHS', JSON.stringify([...missing.entries()], null, 1));
    if (process.env.FUZZ_LOG) console.log('PROMPT BOX PROBLEMS', JSON.stringify([...promptBoxes.entries()], null, 1));
    expect([...promptBoxes.keys()]).toEqual([]);
    expect(over).toEqual([]);
    expect([...missing.keys()]).toEqual([]);
  }, 600000);
});
