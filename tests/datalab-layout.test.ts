// A layout lint for the two screens. Every string the room draws on the paper panel, in every state the clean-up and
// the pin list reach (all 20 attempts, played perfectly, badly, and with one blanket choice), must stay 2px clear of
// the panel's border and never overlap another string; the lens's values must keep clear of its markers and its frame.
// Strings are recorded by replacing the font's drawText, shapes by a recording canvas context: no browser needed.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RUNNING } from '../src/rooms/content/running';
import { createTraceDesk } from '../src/rooms/datalab/model';
import { decideNow, makeRig as makeRigBase, moveTo, onward, seeded, sport, toReading } from './datalab-rig';

interface Ink {
  text: string;
  x: number;
  y: number;
  /** Width in pixels (the last character's gap is not ink). */
  w: number;
}
interface Shape {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
}

const inks: Ink[] = [];
const shapes: Shape[] = [];
let fillStyle = '';

vi.mock('../src/render/PixelFont', async importOriginal => {
  const real = await importOriginal<typeof import('../src/render/PixelFont')>();
  return {
    ...real,
    drawText: (_ctx: unknown, text: string, x: number, y: number) => {
      inks.push({ text, x, y, w: real.measureText(text) - 1 });
    },
  };
});
vi.mock('../src/audio/Sfx', () => ({ sfx: { play: () => {} } }));
vi.mock('../src/ui/announce', () => ({ announce: () => {} }));

const { LENS_BOX, lensPad, lensStaggers } = await import('../src/rooms/datalab/lens');
const { CS_PENDING, LACTATE_AXIS, OPTIONS_TOP, PANEL, SPEED_AXIS, TRIAL_HEADS, TRIAL_UNITS, slotText } = await import('../src/rooms/datalab/views');

const content = RUNNING.data;
const GLYPH_H = 7;
const BOTH_TESTS = ['Lactate Profile', 'Critical Speed Test'];

const ctx = {
  get fillStyle() {
    return fillStyle;
  },
  set fillStyle(value: string) {
    fillStyle = value;
  },
  globalAlpha: 1,
  fillRect: (x: number, y: number, w: number, h: number) => void shapes.push({ x, y, w, h, color: fillStyle }),
  // ring sprites: the stand-in canvas carries the size the code gave it
  drawImage: (img: { width: number; height: number }, x: number, y: number) => void shapes.push({ x, y, w: img.width, h: img.height, color: 'sprite' }),
} as unknown as CanvasRenderingContext2D;

beforeEach(() => {
  vi.stubGlobal('document', {
    createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillStyle: '', fillRect() {}, drawImage() {} }) }),
  });
});
afterEach(() => vi.unstubAllGlobals());

/** A room on seed `seed` (a short-rules replay), with a `look()` that draws it into the recorders. */
const makeRig = (seed: number) => {
  const rig = makeRigBase(seed, { tests: BOTH_TESTS });
  /** What the panel shows right now. */
  const look = () => {
    inks.length = 0;
    shapes.length = 0;
    rig.render(ctx);
    return { inks: inks.filter(i => i.y < 162), all: [...inks], shapes: [...shapes] };
  };
  return { ...rig, look };
};
type Rig = ReturnType<typeof makeRig>;
type Look = ReturnType<Rig['look']>;

// ---- The lint ------------------------------------------------------------------------------------------------

// The panel's paper is inside its 4px border; text keeps 2px clear of that
const PAPER_BOX = { left: PANEL.x + 4, top: PANEL.y + 4, right: PANEL.x + PANEL.w - 5, bottom: PANEL.y + PANEL.h - 5 };
const AIR = 2;

const overlaps = (a: Ink, b: Ink): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + GLYPH_H && b.y < a.y + GLYPH_H;

