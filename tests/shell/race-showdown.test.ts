// The RACE TO THE LINE in the real BossBattleScene (real dialogue and pause menu): the two-page rules card and the
// practice straight the first time in a session, one line after; a timed kick wins, an early one loses with the
// right advice; no A at all is idle. Then the ending in the real hub: Aisha on the race, Dr Ellis's debrief, and the
// player left in the hub. Plus a random-input soak of the bout.
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { InputState } from '../../src/engine/Input';

const heard: string[] = [];
vi.mock('../../src/audio/Sfx', () => ({ sfx: { play: () => {}, isMuted: () => false, toggleMuted: () => {} } }));
vi.mock('../../src/ui/announce', async () => {
  const { fillName } = await import('../../src/engine/nameToken');
  return { announce: (t: string) => void heard.push(fillName(t)) };
});

const H = await import('./harness');
const { idle, tap } = await import('../datalab-rig');
const GS = await import('../../src/state/GameState');
const R = await import('../../src/systems/RaceModel');
const SS = await import('../../src/systems/SupportScores');
const { createDialogueSystem } = await import('../../src/systems/Dialogue');
const { createPauseMenu } = await import('../../src/systems/PauseMenu');
const { createMovement } = await import('../../src/systems/Movement');
const { createBossBattleScene } = await import('../../src/scenes/BossBattleScene');
const { createLevelClearScene } = await import('../../src/scenes/LevelClearScene');
const { createOverworldScene } = await import('../../src/scenes/OverworldScene');
const { consoleLabel, fillButtonNames } = await import('../../src/engine/Input');
const { setNameSource, fillName } = await import('../../src/engine/nameToken');
const { commitLevel, meetRoomFor } = await import('../../src/rooms/loader');
const { FINALE_RUNNING: F } = await import('../../src/rooms/content/finale-running');
const { finaleTalk, raceAdvice, strongestWeakest } = await import('../../src/systems/Finale');
const { DIRECTOR_SPEAKER, athleteSpeaker } = await import('../../src/data/speakers');
const { wrapText } = await import('../../src/render/DialogueBox');
const { measureText } = await import('../../src/render/PixelFont');

beforeAll(() => {
  H.installFakeDom();
});

/** The recording canvas, with the paths the arena's platforms draw. */
class ArenaCtx extends H.FakeCtx {
  moveTo() {}
  lineTo() {}
  closePath() {}
  fill() {}
}

const STATS = { speed: 0.9, strength: 0.8, endurance: 0.9, power: 0.75 }; // rating 0.8475
const fill = (t: string) => fillButtonNames(t, consoleLabel);

const makeArena = (stats = STATS) => {
  const gameState = GS.createInitialState();
  gameState.playerName = 'ALAN';
  setNameSource(() => gameState.playerName);
  commitLevel(3);
  GS.activateLevel(gameState, 3);
  gameState.meetRoom = meetRoomFor(3);
  gameState.playerStats = { ...stats };
  const emu = H.makeEmulator();
  const input = {
    read: () => emu.read(),
    fill,
    label: consoleLabel,
    blockRepeats: () => emu.blockRepeats(),
    lastDevice: () => 'console',
    setTextMode: () => {},
  };
  const dialogue = createDialogueSystem(() => input.blockRepeats(), consoleLabel);
  const sequences: { texts: string[]; next?: string; speaker?: string }[] = [];
  const realSeq = dialogue.showSequence.bind(dialogue);
  dialogue.showSequence = (texts, onComplete, onCancel, options) => {
    sequences.push({ texts: [...texts], next: options?.nextLabel, speaker: options?.speaker?.name });
    realSeq(texts, onComplete, onCancel, options);
  };
  let current = 'bossBattle';
  const sceneManager = { switchTo: (id: string) => void (current = id), getCurrentId: () => current };
  const pause = createPauseMenu(sceneManager as never, gameState, dialogue);
  const results: GS.BoutResult[] = [];
  const scene = createBossBattleScene(input as never, sceneManager as never, gameState, dialogue, r => {
    results.push(r);
    current = 'levelClear';
  }, pause);
  const ctx = new ArenaCtx(256, 224) as unknown as CanvasRenderingContext2D;
  const step = (n = 1) => {
    for (let i = 0; i < n; i++) {
      scene.update(H.DT);
      scene.render(ctx);
    }
  };
  const phase = () => scene.debugBout().phase;
  /** A every few steps while a dialogue is up and the phase stays `from`. */
  const readWhile = (from: string) => {
    for (let i = 0; i < 3000 && phase() === from && current === 'bossBattle'; i++) {
      if (dialogue.isActive() && i % 6 === 0) emu.tap('a', 1);
      step();
    }
  };
  const enter = () => {
    current = 'bossBattle';
    scene.onEnter?.();
    step();
  };
  return { gameState, emu, dialogue, scene, sequences, results, step, phase, readWhile, enter, current: () => current, pause };
};

