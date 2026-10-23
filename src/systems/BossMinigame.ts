// Boss minigames. Each game measures how well the player performs (0-1) and scales it by their showdown
// rating, the ceiling their rooms earned, so perfect play scores exactly the rating. The rival finishes at a
// fixed share of their own ceiling (RIVAL_FACTOR) and the player wins by finishing strictly above that.
// All timing runs on the dt passed to updateMinigame, so pausing the game pauses the bout.

import { consoleLabel, type InputState } from '../engine/Input';
import { sfx } from '../audio/Sfx';
import { GAME_W } from '../render/DialogueBox';
import { drawText, measureText } from '../render/PixelFont';
import { ROOM_KEYS, ROOM_LABEL, ROOM_STAT, type StatKey } from '../state/GameState';

export type MinigameType = 'sprint' | 'strength' | 'endurance' | 'power';

export const MINIGAME_FOR_STAT: Record<StatKey, MinigameType> = {
  speed: 'sprint',
  strength: 'strength',
  endurance: 'endurance',
  power: 'power',
};

export const STAT_LABEL: Record<StatKey, string> = {
  speed: 'SPEED',
  strength: 'STRENGTH',
  endurance: 'ENDURANCE',
  power: 'POWER',
};

/** Hub sign label of the room that raises a stat (e.g. 'TESTING' for speed). */
export const roomLabelForStat = (stat: StatKey): string => {
  const key = ROOM_KEYS.find(k => ROOM_STAT[k] === stat);
  return key ? ROOM_LABEL[key] : '';
};

/** The rival finishes at this share of their ceiling, so it is also the score the player must beat. */
export const RIVAL_FACTOR: Record<MinigameType, number> = {
  sprint: 0.85,
  strength: 0.8,
  endurance: 0.75,
  power: 0.7,
};

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

export const rivalFinalScore = (type: MinigameType, rivalCeiling: number): number =>
  RIVAL_FACTOR[type] * clamp01(rivalCeiling);

// The text colours (ink, good, bad, rivalText) are all >= 4.5:1 on the lavender boss background
export const HUD_COLORS = {
  ink: '#2a1a4a',
  track: '#faf7ff',
  locked: '#cbbfe3',
  player: '#3858a8',
  reached: '#2f9a45',
  rival: '#a83030',
  rivalText: '#8a1f1f',
  good: '#1f6a2c',
  bad: '#8a1f1f',
};

// ---- Tuning ----------------------------------------------------------------
// A that dismissed a dialogue or the countdown must not count as the first mash / tap.
const INPUT_LOCK = 0.3;

const SPRINT_DURATION = 5;
const SPRINT_MASHES = 30; // mashes that fill the bar to the player's rating

const STRENGTH_DURATION = 4;
const STRENGTH_HOLD = 2.5; // seconds of holding that fill the bar to the player's rating

// Endurance: beats land on a fixed grid so the rhythm can be read from the approaching notes
const BEAT_FIRST = 1;
const BEAT_INTERVAL = 0.8;
const BEAT_COUNT = 9;
const BEAT_EARLY = 0.12; // a press this long before the beat still hits
const BEAT_LATE = 0.18; // ...and this long after
const ENDURANCE_DURATION = BEAT_FIRST + (BEAT_COUNT - 1) * BEAT_INTERVAL + BEAT_LATE + 0.42;

const POWER_DURATION = 3;
const POWER_CYCLE = 1.5; // seconds for the cursor to cross the bar
const POWER_LEAD = 0.5; // the sweet spot first comes round this long after GO
const POWER_PERFECT = 0.02; // +/- of the bar that scores the full rating
const POWER_FALLOFF = 3; // accuracy lost per unit of bar away from the perfect zone

export const beatTime = (k: number): number => BEAT_FIRST + k * BEAT_INTERVAL;

type BeatResult = 'pending' | 'hit' | 'miss';