/** `withLens`: the clean-up screen, where the lens sits in the panel's lower left. */
const lint = (view: Look, where: string, withLens = false): string[] => {
  const problems: string[] = [];
  const say = (what: string) => problems.push(`${where}: ${what}`);
  for (const ink of view.inks) {
    if (/NaN|undefined|null/i.test(ink.text)) say(`'${ink.text}' has a bad number in it`);
    if (!Number.isInteger(ink.x) || !Number.isInteger(ink.y)) say(`'${ink.text}' sits between pixels (${ink.x}, ${ink.y})`);
    if (ink.x < PAPER_BOX.left + AIR) say(`'${ink.text}' is ${ink.x - PAPER_BOX.left}px from the panel's left edge`);
    if (ink.x + ink.w - 1 > PAPER_BOX.right - AIR) say(`'${ink.text}' ends ${PAPER_BOX.right - (ink.x + ink.w - 1)}px from the panel's right edge`);
    if (ink.y < PAPER_BOX.top + AIR) say(`'${ink.text}' is ${ink.y - PAPER_BOX.top}px from the panel's top edge`);
    if (ink.y + GLYPH_H - 1 > PAPER_BOX.bottom - AIR) say(`'${ink.text}' ends ${PAPER_BOX.bottom - (ink.y + GLYPH_H - 1)}px from the panel's bottom edge`);
  }
  for (let i = 0; i < view.inks.length; i++) {
    for (let j = i + 1; j < view.inks.length; j++) {
      if (overlaps(view.inks[i]!, view.inks[j]!)) say(`'${view.inks[i]!.text}' overlaps '${view.inks[j]!.text}'`);
    }
  }
  if (!withLens) return problems;
  // The lens: its values keep 2px clear of its frame, and no value sits on a marker or a dot
  const lens = { left: LENS_BOX.x + 4, right: LENS_BOX.x + LENS_BOX.w - 5, bottom: LENS_BOX.y + LENS_BOX.h - 5 };
  const inLens = (i: Ink) => i.x >= LENS_BOX.x && i.x < LENS_BOX.x + LENS_BOX.w && i.y >= LENS_BOX.y + 4 && i.y < LENS_BOX.y + LENS_BOX.h;
  const markers = view.shapes.filter(
    s => s.x >= LENS_BOX.x && s.x < LENS_BOX.x + LENS_BOX.w && s.y >= LENS_BOX.y + 2 && s.y < LENS_BOX.y + LENS_BOX.h - 2 && ((s.w === 7 && s.h === 7) || (s.w === 3 && s.h === 3)),
  );
  for (const ink of view.inks.filter(inLens)) {
    if (ink.x < lens.left) say(`lens value '${ink.text}' is too close to the frame's left edge`);
    if (ink.x + ink.w - 1 > lens.right) say(`lens value '${ink.text}' is too close to the frame's right edge`);
    if (ink.y + GLYPH_H - 1 > lens.bottom) say(`lens value '${ink.text}' is too close to the frame's bottom edge`);
    for (const m of markers) {
      if (ink.x < m.x + m.w && m.x < ink.x + ink.w && ink.y < m.y + m.h && m.y < ink.y + GLYPH_H) say(`lens value '${ink.text}' sits on a ${m.w}px dot at ${m.x},${m.y}`);
    }
  }
  return problems;
};

// ---- Every attempt, every state ----------------------------------------------------------------------------------

const BOTH = ['Lactate Profile', 'Critical Speed Test'];

/** One seed for each distinct attempt (glitch kinds and places in the lactate file x which trial is mistimed). */
const attemptSeeds = (): number[] => {
  const bySignature = new Map<string, number>();
  for (let seed = 1; seed <= 400; seed++) {
    const desk = createTraceDesk(content, sport, { tests: BOTH, rng: seeded(seed) });
    const signature = desk.suspects.map(s => `${s.kind}@${s.place.type}${s.place.index}`).join(' ');
    if (!bySignature.has(signature)) bySignature.set(signature, seed);
  }
  return [...bySignature.values()];
};

type Strategy = 'perfect' | 'wrong' | 'remove' | 'keep';
const removes = (strategy: Strategy, real: boolean): boolean =>
  strategy === 'perfect' ? !real : strategy === 'wrong' ? real : strategy === 'remove';

/** While a reading waits, the KEEP / REMOVE list covers the panel from OPTIONS_TOP down: nothing else may sit there. */
const OPTION_WORDS = new Set<string>([...content.options, '>']);
const lintDeciding = (view: Look, where: string): string[] => {
  const panel = { ...view, inks: view.inks.filter(i => !OPTION_WORDS.has(i.text)) };
  const problems = lint(panel, where, view.all.some(i => i.text === LACTATE_AXIS));
  for (const ink of panel.inks) if (ink.y + GLYPH_H > OPTIONS_TOP) problems.push(`${where}: '${ink.text}' sits under the KEEP / REMOVE list (y ${ink.y})`);
  for (const word of content.options) if (!view.all.some(i => i.text === word)) problems.push(`${where}: the option '${word}' is not drawn`);
  return problems;
};

