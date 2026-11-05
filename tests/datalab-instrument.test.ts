// The instrument's button handling, driven the way RoomChallengeScene drives it (dialogue first, then the
// instrument with `busy` set while the dialogue had the step), with a fake host. No browser; drawing goes to a
// recording context in the mashing test.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RUNNING } from '../src/rooms/content/running';
import type { RoomResult } from '../src/rooms/types';
import { chooseAndLock, cleanAll, decideNow, makeRig, moveTo, onward, seeded, sport, tap, toReading, type Button, type Rig } from './datalab-rig';

// Sounds and screen-reader announcements are recorded, not played
const played: string[] = [];
const announced: string[] = [];
vi.mock('../src/audio/Sfx', () => ({ sfx: { play: (name: string) => played.push(name) } }));
vi.mock('../src/ui/announce', () => ({ announce: (text: string) => announced.push(text) }));

const content = RUNNING.data;
const LP = 'Lactate Profile';
const CS = 'Critical Speed Test';
const BOTH = [LP, CS];

beforeEach(() => {
  played.length = 0;
  announced.length = 0;
});

/** Everything the dialogue says until it closes (each new box once), pressing A through it. */
const readAll = (rig: Rig): string[] => {
  const lines: string[] = [];
  for (let guard = 0; guard < 60 && rig.talking(); guard++) {
    const text = rig.box()!.text;
    if (lines.at(-1) !== text) lines.push(text);
    rig.step(tap('a'));
    rig.wait(0.1);
  }
  return lines;
};

/** Through every file perfectly to the key-variable list. */
const toKeys = (rig: Rig) => cleanAll(rig, s => !s.real);

describe('the brief and the first file', () => {
  it('says the rules with a worked example and the controls, then the first file with its protocol and rule, then waits', () => {
    const rig = makeRig(7, { firstVisit: true, tests: BOTH });
    const lines = readAll(rig);
    expect(lines).toEqual([
      ...content.rules.map(r => r.replace('{DPAD}', 'D-PAD').replace('{A}', 'A')),
      `First file: ${content.lactate.intro}`,
      content.lactate.protocol,
      content.lactate.lensRule,
    ]);
    expect(content.rules[1]).toContain('For example');
    expect(content.rules.at(-1)).toBe('Use {DPAD} to choose KEEP or REMOVE, then {A}.');
    const d = rig.debug();
    expect(d.phase).toBe('cleanup');
    expect(d.file).toBe('lactate');
    expect(d.choice).toBe('KEEP IT (REAL)');
    expect(announced).toContain('FILE 1 of 2: LACTATE PROFILE (TREADMILL)');
  });

  it('says the short rules and only the switch line on a replay', () => {
    const rig = makeRig(7, { firstVisit: false, tests: BOTH });
    expect(readAll(rig)).toEqual([content.rulesShort.replace('{DPAD}', 'D-PAD').replace('{A}', 'A'), `First file: ${content.lactate.intro}`]);
  });

  it('asks the question for the reading, with what the software says, and reads the options out', () => {
    const rig = makeRig(7, { tests: BOTH });
    toReading(rig);
    const last = announced.at(-1)!;
    expect(last.startsWith('Reading 1 of ')).toBe(true);
    expect(last).toContain('Real data, or a glitch?');
    expect(last).toContain('Choose keep it (real) or remove it (glitch). Now on keep it (real).');
  });

  it('quits at once on B (nothing is decided)', () => {
    const rig = makeRig(7, { tests: BOTH });
    toReading(rig);
    rig.press('b');
    expect(rig.quits()).toBe(1);
  });
});

