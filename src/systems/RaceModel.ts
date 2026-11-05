// RACE TO THE LINE (Distance Running's showdown): a compressed 5000 m, 12.5 laps, against the rival's runner.
//
// The science is the critical speed model. Above her critical speed (CS) Aisha spends D' (D prime), the KICK gauge:
// (speed - CS) metres of it every second. Below CS it refills, faster the further below CS she runs and slower as it
// nears full (Skiba's W' balance, with the recovery time constant 546 e^(-0.01 DCP) + 316 s and DCP, the watts below
// critical power, taken as the share below CS x RECOVERY_W).
//
// The rival runs as elite 5000 m fields do (Filipas et al. 2019, Front Sports Act Living, Figure 3): even laps, no
// early kick, and the last lap at about 20 km/h (RIVAL_LAST_LAP s). Their even laps are set so they finish in the
// time that scores the TARGET, and are faster than Aisha's CS, so sitting on their shoulder (A up) costs her
// exactly TARGET x D_PER_RATING of D' by the line. Holding A kicks at her kick speed and drains the gauge fast;
// letting go she sits on the rival's pace again (and holds any gap). Empty, she fades below CS and the gauge refills
// slowly; at RECOVER_SHARE she can run with the pace again.
//
// A runner who never drops below CS and spends all of D' by the line finishes in (5000 - D') / CS. So the score is
// the distance she gained on an even run at CS, over D_PER_RATING: her gauge is rating x D_PER_RATING, so a well-run
// race scores the rating, and she beats the rival's runner only with a rating above the TARGET: kicking too early
// (the gauge runs dry and she fades) loses, and kicking late leaves some of the gauge unused at the line.
//
// Pure: no sound, no drawing, no allocation per step. Times are race seconds (TIME_SCALE of them per game second,
// FINAL_TIME_SCALE over the last FINAL_M, so the finish plays slower).

export const RACE_M = 5000;
export const LAP_M = 400;
export const LAPS = RACE_M / LAP_M; // 12.5
export const BELL_M = RACE_M - LAP_M; // the bell: one lap to go
/** Lap lines before the finish: 200 m, 600 m, ... 4600 m (the bell). */
export const LAP_LINES = 12;
/** Aisha's critical speed, m/s: 3:22/km, the Data Lab's critical speed trials (meet-running.ts K21). */
export const CS = 1000 / 202;
/** Race seconds per game second for most of the race... */
export const TIME_SCALE = 44;
/** ... and over the last FINAL_M metres (Aisha's), where the kick is decided. */
export const FINAL_TIME_SCALE = 16;
export const FINAL_M = 800;
/** Metres of D' per unit of rating: a 56% rating is the 140 m D' her trials found before the block. */
export const D_PER_RATING = 250;
/** Kick speed, m/s: KICK_BASE + KICK_PER_RATING x rating (about 21 km/h, a 68 s lap, at a 60% rating). */
export const KICK_BASE = 5.7;
export const KICK_PER_RATING = 0.3;
/** The rival's last lap, race seconds (20 km/h). */
export const RIVAL_LAST_LAP = 72;
/** With the gauge empty she fades to this share of CS... */
export const FADE_SHARE = 0.9;
/** ... until it has refilled to this share, when she can run with the pace again. */
export const RECOVER_SHARE = 0.25;
/** Watts per unit share below CS, for the recovery time constant (a 55 kg runner's critical power is about this). */
export const RECOVERY_W = 250;

// Practice straight: no rival, no finish; a small gauge that empties after PRACTICE_GAUGE_S game seconds of holding.
// Let go she runs at CS.
export const PRACTICE_TIME = 6; // game seconds
const PRACTICE_GAUGE_S = 1.6;

// Events of the last step (bit flags), for sound and screen readers
export const EV_LAP = 1; // Aisha crossed a lap line (not the bell's)
export const EV_BELL = 2; // Aisha reached the bell
export const EV_EMPTY = 4; // the gauge ran dry
export const EV_KICK = 8; // she started a surge (A down with gauge left)
export const EV_FINISH = 16; // Aisha crossed the line
export const EV_PASS = 32; // the lead changed

export type KickCall = 'good' | 'early' | 'late';