/** Plays the clean-up to the key-variable list, linting every arrival and every verdict. */
const playCleanup = (seed: number, strategy: Strategy): { rig: Rig; problems: string[] } => {
  const rig = makeRig(seed);
  const problems: string[] = [];
  toReading(rig);
  const { suspects } = rig.debug();
  suspects.forEach((s, i) => {
    problems.push(...lintDeciding(rig.look(), `seed ${seed} ${strategy} reading ${i + 1} (${s.kind}) arrives`));
    decideNow(rig, removes(strategy, s.real));
    problems.push(...lint(rig.look(), `seed ${seed} ${strategy} reading ${i + 1} (${s.kind}) decided`, s.file === 'lactate'));
    onward(rig);
  });
  return { rig, problems };
};

describe('the clean-up screen', () => {
  for (const strategy of ['perfect', 'wrong', 'remove', 'keep'] as const) {
    it(`keeps every string clear of the border, of the others, of the lens's dots and of the list (${strategy} play, every attempt)`, () => {
      const seeds = attemptSeeds();
      expect(seeds.length).toBe(12);
      const problems: string[] = [];
      for (const seed of seeds) problems.push(...playCleanup(seed, strategy).problems);
      expect(problems.slice(0, 8)).toEqual([]);
    });
  }

  it('labels each file: its header plate, the chart axes with units, the table columns with units', () => {
    const rig = makeRig(attemptSeeds()[0]!);
    toReading(rig);
    let words = rig.look().all.map(i => i.text);
    expect(words).toContain('FILE 1/2: LACTATE PROFILE (TREADMILL)');
    expect(words).toContain(LACTATE_AXIS);
    expect(words).toContain(SPEED_AXIS);
    expect(words.filter(w => /^\d+$/.test(w)).length).toBeGreaterThanOrEqual(7); // the stage speeds on their axis
    const lactate = rig.debug().suspects.filter(s => s.file === 'lactate').length;
    for (let i = 0; i < lactate; i++) {
      decideNow(rig, false);
      onward(rig);
    }
    words = rig.look().all.map(i => i.text);
    expect(words).toContain('FILE 2/2: CRITICAL SPEED (TRACK TRIALS)');
    for (const w of [...TRIAL_HEADS, ...TRIAL_UNITS, '1200 M', '2400 M', '3600 M', CS_PENDING]) expect(words, w).toContain(w);
    expect(words).not.toContain(LACTATE_AXIS);
    expect(words.some(w => /\/KM$/.test(w))).toBe(true);
    // every number on the trials table carries its unit, or sits under a column that names it
    for (const w of rig.look().inks.map(i => i.text).filter(x => /\d/.test(x))) expect(w, w).toMatch(/M$|\/KM|^\d+:\d\d$|FILE|KM\/H|MIN:S/);
  });

  it('marks the reading in question with a ?, and a decided one with KEPT or REMOVED (word and symbol)', () => {
    const rig = makeRig(attemptSeeds()[0]!);
    toReading(rig);
    expect(rig.look().all.some(i => i.text === '?')).toBe(true);
    decideNow(rig, true);
    let words = rig.look().all.map(i => i.text);
    expect(words).toContain('REMOVED');
    expect(words).toContain('X');
    onward(rig);
    decideNow(rig, false);
    words = rig.look().all.map(i => i.text);
    expect(words).toContain('KEPT');
    expect(words).toContain('✓');
  });

  it('looks back at decided readings without breaking the layout', () => {
    const problems: string[] = [];
    for (const seed of attemptSeeds()) {
      const rig = makeRig(seed);
      toReading(rig);
      const n = rig.debug().suspects.length;
      rig.debug().suspects.forEach((s, i) => {
        decideNow(rig, !s.real);
        if (i < n - 1) onward(rig);
      });
      for (let back = 1; back < n; back++) {
        rig.press('left', 0.2);
        problems.push(...lint(rig.look(), `seed ${seed} looking back ${back}`, rig.debug().file === 'lactate'));
      }
    }
    expect(problems.slice(0, 8)).toEqual([]);
  });
});

