// The Performance Director's needs chat and check-ins in the Distance Running hub (a visit with the ATHLETE room):
// they gate the rooms in order, start by themselves on the way back to the hub, count only once read to the end,
// say what the room produced, and survive a save (old saves count earlier check-ins as heard).
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { Button, InputState } from '../../src/engine/Input';

const heard: string[] = [];
vi.mock('../../src/audio/Sfx', () => ({ sfx: { play: () => {}, isMuted: () => false, toggleMuted: () => {} } }));
vi.mock('../../src/ui/announce', async () => {
  const { fillName } = await import('../../src/engine/nameToken');
  return { announce: (t: string) => void heard.push(fillName(t)) };
});

const H = await import('./harness'); // loads the room chunk
const { idle, tap } = await import('../datalab-rig');
const GS = await import('../../src/state/GameState');
const { createDialogueSystem } = await import('../../src/systems/Dialogue');
const { createMovement } = await import('../../src/systems/Movement');
const { createPauseMenu } = await import('../../src/systems/PauseMenu');
const { createOverworldScene } = await import('../../src/scenes/OverworldScene');
const { consoleLabel, fillButtonNames } = await import('../../src/engine/Input');
const { setNameSource, fillName } = await import('../../src/engine/nameToken');
const { commitLevel, meetRoomFor } = await import('../../src/rooms/loader');
const { MEET_RUNNING } = await import('../../src/rooms/content/meet-running');
const { LEVEL_DATA } = await import('../../src/data/sports');
const { DIRECTOR_SPEAKER } = await import('../../src/data/speakers');
const { HUB_RETURN } = await import('../../src/data/maps');
const { loadSave, saveGame, applySave } = await import('../../src/systems/SaveSystem');
const { objectivesHint, objectivesSummary } = await import('../../src/render/OverworldHud');
const { measureText } = await import('../../src/render/PixelFont');
const { OPTION_LIST_CHARS, wrapText } = await import('../../src/render/DialogueBox');
const CI = await import('../../src/systems/CheckIns');

beforeAll(() => {
  H.installFakeDom();
});

const C = MEET_RUNNING.checkIns;
const N = MEET_RUNNING.needs;

const makeInput = () => {
  let next: InputState = idle();
  return {
    feed(inp: InputState) {
      next = inp;
    },
    read: () => {
      const out = next;
      next = idle();
      return out;
    },
    fill: (t: string) => fillButtonNames(t, consoleLabel),
    label: consoleLabel,
    blockRepeats: () => {},
    lastDevice: () => 'keyboard',
    setTextMode: () => {},
  };
};

const page = (d: ReturnType<typeof createDialogueSystem>) => (d.isActive() ? (d.state.pages[d.state.page] ?? []).join(' ') : '');
/** A content line as the box shows it: name filled, and only its first words (it may wrap onto a second page). */
const start = (line: string) => fillName(line).split(' ').slice(0, 5).join(' ');

