// ATHLETE room instrument: "Meet the athlete". The athlete introduces herself, then the player picks which questions
// to ask from a shuffled list that mixes good Phase 1 athlete-overview questions (Ruddock et al. 2018, Table 1) with
// weaker ones. She answers each; a good question writes a note into the notebook on screen. After the allowed number
// of asks, a debrief by how many good questions were asked and her farewell, which sets up the TESTING room. The score
// (OVERVIEW n/asks) is reported to the scene, which keeps the best; it never feeds a stat or the showdown rating.
//
// model.ts holds the rules, draw.ts draws; this file is the buttons, the timers and the order of things. Timers
// advance with dt only. Words are worked out when something happens, never while drawing.
import type { InputState } from '../../engine/Input';
import { drawPromptBox } from '../../render/DialogueBox';
import { prefersReducedMotion } from '../../render/motion';
import { sfx } from '../../audio/Sfx';
import { announce } from '../../ui/announce';
import { athleteColorsFor, athleteSpriteFor } from '../../data/sprites';
import { athleteFirstName } from '../../data/rooms/meet';
import type { MeetContent, MeetQuestion } from '../content/meet-types';
import { meetContentFor } from '../content';
import type { InstrumentFactory, RoomHost, RoomInstrument } from '../types';
import {
  afterAnswer,
  askCurrent,
  asksAllowed,
  createMeet,
  current,
  debriefFor,
  finished,
  goodAsked,
  moveCursor,
  overviewLabel,
} from './model';
import { VISIBLE, drawMeetStage, type MeetView } from './draw';

/** A or B pressed this soon after the list appears is ignored, so a carried-over press decides nothing unseen. */
const LOCK = 0.35;
/** How long a new note glows in the notebook. */
const FLASH = 0.8;

type Step = 'intro' | 'choose' | 'answer' | 'debrief' | 'done';

