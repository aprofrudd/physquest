// What the Performance Director says in the hub between rooms, as plain lines (no dialogue, no drawing): the check-in
// after each room, picked by what the room produced, and the "after" lines once everything so far is talked over.
// OverworldScene shows them; the needs chat is driven there too. {NAME} and the button tokens are left for the
// dialogue to fill; {ROOM} is filled here with the next room's hub sign.
import type { Bands, MeetContent } from '../rooms/content/meet-types';
import {
  ROOM_KEYS,
  ROOM_STAT,
  doorLabel,
  labelAfter,
  meetOf,
  nextDoor,
  retestDue,
  testGivesFile,
  type GameState,
  type RoomKey,
} from '../state/GameState';

/** How a room went, from the stat it awards (as the player sees it, a whole percent): strong 80+, mixed 50+, weak. */
export const bandFor = (stat: number): keyof Bands => {
  const pct = Math.round(stat * 100);
  return pct >= 80 ? 'strong' : pct >= 50 ? 'mixed' : 'weak';
};

const fillRoom = (lines: readonly string[], room: string): string[] => lines.map(l => l.replace(/\{ROOM\}/g, room));

/**
 * What the battery as a whole means: every test with a Data Lab file was run (full), one of them is missing, or none
 * was run (DATA stays shut until TESTING is run again). Nothing before any battery.
 */
export const batteryLines = (content: MeetContent, state: GameState): string[] => {
  const tests = meetOf(state).tests;
  if (tests.length === 0) return [];
  const b = content.checkIns.battery;
  if (retestDue(state) || !tests.some(t => testGivesFile(state.currentLevel, t))) return [...b.none];
  const missing = Object.keys(b.missing).filter(t => !tests.includes(t));
  return missing.length > 0 ? missing.flatMap(t => b.missing[t] ?? []) : [...b.full];
};

/** What the check-in after `key` found (without its "what next" lines). */
export const checkInFindings = (content: MeetContent, state: GameState, key: RoomKey): string[] => {
  const c = content.checkIns;
  const meet = meetOf(state);
  if (key === 'testSelection') {
    const byTest = meet.tests.flatMap(t => c.testing[t] ?? []);
    const call = meet.call ? c.testingCall[meet.call] : [];
    return [...byTest, ...batteryLines(content, state), ...call];
  }
  const bands = key === 'variableId' ? c.data : key === 'trainingPrescription' ? c.training : c.analysis;
  const found = [...bands[bandFor(state.playerStats[ROOM_STAT[key]])]];
  // After the Data Lab: what each file it had showed (the battery's tests, or every file before any battery)
  if (key === 'variableId') {
    const files = meet.tests.length > 0 ? meet.tests : Object.keys(c.dataFiles);
    for (const t of files) found.push(...(c.dataFiles[t] ?? []));
  }
  return found;
};

/** What to do after `key` (to the next room, or the ARENA after ANALYSIS). */
export const checkInNext = (content: MeetContent, key: RoomKey, state?: GameState): string[] => {
  const c = content.checkIns;
  if (key === 'testSelection' && state && retestDue(state)) return [...c.retestNext];
  const next =
    key === 'testSelection' ? c.testingNext : key === 'variableId' ? c.dataNext : key === 'trainingPrescription' ? c.trainingNext : c.analysisNext;
  return fillRoom(next, labelAfter(key));
};

/** The whole check-in after `key`: what it found, then what next. */
export const checkInLines = (content: MeetContent, state: GameState, key: RoomKey): string[] =>
  fillRoom([...checkInFindings(content, state, key), ...checkInNext(content, key, state)], labelAfter(key));

/** The furthest room done (whose check-in is the latest), or null before TESTING. */
export const latestRoom = (state: GameState): RoomKey | null => {
  for (let i = ROOM_KEYS.length - 1; i >= 0; i--) {
    const key = ROOM_KEYS[i]!;
    if (state.roomProgress[key]) return key;
  }
  return null;
};

/**
 * Talking to the Director when nothing is due: the latest room's findings again, then the "after" lines pointing at
 * the next room ({ROOM}: its hub sign, or ARENA). Before TESTING, the needs chat's reminder.
 */
export const directorAgain = (content: MeetContent, state: GameState): string[] => {
  const latest = latestRoom(state);
  if (!latest) return [...content.needs.reminder];
  return [...checkInFindings(content, state, latest), ...fillRoom(content.directorAfter, doorLabel(nextDoor(state)))];
};