/** Where the ideal kick starts for a rating: the furthest out (to 1 m) that reaches the line before the gauge runs dry. */
const idealKick = (rating: number): number => {
  const target = SS.showdownTarget(3);
  const dry = (from: number) => {
    const r = R.createRace(rating, target);
    while (!R.raceOver(r)) R.stepRace(r, 1 / 60, R.RACE_M - r.pos <= from);
    return r.emptyToGo > 0.5;
  };
  let lo = 0;
  let hi = R.RACE_M;
  while (hi - lo > 1) {
    const mid = (lo + hi) / 2;
    if (dry(mid)) hi = mid;
    else lo = mid;
  }
  return lo;
};

type Arena = ReturnType<typeof makeArena>;

/** From the taunt to GO: through the rules card (and the practice, holding A for `practiceHold` steps). */
const toTheGun = (w: Arena, practiceHold = 60) => {
  w.readWhile('intro');
  expect(w.phase()).toBe('rules');
  w.readWhile('rules');
  if (w.phase() === 'practice') {
    w.emu.tap('a', practiceHold);
    for (let i = 0; i < 60 * 10 && w.phase() === 'practice'; i++) w.step();
    w.readWhile('rules');
  }
  for (let i = 0; i < 600 && w.phase() === 'countdown'; i++) w.step();
  expect(w.phase()).toBe('minigame');
};

/** Run the race, kicking (and holding to the line) from `from` metres to go; then read the result line. */
const runRace = (w: Arena, from: number | null) => {
  let kicked = false;
  for (let i = 0; i < 60 * 40 && w.phase() === 'minigame'; i++) {
    const r = w.scene.debugBout().bout?.race;
    if (from !== null && r && R.RACE_M - r.pos <= from) kicked = true;
    if (kicked) w.emu.tap('a', 2); // held to the line (and let go once it is over)
    w.step();
  }
  expect(w.phase()).toBe('result');
  for (let i = 0; i < 60 * 10 && w.results.length === 0; i++) {
    if (w.dialogue.isActive() && i % 6 === 0) w.emu.tap('a', 1);
    w.step();
  }
  expect(w.results).toHaveLength(1);
  return w.results[0]!;
};

