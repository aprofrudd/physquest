// Analysis Room instrument: "Signal or Noise". The board is a ruler for one metric. The player reads how noisy the
// test is (the typical error, a hatched band) and what change is worth having (gold lines), forecasts where the
// athlete will land after a training block, watches the retest drop onto the ruler, and then judges two results:
// the one trained (the last 400 m) and one the Data Room set aside (VO2max).
//
// model.ts holds the rules and the scoring; ruler.ts and board.ts draw; this file is the buttons, the timers and
// the order of things on screen. Timers advance with dt only, so the pause menu freezes everything. Words and
// numbers are worked out when something happens, never while drawing.
import type { InputState } from '../../engine/Input';
import { drawPromptBox } from '../../render/DialogueBox';
import { prefersReducedMotion } from '../../render/motion';
import { sfx } from '../../audio/Sfx';
import { announce } from '../../ui/announce';
import { STAGE, clamp01 } from '../frame';
import type { AnalysisContent } from '../content/types';
import { contentFor } from '../content';
import type { InstrumentFactory, RoomHost, RoomInstrument } from '../types';
import {
  VERDICTS,
  beyondNoise,
  createReview,
  fmt1,
  forecastWords,
  improvementOf,
  pinImprovement,
  plain,
  readoutFor,
  retestSentence,
  scaleFor,
  stepsForHold,
  summaryOf,
  ticksFor,
  titleOf,
  trueVerdict,
  valueFor,
  whyFor,
  worthwhile,
  type Phase,
  type Pick,
  type Retest,
  type Score,
  type Verdict,
} from './model';
import { BAD, FULL, GOOD, INK, drawGhostTick, drawLegend, drawPin, drawRetestDot, drawRuler, xOf, type Reveal } from './ruler';
import {
  FALL,
  FALL_2,
  FIRST_ROW,
  GEOMETRY,
  GEOMETRY_2,
  REPORT_ROW,
  SECOND_ROW,
  drawBaselineLabel,
  drawBlock,
  drawBoardPanel,
  drawChips,
  drawDivider,
  drawGap,
  drawGhostLabel,
  drawReadout,
  drawReport,
  drawStamp,
  drawSummaryLine,
  drawTitleRow,
  drawWeekLabel,
  type ReportItem,
} from './board';

/** A or B pressed this soon after something new appeared is ignored, so a carried-over press decides nothing unseen. */
const LOCK = 0.35;
const WEEK_TIME = 0.25; // one week cell fills
const BLOCK_HOLD = 0.6; // the finished strip stays a moment before the forecast
const DROP_TIME = 0.4; // the retest dot falls onto the ruler
const WHISKER_TIME = 0.4; // and its error bars open
const TEXT_DELAY = 0.8; // the retest sentence waits for the picture
const COLLAPSE_TIME = 0.35; // the finished row folds into one line
const BUILD_TIME = 1.1; // the second ruler builds itself
const SWAP_TIME = COLLAPSE_TIME + BUILD_TIME + DROP_TIME + WHISKER_TIME + 0.5;
const REST = 0.4; // the pin must rest this long before it is read out to a screen reader
const RUSHED = 0.4; // a repeat visit builds the board this much faster

type Step = 'brief' | 'block' | 'forecast' | 'retest' | 'asking' | 'explaining' | 'swap' | 'summary' | 'done';
type Row = 'trained' | 'decoy';

const ease = (p: number): number => p * p;

/**
 * What a page session remembers about this room. The scene only knows the room was opened; a player who left on the
 * first page of the rules has not read them, so the full rules come again until they have been read to the end.
 */
export interface Session {
  rulesRead: boolean;
}

/** The verdict just given, with its two lines ready to draw. */
interface Stamp {
  said: string; // YOU SAID: NOISE
  truth: string; // IT IS: REAL AND WORTH ACTING ON
  right: boolean;
}

/**
 * The instrument for a given content set. `rng` shuffles the verdict lists (tests pass a seeded one); `session` is
 * what earlier visits left behind (by default: the rules were read if the scene says this is not the first visit).
 */
