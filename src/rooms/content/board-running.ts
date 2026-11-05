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
    'See the SUPPORT BOARD on the wall, top left? Each room gives you a score: TEST CHOICE, DATA INSIGHT, TRAINING PLAN and EVALUATION.',
    "They grade your work, not Aisha's, and make your showdown rating: TRAINING PLAN counts most. Face the board and press {A} to read it.",
  ],
  checkIn: {
    testSelection: 'Your TEST CHOICE score is {PCT}%. It is up on the SUPPORT BOARD.',
    variableId: 'Your DATA INSIGHT score is {PCT}%. It is up on the SUPPORT BOARD.',
    trainingPrescription: 'Your TRAINING PLAN score is {PCT}%. It counts most in the showdown, so check the SUPPORT BOARD.',
    performancePrediction: 'Your EVALUATION score is {PCT}%. The SUPPORT BOARD now has your full showdown rating.',
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
