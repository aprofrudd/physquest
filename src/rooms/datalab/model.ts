// The Trace Desk's rules with no DOM and no canvas: one attempt's test files (one per test the Testing Lab ran that
// has a file: the Lactate Profile's stages, the Critical Speed Test's trials), built from the level's content and a
// random source; the clean-up decisions, file by file; the numbers read off the cleaned files; the key variables the
// player chooses (only from the files present, so no value from a test that was not run ever appears) and the score.
// Every sentence that carries physiology comes from the content or sports.ts; this file only fills in numbers and
// adds UI wording ("Good catch", "Missed").
import type { DataFileKind, DataLabContent, LactateFile, SuspectText, TrialsFile } from '../content/types';
import type { SportData } from '../../data/sports';
import { featureOf, paceOf, paceText, partsOf, type FeatureKind } from './names';

/** A random source: Math.random in the game, a seeded one in tests. */
export type Rng = () => number;

export type GlitchKind = 'contaminated' | 'failed' | 'mistimed';
export type SuspectKind = GlitchKind | 'knee' | 'peak' | 'fastest';
export type Decision = 'removed' | 'kept';

/** Where a flagged reading sits: a stage of the lactate profile, or one of the time trials (both by index). */
export interface Place {
  readonly type: 'stage' | 'trial';
  readonly index: number;
}

export interface Suspect {
  readonly kind: SuspectKind;
  /** Real data the software flagged (keep it), as opposed to a glitch (remove it). */
  readonly real: boolean;
  readonly place: Place;
  readonly file: DataFileKind;
  /** Its number in its own file (1-based) and how many its file has: "Reading 2 of 3". */
  readonly number: number;
  readonly of: number;
  decision: Decision | null;
}

/** One stage of the lactate file as the player sees it. */
export interface StagePoint {
  readonly kmh: number;
  /** What the file reads (a glitch included). */
  readonly mmol: number;
  readonly hr: number;
  /** False once the player has removed it. */
  present: boolean;
}

/** One time trial as the player sees it. */
export interface TrialPoint {
  /** 1, 2, 3. */
  readonly n: number;
  readonly metres: number;
  /** What the file reads (a mistimed trial included). */
  readonly seconds: number;
  present: boolean;
}

export interface Point {
  kmh: number;
  mmol: number;
}

/** A file of the attempt, in the order the player cleans them. */
export interface DeskFile {
  readonly kind: DataFileKind;
  readonly content: LactateFile | TrialsFile;
  /** Index of its first suspect in `suspects`, and how many it has. */
  readonly first: number;
  readonly count: number;
}

// ---- The zoom lens -----------------------------------------------------------------------------------------

export type LensRole = 'suspect' | 'normal' | 'flagged';

export interface LensDot {
  /** Position along the lens: km/h for a stage, the trial's number for a trial. */
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

// ---- Numbers read off the files ----------------------------------------------------------------------------------

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

export const round1 = (value: number): number => Math.round(value * 10) / 10;

export const fmt1 = (value: number): string => value.toFixed(1);

/** A speed's pace as reported: from the speed rounded to 0.1 km/h (16.82 km/h is reported 16.8, so 3:34/km). */
export const reportedPace = (kmh: number): string => paceOf(round1(kmh));

/** A time in m:ss. */
export const clockText = (seconds: number): string => paceText(seconds);

/** Seconds per km of `metres` in `seconds`. */
export const secondsPerKm = (metres: number, seconds: number): number => (seconds * 1000) / metres;

/** D prime is shown to the nearest this many metres (its typical error is larger than that). */
export const DPRIME_STEP = 10;

/** The least-squares line of distance (m) against time (s): its slope (m/s) and intercept (m). Null for fewer than 2. */
export const distanceTimeFit = (trials: readonly { metres: number; seconds: number }[]): { slope: number; intercept: number } | null => {
  const n = trials.length;
  if (n < 2) return null;
  let mt = 0;
  let md = 0;
  for (const t of trials) {
    mt += t.seconds / n;
    md += t.metres / n;
  }
  let sxy = 0;
  let sxx = 0;
  for (const t of trials) {
    sxy += (t.seconds - mt) * (t.metres - md);
    sxx += (t.seconds - mt) ** 2;
  }
  if (sxx === 0) return null;
  const slope = sxy / sxx;
  return { slope, intercept: md - slope * mt };
};

/** Fill {slot}s in a content sentence; a slot with no value is left as written. */
export const fillSlots = (text: string, slots: Readonly<Record<string, string>>): string =>
  text.replace(/\{(\w+)\}/g, (whole, key: string) => slots[key] ?? whole);

/** Fisher-Yates on a copy. */
export const shuffled = <T>(items: readonly T[], rng: Rng): T[] => {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(rng() * (i + 1)));
    const swap = out[i]!;
    out[i] = out[j]!;
    out[j] = swap;
  }
  return out;
};

