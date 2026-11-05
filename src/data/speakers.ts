// Who says a dialogue line: the name tab and frame colour on the dialogue box (see Speaker in DialogueBox).
// Lines with no speaker are the game itself: narration, rules, prompts and results.
import type { Speaker } from '../render/DialogueBox';
import { LEVEL_DATA } from './sports';

// Tab colours, each with white text at 4.5:1 or more
const ATHLETE_COLOR = '#505868'; // slate (classic athletes)
const AISHA_COLOR = '#c83030'; // her red racing vest (5.0:1)
const DIRECTOR_COLOR = '#1a6e6c'; // dark teal, the Director's lanyard (5.6:1)
const RIVAL_COLOR = '#7a3a8a'; // plum (7.0:1)
const AISHA_RIVAL_COLOR = '#3858a8'; // the Distance Running rival's royal-blue vest (6.3:1)

const RUNNING = 3;

/** The athlete's first name, from the start of the level's athlete profile ("Aisha, 26, 5000m runner..."). */
const firstName = (level: number): string => LEVEL_DATA[level]?.athleteProfile.split(',')[0]?.trim() || 'Athlete';

// Built once: the dialogue keeps a reference, so nothing is allocated per line
const ATHLETES: readonly Speaker[] = LEVEL_DATA.map((_, level) => ({
  name: firstName(level),
  color: level === RUNNING ? AISHA_COLOR : ATHLETE_COLOR,
}));

const RIVALS: readonly Speaker[] = LEVEL_DATA.map((sport, level) => ({
  name: sport.rivalName,
  color: level === RUNNING ? AISHA_RIVAL_COLOR : RIVAL_COLOR,
}));

const FALLBACK_ATHLETE: Speaker = { name: 'Athlete', color: ATHLETE_COLOR };
const FALLBACK_RIVAL: Speaker = { name: 'Rival', color: RIVAL_COLOR };

/** The level's athlete (Aisha for Distance Running). */
export const athleteSpeaker = (level: number): Speaker => ATHLETES[level] ?? FALLBACK_ATHLETE;

/** The level's rival scientist in the arena. */
export const rivalSpeaker = (level: number): Speaker => RIVALS[level] ?? FALLBACK_RIVAL;

/** The Performance Director (Dr Ellis). */
export const DIRECTOR_SPEAKER: Speaker = { name: 'Dr Ellis', color: DIRECTOR_COLOR };
