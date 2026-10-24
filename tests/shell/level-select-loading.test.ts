// Round 3: the real startGame() (title, level select, scene manager, pick counter) with the room chunk held back by a stand-in loader,
// driven frame by frame with a keyboard emulator and fake timers. Reproduces what the Playwright probes in verify/code/round3 show.
//   R3-1  the level select footer keeps saying LOADING THE NEW ROOMS... after the player backed out of the waiting pick.
//   R3-2  every A on the waiting pick restarts the 3 s fallback, so the wait is not "3 s at most".
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Button } from '../../src/engine/Input';

const H = vi.hoisted(() => {
  class FakeCtx {
    fillStyle: unknown = '#000';
    globalAlpha = 1;
    imageSmoothingEnabled = false;
    canvas = { width: 256, height: 224 };
    fillRect() {}
    drawImage() {}
    save() {}
    restore() {}
    beginPath() {}
    rect() {}
    clip() {}
    createPattern() { return {}; }
    setTransform() {}
  }
  const makeCanvas = () => {
    const c = { width: 0, height: 0, getContext: () => new FakeCtx() };
    return c;
  };
  return {
    FakeCtx,
    makeCanvas,
    drawn: [] as string[],
    announced: [] as string[],
    loaded: false,
    resolveChunk: null as null | ((ok: boolean) => void),
    shared: null as Promise<boolean> | null,
    emu: null as null | { read(): unknown; blockRepeats(): void },
    raf: null as null | ((t: number) => void),
  };
});

vi.mock('../../src/audio/Sfx', () => ({ sfx: { play: () => {}, isMuted: () => false, toggleMuted: () => {} } }));
vi.mock('../../src/ui/announce', () => ({ announce: (t: string) => void H.announced.push(t) }));
vi.mock('../../src/render/PixelFont', async importOriginal => {
  const real = await importOriginal<typeof import('../../src/render/PixelFont')>();
  return {
    ...real,
    drawText: (ctx: CanvasRenderingContext2D, text: string, ...rest: [number, number, string, number?]) => {
      H.drawn.push(text);
      return real.drawText(ctx, text, ...rest);
    },
  };
});
vi.mock('../../src/ui/console', () => ({
  mountConsole: () => ({ canvas: { getContext: () => new H.FakeCtx() }, present: () => {}, destroy: () => {} }),
}));
vi.mock('../../src/engine/Input', async importOriginal => {
  const real = await importOriginal<typeof import('../../src/engine/Input')>();
  return {
    ...real,
    createInput: () => ({
      read: () => H.emu!.read(),
      fill: (t: string) => real.fillButtonNames(t, real.consoleLabel),
      label: real.consoleLabel,
      blockRepeats: () => H.emu!.blockRepeats(),
      lastDevice: () => 'console',
      setTextMode: () => {},
      destroy: () => {},
    }),
  };
});
vi.mock('../../src/rooms/loader', () => ({
  levelHasNewRooms: (level: number) => level === 3,
  roomsLoaded: () => H.loaded,
  roomsFailed: () => false,
  commitLevel: () => {},
  newRoomsFor: () => null,
  loadRooms: () =>
    (H.shared ??= new Promise<boolean>(resolve => {
      H.resolveChunk = ok => {
        H.loaded = ok;
        resolve(ok);
      };
    })),
}));

const { makeEmulator } = await import('./emulator');

const DT = 1000 / 60;
let now = 0;
const frame = async () => {
  now += DT;
  H.raf!(now);
  await vi.advanceTimersByTimeAsync(DT); // fake timers move with the frames, and promise callbacks run
};
const wait = async (seconds: number) => {
  for (let t = 0; t < seconds * 1000 - 1e-6; t += DT) await frame();
};
const tap = async (button: Button, after = 0.3) => {
  H.emu!.tap(button, 2);
  await wait(after);
};

