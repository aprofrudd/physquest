import type { Input, InputState } from '../engine/Input';
import type { DialogueOptions } from '../render/DialogueBox';
import type { SportData } from '../data/sports';
import type { DialogueSystem } from '../systems/Dialogue';
import type { TestCall } from '../state/GameState';

/** What a finished room feeds into its stat: calcStat(dataQuality, variableAccuracy), both 0-1. */
export interface RoomResult {
  dataQuality: number;
  variableAccuracy: number;
  /**
   * The ATHLETE room only: good questions asked out of the asks allowed. The scene records it (best kept) instead of
   * a stat; dataQuality and variableAccuracy are then ignored.
   */
  overview?: { good: number; of: number };
  /**
   * The Testing Lab only: the battery that was run (the tests' names in sports.ts, in the order picked) and how the
   * test-day call went. The scene keeps the latest for the Performance Director's check-in and the Data Lab's files.
   */
  testing?: { tests: readonly string[]; call: TestCall };
}

/**
 * What RoomChallengeScene gives a redesigned room. The scene still owns the header, the sport plate, the
 * pause menu, the stat and the completion line; the room owns everything between the plates and the
 * dialogue box.
 */
export interface RoomHost {
  sport: SportData;
  /** Level index (0-3). */
  level: number;
  /** For button names in prompts drawn outside the dialogue box: input.fill('{A}: PICK'), input.label('a'). */
  input: Input;
  dialogue: DialogueSystem;
  /**
   * A coach line in the dialogue box. B on it quits the room (nothing recorded); the hint says QUIT by default.
   * For a question where B must not quit (a LEAVE? / STAY question), use dialogue.show with its own onCancel.
   */
  say(text: string, choices?: string[], onDone?: (choice?: number) => void, options?: DialogueOptions): void;
  /** Several lines in a row (B on any of them quits the room). options.nextLabel names A on the last one. */
  sayAll(texts: string[], onDone: () => void, options?: DialogueOptions): void;
  /** Walk away now: nothing is recorded and the player is back in the room, in front of the athlete. */
  quit(): void;
  /** Record the result: the scene shows the stat line, then goes back to the hub. Call once. */
  complete(result: RoomResult): void;
  /**
   * True until this room's full rules have been read to the end this session (show the full rules), false after
   * (show the short ones). It does not change during a visit.
   */
  firstVisit: boolean;
  /** Call when the full rules have been read to the end, so later visits this session get the short rules. */
  rulesRead(): void;
  /** The room was finished before this visit (a replay: the best stat is kept). */
  replay: boolean;
  /**
   * The Testing Lab's last battery (test names in sports.ts), for the rooms whose content depends on what was
   * tested (the Data Lab's files, the Training Floor's targets). Empty before any battery: the rooms then use every
   * test that gives a file.
   */
  tests: readonly string[];
}

export interface RoomInstrument {
  /**
   * Called every fixed step after the pause menu. `dialogueBusy` is true while the dialogue box has (or has
   * just used) this step's input: animate, but don't act on presses then.
   */
  update(dt: number, inp: InputState, dialogueBusy: boolean): void;
  /** Draws the instrument between the sport plate and the dialogue box (the scene draws the dialogue on top). */
  render(ctx: CanvasRenderingContext2D): void;
  /** State for automated tests (window.__pq.instrument()). */
  debug?(): unknown;
}

export type InstrumentFactory = (host: RoomHost) => RoomInstrument;
