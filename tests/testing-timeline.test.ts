// What happens when, on the test stage: stages, trials, the fading all-out effort, shuttles, and the chart.
import { describe, expect, it } from 'vitest';
import {
  BEEP_TIMES,
  SHUTTLE_LEVELS,
  calmPreviewU,
  cycleAt,
  effortProfile,
  profileColumns,
  readoutAt,
  shuttleAt,
  stageAt,
  trialAt,
  trialCountOf,
  trialDistance,
} from '../src/rooms/testing/timeline';

const sweep = (steps = 400): number[] => Array.from({ length: steps + 1 }, (_, i) => i / steps);

describe('incremental stages', () => {
  it('walks through every stage in order and each is faster than the last', () => {
    let last = -1;
    const speeds: number[] = [];
    for (const u of sweep()) {
      const at = stageAt(u, 7);
      expect(at.stage).toBeGreaterThanOrEqual(last);
      if (at.stage !== last) speeds.push(at.speed);
      last = at.stage;
    }
    expect(last).toBe(6);
    expect(speeds).toHaveLength(7);
    for (let i = 1; i < speeds.length; i++) expect(speeds[i]!).toBeGreaterThan(speeds[i - 1]!);
  });

  it('keeps the belt travelling forward, never jumping at a stage change', () => {
    let last = 0;
    for (const u of sweep(2000)) {
      const travel = stageAt(u, 7).travel;
      expect(travel).toBeGreaterThanOrEqual(last - 1e-12);
      expect(travel - last).toBeLessThan(0.01);
      last = travel;
    }
  });

  it('takes a fingertip sample only in the last stretch of a stage', () => {
    expect(stageAt(0.01, 7).sample).toBe(0);
    expect(stageAt(0.5 / 7, 7).sample).toBe(0);
    expect(stageAt(0.9 / 7, 7).sample).toBeGreaterThan(0);
    expect(stageAt(1, 7).sample).toBeGreaterThan(0.99);
  });

  it('clamps u and copes with one stage or none', () => {
    expect(stageAt(-1, 7).stage).toBe(0);
    expect(stageAt(2, 7).stage).toBe(6);
    expect(stageAt(0.5, 0).stage).toBe(0);
  });
});

describe('separate trials', () => {
  it('runs, rests, runs, rests, runs, then holds, in that order', () => {
    const seen: string[] = [];
    for (const u of sweep()) {
      const at = trialAt(u, 3);
      const tag = `${at.phase}${at.trial}`;
      if (seen[seen.length - 1] !== tag) seen.push(tag);
    }
    expect(seen).toEqual(['run0', 'rest0', 'run1', 'rest1', 'run2', 'end2']);
  });

  it('makes each trial longer than the one before, over a longer distance', () => {
    const lengths = [0, 0, 0];
    for (const u of sweep(4000)) {
      const at = trialAt(u, 3);
      if (at.phase === 'run') lengths[at.trial]! += 1;
    }
    expect(lengths[1]!).toBeGreaterThan(lengths[0]!);
    expect(lengths[2]!).toBeGreaterThan(lengths[1]!);
    expect(trialDistance(0, 3)).toBeLessThan(trialDistance(1, 3));
    expect(trialDistance(1, 3)).toBeLessThan(trialDistance(2, 3));
    expect(trialDistance(2, 3)).toBe(1);
  });

  it('has within run 0-1 inside every part and a single trial goes the whole way', () => {
    for (const u of sweep()) {
      const at = trialAt(u, 3);
      expect(at.within).toBeGreaterThanOrEqual(0);
      expect(at.within).toBeLessThanOrEqual(1);
    }
    expect(trialAt(0.1, 1).distance).toBe(1);
  });

  it('reads the number of trials from the chips', () => {
    expect(trialCountOf(['RUN', '3 TRIALS', 'ALL-OUT'])).toBe(3);
    expect(trialCountOf(['RUN', '5 TRIALS', 'ALL-OUT'])).toBe(5);
    expect(trialCountOf(['RUN', 'STAGES', 'LACTATE'])).toBe(3);
  });
});