describe('RACE TO THE LINE in the arena', () => {
  it('first race of the session: a two-page rules card, the practice straight, then a timed kick wins', () => {
    const w = makeArena();
    w.enter();
    const rating = GS.showdownRating(STATS, SS.showdownFocus(3));
    w.readWhile('intro');
    // the rules card: two pages naming the rating, the focus score and the TARGET; A goes to the practice
    const rules = w.sequences[w.sequences.length - 1]!;
    expect(rules.texts).toHaveLength(2);
    expect(rules.texts[0]).toContain(`${Math.round(rating * 100)}%`);
    expect(rules.texts[0]).toContain('TRAINING PLAN');
    expect(rules.texts[0]).toContain("D'");
    expect(rules.texts[1]).toContain('Hold {A}');
    expect(rules.texts[1]).toContain('TARGET of 53%');
    expect(rules.next).toBe('PRACTICE');
    for (const page of rules.texts) expect(wrapText(fill(page)).length, page).toBeLessThanOrEqual(4); // one box each
    w.readWhile('rules');
    expect(w.phase()).toBe('practice');
    expect(w.scene.debugBout().bout?.practice).toBe(true);
    expect(heard.some(t => t.includes('Practice straight. Hold A to surge'))).toBe(true);
    // hold long enough to empty the toy gauge, then let go: the practice says what the fade is
    w.emu.tap('a', 150);
    for (let i = 0; i < 60 * 10 && w.phase() === 'practice'; i++) w.step();
    expect(w.phase()).toBe('rules');
    const after = w.sequences[w.sequences.length - 1]!;
    expect(after.texts).toEqual([...F.race.practice.faded]);
    expect(after.next).toBe('READY');
    expect(w.results, 'the practice scores nothing').toHaveLength(0);
    w.readWhile('rules');
    for (let i = 0; i < 600 && w.phase() === 'countdown'; i++) w.step();
    expect(w.phase()).toBe('minigame');
    const bout = w.scene.debugBout().bout!;
    expect(bout.practice).toBe(false);
    expect(bout.race!.dMax).toBeCloseTo(rating * R.D_PER_RATING, 6);
    const result = runRace(w, idealKick(rating));
    expect(result.won).toBe(true);
    expect(result.playerScore).toBeGreaterThan(result.rivalScore);
    expect(result.playerScore).toBeLessThanOrEqual(result.rating);
    expect(result.idle).toBe(false);
    expect(result.race?.kick).toBe('good');
    expect(result.race!.time).toBeLessThan(result.race!.rivalTime);
    expect(heard).toContain('Bell: one lap to go.');
  });

  it('a later race in the session: one line of rules, no practice', () => {
    const w = makeArena();
    w.enter();
    toTheGun(w);
    runRace(w, idealKick(0.85));
    w.results.length = 0;
    w.enter();
    w.readWhile('intro');
    const rules = w.sequences[w.sequences.length - 1]!;
    expect(rules.texts).toEqual([F.race.rulesShort.replace('{TARGET}', '53')]);
    expect(rules.next).toBe('READY');
    w.readWhile('rules');
    expect(w.phase()).toBe('countdown');
  });

  it('kicking ten laps out fades and loses, and the results screen says it was too early', () => {
    const w = makeArena();
    w.enter();
    toTheGun(w);
    const result = runRace(w, 4000);
    expect(result.won).toBe(false);
    expect(result.race?.kick).toBe('early');
    expect(result.race!.emptyToGo).toBeGreaterThan(800);
    const advice = raceAdvice(F, result.race!);
    expect(advice).toMatch(/^YOU KICKED TOO EARLY: THE GAUGE RAN DRY WITH (\d\.?\d? )?LAPS? TO GO\.$|^YOU KICKED TOO EARLY: THE GAUGE RAN DRY WITH .* TO GO\.$/);
    // the screen reader hears the same diagnosis on the results screen
    heard.length = 0;
    const clear = createLevelClearScene(
      { read: () => idle(), fill, label: consoleLabel } as never,
      { switchTo: () => {} } as never,
      w.gameState,
      () => ({ ...result, outcome: 'lose', level: 3, stats: { ...STATS } }),
      () => {},
    );
    clear.onEnter?.();
    expect(heard.join(' ')).toContain('Your science was good enough. You kicked too early: the gauge ran dry with');
  });

  it("kicking in the last metres at a rating just above the TARGET is too late: a dead heat, the gauge unused", () => {
    const w = makeArena({ speed: 0.55, strength: 0.55, endurance: 0.55, power: 0.55 });
    w.enter();
    toTheGun(w);
    const result = runRace(w, 2);
    expect(result.won).toBe(false);
    expect(result.race?.kick).toBe('late');
    expect(raceAdvice(F, result.race!)).toMatch(/^YOU KICKED TOO LATE: SHE CROSSED THE LINE WITH \d+% OF HER KICK UNUSED\.$/);
  });

  it("a race with no A at all is idle: she sits on the rival's pace to a dead heat and loses", () => {
    const w = makeArena();
    w.enter();
    toTheGun(w, 0);
    const result = runRace(w, null);
    expect(result.idle).toBe(true);
    expect(result.playerScore).toBeLessThanOrEqual(result.rivalScore + 1e-9);
    expect(result.won).toBe(false);
  });

  it('is titled RACE TO THE LINE, and the HUD text stays on screen', () => {
    const w = makeArena();
    w.enter();
    toTheGun(w);
    // every label the race HUD can show fits the 256 px screen
    for (const text of [F.race.practice.banner, F.race.status.surging, F.race.status.settled, F.race.status.onPace, F.race.status.faded, 'LAP 11.5/12.5', '5000 M TO GO']) {
      expect(measureText(text), text).toBeLessThanOrEqual(248);
    }
    expect(measureText(F.race.prompt, 2)).toBeLessThanOrEqual(200);
    expect(H.problems).toEqual([]);
  });
});