/** A Distance Running hub with the welcome heard and Aisha met (so the needs chat is next). */
const makeHub = (setup?: (s: ReturnType<typeof GS.createInitialState>) => void) => {
  const gameState = GS.createInitialState();
  gameState.playerName = 'ALAN';
  setNameSource(() => gameState.playerName);
  commitLevel(3);
  GS.activateLevel(gameState, 3);
  gameState.meetRoom = meetRoomFor(3);
  Object.assign(GS.meetOf(gameState), { welcomed: true, met: true, best: 4, of: 5 });
  setup?.(gameState);
  const input = makeInput();
  const dialogue = createDialogueSystem();
  // every prompt with a list, and the speaker of every line
  const asked: { text: string; choices: string[] }[] = [];
  const speakers: (string | undefined)[] = [];
  const realShow = dialogue.show.bind(dialogue);
  dialogue.show = (text, choices, onComplete, onCancel, options) => {
    if (choices) asked.push({ text, choices: [...choices] });
    speakers.push(options?.speaker?.name);
    realShow(text, choices, onComplete, onCancel, options);
  };
  const sceneManager = { switchTo: () => {}, getCurrentId: () => 'overworld' };
  const pause = createPauseMenu(sceneManager as never, gameState, dialogue);
  const scene = createOverworldScene(input as never, sceneManager as never, gameState, dialogue, createMovement(), () => {}, () => {}, pause);
  const ctx = new H.FakeCtx(256, 224) as unknown as CanvasRenderingContext2D;
  const pages: string[] = [];
  const step = (inp: InputState = idle(), n = 1) => {
    for (let i = 0; i < n; i++) {
      input.feed(i === 0 ? inp : idle());
      scene.update(1 / 60);
      scene.render(ctx);
      const text = page(dialogue);
      if (text && pages[pages.length - 1] !== text) pages.push(text);
    }
  };
  /** A until the dialogue closes (a list takes its first option once its lock is over). */
  const readAll = () => {
    for (let i = 0; i < 4000 && dialogue.isActive(); i++) step(i % 8 === 0 ? tap('a') : idle());
  };
  /** Back in the hub from a room (as RoomChallengeScene's finish does). */
  const back = (door: GS.HubExit) => {
    scene.onExit?.();
    gameState.returnDoor = door;
    scene.onEnter?.();
    step(idle(), 2);
  };
  /** Walk onto a door from the tile in front of it, and return what the box says. */
  const walk = (from: { x: number; y: number }, dir: Button) => {
    gameState.playerPos = { x: from.x, y: from.y };
    gameState.playerDir = dir as never;
    step({ ...idle(), [dir]: true, [`${dir}Pressed`]: true, [`${dir}Repeat`]: true } as InputState, 1);
    for (let i = 0; i < 40 && !dialogue.isActive(); i++) step({ ...idle(), [dir]: true } as InputState);
    const said = page(dialogue);
    readAll();
    step(idle(), 20);
    return said;
  };
  /** Stand below the Director (7,5) facing up and press A. */
  const talk = () => {
    gameState.playerPos = { x: 7, y: 6 };
    gameState.playerDir = 'up';
    step(tap('a'), 3);
  };
  return { gameState, dialogue, scene, step, readAll, back, walk, talk, asked, speakers, pages };
};

