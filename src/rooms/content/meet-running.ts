// Distance Running (level 4: Aisha, 5000 m): the Performance Director's welcome in the hub and the first meeting
// with Aisha in the ATHLETE room. The questions follow Phase 1 (Athlete overview) of the scientific support
// process (Ruddock, Boyd, Winter and Ranchordas 2018, IJSPP; docs/reference/scientific-support-process.txt,
// Table 1). Provisional and open for Alan's review: docs/content-review.md lists every item (P1.., M1..).
// Aisha's physiology stays as in sports.ts and running.ts (good aerobic base, no finishing kick, last 400 m
// the weak point); only biographical detail is new here (goals, job, coach, training week, an old injury).
import type { MeetContent } from './meet-types';

export const MEET_RUNNING: MeetContent = {
  director: { name: 'DR ELLIS', role: 'PERFORMANCE DIRECTOR' },

  // P1-P5 (P4 is now two pages, P4a and P4b, so {A} and the stats fit)
  directorWelcome: [
    "Welcome, {NAME}. I'm Dr Ellis, Performance Director here at the Sports Performance Centre. Glad to have you with us.",
    "You're our new sport scientist. Your first athlete is Aisha, a 5000 m runner, and the rooms here are where you'll support her.",
    'Take them in order: ATHLETE, TESTING, DATA, TRAINING, then ANALYSIS. Finish all five and the ARENA opens for the showdown.',
    'Walk through a door to enter a room, and press {A} to talk. The arrow points to the next door. {SELECT} shows objectives.',
    '{START} pauses and {B} leaves any chat. Good work in each room raises her stats for the showdown. Your work saves as you go.',
    'Aisha is waiting in the ATHLETE room. Go and meet her, and get to know her before you test anything.',
  ],

  // P6
  directorReminder: [
    'Aisha is waiting in the ATHLETE room, {NAME}. Get to know her first: her goals, her history, her week. Tests can wait.',
  ],

  // P7, P8
  directorAfter: [
    'Good first meeting, {NAME}. Now that you know Aisha, the TESTING lab is open.',
    'Choose tests that answer what she needs. {SELECT} shows your objectives any time.',
  ],

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
      ],
      good: true,
      note: 'OLD FOOT STRESS FRACTURE',
      said: 'Noted: an old stress fracture in her foot.',
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
