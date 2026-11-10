// Distance Running (level 4: Aisha, 5000 m): the RACE TO THE LINE showdown's game text and the case study's ending
// (Phase 4 of the scientific support process: results, evaluation and conclusion; Ruddock et al. 2018, Table 4,
// docs/reference/scientific-support-process.txt). PROVISIONAL: every line is listed in docs/content-review.md
// ("RACE TO THE LINE and the ending", Q1.. and F1..) and used verbatim.
//
// Tokens: {NAME} and the button names ({A}...) are filled by the dialogue. The others are filled by the game:
// {RATING} and {TARGET} (percent), {RIVAL} (the rival's name), {TIME} and {RIVAL_TIME} (finishing times, m:ss),
// {DIST} (how far from the line the gauge ran dry, e.g. "300 M" or "A LAP"), {PCT} (share of the gauge left),
// {STRONG}/{WEAK} (support score names) with {STRONG_PCT}/{WEAK_PCT}, {EVAL_PCT}, {FOCUS} and {ROOM}.

/** The bout itself: names, rules card, practice straight, on-screen labels and the defeat advice. */
export interface RaceContent {
  /** The arena's title (replaces sports.ts bossEvent for this bout). */
  event: string;
  /** Beside the button glyph during the race (scale 2: at most 13 characters). */
  prompt: string;
  /** The rules card the first time this session: two pages. {RATING}, {TARGET}, {FOCUS}. */
  rules: readonly [string, string];
  /** The rules card after that: one line. {TARGET}. */
  rulesShort: string;
  /** The practice straight, before the first race of a session. */
  practice: {
    /** Under the prompt while it runs (at most 40 characters). */
    banner: string;
    /** After it, by what the player did; the last page says the race is next (A: READY). */
    done: readonly string[]; // held and let go
    faded: readonly string[]; // emptied the gauge
    neverReleased: readonly string[]; // held A the whole time
    idle: readonly string[]; // never pressed A
  };
  /** Status under the gauge (at most 40 characters each): settled is the practice's, onPace the race's. */
  status: { surging: string; settled: string; onPace: string; faded: string };
  /** The gauge's label (left of it). */
  gauge: string;
  /** Defeat advice on the results screen, in capitals (the science was good enough, the kick was not). */
  advice: { early: string; late: string };
}

/** The ending: back in the hub after the race, Aisha on the result, then Dr Ellis's debrief. */
export interface FinaleContent {
  race: RaceContent;
  /** The results screen when the race completes the case study (it no longer says GAME COMPLETE). */
  clear: { title: string; lines: readonly string[]; prompt: string; spoken: string };
  win: {
    /** Aisha, on the race. {TIME}, {RIVAL_TIME}. */
    athlete: readonly string[];
    /** Dr Ellis's debrief, in order: */
    director: {
      opening: readonly string[]; // the result, and the aims: were they achieved?
      found: readonly string[]; // what the support found, phase by phase
      board: string; // the SUPPORT BOARD: strongest and weakest score
      boardEven: string; // ... when all four are level
      real: { strong: readonly string[]; weak: readonly string[] }; // was the change real (EVALUATION band)
      next: readonly string[]; // an honest reflection and next steps
      thanks: readonly string[]; // thanks by name, and where the player is now
    };
  };
  lose: {
    /** Aisha, by why the race was lost. */
    athlete: { early: readonly string[]; late: readonly string[]; rating: readonly string[]; idle: readonly string[] };
    /** Dr Ellis, shorter: the board and what to do. */
    director: { rating: readonly string[]; kick: readonly string[]; board: string; boardEven: string; stay: readonly string[] };
  };
  /** Dr Ellis when talked to in the hub after the case study is won. */
  directorAfter: readonly string[];
}

/** EVALUATION at or above this share is a "strong" judgement of whether the change was real. */
export const EVAL_STRONG = 0.7;