describe('the key-variable screen', () => {
  for (const strategy of ['perfect', 'wrong', 'remove', 'keep'] as const) {
    it(`keeps every string clear of the border and of the others, chosen or not (${strategy} clean-up, every attempt)`, () => {
      const problems: string[] = [];
      for (const seed of attemptSeeds()) {
        const { rig, problems: found } = playCleanup(seed, strategy);
        problems.push(...found);
        const { list, pinLimit } = rig.debug();
        const first = rig.look().all.map(i => i.text);
        if (!first.includes(`KEY VARIABLES 0/${pinLimit}`)) problems.push(`seed ${seed}: no KEY VARIABLES 0/${pinLimit}`);
        for (const head of [content.lactate.group, content.trials.group]) if (!first.includes(head)) problems.push(`seed ${seed}: no heading ${head}`);
        for (let row = 0; row < list.length; row++) {
          problems.push(...lint(rig.look(), `seed ${seed} ${strategy} cursor on row ${row + 1}`));
          rig.press('down', 0.5);
        }
        // choose as many as it takes (the first rows), look, then the LOCK IN row
        for (let row = 0; row < pinLimit; row++) {
          moveTo(rig, row);
          rig.press('a', 0.3);
        }
        const full = rig.look();
        problems.push(...lint(full, `seed ${seed} ${strategy} all chosen`));
        if (!full.all.some(i => i.text === `KEY VARIABLES ${pinLimit}/${pinLimit}`)) problems.push(`seed ${seed}: the count did not fill`);
        moveTo(rig, list.length);
        problems.push(...lint(rig.look(), `seed ${seed} ${strategy} on LOCK IN`));
        rig.press('a', 0.1);
        rig.pick(1); // LOCK IN: the reveal lights each variable in turn
        for (let line = 0; line < 10 && rig.talking(); line++) {
          problems.push(...lint(rig.look(), `seed ${seed} ${strategy} reveal line ${line + 1}`));
          rig.press('a', 0.1);
          rig.press('a', 0.3);
        }
      }
      expect(problems.slice(0, 8)).toEqual([]);
    });
  }

  it('fills a slot with the short name and the value with its unit', () => {
    expect(slotText('LT2 Pace (3:34/km)')).toBe('LT2 3:34/KM');
    expect(slotText('VO2max (58 ml/kg/min)')).toBe('VO2MAX 58 ML/KG/MIN');
    expect(slotText('D Prime (140 m)')).toBe('DPRIME 140 M');
    expect(slotText('HR at LT2 (176 bpm)')).toBe('HR LT2 176 BPM');
    expect(slotText('Critical Speed (3:30/km)?')).toBe('CS 3:30/KM');
  });
});

describe('the hint tag under the box', () => {
  it('names LEFT only where there is something to look back at, and the buttons that work', () => {
    const rig = makeRig(1);
    toReading(rig);
    const hint = () => rig.look().all.map(i => i.text).find(t => /^A: (CONFIRM|NEXT|CONTINUE)/.test(t));
    const n = rig.debug().suspects.length;
    expect(hint()).toBe('A: CONFIRM   B: QUIT');
    decideNow(rig, false);
    expect(hint()).toBe('A: NEXT   B: QUIT'); // the first verdict: LEFT would do nothing
    onward(rig);
    expect(hint()).toBe('A: CONFIRM   LEFT: BACK   B: QUIT');
    decideNow(rig, false);
    expect(hint()).toBe('A: NEXT   LEFT: BACK   B: QUIT');
    for (let i = 2; i < n; i++) {
      onward(rig);
      decideNow(rig, false);
    }
    expect(hint()).toBe('A: CONTINUE   LEFT: BACK   B: QUIT'); // the last verdict leads on to the key variables
  });
});

describe('the lens spread', () => {
  const THREE = 17; // "0.0": 3 characters, 17px of ink
  const FOUR = 23; // "3.21": 4 characters

  it('makes five 3-character values take turns (a decimal point leaves 3px of air either side, so one row would read as a run)', () => {
    expect(lensStaggers(5, THREE)).toBe(true);
  });

  it('keeps three or four values on one row, and a lone value too', () => {
    expect(lensStaggers(3, FOUR)).toBe(false);
    expect(lensStaggers(3, THREE)).toBe(false);
    expect(lensStaggers(1, THREE)).toBe(false);
  });

  it('keeps the first and last value 2px clear of the frame, wide values or narrow', () => {
    for (const widest of [THREE, FOUR]) {
      const firstDotX = LENS_BOX.x + lensPad(widest);
      const textLeft = firstDotX - Math.floor(widest / 2);
      expect(textLeft - LENS_BOX.x).toBeGreaterThanOrEqual(4); // 2px border + 2px of air
      const lastDotX = LENS_BOX.x + LENS_BOX.w - lensPad(widest);
      expect(LENS_BOX.x + LENS_BOX.w - 1 - (lastDotX + Math.ceil(widest / 2) - 1)).toBeGreaterThanOrEqual(4);
    }
  });
});
