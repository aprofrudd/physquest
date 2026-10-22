// Tiny synthesised sound effects (square/triangle chiptune blips) — no audio files.
// The AudioContext is created on the first user gesture (required on iOS/Android).

export type SfxName =
  | 'blip' // cursor move / text advance
  | 'select' // confirm
  | 'back' // cancel / close / delete
  | 'bump' // walked into something solid
  | 'door' // map transition
  | 'correct'
  | 'wrong'
  | 'win'
  | 'lose'
  | 'beat' // rhythm minigame tick
  | 'mash' // mash minigame tap
  | 'pause'
  | 'save'
  | 'start'; // title -> game

type Note = { f: number; d: number; type?: OscillatorType; slideTo?: number };

const SOUNDS: Record<SfxName, Note[]> = {
  blip: [{ f: 1046, d: 0.03 }],
  select: [{ f: 784, d: 0.045 }, { f: 1175, d: 0.06 }],
  back: [{ f: 659, d: 0.045 }, { f: 440, d: 0.06 }],
  bump: [{ f: 98, d: 0.08, type: 'triangle' }],
  door: [{ f: 523, d: 0.14, slideTo: 196 }],
  correct: [{ f: 523, d: 0.06 }, { f: 659, d: 0.06 }, { f: 784, d: 0.06 }, { f: 1046, d: 0.12 }],
  wrong: [{ f: 220, d: 0.12 }, { f: 185, d: 0.18 }],
  win: [{ f: 523, d: 0.08 }, { f: 659, d: 0.08 }, { f: 784, d: 0.08 }, { f: 1046, d: 0.08 }, { f: 784, d: 0.08 }, { f: 1046, d: 0.3 }],
  lose: [{ f: 392, d: 0.16, type: 'triangle' }, { f: 330, d: 0.16, type: 'triangle' }, { f: 262, d: 0.36, type: 'triangle' }],
  beat: [{ f: 440, d: 0.04, type: 'triangle' }],
  mash: [{ f: 880, d: 0.02 }],
  pause: [{ f: 1318, d: 0.04 }, { f: 988, d: 0.05 }],
  save: [{ f: 880, d: 0.05 }, { f: 1320, d: 0.09 }],
  start: [{ f: 523, d: 0.05 }, { f: 659, d: 0.05 }, { f: 784, d: 0.05 }, { f: 1046, d: 0.1 }],
};

// Minimum gap between repeats of the same sound (seconds)
const MIN_GAP: Partial<Record<SfxName, number>> = { bump: 0.25, blip: 0.035, mash: 0.03, beat: 0.05 };

const MUTE_KEY = 'physquest_muted';
const VOLUME = 0.12;

export interface Sfx {
  play(name: SfxName): void;
  setMuted(muted: boolean): void;
  isMuted(): boolean;
  toggleMuted(): boolean;
  /** Call from inside a user-gesture handler; safe to call repeatedly. */
  unlock(): void;
  onMuteChange(fn: (muted: boolean) => void): () => void;
}

const readMuted = (): boolean => {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
};

const createSfx = (): Sfx => {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let muted = readMuted();
  const lastPlayed = new Map<SfxName, number>();
  const muteListeners = new Set<(muted: boolean) => void>();

  const ensureContext = (): AudioContext | null => {
    if (ctx) return ctx;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      // iOS 17+: 'ambient' makes the hardware silent switch mute the game
      const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
      if (session) session.type = 'ambient';
    } catch {
      // not supported
    }
    try {
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = VOLUME;
      master.connect(ctx.destination);
    } catch {
      ctx = null;
      master = null;
    }
    return ctx;
  };

  const play = (name: SfxName) => {
    if (muted || !ctx || !master || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const gap = MIN_GAP[name];
    const last = lastPlayed.get(name);
    if (gap !== undefined && last !== undefined && now - last < gap) return;
    lastPlayed.set(name, now);

    let t = now + 0.005;
    for (const note of SOUNDS[name]) {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = note.type ?? 'square';
      osc.frequency.setValueAtTime(note.f, t);
      if (note.slideTo) osc.frequency.exponentialRampToValueAtTime(note.slideTo, t + note.d);
      env.gain.setValueAtTime(0.0001, t);
      env.gain.exponentialRampToValueAtTime(1, t + 0.004);
      env.gain.setValueAtTime(1, t + Math.max(0.005, note.d - 0.012));
      env.gain.exponentialRampToValueAtTime(0.0001, t + note.d);
      osc.connect(env);
      env.connect(master);
      osc.start(t);
      osc.stop(t + note.d + 0.01);
      t += note.d;
    }
  };

  const setMuted = (value: boolean) => {
    muted = value;
    try {
      localStorage.setItem(MUTE_KEY, value ? '1' : '0');
    } catch {
      // storage unavailable — keep in-memory state
    }
    muteListeners.forEach(fn => fn(muted));
  };

  return {
    play,
    setMuted,
    isMuted: () => muted,
    toggleMuted() {
      setMuted(!muted);
      return muted;
    },
    unlock() {
      const c = ensureContext();
      if (c && c.state !== 'running') void c.resume().catch(() => {});
    },
    onMuteChange(fn) {
      muteListeners.add(fn);
      return () => {
        muteListeners.delete(fn);
      };
    },
  };
};

export const sfx: Sfx = createSfx();
