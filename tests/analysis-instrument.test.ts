// The Analysis Room instrument's flow, driven the way RoomChallengeScene drives it (dialogue first, then the
// instrument with the dialogueBusy flag), with a fake host and no canvas.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LEVEL_DATA } from '../src/data/sports';
import { RUNNING } from '../src/rooms/content/running';
import { createAnalysisInstrument, type Session } from '../src/rooms/analysis';
import { VERDICTS, createReview, type Verdict } from '../src/rooms/analysis/model';
import { createDialogueSystem } from '../src/systems/Dialogue';
import { consoleLabel, fillButtonNames, type Button, type Input, type InputState } from '../src/engine/Input';
import type { RoomHost, RoomResult } from '../src/rooms/types';
import { calcStat } from '../src/state/GameState';
import { announce } from '../src/ui/announce';

// What the screen reader is told is checked below: the live region itself needs a page, so it is replaced by a spy.
vi.mock('../src/ui/announce', () => ({ announce: vi.fn() }));

const content = RUNNING.analysis;
const sport = LEVEL_DATA[3]!;
const DT = 1 / 60;

const seeded = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const idle = (): InputState => ({
  up: false, down: false, left: false, right: false, a: false, b: false, start: false, select: false,
  upPressed: false, downPressed: false, leftPressed: false, rightPressed: false, aPressed: false, bPressed: false, startPressed: false, selectPressed: false,
  upRepeat: false, downRepeat: false, leftRepeat: false, rightRepeat: false,
  action: false, actionPressed: false, escape: false, escapePressed: false, typed: [],
});

/** A press of one button, as the input layer reports it for a single step (pressed, held and repeating). */
const pressing = (button: 'up' | 'down' | 'left' | 'right' | 'a' | 'b'): InputState => {
  const state = idle();
  state[button] = true;
  state[`${button}Pressed`] = true;
  if (button !== 'a' && button !== 'b') state[`${button}Repeat` as 'upRepeat'] = true;
  return state;
};

interface Debug {
  phase: string;
  step: string;
  pin: number;
  pinSteps: number;
  forecastImprovement: number | null;
  c1: number | null;
  verdicts: Array<{ row: string; picked: Verdict; right: boolean }>;
  options: { trained: Verdict[]; decoy: Verdict[] };
  weeks: number;
  q: number | null;
  result: RoomResult | null;
}

const setup = (options: { firstVisit?: boolean; seed?: number; content?: typeof content; session?: Session } = {}) => {
  const dialogue = createDialogueSystem();
  const log = { quits: 0, blocked: 0, completed: [] as RoomResult[] };
  const input = { fill: (text: string) => fillButtonNames(text, consoleLabel), blockRepeats: () => void log.blocked++ } as unknown as Input;
  const host: RoomHost = {
    sport,
    level: 3,
    input,
    dialogue,
    say: (text, choices, onDone, opts) => dialogue.show(text, choices, onDone, () => host.quit(), { exitLabel: 'QUIT', ...opts }),
    sayAll: (texts, onDone, opts) => dialogue.showSequence(texts, onDone, () => host.quit(), { exitLabel: 'QUIT', ...opts }),
    quit: () => void log.quits++,
    complete: result => void log.completed.push(result),
    firstVisit: options.firstVisit ?? true,
    replay: false,
    rulesRead: () => {},
  };
  const instrument = createAnalysisInstrument(host, options.content ?? content, seeded(options.seed ?? 11), options.session);

  /** One step the way the scene runs it. */
  const tick = (inp: InputState = idle(), forceBusy = false) => {
    const busy = dialogue.isActive();
    dialogue.update(DT, inp);
    instrument.update(DT, inp, forceBusy || busy || dialogue.isActive());
  };
  const wait = (seconds: number) => {
    for (let i = 0; i < Math.ceil(seconds / DT); i++) tick();
  };
  const tap = (button: Parameters<typeof pressing>[0]) => {
    tick(pressing(button));
    tick();
  };
  const state = (): Debug => instrument.debug!() as Debug;
  const said = (): string => dialogue.state.pages.flat().join(' ');
  const choices = (): string[] => dialogue.state.choices ?? [];
  /** Let the dialogue's text finish typing. */
  const read = () => {
    for (let i = 0; i < 600 && dialogue.state.active && !dialogue.state.waitingForInput; i++) tick();
  };
  /** A through plain text lines until the dialogue is closed (or a list is up). */
  const closeText = () => {
    for (let i = 0; i < 30 && dialogue.state.active && !dialogue.state.choices; i++) {
      read();
      tap('a');
    }
  };
  /** Finish the line being said and press A once (to the next line, or to close it). */
  const advance = () => {
    read();
    tap('a');
  };
  const pickByText = (text: string) => {
    read();
    wait(0.4); // the list ignores A for a moment
    const target = choices().indexOf(text);
    expect(target, `${text} in ${choices().join(' | ')}`).toBeGreaterThanOrEqual(0);
    for (let i = 0; i < target; i++) tap('down');
    tap('a');
  };
  const untilStep = (step: string, max = 20) => {
    for (let i = 0; i < max * 60 && state().step !== step; i++) tick();
    expect(state().step).toBe(step);
  };
  /** Brief, block and into the forecast. */
  const toForecast = () => {
    closeText();
    untilStep('forecast');
    wait(0.4);
  };
  const forecast = (steps: number) => {
    const dir = steps >= 0 ? 'right' : 'left';
    for (let i = 0; i < Math.abs(steps); i++) tap(dir);
    expect(state().pinSteps).toBe(steps);
  };
  const lockAndRead = () => {
    tap('a');
    expect(state().step).toBe('retest');
    for (let i = 0; i < 6 * 60 && !(dialogue.state.active && said().startsWith('Retest:')); i++) tick();
    expect(said()).toMatch(/^Retest:/);
    read();
    tap('a');
  };
  return { host, instrument, dialogue, log, tick, wait, tap, state, said, choices, read, advance, closeText, pickByText, untilStep, toForecast, forecast, lockAndRead };
};