export interface MinigameState {
  type: MinigameType;
  timer: number; // game seconds since GO
  duration: number;
  rating: number; // player's ceiling, 0-1
  rivalCeiling: number;
  target: number; // the rival's final score: the player's score must beat it
  playerScore: number; // live, 0-1
  rivalScore: number; // live; reaches `target` at the end
  complete: boolean;
  won: boolean;
  aHeld: boolean;
  crossed: boolean; // bar has passed the target
  // sprint
  mashCount: number;
  // strength
  holdTimer: number;
  // endurance
  beats: BeatResult[];
  tickIndex: number; // next beat whose tick sound is due
  hits: number;
  missedBeats: number;
  strayMisses: number;
  strayGaps: boolean[]; // per gap between beat windows: a stray miss was already counted
  hitFlash: number;
  missFlash: number;
  beatFlash: number;
  // power
  sweetSpot: number; // 0-1 along the bar
  startPhase: number; // cursor position at GO
  tapProgress: number; // cursor position when A was pressed, -1 until then
}

export const createMinigameState = (
  type: MinigameType,
  playerRating: number,
  rivalCeiling: number,
  rng: () => number = Math.random,
): MinigameState => {
  const sweetSpot = 0.5 + rng() * 0.3;
  const wrap = (v: number) => ((v % 1) + 1) % 1;
  return {
    type,
    timer: 0,
    duration:
      type === 'sprint' ? SPRINT_DURATION
        : type === 'strength' ? STRENGTH_DURATION
          : type === 'endurance' ? ENDURANCE_DURATION
            : POWER_DURATION,
    rating: clamp01(playerRating),
    rivalCeiling: clamp01(rivalCeiling),
    target: rivalFinalScore(type, rivalCeiling),
    playerScore: 0,
    rivalScore: 0,
    complete: false,
    won: false,
    aHeld: false,
    crossed: false,
    mashCount: 0,
    holdTimer: 0,
    beats: Array.from({ length: BEAT_COUNT }, (): BeatResult => 'pending'),
    tickIndex: 0,
    hits: 0,
    missedBeats: 0,
    strayMisses: 0,
    strayGaps: Array.from({ length: BEAT_COUNT + 1 }, () => false),
    hitFlash: 0,
    missFlash: 0,
    beatFlash: 0,
    sweetSpot,
    startPhase: wrap(sweetSpot - POWER_LEAD / POWER_CYCLE),
    tapProgress: -1,
  };
};

const finish = (s: MinigameState): void => {
  s.complete = true;
  s.rivalScore = s.target;
  s.won = s.playerScore > s.target;
};

const powerProgress = (s: MinigameState): number => (s.startPhase + s.timer / POWER_CYCLE) % 1;

/** Half-width (of the bar) of the zone where a tap beats the target; 0 when it can't be won. */
export const powerWinHalf = (s: MinigameState): number => {
  if (s.rating <= s.target) return 0;
  return POWER_PERFECT + (1 - s.target / s.rating) / POWER_FALLOFF;
};

/** Index of the beat whose hit window contains t, or -1. */
const windowAt = (t: number): number => {
  for (let k = 0; k < BEAT_COUNT; k++) {
    if (t >= beatTime(k) - BEAT_EARLY && t <= beatTime(k) + BEAT_LATE) return k;
  }
  return -1;
};

/** Which gap between hit windows t falls in (0 = before the first window, BEAT_COUNT = after the last). */
const gapAt = (t: number): number => {
  let gap = 0;
  for (let k = 0; k < BEAT_COUNT; k++) if (t >= beatTime(k) - BEAT_EARLY) gap++;
  return gap;
};

const updateEndurance = (s: MinigameState, pressed: boolean): void => {
  const t = s.timer;

  while (s.tickIndex < BEAT_COUNT && t >= beatTime(s.tickIndex)) {
    sfx.play('beat');
    s.beatFlash = 0.1;
    s.tickIndex++;
  }

  if (pressed) {
    const k = windowAt(t);
    if (k >= 0) {
      // One press resolves a beat; extra presses inside an already-resolved window are ignored
      if (s.beats[k] === 'pending') {
        s.beats[k] = 'hit';
        s.hits++;
        s.hitFlash = 0.18;
        sfx.play('correct');
      }
    } else {
      const gap = gapAt(t);
      if (!s.strayGaps[gap]) {
        s.strayGaps[gap] = true; // at most one miss per beat interval
        s.strayMisses++;
        s.missFlash = 0.18;
        sfx.play('wrong');
      }
    }
  }

  for (let k = 0; k < BEAT_COUNT; k++) {
    if (s.beats[k] === 'pending' && t > beatTime(k) + BEAT_LATE) {
      s.beats[k] = 'miss'; // each beat is resolved exactly once
      s.missedBeats++;
      s.missFlash = 0.18;
      sfx.play('bump');
    }
  }

  s.playerScore = (s.hits / (BEAT_COUNT + s.strayMisses)) * s.rating;
};

