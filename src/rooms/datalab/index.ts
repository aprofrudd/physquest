// Data Lab instrument: the Trace Desk. One file per test the Testing Lab ran that has a file (the lactate profile's
// stages, the critical speed trials). File by file, the player decides for each flagged reading whether it is real
// data or a glitch (KEEP IT / REMOVE IT, from a choice list), then chooses the KEY VARIABLES from the cleaned files.
// The rules live in model.ts, the drawing in views.ts; this file is the part that listens to buttons and talks to the
// dialogue.
import type { InputState } from '../../engine/Input';
import { announce } from '../../ui/announce';
import { sfx } from '../../audio/Sfx';
import { drawOptionList, drawPromptBox, wrapText } from '../../render/DialogueBox';
import { prefersReducedMotion } from '../../render/motion';
import { blink } from '../frame';
import { contentFor } from '../content';
import type { RoomHost, RoomInstrument } from '../types';
import {
  ODD_NUMBER,
  createTraceDesk,
  fillSlots,
  fmt1,
  keyFullLine,
  keysChosenLine,
  reportedPace,
  type RevealLine,
  type Rng,
} from './model';
import { CLEAN_PLOT, CS_PENDING, OPTIONS_TOP, cleanStageX, drawCleanup, drawPin, plateText, slotText, yMaxFor, type Banner, type CleanupFrame, type PinFrame, type RevealMark } from './views';

type Phase = 'brief' | 'intro' | 'cleanup' | 'choose' | 'pin' | 'reveal';

/** A new decision ignores A and B this long, so a press carried over from the last one decides nothing unseen. */
const DECISION_LOCK = 0.35;
/** The cursor must rest this long before the row it is on is read out. */
const REST_TIME = 0.3;

/** A row's name for a screen reader: the odd-number '?' is dropped (the line after it says the number looks odd). */
const spokenName = (shown: string): string => shown.replace(/\?$/, '');
/** How long a refusal or a hint stays in the box. */
const NOTICE_TIME = 2.4;
const EASE_Y = 9; // per second: how fast the chart re-scales
const EASE_BAND = 16; // per second: how fast the lens band moves to the next reading
const SIDE_WIDTH = 15; // characters in the verdict beside the lactate chart's lens
const WIDE_WIDTH = 38; // characters in the verdict under the trials table

const HINT_DECIDE = '{A}: CONFIRM   {LEFT}: BACK   {B}: QUIT';
const HINT_DECIDE_FIRST = '{A}: CONFIRM   {B}: QUIT'; // the first reading has nothing to look back at
const HINT_NEXT = '{A}: NEXT   {LEFT}: BACK   {B}: QUIT';
const HINT_NEXT_FIRST = '{A}: NEXT   {B}: QUIT';
const HINT_DONE = '{A}: CONTINUE   {LEFT}: BACK   {B}: QUIT';
const HINT_PIN = '{A}: CHOOSE   {DPAD}: MOVE   {B}: QUIT';
const HINT_LOCK = '{A}: LOCK IN   {B}: QUIT';

const LEAVE_TEXT = 'Leave the data desk? Your clean-up will be lost.';