describe('the brief', () => {
  it('says the rules in two texts the first time, and the short rule on a repeat visit', () => {
    const first = setup({ firstVisit: true });
    expect(first.said()).toBe(content.rules[0]!.replace(/\s+/g, ' '));
    first.read();
    first.tap('a');
    expect(first.said()).toBe(content.rules[1]!);
    expect(first.state().step).toBe('brief');
    first.closeText();
    expect(first.state().step).toBe('block');

    const again = setup({ firstVisit: false });
    expect(again.said()).toBe(content.rulesShort);
    again.closeText();
    expect(again.state().step).toBe('block');
  });

  it('says the full rules again to a player who left before the end of them, until they have read them', () => {
    const session: Session = { rulesRead: false };
    const left = setup({ firstVisit: true, session });
    left.tap('b'); // leaves on the first text
    expect(left.log.quits).toBe(1);
    expect(session.rulesRead).toBe(false);

    // the scene now calls the next visit a repeat, but the rules were never read
    const back = setup({ firstVisit: false, session });
    expect(back.said()).toBe(content.rules[0]!.replace(/\s+/g, ' '));
    back.read();
    back.tap('a');
    expect(back.said()).toBe(content.rules[1]!);
    back.tap('b'); // and leaves on the second text
    expect(back.log.quits).toBe(1);
    expect(session.rulesRead).toBe(false);

    const again = setup({ firstVisit: false, session });
    expect(again.said()).toBe(content.rules[0]!.replace(/\s+/g, ' '));
    again.closeText();
    expect(again.state().step).toBe('block');
    expect(session.rulesRead).toBe(true);

    const later = setup({ firstVisit: false, session });
    expect(later.said()).toBe(content.rulesShort);
  });

  it('copes with a different number of rules texts (none: the short rule is said instead; one; three)', () => {
    for (const rules of [[], ['Only one.'], ['One.', 'Two.', 'Three.']]) {
      const t = setup({ firstVisit: true, content: { ...content, rules } });
      const expected = rules.length > 0 ? rules : [content.rulesShort];
      for (const text of expected) {
        expect(t.said()).toBe(text);
        t.read();
        t.tap('a');
      }
      expect(t.state().step).toBe('block');
    }
  });

  it('quits on B, nothing decided', () => {
    const t = setup();
    t.tap('b');
    expect(t.log.quits).toBe(1);
    expect(t.log.completed).toEqual([]);
  });
});

