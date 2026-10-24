// The Trace Desk's rules with no DOM and no canvas: one attempt's test file (built from the level's content and
// a random source), the clean-up decisions, the numbers read off the cleaned file, the pins and the score.
// Every sentence that carries physiology comes from the content or sports.ts; this file only fills in
// numbers and adds UI wording ("Good catch", "Missed").
import type { DataLabContent, SuspectText } from '../content/types';
import type { SportData } from '../../data/sports';
import { featureOf, paceOf, partsOf, type FeatureKind } from './names';

/** A random source: Math.random in the game, a seeded one in tests. */
export type Rng = () => number;

export type GlitchKind = 'contaminated' | 'failed' | 'misfire';
export type SuspectKind = GlitchKind | 'knee' | 'peak';
export type Decision = 'removed' | 'kept';

/** Where a flagged reading sits: a stage of the lactate test, or one of the sprints (both by index). */
export interface Place {
  readonly type: 'stage' | 'sprint';
  readonly index: number;
}

export interface Suspect {
  readonly kind: SuspectKind;
  /** Real data the software flagged (keep it), as opposed to a glitch (remove it). */
  readonly real: boolean;
  readonly place: Place;
  decision: Decision | null;
}

/** One stage of the file as the player sees it. */
export interface StagePoint {
  readonly kmh: number;
  /** What the file reads (a glitch included). */
  readonly mmol: number;
  /** False once the player has removed it. */
  present: boolean;
}

export interface SprintPoint {
  /** 1, 2, 3. */
  readonly n: number;
  readonly time: number;
  present: boolean;
}

export interface Point {
  kmh: number;
  mmol: number;
}

// ---- The zoom lens -----------------------------------------------------------------------------------------

export type LensRole = 'suspect' | 'normal' | 'flagged';

export interface LensDot {
  /** Position along the lens: km/h for a stage, the sprint's number for a sprint. */
  at: number;
  value: number;
  /** What is printed beside the dot. */
  text: string;
  /** 'flagged': another reading the software flagged that has not been decided yet. */
  role: LensRole;
}

export interface Lens {
  readonly dots: readonly LensDot[];
  /** The dotted IF REMOVED line: indices into dots, in order (the readings either side and the unflagged ones; not the suspect). */
  readonly repair: readonly number[];
  /** Index into dots of the reading under the lens. */
  readonly suspect: number;
}

/** How many readings the lens shows at most (the suspect and the ones around it). */
export const LENS_SPAN = 5;

// ---- Numbers read off the file ----------------------------------------------------------------------------------

/** Metres per second to km/h. */
const MS_TO_KMH = 3.6;

/** Speed (km/h) at which the line through `points` (in speed order) first reaches `mmol`; null if it never does. */
export const crossing = (points: readonly Point[], mmol: number): number | null => {
  for (let i = 0; i < points.length; i++) {
    const p = points[i]!;
    if (p.mmol < mmol) continue;
    const before = points[i - 1];
    if (!before || p.mmol === mmol) return p.kmh; // starts above the line, or sits exactly on it
    return before.kmh + ((mmol - before.mmol) / (p.mmol - before.mmol)) * (p.kmh - before.kmh);
  }
  return null;
};

/** Speed in km/h of `metres` run in `seconds`. */
export const speedKmh = (metres: number, seconds: number): number => (metres / seconds) * MS_TO_KMH;

const round1 = (value: number): number => Math.round(value * 10) / 10;

export const fmt1 = (value: number): string => value.toFixed(1);
export const fmt2 = (value: number): string => value.toFixed(2);

/** Fill {slot}s in a content sentence; a slot with no value is left as written. */
export const fillSlots = (text: string, slots: Readonly<Record<string, string>>): string =>
  text.replace(/\{(\w+)\}/g, (whole, key: string) => slots[key] ?? whole);

/** Fisher-Yates on a copy. */
export const shuffled = <T>(items: readonly T[], rng: Rng): T[] => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const swap = out[i]!;
    out[i] = out[j]!;
    out[j] = swap;
  }
  return out;
};

const pick = <T>(items: readonly T[], rng: Rng): T | undefined => items[Math.floor(rng() * items.length)];

// ---- Scoring and UI lines ---------------------------------------------------------------------------------------

/** dataQuality = DATA_QUALITY_FLOOR + DATA_QUALITY_SPAN x (right clean-up decisions / suspects). */
export const DATA_QUALITY_FLOOR = 0.5;
export const DATA_QUALITY_SPAN = 0.3;