const bootToLevelSelectOnDistanceRunning = async () => {
  vi.resetModules();
  H.loaded = false;
  H.resolveChunk = null;
  H.shared = null;
  H.drawn.length = 0;
  H.announced.length = 0;
  H.emu = makeEmulator();
  store.set('physquest_save', JSON.stringify({ version: 2, playerName: 'TEST', bossDefeated: [false, false, false, false], gameComplete: false, currentLevel: 0, levelProgress: [null, null, null, null] }));
  const { startGame } = await import('../../src/game');
  const stop = startGame({} as HTMLElement);
  now = performance.now(); // the loop's clock started a moment ago
  await wait(0.7); // the title's input lock
  await tap('a', 0.6); // CONTINUE -> level select
  await tap('down', 0.1);
  await tap('down', 0.1);
  await tap('down', 0.1); // Distance Running
  return stop;
};

const store = new Map<string, string>();
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  now = 1000;
  store.clear();
  const win = {
    setTimeout: (...a: Parameters<typeof setTimeout>) => globalThis.setTimeout(...a),
    clearTimeout: (...a: Parameters<typeof clearTimeout>) => globalThis.clearTimeout(...a),
    addEventListener: () => {},
    removeEventListener: () => {},
    matchMedia: () => ({ matches: false }),
    location: { search: '?debug' },
    requestIdleCallback: undefined,
  };
  vi.stubGlobal('window', win);
  vi.stubGlobal('location', win.location);
  vi.stubGlobal('document', {
    createElement: () => H.makeCanvas(),
    addEventListener: () => {},
    removeEventListener: () => {},
    visibilityState: 'visible',
    body: null,
  });
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
  vi.stubGlobal('requestAnimationFrame', (cb: (t: number) => void) => {
    H.raf = cb;
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const footerNow = async () => {
  H.drawn.length = 0;
  await wait(0.1);
  return H.drawn.filter(t => /LOADING THE NEW ROOMS|PLAY|REPLAY/.test(t));
};
const scene = () => (window as unknown as { __pq?: { scene(): string } }).__pq?.scene();

describe('the level select while the redesigned rooms load', () => {
  it('control: a waiting pick shows LOADING, and the level starts with the classic rooms after 3 s', async () => {
    await bootToLevelSelectOnDistanceRunning();
    await tap('a', 0.3);
    expect(H.announced).toContain('Loading the new rooms.');
    expect(await footerNow()).toContain('LOADING THE NEW ROOMS...');
    await wait(3.2);
    expect(H.announced.some(t => t.includes('Sports Performance Centre')), 'the hub opened after 3 s with no chunk').toBe(true);
    H.resolveChunk!(true);
    await wait(0.2);
    expect(scene()).toBe('overworld');
  });

  it('R3-1: backing out of the waiting pick leaves no LOADING footer behind', async () => {
    await bootToLevelSelectOnDistanceRunning();
    await tap('a', 0.3); // pick Distance Running: waiting
    expect(await footerNow()).toContain('LOADING THE NEW ROOMS...');
    await tap('b', 0.8); // back to the title
    H.resolveChunk!(true); // the chunk lands
    await wait(1);
    await tap('a', 0.8); // CONTINUE -> level select again
    expect(scene()).toBe('levelSelect');
    const footer = await footerNow();
    expect(footer, 'the footer still says it is loading').not.toContain('LOADING THE NEW ROOMS...');
    expect(footer.some(t => /PLAY/.test(t))).toBe(true);
  });

  it('R3-2: pressing A again on the waiting pick does not push the fallback back (3 s at most)', async () => {
    await bootToLevelSelectOnDistanceRunning();
    await tap('a', 0.1); // pick at t = 0
    await wait(1.9);
    await tap('a', 0.1); // an impatient second A at about 2 s
    await wait(1.5); // about 3.6 s after the first pick, the chunk still not here
    expect(H.announced.some(t => t.includes('Sports Performance Centre')), 'still on the level select 3.6 s after the first pick').toBe(true);
  });
});