describe('the block', () => {
  it('fills a week every quarter second, then moves to the forecast by itself', () => {
    const t = setup();
    t.closeText();
    expect(t.state().step).toBe('block');
    t.wait(0.3);
    expect(t.state().weeks).toBe(1);
    t.wait(1.0);
    expect(t.state().weeks).toBe(5);
    t.wait(1.3);
    expect(t.state().weeks).toBe(content.weeks);
    t.untilStep('forecast');
    expect(t.state().phase).toBe('forecast');
  });

  it('is skipped with A (after a moment), and left with B', () => {
    const t = setup();
    t.closeText();
    t.tap('a'); // too soon: ignored
    expect(t.state().step).toBe('block');
    t.wait(0.4);
    t.tap('a');
    expect(t.state().step).toBe('forecast');

    const u = setup();
    u.closeText();
    u.wait(0.4);
    u.tap('b');
    expect(u.log.quits).toBe(1);
  });
});

describe('the forecast', () => {
  it('starts on the baseline, blocks held repeats, and moves one step per press up to the ends', () => {
    const t = setup();
    t.toForecast();
    expect(t.log.blocked).toBeGreaterThan(0);
    expect(t.state()).toMatchObject({ pin: 62, pinSteps: 0 });
    t.forecast(8);
    expect(t.state().pin).toBe(60.4);
    t.tap('left');
    expect(t.state().pin).toBe(60.6);
    for (let i = 0; i < 40; i++) t.tap('right');
    expect(t.state()).toMatchObject({ pin: 57, pinSteps: 25 });
    for (let i = 0; i < 60; i++) t.tap('left');
    expect(t.state()).toMatchObject({ pin: 65, pinSteps: -15 });
  });

  it('speeds up while a direction is held', () => {
    const t = setup();
    t.toForecast();
    // hold RIGHT the way the input layer reports it: pressed at once, then a repeat every 85 ms after 300 ms
    let pinAfterOneSecond = 0;
    let pinAfterOneAndAHalf = 0;
    for (let ms = 0; ms <= 1600; ms += 17) {
      const inp = { ...idle(), right: true };
      if (ms === 0) {
        inp.rightPressed = true;
        inp.rightRepeat = true;
      } else if (ms >= 300 && (ms - 300) % 85 < 17) {
        inp.rightRepeat = true;
      }
      t.tick(inp);
      if (ms <= 1000) pinAfterOneSecond = t.state().pinSteps;
      if (ms <= 1500) pinAfterOneAndAHalf = t.state().pinSteps;
    }
    // one step per repeat for the first second (about 9 repeats), two per repeat after it
    expect(pinAfterOneSecond).toBeLessThanOrEqual(11);
    expect(pinAfterOneAndAHalf - pinAfterOneSecond).toBeGreaterThanOrEqual(9);
    expect(t.state().pinSteps).toBeGreaterThan(20);
  });

  it('moves the pin straight away: inside the lock only A and B wait', () => {
    const t = setup();
    t.closeText();
    t.untilStep('forecast');
    t.tap('right'); // within 0.35 s of the forecast appearing
    t.tap('right');
    expect(t.state().pinSteps).toBe(2);
    t.tap('left');
    expect(t.state().pinSteps).toBe(1);
    t.tap('b'); // too soon to leave
    t.tap('a'); // and too soon to lock in
    expect(t.log.quits).toBe(0);
    expect(t.state().step).toBe('forecast');
    t.wait(0.4);
    t.tap('b');
    expect(t.log.quits).toBe(1);
  });

  it('ignores A until its lock is over, and while the dialogue is busy', () => {
    const t = setup();
    t.closeText();
    t.untilStep('forecast');
    t.tap('a'); // within 0.35 s of the forecast appearing
    expect(t.state().step).toBe('forecast');
    t.wait(0.4);
    t.tick(pressing('a'), true); // the dialogue used this press
    expect(t.state().step).toBe('forecast');
    t.tap('a');
    expect(t.state().step).toBe('retest');
  });

  it('quits on B straight away (nothing is decided yet)', () => {
    const t = setup();
    t.toForecast();
    t.forecast(5);
    t.tap('b');
    expect(t.log.quits).toBe(1);
  });
});