describe('the bout under random input (soak)', () => {
  const seeds = Number(process.env.FUZZ_SEEDS ?? 0) || 16;
  it(`${seeds} seeds: no bad draw, the race always ends, the score stays within 0..rating`, () => {
    let races = 0;
    for (let seed = 1; seed <= seeds; seed++) {
      const rng = H.seeded(seed * 9973);
      vi.spyOn(Math, 'random').mockImplementation(rng);
      const rating = 0.3 + rng() * 0.7;
      const w = makeArena({ speed: rating, strength: rating, endurance: rating, power: rating });
      w.enter();
      for (let steps = 0; steps < 60 * 120 && w.results.length < 2; steps++) {
        if (w.current() !== 'bossBattle') w.enter(); // left for the hub, or a result: back into the arena
        const r = rng();
        if (r < 0.06) w.emu.tap('a', 1 + Math.floor(rng() * (rng() < 0.2 ? 200 : 8)));
        else if (r < 0.065) w.emu.tap('b', 1);
        else if (r < 0.068) w.emu.tap('start', 1);
        else if (r < 0.08) w.emu.tap(rng() < 0.5 ? 'up' : 'down', 1);
        w.step();
      }
      for (const res of w.results) {
        expect(res.playerScore).toBeGreaterThanOrEqual(0);
        expect(res.playerScore).toBeLessThanOrEqual(res.rating + 1e-12);
        expect(res.won).toBe(res.playerScore > res.rivalScore);
      }
      races += w.results.length;
      vi.restoreAllMocks();
    }
    expect(races, 'random play reaches the line').toBeGreaterThan(seeds / 2);
    expect(H.problems).toEqual([]);
  }, 5000 + seeds * 400);
});

// ---- the ending --------------------------------------------------------------------------------------------------

const makeHub = () => {
  const gameState = GS.createInitialState();
  gameState.playerName = 'ALAN';
  setNameSource(() => gameState.playerName);
  commitLevel(3);
  GS.activateLevel(gameState, 3);
  gameState.meetRoom = meetRoomFor(3);
  Object.assign(GS.meetOf(gameState), { welcomed: true, met: true, best: 4, of: 5, needs: true });
  for (const k of GS.ROOM_KEYS) {
    gameState.roomProgress[k] = true;
    GS.meetOf(gameState).heard[k] = true;
  }
  gameState.playerStats = { ...STATS };
  let next: InputState = idle();
  const input = {
    read: () => {
      const out = next;
      next = idle();
      return out;
    },
    fill,
    label: consoleLabel,
    blockRepeats: () => {},
    lastDevice: () => 'console',
    setTextMode: () => {},
  };
  const dialogue = createDialogueSystem();
  const said: { speaker?: string; text: string }[] = [];
  const realSeq = dialogue.showSequence.bind(dialogue);
  dialogue.showSequence = (texts, onComplete, onCancel, options) => {
    for (const text of texts) said.push({ speaker: options?.speaker?.name, text });
    realSeq(texts, onComplete, onCancel, options);
  };
  const switched: string[] = [];
  const sceneManager = { switchTo: (id: string) => void switched.push(id), getCurrentId: () => 'overworld' };
  const pause = createPauseMenu(sceneManager as never, gameState, dialogue);
  const scene = createOverworldScene(input as never, sceneManager as never, gameState, dialogue, createMovement(), () => {}, () => {}, pause);
  const ctx = new H.FakeCtx(256, 224) as unknown as CanvasRenderingContext2D;
  const step = (inp: InputState = idle(), n = 1) => {
    for (let i = 0; i < n; i++) {
      next = i === 0 ? inp : idle();
      scene.update(1 / 60);
      scene.render(ctx);
    }
  };
  const readAll = () => {
    for (let i = 0; i < 6000 && dialogue.isActive(); i++) step(i % 8 === 0 ? tap('a') : idle());
  };
  return { gameState, dialogue, scene, said, switched, step, readAll };
};