const updatePower = (s: MinigameState, pressed: boolean): void => {
  if (s.tapProgress >= 0 || !pressed) return;
  s.tapProgress = powerProgress(s);
  const off = Math.abs(s.tapProgress - s.sweetSpot);
  const accuracy = clamp01(1 - Math.max(0, off - POWER_PERFECT) * POWER_FALLOFF);
  s.playerScore = accuracy * s.rating;
  finish(s);
  sfx.play(s.won ? 'select' : 'wrong');
};

/** Advance one fixed step. A is ignored for the first INPUT_LOCK seconds after GO. */
export const updateMinigame = (
  s: MinigameState,
  dt: number,
  inp: Pick<InputState, 'a' | 'aPressed'>,
): void => {
  if (s.complete) return;
  s.timer += dt;
  s.aHeld = inp.a;
  s.hitFlash = Math.max(0, s.hitFlash - dt);
  s.missFlash = Math.max(0, s.missFlash - dt);
  s.beatFlash = Math.max(0, s.beatFlash - dt);

  const live = s.timer >= INPUT_LOCK;
  const pressed = live && inp.aPressed;
  const held = live && inp.a;

  switch (s.type) {
    case 'sprint':
      if (pressed) {
        s.mashCount++;
        sfx.play('mash');
      }
      s.playerScore = Math.min(1, s.mashCount / SPRINT_MASHES) * s.rating;
      break;
    case 'strength':
      if (held) s.holdTimer += dt;
      s.playerScore = Math.min(1, s.holdTimer / STRENGTH_HOLD) * s.rating;
      break;
    case 'endurance':
      updateEndurance(s, pressed);
      break;
    case 'power':
      updatePower(s, pressed);
      break;
  }

  // Cue once when the bar passes the target (the rhythm game already sounds on every hit)
  if (!s.crossed && s.playerScore > s.target) {
    s.crossed = true;
    if (s.type === 'sprint' || s.type === 'strength') sfx.play('select');
  }

  if (s.complete) return;
  if (s.type !== 'power') s.rivalScore = s.target * Math.min(1, s.timer / s.duration);
  if (s.timer >= s.duration) {
    if (s.type === 'power') sfx.play('wrong'); // never tapped: no score
    finish(s);
  }
};

/** The bout saw no valid input (no press, or the wrong key), so the result can say how to play. */
export const boutWasIdle = (s: MinigameState): boolean => {
  switch (s.type) {
    case 'sprint':
      return s.mashCount === 0;
    case 'strength':
      return s.holdTimer === 0;
    case 'endurance':
      return s.hits === 0 && s.strayMisses === 0;
    case 'power':
      return s.tapProgress < 0;
  }
};

// ---- Drawing ---------------------------------------------------------------

const BAR_X = 24;
const BAR_W = 208;
const YOU_X = 3; // 'YOU' names the player's bar from the margin to its left (17px wide: 4px clear of the bar)
// Everything is stacked from PROMPT_Y, which sits 4px under the athletes' platforms (they end at y = 75).
// RESULT_Y puts 'YOU WIN!' between the lowest HUD text (ends at y = 139) and the result dialogue box (y = 164).
const PROMPT_Y = 80;
const RESULT_Y = 144;
const TEXT_H = 7; // glyph height

// The glyph beside the prompt names the button, so the prompt itself never has to
export const MINIGAME_PROMPT: Record<MinigameType, string> = {
  sprint: 'TAP FAST!',
  strength: 'HOLD IT DOWN!',
  endurance: 'TAP ON THE BEAT!',
  power: 'TAP AT THE MARK!',
};

// The rules card: how each bout type is played. {A} is filled in with the player's name for the button.
export const MINIGAME_RULES: Record<MinigameType, string> = {
  sprint: 'Tap {A} as fast as you can until the time runs out. Every tap pushes your bar higher.',
  strength: 'Hold {A} down. Your bar rises while you hold it and stops when you let go.',
  endurance: 'Press {A} each time a note reaches the green zone. Taps between notes count as misses.',
  power: 'You get one tap. Press {A} while the cursor is in the green zone: the dark centre scores the most.',
};

