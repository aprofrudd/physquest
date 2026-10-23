import type { Input, InputState } from '../engine/Input';
import type { DialogueOptions } from '../render/DialogueBox';
import type { SportData } from '../data/sports';
import type { DialogueSystem } from '../systems/Dialogue';

/** What a finished room feeds into its stat: calcStat(dataQuality, variableAccuracy), both 0-1. */
export interface RoomResult {
  dataQuality: number;
  variableAccuracy: number;
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
   * A coach line in the dialogue box. B quits the room (nothing recorded) unless options give the line an
   * exitLabel of '' and the room handles it; the hint says QUIT by default.
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
