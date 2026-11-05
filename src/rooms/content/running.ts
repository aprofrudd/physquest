// Distance Running (level 4: Aisha, 5000 m): content for the redesigned rooms.
// Aisha's profile was rebuilt and approved by Alan on 2026-11-05 (5 km PB 16:20; VO2max 58 ml/kg/min; vVO2max
// 19.0 km/h; LT1 14.5 km/h, LT2 16.8 km/h at 4 mmol/L; CS 17.8 km/h, D prime about 140 m). The derived pieces
// and the new wording are provisional: docs/content-review.md lists them (section "Aisha's new profile").
// Paces are worked out from the speed as reported to 0.1 km/h: 14.5 km/h = 4:08/km, 16.8 = 3:34,
// 17.8 = 3:22, 19.0 = 3:09. Critical speed and D prime are the line through distance against time
// (1200 m 3:34, 2400 m 7:37, 3600 m 11:40: 4.94 m/s and 143 m, shown to the nearest 10 m).
import type { RoomsContent } from './types';

// The tests each training target's numbers come from (names in sports.ts)
const LP = 'Lactate Profile';
const CS = 'Critical Speed Test';

export const RUNNING: RoomsContent = {
  testing: {
    needs: 'ZONES AND FINISHING SPEED', // T1; the same as meet-running.ts needs.testingNeeds
    battery: 2, // T2: the player picks this many tests
    cards: [
      { name: 'Lactate Profile', kit: 'treadmill', shape: 'stages', chips: ['RUN', 'STAGES', 'LACTATE'], gives: 'LT1 AND LT2 PACES' },
      { name: 'Critical Speed Test', kit: 'track', shape: 'trials', chips: ['RUN', '3 TRIALS', 'ALL-OUT'], gives: 'CS AND D PRIME' },
      { name: 'Wingate Test', kit: 'cycle', shape: 'allout', chips: ['CYCLE', '30 S', 'ALL-OUT'], gives: 'PEAK AND MEAN POWER' },
      { name: 'Beep Test', kit: 'shuttle', shape: 'shuttles', chips: ['RUN', 'SHUTTLES', 'TO FAILURE'], gives: 'VO2MAX ESTIMATE' },
    ],
    checks: [
      {
        says: 'I ran a hard interval session yesterday.',
        call: 'rebook',
        why: 'Hard training in the 24-48 hours before a test leaves fatigue that can change her pace and lactate, so the result would not compare with her other tests. Re-book after an easy day.',
      },
      {
        says: 'I had two strong coffees this morning. I never usually drink coffee.',
        call: 'rebook',
        why: 'Caffeine can improve endurance performance. A dose she does not normally take would make this test hard to compare with her others.',
      },
      {
        says: 'I have had a cold all week and I still have a temperature.',
        call: 'rebook',
        why: 'Never run a maximal test on someone with a fever. Re-book once she is well.',
      },
      {
        says: 'Easy 30-minute jog yesterday, I slept well, and I had my usual breakfast three hours ago.',
        call: 'run',
        why: 'That is her standard routine: light training the day before and the same meal timing as her last test. Good to go.',
      },
      {
        says: 'Same time of day as my last test, same shoes, and I have done the usual warm-up.',
        call: 'run',
        why: 'Same time of day, kit and warm-up as last time, so the results will be comparable. Good to go.',
      },
    ],
    ranAnyway: 0.7,
    needlessRebook: 0.95,
  },

  data: {
    // D1-D9: the Lactate Profile's file
    lactate: {
      test: 'Lactate Profile',
      title: 'LACTATE PROFILE (TREADMILL)',
      group: 'FROM THE LACTATE PROFILE:',
      intro: 'her lactate profile on the treadmill. Stages from 12 to 18 km/h, with a blood lactate sample after each.',
      protocol:
        'Treadmill at 1% gradient: 4-minute stages from 12 km/h, up 1 km/h each, with a fingertip blood lactate and her heart rate at the end of each. Then a ramp to exhaustion, with expired gas, for her VO2max.',
      stages: [
        { kmh: 12, mmol: 1.0, hr: 143 },
        { kmh: 13, mmol: 1.1, hr: 149 },
        { kmh: 14, mmol: 1.3, hr: 155 },
        { kmh: 15, mmol: 1.7, hr: 161 },
        { kmh: 16, mmol: 2.6, hr: 169 },
        { kmh: 17, mmol: 4.3, hr: 178 },
        { kmh: 18, mmol: 7.0, hr: 185 },
      ],
      lt1Rise: 0.5,
      lt2Mmol: 4.0,
      vo2max: 58,
      vvo2maxKmh: 19.0,
      hrMax: 192,
      contaminatedRise: 3.5,
      ask: 'Reading {i} of {n}: lactate at {kmh} km/h. Real data, or a glitch?',
      contaminated: {
        seen: 'It reads {value} mmol/L. The stages either side read {before} and {after}.',
        why: 'A glitch: sweat on the fingertip contaminates the sample and reads falsely high. Wipe the site dry and discard the first drop.',
      },
      failed: {
        seen: 'It reads 0.0 mmol/L. The stages either side read {before} and {after}.',
        why: 'A glitch: blood lactate is never zero during exercise. A strip error or too little blood gives a reading like this.',
      },
      knee: {
        seen: 'It jumps to {value} mmol/L, its steepest rise so far.',
        why: 'Real: above her second threshold lactate climbs faster and faster, and the next stage keeps rising.',
      },
      kneePlain: 'It reads {value} mmol/L. The stages either side read {before} and {after}.',
      peak: {
        seen: 'The last stage reads {value} mmol/L, the highest of the test.',
        why: 'Real: lactate is highest at the end of the test, and the stages before it were already climbing.',
      },
      lensRule:
        "A jump or drop that the readings either side don't back up is a glitch. A change that keeps building over several readings is real.",
      insight: 'LT2 and vVO2max set her threshold and severe sessions. Without the trials we cannot yet see what she has for the finish.',
    },
    // D10-D15: the Critical Speed Test's file
    trials: {
      test: 'Critical Speed Test',
      title: 'CRITICAL SPEED (TRACK TRIALS)',
      group: 'FROM THE CS TRIALS:',
      intro: 'her critical speed trials on the track. Three all-out time trials: 1200, 2400 and 3600 m.',
      protocol:
        'Each trial was run all-out on the track, on separate days with full recovery. Critical speed and D prime come from the straight line through distance against time.',
      trials: [
        { metres: 1200, seconds: 214 },
        { metres: 2400, seconds: 457 },
        { metres: 3600, seconds: 700 },
      ],
      // One trial per attempt is mistimed, picked from these: the 2400 m reads 40 s long (a late stop), or the 3600 m
      // 40 s short (a missed lap). Either way it breaks the pattern of the other two.
      mistimings: [
        { trial: 1, seconds: 40 },
        { trial: 2, seconds: -40 },
      ],
      ask: 'Reading {i} of {n}: the {m} m trial. Real data, or a glitch?',
      mistimed: {
        seen: 'It reads {time}, which is {pace}/km. The other trials ran at {others}/km.',
        why: 'A glitch: the timing went wrong (a missed lap or a late stop). In all-out trials a longer one is always slower per km, and this breaks that.',
      },
      fastest: {
        seen: 'It reads {time}, which is {pace}/km. The other trials ran at {others}/km.',
        why: 'Real: the shorter the all-out trial, the faster she can run it, because she can spend all of her D prime in it.',
      },
      lensRule: 'In all-out trials, a longer trial is slower per km. A trial that breaks that pattern is a glitch.',
      insight: 'Critical speed sets her threshold and severe sessions, and her small D prime explains why she has little left for the last lap.',
    },
    // D16-D20: how the room works
    rules: [
      "Aisha's test files are in. The software has flagged readings that look odd: decide if each one is real data or a glitch.",
      'For example, if three stages read 2.0, 5.5 and 2.2 mmol/L, the middle one jumps and falls straight back: a glitch. 2.0, 2.8, 4.1, 6.5 keeps climbing: real.',
      'Use {DPAD} to choose KEEP or REMOVE, then {A}.',
    ],
    rulesShort: 'For each flagged reading, use {DPAD} to choose KEEP or REMOVE, then {A}.',
    options: ['KEEP IT (REAL)', 'REMOVE IT (GLITCH)'],
    chooseIntro: 'Now choose her KEY VARIABLES: the {N} numbers you would use to set her training paces and explain her finish.',
    keyExample: 'For example, for a cyclist, the power she can hold for an hour sets her sessions; her body mass only describes her.',
    lockAsk: "Lock in these {N} key variables? You can't change them after.",
    // D21: what each variable is on its file (by its name in sports.ts)
    features: {
      'LT1 Pace (4:08/km)': { file: 'lactate', about: 'Where lactate first rises 0.5 mmol/L above her lowest reading.' },
      'LT2 Pace (3:34/km)': { file: 'lactate', about: 'Where the curve crosses 4 mmol/L.' },
      'HR at LT2 (176 bpm)': { file: 'lactate', about: 'Her heart rate where the curve crosses 4 mmol/L.' },
      'VO2max (58 ml/kg/min)': { file: 'lactate', about: 'From the gas analyser in the final ramp: not on the lactate curve.' },
      'vVO2max Pace (3:09/km)': { file: 'lactate', about: 'The slowest speed in the ramp that brought out her VO2max.' },
      'Critical Speed (3:22/km)': { file: 'trials', about: 'The slope of the line through her three trials.' },
      'D Prime (140 m)': { file: 'trials', about: 'Where that line meets zero time: how far she can run faster than critical speed.' },
      'Best Trial Pace (2:58/km)': { file: 'trials', about: 'Her pace in the 1200 m, the fastest trial per km.' },
    },
  },

  training: {
    cards: [
      { zone: 'Threshold Running (LT2 to CS pace)', label: 'THR', target: '3:34-3:22/KM', role: 'key', uses: [LP, CS], plain: 'LT2 TO CS PACE' },
      { zone: 'Severe Intervals (CS to vVO2max pace)', label: 'SEV', target: '3:22-3:09/KM', role: 'key', uses: [LP, CS], plain: 'CS TO VVO2MAX PACE' },
      { zone: 'Easy Running (slower than LT1)', label: 'EASY', target: 'SLOWER THAN 4:08/KM', role: 'support', uses: [LP], plain: 'SLOWER THAN LT1 PACE' },
      { zone: 'Fast Reps (faster than vVO2max)', label: 'FAST', target: 'FASTER THAN 3:09/KM', role: 'key', uses: [LP], plain: 'FASTER THAN VVO2MAX' },
    ],
    legs: { keyNextDay: 50, keyTwoDays: 20, supportNextDay: 5, fullAt: 75, noneAt: 45 },
    checks: { minSessions: 5, minRest: 1, maxRest: 3, redBelow: 45 },
    awayDay: true,
    awayLabel: 'AWAY',
    rules: [
      "Plan Aisha's week. The orange KEY sessions need fresh legs: the LEGS gauge under each day shows how fresh she'll be that morning.",
      'A key session leaves the legs tired for about two days. Easy runs add volume for little cost, and rest days bring the legs back. Aim for 5 or more sessions, 1 to 3 rest days and no red mornings.',
    ],
    rulesShort: 'Key sessions need fresh legs: about two days between hard days.',
    fullQuality: '{label}: full quality (legs {legs}%).',
    partQuality: '{label}: legs only {legs}%, so not full quality.',
    noQuality: '{label}: legs {legs}%. Too tired for this to do its job.',
    supportNote: 'Support: adds volume and helps recovery, but is not a key session.',
  },

  analysis: {
    trained: {
      metric: 'LAST 400 M', unit: 'S', baseline: 72, retest: 70, better: 'lower', te: 0.6, swc: 0.8,
      name: 'last 400 m', betterWord: 'FASTER', worseWord: 'SLOWER',
    },
    weeks: 10,
    baselineTrials: [71.6, 72.4],
    history: [1.6, 2.4],
    step: 0.2,
    decoy: {
      metric: 'VO2MAX', unit: 'ML/KG/MIN', baseline: 58, retest: 60, better: 'higher', te: 1.5, swc: 3.0,
      name: 'VO2max', betterWord: 'HIGHER', worseWord: 'LOWER',
    },
    verdicts: ['NOISE', 'REAL BUT TOO SMALL TO MATTER', 'REAL AND WORTH ACTING ON'],
    noiseWhy: 'It moved {change} {unit}: inside the typical error ({te}), so it could just be noise.',
    smallWhy: 'It moved {change} {unit}: beyond the typical error ({te}) but short of the smallest worthwhile change ({swc}).',
    worthWhy: 'It moved {change} {unit}: beyond the typical error ({te}) and the smallest worthwhile change ({swc}).',
    // A10-A13: the walk-through, one page per element of the board (tour says which one each page points at)
    rules: [
      "Before the block, Aisha's last 400 m took 72 s: that is BEFORE, the dark pole. Her two baseline trials sit either side of it.",
      'The hatched NOISE band is the typical error, 0.6 s either side of BEFORE. A change inside it could just be noise.',
      'The gold dashed lines mark the WORTHWHILE CHANGE, 0.8 s either side: the smallest change that would matter in a race.',
      'The blue marker is YOUR GUESS. Move it to where you think her retest will land. The grey ticks show her last two blocks.',
    ],
    tour: ['before', 'noise', 'worth', 'guess'],
    rulesShort: 'Move YOUR GUESS to forecast her retest, then judge each result: noise, too small, or worth acting on.', // A14
    forecastAsk: 'Where will her last 400 m be after the 10-week block? Move YOUR GUESS with {LEFT} and {RIGHT}, then {A} to lock it in.', // A15
    judgeAsk: 'Her {name} retest: {before} → {after} {unit}. Is that change noise, real but too small, or worth acting on?', // A16
  },
};