describe('after the forecast is locked', () => {
  it('lands the dot, says how far off the forecast was, and asks for the first verdict', () => {
    const t = setup();
    t.toForecast();
    t.forecast(8);
    t.tap('a');
    expect(t.state()).toMatchObject({ phase: 'retest', forecastImprovement: 1.6, c1: 1 });
    t.untilStep('retest');
    for (let i = 0; i < 6 * 60 && !t.dialogue.state.active; i++) t.tick();
    expect(t.said()).toBe('Retest: 60 s. You forecast 60.4 s. Off by 0.4: inside the error bars.');
    t.read();
    t.tap('a');
    expect(t.state()).toMatchObject({ phase: 'verdict1', step: 'asking' });
    t.read();
    expect(t.said()).toBe('Judge the result: 62 → 60 s.');
    expect(t.choices().sort()).toEqual([...content.verdicts].sort());
    // the list is the model's shuffle for this attempt
    expect(t.choices()).toEqual(t.state().options.trained.map(v => content.verdicts[VERDICTS.indexOf(v)]));
  });

  it('can skip the retest picture with A once its lock is over', () => {
    const t = setup();
    t.toForecast();
    t.forecast(8);
    t.tap('a');
    t.tap('a'); // within the lock: ignored
    expect(t.dialogue.state.active).toBe(false);
    t.wait(0.4);
    t.tap('a');
    t.tick();
    expect(t.said()).toMatch(/^Retest:/);
  });

  it('asks before leaving, and B on the question means stay', () => {
    const t = setup();
    t.toForecast();
    t.forecast(8);
    t.tap('a');
    t.wait(0.5);
    t.tap('b');
    expect(t.said()).toBe('Leave the review? Your forecast will be lost.');
    expect(t.choices()).toEqual(['STAY', 'LEAVE']);
    expect(t.log.quits).toBe(0);
    t.read();
    t.wait(0.4);
    t.tap('b'); // B again: stay
    expect(t.dialogue.state.active).toBe(false);
    expect(t.log.quits).toBe(0);
    expect(t.state().step).toBe('retest'); // and the retest carries on
    t.tap('b');
    t.read();
    t.wait(0.4);
    t.tap('down');
    t.tap('a'); // LEAVE
    expect(t.log.quits).toBe(1);
    expect(t.log.completed).toEqual([]);
  });

  it('asks before leaving from a verdict list, and shows the same list again after STAY', () => {
    const t = setup();
    t.toForecast();
    t.forecast(8);
    t.lockAndRead();
    t.read();
    const list = t.choices();
    t.wait(0.4);
    t.tap('b');
    expect(t.said()).toBe('Leave the review? Your forecast will be lost.');
    t.read();
    t.wait(0.4);
    t.tap('a'); // STAY
    t.read();
    expect(t.said()).toBe('Judge the result: 62 → 60 s.');
    expect(t.choices()).toEqual(list);
  });

  it('asks again when a pick cannot be taken, never leaving nothing on the screen', () => {
    const t = setup();
    t.toForecast();
    t.forecast(8);
    t.lockAndRead();
    t.read();
    const list = t.choices();
    t.wait(0.4);
    t.dialogue.state.selectedChoice = 9; // not an option of the list
    t.tap('a');
    t.read();
    expect(t.dialogue.state.active).toBe(true);
    expect(t.said()).toBe('Judge the result: 62 → 60 s.');
    expect(t.choices()).toEqual(list);
    expect(t.state().verdicts).toEqual([]);
    expect(t.state().step).toBe('asking');
  });

  it('plays a perfect review to a 96% stat, whatever order the lists are in', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const t = setup({ seed });
      t.toForecast();
      t.forecast(10); // exactly 2.0 better
      t.lockAndRead();
      t.pickByText('REAL AND WORTH ACTING ON');
      t.read();
      expect(t.said()).toBe('Right. It moved 2.0 s: beyond the typical error (0.6) and the smallest worthwhile change (0.8).');
      t.advance();
      t.untilStep('asking');
      t.read();
      expect(t.said()).toBe('Judge the result: 65 → 67 ml/kg/min.');
      t.pickByText('REAL BUT TOO SMALL TO MATTER');
      t.read();
      expect(t.said()).toBe('Right. It moved 2.0 ml/kg/min: beyond the typical error (1.5) but short of the smallest worthwhile change (3.0).');
      t.advance();
      t.read();
      expect(t.said()).toBe(sport.predictionInsight);
      expect(t.log.completed).toEqual([]);
      t.advance();
      expect(t.log.completed).toHaveLength(1);
      const done = t.log.completed[0]!;
      expect(calcStat(done.dataQuality, done.variableAccuracy)).toBeCloseTo(0.96, 6);
      expect(t.state()).toMatchObject({ step: 'done', phase: 'summary' });
      expect(t.state().result).toEqual(done);
    }
  });

  it('says "Not quite." and still explains the true verdict after a wrong pick, and scores it low', () => {
    const t = setup();
    t.toForecast();
    t.forecast(0); // no change: far from the retest
    t.lockAndRead();
    expect(t.state().c1).toBeCloseTo(0.2222, 3);
    t.pickByText('NOISE');
    t.read();
    expect(t.said()).toBe('Not quite. It moved 2.0 s: beyond the typical error (0.6) and the smallest worthwhile change (0.8).');
    t.advance();
    t.untilStep('asking');
    t.pickByText('REAL AND WORTH ACTING ON');
    t.read();
    expect(t.said()).toMatch(/^Not quite\. It moved 2\.0 ml\/kg\/min/);
    t.advance();
    t.advance();
    const done = t.log.completed[0]!;
    // c1 = 0.222, c2 = 0: q = 0.133, stat = 0.32 + 0.64 q
    expect(calcStat(done.dataQuality, done.variableAccuracy)).toBeCloseTo(0.32 + 0.64 * 0.6 * 0.2222, 2);
    expect(t.state().verdicts.map(v => v.right)).toEqual([false, false]);
  });

  it('records the result once, and only at the very end', () => {
    const t = setup();
    t.toForecast();
    t.forecast(10);
    t.lockAndRead();
    t.pickByText('REAL AND WORTH ACTING ON');
    t.advance();
    expect(t.log.completed).toEqual([]);
    t.untilStep('asking');
    t.pickByText('NOISE');
    t.advance();
    expect(t.log.completed).toEqual([]); // the insight is still to be read
    t.advance();
    expect(t.log.completed).toHaveLength(1);
    t.wait(5);
    expect(t.log.completed).toHaveLength(1);
  });
});