describe('the fading all-out effort', () => {
  it('starts at full effort and fades without rising again', () => {
    expect(cycleAt(0).power).toBeCloseTo(1, 9);
    let last = 2;
    for (const u of sweep()) {
      const { power } = cycleAt(u);
      expect(power).toBeLessThanOrEqual(last + 1e-12);
      last = power;
    }
    expect(cycleAt(1).power).toBeGreaterThan(0.3);
    expect(cycleAt(1).power).toBeLessThan(0.5);
  });

  it('keeps the flywheel turning forward, slower and slower', () => {
    let lastAngle = 0;
    let lastStep = Infinity;
    for (let i = 1; i <= 20; i++) {
      const step = cycleAt(i / 20).angle - cycleAt((i - 1) / 20).angle;
      expect(step).toBeGreaterThan(0);
      expect(step).toBeLessThanOrEqual(lastStep + 1e-9);
      lastStep = step;
      lastAngle = cycleAt(i / 20).angle;
    }
    expect(lastAngle).toBeGreaterThan(20);
  });
});

describe('shuttles that quicken until she stops', () => {
  it('goes up a level each shuttle, 1 to 6, and quickens', () => {
    const starts: number[] = [];
    let last = 0;
    for (const u of sweep(4000)) {
      const { level } = shuttleAt(u);
      expect(level).toBeGreaterThanOrEqual(last);
      if (level !== last) starts.push(u);
      last = level;
    }
    expect(last).toBe(SHUTTLE_LEVELS);
    expect(starts).toHaveLength(SHUTTLE_LEVELS);
    const lengths = starts.slice(1).map((s, i) => s - starts[i]!);
    for (let i = 1; i < lengths.length; i++) expect(lengths[i]!).toBeLessThan(lengths[i - 1]!);
  });

  it('turns at each cone on the beep, with no jump in her position', () => {
    let last = shuttleAt(0).x;
    for (const u of sweep(4000)) {
      const { x } = shuttleAt(u);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(1);
      expect(Math.abs(x - last)).toBeLessThan(0.02);
      last = x;
    }
    for (const at of BEEP_TIMES.slice(0, 4)) {
      const before = shuttleAt(at - 1e-4);
      const after = shuttleAt(at + 1e-4);
      expect(after.dir).not.toBe(before.dir);
    }
  });

  it('flashes the beep for a moment at each turn', () => {
    for (const at of BEEP_TIMES) {
      expect(shuttleAt(at + 0.001).beep).toBeGreaterThan(0.8);
      expect(shuttleAt(at + 0.05).beep).toBe(0);
    }
    expect(shuttleAt(0.001).beep).toBe(0);
  });

  it('cannot keep up on the last shuttle: she slows, stops short of the cone and is spent', () => {
    const lastStart = BEEP_TIMES[SHUTTLE_LEVELS - 2]!;
    const lastEnd = BEEP_TIMES[SHUTTLE_LEVELS - 1]!;
    const nearEnd = shuttleAt(lastEnd - 1e-4);
    expect(nearEnd.pace).toBeLessThan(0.05);
    // the last shuttle runs the other way from the one before, and ends nowhere near the far cone
    const reach = Math.abs(nearEnd.x - shuttleAt(lastStart + 1e-4).x);
    expect(reach).toBeLessThan(0.6);
    expect(reach).toBeGreaterThan(0.4);
    expect(shuttleAt(0.5).spent).toBe(false);
    expect(shuttleAt(1).spent).toBe(true);
    expect(shuttleAt(1).pace).toBe(0);
    expect(shuttleAt(1).x).toBeCloseTo(nearEnd.x, 2);
  });
});