export const createMeetInstrument = (host: RoomHost, content: MeetContent, rng: () => number): RoomInstrument => {
  const meet = createMeet(content, rng);
  const of = asksAllowed(content);
  const name = athleteFirstName(host.sport);
  const fill = (text: string): string => host.input.fill(text);

  let step: Step = 'intro';
  let lock = 0;
  let clock = 0;
  let prompt = ''; // the box text while choosing (filled)
  let hint = ''; // and its button tag
  let windowStart = 0;
  const shownLabels: string[] = [];

  const view: MeetView = {
    sprite: athleteSpriteFor(host.level),
    colors: athleteColorsFor(host.level),
    name: name.toUpperCase(),
    overview: overviewLabel(0, of),
    notes: meet.notes,
    shown: 0,
    flash: 0,
    list: null,
    cursor: 0,
    moreAbove: false,
    moreBelow: false,
    asked: '',
    clock: 0,
    still: prefersReducedMotion(),
  };

  // ---- leaving ----

  /** Once a question has been asked, walking away loses the conversation: ask first. B on the question means stay. */
  const askLeave = (resume: () => void) =>
    host.dialogue.show(
      'Leave the chat? Your notes will be lost.',
      ['STAY', 'LEAVE'],
      choice => (choice === 1 ? host.quit() : resume()),
      resume,
      { exitLabel: 'STAY' },
    );

  /** Lines whose B asks the leave question; staying says them again from the first. */
  const talk = (texts: readonly string[], onDone: () => void, nextLabel?: string): void =>
    host.dialogue.showSequence([...texts], onDone, () => askLeave(() => talk(texts, onDone, nextLabel)), {
      exitLabel: 'LEAVE',
      nextLabel,
    });

  // ---- the list ----

  /** The visible slice of the list follows the cursor; worked out when the cursor or the list changes. */
  const refreshList = () => {
    const n = meet.labels.length;
    if (meet.cursor < windowStart) windowStart = meet.cursor;
    if (meet.cursor >= windowStart + VISIBLE) windowStart = meet.cursor - VISIBLE + 1;
    windowStart = Math.max(0, Math.min(windowStart, Math.max(0, n - VISIBLE)));
    shownLabels.length = 0;
    for (let i = windowStart; i < Math.min(n, windowStart + VISIBLE); i++) shownLabels.push(meet.labels[i]!);
    view.list = shownLabels;
    view.cursor = meet.cursor - windowStart;
    view.moreAbove = windowStart > 0;
    view.moreBelow = windowStart + VISIBLE < n;
  };

  const sayOption = () => {
    const q = current(meet);
    if (q) announce(`${q.ask} (${meet.cursor + 1} of ${meet.options.length})`);
  };

  const startChoosing = () => {
    step = 'choose';
    lock = LOCK;
    view.asked = '';
    refreshList();
    const n = meet.asked.length + 1;
    prompt = fill(`Question ${n} of ${of}. What do you ask ${name}? Choose with {DPAD}.`);
    hint = fill(meet.asked.length > 0 ? '{A}: ASK   {B}: LEAVE' : '{A}: ASK   {B}: QUIT');
    host.input.blockRepeats(); // a thumb already on the D-pad must not scroll the list that has just appeared
    announce(`${prompt} ${fill(meet.asked.length > 0 ? '{A}: ask. {B}: leave.' : '{A}: ask. {B}: quit.')}`);
    sayOption();
  };

  const updateChoose = (inp: InputState, busy: boolean) => {
    if (busy) return;
    const dir = (inp.downRepeat ? 1 : 0) - (inp.upRepeat ? 1 : 0);
    if (dir !== 0) {
      if (moveCursor(meet, dir)) {
        sfx.play('blip');
        refreshList();
        sayOption();
      } else {
        sfx.play('bump');
      }
    }
    if (lock > 0) return;
    if (inp.bPressed) {
      if (meet.asked.length > 0) askLeave(() => startChoosing());
      else host.quit(); // nothing asked yet: nothing to lose
      return;
    }
    if (inp.aPressed) ask();
  };

  // ---- a question and its answer ----

  const writeNote = (q: MeetQuestion) => {
    view.overview = overviewLabel(goodAsked(meet), of);
    if (!q.good) {
      sfx.play('wrong');
      return;
    }
    view.shown = meet.notes.length;
    view.flash = FLASH;
    sfx.play('correct');
  };

  const ask = () => {
    const q = askCurrent(meet);
    if (!q) return;
    sfx.play('select');
    step = 'answer';
    view.list = null;
    view.asked = q.ask;
    // her answer, then (as the note is written, or not) what the question was worth
    talk(q.answer, () => {
      writeNote(q);
      talk(afterAnswer(q), () => (finished(meet) ? startDebrief() : startChoosing()));
    });
  };

  // ---- the end ----

  const startDebrief = () => {
    step = 'debrief';
    view.asked = '';
    const good = goodAsked(meet);
    talk([debriefFor(content, good), ...content.farewell], () => {
      step = 'done';
      host.complete({ dataQuality: 0, variableAccuracy: 0, overview: { good, of } });
    });
  };

  // ---- the start ----

  const rules = () => {
    if (host.firstVisit) {
      host.sayAll(
        [...content.rules],
        () => {
          host.rulesRead();
          startChoosing();
        },
        { exitLabel: 'QUIT', nextLabel: 'READY' },
      );
    } else {
      host.say(content.rulesShort, undefined, startChoosing, { exitLabel: 'QUIT', nextLabel: 'READY' });
    }
  };

  const start = () => {
    // she introduces herself until the room has been finished once; a replay goes straight to the rules
    if (host.replay) rules();
    else host.sayAll([...content.athleteIntro], rules);
  };

  const instrument: RoomInstrument = {
    update(dt, inp, busy) {
      clock += dt;
      view.clock = clock;
      lock = Math.max(0, lock - dt);
      view.flash = Math.max(0, view.flash - dt);
      if (step === 'choose') updateChoose(inp, busy);
    },

    render(ctx) {
      drawMeetStage(ctx, view);
      if (step === 'choose' && !host.dialogue.isActive()) drawPromptBox(ctx, prompt, hint);
    },

    debug() {
      return {
        step,
        cursor: meet.cursor,
        options: meet.options.map(q => q.id),
        asked: meet.asked.map(q => q.id),
        good: goodAsked(meet),
        of,
        notes: [...meet.notes],
        shown: view.shown,
        finished: finished(meet),
      };
    },
  };

  start();
  return instrument;
};

export const createMeetRoom: InstrumentFactory = host => {
  const content = meetContentFor(host.level);
  if (!content) {
    host.say('This room is being rebuilt. Come back soon!', undefined, () => host.quit());
    return { update() {}, render() {} };
  }
  return createMeetInstrument(host, content, Math.random);
};
