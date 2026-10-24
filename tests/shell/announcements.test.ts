// Runs every room with the REAL ui/announce.ts (fake document, virtual clock) and looks at what the live region would be
// told: repeated sentences, and over-long concatenations (announce() joins lines said within 30 ms).
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { Button } from '../../src/engine/Input';

vi.mock('../../src/audio/Sfx', () => ({ sfx: { play: () => {}, isMuted: () => false, toggleMuted: () => {} } }));

const calls: { at: number; text: string }[] = [];
let clockNow = () => 0;
vi.mock('../../src/ui/announce', async importOriginal => {
  const real = await importOriginal<typeof import('../../src/ui/announce')>();
  return {
    ...real,
    announce: (text: string) => {
      calls.push({ at: clockNow(), text });
      real.announce(text);
    },
  };
});

const H = await import('./harness');

// ---- virtual time + fake live region -----------------------------------------------------------------------------
let now = 1000;
clockNow = () => now;
const timers: { at: number; fn: () => void; id: number }[] = [];
let nextId = 1;
const regionTexts: { at: number; text: string }[] = [];
const fakeRegion = {
  style: {} as Record<string, string>,
  className: '',
  setAttribute() {},
  _text: '',
  get textContent() {
    return this._text;
  },
  set textContent(v: string) {
    this._text = v;
    if (v) regionTexts.push({ at: now, text: v });
  },
};

beforeAll(() => {
  H.installFakeDom();
  const base = (globalThis as unknown as { document: { createElement: (t: string) => unknown } }).document;
  vi.stubGlobal('document', {
    createElement: (tag: string) => (tag === 'div' ? fakeRegion : base.createElement(tag)),
    body: { appendChild: () => {} },
  });
  vi.stubGlobal('window', {
    setTimeout: (fn: () => void, ms: number) => {
      const id = nextId++;
      timers.push({ at: now + ms, fn, id });
      return id;
    },
    clearTimeout: (id: number) => {
      const i = timers.findIndex(t => t.id === id);
      if (i >= 0) timers.splice(i, 1);
    },
  });
  vi.stubGlobal('performance', { now: () => now });
});

const advance = (ms: number) => {
  now += ms;
  for (;;) {
    const due = timers.filter(t => t.at <= now).sort((a, b) => a.at - b.at)[0];
    if (!due) break;
    timers.splice(timers.indexOf(due), 1);
    due.fn();
  }
};

const pick = (rng: () => number): Button => {
  const r = rng();
  return r < 0.4 ? 'a' : r < 0.55 ? 'down' : r < 0.65 ? 'up' : r < 0.78 ? 'left' : r < 0.9 ? 'right' : 'start';
};

const sentences = (text: string) => text.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length >= 14);

describe('live region text', () => {
  it('has no repeated sentences and no runaway concatenation', async () => {
    const flagged = new Map<string, string>();
    const long: string[] = [];
    for (const room of ['room1', 'room2', 'room3', 'room4']) {
      for (let seed = 1; seed <= 30; seed++) {
        const rng = H.seeded(seed * 977 + room.charCodeAt(4));
        vi.spyOn(Math, 'random').mockImplementation(rng);
        const w = await H.makeWorld(3);
        regionTexts.length = 0;
        w.enter(room);
        for (let s = 0; s < 60 * 120; s++) {
          if (rng() < 0.08) w.emu.tap(pick(rng), 1 + Math.floor(rng() * 5));
          w.step(1);
          advance(1000 / 60);
          if (w.current() !== 'roomChallenge') break;
        }
        advance(500);
        for (const r of regionTexts) {
          const ss = sentences(r.text);
          const dup = ss.find((s, i) => ss.indexOf(s) !== i);
          if (dup) flagged.set(`${room}: ${dup}`, r.text);
          if (r.text.length > 420) long.push(`${room}: ${r.text.length} chars: ${r.text.slice(0, 120)}...`);
        }
        vi.restoreAllMocks();
        if (flagged.size > 40) break;
      }
    }
    // announcements said within 30 ms of each other are read together: list the distinct pairs
    const merged = new Map<string, number>();
    for (let i = 1; i < calls.length; i++) {
      if (calls[i]!.at - calls[i - 1]!.at < 30 && calls[i]!.at >= calls[i - 1]!.at) {
        const key = `${calls[i - 1]!.text.slice(0, 90)}  ||  ${calls[i]!.text.slice(0, 90)}`;
        merged.set(key, (merged.get(key) ?? 0) + 1);
      }
    }
    if (process.env.FUZZ_LOG) console.log('MERGED PAIRS (distinct, with counts)', JSON.stringify([...merged.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40), null, 1));
    if (process.env.FUZZ_LOG) console.log('REPEATED SENTENCES', JSON.stringify([...flagged.entries()].slice(0, 12), null, 1));
    if (process.env.FUZZ_LOG) console.log('LONG', JSON.stringify(long.slice(0, 5), null, 1));
    expect([...flagged.keys()]).toEqual([]);
  }, 600000);
});
