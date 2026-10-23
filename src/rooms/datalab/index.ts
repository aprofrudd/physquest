// Data Lab instrument: the Trace Desk. The player cleans Aisha's test file (remove a glitch, keep real data), then
// pins the variables that should guide her training from the cleaned file. The rules live in model.ts, the
// drawing in views.ts; this file is the part that listens to buttons and talks to the dialogue.
import type { InputState } from '../../engine/Input';
import { announce } from '../../ui/announce';
import { sfx } from '../../audio/Sfx';
import { drawPromptBox, wrapText } from '../../render/DialogueBox';
import { prefersReducedMotion } from '../../render/motion';
import { blink } from '../frame';
import { contentFor } from '../content';
import type { RoomHost, RoomInstrument } from '../types';
import { ODD_NUMBER, createTraceDesk, fmt1, fmt2, pinFullLine, pinsPlacedLine, type RevealLine, type Rng } from './model';
import {
  POOF_TIME,
  cleanStageX,
  drawCleanup,
  drawPin,
  sprintPixel,
  stagePixel,
  yMaxFor,
  type Banner,
  type CleanupFrame,
  type PinFrame,
  type Poof,
  type RevealMark,
} from './views';
import type { Rung } from './ladder';
import { shortLabel } from './names';

type Phase = 'brief' | 'cleanup' | 'pin' | 'reveal';

/** A new decision ignores A, B and RIGHT this long, so a press carried over from the last one decides nothing unseen. */
const DECISION_LOCK = 0.35;
/** The cursor must rest this long before the row it is on is read out. */
const REST_TIME = 0.3;
/** How long a refusal or a hint stays in the box. */
const NOTICE_TIME = 2.4;
const EASE_Y = 9; // per second: how fast the chart re-scales
const EASE_BAND = 16; // per second: how fast the lens band moves to the next suspect
const READOUT_WIDTH = 17; // characters in the verdict beside the lens

const HINT_DECIDE = '{A}: REMOVE   {RIGHT}: KEEP   {B}: QUIT';
const HINT_NEXT = '{A}: NEXT   {LEFT}: BACK   {B}: QUIT';
const HINT_NEXT_FIRST = '{A}: NEXT   {B}: QUIT'; // the first suspect has nothing to look back at
const HINT_DONE = '{A}: CONTINUE   {LEFT}: BACK   {B}: QUIT';
const HINT_PIN = '{A}: PIN   {DPAD}: CHOOSE   {B}: QUIT';
const HINT_LOCK = '{A}: LOCK IN   {B}: QUIT';

const LEAVE_TEXT = 'Leave the data desk? Your clean-up will be lost.';