describe('for a screen reader', () => {
  beforeEach(() => void vi.mocked(announce).mockClear());
  const heard = (): string[] => vi.mocked(announce).mock.calls.map(call => call[0]);
  const lastHeard = (): string | undefined => heard()[heard().length - 1];

  it('reads the board\'s stamp ahead of the explanation: what was said, and what was true when it was wrong', () => {
    const t = setup();
    t.toForecast();
    t.forecast(0);
    t.lockAndRead();
    t.pickByText('NOISE');
    expect(lastHeard()).toBe(
      'You said noise. It is real and worth acting on. Not quite. It moved 2.0 s: beyond the typical error (0.6) and the smallest worthwhile change (0.8).',
    );
    t.advance();
    t.untilStep('asking');
    t.pickByText('REAL AND WORTH ACTING ON');
    expect(lastHeard()).toBe(
      'You said real and worth acting on. It is real but too small to matter. Not quite. It moved 2.0 ml/kg/min: beyond the typical error (1.5) but short of the smallest worthwhile change (3.0).',
    );
  });

  it('keeps it short when the verdict was right', () => {
    const t = setup();
    t.toForecast();
    t.forecast(10);
    t.lockAndRead();
    t.pickByText('REAL AND WORTH ACTING ON');
    expect(lastHeard()).toBe(
      'You said real and worth acting on. Right. It moved 2.0 s: beyond the typical error (0.6) and the smallest worthwhile change (0.8).',
    );
  });

  it('says the stamp again, with the explanation, when the player stays after asking to leave', () => {
    const t = setup();
    t.toForecast();
    t.forecast(10);
    t.lockAndRead();
    t.pickByText('NOISE');
    t.read();
    t.wait(0.4);
    t.tap('b'); // leave?
    t.read();
    t.wait(0.4);
    t.tap('b'); // stay
    expect(lastHeard()).toMatch(/^You said noise\. It is real and worth acting on\. Not quite\. It moved 2\.0 s/);
  });

  it('reads the forecast once the pin has rested, and not while it is moving', () => {
    const t = setup();
    t.toForecast();
    vi.mocked(announce).mockClear();
    t.tap('right');
    t.wait(0.2);
    t.tap('right');
    t.wait(0.2);
    expect(heard().filter(text => text.startsWith('Forecast'))).toEqual([]); // still moving
    t.wait(0.5);
    expect(heard().filter(text => text.startsWith('Forecast'))).toEqual(['Forecast 61.6 s, 0.4 better. Inside the noise band.']);
  });
});

