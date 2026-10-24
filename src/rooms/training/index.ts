// Training Floor instrument: "Hard-Easy Week". The player plans Aisha's week on a board of seven days and a GO
// slot, watching a LEGS gauge react to every choice, then the week runs day by day on the track and the coach
// debriefs it. The score is how well each key session was timed (see model.ts); the stat is ENDURANCE.
import type { InputState } from '../../engine/Input';
import { drawPromptBox } from '../../render/DialogueBox';
import { ambientTime, prefersReducedMotion } from '../../render/motion';
import { sfx } from '../../audio/Sfx';
import { announce } from '../../ui/announce';
import { contentFor } from '../content';
import type { TrainingContent } from '../content/types';
import type { InstrumentFactory, RoomHost, RoomInstrument } from '../types';
import { drawBoard, type BoardView } from './board';
import { dayCells, ladderOrder, ladderRungs } from './cells';
import { LOOK, type DayCell } from './look';
import { DAY_COUNT, DAY_NAMES, chipLabel, type Session } from './model';
import { GO, createPlanner } from './planner';
import { createRunClock, type RunClock } from './run';
import { TRACK_SPACING, drawBackdrop, drawStations, drawStrip, gaitFor, type StationsView, type StripView } from './stage';
import { phaseAt, styleOf, type Phase, type SessionStyle } from './style';
import {
  checkLines,
  dayAnnouncement,
  dayPrompt,
  debriefLines,
  goAnnouncement,
  goPrompt,
  runDayAnnouncement,
  runQuestion,
  type DebriefLine,
  type PromptLine,
  type Tone,
} from './text';

type Stage = 'brief' | 'plan' | 'asking' | 'run' | 'debrief' | 'done';

/** A or B are ignored this long after a new decision appears, so a carried-over press cannot decide it unseen. */
const DECISION_LOCK = 0.35;
/** A cursor that rests this long is read out to screen readers. */
const ANNOUNCE_DELAY = 0.3;
/** The gauge of the day being played fills over the first part of its time. */
const REVEAL = 0.3;
/** While planning, the preview of the day under the cursor loops over this many seconds. */
const PREVIEW_LOOP = 2.4;

const TONE_COLOR: Readonly<Record<Tone, string>> = {
  ink: LOOK.ink,
  good: LOOK.good,
  warn: LOOK.warnInk,
  bad: LOOK.bad,
};

const HINT_PLAN = '{DPAD}: PLAN   {A}: NEXT   {B}: QUIT';
const HINT_GO = '{DPAD}: PLAN   {A}: RUN   {B}: QUIT';
const HINT_RUN = 'HOLD {A}: FAST-FORWARD   {B}: QUIT';
// Said once when the board first appears: the board itself only shows how to use it
const BOARD_HELP = '{LEFT} and {RIGHT} choose a day, {UP} and {DOWN} its session, {A} goes to the next day.';

interface Score {
  dataQuality: number;
  variableAccuracy: number;
}

/**
 * The room. `rng` decides the attempt's away day and the order UP and DOWN cycle the sessions in: the game uses
 * Math.random, tests pass a seeded one.
 */
