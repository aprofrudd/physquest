// Distance Running (level 4: Aisha, 5000 m): content for the redesigned rooms.
// DRAFT: every item here is new physiology content awaiting Alan's review. Numbers already in sports.ts are
// reused; derived numbers are arithmetic on them (3:45/km = 16.0 km/h, 3:20/km = 18.0, 2:55/km = 20.6,
// 30 m in 3.86 s = 28.0 km/h); everything else is a placeholder until Alan approves or replaces it.
import type { RoomsContent } from './types';

export const RUNNING: RoomsContent = {
  testing: {
    needs: 'THRESHOLD AND SPEED RESERVE',
    cards: [
      { name: 'Lactate Threshold Test', kit: 'treadmill', shape: 'stages', chips: ['RUN', 'STAGES', 'LACTATE'], gives: 'LT1 AND LT2 PACES' },
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
    fileTitle: 'TREADMILL TEST + SPRINT',
    protocol:
      'Incremental treadmill test: 3-minute stages from 14 km/h, up 1 km/h each stage, a fingertip blood lactate after each stage and expired gas throughout, to exhaustion. Then a flying 30 m sprint, best of 3.',
    stages: [
      { kmh: 14, mmol: 1.1 },
      { kmh: 15, mmol: 1.4 },
      { kmh: 16, mmol: 2.0 },
      { kmh: 17, mmol: 2.7 },
      { kmh: 18, mmol: 4.0 },
      { kmh: 19, mmol: 6.3 },
      { kmh: 20, mmol: 9.1 },
    ],
    lt1Mmol: 2.0,
    lt2Mmol: 4.0,
    sprintTimes: [3.89, 3.86, 3.88],
    sprintMetres: 30,
    vvo2maxKmh: 20.6,
    contaminatedRise: 3.5,
    misfireTime: 3.21,
    contaminated: {
      seen: 'At {kmh} km/h lactate reads {value} mmol/L. The stages either side read {before} and {after}.',
      why: 'A glitch: sweat on the fingertip contaminates the sample and reads falsely high. Wipe the site dry and discard the first drop.',
    },
    failed: {
      seen: 'At {kmh} km/h lactate reads 0.0 mmol/L. The stages either side read {before} and {after}.',
      why: 'A glitch: blood lactate is never zero during exercise. A strip error or too little blood gives a reading like this.',
    },
    misfire: {
      seen: 'Sprint {n} reads {time} s, which is {speed} km/h. Her other two runs were {others} s.',
      why: 'A glitch: an arm swinging through the beam can set off a timing gate early. That time is impossible for her.',
    },
    knee: {
      seen: 'At {kmh} km/h lactate jumps to {value} mmol/L, its steepest rise so far.',
      why: 'Real: above her second threshold lactate climbs faster and faster, and the next stages keep rising.',
    },
    peak: {
      seen: 'The last stage reads {value} mmol/L, the highest reading of the test.',
      why: 'Real: lactate is highest at the end of a maximal test, and the stages before it were already climbing.',
    },
    rules: [
      "Aisha's test file is in. The software has flagged readings that look odd. Press {A} to remove a glitch, or {RIGHT} to keep real data.",
      'Then pin the 3 variables that should guide her training.',
    ],
    rulesShort: 'Clean the file ({A}: remove, {RIGHT}: keep), then pin 3 variables.',
    lensRule:
      "A jump or drop that the readings either side don't back up is a glitch. A change that keeps building over several readings is real.",
    features: {
      'LT1 Pace (3:45/km)': 'Where the curve crosses 2 mmol/L.',
      'LT2 Pace (3:20/km)': 'Where the curve crosses 4 mmol/L.',
      'VO2max (65 ml/kg/min)': 'From the gas analyser: not on the lactate curve.',
      'vVO2max Pace (2:55/km)': 'The slowest speed that brings out her VO2max.',
      'Max Sprint Speed (28 km/h)': 'Her best flying 30 m sprint.',
    },
    reserveLabel: 'SPEED RESERVE',
  },

  training: {
    cards: [
      { zone: 'Sub-threshold (LT1-LT2 pace)', label: 'SUB', target: '3:45-3:20/KM', role: 'key' },
      { zone: 'Supra-threshold Intervals (faster than LT2)', label: 'SUPR', target: '3:20-2:55/KM', role: 'key' },
      { zone: 'Easy Running (slower than LT1)', label: 'EASY', target: 'SLOWER THAN 3:45/KM', role: 'support' },
      { zone: 'Sprint Training (near max sprint speed)', label: 'SPRT', target: 'NEAR 28 KM/H', role: 'key' },
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
    trained: { metric: 'LAST 400 M', unit: 'S', baseline: 62, retest: 60, better: 'lower', te: 0.6, swc: 0.8 },
    weeks: 10,
    baselineTrials: [61.6, 62.4],
    history: [1.6, 2.4],
    step: 0.2,
    decoy: { metric: 'VO2MAX', unit: 'ML/KG/MIN', baseline: 65, retest: 67, better: 'higher', te: 1.5, swc: 3.0 },
    verdicts: ['NOISE', 'REAL BUT TOO SMALL TO MATTER', 'REAL AND WORTH ACTING ON'],
    noiseWhy: 'It moved {change} {unit}: inside the typical error ({te}), so it could just be noise.',
    smallWhy: 'It moved {change} {unit}: beyond the typical error ({te}) but short of the smallest worthwhile change ({swc}).',
    worthWhy: 'It moved {change} {unit}: beyond the typical error ({te}) and the smallest worthwhile change ({swc}).',
    rules: [
      "Aisha's last 400 m took 62 s before the block. Her two baseline trials differed a little: that spread is the typical error, the NOISE band.",
      'The gold lines mark the smallest worthwhile change. Forecast her retest after the 10-week block, then judge each result: noise, real but too small, or worth acting on.',
    ],
    rulesShort: 'Forecast the retest, then judge each result: noise, too small, or worth acting on.',
  },
};
