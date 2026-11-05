// RACE TO THE LINE (Distance Running's showdown): the critical speed model behind it, the bout around it, and its
// place in the support scores. Seeded and deterministic.
import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/audio/Sfx', () => ({ sfx: { play: () => {}, isMuted: () => false, toggleMuted: () => {} } }));

const R = await import('../src/systems/RaceModel');
const M = await import('../src/systems/BossMinigame');
const SS = await import('../src/systems/SupportScores');
const { seeded } = await import('./shell/harness');

const DT = 1 / 60;
const TARGET = SS.showdownTarget(3);


/** Run a race to the end, holding A whenever `hold(state)` says so. */
const race = (rating: number, hold: (s: ReturnType<typeof R.createRace>) => boolean, target = TARGET) => {
  const s = R.createRace(rating, target);
  let steps = 0;
  const gauge: number[] = [];
  while (!R.raceOver(s) && steps < 60 * 60) {
    R.stepRace(s, DT, hold(s));
    gauge.push(s.d);
    steps++;
  }
  return { s, steps, gauge, score: R.raceScore(s), won: R.raceWon(s), call: R.kickCall(s) };
};

/** Kick (and hold to the line) from `from` metres to go. */
const kickFrom = (rating: number, from: number) => race(rating, s => R.RACE_M - s.pos <= from);

/** Where an ideal kick starts: the furthest out (to 1 m) that still reaches the line before the gauge runs dry. */
const idealKick = (rating: number): number => {
  let lo = 0;
  let hi = R.RACE_M;
  while (hi - lo > 1) {
    const mid = (lo + hi) / 2;
    if (kickFrom(rating, mid).call === 'early') hi = mid;
    else lo = mid;
  }
  return lo;
};