/** The same rules in a line, for a bout type the player has already been through. */
export const MINIGAME_RULES_SHORT: Record<MinigameType, string> = {
  sprint: 'Tap {A} as fast as you can.',
  strength: 'Hold {A} down the whole time.',
  endurance: 'Press {A} as each note hits the green zone.',
  power: 'One tap: press {A} in the green zone.',
};

const pct = (v: number): number => Math.round(clamp01(v) * 100);

const fillDisc = (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string): void => {
  ctx.fillStyle = color;
  for (let dy = -r; dy <= r; dy++) {
    const dx = Math.floor(Math.sqrt(r * r + r - dy * dy));
    ctx.fillRect(cx - dx, cy + dy, dx * 2 + 1, 1);
  }
};

// The prompt's button glyph: a console A button, or on a keyboard a key with the same colours
const BUTTON_INK = '#080808';
const BUTTON_FACE = '#b03a8a';
const BUTTON_FACE_HELD = '#5a1a45';
const BUTTON_LABEL = '#f8f8f0';
const A_BUTTON_W = 13;
const A_BUTTON_GAP = 5;
const KEY_H = A_BUTTON_W;
const KEY_PAD = 4; // from the key's edge to its name: 1px border and 3px of air

/** Console-style A button; sinks while the real button is held. */
const drawAButton = (ctx: CanvasRenderingContext2D, cx: number, cy: number, pressed: boolean): void => {
  const dy = pressed ? 1 : 0;
  fillDisc(ctx, cx, cy + dy, 6, BUTTON_INK);
  fillDisc(ctx, cx, cy + dy, 5, pressed ? BUTTON_FACE_HELD : BUTTON_FACE);
  drawText(ctx, 'A', cx - 2, cy - 3 + dy, BUTTON_LABEL);
};

const keycapWidth = (name: string): number => measureText(name) - 1 + KEY_PAD * 2; // -1: the last glyph's trailing gap

/** Keyboard key with its name on it, rounded by one pixel at the corners; sinks while the real key is held. */
const drawKeycap = (ctx: CanvasRenderingContext2D, x: number, cy: number, name: string, pressed: boolean): void => {
  const w = keycapWidth(name);
  const y = cy - (KEY_H - 1) / 2 + (pressed ? 1 : 0);
  ctx.fillStyle = BUTTON_INK;
  ctx.fillRect(x + 1, y, w - 2, KEY_H);
  ctx.fillRect(x, y + 1, w, KEY_H - 2);
  ctx.fillStyle = pressed ? BUTTON_FACE_HELD : BUTTON_FACE;
  ctx.fillRect(x + 2, y + 1, w - 4, KEY_H - 2);
  ctx.fillRect(x + 1, y + 2, w - 2, KEY_H - 4);
  drawText(ctx, name, x + KEY_PAD, y + (KEY_H - TEXT_H) / 2, BUTTON_LABEL);
};

/** Slim outlined bar; `value` is 0-1 of the inner width. */
export const drawMeter = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  value: number,
  fillColor: string,
): void => {
  ctx.fillStyle = HUD_COLORS.ink;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = HUD_COLORS.track;
  ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
  const fillW = Math.round((w - 2) * clamp01(value));
  if (fillW > 0) {
    ctx.fillStyle = fillColor;
    ctx.fillRect(x + 1, y + 1, fillW, h - 2);
  }
};

const barPx = (x: number, w: number, v: number): number => x + 1 + Math.round((w - 2) * clamp01(v));