export const FINALE_RUNNING: FinaleContent = {
  race: {
    // Q1
    event: 'RACE TO THE LINE',
    // Q2
    prompt: 'HOLD TO KICK!',
    rules: [
      // Q3
      "Your rating, {RATING}%, mostly your {FOCUS} score, sets the size of Aisha's KICK gauge: her D', how far she can run above critical speed.",
      // Q4
      "Let go: she sits on the rival's pace, draining the gauge slowly. Hold {A}: she kicks, draining it fast. Beat the TARGET of {TARGET}%.",
    ],
    // Q5
    rulesShort: 'Beat {TARGET}% to win. Sit on the pace, hold {A} to kick, and run the gauge dry at the line.',
    practice: {
      // Q6
      banner: 'HOLD TO SURGE, LET GO TO SETTLE',
      // Q7
      done: [
        "That's the kick: hold {A} and she surges, let go and she settles at critical speed. Empty, she fades, and it refills only slowly.",
        "In the race, let go and she sits on the rival's pace, just above critical speed, so the gauge drains slowly. Save the rest for the finish.",
      ],
      // Q8
      faded: [
        'See the fade? Once the gauge is empty she drops below critical speed, and only there does it refill, slowly.',
        "In the race, let go and she sits on the rival's pace, just above critical speed, so the gauge drains slowly. Kick so it runs dry at the line.",
      ],
      // Q9
      neverReleased: [
        'She surged the whole way. Let go of {A} and she settles at critical speed, saving the gauge. Empty, it refills only slowly.',
        "In the race, let go and she sits on the rival's pace, just above critical speed, so the gauge drains slowly. Save the rest for the finish.",
      ],
      // Q10
      idle: [
        'Hold {A} to make her surge, and let go to settle her at critical speed. Empty, she fades, and it refills only slowly.',
        "In the race, let go and she sits on the rival's pace, just above critical speed, so the gauge drains slowly. Save the rest for the finish.",
      ],
    },
    // Q11
    status: { surging: 'SURGING', settled: 'AT CRITICAL SPEED', onPace: "ON THE RIVAL'S PACE", faded: 'FADING: BELOW CRITICAL SPEED' },
    // Q12
    gauge: "KICK (D')",
    advice: {
      // Q13
      early: 'YOU KICKED TOO EARLY: THE GAUGE RAN DRY WITH {DIST} TO GO.',
      // Q14
      late: 'YOU KICKED TOO LATE: SHE CROSSED THE LINE WITH {PCT}% OF HER KICK UNUSED.',
    },
  },

  clear: {
    // F1
    title: 'CASE COMPLETE!',
    // F2
    lines: ["AISHA'S CASE STUDY IS DONE.", 'DR ELLIS IS WAITING IN THE', 'HUB FOR YOUR DEBRIEF.'],
    // F3
    prompt: 'PRESS {A} FOR THE DEBRIEF',
    // F2, as a screen reader says the title and lines
    spoken: "Case complete! Aisha's case study is done. Dr Ellis is waiting in the hub for your debrief.",
  },

  win: {
    // F4
    athlete: [
      'We did it, {NAME}! {TIME}, and I beat her to the line. She ran {RIVAL_TIME}.',
      'I sat on her shoulder, then kicked and held it all the way in. For once I had something left on the last lap.',
    ],
    director: {
      // F5 (Table 4: were the aims and objectives achieved?)
      opening: [
        "Well done, {NAME}! That's the case study finished. Let's debrief it like we would after any training block.",
        "We wanted her to have a finish she could rely on. She won the race to the line, but that's one race. What else can we actually say?",
      ],
      // F6 (Table 4: what were the main findings?)
      found: [
        'From the overview and needs analysis, her base was good and her finish let her down. The critical speed trials agreed, with a D prime of about 140 m.',
        'So the plan put fast reps on fresh legs to build it, and after the block her last 400 m came down from 72 s to 70 s.',
      ],
      // F7 (Table 4: what worked and what did not?)
      board: 'Looking at the SUPPORT BOARD, your best score was {STRONG} at {STRONG_PCT}% and your lowest was {WEAK} at {WEAK_PCT}%.',
      // F8
      boardEven: 'On the SUPPORT BOARD, all four of your scores came out level at {STRONG_PCT}%.',
      real: {
        // F9 (Table 4: were the changes practically meaningful?)
        strong: [
          "You judged the change well, too. Her last 400 m beat both the typical error and the smallest worthwhile change, so it's real and it's worth having.",
          'Her VO2max went up, but not by enough to matter. It was her finish that changed.',
        ],
        // F10
        weak: [
          'Your EVALUATION was {EVAL_PCT}%, so be careful what you claim. Her last 400 m did beat the typical error and the smallest worthwhile change.',
          "But one race doesn't prove much, and the VO2max rise was real but too small to matter. Check every change against both before you report it.",
        ],
      },
      // F11 (Table 4: what do you still need to know? How does it influence future practice?)
      next: [
        "One gap, though. We never re-measured her D prime, so we're guessing it grew from how she finished. Next block, retest her critical speed and D prime.",
        'After that, track her last 400 m over a few races, write it up for her coach in plain numbers, and work on your weakest score.',
      ],
      // F12
      thanks: [
        "Thanks, {NAME}. That was proper support from start to finish. And thanks to Aisha for putting her trust in us.",
        "The rooms are still open if you want to improve a score, and the ARENA's there if you fancy a rematch.",
      ],
    },
  },

  lose: {
    athlete: {
      // F13
      early: ['I went too soon, {NAME}. The tank was empty before the line, and she came past me.'],
      // F14
      late: ['I waited too long, {NAME}. I still had legs at the line, but she was already gone.'],
      // F15
      rating: ["I gave it everything, {NAME}, but she was stronger on the last lap. I didn't have enough in the tank."],
      // F16
      idle: ['I never got the call to kick, {NAME}. Hold {A} and I go.'],
    },
    director: {
      // F17
      rating: [
        "Not this time, {NAME}. Her rating couldn't beat the TARGET, and that's mostly your {FOCUS} score. Replay the {ROOM} room to bring it up.",
      ],
      // F18
      kick: ["Not this time, {NAME}, but we'll learn from it. The science was good enough. It was the timing of the kick that cost her."],
      // F19
      board: 'On the SUPPORT BOARD, your best score is {STRONG} at {STRONG_PCT}% and your lowest is {WEAK} at {WEAK_PCT}%.',
      // F20
      boardEven: 'On the SUPPORT BOARD, all four of your scores are level at {STRONG_PCT}%.',
      // F21
      stay: ['The rooms are all still open. Work on a score or rethink when she kicks, then take her back to the ARENA.'],
    },
  },

  // F22
  directorAfter: [
    "That's Aisha's case study done, {NAME}. The rooms are still open if you want to improve a score, and the ARENA's there if you fancy a rematch.",
  ],
};

// By level index. A level without an entry keeps its classic bout and ending.
const FINALE: Readonly<Partial<Record<number, FinaleContent>>> = {
  3: FINALE_RUNNING,
};

/** The race and the ending for `level`, or undefined. */
export const finaleContentFor = (level: number): FinaleContent | undefined => FINALE[level];