describe('the race model', () => {
  it('Distance Running plays it, with the same TARGET as the bout it replaces (53%)', () => {
    expect(SS.boutType(3)).toBe('race');
    expect(TARGET).toBeCloseTo(0.525, 6);
    expect(M.MINIGAME_EVENT.race).toBe('RACE TO THE LINE');
    // the classic levels keep their bouts
    expect([0, 1, 2].map(SS.boutType)).toEqual(['sprint', 'strength', 'endurance']);
  });

  it('a well-timed kick at a high rating beats the TARGET and scores the rating', () => {
    for (const rating of [0.7, 0.85, 0.95]) {
      const r = kickFrom(rating, idealKick(rating));
      expect(r.won).toBe(true);
      expect(r.call).toBe('good');
      expect(r.score).toBeGreaterThan(TARGET);
      expect(r.score).toBeLessThanOrEqual(rating);
      expect(r.score).toBeCloseTo(rating, 2);
      expect(r.s.time).toBeLessThan(r.s.rivalTime);
    }
  });

  it('kicking too early empties the gauge before the line: she fades below critical speed and loses', () => {
    const r = race(0.85, s => {
      if (s.faded && !s.surging) expect(s.speed).toBeLessThan(R.CS);
      return R.RACE_M - s.pos <= 4000;
    });
    expect(r.s.faded).toBe(true);
    expect(r.call).toBe('early');
    expect(r.s.emptyToGo).toBeGreaterThan(800);
    expect(r.won).toBe(false);
    expect(r.score).toBeLessThan(TARGET);
  });

  it('kicking late leaves part of the gauge unused at the line, and a slower time than a well-timed kick', () => {
    const r = kickFrom(0.85, R.LAP_M); // at the bell
    expect(r.call).toBe('late');
    expect(R.unusedShare(r.s)).toBeGreaterThan(0.2);
    expect(r.s.time).toBeGreaterThan(kickFrom(0.85, idealKick(0.85)).s.time + 3);
  });

  it('a rating just above the TARGET has to kick: following the rival to the line is a dead heat, and loses', () => {
    const tie = kickFrom(0.55, 2);
    expect(tie.won).toBe(false);
    expect(tie.call).toBe('late');
    expect(tie.s.time).toBeCloseTo(tie.s.rivalTime, 1);
    expect(kickFrom(0.55, 200).won).toBe(true);
  });

  it('the ideal kick is a finishing kick, not a long run for home: inside two laps at a 60-80% rating', () => {
    for (const rating of [0.6, 0.7, 0.8]) {
      expect(idealKick(rating)).toBeGreaterThan(150);
      expect(idealKick(rating)).toBeLessThan(800);
    }
    // her kick is about 21 km/h: a 66-69 s lap
    for (const rating of [0.5, 0.8]) expect(R.LAP_M / R.kickSpeedFor(rating)).toBeGreaterThan(65);
    expect(R.LAP_M / R.kickSpeedFor(0.5)).toBeLessThan(69);
  });

  it('there is a window of kicks that win, wider at a higher rating', () => {
    const window = (rating: number) => {
      let wins = 0;
      for (let from = 0; from <= 3000; from += 20) if (kickFrom(rating, from).won) wins++;
      return wins * 20;
    };
    const low = window(0.6);
    const high = window(0.9);
    expect(low).toBeGreaterThan(0);
    expect(high).toBeGreaterThan(low * 2);
  });

  it('a rating at or below the TARGET cannot win, however the kick is timed', () => {
    for (let from = 0; from <= 2000; from += 25) expect(kickFrom(0.5, from).won).toBe(false);
  });

  it('the rival runs even laps to the bell and a 72 s (20 km/h) last lap, with no early kick', () => {
    const s = R.createRace(0.8, TARGET);
    expect(s.rivalD).toBeCloseTo(TARGET * R.D_PER_RATING, 6);
    expect(R.rivalPosAt(s, s.rivalBellT)).toBeCloseTo(R.BELL_M, 6);
    expect(R.rivalPosAt(s, s.rivalBellT / 2)).toBeCloseTo(R.BELL_M / 2, 6); // even laps
    expect(s.rivalTime - s.rivalBellT).toBeCloseTo(72, 9);
    expect(s.rivalKick * 3.6).toBeCloseTo(20, 9);
    // the even laps (about 79 s) are just faster than Aisha's critical speed (81 s)
    expect(s.rivalPace).toBeGreaterThan(R.CS);
    expect(R.LAP_M / s.rivalPace).toBeGreaterThan(78);
    expect(R.rivalPosAt(s, s.rivalTime)).toBeCloseTo(R.RACE_M, 6);
    expect(R.raceClock(s.rivalTime)).toBe('16:23.5');
    // a runner who finished with the rival would score exactly the TARGET
    expect((R.RACE_M - R.CS * s.rivalTime) / R.D_PER_RATING).toBeCloseTo(TARGET, 9);
  });

  it('the gauge refills only below critical speed, faster the further below, and its size comes from the rating', () => {
    const speeds: number[] = [];
    const r = race(0.8, s => {
      speeds.push(s.speed);
      return Math.floor(s.gameT * 2) % 2 === 0; // on and off: it runs dry, fades and refills
    });
    expect(r.s.faded || r.s.emptyToGo > 0).toBe(true);
    let refilled = 0;
    for (let i = 1; i < r.gauge.length; i++) {
      if (r.gauge[i]! > r.gauge[i - 1]! + 1e-9) {
        refilled++;
        expect(speeds[i + 1] ?? r.s.speed).toBeLessThan(R.CS);
      }
    }
    expect(refilled).toBeGreaterThan(0);
    expect(R.recoveryTau(R.CS * 0.8)).toBeLessThan(R.recoveryTau(R.CS * 0.95));
    expect(R.recoveryTau(R.CS * 0.9)).toBeGreaterThan(300); // minutes of race time, not seconds
    expect(R.createRace(0.9, TARGET).dMax).toBeGreaterThan(R.createRace(0.6, TARGET).dMax);
    expect(R.createRace(0.56, TARGET).dMax).toBeCloseTo(140, 0); // her D prime before the block (meet-running.ts K21)
  });

  it("an idle race sits on the rival's pace to a dead heat: lost, and seen as idle", () => {
    const r = race(0.9, () => false);
    expect(r.won).toBe(false);
    expect(r.s.held).toBe(false);
    expect(r.s.time).toBeCloseTo(r.s.rivalTime, 6);
    const mg = M.createMinigameState('race', 0.9, SS.rivalCeilingFor(3, 'power'));
    while (!mg.complete) M.updateMinigame(mg, DT, { a: false, aPressed: false });
    expect(M.boutWasIdle(mg)).toBe(true);
    expect(mg.won).toBe(false);
  });

  it('lasts 25 to 32 s of play (the last 800 m slower), with a bell exactly once at one lap to go', () => {
    const s = R.createRace(0.8, TARGET);
    const from = idealKick(0.8);
    let bells = 0;
    let laps = 0;
    let steps = 0;
    while (!R.raceOver(s)) {
      R.stepRace(s, DT, R.RACE_M - s.pos <= from);
      if (s.events & R.EV_BELL) {
        bells++;
        expect(s.pos).toBeGreaterThanOrEqual(R.BELL_M);
        expect(s.pos).toBeLessThan(R.BELL_M + 20);
      }
      if (s.events & R.EV_LAP) laps++;
      steps++;
    }
    expect(bells).toBe(1);
    expect(laps).toBe(11); // 200 m, 600 m ... 4200 m; the bell is the twelfth lap line
    expect(steps / 60).toBeGreaterThan(25);
    expect(steps / 60).toBeLessThan(32);
  });

  it('is deterministic, and the score stays within 0..rating whatever is pressed (seeded)', () => {
    for (let seed = 1; seed <= 150; seed++) {
      const rng = seeded(seed);
      const rating = rng();
      const pattern = Array.from({ length: 60 * 30 }, () => rng() < 0.3);
      const a = race(rating, s => pattern[Math.round(s.gameT * 60)] ?? false);
      const b = race(rating, s => pattern[Math.round(s.gameT * 60)] ?? false);
      expect(a.s.time).toBe(b.s.time);
      expect(a.score).toBeGreaterThanOrEqual(0);
      expect(a.score).toBeLessThanOrEqual(rating + 1e-12);
      if (a.won) expect(a.score).toBeGreaterThan(TARGET);
      expect(R.raceOver(a.s)).toBe(true);
    }
  });

  it('the bout keeps the minigame contract: score in 0..rating, a win beats the TARGET', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const rng = seeded(seed * 7);
      const rating = 0.3 + rng() * 0.7;
      const mg = M.createMinigameState('race', rating, SS.rivalCeilingFor(3, 'power'), rng);
      const from = rng() * 2000;
      for (let i = 0; i < 60 * 40 && !mg.complete; i++) {
        const hold = (mg.race?.pos ?? 0) >= R.RACE_M - from;
        M.updateMinigame(mg, DT, { a: hold, aPressed: hold });
      }
      expect(mg.complete).toBe(true);
      expect(mg.target).toBeCloseTo(TARGET, 9);
      expect(mg.playerScore).toBeLessThanOrEqual(mg.rating + 1e-12);
      expect(mg.playerScore).toBeGreaterThanOrEqual(0);
      if (mg.won) expect(mg.playerScore).toBeGreaterThan(mg.target);
      expect(mg.won).toBe(R.raceWon(mg.race!));
    }
  });

  it('the practice straight ends after a few seconds with no score and no winner', () => {
    const mg = M.createMinigameState('race', 0.8, SS.rivalCeilingFor(3, 'power'), Math.random, true);
    let steps = 0;
    while (!mg.complete && steps < 60 * 20) {
      const hold = steps > 60 && steps < 60 * 4; // hold, then let go
      M.updateMinigame(mg, DT, { a: hold, aPressed: steps === 61 });
      steps++;
    }
    expect(steps / 60).toBeCloseTo(R.PRACTICE_TIME, 1);
    expect(mg.playerScore).toBe(0);
    expect(mg.won).toBe(false);
    expect(mg.race?.faded).toBe(true); // 3 s of holding empties the toy gauge
    expect(mg.race?.released).toBe(true);
  });

  it('finishing times read as m:ss.s', () => {
    expect(R.raceClock(R.RACE_M / R.CS)).toBe('16:50.0');
    expect(R.raceClock(61.25)).toBe('1:01.3');
  });
});