const pick = <T>(items: readonly T[], rng: Rng): T | undefined => items[Math.min(items.length - 1, Math.floor(rng() * items.length))];

// ---- Scoring and UI lines ---------------------------------------------------------------------------------------

/** dataQuality = DATA_QUALITY_FLOOR + DATA_QUALITY_SPAN x (right clean-up decisions / suspects). */
export const DATA_QUALITY_FLOOR = 0.5;
export const DATA_QUALITY_SPAN = 0.3;

export const dataQualityFor = (cleanScore: number): number => DATA_QUALITY_FLOOR + DATA_QUALITY_SPAN * cleanScore;

/** Said when a key variable cannot be chosen (UI wording, no physiology). */
export const keyFullLine = (limit: number): string => `All ${limit} key variables are chosen. Take one out first.`;
/** Said when the last key variable is chosen (the cursor moves to LOCK IN). {A} and {UP} are filled in for the player's device. */
export const keysChosenLine = (limit: number): string => `All ${limit} key variables chosen. {A}: LOCK IN, or {UP} to change one.`;
/** Added when a row's number in the player's file differs from the one in its name. */
export const ODD_NUMBER = 'That number looks odd. Did a glitch slip through?';

/** Which test each file kind belongs to, by its file in the content. */
export const fileContent = (content: DataLabContent, kind: DataFileKind): LactateFile | TrialsFile =>
  kind === 'lactate' ? content.lactate : content.trials;

/**
 * The files an attempt has, in order, for the battery `tests` (names in sports.ts): the lactate profile's, then the
 * trials'. Tests with no file add nothing. An empty battery (the room opened before any testing) has every file.
 */
export const filesFor = (content: DataLabContent, tests: readonly string[]): DataFileKind[] => {
  const all: DataFileKind[] = ['lactate', 'trials'];
  if (tests.length === 0) return all;
  return all.filter(kind => tests.includes(fileContent(content, kind).test));
};

// ---- The attempt ------------------------------------------------------------------------------------------------

export interface Verdict {
  right: boolean;
  /** Good catch / Right / That was real / Missed (UI wording). */
  result: string;
  /** The content's reason, verbatim. */
  why: string;
}

export interface Derived {
  /** LT1 and LT2 read off the remaining stages; null if the curve never gets there (or there is no lactate file). */
  lt1Kmh: number | null;
  lt2Kmh: number | null;
  lt1Pace: string | null;
  lt2Pace: string | null;
  /** Heart rate (bpm) at LT2's speed, between the stages either side. */
  hrLt2: number | null;
  /** From the final ramp (null without a lactate file). */
  vvo2Kmh: number | null;
  vo2max: number | null;
  /** Critical speed and D prime from the remaining trials (null with fewer than two, or no trials file). */
  csKmh: number | null;
  csPace: string | null;
  /** D prime in metres, to the nearest DPRIME_STEP. */
  dPrime: number | null;
  /** The fastest remaining trial's pace per km. */
  bestPace: string | null;
}

export interface PinRow {
  /** Index into sport.variables. */
  readonly variable: number;
  readonly name: string;
  readonly feature: FeatureKind | undefined;
  /** The file it comes from. */
  readonly file: DataFileKind;
  /** The name, or the name with the player's own number in the brackets and a '?'. */
  shown: string;
  /** The player's file gives a different number from the one in the name. */
  odd: boolean;
  readonly key: boolean;
  /** Chosen as a key variable. */
  pinned: boolean;
  /** What this variable is on the file (content, verbatim). */
  readonly about: string;
}