describe('the effort chart', () => {
  it('rises step by step for the stepped test, three columns to a stage', () => {
    expect(profileColumns('stages', 7)).toBe(21);
    const p = effortProfile('stages', 7);
    expect(p).toHaveLength(21);
    for (let i = 1; i < p.length; i++) expect(p[i]!).toBeGreaterThanOrEqual(p[i - 1]!);
    expect(p[0]!).toBeLessThan(0.3);
    expect(p[p.length - 1]!).toBeCloseTo(1, 9);
    expect(new Set(p.map(v => v.toFixed(6))).size).toBe(7);
  });

  it('shows separate plateaus with rests between for trials', () => {
    const p = effortProfile('trials', 6, 3);
    expect(p).toHaveLength(24);
    let efforts = 0;
    p.forEach((v, i) => {
      if (v === 1 && (i === 0 || p[i - 1] !== 1)) efforts++;
    });
    expect(efforts).toBe(3);
    expect(Math.min(...p)).toBeLessThan(0.2);
  });

  it('spikes and fades for the all-out test', () => {
    const p = effortProfile('allout');
    expect(Math.max(...p)).toBeGreaterThan(0.85);
    expect(p.indexOf(Math.max(...p))).toBeLessThanOrEqual(2);
    for (let i = 2; i < p.length; i++) expect(p[i]!).toBeLessThanOrEqual(p[i - 1]! + 1e-12);
    expect(p[p.length - 1]!).toBeLessThan(0.5);
  });

  it('climbs in steps and then stops for the shuttle test', () => {
    const p = effortProfile('shuttles');
    const lastUp = p.findIndex(v => v === 0);
    expect(lastUp).toBeGreaterThan(10);
    for (let i = 1; i < lastUp; i++) expect(p[i]!).toBeGreaterThanOrEqual(p[i - 1]!);
    for (let i = lastUp; i < p.length; i++) expect(p[i]!).toBe(0);
  });

  it('stays between 0 and 1 for every shape', () => {
    for (const shape of ['stages', 'trials', 'allout', 'shuttles'] as const) {
      for (const v of effortProfile(shape, 7, 3)) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('the protocol readout', () => {
  const counts = { stages: 7, trials: 3 };

  it('counts stages, trials and levels without inventing numbers', () => {
    expect(readoutAt('stages', 0, counts)).toBe('STAGE 1');
    expect(readoutAt('stages', 1, counts)).toBe('STAGE 7');
    expect(readoutAt('trials', 0.05, counts)).toBe('TRIAL 1 OF 3');
    expect(readoutAt('trials', 1, counts)).toBe('TRIAL 3 OF 3');
    expect(readoutAt('allout', 0.5, counts)).toBe('ALL-OUT');
    expect(readoutAt('shuttles', 0, counts)).toBe('LEVEL 1');
    expect(readoutAt('shuttles', 1, counts)).toBe('LEVEL 6');
  });

  it('says REST between trials', () => {
    const rests = sweep().filter(u => readoutAt('trials', u, counts) === 'REST');
    expect(rests.length).toBeGreaterThan(20);
  });
});

describe('the frame a reduced-motion preview holds', () => {
  it('is a clear moment of each test: mid-stage, mid-run, mid-effort, mid-shuttle', () => {
    expect(stageAt(calmPreviewU('stages'), 7).stage).toBe(3);
    const trial = trialAt(calmPreviewU('trials'), 3);
    expect(trial.phase).toBe('run');
    expect(trial.within).toBeGreaterThan(0.2);
    expect(trial.within).toBeLessThan(0.8);
    expect(cycleAt(calmPreviewU('allout')).power).toBeGreaterThan(0.7);
    const shuttle = shuttleAt(calmPreviewU('shuttles'));
    expect(shuttle.spent).toBe(false);
    expect(shuttle.pace).toBe(1);
    expect(shuttle.beep).toBe(0);
    expect(shuttle.x).toBeGreaterThan(0.1);
    expect(shuttle.x).toBeLessThan(0.9);
  });
});
