// A layout lint for the two screens. Every string the room draws on the paper panel, in every state the clean-up and
// the pin list reach (all 20 attempts, played perfectly, badly, and with one blanket choice), must stay 2px clear of
// the panel's border and never overlap another string; the lens's values must keep clear of its markers and its frame.
// Strings are recorded by replacing the font's drawText, shapes by a recording canvas context: no browser needed.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RUNNING } from '../src/rooms/content/running';
import { createTraceDesk } from '../src/rooms/datalab/model';
import { makeRig as makeRigBase, seeded, sport } from './datalab-rig';

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
const { PANEL } = await import('../src/rooms/datalab/views');

const content = RUNNING.data;
const GLYPH_H = 7;

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
  const rig = makeRigBase(seed);
  /** What the panel shows right now. */
  const look = () => {
    inks.length = 0;
    shapes.length = 0;
    rig.render(ctx);
    return { inks: inks.filter(i => i.y < 160), all: [...inks], shapes: [...shapes] };
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

/** One seed for each of the 20 distinct attempts (kinds x places x which sprint). */
const attemptSeeds = (): number[] => {
  const bySignature = new Map<string, number>();
  for (let seed = 1; seed <= 400 && bySignature.size < 20; seed++) {
    const desk = createTraceDesk(content, sport, seeded(seed));
    const signature = desk.suspects.map(s => `${s.kind}@${s.place.type}${s.place.index}`).join(' ');
    if (!bySignature.has(signature)) bySignature.set(signature, seed);
  }
  return [...bySignature.values()];
};

type Strategy = 'perfect' | 'wrong' | 'remove' | 'keep';
const removes = (strategy: Strategy, real: boolean): boolean =>
  strategy === 'perfect' ? !real : strategy === 'wrong' ? real : strategy === 'remove';

/** Plays the clean-up to the pin list, linting every arrival and every verdict. Returns the pin-list rig and the problems found. */
const playCleanup = (seed: number, strategy: Strategy): { rig: Rig; problems: string[] } => {
  const rig = makeRig(seed);
  const problems: string[] = [];
  rig.closeDialogue();
  rig.wait(0.6);
  const { suspects } = rig.debug();
  suspects.forEach((s, i) => {
    problems.push(...lint(rig.look(), `seed ${seed} ${strategy} suspect ${i + 1} (${s.kind}) arrives`, true));
    rig.press(removes(strategy, s.real) ? 'a' : 'right', 0.9);
    problems.push(...lint(rig.look(), `seed ${seed} ${strategy} suspect ${i + 1} (${s.kind}) decided`, true));
    if (i < suspects.length - 1) rig.press('a', 0.5);
  });
  rig.press('a', 0.5); // on to the pin list
  rig.closeDialogue();
  rig.wait(0.6);
  return { rig, problems };
};

describe('the clean-up screen', () => {
  for (const strategy of ['perfect', 'wrong', 'remove', 'keep'] as const) {
    it(`keeps every string clear of the border, of the others and of the lens's dots (${strategy} play, all 20 attempts)`, () => {
      const seeds = attemptSeeds();
      expect(seeds.length).toBe(20);
      const problems: string[] = [];
      for (const seed of seeds) problems.push(...playCleanup(seed, strategy).problems);
      expect(problems.slice(0, 8)).toEqual([]);
    });
  }

  it('looks back at decided suspects without breaking the layout', () => {
    const problems: string[] = [];
    for (const seed of attemptSeeds()) {
      const rig = makeRig(seed);
      rig.closeDialogue();
      rig.wait(0.6);
      const { suspects } = rig.debug();
      suspects.forEach((s, i) => {
        rig.press(s.real ? 'right' : 'a', 0.5);
        if (i < suspects.length - 1) rig.press('a', 0.5);
      });
      for (let back = 1; back < suspects.length; back++) {
        rig.press('left', 0.2);
        problems.push(...lint(rig.look(), `seed ${seed} looking back ${back}`, true));
      }
    }
    expect(problems.slice(0, 8)).toEqual([]);
  });
});

describe('the pin screen', () => {
  for (const strategy of ['perfect', 'wrong', 'remove', 'keep'] as const) {
    it(`keeps every string clear of the border and of the others on every row, pinned or not (${strategy} clean-up, all 20 attempts)`, () => {
      const problems: string[] = [];
      for (const seed of attemptSeeds()) {
        const { rig, problems: found } = playCleanup(seed, strategy);
        problems.push(...found);
        const rows = rig.debug().list.length;
        for (let row = 0; row < rows; row++) {
          problems.push(...lint(rig.look(), `seed ${seed} ${strategy} pin cursor on row ${row + 1}`));
          rig.press('down', 0.5);
        }
        // pin three (the first three rows), look at the pinned list, then the LOCK IN row
        for (let row = 0; row < 3; row++) {
          rig.press('a', 0.3);
          rig.press('down', 0.5);
        }
        problems.push(...lint(rig.look(), `seed ${seed} ${strategy} three pinned`));
        rig.press('down', 0.5);
        rig.press('down', 0.5);
        problems.push(...lint(rig.look(), `seed ${seed} ${strategy} on LOCK IN`));
        rig.press('a', 0.3); // lock in: the reveal lights each variable in turn
        for (let line = 0; line < 8 && rig.talking(); line++) {
          problems.push(...lint(rig.look(), `seed ${seed} ${strategy} reveal line ${line + 1}`));
          rig.press('a', 0.1); // finish the typing
          rig.press('a', 0.3); // next line
        }
      }
      expect(problems.slice(0, 8)).toEqual([]);
    });
  }
});

describe('the hint tag under the box', () => {
  it('names LEFT only where there is something to look back at, and the buttons that work', () => {
    const rig = makeRig(1);
    rig.closeDialogue();
    rig.wait(0.6);
    const hint = () => rig.look().all.map(i => i.text).find(t => /^A: (REMOVE|NEXT|CONTINUE)/.test(t));
    const { suspects } = rig.debug();
    expect(hint()).toBe('A: REMOVE   RIGHT: KEEP   B: QUIT');
    rig.press(suspects[0]!.real ? 'right' : 'a', 0.5);
    expect(hint()).toBe('A: NEXT   B: QUIT'); // the first verdict: LEFT would do nothing
    rig.press('a', 0.5);
    rig.press(suspects[1]!.real ? 'right' : 'a', 0.5);
    expect(hint()).toBe('A: NEXT   LEFT: BACK   B: QUIT');
    for (let i = 2; i < suspects.length; i++) {
      rig.press('a', 0.5);
      rig.press(suspects[i]!.real ? 'right' : 'a', 0.5);
    }
    expect(hint()).toBe('A: CONTINUE   LEFT: BACK   B: QUIT'); // the last verdict leads on to the pin list
  });
});

describe('the lens spread', () => {
  const THREE = 17; // "0.0": 3 characters, 17px of ink
  const FOUR = 23; // "3.21": 4 characters

  it('makes five 3-character values take turns (a decimal point leaves 3px of air either side, so one row would read as a run)', () => {
    expect(lensStaggers(5, THREE)).toBe(true);
  });

  it('keeps three or four values on one row, and a lone value too', () => {
    expect(lensStaggers(3, FOUR)).toBe(false); // the sprint lens
    expect(lensStaggers(4, THREE)).toBe(false);
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