describe('deciding a reading', () => {
  it('starts on KEEP, moves with UP and DOWN (wrapping), and says each option', () => {
    const rig = makeRig(3, { tests: BOTH });
    toReading(rig);
    rig.press('down', 0.05);
    expect(rig.debug().choice).toBe('REMOVE IT (GLITCH)');
    expect(announced.at(-1)).toBe('REMOVE IT (GLITCH)');
    rig.press('down', 0.05);
    expect(rig.debug().choice).toBe('KEEP IT (REAL)');
    rig.press('up', 0.05);
    expect(rig.debug().choice).toBe('REMOVE IT (GLITCH)');
  });

  it('ignores A for 0.35 s after a reading appears, then confirms the option under the cursor', () => {
    const rig = makeRig(3, { tests: BOTH });
    rig.closeDialogue();
    rig.press('a', 0.05);
    expect(rig.debug().decided).toBe(0);
    rig.wait(0.4);
    rig.press('a', 0.05);
    expect(rig.debug().decided).toBe(1);
    expect(rig.debug().suspects[0]!.decided).toBe('kept');
  });

  it('has no RIGHT shortcut any more: RIGHT decides nothing', () => {
    const rig = makeRig(3, { tests: BOTH });
    toReading(rig);
    rig.press('right', 0.5);
    expect(rig.debug().decided).toBe(0);
  });

  it('REMOVE takes the reading out of the file, and the verdict follows the content', () => {
    const rig = makeRig(5, { tests: BOTH });
    toReading(rig);
    const s = rig.debug().suspects[0]!;
    decideNow(rig, true);
    expect(rig.debug().suspects[0]!.decided).toBe('removed');
    const said = announced.at(-1)!;
    expect(said.startsWith('Removed. ')).toBe(true);
    const why = s.kind === 'knee' || s.kind === 'peak' || s.kind === 'contaminated' || s.kind === 'failed' ? content.lactate[s.kind].why : '';
    expect(said).toContain(why);
    expect(played).toContain(s.real ? 'wrong' : 'correct');
  });

  it('looks back with LEFT (read-only) and comes forward again with A', () => {
    const rig = makeRig(5, { tests: BOTH });
    toReading(rig);
    decideNow(rig, false);
    onward(rig);
    expect(rig.debug().view).toBe(1);
    rig.press('left', 0.4);
    expect(rig.debug().view).toBe(0);
    expect(rig.debug().choice).toBeNull(); // decided: no list
    rig.press('a', 0.4);
    expect(rig.debug().view).toBe(1);
    expect(rig.debug().choice).toBe('KEEP IT (REAL)');
  });

  it('asks before leaving once a decision is made: STAY keeps the work, LEAVE quits', () => {
    const rig = makeRig(5, { tests: BOTH });
    toReading(rig);
    decideNow(rig, false);
    rig.press('b', 0.5);
    expect(rig.box()?.choices).toEqual(['STAY', 'LEAVE']);
    rig.press('b', 0.5); // B again stays
    expect(rig.talking()).toBe(false);
    expect(rig.quits()).toBe(0);
    rig.press('b', 0.1);
    rig.pick(1);
    expect(rig.quits()).toBe(1);
  });
});

describe('the switch to the next file', () => {
  it('puts up the trials file with its own line after the last lactate reading, before its first reading', () => {
    const rig = makeRig(9, { firstVisit: true, tests: BOTH });
    toReading(rig);
    const lactate = rig.debug().suspects.filter(s => s.file === 'lactate').length;
    for (let i = 0; i < lactate; i++) {
      decideNow(rig, !rig.debug().suspects[i]!.real);
      if (i < lactate - 1) onward(rig);
    }
    announced.length = 0;
    rig.press('a', 0.3);
    expect(rig.debug().file).toBe('trials');
    expect(rig.debug().phase).toBe('intro');
    expect(announced).toContain('FILE 2 of 2: CRITICAL SPEED (TRACK TRIALS)');
    const lines = readAll(rig);
    expect(lines).toEqual([`Next file: ${content.trials.intro}`, content.trials.protocol, content.trials.lensRule]);
    rig.wait(0.5);
    expect(rig.debug().phase).toBe('cleanup');
    expect(announced.at(-1)!.startsWith('Reading 1 of 2: the 1200 m trial.')).toBe(true);
  });

  it('shows critical speed and D prime only once the trials file is clean', () => {
    const rig = makeRig(9, { tests: [CS] });
    toReading(rig);
    expect(readAll(rig)).toEqual([]);
    decideNow(rig, false); // the 1200 m: real
    expect(announced.at(-1)).not.toMatch(/CS 17/);
    onward(rig);
    decideNow(rig, true); // the mistimed trial
    expect(announced.at(-1)).toContain('CS 17.8 km/h (3:22 per km)  D PRIME 140 m');
  });
});