export const dataQualityFor = (cleanScore: number): number => DATA_QUALITY_FLOOR + DATA_QUALITY_SPAN * cleanScore;

/** Said when a pin cannot be made (UI wording, no physiology). */
export const pinFullLine = (limit: number): string => `All ${limit} pins are used. Unpin one first.`;
/** Said when the last pin is placed. {DOWN} is filled in for the player's device. */
export const pinsPlacedLine = (limit: number): string => `All ${limit} pins placed. {DOWN}: LOCK IN.`;
/** Added when a row's number in the player's file differs from the one in its name. */
export const ODD_NUMBER = 'That number looks odd. Did a glitch slip through?';

// ---- The attempt ------------------------------------------------------------------------------------------------

export interface Verdict {
  right: boolean;
  /** Good catch / Right / That was real / Missed (UI wording). */
  result: string;
  /** The content's reason, verbatim. */
  why: string;
}

export interface Derived {
  /** Where the line through the remaining readings first reaches the thresholds' lactate; null if it never does. */
  lt1Kmh: number | null;
  lt2Kmh: number | null;
  lt1Pace: string | null;
  lt2Pace: string | null;
  vvo2Kmh: number;
  /** Fastest remaining sprint as a speed. */
  sprintKmh: number;
}

export interface PinRow {
  /** Index into sport.variables. */
  readonly variable: number;
  readonly name: string;
  readonly feature: FeatureKind | undefined;
  /** The name, or the name with the player's own number in the brackets and a '?'. */
  shown: string;
  /** The player's file gives a different number from the one in the name. */
  odd: boolean;
  readonly key: boolean;
  pinned: boolean;
  /** What this variable is on the file (content, verbatim). */
  readonly about: string;
}

export interface RevealLine {
  text: string;
  /** Correct pin (the stat counts it). */
  good: boolean;
  /** Which variable (index into sport.variables) the line is about; -1 for the insight. */
  variable: number;
  kind: 'pinned' | 'missed' | 'insight';
}

export interface TraceDesk {
  readonly content: DataLabContent;
  readonly stages: readonly StagePoint[];
  readonly sprints: readonly SprintPoint[];
  /** Left to right along the chart, the sprint last. */
  readonly suspects: readonly Suspect[];
  /** The list order of the variables: indices into sport.variables, shuffled per attempt. */
  readonly order: readonly number[];
  /** How many pins the room asks for (the number of key variables in sports.ts). */
  readonly pinLimit: number;
  /** The athlete's first name, for the verdict lines. */
  readonly athlete: string;
  /** Decisions made so far. */
  decided(): number;
  /** Right decisions so far. */
  rightCount(): number;
  /** Right decisions over suspects (0 to 1). */
  cleanScore(): number;
  /** What the lens shows for suspect `i` (the picture it had when decided, once it is). */
  lens(i: number): Lens;
  /** The software's description of suspect `i` with its numbers filled in (as it read when decided, once it is). */
  seen(i: number): string;
  /** Remove (true) or keep (false) suspect `i`. Null if it was decided already. */
  decide(i: number, remove: boolean): Verdict | null;
  /** The verdict of a decided suspect. */
  verdict(i: number): Verdict | null;
  /** The remaining stage readings, in speed order. */
  points(): readonly Point[];
  derived(): Derived;
  rows(): readonly PinRow[];
  /** Pin or unpin a variable by its index in sport.variables. */
  togglePin(variable: number): 'pinned' | 'unpinned' | 'full';
  pins(): readonly number[];
  canLock(): boolean;
  /** Lines to say after lock-in, in order, ending with the insight. */
  reveal(): RevealLine[];
  result(): { dataQuality: number; variableAccuracy: number };
}

const GLITCH_KINDS: readonly GlitchKind[] = ['contaminated', 'failed', 'misfire'];

/**
 * Stages (by index) a stage glitch may sit at: below the knee, not the first (the lens names the stages either
 * side, so there must be one on each) and not one that reads exactly a threshold's lactate (LT1's stage):
 * cleaning that stage out would move the threshold, and a perfect clean-up must give the clean file's numbers.
 */
const glitchStages = (content: DataLabContent, kneeIndex: number): number[] => {
  const out: number[] = [];
  for (let i = 1; i < kneeIndex; i++) {
    const mmol = content.stages[i]!.mmol;
    if (mmol !== content.lt1Mmol && mmol !== content.lt2Mmol) out.push(i);
  }
  return out;
};

