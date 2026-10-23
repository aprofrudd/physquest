// Reading a level's variable names (sports.ts) apart: which feature of the file each one is, and the
// short label and value that go on a screen. Pure, so the map and the instrument share one parser.

/** What a variable is on the speed ladder and the lactate curve. */
export type FeatureKind = 'lt1' | 'lt2' | 'vo2max' | 'vvo2max' | 'sprint';

/** Names are matched by their start, so a changed number in brackets never breaks the match. */
const PREFIXES: ReadonlyArray<readonly [string, FeatureKind]> = [
  ['LT1', 'lt1'],
  ['LT2', 'lt2'],
  ['vVO2max', 'vvo2max'], // case matters: 'vVO2max' starts with a lower-case v, 'VO2max' with a capital
  ['VO2max', 'vo2max'],
  ['Max Sprint', 'sprint'],
];

/** The feature a variable name stands for, or undefined for a name this room does not know. */
export const featureOf = (name: string): FeatureKind | undefined => PREFIXES.find(([prefix]) => name.startsWith(prefix))?.[1];

export interface NameParts {
  /** The words before the brackets: 'LT1 Pace'. */
  words: string;
  /** Everything up to the number: 'LT1 Pace ('. */
  head: string;
  /** The first number in the brackets, exactly as written: '3:45', '65', '28'. */
  value: string;
  /** Everything after the number: '/km)', ' ml/kg/min)', ' km/h)'. */
  tail: string;
}

/** 'LT1 Pace (3:45/km)' -> { words: 'LT1 Pace', head: 'LT1 Pace (', value: '3:45', tail: '/km)' }. */
export const partsOf = (name: string): NameParts => {
  const match = /^((.*?)\s*\(\s*)(\d+(?::\d{2})?(?:\.\d+)?)(.*)$/.exec(name);
  if (!match) return { words: name, head: name, value: '', tail: '' };
  return { head: match[1] ?? '', words: match[2] ?? name, value: match[3] ?? '', tail: match[4] ?? '' };
};

/** Words that say what kind of number it is, not which variable: dropped from short labels. */
const FILLER = new Set(['pace', 'speed', 'max']);

/** The longest label a video-wall screen has room for. */
export const LABEL_MAX = 6;

/**
 * A short label for a screen: the name's own words without the filler ('Max Sprint Speed' -> 'SPRINT'), and
 * a trailing 'max' dropped when it would not fit ('vVO2max Pace' -> 'VVO2'). At most LABEL_MAX characters.
 */
export const shortLabel = (name: string): string => {
  const kept = partsOf(name).words.split(' ').filter(word => !FILLER.has(word.toLowerCase()));
  let label = kept.join(' ');
  if (label.length > LABEL_MAX) label = label.replace(/max$/i, '');
  return label.slice(0, LABEL_MAX).toUpperCase();
};

export interface ScreenText {
  label: string;
  /** The value exactly as written in the name. */
  value: string;
}

/** What one video-wall screen shows for a variable name. */
export const screenText = (name: string): ScreenText => ({ label: shortLabel(name), value: partsOf(name).value });

/** 'm:ss' for a pace in seconds per kilometre. */
export const paceText = (secondsPerKm: number): string => {
  const whole = Math.round(secondsPerKm);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
};

/** The pace (m:ss per km) of a speed in km/h. */
export const paceOf = (kmh: number): string => paceText(3600 / kmh);