export const createTrainingInstrument = (host: RoomHost, rng: () => number = Math.random): RoomInstrument => {
  const content: TrainingContent | undefined = contentFor(host.level)?.training;
  if (!content) {
    host.say('This room is being rebuilt. Come back soon!', undefined, () => host.quit());
    return { update() {}, render() {} };
  }
  const sport = host.sport;
  const planner = createPlanner(content, rng);
  const rungs = ladderRungs(content);
  const order = ladderOrder(content);
  const rungByCard = content.cards.map((_, card) => order.indexOf(card));
  const lines = { fullAt: content.legs.fullAt, redBelow: content.checks.redBelow };

  let stage: Stage = 'brief';
  let clock = 0; // seconds since the room opened (dt only: the pause menu freezes it)
  let lock = 0; // seconds A and B are still ignored
  let run: RunClock | null = null;
  let debrief: readonly DebriefLine[] = [];
  let debriefAt = -1;
  let result: Score | null = null;
  let reportedDay = -1;
  let announceIn = 0;
  let announcePending = false;
  let promptKey = '';
  let prompt: PromptLine[] = [];
  let promptTexts: string[] = [];
  let promptColors: string[] = [];
  let hintFor = '';
  let hintDevice = '';
  let hintText = '';

  let cells: DayCell[] = dayCells(content, planner.plan, planner.analysis);
  const stationsView: StationsView = {
    rungs,
    focusRung: -1,
    phase: 'off',
    legs: planner.analysis.legs,
    legsFocus: -1,
    shown: DAY_COUNT,
    lines,
    cells,
    weekFocus: -1,
    t: 0,
  };
  const stripView: StripView = { style: 'none', phase: 'off', tired: false, t: 0, scroll: 0, fast: false };
  // What the screens are looking at right now: worked out once a step (see refreshFocus), drawn every frame
  const focus = {
    day: -1,
    session: undefined as Session | undefined,
    card: null as number | null,
    style: 'none' as SessionStyle,
    phase: 'off' as Phase,
    tired: false,
  };
  let trackScroll = 0; // how far the strip's track has slid past, in px
  const boardView: BoardView = {
    mode: 'plan',
    cells,
    focus: -1,
    played: 0,
    active: -1,
    reveal: 1,
    ready: false,
    checks: checkLines(content, planner.analysis),
    lines,
    ring: -1,
    ringChecks: false,
  };

  // ---- the flow ---------------------------------------------------------------------------------------------------

  /** The plan or the cursor changed: refresh what is derived from them, and queue the screen-reader line. */
  const changed = () => {
    const { plan, analysis } = planner;
    cells = dayCells(content, plan, analysis);
    stationsView.cells = cells;
    stationsView.legs = analysis.legs;
    boardView.cells = cells;
    boardView.checks = checkLines(content, analysis);
    boardView.ready = planner.missing().length === 0;
    promptKey = '';
    announcePending = true;
    announceIn = ANNOUNCE_DELAY;
  };

  /** The board opens for planning (also after a question was answered "no" or "stay"). */
  const beginPlan = () => {
    const first = stage === 'brief';
    stage = 'plan';
    lock = DECISION_LOCK;
    host.input.blockRepeats();
    if (first) {
      const away = planner.away;
      const opening = away === null ? 'Plan the week.' : `Plan the week. ${DAY_NAMES[away]} is an away day.`;
      announce(`${opening} ${host.input.fill(BOARD_HELP)}`);
    }
    changed();
  };

  const startBrief = () => {
    if (host.firstVisit)
      host.sayAll([...content.rules], () => {
        host.rulesRead();
        beginPlan();
      });
    else host.say(content.rulesShort, undefined, beginPlan);
  };

  const startRun = () => {
    stage = 'run';
    run = createRunClock();
    reportedDay = -1;
    host.input.blockRepeats();
    announce('Running the week.');
  };

  /** B in the plan: straight out if nothing is planned, else ask first. B again means stay. */
  const leavePlan = () => {
    if (!planner.touched()) {
      host.quit();
      return;
    }
    stage = 'asking';
    host.dialogue.show(
      'Leave the plan? Your week will be lost.',
      ['STAY', 'LEAVE'],
      choice => (choice === 1 ? host.quit() : beginPlan()),
      beginPlan,
      { exitLabel: 'STAY' },
    );
  };

  const askToRun = () => {
    stage = 'asking';
    // With a key session missing NO comes first, so mashing A cannot run an unfinished week
    const options = planner.missing().length > 0 ? ['NO', 'YES'] : ['YES', 'NO'];
    host.dialogue.show(
      runQuestion(planner.missing()),
      options,
      choice => (options[choice ?? 0] === 'YES' ? startRun() : beginPlan()),
      beginPlan,
      { exitLabel: 'NO' },
    );
  };

  /** B while the week plays: ask before throwing it away. B again (or STAY) carries on where it stopped. */
  const resumeRun = () => {
    stage = 'run';
    host.input.blockRepeats();
  };
  const leaveRun = () => {
    stage = 'asking';
    host.dialogue.show('Leave now? This week will be lost.', ['STAY', 'LEAVE'], choice => (choice === 1 ? host.quit() : resumeRun()), resumeRun, {
      exitLabel: 'STAY',
    });
  };

  const finish = () => {
    if (stage === 'done') return; // the result is recorded once, however many times the last line is answered
    stage = 'done';
    if (result) host.complete(result);
  };

  /** One line of the debrief. B asks before throwing away a finished week. */
  const sayDebrief = (index: number) => {
    const line = debrief[index];
    if (!line || !result) {
      finish();
      return;
    }
    debriefAt = index;
    if (line.good !== null) sfx.play(line.good ? 'correct' : 'wrong');
    host.dialogue.show(
      line.text,
      undefined,
      () => sayDebrief(index + 1),
      () => {
        const back = () => sayDebrief(index);
        host.dialogue.show(
          "Leave now? This week's result will be lost.",
          ['STAY', 'LEAVE'],
          choice => (choice === 1 ? host.quit() : back()),
          back,
          { exitLabel: 'STAY' },
        );
      },
      // The first line ignores A and B a moment: the run invites mashing, and nobody should skip a result unseen
      { exitLabel: 'QUIT', lock: index === 0 ? DECISION_LOCK : 0 },
    );
  };

  const beginDebrief = () => {
    stage = 'debrief';
    run = null;
    const { analysis } = planner;
    result = { dataQuality: analysis.dataQuality, variableAccuracy: analysis.variableAccuracy };
    debrief = debriefLines(content, sport, analysis);
    sayDebrief(0);
  };

  // ---- announcements ----------------------------------------------------------------------------------------------

  const describeCursor = (): string => {
    const { cursor, plan, analysis } = planner;
    if (cursor === GO) return goAnnouncement(analysis, planner.missing());
    const session = plan[cursor];
    return session ? dayAnnouncement(content, sport, cursor, session, analysis) : '';
  };

  const describeRunDay = (day: number): string => {
    const { plan, analysis } = planner;
    const session = plan[day];
    return session ? runDayAnnouncement(content, sport, day, session, analysis) : `${DAY_NAMES[day] ?? ''}.`;
  };

  // ---- input ---------------------------------------------------------------------------------------------------------

  const updatePlan = (dt: number, inp: InputState, busy: boolean) => {
    if (busy) return;
    // A fresh press wraps round the board; a held direction stops at the ends instead of circling
    if (inp.leftRepeat || inp.rightRepeat) {
      const before = planner.cursor;
      planner.move(inp.rightRepeat ? 1 : -1, inp.leftPressed || inp.rightPressed);
      if (planner.cursor !== before) {
        sfx.play('blip');
        changed();
      }
    } else if (inp.upRepeat || inp.downRepeat) {
      if (planner.cycle(inp.downRepeat ? 1 : -1)) {
        sfx.play('blip');
        changed();
      } else if (planner.cursor !== GO) {
        sfx.play('bump'); // the away day cannot be changed
      }
    }

    if (lock <= 0) {
      if (inp.bPressed) {
        sfx.play('back');
        leavePlan();
        return;
      }
      if (inp.aPressed) {
        sfx.play('select');
        if (planner.cursor === GO) {
          askToRun();
        } else {
          planner.next();
          changed();
        }
        return;
      }
    }

    // A cursor that has rested for a moment is read out
    if (announcePending) {
      announceIn -= dt;
      if (announceIn <= 0) {
        announcePending = false;
        announce(describeCursor());
      }
    }
  };

  const updateRun = (dt: number, inp: InputState, busy: boolean) => {
    if (!run || busy) return; // the week waits while a line is up (and the press that closed it is used up)
    if (inp.bPressed) {
      leaveRun();
      return;
    }
    run.update(dt, inp.a);
    if (run.day !== reportedDay && run.daysDone < DAY_COUNT) {
      reportedDay = run.day;
      announce(describeRunDay(run.day));
      // A tick for each day; a key session answers with how it went
      const quality = planner.analysis.quality[run.day];
      sfx.play(quality === null || quality === undefined ? 'beat' : quality >= 1 ? 'correct' : 'wrong');
    }
    if (run.finished) beginDebrief();
  };

  // ---- drawing -------------------------------------------------------------------------------------------------------

  /** The hint with the player's button names, worked out again only when the hint or the device changes. */
  const filledHint = (hint: string): string => {
    const device = host.input.lastDevice();
    if (hint !== hintFor || device !== hintDevice) {
      hintFor = hint;
      hintDevice = device;
      hintText = host.input.fill(hint);
    }
    return hintText;
  };

  const drawPrompt = (ctx: CanvasRenderingContext2D) => {
    const { day, session } = focus;
    const device = host.input.lastDevice();
    const key = `${stage}|${stage === 'run' ? day : planner.cursor}|${device}`;
    if (key !== promptKey) {
      promptKey = key;
      const fill = (text: string) => host.input.fill(text);
      const { analysis, cursor } = planner;
      if (stage === 'run' && session) {
        prompt = dayPrompt(content, sport, day, session, analysis.legs[day] ?? 0, fill, true);
      } else if (stage === 'plan' || stage === 'asking') {
        const current = planner.plan[cursor];
        if (cursor === GO) prompt = goPrompt(analysis, planner.missing(), fill);
        else prompt = current ? dayPrompt(content, sport, cursor, current, analysis.legs[cursor] ?? 0, fill) : [];
      } else {
        prompt = [];
      }
      promptTexts = prompt.map(line => line.text);
      promptColors = prompt.map(line => TONE_COLOR[line.tone]);
    }
    const hint = stage === 'run' ? HINT_RUN : planner.cursor === GO ? HINT_GO : HINT_PLAN;
    drawPromptBox(ctx, promptTexts, stage === 'plan' || stage === 'run' ? filledHint(hint) : undefined, promptColors);
  };

  /**
   * Work out what the screens look at: the cursor's day while planning, the playhead's while running, the day the
   * coach is talking about in the debrief; what the athlete is doing there, and the interval timer's phase.
   */
  const refreshFocus = () => {
    const playing = stage === 'run' && run !== null;
    const over = stage === 'debrief' || stage === 'done';
    // Every day is played and the run holds a moment before the debrief: the athlete stops (a day's pace would loop on)
    const weekOver = playing && run !== null && run.daysDone >= DAY_COUNT;
    let day = -1;
    if (playing && run) day = run.day;
    else if (over) day = debrief[debriefAt]?.day ?? -1;
    else if (planner.cursor !== GO && stage !== 'brief') day = planner.cursor;
    const session = day >= 0 ? planner.plan[day] : undefined;
    focus.day = day;
    focus.session = session;
    focus.card = session && session.kind === 'card' && !weekOver ? session.card : null;
    focus.style = session && !weekOver ? styleOf(content, session) : 'none';
    const progress = playing && run ? run.progress : (clock % PREVIEW_LOOP) / PREVIEW_LOOP;
    focus.phase = over ? 'off' : phaseAt(focus.style, progress);
    focus.tired = day >= 0 && !over && !weekOver && (planner.analysis.quality[day] ?? 1) < 1;
  };

  const render = (ctx: CanvasRenderingContext2D) => {
    const t = ambientTime(clock);
    const playing = stage === 'run' && run !== null;
    const over = stage === 'debrief' || stage === 'done';

    drawBackdrop(ctx);
    stationsView.focusRung = focus.card === null ? -1 : (rungByCard[focus.card] ?? -1);
    stationsView.phase = focus.phase;
    stationsView.legsFocus = focus.day;
    stationsView.weekFocus = focus.day;
    stationsView.shown = playing && run ? Math.min(DAY_COUNT, run.daysDone + 1) : DAY_COUNT;
    stationsView.t = t;
    drawStations(ctx, stationsView);

    stripView.style = focus.style;
    stripView.phase = focus.phase;
    stripView.tired = focus.tired;
    stripView.t = t;
    stripView.scroll = trackScroll;
    stripView.fast = playing && run !== null && run.fast;
    drawStrip(ctx, stripView);

    boardView.mode = playing ? 'run' : over ? 'debrief' : 'plan';
    boardView.focus = stage === 'plan' || stage === 'asking' ? planner.cursor : -1;
    boardView.played = run ? run.daysDone : 0;
    boardView.active = playing && run && run.daysDone < DAY_COUNT ? run.day : -1;
    boardView.reveal = playing && run ? Math.min(1, run.progress / REVEAL) : 1;
    const point = debrief[debriefAt];
    boardView.ring = point && !point.checks && point.day !== null ? point.day : -1;
    boardView.ringChecks = point?.checks ?? false;
    drawBoard(ctx, boardView);

    drawPrompt(ctx);
  };

  startBrief();
  refreshFocus();

  return {
    update(dt, inp, busy) {
      clock += dt;
      lock = Math.max(0, lock - dt);
      if (stage === 'plan') updatePlan(dt, inp, busy);
      else if (stage === 'run') updateRun(dt, inp, busy);
      refreshFocus();
      // The track slides past at the pace of what the athlete is doing (and holds still under reduced motion)
      if (!prefersReducedMotion()) trackScroll = (trackScroll + gaitFor(focus.style, focus.phase).scroll * dt) % TRACK_SPACING;
    },
    render,
    debug() {
      const { plan, analysis, cursor, away, order } = planner;
      return {
        phase: stage,
        away,
        cursor,
        order: order.map(i => content.cards[i]?.label ?? ''),
        plan: plan.map(s => chipLabel(content, s)),
        legs: analysis.legs,
        qualities: analysis.quality,
        stimulus: analysis.stimulus,
        structure: analysis.structure,
        checks: analysis.checks,
        ready: planner.missing().length === 0,
        runDay: run?.day ?? null,
        runProgress: run?.progress ?? null,
        daysDone: run?.daysDone ?? null,
        debriefAt,
        result,
      };
    },
  };
};

/** The factory the room registry uses. */
export const createTrainingRoom: InstrumentFactory = host => createTrainingInstrument(host);