describe('replays', () => {
  it('reshuffles the verdict lists but keeps the evidence (the history ticks) the same', () => {
    const orders = new Set<string>();
    for (let seed = 1; seed <= 30; seed++) {
      const review = createReview(content, seeded(seed));
      orders.add(review.optionsFor('trained').join(','));
    }
    expect(orders.size).toBeGreaterThan(1);
    expect(content.history).toEqual([1.6, 2.4]); // content, not chance
  });
});

describe('rough handling', () => {
  const BUTTONS = ['up', 'down', 'left', 'right', 'a', 'b'] as const;

  it('survives mashing every button at random: no errors, never two results, a result only in range', () => {
    let finishes = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const rng = seeded(seed * 7919);
      const t = setup({ seed, firstVisit: rng() < 0.5 });
      for (let frame = 0; frame < 9000 && t.log.quits === 0 && t.log.completed.length === 0; frame++) {
        const roll = rng();
        if (roll < 0.1) t.tick(pressing('a'));
        else if (roll < 0.14) t.tick(pressing(BUTTONS[Math.floor(rng() * BUTTONS.length)] as (typeof BUTTONS)[number]));
        else t.tick();
      }
      expect(t.log.completed.length).toBeLessThanOrEqual(1);
      for (const done of t.log.completed) {
        finishes++;
        const stat = calcStat(done.dataQuality, done.variableAccuracy);
        expect(stat).toBeGreaterThanOrEqual(0.32 - 1e-9);
        expect(stat).toBeLessThanOrEqual(0.96 + 1e-9);
      }
    }
    expect(finishes).toBeGreaterThan(5); // plenty of the mashers get to the end
  });

  /** Plays through the buttons like a player who clicks around: random pin, random verdicts, nothing planned. */
  const randomPlayer = (seed: number) => {
    const rng = seeded(seed);
    const t = setup({ seed });
    let moves = Math.floor(rng() * 41) - 15; // where the pin should end up
    for (let frame = 0; frame < 20000 && t.log.quits === 0 && t.log.completed.length === 0; frame++) {
      const state = t.state();
      if (t.dialogue.state.active) {
        if (!t.dialogue.state.waitingForInput) t.tick(pressing('a')); // skip the typing
        else if (t.dialogue.state.choices) {
          if (t.dialogue.state.choiceLock > 0) t.tick();
          else {
            const want = Math.floor(rng() * t.dialogue.state.choices.length);
            const at = t.dialogue.state.selectedChoice;
            t.tick(at === want ? pressing('a') : pressing(at < want ? 'down' : 'up'));
          }
        } else t.tick(pressing('a'));
      } else if (state.step === 'forecast') {
        if (state.pinSteps === moves) t.tick(pressing('a'));
        else t.tick(pressing(state.pinSteps < moves ? 'right' : 'left'));
      } else {
        t.tick();
      }
      if (moves < -15) moves = 0;
    }
    return t;
  };

  it('plays through the buttons from start to finish like a random player would, and scores them low', () => {
    const stats: number[] = [];
    for (let seed = 1; seed <= 300; seed++) {
      const t = randomPlayer(seed);
      expect(t.log.quits, `seed ${seed} left the room`).toBe(0);
      expect(t.log.completed, `seed ${seed} finished`).toHaveLength(1);
      const done = t.log.completed[0] as RoomResult;
      stats.push(calcStat(done.dataQuality, done.variableAccuracy));
    }
    const average = stats.reduce((a, b) => a + b, 0) / stats.length;
    const sorted = [...stats].sort((x, y) => x - y);
    console.log(`random player through the buttons x${stats.length}: mean ${(average * 100).toFixed(1)}%, median ${(sorted[150]! * 100).toFixed(1)}%, p95 ${(sorted[285]! * 100).toFixed(1)}%, max ${(sorted[299]! * 100).toFixed(1)}%`);
    expect(average).toBeLessThan(0.6);
    expect(average).toBeGreaterThan(0.4);
    expect(Math.min(...stats)).toBeGreaterThanOrEqual(0.32 - 1e-9);
    expect(stats.filter(s => s >= 0.92).length / stats.length).toBeLessThan(0.08);
  });
});