describe('the needs chat', () => {
  it('starts by itself after the ATHLETE room, asks every question in order with shuffled answers, replies to the pick, and opens TESTING', () => {
    const w = makeHub();
    expect(GS.checkInDue(w.gameState)).toBe('needs');
    expect(GS.roomUnlocked(w.gameState, 'testSelection')).toBe(false);
    expect(GS.nextStop(w.gameState)).toBe('director');
    w.back('meet');
    expect(w.dialogue.isActive(), 'it starts by itself').toBe(true);
    expect(w.dialogue.state.speaker).toBe(DIRECTOR_SPEAKER);
    expect(page(w.dialogue)).toContain(start(N.intro[0]!));
    w.readAll();
    // each question once, in order, with all its answers
    expect(w.asked.map(a => a.text)).toEqual(N.questions.map(q => q.ask[q.ask.length - 1]!));
    N.questions.forEach((q, i) => {
      expect([...w.asked[i]!.choices].sort()).toEqual(q.options.map(o => o.text).sort());
      // A took the first option shown: Ellis replies to that one
      const picked = q.options.find(o => o.text === w.asked[i]!.choices[0])!;
      expect(w.pages.some(p => p.startsWith(start(picked.reply[0]!))), `${q.id}: the reply to "${picked.text}"`).toBe(true);
    });
    expect(w.pages.some(p => p.startsWith(start(N.agreed[0]!)))).toBe(true);
    expect(w.speakers.every(s => s === DIRECTOR_SPEAKER.name), 'every line on the Director tab').toBe(true);
    expect(GS.meetOf(w.gameState).needs).toBe(true);
    expect(loadSave()?.meet[3]?.needs, 'saved').toBe(true);
    expect(GS.roomUnlocked(w.gameState, 'testSelection')).toBe(true);
    expect(GS.nextStop(w.gameState)).toBe('room1');
    // talking again before TESTING: the reminder
    w.talk();
    expect(page(w.dialogue)).toContain(start(N.reminder[0]!));
  });

  it('shuffles the answers per visit', () => {
    const orders = new Set<string>();
    for (let i = 0; i < 12; i++) {
      const w = makeHub();
      w.back('meet');
      w.readAll();
      orders.add(JSON.stringify(w.asked.map(a => a.choices)));
    }
    expect(orders.size).toBeGreaterThan(1);
  });

  it('TESTING refuses with the door line until it is done; B leaves it unheard, it does not restart by itself, and talking gives it again in full', () => {
    const w = makeHub();
    w.back('meet');
    w.step(idle(), 20);
    w.step(tap('b'), 4);
    expect(w.dialogue.isActive()).toBe(false);
    expect(GS.meetOf(w.gameState).needs).toBe(false);
    // the door, the arrow, the objectives and the screen reader all say to talk to Dr Ellis
    expect(w.walk(HUB_RETURN.room1, 'up')).toContain(C.doorRefusal);
    expect(objectivesHint(w.gameState)).toBe('NEXT: TALK TO DR ELLIS');
    expect(objectivesSummary(w.gameState)).toMatch(/TESTING gives the test choice score, locked\..*NEXT: TALK TO DR ELLIS\./);
    // back again this session: it waits to be asked
    w.back('meet');
    expect(w.dialogue.isActive()).toBe(false);
    expect(heard[heard.length - 1]).toMatch(/Next: talk to Dr Ellis\.$/);
    // part-way through, B again: still not done
    w.talk();
    expect(page(w.dialogue)).toContain(start(N.intro[0]!));
    for (let i = 0; i < 400 && w.asked.length < 2; i++) w.step(i % 8 === 0 ? tap('a') : idle());
    w.step(tap('b'), 4);
    expect(w.dialogue.isActive()).toBe(false);
    expect(GS.meetOf(w.gameState).needs).toBe(false);
    // and from the start once more, to the end
    w.talk();
    expect(page(w.dialogue)).toContain(start(N.intro[0]!));
    w.readAll();
    expect(GS.meetOf(w.gameState).needs).toBe(true);
  });
});

/** A hub where the rooms up to and including `upTo` are done and every earlier talk was heard. */
const doneUpTo = (upTo: GS.RoomKey, stats: Partial<Record<GS.StatKey, number>> = {}) =>
  makeHub(s => {
    const meet = GS.meetOf(s);
    meet.needs = true;
    for (const k of GS.ROOM_KEYS) {
      s.roomProgress[k] = true;
      if (k === upTo) break;
      meet.heard[k] = true;
    }
    Object.assign(s.playerStats, stats);
    meet.tests = ['Critical Speed Test', 'Wingate Test'];
    meet.call = 'ranAnyway';
  });