export const createAnalysisInstrument = (
  host: RoomHost,
  content: AnalysisContent,
  rng: () => number,
  session: Session = { rulesRead: !host.firstVisit },
): RoomInstrument => {
  const review = createReview(content, rng);
  const { trained, decoy } = content;
  const rows: Readonly<Record<Row, typeof trained>> = { trained, decoy };
  const scales = { trained: scaleFor(trained), decoy: scaleFor(decoy) } as const;
  const ticks = { trained: ticksFor(trained, scales.trained), decoy: ticksFor(decoy, scales.decoy) } as const;
  const still = prefersReducedMotion();
  const g = GEOMETRY;

  // Words and places, worked out once
  const trainedTitle = titleOf(trained);
  const decoyTitle = `${titleOf(decoy)} ${plain(decoy.baseline)} → ${plain(decoy.retest)}`;
  const trainedSummary = summaryOf(trained);
  const baselineX = xOf(g, scales.trained, 0);
  const historyX = content.history.map(h => xOf(g, scales.trained, h));
  const ghostLabelX = (historyX.length > 0 ? Math.max(...historyX) : baselineX) - 6;
  const blockText = `The ${content.weeks}-week block is under way.`;
  const question = `Where will her ${trained.metric.toLowerCase()} be after the block?`;
  const forecastText = `${question} Move the pin with {LEFT} and {RIGHT}.`;
  const nextText = `Next: ${decoy.metric}, from the Data Room.`;
  const verdictText = (v: Verdict): string => content.verdicts[VERDICTS.indexOf(v)] ?? v;
  const fill = (text: string): string => host.input.fill(text);

  let clock = 0; // seconds since the room opened
  let step: Step = 'brief';
  let lock = 0;
  let judging: Row = 'trained'; // the row on the board for the verdicts
  let finished: Score | null = null;

  // the brief
  let briefT = 0;
  let goldAt = Infinity; // when the gold lines may start (the second text, or soon on a repeat visit)
  const fullRules = (host.firstVisit || !session.rulesRead) && content.rules.length > 0;
  const rushed = !host.firstVisit && session.rulesRead; // a visit after the rules were read: the board builds quickly
  // the block
  let blockT = 0;
  let weeksDone = 0;
  let flash = 0;
  // the forecast
  let held = 0;
  let rest = 0;
  let readout = readoutFor(trained, 0, content.step);
  let litNoise = false;
  let litWorth = false;
  // the retest (and the second row's)
  let retestT = 0;
  let landed = false;
  let texted = false;
  let result: Retest | null = null;
  let gapText = '';
  let swapT = 0;
  let swapLanded = false;
  // the verdicts
  let stamp: Stamp | null = null;
  let trainedRight = false;
  let report: ReportItem[] = [];
  // what is drawn this frame (set by the functions below, so nothing is built while drawing)
  const reveal: Reveal = { axis: 1, pole: 1, trials: [1, 1], band: 1, gold: 1 };
  let dotY = g.axisY;
  let whiskers = 1;

  // ---- leaving ----

  /** After the forecast is locked, walking away loses it: ask first. B on the question means stay. */
  const askLeave = (resume: () => void) =>
    host.dialogue.show(
      'Leave the review? Your forecast will be lost.',
      ['STAY', 'LEAVE'],
      choice => (choice === 1 ? host.quit() : resume()),
      resume,
      { exitLabel: 'STAY' },
    );

  /** A coach line (or question) that B answers with the leave question; `again` shows it afresh if the player stays. */
  const speak = (text: string, choices: string[] | undefined, onDone: (choice?: number) => void, again: () => void) =>
    host.dialogue.show(text, choices, onDone, () => askLeave(again), { exitLabel: 'LEAVE' });

  // ---- the brief ----

  /** When the empty week strip comes in: as the second text mentions the block, or (a repeat visit) as the gold lines do. */
  const stripAt = (): number => (rushed ? Math.max(goldAt, 3.4 * RUSHED) : goldAt);

  /** Builds the first ruler piece by piece: the axis, the pole, the trial dots, the band, then the gold lines. */
  const setBriefReveal = () => {
    const s = rushed ? RUSHED : 1;
    const at = (start: number, length: number) => clamp01((briefT - start * s) / (length * s));
    reveal.axis = at(0, 0.6);
    reveal.pole = at(0.9, 0.4);
    reveal.trials[0] = at(1.5, 0.35);
    reveal.trials[1] = at(2, 0.35);
    reveal.band = at(2.7, 0.7);
    reveal.gold = clamp01((briefT - Math.max(goldAt, 3.4 * s)) / (0.6 * s));
  };

  const setFullReveal = () => {
    reveal.axis = FULL.axis;
    reveal.pole = FULL.pole;
    reveal.trials[0] = 1;
    reveal.trials[1] = 1;
    reveal.band = FULL.band;
    reveal.gold = FULL.gold;
  };

  /** The rules one text at a time (B quits on any of them). The second text is where the gold lines come in. */
  const sayRules = (texts: readonly string[], i: number, onward: () => void) => {
    const last = i >= texts.length - 1;
    if (i === Math.min(1, texts.length - 1)) goldAt = Math.min(goldAt, briefT);
    host.say(texts[i] ?? '', undefined, last ? onward : () => sayRules(texts, i + 1, onward), last ? { exitLabel: 'QUIT', nextLabel: 'READY' } : undefined);
  };

  const startBrief = () => {
    const onward = () => {
      session.rulesRead = true;
      host.rulesRead();
      review.advance();
      startBlock();
    };
    if (fullRules) {
      sayRules(content.rules, 0, onward);
    } else {
      goldAt = 1.4 * RUSHED;
      host.say(content.rulesShort, undefined, onward, { exitLabel: 'QUIT', nextLabel: 'READY' });
    }
  };

  // ---- the block ----

  const startBlock = () => {
    step = 'block';
    lock = LOCK;
    blockT = 0;
    weeksDone = still ? content.weeks : 0;
    announce(blockText);
  };

  const updateBlock = (dt: number, inp: InputState, busy: boolean) => {
    if (!busy && lock <= 0) {
      if (inp.bPressed) return host.quit();
      if (inp.aPressed) return startForecast();
    }
    blockT += dt;
    flash = Math.max(0, flash - dt);
    const done = Math.min(content.weeks, Math.floor(blockT / WEEK_TIME));
    if (!still && done > weeksDone) {
      weeksDone = done;
      flash = 0.12;
      sfx.play('blip');
    }
    if (!still && blockT >= content.weeks * WEEK_TIME + BLOCK_HOLD) startForecast();
  };

  // ---- the forecast ----

  /** The readout and the chips follow the pin: worked out when it moves. */
  const pinMoved = () => {
    const improvement = pinImprovement(review.pin, content.step);
    readout = readoutFor(trained, review.pin, content.step);
    litNoise = beyondNoise(trained, improvement);
    litWorth = worthwhile(trained, improvement);
  };

  /** What a screen reader hears when the pin rests: where it is, and which chips are lit. */
  const forecastSentence = (): string => {
    const lit = litNoise ? (litWorth ? ' Beyond noise. Worthwhile.' : ' Beyond noise.') : ' Inside the noise band.';
    return forecastWords(trained, review.pin, content.step) + lit;
  };

  const startForecast = () => {
    review.advance();
    step = 'forecast';
    lock = LOCK;
    held = 0;
    rest = 0;
    pinMoved();
    host.input.blockRepeats(); // a thumb already on the D-pad must not push the pin
    announce(fill(`${forecastText} {A}: lock in. {B}: quit.`));
  };

  const updateForecast = (dt: number, inp: InputState, busy: boolean) => {
    if (busy) return;
    // The pin answers at once: only the buttons that decide something (A locks in, B leaves) wait out the lock
    const dir = (inp.rightRepeat ? 1 : 0) - (inp.leftRepeat ? 1 : 0);
    held = inp.left !== inp.right ? held + dt : 0;
    if (dir !== 0) {
      if (review.movePin(dir * stepsForHold(held))) {
        pinMoved();
        sfx.play('blip');
        rest = REST;
      } else {
        sfx.play('bump'); // the end of the ruler
      }
    }
    if (rest > 0) {
      rest -= dt;
      if (rest <= 0) announce(forecastSentence());
    }
    if (lock > 0) return;
    if (inp.bPressed) return host.quit(); // nothing is decided yet
    if (inp.aPressed) lockIn();
  };

  const lockIn = () => {
    review.lock();
    result = review.retest();
    if (result) gapText = result.off === 0 ? 'SPOT ON' : `OFF BY ${fmt1(result.off)}`;
    sfx.play('select');
    step = 'retest';
    lock = LOCK; // a second tap on the same press must not skip the retest
    retestT = 0;
    landed = false;
    texted = false;
    announce(`${forecastWords(trained, review.pin, content.step)} Locked in. Retest day.`);
  };

  // ---- the retest ----

  /** The dot's height and whisker length at `since` seconds after the retest started, on the ruler whose axis is `axisY`. */
  const setDot = (since: number, axisY: number, fall: number) => {
    if (still) {
      dotY = axisY;
      whiskers = 1;
      return;
    }
    dotY = Math.round(axisY - fall * (1 - ease(clamp01(since / DROP_TIME))));
    whiskers = clamp01((since - DROP_TIME) / WHISKER_TIME);
  };

  const retestSpeech = (): void => {
    if (!result) return;
    speak(retestSentence(trained, result.forecast, result), undefined, () => startAsking('trained'), retestSpeech);
  };

  /** The dot falls, lands with a thud, opens its error bars; then the sentence says how far off the forecast was. */
  const updateRetest = (dt: number, inp: InputState, busy: boolean) => {
    if (busy) return; // a question or a sentence is up: the picture waits
    if (lock <= 0) {
      if (inp.bPressed) return askLeave(() => {});
      if (inp.aPressed) retestT = Math.max(retestT, DROP_TIME + WHISKER_TIME + TEXT_DELAY); // skip to the sentence
    }
    retestT += dt;
    if (!landed && (still || retestT >= DROP_TIME)) {
      landed = true;
      sfx.play('bump');
    }
    if (!texted && retestT >= (still ? 0.5 : DROP_TIME + WHISKER_TIME + TEXT_DELAY)) {
      texted = true;
      retestSpeech();
    }
  };

  // ---- the verdicts ----

  /** What the board's stamp says, for a screen reader: what the player said, and what was true when it was not that. */
  const stampWords = (made: Pick): string =>
    `You said ${verdictText(made.picked).toLowerCase()}.${made.right ? '' : ` It is ${verdictText(made.truth).toLowerCase()}.`}`;

  const explain = (row: Row): void => {
    const made = review.picks.find(p => p.row === row);
    if (!made) return;
    const text = (made.right ? 'Right. ' : 'Not quite. ') + whyFor(content, rows[row]);
    speak(text, undefined, () => afterVerdict(row), () => explain(row));
    // the box announced the explanation alone: a screen reader needs the stamp too (it is only drawn), so it goes first
    announce(`${stampWords(made)} ${text}`);
  };

  const afterVerdict = (row: Row) => {
    review.advance();
    stamp = null;
    if (row === 'trained') {
      step = 'swap';
      lock = LOCK;
      swapT = 0;
      swapLanded = false;
      announce(nextText);
    } else {
      startSummary();
    }
  };

  function startAsking(row: Row): void {
    if (row === 'trained') review.advance(); // retest to the first verdict
    judging = row;
    step = 'asking';
    stamp = null;
    ask(row);
  }

  const ask = (row: Row): void => {
    const options = review.optionsFor(row).map(verdictText);
    const r = rows[row];
    speak(
      `Judge the result: ${plain(r.baseline)} → ${plain(r.retest)} ${r.unit.toLowerCase()}.`,
      options,
      choice => {
        const made = review.pick(choice ?? 0);
        if (!made) return ask(row); // not a pick the review can take: never leave the player with nothing on screen
        sfx.play(made.right ? 'correct' : 'wrong');
        step = 'explaining';
        stamp = { said: `YOU SAID: ${verdictText(made.picked)}`, truth: `IT IS: ${verdictText(made.truth)}`, right: made.right };
        if (row === 'trained') trainedRight = made.right;
        explain(row);
      },
      () => ask(row),
    );
  };

  /** The second row's ruler builds itself, its retest drops in, and then the question. */
  const updateSwap = (dt: number, inp: InputState, busy: boolean) => {
    if (busy) return;
    if (lock <= 0) {
      if (inp.bPressed) return askLeave(() => {});
      if (inp.aPressed) swapT = Math.max(swapT, SWAP_TIME); // skip to the question
    }
    swapT += dt;
    if (!swapLanded && swapT >= COLLAPSE_TIME + BUILD_TIME + DROP_TIME) {
      swapLanded = true;
      sfx.play('bump');
    }
    if (swapT >= SWAP_TIME) startAsking('decoy');
  };

  // ---- the end ----

  /** The report: the forecast and each verdict, with what was true. */
  const buildReport = (): ReportItem[] => {
    const items: ReportItem[] = [];
    if (result) {
      items.push({
        ok: result.inside,
        head: readoutFor(trained, review.pin, content.step).replace('FORECAST', 'YOUR FORECAST'),
        lines: [{ text: result.off === 0 ? 'SPOT ON' : `${gapText}: ${result.inside ? 'INSIDE' : 'OUTSIDE'} THE ERROR BARS`, color: result.inside ? GOOD : BAD }],
      });
    }
    for (const row of ['trained', 'decoy'] as const) {
      const made = review.picks.find(p => p.row === row);
      const lines: ReportItem['lines'][number][] = [{ text: verdictText(trueVerdict(rows[row])), color: INK }];
      if (made && !made.right) lines.push({ text: `YOU SAID: ${verdictText(made.picked)}`, color: BAD });
      items.push({ ok: made?.right ?? false, head: summaryOf(rows[row]), lines });
    }
    return items;
  };

  const startSummary = () => {
    step = 'summary';
    report = buildReport();
    const insight = host.sport.predictionInsight;
    const finish = () => {
      finished = review.score();
      step = 'done';
      host.complete({ dataQuality: finished.dataQuality, variableAccuracy: finished.variableAccuracy });
    };
    const again = (): void => speak(insight, undefined, finish, again);
    again();
  };

  // ---- drawing ----

  const renderTrained = (ctx: CanvasRenderingContext2D, phase: Phase, withTitle = true) => {
    const row = trained;
    const scale = scales.trained;
    if (step === 'brief') setBriefReveal();
    else setFullReveal();
    const forecasting = phase === 'forecast';
    const showPin = phase === 'forecast' || phase === 'retest' || phase === 'verdict1';
    const showDot = phase === 'verdict1' || (phase === 'retest' && retestT > 0);
    if (phase === 'retest') setDot(retestT, g.axisY, FALL);
    else setDot(Infinity, g.axisY, FALL);

    if (withTitle) drawTitleRow(ctx, trainedTitle, FIRST_ROW.title);
    drawLegend(ctx, FIRST_ROW.legend, reveal.band > 0, reveal.gold > 0, showPin, showDot);
    if (reveal.pole >= 1) drawBaselineLabel(ctx, baselineX);
    drawRuler(ctx, g, row, scale, ticks.trained, content.baselineTrials, reveal);

    if (forecasting) {
      // where the athlete's earlier blocks landed: the evidence for the forecast
      for (const x of historyX) drawGhostTick(ctx, x, g.axisY);
      drawGhostLabel(ctx, ghostLabelX);
    }
    // the dot first, the pin over it: a forecast close to the result keeps its pin while the dot comes down
    if (showDot) drawRetestDot(ctx, g, scale, improvementOf(row), row.te, whiskers, dotY);
    if (showPin) drawPin(ctx, xOf(g, scale, pinImprovement(review.pin, content.step)), g.axisY - 6);

    if (forecasting) {
      drawReadout(ctx, readout, 116);
      drawChips(ctx, 128, litNoise, litWorth);
    }
    if (phase === 'block') {
      drawBlock(ctx, content.weeks, weeksDone, weeksDone / content.weeks, clock, flash > 0);
      drawWeekLabel(ctx, Math.max(1, weeksDone));
    } else if (phase === 'brief' && briefT >= stripAt()) {
      drawBlock(ctx, content.weeks, 0, 0, 0, false); // the block ahead, empty, once the rules mention it
    }
    if (phase === 'retest' && result && whiskers >= 1) drawGap(ctx, g, scale, result.forecast, result.actual, gapText, result.inside, 116);
    if (step === 'explaining' && stamp && judging === 'trained') drawStamp(ctx, stamp.said, stamp.truth, stamp.right, 118);
  };

  const renderDecoy = (ctx: CanvasRenderingContext2D, since: number) => {
    const row = decoy;
    const scale = scales.decoy;
    const g2 = GEOMETRY_2;
    drawSummaryLine(ctx, trainedSummary, trainedRight, SECOND_ROW.summary);
    drawDivider(ctx, 'FROM THE DATA ROOM', SECOND_ROW.divider);
    const build = (start: number, length: number) => clamp01((since - start) / length);
    if (still) {
      setFullReveal();
    } else {
      reveal.axis = build(0, 0.35);
      reveal.pole = build(0.3, 0.25);
      reveal.band = build(0.5, 0.4);
      reveal.gold = build(0.8, 0.3);
    }
    drawTitleRow(ctx, decoyTitle, SECOND_ROW.title);
    setDot(since - BUILD_TIME, g2.axisY, FALL_2);
    const showDot = still || since > BUILD_TIME;
    drawLegend(ctx, SECOND_ROW.legend, reveal.band > 0, reveal.gold > 0, false, showDot);
    drawRuler(ctx, g2, row, scale, ticks.decoy, [], reveal);
    if (showDot) drawRetestDot(ctx, g2, scale, improvementOf(row), row.te, whiskers, dotY);
    if (step === 'explaining' && stamp && judging === 'decoy') drawStamp(ctx, stamp.said, stamp.truth, stamp.right, 118);
  };

  /** The finished first row folds into one line while the second is built under it. */
  const renderSwap = (ctx: CanvasRenderingContext2D) => {
    if (swapT < COLLAPSE_TIME) {
      const shown = Math.max(0, Math.round(STAGE.h * (1 - ease(swapT / COLLAPSE_TIME))));
      ctx.save();
      ctx.beginPath();
      ctx.rect(STAGE.x, STAGE.y, STAGE.w, shown);
      ctx.clip();
      renderTrained(ctx, 'verdict1', false); // as it was when the verdict was given, its title now the summary line
      ctx.restore();
      drawSummaryLine(ctx, trainedSummary, trainedRight, SECOND_ROW.summary);
      return;
    }
    renderDecoy(ctx, swapT - COLLAPSE_TIME);
  };

  const renderReport = (ctx: CanvasRenderingContext2D) => {
    drawDivider(ctx, 'REVIEW', REPORT_ROW.divider);
    drawReport(ctx, report, REPORT_ROW.first);
  };

  /** The fixed text in the dialogue box while nothing is being said: what is going on, and what the buttons do. */
  const drawPrompt = (ctx: CanvasRenderingContext2D) => {
    switch (step) {
      case 'block':
        drawPromptBox(ctx, blockText, fill(still ? '{A}: CONTINUE   {B}: QUIT' : '{A}: SKIP   {B}: QUIT'));
        break;
      case 'forecast':
        drawPromptBox(ctx, fill(forecastText), fill('{A}: LOCK IN   {B}: QUIT'));
        break;
      case 'retest':
        drawPromptBox(ctx, 'Retest day.', fill('{A}: SKIP   {B}: LEAVE'));
        break;
      case 'swap':
        drawPromptBox(ctx, nextText, fill('{A}: SKIP   {B}: LEAVE'));
        break;
      default:
        break;
    }
  };

  const instrument: RoomInstrument = {
    update(dt, inp, busy) {
      clock += dt;
      lock = Math.max(0, lock - dt);
      switch (step) {
        case 'brief':
          briefT += dt;
          break;
        case 'block':
          updateBlock(dt, inp, busy);
          break;
        case 'forecast':
          updateForecast(dt, inp, busy);
          break;
        case 'retest':
          updateRetest(dt, inp, busy);
          break;
        case 'swap':
          updateSwap(dt, inp, busy);
          break;
        default:
          break; // asking, explaining, summary: the dialogue does it all
      }
    },

    render(ctx) {
      drawBoardPanel(ctx);
      if (step === 'swap') renderSwap(ctx);
      else if (step === 'summary' || step === 'done') renderReport(ctx);
      else if (review.phase === 'verdict2') renderDecoy(ctx, Infinity);
      else renderTrained(ctx, review.phase);
      if (!host.dialogue.isActive()) drawPrompt(ctx);
    },

    debug() {
      const score = review.score();
      return {
        phase: review.phase,
        step,
        pin: valueFor(trained, pinImprovement(review.pin, content.step)),
        pinSteps: review.pin,
        forecastImprovement: result ? result.forecast : null,
        c1: result ? score.c1 : null,
        verdicts: review.picks.map(p => ({ row: p.row, picked: p.picked, right: p.right })),
        options: { trained: [...review.optionsFor('trained')], decoy: [...review.optionsFor('decoy')] },
        weeks: weeksDone,
        q: finished ? finished.q : null,
        result: finished ? { dataQuality: finished.dataQuality, variableAccuracy: finished.variableAccuracy } : null,
      };
    },
  };

  startBrief(); // the brief is the first thing said
  return instrument;
};

const sessions = new Map<number, Session>();

/** The session's memory for a level (its rules are the level's own). */
const sessionFor = (level: number): Session => {
  let session = sessions.get(level);
  if (!session) {
    session = { rulesRead: false };
    sessions.set(level, session);
  }
  return session;
};

export const createAnalysisRoom: InstrumentFactory = host => {
  const content = contentFor(host.level)?.analysis;
  if (!content) {
    host.say('This room is being rebuilt. Come back soon!', undefined, () => host.quit());
    return { update() {}, render() {} };
  }
  return createAnalysisInstrument(host, content, Math.random, sessionFor(host.level));
};