export interface RevealLine {
  text: string;
  /** Correct choice (the stat counts it). */
  good: boolean;
  /** Which variable (index into sport.variables) the line is about; -1 for the insight. */
  variable: number;
  kind: 'pinned' | 'missed' | 'insight';
}

export interface TraceDesk {
  readonly content: DataLabContent;
  readonly files: readonly DeskFile[];
  /** The lactate file's stages (empty without one). */
  readonly stages: readonly StagePoint[];
  /** The trials file's trials (empty without one). */
  readonly trials: readonly TrialPoint[];
  /** File by file, left to right along each file. */
  readonly suspects: readonly Suspect[];
  /** The list order of the variables: indices into sport.variables, grouped by file (in file order), shuffled within. */
  readonly order: readonly number[];
  /** How many key variables the room asks for (the key variables in sports.ts among the files present). */
  readonly pinLimit: number;
  /** The athlete's first name, for the verdict lines. */
  readonly athlete: string;
  /** The file a suspect belongs to (its index in `files`). */
  fileIndexOf(i: number): number;
  /** Every flagged reading of file `f` has been decided. */
  fileClean(f: number): boolean;
  decided(): number;
  rightCount(): number;
  /** Right decisions over suspects (0 to 1). */
  cleanScore(): number;
  /** What the lens shows for suspect `i` (the picture it had when decided, once it is). */
  lens(i: number): Lens;
  /** The software's description of suspect `i` with its numbers filled in (as it read when decided, once it is). */
  seen(i: number): string;
  /** The question for suspect `i`: "Reading 2 of 3: lactate at 16 km/h. Real data, or a glitch?" */
  ask(i: number): string;
  /** Remove (true) or keep (false) suspect `i`. Null if it was decided already. */
  decide(i: number, remove: boolean): Verdict | null;
  verdict(i: number): Verdict | null;
  /** The remaining stage readings, in speed order. */
  points(): readonly Point[];
  derived(): Derived;
  rows(): readonly PinRow[];
  /** Choose or take out a key variable by its index in sport.variables. */
  togglePin(variable: number): 'pinned' | 'unpinned' | 'full';
  pins(): readonly number[];
  canLock(): boolean;
  /** Lines to say after lock-in, in order, ending with the insight. */
  reveal(): RevealLine[];
  result(): { dataQuality: number; variableAccuracy: number };
}

export interface DeskOptions {
  /** The Testing Lab's battery (names in sports.ts); empty: every file. */
  tests?: readonly string[];
  rng?: Rng;
}