describe('the check-ins', () => {
  it('after TESTING: the test that was run, the test-day call, then what next; it gates DATA until read to the end', () => {
    const w = doneUpTo('testSelection', { speed: 0.9 });
    expect(GS.checkInDue(w.gameState)).toBe('testSelection');
    expect(GS.roomUnlocked(w.gameState, 'variableId')).toBe(false);
    expect(GS.waitingOnDirector(w.gameState, 'variableId')).toBe(true);
    w.back('room1');
    expect(w.dialogue.isActive()).toBe(true);
    expect(w.dialogue.state.speaker).toBe(DIRECTOR_SPEAKER);
    // B leaves it: not heard, DATA still shut
    w.step(tap('b'), 4);
    expect(GS.meetOf(w.gameState).heard.testSelection).toBe(false);
    expect(w.walk(HUB_RETURN.room2, 'up')).toContain(C.doorRefusal);
    // talking replays it from the start; read to the end, DATA opens
    w.talk();
    w.readAll();
    for (const line of [
      ...C.testing['Critical Speed Test']!,
      ...C.testing['Wingate Test']!,
      ...C.battery.missing['Lactate Profile']!,
      ...C.testingCall.ranAnyway,
      ...C.testingNext,
    ]) {
      expect(w.pages.some(p => p.startsWith(start(line))), line).toBe(true);
    }
    expect(w.pages.join(' ')).not.toMatch(/\{ROOM\}|\{NAME\}/);
    expect(GS.meetOf(w.gameState).heard.testSelection).toBe(true);
    expect(loadSave()?.meet[3]?.heard.testSelection, 'saved').toBe(true);
    expect(GS.roomUnlocked(w.gameState, 'variableId')).toBe(true);
    expect(GS.nextStop(w.gameState)).toBe('room2');
    // back from a replay of TESTING: nothing new is due
    w.back('room1');
    expect(w.dialogue.isActive()).toBe(false);
  });

  it('talking with nothing due gives the latest room\'s findings again, then the after lines pointing at the next room', () => {
    const w = doneUpTo('variableId', { strength: 0.55 });
    GS.meetOf(w.gameState).heard.variableId = true;
    w.back('room2');
    expect(w.dialogue.isActive()).toBe(false);
    w.talk();
    w.readAll();
    expect(w.pages.some(p => p.startsWith(start(C.data.mixed[0]!)))).toBe(true);
    expect(w.pages.join(' ')).toContain('TRAINING is next');
  });

  it('each later room\'s check-in is picked by the band of the stat it awards, and fills {ROOM}', () => {
    const cases: [GS.RoomKey, GS.StatKey, 'data' | 'training' | 'analysis', string[], string][] = [
      ['variableId', 'strength', 'data', C.dataNext as string[], 'TRAINING'],
      ['trainingPrescription', 'endurance', 'training', C.trainingNext as string[], 'ANALYSIS'],
      ['performancePrediction', 'power', 'analysis', C.analysisNext as string[], 'ARENA'],
    ];
    for (const [key, stat, bands, next, label] of cases) {
      for (const [value, band] of [[0.8, 'strong'], [0.795, 'strong'], [0.79, 'mixed'], [0.5, 'mixed'], [0.49, 'weak'], [0, 'weak']] as const) {
        const w = doneUpTo(key, { [stat]: value });
        expect(GS.labelAfter(key)).toBe(label);
        const files = key === 'variableId' ? C.dataFiles['Critical Speed Test']! : []; // the battery had the trials file only
        expect(CI.checkInLines(MEET_RUNNING, w.gameState, key), `${key} ${value}`).toEqual([...C[bands][band], ...files, ...next].map(l => l.replace(/\{ROOM\}/g, label)));
      }
    }
  });

  it('every test in Distance Running has its own check-in, and every check-in line fits its box', () => {
    for (const test of LEVEL_DATA[3]!.tests) expect(C.testing[test.name], test.name).toBeDefined();
    // answers: at most 30 characters, never cut short in the choice panel (two lines at most)
    for (const q of N.questions)
      for (const o of q.options) {
        expect(o.text.length, o.text).toBeLessThanOrEqual(30);
        expect(wrapText(o.text, OPTION_LIST_CHARS).length, o.text).toBeLessThanOrEqual(2);
      }
    expect(measureText(C.doorRefusal)).toBeLessThan(220);
    expect(measureText('NEXT: TALK TO DR ELLIS')).toBeLessThan(216);
  });

  it('after ANALYSIS the arena stays shut (door line) until its check-in is heard, then opens', () => {
    const w = doneUpTo('performancePrediction', { power: 0.9 });
    expect(GS.allRoomsComplete(w.gameState)).toBe(true);
    expect(GS.arenaOpen(w.gameState)).toBe(false);
    w.back('room4');
    w.step(tap('b'), 4);
    expect(w.walk(HUB_RETURN.boss, 'down')).toContain(C.doorRefusal);
    w.talk();
    w.readAll();
    expect(w.pages.some(p => p.startsWith(start(C.analysis.strong[0]!)))).toBe(true);
    expect(GS.arenaOpen(w.gameState)).toBe(true);
    expect(GS.nextStop(w.gameState)).toBe('boss');
    expect(heard.some(t => t.includes('THE ARENA IS OPEN!'))).toBe(true);
  });

  it('a TESTING check-in without a recorded run (an older save) still gives what to do next', () => {
    const w = doneUpTo('testSelection');
    Object.assign(GS.meetOf(w.gameState), { tests: [], call: '' });
    expect(CI.checkInLines(MEET_RUNNING, w.gameState, 'testSelection')).toEqual([...C.testingNext]);
  });

  it('winning the level clears the check-ins (the rooms start again), but not the meeting or the needs chat', () => {
    const w = doneUpTo('performancePrediction');
    for (const k of GS.ROOM_KEYS) GS.meetOf(w.gameState).heard[k] = true;
    GS.clearActiveLevel(w.gameState);
    expect(GS.meetOf(w.gameState)).toMatchObject({ met: true, needs: true, heard: GS.freshRoomProgress(), tests: [], call: '' });
    expect(GS.roomUnlocked(w.gameState, 'testSelection')).toBe(true);
  });
});