export const createDataRoom = (host: RoomHost, rng: Rng = Math.random): RoomInstrument => {
  const content = contentFor(host.level)?.data;
  if (!content) {
    // Not reachable through instrumentFor (it checks the content first), but never leave the player stuck
    host.say('This room is being rebuilt. Come back soon!', undefined, () => host.quit());
    return { update() {}, render() {} };
  }
  const desk = createTraceDesk(content, host.sport, { tests: host.tests, rng });
  const reduced = prefersReducedMotion();
  const total = desk.suspects.length;
  const options = content.options;

  let phase: Phase = 'brief';
  let clock = 0; // seconds since the room opened (only for blinking)
  let lock = 0; // seconds A/B are ignored
  let view = -1; // the reading under the lens; -1 until a file's intro has been read
  let fileShown = 0; // which file is on screen
  let choice = 0; // KEEP (0) or REMOVE (1) for the reading waiting for a decision
  let cursor = 0; // the key-variable list's cursor: a row, or the row count for LOCK IN
  let yMax = yMaxFor(desk); // the y range as drawn: eases toward the file's
  let bandX = 0;
  let notice = '';
  let noticeLeft = 0;
  let rest = 0; // seconds the cursor has been still
  let lockInWait = 0; // seconds LOCK IN still ignores A after the cursor arrived on it
  let spoken = -1; // the row last read out
  let explaining = -1; // the variable the reveal is on
  const marks: (RevealMark | undefined)[] = host.sport.variables.map(() => undefined);

  // Strings the screens show, built when the state changes (never per frame)
  const readout: string[] = [];
  let banner: Banner | null = null;
  let promptLines: readonly string[] = [];
  let csLine = CS_PENDING;

  // Hints are filled for the player's device (SPACE or A, ...): remembered until the device changes
  const filled = new Map<string, string>();
  let deviceName = '';
  const fill = (template: string): string => {
    const name = host.input.label('a');
    if (name !== deviceName) {
      filled.clear();
      deviceName = name;
    }
    let text = filled.get(template);
    if (text === undefined) {
      text = host.input.fill(template);
      filled.set(template, text);
    }
    return text;
  };

  const cleanFrame: CleanupFrame = { desk, file: 0, view, yMax, bandX, readout, banner, pulse: false, csLine };
  const pinFrame: PinFrame = { desk, cursor, marks, locked: false, explaining };

  // ---- Text for the current screen -------------------------------------------------------------------------------

  const deciding = (): boolean => phase === 'cleanup' && view === desk.decided() && view < total;

  const buildReadout = () => {
    readout.length = 0;
    const s = desk.suspects[view];
    if (!s || s.place.type !== 'stage') return; // the trials file's reading is named by the table and the question
    const stage = desk.stages[s.place.index]!;
    readout.push(`READING ${s.number} OF ${s.of}`, `${stage.kmh} KM/H`, `${fmt1(stage.mmol)} MMOL/L`);
  };

  /** The trials file's CS and D prime line: shown once that file is clean, from the player's own file. */
  const refreshCs = () => {
    const f = desk.files.findIndex(x => x.kind === 'trials');
    if (f < 0 || !desk.fileClean(f)) {
      csLine = CS_PENDING;
      return;
    }
    const d = desk.derived();
    csLine =
      d.csKmh === null
        ? 'CS AND D PRIME: TOO FEW TRIALS LEFT'
        : `CS ${fmt1(Math.round(d.csKmh * 10) / 10)} KM/H (${reportedPace(d.csKmh)}/KM)  D PRIME ${d.dPrime ?? '--'} M`;
  };

  /** Everything the clean-up screen says about the reading under the lens. */
  const refreshCleanup = () => {
    const s = desk.suspects[view];
    if (!s) return;
    buildReadout();
    refreshCs();
    const verdict = desk.verdict(view);
    const narrow = s.file === 'lactate';
    if (verdict) {
      banner = { lines: wrapText(verdict.result, narrow ? SIDE_WIDTH : WIDE_WIDTH).slice(0, narrow ? 6 : 4), good: verdict.right };
      promptLines = wrapText(verdict.why);
    } else {
      banner = null;
      promptLines = wrapText(`${desk.ask(view)} ${desk.seen(view)}`);
    }
  };

  const rowText = (): string => {
    const rows = desk.rows();
    const row = rows[cursor];
    if (!row) {
      // On LOCK IN: a chosen number that looks wrong is worth a last look
      const lock = `Lock in your ${desk.pinLimit} key variables and see how you did.`;
      return rows.some(r => r.pinned && r.odd) ? `${lock} ${ODD_NUMBER}` : lock;
    }
    return row.odd && row.about ? `${row.about} ${ODD_NUMBER}` : row.odd ? ODD_NUMBER : row.about;
  };

  const refreshPin = () => {
    promptLines = wrapText(noticeLeft > 0 ? notice : rowText());
  };

  // ---- Leaving ---------------------------------------------------------------------------------------------------

  /** B: nothing decided yet leaves at once; after that it asks first (B again stays). */
  const leave = () => {
    if (desk.decided() === 0 && desk.pins().length === 0) {
      host.quit();
      return;
    }
    sfx.play('back');
    host.dialogue.show(
      LEAVE_TEXT,
      ['STAY', 'LEAVE'],
      picked => {
        if (picked === 1) host.quit();
        else lock = DECISION_LOCK;
      },
      () => {
        lock = DECISION_LOCK;
      },
      { exitLabel: 'STAY' },
    );
    host.input.blockRepeats();
  };

  // ---- Clean-up --------------------------------------------------------------------------------------------------

  const bandTarget = (): number => {
    const s = desk.suspects[view];
    return s && s.place.type === 'stage' ? cleanStageX(desk, s.place.index) : bandX;
  };

  /** What a screen reader hears at a reading: its file, the question, what the software says, and the choices. */
  const spokenReading = (i: number): string => {
    const v = desk.verdict(i);
    if (v) return `${desk.ask(i).split('.')[0]}. ${v.result} ${v.why}`;
    return `${desk.ask(i)} ${desk.seen(i)} Choose ${options[0].toLowerCase()} or ${options[1].toLowerCase()}. Now on ${options[choice]!.toLowerCase()}.`;
  };

  const arriveAt = (index: number) => {
    view = index;
    fileShown = desk.fileIndexOf(index);
    choice = 0;
    refreshCleanup();
    if (deciding()) {
      lock = DECISION_LOCK;
      host.input.blockRepeats();
    }
    announce(spokenReading(index));
    sfx.play('blip');
  };

  /** File `f` comes up: its header, the switch line (and on a first visit its protocol and its rule), then its first reading. */
  const startFile = (f: number) => {
    const file = desk.files[f];
    if (!file) {
      startChoose();
      return;
    }
    phase = 'intro';
    fileShown = f;
    view = -1;
    banner = null;
    readout.length = 0;
    refreshCs();
    const lead = desk.files.length === 1 ? 'Her file:' : f === 0 ? 'First file:' : 'Next file:';
    const lines = [`${lead} ${file.content.intro}`];
    if (host.firstVisit) lines.push(file.content.protocol, file.content.lensRule);
    announce(plateText(desk, f).replace(/(\d)\/(\d)/, '$1 of $2'));
    host.sayAll(lines, () => {
      if (f === 0) host.rulesRead(); // the brief, the first file's rule and the controls have all been read
      phase = 'cleanup';
      bandX = 0;
      arriveAt(file.first);
      bandX = bandTarget();
    });
  };

  const startBrief = () => {
    if (total === 0) {
      startChoose();
      return;
    }
    if (host.firstVisit) host.sayAll([...content.rules], () => startFile(0));
    else host.say(content.rulesShort, undefined, () => startFile(0));
  };

  const decide = (remove: boolean) => {
    const verdict = desk.decide(view, remove);
    if (!verdict) return;
    sfx.play(verdict.right ? 'correct' : 'wrong');
    lock = DECISION_LOCK;
    refreshCleanup();
    announce(`${remove ? 'Removed' : 'Kept'}. ${verdict.result} ${verdict.why}${csLine !== CS_PENDING && desk.suspects[view]?.file === 'trials' ? ` ${csLine.replace(/KM\/H/, 'km/h').replace(/\/KM/, ' per km').replace(/ M$/, ' m')}.` : ''}`);
  };

  const forward = () => {
    const next = view + 1;
    if (next >= total) {
      startChoose();
      return;
    }
    const f = desk.fileIndexOf(next);
    if (f !== fileShown && next === desk.decided()) startFile(f); // a new file: its header and switch line first
    else arriveAt(next);
  };

  const cleanupInput = (inp: InputState) => {
    if (inp.bPressed && lock === 0) {
      leave();
      return;
    }
    if (deciding()) {
      const step = (inp.upRepeat ? -1 : 0) + (inp.downRepeat ? 1 : 0);
      if (step !== 0) {
        choice = (choice + step + options.length) % options.length;
        sfx.play('blip');
        announce(options[choice]!);
      }
      if (inp.leftPressed && view > 0) {
        arriveAt(view - 1);
        return;
      }
      if (lock > 0) return;
      if (inp.aPressed) decide(choice === 1);
      return;
    }
    // Looking at a reading already decided: LEFT goes further back, A forward
    if (inp.leftPressed && view > 0) {
      arriveAt(view - 1);
      return;
    }
    if (lock > 0) return;
    if (inp.aPressed) forward();
  };

  // ---- Key variables ---------------------------------------------------------------------------------------------

  /** The files are clean: what comes next, then the list. */
  const startChoose = () => {
    phase = 'choose';
    const clean = desk.files.length === 1 ? 'File clean.' : 'Files clean.';
    const lines = [`${clean} ${fillSlots(content.chooseIntro, { N: String(desk.pinLimit) })}`];
    if (host.firstVisit) lines.push(content.keyExample);
    // B here asks before leaving (host.sayAll would quit at once, and there are decisions to lose)
    host.dialogue.showSequence(lines, startPin, leave, { exitLabel: 'QUIT' });
  };

  const startPin = () => {
    phase = 'pin';
    cursor = 0;
    notice = '';
    noticeLeft = 0;
    spoken = -1;
    rest = 0;
    lock = DECISION_LOCK;
    host.input.blockRepeats();
    refreshPin();
  };

  /** A line in the box in place of the row's own, for a moment (a refusal, a nudge). */
  const showNotice = (text: string) => {
    notice = text;
    noticeLeft = NOTICE_TIME;
    refreshPin();
  };

  const slots = (): number => desk.rows().length + (desk.canLock() ? 1 : 0);

  const moveCursor = (step: number) => {
    const n = slots();
    cursor = (cursor + step + n) % n;
    notice = '';
    noticeLeft = 0;
    rest = 0;
    // Locking in cannot be undone: arriving on the row starts its own wait, so a quick A cannot commit unseen
    lockInWait = cursor === desk.rows().length ? DECISION_LOCK : 0;
    sfx.play('blip');
    refreshPin();
  };

  const togglePin = () => {
    const row = desk.rows()[cursor];
    if (!row) return;
    const result = desk.togglePin(row.variable);
    if (result === 'full') {
      sfx.play('wrong');
      showNotice(keyFullLine(desk.pinLimit));
      announce(notice);
      return;
    }
    sfx.play(result === 'pinned' ? 'select' : 'back');
    const allChosen = result === 'pinned' && desk.canLock();
    if (allChosen) {
      // the last one is in: the cursor goes to LOCK IN (which still waits its own moment before A counts)
      cursor = desk.rows().length;
      lockInWait = DECISION_LOCK;
      showNotice(host.input.fill(keysChosenLine(desk.pinLimit)));
    }
    else {
      notice = '';
      noticeLeft = 0;
      refreshPin();
    }
    announce(
      allChosen
        ? `Key variable: ${spokenName(row.shown)}. ${notice}`
        : `${result === 'pinned' ? 'Key variable' : 'Taken out'}: ${spokenName(row.shown)}. ${desk.pins().length} of ${desk.pinLimit} key variables chosen.`,
    );
    // This row has been spoken: the cursor-rest line must not replace the toggle's a step later
    rest = 0;
    spoken = cursor;
    lock = 0.12;
  };

  /** LOCK IN asks first: the choice cannot be changed after. */
  const askLockIn = () => {
    const chosen = desk
      .pins()
      .map(i => desk.rows().find(r => r.variable === i))
      .map(r => (r ? slotText(r.shown) : ''))
      .join(', ');
    sfx.play('select');
    host.dialogue.show(
      fillSlots(content.lockAsk, { N: String(desk.pinLimit) }),
      ['STAY', 'LOCK IN'],
      picked => {
        if (picked === 1) lockIn();
        else lock = DECISION_LOCK;
      },
      () => {
        lock = DECISION_LOCK;
      },
      { exitLabel: 'STAY' },
    );
    host.input.blockRepeats();
    announce(`Your key variables: ${chosen}.`);
  };

  const pinInput = (inp: InputState) => {
    if (inp.bPressed && lock === 0) {
      leave();
      return;
    }
    if (cursor >= slots()) cursor = slots() - 1;
    if (inp.upRepeat) moveCursor(-1);
    else if (inp.downRepeat) moveCursor(1);
    if (lock > 0) return;
    if (inp.aPressed) {
      if (cursor !== desk.rows().length) togglePin();
      else if (lockInWait <= 0) askLockIn();
    }
  };

  // ---- Reveal ----------------------------------------------------------------------------------------------------

  const finish = () => {
    host.complete(desk.result());
  };

  const playReveal = (all: readonly RevealLine[], i: number) => {
    const line = all[i];
    if (!line) {
      finish();
      return;
    }
    explaining = line.variable;
    if (line.kind === 'pinned') marks[line.variable] = line.good ? 'key' : 'notkey';
    else if (line.kind === 'missed') marks[line.variable] = 'missed';
    sfx.play(line.good ? 'correct' : 'wrong');
    // B here skips the explanations and takes the result: the decisions are made, so there is nothing left to lose
    host.dialogue.show(line.text, undefined, () => playReveal(all, i + 1), finish, {
      exitLabel: 'SKIP',
      nextLabel: i === all.length - 1 ? 'DONE' : 'NEXT',
    });
  };

  const lockIn = () => {
    phase = 'reveal';
    pinFrame.locked = true;
    sfx.play('select');
    playReveal(desk.reveal(), 0);
  };

  // ---- The instrument --------------------------------------------------------------------------------------------

  startBrief();

  return {
    update(dt, inp, dialogueBusy) {
      clock += dt;
      // Cosmetic motion runs even while the dialogue has the buttons
      const target = yMaxFor(desk);
      yMax = reduced || Math.abs(target - yMax) < 0.02 ? target : yMax + (target - yMax) * Math.min(1, dt * EASE_Y);
      if (phase === 'cleanup') {
        const goal = bandTarget();
        bandX = reduced || Math.abs(goal - bandX) < 0.5 ? goal : bandX + (goal - bandX) * Math.min(1, dt * EASE_BAND);
      }
      if (noticeLeft > 0) {
        noticeLeft -= dt;
        if (noticeLeft <= 0) {
          noticeLeft = 0;
          notice = '';
          if (phase === 'pin') refreshPin();
        }
      }
      if (phase === 'pin' && !dialogueBusy) {
        // Read the row out once the cursor has rested on it
        rest += dt;
        if (rest >= REST_TIME && spoken !== cursor) {
          spoken = cursor;
          const row = desk.rows()[cursor];
          const group = row ? (row.file === 'lactate' ? content.lactate.group : content.trials.group).replace(/:$/, '').toLowerCase() : '';
          if (row) announce(`${spokenName(row.shown)}, ${group}. ${row.pinned ? 'Key variable. ' : ''}${row.about}${row.odd ? ` ${ODD_NUMBER}` : ''}`);
          else announce(`Lock in your ${desk.pinLimit} key variables.`);
        }
      }

      if (dialogueBusy) return;
      if (lock > 0) lock = Math.max(0, lock - dt);
      if (lockInWait > 0) lockInWait = Math.max(0, lockInWait - dt);
      if (phase === 'cleanup') cleanupInput(inp);
      else if (phase === 'pin') pinInput(inp);
    },

    render(ctx) {
      if (phase === 'pin' || phase === 'reveal' || (phase === 'choose' && total === 0)) {
        pinFrame.cursor = cursor;
        pinFrame.explaining = explaining;
        drawPin(ctx, pinFrame);
        if (phase === 'pin' && !host.dialogue.isActive()) {
          const onLock = cursor === desk.rows().length;
          drawPromptBox(ctx, promptLines, fill(onLock ? HINT_LOCK : HINT_PIN));
        }
        return;
      }
      cleanFrame.file = fileShown;
      cleanFrame.view = phase === 'cleanup' || phase === 'choose' ? view : -1;
      cleanFrame.yMax = yMax;
      cleanFrame.bandX = bandX;
      cleanFrame.banner = banner;
      cleanFrame.csLine = csLine;
      cleanFrame.pulse = !reduced && blink(clock, 0.45) === 1;
      drawCleanup(ctx, cleanFrame);
      if (phase === 'cleanup' && !host.dialogue.isActive()) {
        if (deciding()) {
          drawOptionList(ctx, options, choice);
          drawPromptBox(ctx, promptLines, fill(view > 0 ? HINT_DECIDE : HINT_DECIDE_FIRST));
        } else {
          drawPromptBox(ctx, promptLines, fill(view === total - 1 ? HINT_DONE : view === 0 ? HINT_NEXT_FIRST : HINT_NEXT));
        }
      }
    },

    debug() {
      const d = desk.derived();
      return {
        phase,
        view,
        file: desk.files[fileShown]?.kind ?? null,
        files: desk.files.map(f => f.kind),
        choice: deciding() ? options[choice] : null,
        decided: desk.decided(),
        locked: lock > 0,
        suspects: desk.suspects.map(s => ({
          kind: s.kind,
          real: s.real,
          file: s.file,
          at: `${s.place.type}${s.place.index}`,
          decided: s.decision,
          right: s.decision === null ? null : s.real === (s.decision === 'kept'),
        })),
        cleanScore: desk.cleanScore(),
        pins: desk.pins().map(i => desk.rows().find(r => r.variable === i)?.name),
        pinLimit: desk.pinLimit,
        list: desk.rows().map(r => ({ name: r.name, shown: r.shown, key: r.key, pinned: r.pinned, odd: r.odd, file: r.file })),
        cursor,
        derived: { ...d },
        yMax,
        result: desk.result(),
        optionsTop: OPTIONS_TOP,
        plot: { x: CLEAN_PLOT.x, w: CLEAN_PLOT.w },
      };
    },
  };
};