export const createTraceDesk = (content: DataLabContent, sport: SportData, options: DeskOptions | Rng = {}): TraceDesk => {
  const opts: DeskOptions = typeof options === 'function' ? { rng: options } : options;
  const rng = opts.rng ?? Math.random;
  const kinds = filesFor(content, opts.tests ?? []);
  const lac = content.lactate;
  const tri = content.trials;
  const hasLactate = kinds.includes('lactate');
  const hasTrials = kinds.includes('trials');

  // ---- Numbers off a set of stages and trials (the clean file's, or the player's)
  const lactateNumbers = (stages: readonly { kmh: number; mmol: number; hr: number }[]) => {
    const pts = stages.map(s => ({ kmh: s.kmh, mmol: s.mmol }));
    let low = Infinity;
    for (const p of pts) low = Math.min(low, p.mmol);
    const lt1 = pts.length > 0 ? crossing(pts, low + lac.lt1Rise) : null;
    const lt2 = crossing(pts, lac.lt2Mmol);
    let hr: number | null = null;
    if (lt2 !== null) {
      for (let i = 0; i < stages.length; i++) {
        const s = stages[i]!;
        if (s.kmh < lt2) continue;
        const before = stages[i - 1];
        hr = !before || s.kmh === lt2 ? s.hr : before.hr + ((lt2 - before.kmh) / (s.kmh - before.kmh)) * (s.hr - before.hr);
        break;
      }
    }
    return { lt1, lt2, hr };
  };
  const pacesOf = (n: { lt1: number | null; lt2: number | null; hr: number | null }) => ({
    lt1: n.lt1 === null ? null : reportedPace(n.lt1),
    lt2: n.lt2 === null ? null : reportedPace(n.lt2),
    hr: n.hr === null ? null : Math.round(n.hr),
  });

  // ---- The lactate file's flagged readings: 1 or 2 glitches (contaminated, failed) and the knee and the peak
  const count = lac.stages.length;
  const found = lac.stages.findIndex(s => s.mmol >= lac.lt2Mmol);
  const kneeIndex = found > 0 ? found : Math.max(1, count - 2);
  const peakIndex = count - 1;
  // A glitch may sit only where cleaning it out leaves the clean file's numbers as they are (a perfect clean-up
  // must give the clean file's values): below the knee, not the first stage (the lens names the stages either side)
  const cleanPaces = pacesOf(lactateNumbers(lac.stages));
  const places: number[] = [];
  for (let i = 1; i < kneeIndex; i++) {
    const without = pacesOf(lactateNumbers(lac.stages.filter((_, j) => j !== i)));
    if (without.lt1 === cleanPaces.lt1 && without.lt2 === cleanPaces.lt2 && without.hr === cleanPaces.hr) places.push(i);
  }
  const stageAt = new Map<'contaminated' | 'failed', number>();
  if (hasLactate && places.length > 0) {
    const glitchKinds = shuffled(['contaminated', 'failed'] as const, rng);
    const pairs: Array<readonly [number, number]> = [];
    for (const a of places) for (const b of places) if (b - a > 1) pairs.push([a, b]);
    const pair = pairs.length > 0 && rng() < 0.5 ? pick(pairs, rng) : undefined;
    if (pair) {
      stageAt.set(glitchKinds[0]!, pair[0]);
      stageAt.set(glitchKinds[1]!, pair[1]);
    } else {
      stageAt.set(glitchKinds[0]!, pick(places, rng)!);
    }
  }

  const stages: StagePoint[] = hasLactate
    ? lac.stages.map((s, i) => {
        let mmol = s.mmol;
        if (stageAt.get('contaminated') === i) mmol = round1(s.mmol + lac.contaminatedRise);
        if (stageAt.get('failed') === i) mmol = 0;
        return { kmh: s.kmh, mmol, hr: s.hr, present: true };
      })
    : [];

  // ---- The trials file: one mistimed trial and the shortest (fastest per km) flagged as real
  const mistiming = hasTrials ? pick(tri.mistimings, rng) : undefined;
  const trials: TrialPoint[] = hasTrials
    ? tri.trials.map((t, i) => ({
        n: i + 1,
        metres: t.metres,
        seconds: mistiming && mistiming.trial === i ? t.seconds + mistiming.seconds : t.seconds,
        present: true,
      }))
    : [];

  // ---- The suspects, file by file
  const suspects: Suspect[] = [];
  const files: DeskFile[] = [];
  const addFile = (kind: DataFileKind, list: Array<{ kind: SuspectKind; real: boolean; place: Place }>) => {
    list.sort((a, b) => a.place.index - b.place.index);
    files.push({ kind, content: fileContent(content, kind), first: suspects.length, count: list.length });
    list.forEach((s, i) => suspects.push({ ...s, file: kind, number: i + 1, of: list.length, decision: null }));
  };
  if (hasLactate) {
    const list: Array<{ kind: SuspectKind; real: boolean; place: Place }> = [];
    for (const [kind, at] of stageAt) list.push({ kind, real: false, place: { type: 'stage', index: at } });
    list.push({ kind: 'knee', real: true, place: { type: 'stage', index: kneeIndex } });
    list.push({ kind: 'peak', real: true, place: { type: 'stage', index: peakIndex } });
    addFile('lactate', list);
  }
  if (hasTrials) {
    const list: Array<{ kind: SuspectKind; real: boolean; place: Place }> = [{ kind: 'fastest', real: true, place: { type: 'trial', index: 0 } }];
    if (mistiming) list.push({ kind: 'mistimed', real: false, place: { type: 'trial', index: mistiming.trial } });
    addFile('trials', list);
  }

  const textFor = (kind: SuspectKind): SuspectText =>
    kind === 'mistimed' ? tri.mistimed : kind === 'fastest' ? tri.fastest : lac[kind];
  const athlete = (sport.athleteProfile.split(',')[0] ?? 'the athlete').trim();

  // ---- What the lens and the description say about a suspect (recomputed only when the file changes)
  let version = 0; // bumps whenever a file or the choices change, so cached views know to recompute
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
    const template = suspect.kind === 'knee' && !steepestRiseSoFar(at) ? lac.kneePlain : textFor(suspect.kind).seen;
    return fillSlots(template, {
      kmh: String(stage.kmh),
      value: fmt1(stage.mmol),
      before: before ? fmt1(before.mmol) : '',
      after: after ? fmt1(after.mmol) : '',
    });
  };

  const trialPace = (t: TrialPoint): string => paceText(secondsPerKm(t.metres, t.seconds));

  const trialSeen = (suspect: Suspect): string => {
    const at = suspect.place.index;
    const run = trials[at]!;
    const others = trials.filter((t, i) => i !== at && t.present).map(trialPace);
    return fillSlots(textFor(suspect.kind).seen, {
      m: String(run.metres),
      time: clockText(run.seconds),
      pace: trialPace(run),
      others: others.join(' and '),
    });
  };

  const flaggedElsewhere = (type: Place['type'], index: number, except: number): boolean =>
    suspects.some((s, j) => j !== except && s.decision === null && s.place.type === type && s.place.index === index);

  const buildLens = (i: number): Lens => {
    const suspect = suspects[i]!;
    const dots: LensDot[] = [];
    let at = 0;
    const push = (dot: LensDot) => {
      if (dot.role === 'suspect') at = dots.length;
      dots.push(dot);
    };
    const here = suspect.place.index;
    if (suspect.place.type === 'stage') {
      // A window of up to LENS_SPAN remaining stages around the suspect, pushed along at the ends of the file
      const remaining: number[] = [];
      stages.forEach((s, idx) => {
        if (s.present) remaining.push(idx);
      });
      const pos = remaining.indexOf(here);
      const first = Math.max(0, Math.min(pos - Math.floor(LENS_SPAN / 2), remaining.length - LENS_SPAN));
      for (const idx of remaining.slice(first, first + LENS_SPAN)) {
        const s = stages[idx]!;
        const role: LensRole = idx === here ? 'suspect' : flaggedElsewhere('stage', idx, i) ? 'flagged' : 'normal';
        push({ at: s.kmh, value: s.mmol, text: fmt1(s.mmol), role });
      }
    } else {
      // Each remaining trial's pace per km (higher on the lens is slower)
      trials.forEach((t, idx) => {
        if (!t.present) return;
        const role: LensRole = idx === here ? 'suspect' : flaggedElsewhere('trial', idx, i) ? 'flagged' : 'normal';
        push({ at: t.n, value: secondsPerKm(t.metres, t.seconds), text: trialPace(t), role });
      });
    }
    // The dotted line runs through the readings either side (always, even when the software flagged one of them
    // too) and through the other unflagged readings; other flagged readings are left out
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
      entry = { version, lens: buildLens(i), seen: suspect.place.type === 'stage' ? stageSeen(suspect) : trialSeen(suspect) };
      live[i] = entry;
    }
    return entry;
  };

  const askOf = (i: number): string => {
    const s = suspects[i]!;
    const slots: Record<string, string> = { i: String(s.number), n: String(s.of) };
    if (s.place.type === 'stage') slots.kmh = String(stages[s.place.index]!.kmh);
    else slots.m = String(trials[s.place.index]!.metres);
    return fillSlots(s.file === 'lactate' ? lac.ask : tri.ask, slots);
  };
  const asks = suspects.map((_, i) => askOf(i));

  const verdictFor = (suspect: Suspect, remove: boolean): Verdict => {
    const right = remove !== suspect.real;
    let result: string;
    if (suspect.real) result = remove ? 'That was real: you have clipped it from the file.' : 'Right: that is real data.';
    else result = remove ? `Good catch: a glitch, not ${athlete}.` : 'Missed: that glitch is still in the file.';
    return { right, result, why: textFor(suspect.kind).why };
  };

  // ---- Numbers read off the cleaned files (cached until a decision changes a file)
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
      const n = hasLactate ? lactateNumbers(stages.filter(s => s.present)) : { lt1: null, lt2: null, hr: null };
      const p = pacesOf(n);
      const kept = trials.filter(t => t.present);
      const fit = hasTrials ? distanceTimeFit(kept) : null;
      const cs = fit && fit.slope > 0 ? fit.slope * MS_TO_KMH : null;
      let best: number | null = null;
      for (const t of kept) {
        const spk = secondsPerKm(t.metres, t.seconds);
        best = best === null ? spk : Math.min(best, spk);
      }
      derivedCache = {
        lt1Kmh: n.lt1,
        lt2Kmh: n.lt2,
        lt1Pace: p.lt1,
        lt2Pace: p.lt2,
        hrLt2: p.hr,
        vvo2Kmh: hasLactate ? lac.vvo2maxKmh : null,
        vo2max: hasLactate ? lac.vo2max : null,
        csKmh: cs,
        csPace: cs === null ? null : reportedPace(cs),
        dPrime: fit && cs !== null ? Math.round(fit.intercept / DPRIME_STEP) * DPRIME_STEP : null,
        bestPace: best === null ? null : paceText(best),
      };
      derivedVersion = version;
    }
    return derivedCache;
  };

  // ---- The key-variable list: only variables from the files present, grouped by file
  const fileOfVariable = (name: string): DataFileKind | undefined => content.features[name]?.file;
  const order: number[] = [];
  for (const kind of kinds) {
    const mine = sport.variables.map((v, i) => (fileOfVariable(v.name) === kind ? i : -1)).filter(i => i >= 0);
    order.push(...shuffled(mine, rng));
  }
  const keyCount = order.filter(i => sport.variables[i]!.correct).length;
  const pinned: number[] = [];

  /** The row's text: the name as written, unless the player's file gives a different number. */
  const shownFor = (name: string, feature: FeatureKind | undefined, d: Derived): { shown: string; odd: boolean } => {
    const parts = partsOf(name);
    let mine: string | undefined;
    if (feature === 'lt1') mine = d.lt1Pace ?? '--:--';
    else if (feature === 'lt2') mine = d.lt2Pace ?? '--:--';
    else if (feature === 'hrlt2') mine = d.hrLt2 === null ? '--' : String(d.hrLt2);
    else if (feature === 'cs') mine = d.csPace ?? '--:--';
    else if (feature === 'dprime') mine = d.dPrime === null ? '--' : String(d.dPrime);
    else if (feature === 'besttrial') mine = d.bestPace ?? '--:--';
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
        const about = content.features[v.name];
        return {
          variable,
          name: v.name,
          feature,
          file: about?.file ?? 'lactate',
          shown,
          odd,
          key: v.correct,
          pinned: pinned.includes(variable),
          about: about?.about ?? '',
        };
      });
      rowsVersion = version;
    }
    return rowsCache;
  };

  const decided = (): number => suspects.filter(s => s.decision !== null).length;
  const rightCount = (): number => suspects.filter(s => s.decision !== null && s.real === (s.decision === 'kept')).length;
  const cleanScore = (): number => (suspects.length === 0 ? 1 : rightCount() / suspects.length);
  const fileIndexOf = (i: number): number => {
    for (let f = files.length - 1; f >= 0; f--) if (i >= files[f]!.first) return f;
    return 0;
  };

  return {
    content,
    files,
    stages,
    trials,
    suspects,
    order,
    pinLimit: keyCount,
    athlete,
    fileIndexOf,
    fileClean: f => {
      const file = files[f];
      if (!file) return true;
      for (let i = file.first; i < file.first + file.count; i++) if (suspects[i]!.decision === null) return false;
      return true;
    },
    decided,
    rightCount,
    cleanScore,

    lens: i => frozenLens[i] ?? liveFor(i).lens,
    seen: i => frozenSeen[i] ?? liveFor(i).seen,
    ask: i => asks[i] ?? '',

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
        else trials[suspect.place.index]!.present = false;
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
        lines.push({ text: `${v.correct ? 'Key!' : 'Not key.'} ${v.explanation}`, good: v.correct, variable, kind: 'pinned' });
      }
      for (const variable of order) {
        const v = sport.variables[variable]!;
        if (v.correct && !pinned.includes(variable)) {
          lines.push({ text: `Missed: ${v.name}. ${v.explanation}`, good: false, variable, kind: 'missed' });
        }
      }
      // The insight: sports.ts's with every file; the one file's own otherwise (it names nothing that was not tested)
      const insight = files.length === 1 ? files[0]!.content.insight : sport.variableInsight;
      lines.push({ text: insight, good: true, variable: -1, kind: 'insight' });
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