export interface RaceState {
  practice: boolean;
  rating: number; // 0-1
  target: number; // the rival's score, 0-1
  t: number; // race seconds since the gun
  gameT: number; // game seconds since the gun
  pos: number; // Aisha's metres
  speed: number; // her speed in the last step, m/s
  dMax: number; // her gauge's size, m of D'
  d: number; // left in the gauge
  kick: number; // her kick speed, m/s
  surging: boolean; // A held with gauge left
  faded: boolean; // the gauge ran dry and has not refilled to RECOVER_SHARE
  emptyToGo: number; // metres to go when the gauge first ran dry (-1: it never did)
  finished: boolean;
  time: number; // her finishing time, race seconds (-1 until she finishes)
  rivalPos: number;
  rivalD: number; // the D' the rival's race costs a runner with Aisha's CS (TARGET x D_PER_RATING)
  rivalPace: number; // the rival's even laps to the bell, m/s
  rivalKick: number; // the rival's last-lap speed, m/s
  rivalBellT: number; // race seconds when the rival reaches the bell
  rivalTime: number; // the rival's finishing time, race seconds (known from the gun)
  laps: number; // lap lines Aisha has crossed (the first is at 200 m, the last the bell's)
  bell: boolean;
  held: boolean; // A was held (after the input lock) at some point: not an idle race
  heldTime: number; // game seconds of A held (practice)
  released: boolean; // let go of A after holding it (practice)
  leader: 0 | 1 | -1; // 0 Aisha, 1 the rival, -1 level
  events: number;
}

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

export const kickSpeedFor = (rating: number): number => KICK_BASE + KICK_PER_RATING * clamp01(rating);

/** Race seconds for the rival to finish: the time a runner with Aisha's CS reaches by spending TARGET x D_PER_RATING. */
export const rivalTimeFor = (target: number): number => (RACE_M - clamp01(target) * D_PER_RATING) / CS;

/** The D' recovery time constant (race seconds) at speed v below CS. */
export const recoveryTau = (v: number): number => 546 * Math.exp((-0.01 * RECOVERY_W * Math.max(0, CS - v)) / CS) + 316;

export const createRace = (rating: number, target: number, practice = false): RaceState => {
  const r = clamp01(rating);
  const tg = clamp01(target);
  const kick = kickSpeedFor(r);
  const dMax = practice ? (kick - CS) * TIME_SCALE * PRACTICE_GAUGE_S : r * D_PER_RATING;
  const rivalTime = rivalTimeFor(tg);
  const rivalBellT = rivalTime - RIVAL_LAST_LAP;
  return {
    practice,
    rating: r,
    target: tg,
    t: 0,
    gameT: 0,
    pos: 0,
    speed: CS,
    dMax,
    d: dMax,
    kick,
    surging: false,
    faded: dMax <= 0,
    emptyToGo: -1,
    finished: false,
    time: -1,
    rivalPos: 0,
    rivalD: practice ? 0 : tg * D_PER_RATING,
    rivalPace: BELL_M / rivalBellT,
    rivalKick: LAP_M / RIVAL_LAST_LAP,
    rivalBellT,
    rivalTime,
    laps: 0,
    bell: false,
    held: false,
    heldTime: 0,
    released: false,
    leader: -1,
    events: 0,
  };
};

/** The rival's metres at race time t (even laps to the bell, then the last lap at 20 km/h). */
export const rivalPosAt = (s: RaceState, t: number): number => {
  if (s.practice) return 0;
  if (t <= s.rivalBellT) return s.rivalPace * t;
  return Math.min(RACE_M, BELL_M + s.rivalKick * (t - s.rivalBellT));
};

/** The rival's speed at race time t (0 once over the line). */
export const rivalSpeedAt = (s: RaceState, t: number): number =>
  t < s.rivalBellT ? s.rivalPace : t < s.rivalTime ? s.rivalKick : 0;

/** The lap line Aisha crosses next (200 m, 600 m, ... 4600 m is the bell). */
const lapLine = (k: number): number => LAP_M / 2 + k * LAP_M;

