import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Sfx } from '../src/audio/Sfx';

// A stand-in AudioContext that behaves like a phone's: resume() asked for without user activation (a touch
// pointerdown) never settles, and only a later call (pointerup/touchend) starts the context.
class FakeContext {
  static last: FakeContext | null = null;
  static hangFirst = 0; // how many resume() calls stay pending for ever
  state = 'suspended';
  currentTime = 0;
  destination = {};
  resumes = 0;
  oscillators = 0;
  constructor() {
    FakeContext.last = this;
  }
  resume(): Promise<void> {
    this.resumes++;
    if (this.resumes <= FakeContext.hangFirst) return new Promise(() => {});
    this.state = 'running';
    return Promise.resolve();
  }
  suspend(): Promise<void> {
    this.state = 'suspended';
    return Promise.resolve();
  }
  createGain() {
    return {
      gain: { value: 1, setValueAtTime() {}, exponentialRampToValueAtTime() {} },
      connect() {},
    };
  }
  createOscillator() {
    this.oscillators++;
    return {
      type: 'square',
      frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
      connect() {},
      start() {},
      stop() {},
    };
  }
}

const settle = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

const load = async (): Promise<Sfx> => {
  vi.resetModules();
  return (await import('../src/audio/Sfx')).sfx;
};

describe('sfx unlock', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeContext.last = null;
    FakeContext.hangFirst = 0;
    vi.stubGlobal('window', { AudioContext: FakeContext });
    vi.stubGlobal('navigator', { webdriver: false });
    vi.stubGlobal('localStorage', { getItem: () => null, setItem() {} });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('starts on the second gesture when the first resume() never settles', async () => {
    FakeContext.hangFirst = 1;
    const sfx = await load();
    sfx.unlock(); // touch pointerdown: no activation, the promise hangs
    await settle();
    const ctx = FakeContext.last!;
    expect(ctx.state).toBe('suspended');
    sfx.unlock(); // pointerup / touchend: must issue its own resume()
    await settle();
    expect(ctx.resumes).toBe(2);
    expect(ctx.state).toBe('running');
    sfx.play('start');
    expect(ctx.oscillators).toBeGreaterThan(0);
  });

  it('wakes from an interrupted context and plays the sound asked for', async () => {
    const sfx = await load();
    sfx.unlock();
    await settle();
    const ctx = FakeContext.last!;
    expect(ctx.state).toBe('running');
    ctx.state = 'interrupted'; // iOS: a call, Siri or backgrounding
    const before = ctx.resumes;
    sfx.play('start');
    expect(ctx.resumes).toBe(before + 1);
    await settle();
    expect(ctx.oscillators).toBeGreaterThan(0);
  });

  it('a gesture recovers after a sound asked for a resume() that hangs', async () => {
    const sfx = await load();
    sfx.unlock();
    await settle();
    const ctx = FakeContext.last!;
    ctx.state = 'interrupted';
    FakeContext.hangFirst = ctx.resumes + 1; // the sound's own resume() hangs
    sfx.play('start');
    await settle();
    expect(ctx.state).toBe('interrupted');
    sfx.unlock();
    await settle();
    expect(ctx.state).toBe('running');
    expect(ctx.oscillators).toBeGreaterThan(0); // the pending sound plays once awake
  });
});