/** Player's score bar on a 0-100% scale: hatched beyond the rating, marker at the target. */
const drawScoreMeter = (
  ctx: CanvasRenderingContext2D,
  s: MinigameState,
  y: number,
  h: number,
  markerBottom: number,
): void => {
  drawMeter(ctx, BAR_X, y, BAR_W, h, s.playerScore, s.playerScore > s.target ? HUD_COLORS.reached : HUD_COLORS.player);
  drawText(ctx, 'YOU', YOU_X, y + Math.floor((h - TEXT_H) / 2), HUD_COLORS.player);

  // Beyond the rating the athlete can never score: hatch it so the ceiling is visible
  const lockedX = barPx(BAR_X, BAR_W, s.rating);
  ctx.fillStyle = HUD_COLORS.locked;
  for (let x = lockedX; x < BAR_X + BAR_W - 1; x += 2) ctx.fillRect(x, y + 1, 1, h - 2);

  // Marker at the target
  const mx = barPx(BAR_X, BAR_W, s.target);
  ctx.fillStyle = HUD_COLORS.rival;
  ctx.fillRect(mx - 1, y - 3, 2, markerBottom - y + 3);
  ctx.fillRect(mx - 3, y - 4, 6, 2);
  ctx.fillRect(mx - 3, markerBottom, 6, 2);
};

const drawTargetLabel = (ctx: CanvasRenderingContext2D, s: MinigameState, y: number): void => {
  const text = `TARGET ${pct(s.target)}%`;
  const w = measureText(text);
  const mx = barPx(BAR_X, BAR_W, s.target);
  const x = Math.max(BAR_X, Math.min(BAR_X + BAR_W - w, Math.round(mx - w / 2)));
  drawText(ctx, text, x, y, HUD_COLORS.rivalText);
};

const drawPrompt = (ctx: CanvasRenderingContext2D, s: MinigameState, aName: string): void => {
  const text = MINIGAME_PROMPT[s.type];
  const onConsole = aName === consoleLabel('a');
  const glyphW = onConsole ? A_BUTTON_W : keycapWidth(aName);
  const total = glyphW + A_BUTTON_GAP + measureText(text, 2);
  const x0 = Math.round((GAME_W - total) / 2);
  if (onConsole) drawAButton(ctx, x0 + (A_BUTTON_W - 1) / 2, PROMPT_Y + 7, s.aHeld);
  else drawKeycap(ctx, x0, PROMPT_Y + 7, aName, s.aHeld);
  drawText(ctx, text, x0 + glyphW + A_BUTTON_GAP, PROMPT_Y, HUD_COLORS.ink, 2);
};

/** Sprint and strength: one big bar with the rival chasing underneath. */
const drawTimedBar = (ctx: CanvasRenderingContext2D, s: MinigameState): void => {
  const y = PROMPT_Y + 19;
  const h = 16;
  drawScoreMeter(ctx, s, y, h, y + h + 7);
  drawMeter(ctx, BAR_X, y + h + 2, BAR_W, 5, s.rivalScore, HUD_COLORS.rival);
  drawTargetLabel(ctx, s, y + h + 11);
  if (!s.complete) {
    const remaining = Math.max(0, s.duration - s.timer);
    const text = `TIME ${remaining.toFixed(1)}`;
    drawText(ctx, text, Math.round((GAME_W - measureText(text)) / 2), y + h + 22, HUD_COLORS.ink);
  }
};

// Endurance lane: notes travel left and land on the zone at the beat
const LANE_Y = PROMPT_Y + 16;
const LANE_H = 18;
const ZONE_X = BAR_X + 56;
const NOTE_SPEED = 140; // px per second

const drawTrackFrame = (ctx: CanvasRenderingContext2D, frameColor: string): void => {
  ctx.fillStyle = frameColor;
  ctx.fillRect(BAR_X, LANE_Y, BAR_W, LANE_H);
  ctx.fillStyle = HUD_COLORS.track;
  ctx.fillRect(BAR_X + 1, LANE_Y + 1, BAR_W - 2, LANE_H - 2);
};