/** Advance one game step. `hold`: A is down (and past the input lock). */
export const stepRace = (s: RaceState, gameDt: number, hold: boolean): void => {
  s.events = 0;
  if (s.practice ? s.gameT >= PRACTICE_TIME : s.finished && s.t >= s.rivalTime) return;
  s.gameT += gameDt;
  if (hold) {
    s.held = true;
    s.heldTime += gameDt;
  } else if (s.held) {
    s.released = true;
  }

  const wasSurging = s.surging;
  let rem = gameDt * (!s.practice && s.pos >= RACE_M - FINAL_M ? FINAL_TIME_SCALE : TIME_SCALE);
  if (s.finished) {
    s.t = Math.min(s.rivalTime, s.t + rem); // she is over the line: the clock runs on for the rival
    rem = 0;
  }
  s.surging = false;
  // Split the step where the gauge runs dry, where the rival changes pace and where she reaches the line, so every
  // race is exact
  for (let guard = 0; rem > 1e-9 && guard < 6; guard++) {
    let v: number;
    let seg = rem;
    if (hold && s.d > 0) {
      v = s.kick;
      s.surging = true;
    } else if (s.faded) {
      v = CS * FADE_SHARE;
    } else if (s.practice) {
      v = CS;
    } else {
      v = rivalSpeedAt(s, s.t) || CS; // on the rival's pace (CS once they are over the line)
      if (s.t < s.rivalBellT) seg = Math.min(seg, s.rivalBellT - s.t);
      else if (s.t < s.rivalTime) seg = Math.min(seg, s.rivalTime - s.t);
    }
    const drain = v - CS;
    if (drain > 0) seg = Math.min(seg, s.d / drain);
    s.speed = v;
    if (!s.practice) {
      const toLine = (RACE_M - s.pos) / v;
      if (toLine <= seg) seg = toLine;
    }
    s.pos += v * seg;
    s.t += seg;
    rem -= seg;
    if (drain > 0) {
      s.d -= drain * seg;
      if (s.d <= 1e-9) {
        s.d = 0;
        s.faded = true;
        if (s.emptyToGo < 0) s.emptyToGo = Math.max(0, RACE_M - s.pos);
        s.events |= EV_EMPTY;
      }
    } else if (drain < 0 && s.d < s.dMax) {
      s.d = s.dMax - (s.dMax - s.d) * Math.exp(-seg / recoveryTau(v));
      if (s.faded && s.d >= RECOVER_SHARE * s.dMax) s.faded = false;
    }
    if (!s.practice && s.pos >= RACE_M - 1e-9) {
      s.pos = RACE_M;
      s.time = s.t;
      s.finished = true;
      s.events |= EV_FINISH;
      s.t = Math.min(s.rivalTime, s.t + rem); // ... and runs on for the rival
      rem = 0;
    }
  }
  if (s.surging && !wasSurging) s.events |= EV_KICK;

  if (!s.practice) {
    while (s.laps < LAP_LINES && s.pos >= lapLine(s.laps)) {
      s.laps++;
      if (lapLine(s.laps - 1) === BELL_M) {
        s.bell = true;
        s.events |= EV_BELL;
      } else {
        s.events |= EV_LAP;
      }
    }
    s.rivalPos = rivalPosAt(s, s.t);
    const gap = s.pos - s.rivalPos;
    const leader: 0 | 1 | -1 = gap > 0.5 ? 0 : gap < -0.5 ? 1 : s.leader;
    if (leader !== s.leader && s.leader !== -1 && s.pos > LAP_M / 2) s.events |= EV_PASS;
    s.leader = leader;
  }
};

/** The race is over: Aisha and the rival are both over the line (practice: its time is up). */
export const raceOver = (s: RaceState): boolean => (s.practice ? s.gameT >= PRACTICE_TIME : s.finished && s.t >= s.rivalTime);

/** Her score, 0..rating: the metres gained on an even run at CS, over D_PER_RATING (0 before she finishes). */
export const raceScore = (s: RaceState): number => {
  if (!s.finished || s.practice) return 0;
  return Math.max(0, Math.min(s.rating, (RACE_M - CS * s.time) / D_PER_RATING));
};

/** Race seconds she must be ahead by to win: following the rival to the line is a dead heat, not a win. */
export const WIN_MARGIN = 0.05;

/** She beat the rival's runner to the line (the same as scoring above the TARGET). */
export const raceWon = (s: RaceState): boolean => s.finished && s.time < s.rivalTime - WIN_MARGIN;

/** How the kick went: the gauge ran dry before the line (early), some was left at the line (late), or it was spent well. */
export const kickCall = (s: RaceState): KickCall => {
  if (s.emptyToGo > 0.5) return 'early';
  if (s.dMax > 0 && s.d / s.dMax > 0.02) return 'late';
  return 'good';
};

/** Share of the gauge left at the line, 0-1. */
export const unusedShare = (s: RaceState): number => (s.dMax > 0 ? clamp01(s.d / s.dMax) : 0);

/** A race time (race seconds) as m:ss.s. */
export const raceClock = (t: number): string => {
  const tenths = Math.round(Math.max(0, t) * 10);
  const min = Math.floor(tenths / 600);
  const sec = (tenths - min * 600) / 10;
  return `${min}:${sec < 10 ? '0' : ''}${sec.toFixed(1)}`;
};
