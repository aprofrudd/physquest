// FINDING: the Analysis room's verdict explanation is read to screen-reader users twice.
// explain() (src/rooms/analysis/index.ts) calls speak(), whose dialogue announces the explanation, and then announce()s
// "You said ... It is ... <explanation again>". Since ui/announce.ts joins lines said within 30 ms ("never dropped"),
// the live region receives: <explanation> <You said...> <explanation>.
import { beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/audio/Sfx', () => ({ sfx: { play: () => {}, isMuted: () => false, toggleMuted: () => {} } }));
const H = await import('./harness');

let now = 1000;
const timers: { at: number; fn: () => void; id: number }[] = [];
let nextId = 1;
const live: string[] = [];
const region = {
  style: {} as Record<string, string>,
  className: '',
  setAttribute() {},
  _t: '',
  get textContent() {
    return this._t;
  },
  set textContent(v: string) {
    this._t = v;
    if (v) live.push(v);
  },
};
const advance = (ms: number) => {
  now += ms;
  for (;;) {
    const due = timers.filter(t => t.at <= now).sort((a, b) => a.at - b.at)[0];
    if (!due) break;
    timers.splice(timers.indexOf(due), 1);
    due.fn();
  }
};

beforeAll(() => {
  H.installFakeDom();
  const base = (globalThis as unknown as { document: { createElement: (t: string) => unknown } }).document;
  vi.stubGlobal('document', { createElement: (tag: string) => (tag === 'div' ? region : base.createElement(tag)), body: { appendChild: () => {} } });
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

describe('Analysis room: verdict announcement', () => {
  it('reads the explanation once', async () => {
    vi.spyOn(Math, 'random').mockImplementation(H.seeded(5));
    const w = await H.makeWorld(3);
    const tick = (n = 1) => {
      for (let i = 0; i < n; i++) {
        w.step(1);
        advance(1000 / 60);
      }
    };
    w.enter('room4');
    // rules, block (skip with A), forecast (lock in with A), retest sentence, then the first question
    const press = (b: 'a' | 'left' | 'right', hold = 2) => {
      w.emu.tap(b, hold);
      tick(hold + 3);
    };
    for (let guard = 0; guard < 4000 && !(w.dialogue.isActive() && w.dialogue.state.choices); guard++) {
      if (w.dialogue.isActive() && !w.dialogue.state.choices) press('a');
      else if ((w.scene.debug() as { step?: string })?.step === 'forecast') {
        tick(30);
        press('right');
        tick(30);
        press('a');
      } else if ((w.scene.debug() as { step?: string })?.step === 'block') {
        tick(40);
        press('a');
      } else tick(2);
    }
    expect(w.dialogue.state.choices, 'reached the verdict question').not.toBeNull();
    tick(60); // let the options settle (the 0.35 s list lock)
    live.length = 0;
    press('a'); // pick the first option (right or wrong: either way an explanation follows)
    tick(30);
    advance(200);
    const text = live[live.length - 1] ?? '';
    const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.length > 20);
    const dup = sentences.find((s, i) => sentences.indexOf(s) !== i);
    expect(dup, `live region heard: ${text}`).toBeUndefined();
  });
});