const drawLane = (ctx: CanvasRenderingContext2D, s: MinigameState): void => {
  drawTrackFrame(ctx, s.missFlash > 0 ? HUD_COLORS.bad : HUD_COLORS.ink);

  // The press window, drawn to scale: a note inside the zone is a hit
  const zl = Math.round(ZONE_X - BEAT_LATE * NOTE_SPEED);
  const zr = Math.round(ZONE_X + BEAT_EARLY * NOTE_SPEED);
  ctx.fillStyle = s.hitFlash > 0 ? '#8fdc9f' : '#cdeed3';
  ctx.fillRect(zl, LANE_Y + 1, zr - zl, LANE_H - 2);
  ctx.fillStyle = HUD_COLORS.good;
  ctx.fillRect(zl, LANE_Y + 1, 1, LANE_H - 2);
  ctx.fillRect(zr - 1, LANE_Y + 1, 1, LANE_H - 2);
  ctx.fillRect(ZONE_X, LANE_Y + 1, s.beatFlash > 0 ? 3 : 1, LANE_H - 2);

  for (let k = 0; k < BEAT_COUNT; k++) {
    const result = s.beats[k];
    if (result === 'hit') continue;
    const x = Math.round(ZONE_X + (beatTime(k) - s.timer) * NOTE_SPEED);
    if (x < BAR_X + 6 || x > BAR_X + BAR_W - 6) continue;
    const color = result === 'miss' ? HUD_COLORS.rival : HUD_COLORS.player;
    ctx.fillStyle = HUD_COLORS.ink;
    ctx.fillRect(x - 5, LANE_Y + 3, 11, 11);
    ctx.fillStyle = color;
    ctx.fillRect(x - 4, LANE_Y + 4, 9, 9);
    ctx.fillStyle = '#f8f8f0';
    ctx.fillRect(x - 2, LANE_Y + 6, 2, 2);
  }
};

const drawEndurance = (ctx: CanvasRenderingContext2D, s: MinigameState): void => {
  drawLane(ctx, s);
  const y = LANE_Y + LANE_H + 5;
  const h = 8;
  const labelY = y + h + 6;
  drawScoreMeter(ctx, s, y, h, y + h + 2);
  drawTargetLabel(ctx, s, labelY);
  drawText(ctx, `HITS ${s.hits}`, BAR_X, labelY, HUD_COLORS.good);
  const miss = `MISS ${s.missedBeats + s.strayMisses}`;
  drawText(ctx, miss, BAR_X + BAR_W - measureText(miss) + 1, labelY, HUD_COLORS.bad);
};

const drawPower = (ctx: CanvasRenderingContext2D, s: MinigameState): void => {
  drawTrackFrame(ctx, HUD_COLORS.ink);

  const span = BAR_W - 8;
  const at = (p: number) => BAR_X + 4 + Math.round(p * span);

  // Tap while the cursor is inside the light zone to beat the target; the dark centre is a perfect hit
  const winHalf = powerWinHalf(s);
  if (winHalf > 0) {
    ctx.fillStyle = '#cdeed3';
    ctx.fillRect(at(s.sweetSpot - winHalf), LANE_Y + 1, at(s.sweetSpot + winHalf) - at(s.sweetSpot - winHalf), LANE_H - 2);
  }
  ctx.fillStyle = HUD_COLORS.good;
  ctx.fillRect(at(s.sweetSpot - POWER_PERFECT), LANE_Y + 1, at(s.sweetSpot + POWER_PERFECT) - at(s.sweetSpot - POWER_PERFECT) + 1, LANE_H - 2);

  const progress = s.tapProgress >= 0 ? s.tapProgress : powerProgress(s);
  const cx = at(progress);
  ctx.fillStyle = s.tapProgress < 0 ? '#080808' : s.won ? HUD_COLORS.good : HUD_COLORS.bad;
  ctx.fillRect(cx - 1, LANE_Y - 1, 3, LANE_H + 2);

  const y = LANE_Y + LANE_H + 5;
  const h = 8;
  drawScoreMeter(ctx, s, y, h, y + h + 2);
  drawTargetLabel(ctx, s, y + h + 6);
};

/** `aName` is what the player calls the A button right now ('A' on the console, 'SPACE' on a keyboard). */
export const renderMinigame = (ctx: CanvasRenderingContext2D, s: MinigameState, aName: string): void => {
  drawPrompt(ctx, s, aName);
  switch (s.type) {
    case 'sprint':
    case 'strength':
      drawTimedBar(ctx, s);
      break;
    case 'endurance':
      drawEndurance(ctx, s);
      break;
    case 'power':
      drawPower(ctx, s);
      break;
  }

  if (s.complete) {
    const text = s.won ? 'YOU WIN!' : 'YOU LOSE!';
    drawText(ctx, text, Math.round((GAME_W - measureText(text, 2)) / 2), RESULT_Y, s.won ? HUD_COLORS.good : HUD_COLORS.bad, 2);
  }
};