describe('the key variables', () => {
  it('says the files are clean and what to choose (with the count), then the example on a first visit', () => {
    const rig = makeRig(4, { firstVisit: true, tests: BOTH });
    toReading(rig);
    const n = rig.debug().suspects.length;
    rig.debug().suspects.forEach((s, i) => {
      decideNow(rig, !s.real);
      if (i < n - 1) onward(rig);
    });
    rig.press('a', 0.3);
    expect(readAll(rig)).toEqual([
      'Files clean. Now choose her KEY VARIABLES: the 4 numbers you would use to set her training paces and explain her finish.',
      content.keyExample,
    ]);
    rig.wait(0.5);
    expect(rig.debug().phase).toBe('pin');
    expect(rig.debug().cursor).toBe(0);
  });

  it('says "File clean" and the smaller count for a battery with one file, and offers only its variables', () => {
    const rig = makeRig(4, { tests: [LP, 'Beep Test'] });
    rig.closeDialogue();
    rig.wait(0.5);
    const n = rig.debug().suspects.length;
    expect(rig.debug().files).toEqual(['lactate']);
    rig.debug().suspects.forEach((s, i) => {
      decideNow(rig, !s.real);
      if (i < n - 1) onward(rig);
    });
    rig.press('a', 0.3);
    expect(readAll(rig)[0]).toBe('File clean. Now choose her KEY VARIABLES: the 2 numbers you would use to set her training paces and explain her finish.');
    const d = rig.debug();
    expect(d.pinLimit).toBe(2);
    expect(d.list.every(r => r.file === 'lactate')).toBe(true);
    expect(d.list.map(r => r.name).join(' ')).not.toMatch(/Critical|D Prime|Trial/);
  });

  it('groups the list by file, lactate first', () => {
    const rig = makeRig(4, { tests: BOTH });
    toKeys(rig);
    const files = rig.debug().list.map(r => r.file);
    expect(files).toEqual([...files].sort());
    expect(new Set(files)).toEqual(new Set(['lactate', 'trials']));
  });

  it('chooses with A, refuses one more than the count, and offers LOCK IN only when full', () => {
    const rig = makeRig(4, { tests: BOTH });
    toKeys(rig);
    const { list, pinLimit } = rig.debug();
    for (let i = 0; i < pinLimit; i++) {
      moveTo(rig, i);
      rig.press('a', 0.3);
    }
    expect(rig.debug().pins).toHaveLength(pinLimit);
    moveTo(rig, pinLimit);
    rig.press('a', 0.3);
    expect(rig.debug().pins).toHaveLength(pinLimit);
    expect(played).toContain('wrong');
    expect(announced.some(a => a === `All ${pinLimit} key variables are chosen. Take one out first.`)).toBe(true);
    moveTo(rig, list.length); // the LOCK IN row exists now
    expect(rig.debug().cursor).toBe(list.length);
  });

  it('asks before locking in: STAY goes back to the list, LOCK IN starts the reveal', () => {
    const rig = makeRig(4, { tests: BOTH });
    toKeys(rig);
    const { list } = rig.debug();
    list.forEach((r, i) => {
      if (!r.key) return;
      moveTo(rig, i);
      rig.press('a', 0.3);
    });
    moveTo(rig, list.length);
    rig.press('a', 0.3);
    expect(rig.box()).toEqual({ text: "Lock in these 4 key variables? You can't change them after.", choices: ['STAY', 'LOCK IN'] });
    expect(announced.at(-1)!.startsWith('Your key variables: ')).toBe(true);
    rig.pick(0); // STAY
    expect(rig.debug().phase).toBe('pin');
    expect(rig.results).toHaveLength(0);
    rig.wait(0.4);
    rig.press('a', 0.1);
    rig.pick(1);
    expect(rig.debug().phase).toBe('reveal');
  });

  it('records the stat after a perfect run: data quality 0.8, variable accuracy 1, after a line per key variable and the insight', () => {
    const rig = makeRig(4, { tests: BOTH });
    toKeys(rig);
    const { list } = rig.debug();
    for (const [i, r] of list.entries()) {
      if (!r.key) continue;
      moveTo(rig, i);
      rig.press('a', 0.3);
    }
    moveTo(rig, list.length);
    rig.press('a', 0.1);
    rig.pick(1);
    const lines = readAll(rig);
    expect(lines.slice(0, 4).every(l => l.startsWith('Key! '))).toBe(true);
    expect(lines.at(-1)).toBe(sport.variableInsight);
    expect(rig.results).toHaveLength(1);
    expect(rig.results[0]!.dataQuality).toBeCloseTo(0.8, 10);
    expect(rig.results[0]!.variableAccuracy).toBe(1);
  });

  it('judges a wrong choice, names the missed key variables, and scores them', () => {
    const rig = makeRig(4, { tests: BOTH });
    toKeys(rig);
    const { list, pinLimit } = rig.debug();
    const rows = [...list.keys()];
    const chosen = [...rows.filter(i => !list[i]!.key), ...rows.filter(i => list[i]!.key)].slice(0, pinLimit).sort((a, b) => a - b);
    for (const i of chosen) {
      moveTo(rig, i);
      rig.press('a', 0.3);
    }
    moveTo(rig, list.length);
    rig.press('a', 0.1);
    rig.pick(1);
    const lines = readAll(rig);
    const wrong = chosen.filter(i => !list[i]!.key).length;
    expect(lines.filter(l => l.startsWith('Not key. ')).length).toBe(wrong);
    expect(lines.filter(l => l.startsWith('Missed: ')).length).toBe(wrong);
    expect(rig.results[0]!.variableAccuracy).toBeCloseTo((pinLimit - wrong) / pinLimit, 10);
  });

  it('B during the reveal takes the result at once instead of throwing it away', () => {
    const rig = makeRig(4, { tests: BOTH });
    toKeys(rig);
    const { list } = rig.debug();
    moveTo(rig, 0);
    for (let i = 0; i < rig.debug().pinLimit; i++) {
      moveTo(rig, i);
      rig.press('a', 0.3);
    }
    moveTo(rig, list.length);
    rig.press('a', 0.1);
    rig.pick(1);
    rig.press('b', 0.1);
    expect(rig.quits()).toBe(0);
    expect(rig.results).toHaveLength(1);
  });
});

