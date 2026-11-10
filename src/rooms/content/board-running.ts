// Dr Ellis on the support scores and the SUPPORT BOARD, Distance Running. PROVISIONAL: listed in
// docs/content-review.md ("Support scores and the SUPPORT BOARD"); used verbatim. {NAME} and the button tokens are
// filled by the dialogue. Each check-in line must name the score its room records (tests/support-board.test.ts).
import type { RoomKey } from '../../state/GameState';

export interface BoardContent {
  /** Pages the Director adds to the welcome, before its last page (which sends the player to the ATHLETE room). */
  welcome: readonly string[];
  /** Said after a room's check-in findings, before where to go next: the score that room just set. {PCT} is filled. */
  checkIn: Readonly<Record<RoomKey, string>>;
  /** Under the board's title on its panel (at most 34 characters). */
  note: string;
  /** The note as a screen reader says it. */
  noteSpoken: string;
}

export const BOARD_RUNNING: BoardContent = {
  welcome: [
    "That's the SUPPORT BOARD up on the wall, top left. You get a score from each room: TEST CHOICE, DATA INSIGHT, TRAINING PLAN and EVALUATION.",
    "They mark your work, not Aisha, and add up to your showdown rating. TRAINING PLAN counts most. Face the board and press {A} to read it.",
  ],
  checkIn: {
    testSelection: "That puts your TEST CHOICE score at {PCT}%. You'll see it on the SUPPORT BOARD.",
    variableId: "Your DATA INSIGHT score's {PCT}%. It's on the SUPPORT BOARD now.",
    trainingPrescription: 'Your TRAINING PLAN score is {PCT}%. That one counts most in the showdown, so keep an eye on the SUPPORT BOARD.',
    performancePrediction: "Your EVALUATION score is {PCT}%, so the SUPPORT BOARD has your full showdown rating now.",
  },
  note: 'SCORES GRADE YOUR WORK, NOT AISHA',
  noteSpoken: 'Scores grade your work, not Aisha.',
};

// The board's lines by level index. A level without an entry has no board talk (and its hub has no board).
const BOARD: Readonly<Partial<Record<number, BoardContent>>> = {
  3: BOARD_RUNNING,
};

/** Dr Ellis's board lines for `level`, or undefined. */
export const boardContentFor = (level: number): BoardContent | undefined => BOARD[level];
