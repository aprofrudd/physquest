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
    "Ah, {NAME}, welcome! I'm Dr Ellis, the Performance Director here at the Sports Performance Centre. Really glad you made it.",
    "You'll be starting with Aisha. She runs the 5000 m, and these rooms are where you'll do your work with her.",
    'Go through them in order: ATHLETE, TESTING, DATA, TRAINING, then ANALYSIS. Get all five done and the ARENA opens for the showdown.',
    'Walk through a door to go into a room, and press {A} to talk to people. The arrow shows the next door, and {SELECT} brings up your objectives.',
    "{START} pauses and {B} gets you out of any chat. The better you do in each room, the higher your scores on the board. It all saves as you go.",
    "Aisha's in the ATHLETE room waiting for you. Go and say hello, and get to know her a bit before you think about testing anything.",
  ],

  // P6
  directorReminder: [
    "Aisha's still waiting in the ATHLETE room, {NAME}. Have a proper chat with her first. Testing can wait.",
  ],

  // P7, P8 ({ROOM} is the next room's hub sign; it can be the ARENA, so the line never says "the {ROOM} room")
  directorAfter: [
    "You're getting on well, {NAME}. {ROOM} is next, just follow the arrow.",
    'And {SELECT} brings up your objectives if you lose track.',
  ],

  // N1-N9: the needs chat (Phase 2, needs analysis; Ruddock et al. 2018, Table 2). It names no test: choosing
  // one is the Testing Lab's job. Everything agreed here is a working idea that testing must check.
  needs: {
    // N1
    intro: [
      "Good to see you again, {NAME}. Now you've met Aisha, let's have a think about what she actually needs before anyone runs a test.",
      "I've got a few questions for you. We'll start with the race itself, then Aisha, then what we want testing to find out.",
    ],
    questions: [
      {
        // N2, Table 2: physiological demands of the sport; external and internal demands
        id: 'demands',
        ask: ["Let's start with the race itself. What does a 5000 m mostly come down to?"],
        options: [
          {
            text: 'Mostly aerobic, fast finish',
            good: true,
            reply: [
              "That's right. It's mostly aerobic, and she's working at a high percentage of her VO2max the whole way round.",
              'But a lot of races get decided on the last lap, so the finish counts too.',
              'You can think of it as external demands, like pace, and internal ones, like heart rate, VO2 and lactate.',
            ],
          },
          {
            text: 'Mostly sprint power',
            good: false,
            reply: [
              "Not really. A 5000 m takes about a quarter of an hour, so most of the energy is aerobic. Speed matters at the end, but she needs a big engine first.",
            ],
          },
          {
            text: 'Strength and muscle size',
            good: false,
            reply: [
              "Strength work helps keep her robust, but it won't decide a 5000 m. That comes down to her aerobic engine and her finish.",
            ],
          },
          {
            text: 'A steady pace, no surges',
            good: false,
            reply: [
              "Not the races she's in. Championship 5000s often surge, and plenty are won on the last lap. She has to hold a high pace and still have a finish.",
            ],
          },
        ],
      },
      {
        // N3, Table 2: strengths and areas for improvement (from the athlete overview, Table 1)
        id: 'strengths',
        ask: ["Right, Aisha. From your chat with her, where's she strong, and where are races getting away from her?"],
        options: [
          {
            text: 'Good base; loses the last lap',
            good: true,
            reply: [
              "I'd agree. Years of 80 to 90 km weeks have given her a good aerobic base.",
              "She can hold the pace all race, then someone kicks in the last 400 m and she can't go with them.",
            ],
          },
          {
            text: 'Weak base; fades mid-race',
            good: false,
            reply: [
              "That's not what she told you. She holds the pace all race on 80 to 90 km a week. It's the last lap where she loses it.",
            ],
          },
          {
            text: 'She starts too fast',
            good: false,
            reply: [
              "She didn't mention that. She paces it well. It's the kick over the last 300 to 400 m that gets her.",
            ],
          },
          {
            text: 'No weak spot yet',
            good: false,
            reply: [
              "There's always something, and she told you hers. When someone goes with 300 m to go, she's got nothing extra.",
            ],
          },
        ],
      },
      {
        // N4, Table 2: what mechanisms are well developed and what need improving (as a hypothesis, before testing)
        id: 'hypothesis',
        ask: ["So what do you reckon she needs? We're only guessing at this stage, and testing will tell us if we're right."],
        options: [
          {
            text: 'Her finish, on a sound base',
            good: true,
            reply: [
              "I think so too, for now. Her base looks fine and she does no sprint work at all, so her finishing speed could well be what's missing.",
              "We'll need her aerobic paces as well, so every session's pitched at the right intensity. Then testing can tell us if we're right.",
            ],
          },
          {
            text: 'Just more miles',
            good: false,
            reply: [
              "She's already doing 85 km a week. More of the same probably won't give her a kick, and after her stress fracture it's an injury risk.",
            ],
          },
          {
            text: 'New racing shoes',
            good: false,
            reply: [
              "She's already racing in carbon plates. Shoes don't explain why she's got nothing left on the last lap.",
            ],
          },
          {
            text: 'Lose some weight',
            good: false,
            reply: [
              "Nothing she told you suggests that, and pushing a runner to lose weight can damage her health. Let's stick to what we actually know.",
            ],
          },
        ],
      },
      {
        // N5, Table 2: based on the needs analysis, what tests have you chosen (what must they measure)?
        id: 'measure',
        ask: ['Last one. Before you pick any tests, what do we need them to tell us?'],
        options: [
          {
            text: 'Zones and finishing speed',
            good: true,
            reply: [
              "Spot on. Her paces at her thresholds give us her training zones, and how much she's got above the pace she can sustain tells us what she has for a kick.",
              'So pick tests that are valid and reliable for a runner and actually answer that.',
            ],
          },
          {
            text: 'Her VO2max, nothing else',
            good: false,
            reply: [
              "VO2max tells you how big her engine is, but on its own it won't set her training paces or tell you how fast she can finish.",
            ],
          },
          {
            text: 'How strong her legs are',
            good: false,
            reply: [
              "Strength can wait for now. We're asking about her paces and her finish, so we need her training zones and her finishing speed.",
            ],
          },
          {
            text: 'Her body fat',
            good: false,
            reply: [
              "That won't tell us why she's losing on the last lap, or how fast she should train. We need her training zones and her finishing speed.",
            ],
          },
        ],
      },
    ],
    // N6
    agreed: [
      "OK, {NAME}, here's where we've got to. Her aerobic base is good, her finish lets her down, and nothing in her week trains it.",
      "That's still a hunch until we test it. We need her training zones, and we need to know how much speed she's got for the finish.",
      "The TESTING lab's open. Pick a battery that answers that, and make sure she's actually ready on the day.",
    ],
    // N7 (the Testing Lab band: "AISHA NEEDS: ZONES AND FINISHING SPEED"; same as running.ts testing.needs)
    testingNeeds: 'ZONES AND FINISHING SPEED',
    // N8 (said after the athlete profile in the Testing Lab brief)
    testingBrief: 'Testing must find her training zones, and how much speed she has for the finish.',
    // N9
    reminder: [
      "TESTING's open whenever you're ready, {NAME}. We're after her training zones and her finishing speed.",
    ],
  },

  // K1-K22: the Director's check-ins after each room. Nothing claims a result before the room that produces it; after
  // it, the check-in may quote the real numbers (the clean files' values, from sports.ts and running.ts).
  checkIns: {
    // K1-K4: one entry per test in the battery (what it measures, whether it helps with the question)
    testing: {
      // K1, Table 2: rationale for the test; valid and sensitive for the athlete
      'Lactate Profile': [
        'So you ran a lactate profile, {NAME}. Stages at a rising pace with a blood lactate taken after each one, then a ramp to exhaustion.',
        'That gets us her LT1 and LT2 paces and her heart rate at each, plus her VO2max and vVO2max. Those are what we hang her training zones on.',
      ],
      // K2
      'Critical Speed Test': [
        'The critical speed test was three all-out trials on the track.',
        "From those we get her critical speed, the fastest pace she can keep going at, and her D prime, how far she can run faster than that. That's what she's got for the finish.",
      ],
      // K3
      'Wingate Test': [
        "The Wingate's 30 seconds flat out on a bike, so you get peak and mean anaerobic power. But Aisha's a runner. It won't give us running paces or zones.",
      ],
      // K4
      'Beep Test': [
        "The beep test only gives a rough VO2max estimate, from shuttles with turns in them. It's one number, with no paces, so no zones.",
      ],
    },
    // K16-K19: the battery as a whole
    battery: {
      // K16
      full: [
        'Between them, those answer the question. Her thresholds and critical speed give us her zones, and D prime tells us about her finish.',
      ],
      missing: {
        // K17
        'Critical Speed Test': [
          "Without the critical speed trials, though, there's no D prime, so we still don't know how much she's got for the finish. Add them next time.",
        ],
        // K18
        'Lactate Profile': [
          "Without the lactate profile, though, we've got no thresholds, so there's nothing to anchor her easy and threshold zones. Add it next time.",
        ],
      },
      // K19
      none: [
        'Trouble is, neither of those gives us running zones or D prime, {NAME}. Only the lactate profile or the critical speed test can.',
        "And the DATA lab works from those files, so it'll have to stay shut for now.",
      ],
    },
    // K5-K7: the test-day call
    testingCall: {
      right: ['You read her readiness well on the day, so we can trust these results and compare them with her later tests.'],
      ranAnyway: [
        "She wasn't ready on test day and the tests went ahead anyway. Fatigue, caffeine or being ill can all shift her results, so be careful with these files.",
        "If she fails a readiness check, re-book for when she's rested and well.",
      ],
      needlessRebook: [
        "She was fine on the day, so re-booking cost us two days for nothing. If her routine's normal, go ahead and test.",
      ],
    },
    // K8
    testingNext: [
      'Next up is the DATA lab. Her files are in. Clean out the glitches, then pick the key variables that should drive her training.',
    ],
    // K20
    retestNext: [
      'Head back to the TESTING lab and re-test her with a better battery. You can run it as many times as you need.',
    ],
    // K9: after the Data Lab, by how well it went; then K21, what each file showed (real numbers)
    data: {
      strong: ['Nice job, {NAME}. Clean files and the right key variables, so now every key session has a number to aim at.'],
      mixed: [
        'Not bad, {NAME}, but a few glitches or key variables got past you. Leave a glitch in and it changes what the numbers say.',
      ],
      weak: [
        'Those files needed more care, {NAME}. Leave glitches in, or take real readings out, and the numbers end up saying something else.',
        'The key variables are the ones that set her training paces or explain her finish.',
      ],
    },
    // K21
    dataFiles: {
      'Lactate Profile': [
        'Cleaned up, the profile puts LT1 at 4:08/km and LT2 at 3:34/km. Her VO2max is 58 ml/kg/min and her vVO2max pace is 3:09/km.',
      ],
      'Critical Speed Test': [
        "The trials put her critical speed at 3:22/km, and her D prime's only about 140 m. No wonder she's got so little left for the last lap.",
      ],
    },
    // K10
    dataNext: [
      "TRAINING's next. Build her week around those paces, and keep the key sessions for when she's fresh.",
    ],
    // K11: after the Training Floor
    training: {
      strong: [
        "That's a well-balanced week, {NAME}. Key sessions on fresh legs, easy runs for volume, and enough rest to recover.",
        'Those fast reps are what build her D prime for the last lap.',
      ],
      mixed: [
        "It's a decent week, but some of the key sessions fall on tired legs, so she won't get the full benefit.",
        'Try to leave about two days between hard days, and fill the gaps with easy runs and rest.',
      ],
      weak: [
        "That week would leave her too tired, or too short of key work, for much to change.",
        'Key sessions need fresh legs. Leave about two days between hard days, with 5 or more sessions and 1 to 3 rest days.',
      ],
    },
    // K12
    trainingNext: [
      'Last room is ANALYSIS. Predict her retest after the 10-week block, then decide whether each change is real or just noise.',
    ],
    // K13: after the Analysis Room (Table 4: were the changes practically meaningful?), with the retest numbers
    analysis: {
      strong: [
        "Good calls, {NAME}. Her last 400 m came down from 72 s to 70 s. That's more than the typical error (0.6 s) and the smallest worthwhile change (0.8 s).",
        "Her VO2max went from 58 to 60 ml/kg/min. That's beyond its typical error but under its smallest worthwhile change, so it's real but too small to matter.",
      ],
      mixed: [
        'A few of those were close, {NAME}. Check each change against the typical error first, then against the smallest worthwhile change.',
        "Her last 400 m, 72 s down to 70 s, clears both, so that's worth acting on. Her VO2max, 58 to 60 ml/kg/min, is real but too small to matter.",
      ],
      weak: [
        'Have another look at those. A change inside the typical error might just be noise, and it has to beat the smallest worthwhile change to matter.',
        "Her last 400 m, 72 s down to 70 s, clears both, so that's worth acting on. Her VO2max, 58 to 60 ml/kg/min, is real but too small to matter.",
      ],
    },
  // K14
    analysisNext: [
      "And that's the whole support process, {NAME}. Overview, needs, testing, training and evaluation.",
      "The ARENA's open. Go and take Aisha into the showdown.",
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