describe('mashing buttons at random', () => {
  const BUTTONS: Button[] = ['a', 'a', 'a', 'b', 'left', 'right', 'up', 'down', 'down'];
  const drawn = { calls: 0 };
  const ctx = {
    fillStyle: '',
    globalAlpha: 1,
    fillRect: () => void drawn.calls++,
    drawImage: () => void drawn.calls++,
    save() {},
    restore() {},
    beginPath() {},
    rect() {},
    clip() {},
  } as unknown as CanvasRenderingContext2D;
  beforeEach(() => {
    vi.stubGlobal('document', {
      createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillStyle: '', fillRect() {}, drawImage() {} }) }),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('never breaks, for every kind of battery: the state stays consistent and the stat is recorded at most once', () => {
    const reached = { pin: 0, done: 0 };
    const batteries = [BOTH, [LP], [CS], []];
    for (let seed = 1; seed <= 60; seed++) {
      const pick = seeded(seed * 31 + 5);
      const rig = makeRig(seed, { firstVisit: seed % 3 !== 0, tests: batteries[seed % batteries.length]! });
      for (let n = 0; n < 3000 && rig.results.length === 0 && rig.quits() === 0; n++) {
        if (pick() < 0.35) rig.step();
        else rig.step(tap(BUTTONS[Math.floor(pick() * BUTTONS.length)]!));
        if (n % 17 === 0) rig.render(ctx);
        if (n % 40 === 0) {
          const d = rig.debug();
          expect(['brief', 'intro', 'cleanup', 'choose', 'pin', 'reveal']).toContain(d.phase);
          expect(d.pins.length).toBeLessThanOrEqual(d.pinLimit);
          expect(d.cursor).toBeLessThanOrEqual(d.list.length);
          const decided = d.suspects.map(s => s.decided !== null);
          expect(decided.indexOf(false) === -1 || decided.slice(decided.indexOf(false)).every(x => !x)).toBe(true);
        }
      }
      expect(rig.results.length).toBeLessThanOrEqual(1);
      if (['pin', 'reveal'].includes(rig.debug().phase)) reached.pin++;
      reached.done += rig.results.length + rig.quits();
      const r: RoomResult | undefined = rig.results[0];
      if (r) {
        expect(r.dataQuality).toBeGreaterThanOrEqual(0.5);
        expect(r.dataQuality).toBeLessThanOrEqual(0.8 + 1e-9);
      }
    }
    expect(drawn.calls).toBeGreaterThan(5000);
    expect(reached.pin + reached.done).toBeGreaterThan(5);
  });
});