export const createTraceDesk = (content: DataLabContent, sport: SportData, rng: Rng = Math.random): TraceDesk => {
  const count = content.stages.length;
  const found = content.stages.findIndex(s => s.mmol >= content.lt2Mmol);
  // "At the second threshold": the first stage that reaches LT2's lactate
  const kneeIndex = found > 0 ? found : Math.max(1, count - 2);
  const peakIndex = count - 1;

  // ---- Which glitches this attempt has: 2 or 3 of the three kinds, each at most once
  const kinds = shuffled(GLITCH_KINDS, rng).slice(0, rng() < 0.5 ? 2 : 3);
  const stageKinds = kinds.filter((k): k is 'contaminated' | 'failed' => k !== 'misfire');
  const places = glitchStages(content, kneeIndex);
  const stageAt = new Map<GlitchKind, number>();
  if (stageKinds.length === 2) {
    // Two stage glitches are never next to each other, or each lens would show the other's reading as a neighbour
    const pairs: Array<readonly [number, number]> = [];
    for (const a of places) for (const b of places) if (Math.abs(a - b) > 1) pairs.push([a, b]);
    const pair = pick(pairs, rng);
    if (pair) {
      stageAt.set(stageKinds[0]!, pair[0]);
      stageAt.set(stageKinds[1]!, pair[1]);
    }
  }
  if (stageAt.size === 0 && stageKinds.length > 0) {
    const at = pick(places, rng);
    if (at !== undefined) stageAt.set(stageKinds[0]!, at);
  }
  const misfireAt = kinds.includes('misfire') ? Math.floor(rng() * content.sprintTimes.length) : -1;

  // ---- The file as the player sees it
  const stages: StagePoint[] = content.stages.map((s, i) => {
    let mmol = s.mmol;
    if (stageAt.get('contaminated') === i) mmol = round1(s.mmol + content.contaminatedRise);
    if (stageAt.get('failed') === i) mmol = 0;
    return { kmh: s.kmh, mmol, present: true };
  });
  const sprints: SprintPoint[] = content.sprintTimes.map((time, i) => ({
    n: i + 1,
    time: i === misfireAt ? content.misfireTime : time,
    present: true,
  }));

  const suspects: Suspect[] = [];
  const add = (kind: SuspectKind, type: Place['type'], index: number) =>
    suspects.push({ kind, real: kind === 'knee' || kind === 'peak', place: { type, index }, decision: null });
  for (const [kind, at] of stageAt) add(kind, 'stage', at);
  add('knee', 'stage', kneeIndex);
  add('peak', 'stage', peakIndex);
  suspects.sort((a, b) => a.place.index - b.place.index);
  if (misfireAt >= 0) add('misfire', 'sprint', misfireAt);

  const textFor = (kind: SuspectKind): SuspectText => content[kind];
  const athlete = (sport.athleteProfile.split(',')[0] ?? 'the athlete').trim();

  // ---- What the lens and the description say about a suspect (recomputed only when the file changes)
  let version = 0; // bumps whenever the file or the pins change, so cached views know to recompute
  interface Live {
    version: number;
    lens: Lens;
    seen: string;
  }
  const live: (Live | undefined)[] = suspects.map(() => undefined);
  const frozenSeen: (string | undefined)[] = suspects.map(() => undefined);
  const frozenLens: (Lens | undefined)[] = suspects.map(() => undefined);
  const verdicts: (Verdict | undefined)[] = suspects.map(() => undefined);

  /** The nearest stage still in the file on one side of `index`. */
  const stageNeighbour = (index: number, step: -1 | 1): StagePoint | undefined => {
    for (let i = index + step; i >= 0 && i < stages.length; i += step) if (stages[i]!.present) return stages[i];
    return undefined;
  };

  /** Whether the file, as the player has left it, rises into stage `at` more steeply than anywhere before it. */
  const steepestRiseSoFar = (at: number): boolean => {
    const present = stages.slice(0, at + 1).filter(s => s.present);
    const rise = (i: number) => present[i]!.mmol - present[i - 1]!.mmol;
    const last = present.length - 1;
    if (last < 1 || rise(last) <= 0) return false;
    for (let i = 1; i < last; i++) if (rise(i) >= rise(last)) return false;
    return true;
  };

  const stageSeen = (suspect: Suspect): string => {
    const at = suspect.place.index;
    const stage = stages[at]!;
    const before = stageNeighbour(at, -1);
    const after = stageNeighbour(at, 1);
    // A kept glitch before the knee can leave it as a fall in the player's file: then say only what it reads
    const template = suspect.kind === 'knee' && !steepestRiseSoFar(at) ? content.kneePlain : textFor(suspect.kind).seen;
    return fillSlots(template, {
      kmh: String(stage.kmh),
      value: fmt1(stage.mmol),
      before: before ? fmt1(before.mmol) : '',
      after: after ? fmt1(after.mmol) : '',
    });
  };

  const sprintSeen = (suspect: Suspect): string => {
    const at = suspect.place.index;
    const run = sprints[at]!;
    const others = sprints.filter((s, i) => i !== at && s.present).map(s => fmt2(s.time));
    return fillSlots(textFor(suspect.kind).seen, {
      n: String(run.n),
      time: fmt2(run.time),
      speed: fmt1(speedKmh(content.sprintMetres, run.time)),
      others: others.join(' and '),
    });
  };

  const flaggedElsewhere = (index: number, except: number): boolean =>
    suspects.some((s, j) => j !== except && s.decision === null && s.place.type === 'stage' && s.place.index === index);

  const buildLens = (i: number): Lens => {
    const suspect = suspects[i]!;
    const dots: LensDot[] = [];
    let at = 0;
    const push = (dot: LensDot) => {
      if (dot.role === 'suspect') at = dots.length;
      dots.push(dot);
    };
    if (suspect.place.type === 'stage') {
      // A window of up to LENS_SPAN remaining stages around the suspect, pushed along at the ends of the file
      const here = suspect.place.index;
      const remaining: number[] = [];
      stages.forEach((s, idx) => {
        if (s.present) remaining.push(idx);
      });
      const pos = remaining.indexOf(here);
      const first = Math.max(0, Math.min(pos - Math.floor(LENS_SPAN / 2), remaining.length - LENS_SPAN));
      for (const idx of remaining.slice(first, first + LENS_SPAN)) {
        const s = stages[idx]!;
        const role: LensRole = idx === here ? 'suspect' : flaggedElsewhere(idx, i) ? 'flagged' : 'normal';
        push({ at: s.kmh, value: s.mmol, text: fmt1(s.mmol), role });
      }
    } else {
      for (const run of sprints) {
        if (!run.present) continue;
        push({ at: run.n, value: run.time, text: fmt2(run.time), role: run.n - 1 === suspect.place.index ? 'suspect' : 'normal' });
      }
    }
    // The dotted line runs through the readings either side (always, even when the software flagged one of them
    // too, as it does the knee) and through the other unflagged readings; other flagged readings are left out
    const repair: number[] = [];
    dots.forEach((dot, idx) => {
      if (idx !== at && (dot.role === 'normal' || Math.abs(idx - at) === 1)) repair.push(idx);
    });
    return { dots, repair, suspect: at };
  };

  const liveFor = (i: number): Live => {
    let entry = live[i];
    if (!entry || entry.version !== version) {
      const suspect = suspects[i]!;
      entry = { version, lens: buildLens(i), seen: suspect.place.type === 'stage' ? stageSeen(suspect) : sprintSeen(suspect) };
      live[i] = entry;
    }
    return entry;
  };

  const verdictFor = (suspect: Suspect, remove: boolean): Verdict => {
    const right = remove !== suspect.real;
    let result: string;
    if (suspect.real) result = remove ? 'That was real: you have clipped it from the file.' : 'Right: that is real data.';
    else result = remove ? `Good catch: a glitch, not ${athlete}.` : 'Missed: that glitch is still in the file.';
    return { right, result, why: textFor(suspect.kind).why };
  };

  // ---- Numbers read off the cleaned file (cached until a decision changes the file)
  let pointsCache: Point[] = [];
  let pointsVersion = -1;
  const points = (): readonly Point[] => {
    if (pointsVersion !== version) {
      pointsCache = stages.filter(s => s.present).map(s => ({ kmh: s.kmh, mmol: s.mmol }));
      pointsVersion = version;
    }
    return pointsCache;
  };

  let derivedCache: Derived | undefined;
  let derivedVersion = -1;
  const derived = (): Derived => {
    if (!derivedCache || derivedVersion !== version) {
      const remaining = points();
      const lt1 = crossing(remaining, content.lt1Mmol);
      const lt2 = crossing(remaining, content.lt2Mmol);
      const fastest = Math.min(...sprints.filter(s => s.present).map(s => s.time));
      derivedCache = {
        lt1Kmh: lt1,
        lt2Kmh: lt2,
        lt1Pace: lt1 === null ? null : paceOf(lt1),
        lt2Pace: lt2 === null ? null : paceOf(lt2),
        vvo2Kmh: content.vvo2maxKmh,
        sprintKmh: Number.isFinite(fastest) ? speedKmh(content.sprintMetres, fastest) : 0,
      };
      derivedVersion = version;
    }
    return derivedCache;
  };

  // ---- The pin list
  const order = shuffled(
    sport.variables.map((_, i) => i),
    rng,
  );
  const keyCount = sport.variables.filter(v => v.correct).length;
  const pinned: number[] = [];

  /** The row's text: the name as written, unless the player's file gives a different number. */
  const shownFor = (name: string, feature: FeatureKind | undefined, d: Derived): { shown: string; odd: boolean } => {
    const parts = partsOf(name);
    let mine: string | undefined;
    if (feature === 'lt1') mine = d.lt1Pace ?? '--:--';
    else if (feature === 'lt2') mine = d.lt2Pace ?? '--:--';
    else if (feature === 'sprint') mine = String(Math.round(d.sprintKmh));
    if (mine === undefined || parts.value === '' || mine === parts.value) return { shown: name, odd: false };
    return { shown: `${parts.head}${mine}${parts.tail}?`, odd: true };
  };

  let rowsCache: PinRow[] = [];
  let rowsVersion = -1;
  const rows = (): readonly PinRow[] => {
    if (rowsVersion !== version) {
      const d = derived();
      rowsCache = order.map(variable => {
        const v = sport.variables[variable]!;
        const feature = featureOf(v.name);
        const { shown, odd } = shownFor(v.name, feature, d);
        return { variable, name: v.name, feature, shown, odd, key: v.correct, pinned: pinned.includes(variable), about: content.features[v.name] ?? '' };
      });
      rowsVersion = version;
    }
    return rowsCache;
  };

  const decided = (): number => suspects.filter(s => s.decision !== null).length;
  const rightCount = (): number => suspects.filter(s => s.decision !== null && s.real === (s.decision === 'kept')).length;
  const cleanScore = (): number => (suspects.length === 0 ? 1 : rightCount() / suspects.length);

  return {
    content,
    stages,
    sprints,
    suspects,
    order,
    pinLimit: keyCount,
    athlete,
    decided,
    rightCount,
    cleanScore,

    lens: i => frozenLens[i] ?? liveFor(i).lens,
    seen: i => frozenSeen[i] ?? liveFor(i).seen,

    decide(i, remove) {
      const suspect = suspects[i];
      if (!suspect || suspect.decision !== null) return null;
      // Remember what the player saw before the file changes under it
      frozenSeen[i] = liveFor(i).seen;
      frozenLens[i] = liveFor(i).lens;
      const verdict = verdictFor(suspect, remove);
      suspect.decision = remove ? 'removed' : 'kept';
      verdicts[i] = verdict;
      if (remove) {
        if (suspect.place.type === 'stage') stages[suspect.place.index]!.present = false;
        else sprints[suspect.place.index]!.present = false;
      }
      version++;
      return verdict;
    },

    verdict: i => verdicts[i] ?? null,
    points,
    derived,
    rows,
    pins: () => pinned,

    togglePin(variable) {
      const at = pinned.indexOf(variable);
      if (at >= 0) {
        pinned.splice(at, 1);
        version++;
        return 'unpinned';
      }
      if (pinned.length >= keyCount) return 'full';
      pinned.push(variable);
      version++;
      return 'pinned';
    },

    canLock: () => pinned.length === keyCount,

    reveal() {
      const lines: RevealLine[] = [];
      for (const variable of order) {
        if (!pinned.includes(variable)) continue;
        const v = sport.variables[variable]!;
        lines.push({ text: `${v.correct ? 'Correct!' : 'Not quite.'} ${v.explanation}`, good: v.correct, variable, kind: 'pinned' });
      }
      for (const variable of order) {
        const v = sport.variables[variable]!;
        if (v.correct && !pinned.includes(variable)) {
          lines.push({ text: `Missed: ${v.name}. ${v.explanation}`, good: false, variable, kind: 'missed' });
        }
      }
      lines.push({ text: sport.variableInsight, good: true, variable: -1, kind: 'insight' });
      return lines;
    },

    result() {
      const correct = pinned.filter(i => sport.variables[i]?.correct).length;
      return {
        dataQuality: dataQualityFor(cleanScore()),
        variableAccuracy: keyCount === 0 ? 0 : correct / keyCount,
      };
    },
  };
};