export const createDataRoom = (host: RoomHost, rng: Rng = Math.random): RoomInstrument => {
  const content = contentFor(host.level)?.data;
  if (!content) {
    // Not reachable through instrumentFor (it checks the content first), but never leave the player stuck
    host.say('This room is being rebuilt. Come back soon!', undefined, () => host.quit());
    return { update() {}, render() {} };
  }
  const desk = createTraceDesk(content, host.sport, rng);
  const reduced = prefersReducedMotion();

  let phase: Phase = 'brief';
  let clock = 0; // seconds since the room opened (only for blinking)
  let lock = 0; // seconds A/B/RIGHT are ignored
  let view = -1; // the suspect under the lens; -1 until the brief has been read
  let cursor = 0; // the pin list's cursor: a row, or the row count for LOCK IN
  let yMax = yMaxFor(desk); // the y range as drawn: eases toward the file's
  let bandX = 0;
  let notice = '';
  let noticeLeft = 0;
  let rest = 0; // seconds the pin cursor has been still
  let spoken = -1; // the cursor row last read out
  let explaining = -1; // the variable the reveal is on
  const marks: (RevealMark | undefined)[] = desk.order.map(() => undefined);
  const poofs: Poof[] = Array.from({ length: 4 }, () => ({ x: 0, y: 0, age: 0, good: true, live: false }));

  // Strings the screens show, built when the state changes (never per frame)
  const readout: string[] = ['', '', ''];
  let banner: Banner | null = null;
  let promptLines: readonly string[] = [];

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

  const cleanFrame: CleanupFrame = { desk, view, yMax, bandX, poofs, readout, banner, pulse: false };
  const pinFrame: PinFrame = { desk, cursor, yMax, rungs: [], marks, locked: false, explaining };

  // ---- Text for the current screen -------------------------------------------------------------------------------

  const total = desk.suspects.length;

  const buildReadout = () => {
    const s = desk.suspects[view];
    if (!s) return;
    readout[0] = `SUSPECT ${view + 1} OF ${total}`;
    if (s.place.type === 'stage') {
      const stage = desk.stages[s.place.index]!;
      readout[1] = `${stage.kmh} KM/H: ${fmt1(stage.mmol)} MMOL/L`;
    } else {
      readout[1] = `SPRINT ${s.place.index + 1}: ${fmt2(desk.sprints[s.place.index]!.time)} S`;
    }
  };

  /** Everything the clean-up screen says about the suspect under the lens. */
  const refreshCleanup = () => {
    const s = desk.suspects[view];
    if (!s) return;
    buildReadout();
    const verdict = desk.verdict(view);
    if (verdict) {
      banner = { lines: wrapText(verdict.result, READOUT_WIDTH), good: verdict.right };
      promptLines = wrapText(verdict.why);
    } else {
      banner = null;
      promptLines = wrapText(desk.seen(view));
    }
  };

  const rowText = (): string => {
    const rows = desk.rows();
    const row = rows[cursor];
    if (!row) {
      // On LOCK IN: a pinned number that looks wrong is worth a last look
      const lock = `Lock in your ${desk.pinLimit} pins and see how you did.`;
      return rows.some(r => r.pinned && r.odd) ? `${lock} ${ODD_NUMBER}` : lock;
    }
    return row.odd && row.about ? `${row.about} ${ODD_NUMBER}` : row.odd ? ODD_NUMBER : row.about;
  };

  const refreshPin = () => {
    promptLines = wrapText(noticeLeft > 0 ? notice : rowText());
  };

  /** The ladder's rungs, from the cleaned file. */
  const buildRungs = (): Rung[] => {
    const d = desk.derived();
    const out: Rung[] = [];
    for (const row of desk.rows()) {
      const label = shortLabel(row.name);
      if (row.feature === 'lt1' && d.lt1Kmh !== null) out.push({ feature: 'lt1', label, kmh: d.lt1Kmh });
      else if (row.feature === 'lt2' && d.lt2Kmh !== null) out.push({ feature: 'lt2', label, kmh: d.lt2Kmh });
      else if (row.feature === 'vvo2max') out.push({ feature: 'vvo2max', label, kmh: d.vvo2Kmh });
      else if (row.feature === 'sprint') out.push({ feature: 'sprint', label, kmh: Math.round(d.sprintKmh) }); // whole km/h, like its name
    }
    return out;
  };

  // ---- Leaving ---------------------------------------------------------------------------------------------------

  /** B: nothing decided yet leaves at once; after that it asks first (B again stays). */
  const leave = () => {
    if (phase === 'brief' || desk.decided() === 0) {
      host.quit();
      return;
    }
    sfx.play('back');
    host.dialogue.show(
      LEAVE_TEXT,
      ['STAY', 'LEAVE'],
      choice => {
        if (choice === 1) host.quit();
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

  const arriveAt = (index: number, fresh: boolean) => {
    view = index;
    refreshCleanup();
    if (fresh) {
      lock = DECISION_LOCK;
      announce(desk.seen(view));
    } else {
      const v = desk.verdict(view);
      announce(`Suspect ${view + 1} of ${total}. ${v ? `${v.result} ${v.why}` : desk.seen(view)}`);
    }
    sfx.play('blip');
  };

  const startCleanup = () => {
    phase = 'cleanup';
    view = 0;
    bandX = bandTarget();
    refreshCleanup();
    lock = DECISION_LOCK;
    // The rule the lens teaches is said once, the first time the clean-up starts; the first suspect is read out after it
    if (host.firstVisit) {
      host.say(content.lensRule, undefined, () => {
        host.rulesRead(); // the brief and the lens rule have both been read
        lock = DECISION_LOCK;
        announce(desk.seen(view));
      });
    } else {
      announce(desk.seen(view));
    }
  };

  const startBrief = () => {
    if (host.firstVisit) host.sayAll([content.protocol, ...content.rules], startCleanup);
    else host.say(content.rulesShort, undefined, startCleanup);
  };

  const decide = (remove: boolean) => {
    const suspect = desk.suspects[view]!;
    const where = suspect.place;
    const before = where.type === 'stage' ? stagePixel(desk, where.index, yMax) : sprintPixel(where.index);
    const verdict = desk.decide(view, remove);
    if (!verdict) return;
    sfx.play(verdict.right ? 'correct' : 'wrong');
    if (remove && before && !reduced) {
      const p = poofs.find(q => !q.live);
      if (p) {
        p.x = before.x;
        p.y = before.y;
        p.age = 0;
        p.good = verdict.right;
        p.live = true;
      }
    }
    lock = DECISION_LOCK;
    refreshCleanup();
    announce(`${verdict.result} ${verdict.why}`);
  };

  const forward = () => {
    if (view + 1 < total) {
      arriveAt(view + 1, view + 1 === desk.decided());
    } else {
      startPin();
    }
  };

  const cleanupInput = (inp: InputState) => {
    if (inp.bPressed && lock === 0) {
      leave();
      return;
    }
    const deciding = view === desk.decided() && view < total;
    if (deciding) {
      if (lock > 0) return;
      if (inp.aPressed) decide(true);
      else if (inp.rightPressed) decide(false);
      else if (inp.leftPressed && view > 0) arriveAt(view - 1, false);
      return;
    }
    // Looking at a suspect already decided: LEFT goes further back, A or RIGHT forward
    if (inp.leftPressed && view > 0) {
      arriveAt(view - 1, false);
      return;
    }
    if (lock > 0) return;
    if (inp.aPressed || inp.rightPressed) forward();
  };

  // ---- Pin -------------------------------------------------------------------------------------------------------

  const startPin = () => {
    phase = 'pin';
    cursor = 0;
    pinFrame.rungs = buildRungs();
    notice = '';
    noticeLeft = 0;
    spoken = -1;
    rest = 0;
    lock = DECISION_LOCK;
    host.input.blockRepeats();
    refreshPin();
    // The room's question, said the first time the pin list appears
    const ask = content.rules[content.rules.length - 1];
    if (ask && host.firstVisit) {
      // B here asks before leaving (host.say would quit at once, and there are decisions to lose)
      host.dialogue.show(
        ask,
        undefined,
        () => {
          lock = DECISION_LOCK;
        },
        leave,
        { exitLabel: 'QUIT' },
      );
    }
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
    sfx.play('blip');
    refreshPin();
  };

  const togglePin = () => {
    const row = desk.rows()[cursor];
    if (!row) return;
    const result = desk.togglePin(row.variable);
    if (result === 'full') {
      sfx.play('wrong');
      showNotice(pinFullLine(desk.pinLimit));
      announce(notice);
      return;
    }
    sfx.play(result === 'pinned' ? 'select' : 'back');
    if (result === 'pinned' && desk.canLock()) showNotice(host.input.fill(pinsPlacedLine(desk.pinLimit)));
    else {
      notice = '';
      noticeLeft = 0;
      refreshPin();
    }
    announce(`${result === 'pinned' ? 'Pinned' : 'Unpinned'}: ${row.shown}. ${desk.pins().length} of ${desk.pinLimit} pins used.`);
    lock = 0.12;
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
      if (cursor === desk.rows().length) lockIn();
      else togglePin();
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
      for (const p of poofs) {
        if (!p.live) continue;
        p.age += dt;
        if (p.age >= POOF_TIME) p.live = false;
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
          if (row) announce(`${row.shown}. ${row.pinned ? 'Pinned. ' : ''}${row.about}${row.odd ? ` ${ODD_NUMBER}` : ''}`);
          else announce(`Lock in your ${desk.pinLimit} pins.`);
        }
      }

      if (dialogueBusy) return;
      if (lock > 0) lock = Math.max(0, lock - dt);
      if (phase === 'cleanup') cleanupInput(inp);
      else if (phase === 'pin') pinInput(inp);
    },

    render(ctx) {
      if (phase === 'pin' || phase === 'reveal') {
        pinFrame.cursor = cursor;
        pinFrame.yMax = yMax;
        pinFrame.explaining = explaining;
        drawPin(ctx, pinFrame);
        if (phase === 'pin' && !host.dialogue.isActive()) {
          const onLock = cursor === desk.rows().length;
          drawPromptBox(ctx, promptLines, fill(onLock ? HINT_LOCK : HINT_PIN));
        }
        return;
      }
      cleanFrame.view = phase === 'brief' ? -1 : view;
      cleanFrame.yMax = yMax;
      cleanFrame.bandX = bandX;
      cleanFrame.banner = banner;
      cleanFrame.pulse = !reduced && blink(clock, 0.45) === 1;
      readout[2] = phase === 'cleanup' && !banner && desk.decided() > 0 && view > 0 ? fill('{LEFT}: LOOK BACK') : '';
      drawCleanup(ctx, cleanFrame);
      if (phase === 'cleanup' && !host.dialogue.isActive()) {
        const deciding = view === desk.decided() && view < total;
        const hint = deciding ? HINT_DECIDE : view === total - 1 ? HINT_DONE : view === 0 ? HINT_NEXT_FIRST : HINT_NEXT;
        drawPromptBox(ctx, promptLines, fill(hint));
      }
    },

    debug() {
      const d = desk.derived();
      return {
        phase,
        view,
        decided: desk.decided(),
        locked: lock > 0,
        suspects: desk.suspects.map(s => ({
          kind: s.kind,
          real: s.real,
          at: `${s.place.type}${s.place.index}`,
          decided: s.decision,
          right: s.decision === null ? null : s.real === (s.decision === 'kept'),
        })),
        cleanScore: desk.cleanScore(),
        pins: desk.pins().map(i => desk.rows().find(r => r.variable === i)?.name),
        list: desk.rows().map(r => ({ name: r.name, shown: r.shown, key: r.key, pinned: r.pinned, odd: r.odd })),
        cursor,
        derived: {
          lt1Kmh: d.lt1Kmh,
          lt2Kmh: d.lt2Kmh,
          lt1Pace: d.lt1Pace,
          lt2Pace: d.lt2Pace,
          vvo2Kmh: d.vvo2Kmh,
          sprintKmh: d.sprintKmh,
        },
        yMax,
        result: desk.result(),
      };
    },
  };
};
