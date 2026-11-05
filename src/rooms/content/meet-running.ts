// Distance Running (level 4: Aisha, 5000 m): the Performance Director's welcome in the hub and the first meeting
// with Aisha in the ATHLETE room. The questions follow Phase 1 (Athlete overview) of the scientific support
// process (Ruddock, Boyd, Winter and Ranchordas 2018, IJSPP; docs/reference/scientific-support-process.txt,
// Table 1). Provisional and open for Alan's review: docs/content-review.md lists every item (P1.., M1..).
// Aisha's physiology is in sports.ts and running.ts (the profile Alan approved on 2026-11-05: 5 km PB 16:20, good
// aerobic base, a small D prime, the last 400 m the weak point); her PB and recent races (M11) and the
// biographical detail here (goals, job, coach, training week, an old injury) are provisional.
import type { MeetContent } from './meet-types';

export const MEET_RUNNING: MeetContent = {
  director: { name: 'DR ELLIS', role: 'PERFORMANCE DIRECTOR' },

  // P1-P5 (P4 is now two pages, P4a and P4b, so {A} and the stats fit)
  directorWelcome: [
    "Welcome, {NAME}. I'm Dr Ellis, Performance Director here at the Sports Performance Centre. Glad to have you with us.",
    "You're our new sport scientist. Your first athlete is Aisha, a 5000 m runner, and the rooms here are where you'll support her.",
    'Take them in order: ATHLETE, TESTING, DATA, TRAINING, then ANALYSIS. Finish all five and the ARENA opens for the showdown.',
    'Walk through a door to enter a room, and press {A} to talk. The arrow points to the next door. {SELECT} shows objectives.',
    '{START} pauses and {B} leaves any chat. Good work in each room raises your support scores on the board. Your work saves as you go.',
    'Aisha is waiting in the ATHLETE room. Go and meet her, and get to know her before you test anything.',
  ],

  // P6
  directorReminder: [
    'Aisha is waiting in the ATHLETE room, {NAME}. Get to know her first: her goals, her history, her week. Tests can wait.',
  ],

  // P7, P8 ({ROOM} is the next room's hub sign; it can be the ARENA, so the line never says "the {ROOM} room")
  directorAfter: [
    'Good work so far, {NAME}. Next stop: {ROOM}. The arrow points the way.',
    '{SELECT} shows your objectives any time.',
  ],

  // N1-N9: the needs chat (Phase 2, needs analysis; Ruddock et al. 2018, Table 2). It names no test: choosing
  // one is the Testing Lab's job. Everything agreed here is a working idea that testing must check.
  needs: {
    // N1
    intro: [
      "Good to see you again, {NAME}. You've met Aisha, so before any testing, let's work out what she needs.",
      "First the event, then Aisha herself, then what testing must tell us. I'll ask, you answer.",
    ],
    questions: [
      {
        // N2, Table 2: physiological demands of the sport; external and internal demands
        id: 'demands',
        ask: ['Start with the event. What does a 5000 m race demand most?'],
        options: [
          {
            text: 'Mostly aerobic, fast finish',
            good: true,
            reply: [
              'Yes. Most of the energy comes from aerobic metabolism, at a high share of her VO2max for the whole race.',
              'And races are often won on the last lap, so the finish matters too.',
              'We can describe it as external demands, like pace, and internal ones, like heart rate, VO2 and lactate.',
            ],
          },
          {
            text: 'Mostly sprint power',
            good: false,
            reply: [
              'Not quite. A 5000 m lasts a quarter of an hour, so most of the energy is aerobic. Speed matters at the finish, on top of a big aerobic engine.',
            ],
          },
          {
            text: 'Strength and muscle size',
            good: false,
            reply: [
              'Strength helps keep her robust, but a 5000 m is decided by her aerobic engine and her finish, not by how much she can lift.',
            ],
          },
          {
            text: 'A steady pace, no surges',
            good: false,
            reply: [
              'Not in her races. Championship 5000 m races often surge, and many are won on the last lap. She needs a high steady pace and a fast finish.',
            ],
          },
        ],
      },
      {
        // N3, Table 2: strengths and areas for improvement (from the athlete overview, Table 1)
        id: 'strengths',
        ask: ['Now Aisha. From your first meeting, where is she strong, and where do races slip away?'],
        options: [
          {
            text: 'Good base; loses the last lap',
            good: true,
            reply: [
              "That's my reading too. Years of 80 to 90 km weeks have given her a good aerobic base.",
              'She holds the pace all race, then gets outkicked in the final 400 m.',
            ],
          },
          {
            text: 'Weak base; fades mid-race',
            good: false,
            reply: [
              "Not from what she told you. She holds the pace all race on 80 to 90 km a week. It's the last lap where races slip away.",
            ],
          },
          {
            text: 'She starts too fast',
            good: false,
            reply: [
              "She didn't say that. She holds the pace well. It's the kick in the last 300 to 400 m that beats her.",
            ],
          },
          {
            text: 'No weak spot yet',
            good: false,
            reply: [
              'Everyone has one, and she named hers: when someone kicks with 300 m to go, she has nothing extra.',
            ],
          },
        ],
      },
      {
        // N4, Table 2: what mechanisms are well developed and what need improving (as a hypothesis, before testing)
        id: 'hypothesis',
        ask: ["So what might she need? It's a working idea for now, and testing has to check it."],
        options: [
          {
            text: 'Her finish, on a sound base',
            good: true,
            reply: [
              'Good, as a working idea. Her base looks sound, and she does no sprint work at all, so her finishing speed may be the gap.',
              'Her aerobic paces need measuring too, so every session is set at the right intensity. Testing will tell us if we are right.',
            ],
          },
          {
            text: 'Just more miles',
            good: false,
            reply: [
              "She's already on 85 km a week. More of the same is unlikely to give her a kick, and it adds injury risk after her stress fracture.",
            ],
          },
          {
            text: 'New racing shoes',
            good: false,
            reply: [
              "She already races in carbon plates. Shoes won't explain why she has nothing extra on the last lap.",
            ],
          },
          {
            text: 'Lose some weight',
            good: false,
            reply: [
              'Nothing she told you points to that, and pushing a runner to lose weight can harm her health. Stick to what we know.',
            ],
          },
        ],
      },
      {
        // N5, Table 2: based on the needs analysis, what tests have you chosen (what must they measure)?
        id: 'measure',
        ask: ['Last one. Before you choose a test, what must testing tell us?'],
        options: [
          {
            text: 'Zones and finishing speed',
            good: true,
            reply: [
              'Exactly. Her paces at her thresholds set her training zones, and how much she has above the pace she can sustain shows what she has for a kick.',
              'Choose tests that are valid and reliable for a runner, and that answer that question.',
            ],
          },
          {
            text: 'Her VO2max, nothing else',
            good: false,
            reply: [
              "VO2max shows the size of her engine, but on its own it doesn't set her training paces or show how fast she can finish.",
            ],
          },
          {
            text: 'How strong her legs are',
            good: false,
            reply: [
              'Strength can wait. Our question is about her paces and her finish, so testing must give us her training zones and her finishing speed.',
            ],
          },
          {
            text: 'Her body fat',
            good: false,
            reply: [
              "That won't tell us why she loses the last lap, or how fast to train. We need her training zones and her finishing speed.",
            ],
          },
        ],
      },
    ],
    // N6
    agreed: [
      'So here is our working idea, {NAME}: her aerobic base is good, but her finish lets her down, and nothing in her week trains it.',
      "It's an idea, not a result. Testing must find her training zones, and how much speed she has for the finish.",
      'The TESTING lab is open. Choose a battery of tests that answers our question, and check she is ready on the day.',
    ],
    // N7 (the Testing Lab band: "AISHA NEEDS: ZONES AND FINISHING SPEED"; same as running.ts testing.needs)
    testingNeeds: 'ZONES AND FINISHING SPEED',
    // N8 (said after the athlete profile in the Testing Lab brief)
    testingBrief: 'Testing must find her training zones, and how much speed she has for the finish.',
    // N9
    reminder: [
      'The TESTING lab is open, {NAME}. Choose tests that give us her training zones and her finishing speed.',
    ],
  },

  // K1-K22: the Director's check-ins after each room. Nothing claims a result before the room that produces it; after
  // it, the check-in may quote the real numbers (the clean files' values, from sports.ts and running.ts).
  checkIns: {
    // K1-K4: one entry per test in the battery (what it measures, whether it helps with the question)
    testing: {
      // K1, Table 2: rationale for the test; valid and sensitive for the athlete
      'Lactate Profile': [
        'You ran a lactate profile, {NAME}: stages of rising pace with a blood lactate after each, then a ramp to exhaustion.',
        'It gives her LT1 and LT2 paces, her heart rate at each, and her VO2max and vVO2max: the anchors of her training zones.',
      ],
      // K2
      'Critical Speed Test': [
        'You ran a critical speed test: three all-out trials on the track.',
        'They give her critical speed, the fastest pace she can sustain, and D prime, how far she can run faster than it: her reserve for the finish.',
      ],
      // K3
      'Wingate Test': [
        'The Wingate test is 30 seconds all-out on a bike: peak and mean anaerobic power. Aisha runs, so it gives no running paces and no zones.',
      ],
      // K4
      'Beep Test': [
        'The beep test gives a rough VO2max estimate from shuttles with turns: one number, no paces, so no zones.',
      ],
    },
    // K16-K19: the battery as a whole
    battery: {
      // K16
      full: [
        'Together they answer our question: her zones from her thresholds and critical speed, and her finish from D prime.',
      ],
      missing: {
        // K17
        'Critical Speed Test': [
          "But without the critical speed trials we have no D prime, so we can't yet say how much she has for the finish. Next time, add them.",
        ],
        // K18
        'Lactate Profile': [
          'But without the lactate profile we have no thresholds, so her easy and threshold zones have no anchors. Next time, add it.',
        ],
      },
      // K19
      none: [
        'So neither test gives running zones or D prime, {NAME}. Only the lactate profile or the critical speed test can.',
        'Those files are what the DATA lab works on, so it stays shut for now.',
      ],
    },
    // K5-K7: the test-day call
    testingCall: {
      right: ['You read her readiness well on test day, so the results can be trusted and compared with her later tests.'],
      ranAnyway: [
        "She wasn't ready on test day, but the tests went ahead. Fatigue, caffeine or illness can shift her results, so treat these files with care.",
        "When a readiness check fails, re-book once she's rested and well.",
      ],
      needlessRebook: [
        'She was ready on the day, so the re-booking cost two days for nothing. A normal routine is the time to test.',
      ],
    },
    // K8
    testingNext: [
      'Next, the DATA lab. Her files are in: clean out the glitches, then choose the key variables that should guide her training.',
    ],
    // K20
    retestNext: [
      'Go back to the TESTING lab and re-test her with a better battery. You can run it as often as you need.',
    ],
    // K9: after the Data Lab, by how well it went; then K21, what each file showed (real numbers)
    data: {
      strong: ['Clean files and the right key variables, {NAME}. Those numbers now give every key session a target.'],
      mixed: [
        'A fair job, {NAME}, but a few glitches or key variables slipped. A glitch left in changes what the numbers say.',
      ],
      weak: [
        'Those files needed more care, {NAME}. Glitches left in, or real readings taken out, change what the numbers say.',
        'The key variables are the ones that set her training paces or explain her finish.',
      ],
    },
    // K21
    dataFiles: {
      'Lactate Profile': [
        'The clean profile puts LT1 at 4:08/km and LT2 at 3:34/km. Her VO2max is 58 ml/kg/min, and her vVO2max pace 3:09/km.',
      ],
      'Critical Speed Test': [
        'The trials put her critical speed at 3:22/km, with a D prime of only about 140 m. That is why she has so little left for the last lap.',
      ],
    },
    // K10
    dataNext: [
      'Next, the TRAINING room. Plan her week around those paces, with the key sessions on fresh legs.',
    ],
    // K11: after the Training Floor
    training: {
      strong: [
        'A well-balanced week, {NAME}. Her key sessions land on fresh legs, with easy runs for volume and enough rest to recover.',
        'The fast reps are the sessions that build her D prime for the last lap.',
      ],
      mixed: [
        "A decent week, but some key sessions land on tired legs, so they won't do their full job.",
        'Keep about two days between hard days, and let easy runs and rest fill the gaps.',
      ],
      weak: [
        'That week would leave her too tired, or too short of key work, to change much.',
        'Key sessions need fresh legs: about two days between hard days, 5 or more sessions and 1 to 3 rest days.',
      ],
    },
    // K12
    trainingNext: [
      'Next, the ANALYSIS room. Forecast her retest after the 10-week block, then judge whether each change is real or just noise.',
    ],
    // K13: after the Analysis Room (Table 4: were the changes practically meaningful?), with the retest numbers
    analysis: {
      strong: [
        'Well judged, {NAME}. Her last 400 m went from 72 s to 70 s: beyond the typical error (0.6 s) and the smallest worthwhile change (0.8 s).',
        'Her VO2max went from 58 to 60 ml/kg/min: beyond its typical error, but short of its smallest worthwhile change. Real, but too small to matter.',
      ],
      mixed: [
        'Some calls were close, {NAME}. Compare each change with the typical error first, then with the smallest worthwhile change.',
        'Her last 400 m, 72 s to 70 s, clears both: worth acting on. Her VO2max, 58 to 60 ml/kg/min, is real but too small to matter.',
      ],
      weak: [
        'Those calls need another look. A change inside the typical error may be noise, and it must beat the smallest worthwhile change to matter.',
        'Her last 400 m, 72 s to 70 s, clears both: worth acting on. Her VO2max, 58 to 60 ml/kg/min, is real but too small to matter.',
      ],
    },
  // K14
    analysisNext: [
      "That's the support process done, {NAME}: overview, needs, testing, training and evaluation.",
      'The ARENA is open. Take Aisha into the showdown.',
    ],
    // K15
    doorRefusal: 'TALK TO DR ELLIS FIRST.',
    // K22
    retestRefusal: 'RE-TEST IN TESTING FIRST.',
  },

  // M1-M3
  athleteIntro: [
    "Hi, you must be {NAME}. I'm Aisha. I'm 26 and I race the women's 5000 m.",
    'My aerobic base is good, but I keep getting outkicked on the last lap. Races slip away in the final 400 m.',
    "Dr Ellis said you'd want a chat before any testing. Ask me anything.",
  ],

  // M4, M5
  rules: [
    'Get to know Aisha before any testing. Pick a question and press {A}. You can ask 5 before she heads off to train.',
    'Good first-meeting questions add a note to your notebook. Some questions can wait, and some don\'t help at all.',
  ],
  rulesShort: 'Ask 5 questions. Good ones go in your notebook.',

  // M6-M17
  questions: [
    {
      // M6, Table 1 row 1: goals (short, medium, long term; SMART; how far away)
      id: 'goals',
      ask: 'What are your goals?',
      answer: [
        'This season, to stop losing races on the last lap. Next summer, to make the national championship final.',
        'Long term, I want to run for GB. The nationals are about nine months away, so there is time, but not loads.',
      ],
      good: true,
      note: 'GOAL: NATIONALS FINAL',
      said: 'Noted: her goal is the nationals final.',
      why: 'Knowing her short, medium and long-term goals, and how far away each is, shows what needs to change and by when.',
    },
    {
      // M7, Table 1 row 2: why seek support; expectations
      id: 'why',
      ask: 'Why do you want our support?',
      answer: [
        "I keep getting outkicked and I don't know why. I'd like someone to measure what's going on instead of guessing.",
        'I hope you can give me and my coach a clear plan that we both trust.',
      ],
      good: true,
      note: 'EXPECTS: EVIDENCE + PLAN',
      said: 'Noted: she expects evidence and a plan.',
      why: 'Her reasons and expectations show what she thinks of sport science and what she hopes the support will give her.',
    },
    {
      // M8, Table 1 rows 2-3: previous support; coaching team; multidisciplinary team
      id: 'support',
      ask: 'Who has supported you so far?',
      answer: [
        'My coach, Pete, has coached me for six years. I see a club physio when something hurts. No nutritionist or psychologist.',
        'I did one lab test at university. I got a printout of numbers and nobody explained them.',
      ],
      good: true,
      note: 'COACH PETE, CLUB PHYSIO',
      said: 'Noted: coach Pete and a club physio.',
      why: 'Past support shapes her expectations, and knowing her coach and support team lets you check what you learn with them.',
    },
    {
      // M9, Table 1 row 3: what does she think she needs to improve
      id: 'improve',
      ask: 'What do you think you need?',
      answer: [
        "My finish. I can hold the pace all race, but when someone kicks with 300 m to go, I've got nothing extra.",
      ],
      good: true,
      note: 'SAYS: NO FINISHING KICK',
      said: 'Noted: she says she has no finishing kick.',
      why: "Her own view of what to improve is a starting point for the needs analysis, to compare with what the tests show.",
    },
    {
      // M10, Table 1 rows 4-5: lifestyle demands; financial and logistical constraints
      id: 'life',
      ask: 'What else fills your week?',
      answer: [
        "I work 30 hours a week as a teaching assistant, so I train before work and in the evenings. Some days are long.",
        "I've no funding yet, so I pay my own way. The track is 40 minutes away, so I only get there once or twice a week.",
      ],
      good: true,
      note: 'WORKS 30 H; SELF-FUNDED',
      said: 'Noted: she works 30 hours a week and funds herself.',
      why: 'Her job, money and travel limit her time and energy, so any plan has to fit around them to work.',
    },
    {
      // M11, Table 1 row 6: training history; injuries
      id: 'history',
      ask: 'Training history? Injuries?',
      answer: [
        "I've run since I was 12, and on 80 to 90 km a week for the last five years.",
        'I had a stress fracture in my foot at 22. It took four months to come back. Nothing since, touch wood.',
        "My 5000 m PB is 16:20, from last summer. This season I've run 16:28 and 16:35, and lost both on the last lap.",
      ],
      good: true,
      note: 'PB 16:20; FOOT FRACTURE',
      said: 'Noted: a 16:20 PB, and an old stress fracture in her foot.',
      why: 'How she has trained in the past, and what has injured her, is a good guide to how she can train in future.',
    },
    {
      // M12, Table 1 rows 7-8: typical training year, week and day; training load monitoring
      id: 'week',
      ask: 'How is your training set out?',
      answer: [
        'Cross-country in winter, track in summer, aiming to peak for the nationals. About 85 km a week.',
        'Track session Tuesday, tempo run Thursday, long run Sunday, the rest easy. No sprint work at all.',
        "My watch logs distance, pace and heart rate, but I don't record how hard sessions feel.",
      ],
      good: true,
      note: 'NO SPRINTS; NO RPE LOG',
      said: 'Noted: no sprint work, and no log of how hard sessions feel.',
      why: 'Her year, week and day show where new work could fit, and how she tracks load shows what you can measure.',
    },
    {
      // M13, Table 1 row 9: basic good practices (sleep, nutrition, recovery)
      id: 'basics',
      ask: 'How are your sleep and food?',
      answer: [
        'About seven hours on work nights, less before early runs.',
        'I eat well, but after evening sessions I often get home too late to eat properly until bedtime.',
      ],
      good: true,
      note: 'SLEEP 7 H; LATE REFUEL',
      said: 'Noted: about seven hours of sleep, and late refuelling.',
      why: 'Check that the basics of sleep, food and recovery are in place before adding anything more complex.',
    },
    {
      // M14, weaker: jumps to a test before the overview and needs analysis
      id: 'test-now',
      ask: 'Can we do a VO2max test now?',
      answer: [
        "What, today? I've got training tonight and I haven't eaten for it. What would the test tell us?",
      ],
      good: false,
      note: 'A test comes later, once you know what she needs.',
      why: 'Tests should answer questions from the needs analysis; picking one before the overview risks measuring the wrong thing.',
    },
    {
      // M15, weaker: jumps to the intervention (Phase 3) without the coach
      id: 'plan-now',
      ask: 'Shall I write your new plan?',
      answer: [
        "You haven't asked how I train yet. And Pete writes my plan, so he'd want a say.",
      ],
      good: false,
      note: 'A plan comes later, and with her coach.',
      why: 'Planning is a later phase: a plan made before the overview and needs analysis cannot target what she needs.',
    },
    {
      // M16, weaker: a leading question
      id: 'more-miles',
      ask: 'You just need more miles, eh?',
      answer: [
        "Maybe? I'm already on 85 km a week. I'm not sure more miles will fix my last lap.",
      ],
      good: false,
      note: "A leading question gets your answer, not hers.",
      why: 'Open questions let the athlete say what she thinks; leading questions plant your own guess and can harm rapport.',
    },
    {
      // M17, weaker: a Phase 2 (needs analysis) question asked too early (Table 2: clothing and equipment)
      id: 'shoes',
      ask: 'Which shoes do you race in?',
      answer: [
        "Carbon plates, like everyone else. Why, do you think it's my shoes?",
      ],
      good: false,
      note: 'Kit comes up in the needs analysis, not yet.',
      why: 'Equipment matters in the needs analysis; a first meeting is for her goals, history and situation.',
    },
  ],

  asks: 5,

  // M18 (index = good questions asked, 0 to 5; with 4 weaker questions and 5 asks at least 1 is good, so [0] is a safety entry)
  debrief: [
    'Nothing in your notebook yet, {NAME}. A first meeting is for her goals, history and life, not tests or plans.',
    'One useful note. Next time, ask about her goals, history and week before anything else.',
    'Two useful notes. A start, but you still know little about her situation.',
    "Three useful notes. You're building a picture of Aisha, with a few gaps left.",
    'Four useful notes. A solid overview: you know what matters to Aisha.',
    'A full notebook. A great athlete overview, {NAME}: it will guide every room from here.',
  ],

  // M19, M20
  farewell: [
    'Thanks for the chat, {NAME}. Good to meet you.',
    "I'll see you in the TESTING lab. Let's find out why I lose that last lap.",
  ],
};
