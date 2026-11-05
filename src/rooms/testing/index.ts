// Testing Lab instrument: "show the test, then run it". The athlete's brief, then a list of four tests where the
// highlighted one plays live on a stage (what it is made of, what it gives, its effort profile); the player builds a
// battery from it (A adds the highlighted test, B takes the last one out), then test day (is she ready: run the
// battery or re-book it), each test's run and the lab printout; the Performance Director's check-in in
// the hub then says what the test found (a level without meet content has none). The rules live in
// model.ts, the pictures in stage.ts and scenes.ts; this file connects them to the host's dialogue and input.
import { athleteSpeaker } from '../../data/speakers';
import type { InputState } from '../../engine/Input';
import { drawOptionList, drawPromptBox, optionListHeight, wrapText } from '../../render/DialogueBox';
import { measureText } from '../../render/PixelFont';
import { prefersReducedMotion } from '../../render/motion';
import { sfx } from '../../audio/Sfx';
import { announce } from '../../ui/announce';
import { contentFor, meetContentFor } from '../content';
import type { InstrumentFactory, RoomHost, RoomInstrument } from '../types';
import {
  PRINTOUT_SECONDS,
  REBOOK_SECONDS,
  RUN_SECONDS,
  TOUR_SECONDS,
  athleteName,
  createTestingModel,
  spoken,
  type CheckCall,
  type Phase,
  type Rng,
} from './model';
import {
  drawCheckStage,
  drawPickStage,
  drawPrintoutStage,
  drawRunStage,
  pickWindow,
  runWindow,
  trialsOf,
  type CheckView,
  type PickView,
  type PrintoutView,
  type RunView,
  type Rect,
} from './stage';
import { beatCount, clamp01, readoutAt } from './timeline';

/** The gap between the list's bars: a little tighter than the dialogue's, to leave the stage room. */
const LIST_GAP = 2;
/** The list ends just above the dialogue box. */
const LIST_BOTTOM = 162;
/** The list's question, before and between picks (UI wording; the battery's size comes from the content). */
const questionFor = (size: number, picked: readonly string[]): string =>
  picked.length === 0 ? `Choose ${size} tests for her battery.` : `Test ${picked.length}: ${picked[picked.length - 1]}. Now choose test ${picked.length + 1}.`;
const PRINTOUT_PROMPT: readonly string[] = ['The lab printout is ready.'];
/** Said once per session, after the brief: the stage is the point of this room. */
const TIP = 'Tip: press {UP} and {DOWN} to watch each test on the stage, then {A} to add it to her battery. {B} takes the last one out.';
/** Said when A is pressed on a test already in the battery. */
const TAKEN = 'That test is already in her battery.';
/** Ink for the description under the question: the lab's dark blue, which reads well on the paper. */
const BLUE = '#1b3a5c';
/** The widest line the stage window's band can hold: the window less its frame. */
const BAND_TEXT_MAX = 240;
/** How long the cursor rests before the screen reader says what is under it. */
const ANNOUNCE_DELAY = 0.3;
/** How long the stage window takes to grow from the pick screen's size to the whole stage when the run starts. */
const GROW_SECONDS = 0.3;
/** Used when the content has no data file to say how many stages the treadmill test has. */
const DEFAULT_STAGES = 6;
/** The widest battery plate on the check stage (its window less the calendar and Aisha). */
const PLATE_MAX = 138;
/** How long the "already in her battery" line stays. */
const NOTICE_SECONDS = 2;

// The check and the list order shown last time this session, so a replay gets a different check and a reshuffled list
let lastCheckShown: string | undefined;
let lastOrderShown: readonly string[] | undefined;

/** The first word of the athlete's profile without its comma, as written ("Aisha"). */
const firstName = (profile: string): string => (profile.split(' ')[0] ?? '').replace(/,$/, '');