const resultOf = (outcome: GS.LevelOutcome, race: GS.RaceSummary, idleBout = false): GS.LevelResult => ({
  won: outcome !== 'lose',
  focus: 'endurance',
  rating: GS.showdownRating(STATS, 'endurance'),
  rivalRating: 0.75,
  playerScore: outcome === 'lose' ? 0.4 : 0.8,
  rivalScore: SS.showdownTarget(3),
  idle: idleBout,
  race,
  outcome,
  level: 3,
  stats: { ...STATS },
});

const WIN_RACE: GS.RaceSummary = { time: 970.4, rivalTime: 983.5, kick: 'good', emptyToGo: 0, unused: 0 };

describe('the ending, back in the hub', () => {
  it('after the case study is won: Aisha on the race, then Dr Ellis debriefs, and the player stays in the hub', () => {
    const w = makeHub();
    w.gameState.bossDefeated[3] = true;
    w.gameState.gameComplete = true;
    w.scene.queueTalk(finaleTalk(F, resultOf('complete', WIN_RACE)));
    w.gameState.returnDoor = 'boss';
    w.scene.onEnter?.();
    expect(w.dialogue.isActive(), 'it starts by itself').toBe(true);
    expect(w.dialogue.state.speaker).toBe(athleteSpeaker(3));
    w.readAll();
    const aisha = w.said.filter(s => s.speaker === athleteSpeaker(3).name).map(s => s.text);
    const ellis = w.said.filter(s => s.speaker === DIRECTOR_SPEAKER.name).map(s => s.text);
    expect(aisha[0]).toContain('16:10.4'); // her time
    expect(aisha[0]).toContain('16:23.5'); // the rival's
    expect(w.said[0]!.speaker, 'Aisha first').toBe(athleteSpeaker(3).name);
    // the debrief: the board's strongest and weakest, whether the change was real, next steps, thanks by name
    expect(ellis.some(t => t.includes('strongest score was TEST CHOICE at 90%') && t.includes('weakest EVALUATION at 75%'))).toBe(true);
    expect(ellis).toEqual(expect.arrayContaining([...F.win.director.real.strong, ...F.win.director.next, ...F.win.director.thanks]));
    expect(ellis.indexOf(F.win.director.thanks[0]!)).toBeGreaterThan(ellis.indexOf(F.win.director.next[0]!));
    expect(w.switched, 'no scene change: the player stays in the hub').toEqual([]);
    // the scores stay on the board, the rooms stay open, and Dr Ellis now says the case is done
    expect(GS.ROOM_KEYS.every(k => GS.roomUnlocked(w.gameState, k))).toBe(true);
    expect(w.gameState.playerStats).toEqual(STATS);
    w.gameState.playerPos = { x: 7, y: 6 };
    w.gameState.playerDir = 'up';
    w.said.length = 0;
    w.step(tap('a'), 3);
    expect(w.said.map(s => s.text)).toEqual([...F.directorAfter]);
    // it does not start again on the next hub entry
    w.readAll();
    w.scene.onExit?.();
    w.scene.onEnter?.();
    expect(w.dialogue.isActive()).toBe(false);
  });

  it('a weak EVALUATION gets the careful version of whether the change was real', () => {
    const r = resultOf('win', WIN_RACE);
    r.stats = { ...STATS, power: 0.4 };
    const ellis = finaleTalk(F, r)[1]!.pages;
    expect(ellis).toContain(F.win.director.real.weak[0]!.replace('{EVAL_PCT}', '40'));
    expect(ellis.some(p => p.includes('weakest EVALUATION at 40%'))).toBe(true);
  });

  it('after a defeat it is shorter, says why, names the board scores, and points back to the rooms', () => {
    const early = finaleTalk(F, resultOf('lose', { time: 1000, rivalTime: 983.5, kick: 'early', emptyToGo: 900, unused: 0 }));
    expect(early[0]!.pages).toEqual([...F.lose.athlete.early]);
    expect(early[1]!.pages[0]).toBe(F.lose.director.kick[0]);
    expect(early[1]!.pages.at(-1)).toBe(F.lose.director.stay[0]);
    const win = finaleTalk(F, resultOf('win', WIN_RACE));
    const pages = (t: typeof win) => t.reduce((n, p) => n + p.pages.length, 0);
    expect(pages(early)).toBeLessThan(pages(win) / 2);
    const late = finaleTalk(F, resultOf('lose', { time: 990, rivalTime: 983.5, kick: 'late', emptyToGo: 0, unused: 0.5 }));
    expect(late[0]!.pages).toEqual([...F.lose.athlete.late]);
    // the rating could not beat the TARGET: say so, and which room raises it
    const low = resultOf('lose', WIN_RACE);
    low.rating = 0.4;
    const t = finaleTalk(F, low);
    expect(t[0]!.pages).toEqual([...F.lose.athlete.rating]);
    expect(t[1]!.pages[0]).toContain('TRAINING PLAN score: replay the TRAINING room');
    const idleT = finaleTalk(F, resultOf('lose', WIN_RACE, true));
    expect(idleT[0]!.pages).toEqual([...F.lose.athlete.idle]);
  });

  it('all four scores level: the board line says so', () => {
    expect(strongestWeakest({ speed: 0.8, strength: 0.8, endurance: 0.8, power: 0.8 })).toBeNull();
    const r = resultOf('win', WIN_RACE);
    r.stats = { speed: 0.8, strength: 0.8, endurance: 0.8, power: 0.8 };
    expect(finaleTalk(F, r)[1]!.pages).toContain(F.win.director.boardEven.replace('{STRONG_PCT}', '80'));
  });

  it('the results screen calls it the end of the case study and sends the player to the debrief', () => {
    heard.length = 0;
    const gameState = GS.createInitialState();
    gameState.meetRoom = true;
    const clear = createLevelClearScene(
      { read: () => idle(), fill, label: consoleLabel } as never,
      { switchTo: () => {} } as never,
      gameState,
      () => resultOf('complete', WIN_RACE),
      () => {},
    );
    clear.onEnter?.();
    expect(heard.join(' ')).toContain(F.clear.spoken);
    expect(heard.join(' ')).toContain('Press A for the debrief.');
    expect(heard.join(' ')).not.toContain('Game complete');
  });

  it('every ending line fits its boxes', () => {
    const r = resultOf('win', WIN_RACE);
    const all = [
      ...finaleTalk(F, r).flatMap(p => p.pages),
      ...Object.values(F.lose.athlete).flat(),
      ...F.lose.director.rating,
      ...F.lose.director.kick,
      ...F.lose.director.stay,
      ...F.directorAfter,
      ...F.win.director.real.weak,
      ...Object.values(F.race.practice).flat(),
    ].filter(t => typeof t === 'string');
    for (const text of all) expect(wrapText(fillName(fill(text))).length, text).toBeLessThanOrEqual(4);
    for (const line of F.clear.lines) expect(measureText(line), line).toBeLessThanOrEqual(240);
  });
});