describe('Dr Ellis sends you back after a battery with no Data Lab file', () => {
  /** TESTING done with `tests`, its check-in heard or not. */
  const afterBattery = (tests: string[], heardIt: boolean) => {
    const w = doneUpTo('testSelection', { speed: 0.4 });
    const meet = GS.meetOf(w.gameState);
    meet.tests = tests;
    meet.call = 'right';
    meet.heard.testSelection = heardIt;
    return w;
  };

  it('explains why neither test gives zones or D prime, and says to re-test instead of going to DATA', () => {
    const w = afterBattery(['Wingate Test', 'Beep Test'], false);
    expect(GS.retestDue(w.gameState)).toBe(true);
    expect(CI.checkInLines(MEET_RUNNING, w.gameState, 'testSelection')).toEqual([
      ...C.testing['Wingate Test']!,
      ...C.testing['Beep Test']!,
      ...C.battery.none,
      ...C.testingCall.right,
      ...C.retestNext,
    ]);
    expect(objectivesHint(w.gameState)).toBe('NEXT: TALK TO DR ELLIS');
    expect(w.walk(HUB_RETURN.room2, 'up')).toContain(C.doorRefusal); // the check-in first
  });

  it('keeps DATA shut after the check-in, points the arrow and the objectives back at TESTING, and refuses the door', () => {
    const w = afterBattery(['Beep Test', 'Wingate Test'], true);
    expect(GS.checkInDue(w.gameState)).toBeNull();
    expect(GS.roomUnlocked(w.gameState, 'variableId')).toBe(false);
    expect(GS.waitingOnDirector(w.gameState, 'variableId')).toBe(false);
    expect(GS.nextRoom(w.gameState)).toBe('testSelection');
    expect(GS.nextStop(w.gameState)).toBe('room1');
    expect(objectivesHint(w.gameState)).toBe('NEXT: RE-TEST IN TESTING');
    expect(w.walk(HUB_RETURN.room2, 'up')).toContain(C.retestRefusal);
    expect(GS.roomUnlocked(w.gameState, 'testSelection')).toBe(true); // replays allowed
  });

  it('keeps DATA shut even when it was finished before, and keeps the arena shut too', () => {
    const w = doneUpTo('performancePrediction');
    const meet = GS.meetOf(w.gameState);
    for (const k of GS.ROOM_KEYS) meet.heard[k] = true;
    expect(GS.arenaOpen(w.gameState)).toBe(true);
    meet.tests = ['Wingate Test', 'Beep Test'];
    expect(GS.roomUnlocked(w.gameState, 'variableId')).toBe(false);
    expect(GS.arenaOpen(w.gameState)).toBe(false);
  });

  it('after a partial battery says what is missing, and DATA opens', () => {
    for (const [tests, missing] of [[['Lactate Profile', 'Beep Test'], 'Critical Speed Test'], [['Wingate Test', 'Critical Speed Test'], 'Lactate Profile']] as const) {
      const w = afterBattery([...tests], false);
      expect(GS.retestDue(w.gameState)).toBe(false);
      const lines = CI.checkInLines(MEET_RUNNING, w.gameState, 'testSelection');
      expect(lines).toEqual(expect.arrayContaining([...C.battery.missing[missing]!, ...C.testingNext]));
      expect(lines).not.toEqual(expect.arrayContaining([...C.battery.none]));
      GS.meetOf(w.gameState).heard.testSelection = true;
      expect(GS.roomUnlocked(w.gameState, 'variableId')).toBe(true);
    }
  });

  it('after the full battery says it answers the question', () => {
    const w = afterBattery(['Critical Speed Test', 'Lactate Profile'], false);
    expect(CI.checkInLines(MEET_RUNNING, w.gameState, 'testSelection')).toEqual(expect.arrayContaining([...C.battery.full]));
  });

  it('a re-test brings the TESTING check-in back, so Ellis talks the new battery over', async () => {
    const w = await H.makeWorld(3);
    w.gameState.meetRoom = true;
    const meet = GS.meetOf(w.gameState);
    Object.assign(meet, { welcomed: true, met: true, needs: true, tests: ['Wingate Test', 'Beep Test'], call: 'right' });
    w.gameState.roomProgress.testSelection = true;
    meet.heard.testSelection = true;
    w.enter('room1'); // a replay of TESTING
    for (let i = 0; i < 60 * 120 && w.log.completes === 0; i++) {
      if (i % 30 === 0) w.emu.tap('a', 1);
      w.step(1);
    }
    expect(w.log.completes).toBe(1);
    expect(meet.tests).toHaveLength(2);
    expect(meet.heard.testSelection, 'the check-in is due again').toBe(false);
    expect(GS.checkInDue(w.gameState)).toBe('testSelection');
  });
});