export const createTestingRoomWith = (host: RoomHost, rng: Rng): RoomInstrument => {
  const rooms = contentFor(host.level);
  if (!rooms) {
    // The shell only opens this room for a level with content, but never leave the player stuck
    host.say('This room is not ready yet.', undefined, () => host.quit());
    return { update() {}, render() {} };
  }

  const { sport } = host;
  const content = rooms.testing;
  // What testing is for, as agreed with the Director in the needs chat (the classic profile and goal without one)
  const agreed = meetContentFor(host.level)?.needs;
  const needs = agreed?.testingNeeds ?? content.needs;
  const model = createTestingModel({ sport, content, rng, lastCheck: lastCheckShown, lastOrder: lastOrderShown });
  const state = model.state;
  const name = athleteName(sport);
  const stages = rooms.data.lactate.stages.length > 0 ? rooms.data.lactate.stages.length : DEFAULT_STAGES;
  const calm = prefersReducedMotion();
  const orderNames = state.order.map(t => t.name);
  // What the list shows: a test in the battery is greyed and ticked
  const listNames = [...orderNames];
  const listDimmed = orderNames.map(() => false);
  const refreshList = () => {
    for (let i = 0; i < orderNames.length; i++) {
      const inBattery = state.battery.some(t => t.name === orderNames[i]);
      listNames[i] = inBattery ? `${orderNames[i]} ✓` : (orderNames[i] as string);
      listDimmed[i] = inBattery;
    }
  };
  const listTop = LIST_BOTTOM - optionListHeight(orderNames.map(n => `${n} ✓`), LIST_GAP);
  const stageWindow = pickWindow(listTop);
  // Cards by test name, looked up once
  const cards = new Map(state.order.map(t => [t.name, model.cardOf(t)] as const));
  const cardFor = (testName: string) => cards.get(testName) ?? model.cardOf(model.highlighted());

  // Views are filled in each frame and drawn; nothing is allocated per frame
  // "AISHA NEEDS: ..." on one line in the band; a long name and a long need drop the name rather than run off the edge
  const lead = measureText(`${name} NEEDS: ${needs}`) - 1 <= BAND_TEXT_MAX ? `${name} NEEDS: ` : 'NEEDS: ';
  const pickView: PickView = { window: stageWindow, lead, needs, card: cardFor(model.highlighted().name), clock: 0, calm, stages };
  const checkView: CheckView = {
    window: stageWindow,
    lead,
    needs,
    card: pickView.card,
    plate: '',
    clock: 0,
    calm,
    stages,
    day: state.day,
    shaky: false,
    rebooked: false,
    flip: 0,
    answered: false,
  };
  const growing: Rect = { ...runWindow }; // the run's window, which grows to full size as the run starts
  const runView: RunView = { window: growing, card: pickView.card, title: '', clock: 0, u: 0, shaky: false, calm, stages };
  const printoutView: PrintoutView = { window: runWindow, calm, lines: model.printout(), slide: 0 };

  // Button names follow the player's device, so the hints are filled in again whenever the device changes
  const hints = { pick: '', undo: '', run: '', printout: '', device: '' };
  const refreshHints = () => {
    const device = host.input.lastDevice();
    if (device === hints.device) return;
    hints.device = device;
    hints.pick = host.input.fill('{A}: ADD   {B}: QUIT');
    hints.undo = host.input.fill('{A}: ADD   {B}: UNDO');
    hints.run = host.input.fill('{A}: SKIP   {B}: QUIT');
    hints.printout = host.input.fill('{A}: CONTINUE   {B}: QUIT');
  };

  // What the prompt box says under the list: the question, then the highlighted test's own words
  let question = questionFor(model.size, []);
  let promptLines: string[] = [question];
  let promptColors: (string | undefined)[] = [undefined];
  let notice = 0; // seconds the TAKEN line stays in place of the description
  const refreshPrompt = () => {
    question = questionFor(model.size, state.battery.map(t => t.name));
    const asked = wrapText(question);
    const description = wrapText(notice > 0 ? TAKEN : model.highlighted().description).slice(0, 4 - asked.length);
    promptLines = [...asked, ...description];
    promptColors = [...asked.map(() => undefined), ...description.map(() => BLUE)];
  };

  let highlightedAt = 0; // when the highlight last moved, so its preview starts from the beginning
  let announceIn = 0;
  let announcePending = false;
  let readyToRun = false;
  let beats = 0; // events heard so far in this run
  // What a screen reader hears as the run starts. It is said together with the run's first stage: the live region
  // keeps only the last thing announced within a moment, so two announcements made together would lose the first.
  let runNote = '';
  const counts = { stages, trials: 3 }; // what the run's readout counts (refilled each step, not reallocated)
  let lastPhase: Phase = state.phase;
  let lastRunning = 0; // which test of the battery the run's words are about
  let runLines: string[] = [];

  const describeHighlighted = (): string => {
    const test = model.highlighted();
    const card = model.cardOf(test);
    const chips = card.chips.filter(c => c).map(spoken).join(', ');
    const inBattery = state.battery.includes(test) ? ' In her battery.' : '';
    return `${test.name}. ${chips}. Gives ${spoken(card.gives)}.${inBattery}`;
  };

  const leave = () => {
    sfx.play('back');
    host.quit();
  };

  // ---- the flow ------------------------------------------------------------------------------------------------------------

  /** Words for the start of the run: a re-booking, the test, and a warning when she runs on a day to re-book. */
  const noteRun = () => {
    beats = 0;
    const test = model.current();
    const of = state.battery.length > 1 ? ` (test ${state.running + 1} of ${state.battery.length})` : '';
    const first = state.running === 0;
    runNote = `${first && state.rebooked ? 'Re-booked: the calendar moves on two days. ' : ''}Running the ${test?.name ?? 'test'}${of}.${
      first && model.shaky() ? ' Data quality: shaky.' : ''
    } `;
    if (test) {
      runView.card = cardFor(test.name);
      runView.title = test.name.toUpperCase();
      runLines = wrapText(`${firstName(sport.athleteProfile)} is running the ${test.name}${of}.`);
    }
  };

  const startRun = () => {
    readyToRun = false;
    model.beginRun();
    noteRun();
  };

  /** The printout slides out. Its lines are worked out here, so even the first frame shows this test's. */
  const showPrintout = () => {
    sfx.play('save');
    printoutView.lines = model.printout();
    announce(model.printoutSpoken());
  };

  const answered = (call: CheckCall) => {
    const check = state.check;
    const right = model.answer(call);
    checkView.answered = true;
    checkView.rebooked = state.rebooked;
    checkView.shaky = model.shaky();
    sfx.play(right ? 'correct' : 'wrong');
    host.say(`${right ? 'Good call.' : 'Hmm.'} ${check?.why ?? ''}`.trim(), undefined, () => {
      readyToRun = true;
    });
  };

  const showCheck = () => {
    const check = state.check;
    if (!check) return;
    lastCheckShown = check.says;
    host.input.blockRepeats();
    // Her own words, on her name tab; the call is the player's
    host.say(check.says, [state.battery.length > 1 ? 'RUN THE TESTS' : 'RUN THE TEST', 'RE-BOOK IT'], choice => answered(choice === 1 ? 'rebook' : 'run'), {
      speaker: athleteSpeaker(host.level),
    });
  };

  const startPick = () => {
    lastOrderShown = orderNames;
    model.startPick();
    host.input.blockRepeats();
    refreshList();
    refreshPrompt();
    // What the athlete needs is drawn on every stage, so a listener hears it once, with the question
    const first = (sport.athleteProfile.split(' ')[0] ?? '').replace(/,$/, '');
    announce(`${question} ${first} needs ${spoken(needs)}. ${describeHighlighted()}`);
  };

  /** The printout has been read: the room is done (the Director's check-in in the hub says what the test found). */
  const finish = () => {
    if (state.battery.length === 0) return;
    model.startFeedback();
    model.finish();
    host.complete(model.result());
  };

  /** The check stage's plate: the battery's names if they fit, else how many tests. */
  const plateFor = (): string => {
    const names = state.battery.map(t => t.name.toUpperCase()).join(' + ');
    return measureText(names) - 1 <= PLATE_MAX ? names : `${state.battery.length} TESTS`;
  };

  const choose = () => {
    const outcome = model.choose();
    if (outcome === 'locked') return;
    if (outcome === 'taken') {
      sfx.play('wrong');
      notice = NOTICE_SECONDS;
      refreshPrompt();
      announce(TAKEN);
      return;
    }
    refreshList();
    if (outcome === 'added') {
      sfx.play('select');
      notice = 0;
      refreshPrompt();
      announcePending = false;
      highlightedAt = state.phaseTime; // the cursor moved on to the next test: its preview starts again
      announce(`Added: ${state.battery[state.battery.length - 1]?.name ?? ''}. ${question} ${describeHighlighted()}`);
      return;
    }
    announcePending = false; // what was under the cursor is no longer news: the next screen speaks for itself
    sfx.play('select');
    const test = state.battery[0];
    if (!test) return;
    checkView.card = cardFor(test.name);
    checkView.plate = plateFor();
    if (state.phase === 'check') showCheck();
    else noteRun(); // no test day: straight into the run
  };

  const unpick = () => {
    const last = state.battery[state.battery.length - 1];
    if (!model.unpick() || !last) return;
    sfx.play('back');
    refreshList();
    notice = 0;
    refreshPrompt();
    announce(`Taken out: ${last.name}. ${question}`);
  };

  // The brief: the profile, then what testing is for as agreed with the Director (else the goal, as the classic room
  // says it); the stage tours the tests meanwhile
  const brief = `${sport.athleteProfile} ${agreed ? agreed.testingBrief : `Goal: ${sport.goal}`}`;
  if (host.firstVisit)
    host.sayAll([brief, TIP], () => {
      host.rulesRead();
      startPick();
    });
  else host.say(brief, undefined, startPick);

  // ---- each step -------------------------------------------------------------------------------------------------------------

  const update = (dt: number, inp: InputState, dialogueBusy: boolean) => {
    model.update(dt);

    // The printout starts by itself when the run ends (a skip with A starts it at once, below)
    if (lastPhase === 'run' && state.phase === 'printout') showPrintout();
    // The next test of the battery starts by itself when one ends (a skip with A starts it at once, below)
    if (state.phase === 'run' && lastRunning !== state.running) {
      lastRunning = state.running;
      noteRun();
    }
    lastPhase = state.phase;
    if (notice > 0) {
      notice -= dt;
      if (notice <= 0) {
        notice = 0;
        if (state.phase === 'pick') refreshPrompt();
      }
    }

    if (announcePending) {
      announceIn -= dt;
      if (announceIn <= 0) {
        announcePending = false;
        announce(describeHighlighted());
      }
    }

    // A sound at each stage, trial and beep of the run (not in the pick screen's preview, which stays quiet)
    if (state.phase === 'run') {
      const card = runView.card;
      const u = clamp01(state.phaseTime / RUN_SECONDS);
      counts.trials = trialsOf(card);
      const heard = beatCount(card.shape, u, counts);
      if (heard > beats) {
        beats = heard;
        sfx.play('beat');
        // "stage 3", "trial 2 of 3", "level 4", "all-out": the first one carries the note about how the run started
        announce(`${runNote}${spoken(readoutAt(card.shape, u, counts))}`);
        runNote = '';
      }
    }

    // After the verdict on the call, the run starts once she has been re-booked on the calendar too
    if (state.phase === 'check' && readyToRun && (!state.rebooked || state.flip >= REBOOK_SECONDS)) startRun();

    if (dialogueBusy) return; // the dialogue used this step's presses

    switch (state.phase) {
      case 'pick': {
        if (inp.bPressed) {
          if (state.battery.length > 0) unpick(); // B goes back a step: the last test comes out of the battery
          else leave();
          return;
        }
        const step = (inp.upRepeat ? -1 : 0) + (inp.downRepeat ? 1 : 0);
        if (step !== 0) {
          model.moveCursor(step);
          highlightedAt = state.phaseTime;
          sfx.play('blip');
          refreshPrompt();
          announceIn = ANNOUNCE_DELAY;
          announcePending = true;
        }
        if (inp.aPressed && model.canDecide()) choose();
        break;
      }
      case 'check':
        if (inp.bPressed) leave();
        break;
      case 'run':
        if (inp.bPressed) leave();
        else if (inp.aPressed && model.skipRun()) {
          sfx.play('select');
          if ((state.phase as Phase) === 'printout') {
            showPrintout(); // now, so the next frame already draws this battery's printout
            lastPhase = state.phase;
          } else {
            lastRunning = state.running;
            noteRun(); // the next test of the battery
          }
        }
        break;
      case 'printout':
        if (inp.bPressed) leave();
        else if (inp.aPressed && model.canDecide()) {
          sfx.play('select');
          finish();
        }
        break;
      default:
        break;
    }
  };

  // ---- each frame -----------------------------------------------------------------------------------------------------------

  const render = (ctx: CanvasRenderingContext2D) => {
    refreshHints();
    const clock = state.clock;
    switch (state.phase) {
      case 'brief': {
        // a tour of the four tests while the brief is read
        const tour = state.order[Math.floor(state.phaseTime / TOUR_SECONDS) % state.order.length];
        if (tour) pickView.card = cardFor(tour.name);
        pickView.clock = state.phaseTime % TOUR_SECONDS;
        drawPickStage(ctx, pickView);
        break;
      }
      case 'pick': {
        pickView.card = cardFor(model.highlighted().name);
        pickView.clock = state.phaseTime - highlightedAt; // each highlighted test plays from its start
        drawPickStage(ctx, pickView);
        drawOptionList(ctx, listNames, state.cursor, LIST_BOTTOM, listDimmed, LIST_GAP);
        drawPromptBox(ctx, promptLines, state.battery.length > 0 ? hints.undo : hints.pick, promptColors);
        break;
      }
      case 'check': {
        checkView.clock = clock;
        checkView.flip = state.flip;
        checkView.rebooked = state.rebooked;
        drawCheckStage(ctx, checkView);
        break;
      }
      case 'run': {
        runView.clock = clock;
        runView.u = clamp01(state.phaseTime / RUN_SECONDS);
        runView.shaky = model.shaky();
        const grow = clamp01(state.phaseTime / GROW_SECONDS);
        growing.h = calm ? runWindow.h : Math.round(stageWindow.h + (runWindow.h - stageWindow.h) * (1 - (1 - grow) * (1 - grow)));
        drawRunStage(ctx, runView);
        drawPromptBox(ctx, runLines, hints.run);
        break;
      }
      case 'printout':
      case 'feedback':
      case 'done': {
        printoutView.slide = state.phase === 'printout' ? state.phaseTime : PRINTOUT_SECONDS;
        drawPrintoutStage(ctx, printoutView);
        if (state.phase === 'printout') drawPromptBox(ctx, PRINTOUT_PROMPT, hints.printout);
        break;
      }
    }
  };

  const debug = () => ({
    phase: state.phase,
    phaseTime: state.phaseTime,
    order: state.order.map(t => t.name),
    selected: state.cursor,
    battery: state.battery.map(t => t.name),
    running: state.running,
    check: state.check ? { says: state.check.says, call: state.check.call, answer: state.call } : null,
    factor: model.factor(),
    result: state.phase === 'feedback' || state.phase === 'done' ? model.result() : null,
  });

  return { update, render, debug };
};

export const createTestingRoom: InstrumentFactory = host => createTestingRoomWith(host, Math.random);