describe('the rooms record what the check-ins need', () => {
  it('the Testing Lab keeps the battery and the call; the completion line points at Dr Ellis', async () => {
    const w = await H.makeWorld(3);
    w.gameState.meetRoom = true;
    Object.assign(GS.meetOf(w.gameState), { welcomed: true, met: true, needs: true });
    const said: string[] = [];
    w.enter('room1');
    for (let i = 0; i < 60 * 120 && w.log.completes === 0; i++) {
      const text = page(w.dialogue);
      if (text && said[said.length - 1] !== text) said.push(text);
      if (i % 30 === 0) w.emu.tap('a', 1);
      w.step(1);
    }
    expect(w.log.completes).toBe(1);
    const meet = GS.meetOf(w.gameState);
    expect(meet.tests).toHaveLength(2);
    for (const t of meet.tests) expect(LEVEL_DATA[3]!.tests.map(x => x.name)).toContain(t);
    expect(['right', 'ranAnyway', 'needlessRebook']).toContain(meet.call);
    expect(meet.heard.testSelection, 'heard only in the hub').toBe(false);
    expect(said.join(' ')).not.toMatch(/Good choice!|Not ideal\./);
    expect(said.join(' ')).toContain('Next: talk to Dr Ellis in the hub.');
    expect(said[0]).toContain(LEVEL_DATA[3]!.athleteProfile.split(' ').slice(0, 3).join(' '));
    expect(said.join(' ')).toContain(start(N.testingBrief));
  });

  it('a classic visit has no Director: a finished room needs no check-in later', async () => {
    const w = await H.makeWorld(3);
    expect(w.gameState.meetRoom).toBe(false);
    w.enter('room1');
    for (let i = 0; i < 60 * 120 && w.log.completes === 0; i++) {
      if (i % 30 === 0) w.emu.tap('a', 1);
      w.step(1);
    }
    expect(GS.meetOf(w.gameState).heard.testSelection).toBe(true);
  });
});

describe('the save', () => {
  it('round-trips the needs chat, the check-ins and the last battery', () => {
    const s = GS.createInitialState();
    s.playerName = 'ALAN';
    GS.activateLevel(s, 3);
    s.roomProgress.testSelection = true;
    Object.assign(GS.meetOf(s), { welcomed: true, met: true, best: 3, of: 5, needs: true, tests: ['Lactate Profile', 'Beep Test'], call: 'needlessRebook' });
    GS.meetOf(s).heard.testSelection = true;
    expect(saveGame(s)).toBe(true);
    const save = loadSave()!;
    expect(save.version).toBe(4);
    const back = GS.createInitialState();
    applySave(back, save);
    expect(back.meet[3]).toEqual(GS.meetOf(s));
    expect(back.meet[3]!.heard).not.toBe(GS.meetOf(s).heard);
    expect(back.meet[3]!.tests).not.toBe(GS.meetOf(s).tests);
  });

  it('reads an early v4 save with one test (and its old name) as a battery of one', () => {
    for (const [old, now] of [['Critical Speed Test', ['Critical Speed Test']], ['Lactate Threshold Test', ['Lactate Profile']], ['', []]] as const) {
      localStorage.setItem(
        'physquest_save',
        JSON.stringify({
          version: 4,
          playerName: 'ALAN',
          bossDefeated: [false, false, false, false],
          gameComplete: false,
          currentLevel: 3,
          levelProgress: [null, null, null, null],
          meet: [null, null, null, { welcomed: true, met: true, best: 1, of: 5, needs: true, heard: { testSelection: true }, test: old, call: 'right' }],
        }),
      );
      expect(loadSave()!.meet[3]!.tests, old).toEqual(now);
    }
  });

  it('a v3 save part-way through counts the needs chat and every finished room\'s check-in as heard', () => {
    const rooms = { testSelection: true, variableId: true, trainingPrescription: false, performancePrediction: false };
    localStorage.setItem(
      'physquest_save',
      JSON.stringify({
        version: 3,
        playerName: 'ALAN',
        bossDefeated: [false, true, false, false],
        gameComplete: false,
        currentLevel: 3,
        levelProgress: [null, null, null, { roomProgress: rooms, playerStats: { speed: 0.8, strength: 0.6, endurance: 0, power: 0 } }],
        meet: [
          { welcomed: true, met: true, best: 2, of: 5 }, // met, no room yet: the needs chat is still to come
          { welcomed: true, met: true, best: 0, of: 0 }, // won
          { welcomed: false, met: false, best: 0, of: 0 },
          { welcomed: true, met: true, best: 4, of: 5 },
        ],
      }),
    );
    const save = loadSave()!;
    expect(save.version).toBe(4);
    expect(save.meet[3]).toEqual({ ...GS.freshMeet(), welcomed: true, met: true, best: 4, of: 5, needs: true, heard: rooms });
    expect(save.meet[0]).toMatchObject({ met: true, needs: false });
    expect(save.meet[1]).toMatchObject({ met: true, needs: true });
    expect(save.meet[2]).toEqual(GS.freshMeet());
    const s = GS.createInitialState();
    applySave(s, save);
    GS.activateLevel(s, 3);
    s.meetRoom = true;
    expect(GS.checkInDue(s), 'nobody is locked out').toBeNull();
    expect(GS.roomUnlocked(s, 'trainingPrescription')).toBe(true);
  });

  it('malformed check-in fields read as not heard', () => {
    localStorage.setItem(
      'physquest_save',
      JSON.stringify({
        version: 4,
        playerName: 'ALAN',
        bossDefeated: [false, false, false, false],
        gameComplete: false,
        currentLevel: 3,
        levelProgress: [null, null, null, null],
        meet: [null, null, null, { welcomed: true, met: true, best: 1, of: 5, needs: 'yes', heard: { testSelection: 1 }, test: 42, call: 'maybe' }],
      }),
    );
    expect(loadSave()!.meet[3]).toEqual({ ...GS.freshMeet(), welcomed: true, met: true, best: 1, of: 5 });
  });
});
