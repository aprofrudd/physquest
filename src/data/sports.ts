// Sports science data for all 4 levels

export interface TestOption {
  name: string;
  description: string;
  correct: boolean;
  dataQuality: number; // 0.5-1.0
}

export interface Variable {
  name: string;
  correct: boolean;
  explanation: string;
}

export interface TrainingZone {
  name: string;
  correct: boolean;
  description: string;
}

export interface PredictionOption {
  text: string;
  correct: boolean;
}

export interface SportData {
  sport: string;
  athleteProfile: string;
  goal: string;
  // Room 1 — Test Selection
  tests: TestOption[];
  testInsight: string;
  // Room 2 — Variable Identification
  dataOutput: string;
  variables: Variable[];
  variableInsight: string;
  // Room 3 — Training Prescription
  zones: TrainingZone[];
  zoneInsight: string;
  // Room 4 — Performance Prediction
  predictionScenario: string;
  predictions: PredictionOption[];
  predictionInsight: string;
  // Boss battle
  bossEvent: string;
  bossStat: 'speed' | 'strength' | 'endurance' | 'power';
  rivalName: string;
  rivalTaunt: string;
  rivalLoseLine: string;
}

export const LEVEL_DATA: SportData[] = [
  // Level 1: Rugby League — Speed focus
  {
    sport: 'Rugby League',
    athleteProfile: 'Jake, 24, winger. Fast but inconsistent over repeated efforts.',
    goal: 'Improve repeated sprint ability for match fitness.',
    tests: [
      { name: 'Yo-Yo IR2', description: 'Intermittent recovery test — measures repeated high-intensity running capacity.', correct: true, dataQuality: 0.9 },
      { name: 'Cooper 12-min Run', description: 'Continuous running test — estimates VO2max from distance covered.', correct: false, dataQuality: 0.5 },
      { name: 'Repeated Sprint Ability', description: 'Multiple maximal sprints with short recovery — tests speed maintenance.', correct: true, dataQuality: 0.85 },
      { name: 'Wingate Test', description: '30-second all-out cycle ergometer test — measures peak and mean anaerobic power.', correct: false, dataQuality: 0.6 },
    ],
    testInsight: 'The Yo-Yo IR2 and RSA directly assess repeated sprint capacity relevant to rugby league match demands.',
    dataOutput: 'Yo-Yo IR2 Result: Level 20.3, Distance 1280m, HR max 192bpm, Recovery HR 145bpm at 60s, Blood Lactate 11.2 mmol/L',
    variables: [
      { name: 'Total Distance (1280m)', correct: true, explanation: 'Total distance reflects intermittent endurance capacity.' },
      { name: 'HR Max (192bpm)', correct: false, explanation: 'Max HR is individual and not a trainable performance variable.' },
      { name: 'Recovery HR (145bpm)', correct: true, explanation: 'Recovery heart rate indicates cardiac fitness and parasympathetic reactivation.' },
      { name: 'Blood Lactate (11.2)', correct: true, explanation: 'Post-test lactate indicates anaerobic contribution and buffering capacity.' },
      { name: 'Test Level (20.3)', correct: false, explanation: 'Level is just a marker for distance — the distance itself is the key variable.' },
    ],
    variableInsight: 'Distance, recovery HR and lactate are the trainable variables that inform programming.',
    zones: [
      { name: 'Zone 2 Aerobic Base (130-150bpm)', correct: false, description: 'Low intensity steady state for aerobic foundation.' },
      { name: 'High Intensity Intervals (>170bpm)', correct: true, description: 'Short intervals above anaerobic threshold to build speed endurance.' },
      { name: 'Repeated Sprint Training (95-100% max)', correct: true, description: 'Match-specific repeated sprint sets with short recovery.' },
      { name: 'Tempo Running (160-170bpm)', correct: true, description: 'Moderate-high intensity sustained efforts for lactate tolerance.' },
    ],
    zoneInsight: 'HIT, RSA training and tempo work target the energy systems limiting Jakes repeat sprint performance.',
    predictionScenario: 'After 6 weeks of targeted training, what adaptation do you expect?',
    predictions: [
      { text: 'VO2max increases by 15%', correct: false },
      { text: 'Sprint decrement reduces from 8% to 4%', correct: true },
      { text: 'Body mass drops by 5kg', correct: false },
      { text: 'Resting heart rate drops to 40bpm', correct: false },
    ],
    predictionInsight: 'Reduced sprint decrement reflects improved repeat sprint ability — the primary training target.',
    bossEvent: 'SPRINT RACE',
    bossStat: 'speed',
    rivalName: 'Dr. Voss',
    rivalTaunt: 'Your test selection was amateur hour. My athlete was optimised from day one.',
    rivalLoseLine: 'Impossible... your protocols actually worked.',
  },

  // Level 2: Cycling — Strength/Power focus
  {
    sport: 'Cycling',
    athleteProfile: 'Mia, 28, road cyclist. Strong climber but lacks peak power for breakaways.',
    goal: 'Increase maximal aerobic power and critical power for race performance.',
    tests: [
      { name: 'Ramp Test (MAP)', description: 'Incremental ramp to exhaustion — determines maximal aerobic power.', correct: true, dataQuality: 0.95 },
      { name: 'Critical Power Test', description: 'Multiple time trials — calculates sustainable power and W prime.', correct: true, dataQuality: 0.9 },
      { name: 'Beep Test', description: 'Multi-stage shuttle run — estimates VO2max.', correct: false, dataQuality: 0.5 },
      { name: '20-min FTP Test', description: 'Sustained 20-minute effort — estimates functional threshold power.', correct: false, dataQuality: 0.7 },
    ],
    testInsight: 'Ramp test for MAP and critical power test give the most precise training targets for cycling performance.',
    dataOutput: 'Ramp Test: MAP 340W, VO2max 62 ml/kg/min, HR max 188bpm, Weight 58kg, Power/Weight 5.86 W/kg',
    variables: [
      { name: 'MAP (340W)', correct: true, explanation: 'Maximal aerobic power is the primary performance determinant in road cycling.' },
      { name: 'VO2max (62 ml/kg/min)', correct: true, explanation: 'VO2max indicates aerobic ceiling and training responsiveness.' },
      { name: 'HR Max (188bpm)', correct: false, explanation: 'Max HR is genetically determined and not a training target.' },
      { name: 'Body Weight (58kg)', correct: false, explanation: 'Weight context matters but is not a variable from the test itself.' },
      { name: 'Power/Weight (5.86 W/kg)', correct: true, explanation: 'Relative power determines climbing and sustained performance.' },
    ],
    variableInsight: 'MAP, VO2max and power-to-weight ratio are the key metrics for prescribing cycling training.',
    zones: [
      { name: 'Sweet Spot (88-94% FTP)', correct: true, description: 'High training stimulus with manageable fatigue.' },
      { name: 'VO2max Intervals (106-120% FTP)', correct: true, description: 'Short intense intervals to push aerobic ceiling.' },
      { name: 'Recovery Rides (<55% FTP)', correct: false, description: 'Active recovery between hard sessions.' },
      { name: 'Threshold Work (95-105% FTP)', correct: true, description: 'Sustained efforts to raise functional threshold power.' },
    ],
    zoneInsight: 'Sweet spot, VO2max intervals and threshold work will raise Mias MAP and critical power.',
    predictionScenario: 'After 8 weeks of structured power training, what is the most likely outcome?',
    predictions: [
      { text: 'MAP increases from 340W to 360W', correct: true },
      { text: 'Sprint power doubles to 680W', correct: false },
      { text: 'Body weight drops to 50kg', correct: false },
      { text: 'Recovery HR improves by 30bpm', correct: false },
    ],
    predictionInsight: 'A 5-6% MAP increase is realistic with structured threshold and VO2max training over 8 weeks.',
    bossEvent: 'STRENGTH TEST',
    bossStat: 'strength',
    rivalName: 'Prof. Krane',
    rivalTaunt: 'Your training zones are textbook errors. My athlete will crush yours on the climb.',
    rivalLoseLine: 'Your power data was... surprisingly precise.',
  },

  // Level 3: Boxing — Endurance focus
  {
    sport: 'Boxing',
    athleteProfile: 'Carlos, 22, middleweight. Good technique but fades in late rounds.',
    goal: 'Build anaerobic capacity and recovery between rounds.',
    tests: [
      { name: 'Wingate Test', description: '30-second all-out cycle test — measures peak power, mean power and fatigue index.', correct: true, dataQuality: 0.9 },
      { name: 'Boxing RSA Protocol', description: 'Repeated 6-second boxing-specific power bouts — tests punch power maintenance.', correct: true, dataQuality: 0.85 },
      { name: 'Treadmill VO2max', description: 'Incremental treadmill test to exhaustion — measures maximal oxygen uptake.', correct: false, dataQuality: 0.6 },
      { name: 'Cooper 12-min Run', description: 'Continuous 12-minute run — estimates aerobic capacity.', correct: false, dataQuality: 0.5 },
    ],
    testInsight: 'Wingate and Boxing RSA assess the anaerobic power and recovery demands specific to boxing rounds.',
    dataOutput: 'Wingate: Peak Power 890W, Mean Power 640W, Fatigue Index 42%, Body Mass 75kg, Time to Peak 4.2s',
    variables: [
      { name: 'Peak Power (890W)', correct: true, explanation: 'Peak power reflects maximal force production capacity.' },
      { name: 'Mean Power (640W)', correct: true, explanation: 'Mean power indicates sustained anaerobic work capacity over 30 seconds.' },
      { name: 'Fatigue Index (42%)', correct: true, explanation: 'Fatigue index shows power drop-off — key for late-round performance.' },
      { name: 'Body Mass (75kg)', correct: false, explanation: 'Body mass is a descriptor, not a performance variable from the test.' },
      { name: 'Time to Peak (4.2s)', correct: false, explanation: 'Time to peak is influenced by start technique, not a trainable quality.' },
    ],
    variableInsight: 'Peak power, mean power and fatigue index directly inform Carlos anaerobic training program.',
    zones: [
      { name: 'Alactic Power (6-10s max efforts)', correct: true, description: 'Short maximal bursts to develop peak power output.' },
      { name: 'Glycolytic Intervals (30-60s hard)', correct: true, description: 'Sustained high-intensity bouts matching round demands.' },
      { name: 'Long Slow Distance (30+ min easy)', correct: false, description: 'Extended low-intensity cardio for base fitness.' },
      { name: 'Repeat Power Bouts (10s on/20s off)', correct: true, description: 'Boxing-specific work-rest ratios for inter-round recovery.' },
    ],
    zoneInsight: 'Alactic power, glycolytic intervals and repeat power bouts match boxing energy system demands.',
    predictionScenario: 'After 6 weeks of anaerobic-focused training, what change do you expect?',
    predictions: [
      { text: 'Fatigue index drops from 42% to 30%', correct: true },
      { text: 'VO2max increases by 20%', correct: false },
      { text: 'Peak power stays the same but technique improves', correct: false },
      { text: 'Body mass drops by 10kg', correct: false },
    ],
    predictionInsight: 'Reduced fatigue index means Carlos maintains power output across rounds — the training target.',
    bossEvent: 'ENDURANCE BOUT',
    bossStat: 'endurance',
    rivalName: 'Coach Steele',
    rivalTaunt: 'Your boxer will gas out by round 3. Mine was built for 12.',
    rivalLoseLine: 'Your conditioning program... it actually held up.',
  },

  // Level 4: Distance Running — Power/combined focus
  {
    sport: 'Distance Running',
    athleteProfile: 'Aisha, 26, 5000m runner. Good aerobic base but lacks finishing kick.',
    goal: 'Develop speed reserve and critical speed for race-ending surges.',
    tests: [
      { name: 'Lactate Threshold Test', description: 'Incremental treadmill with blood lactate sampling — identifies threshold pace.', correct: true, dataQuality: 0.95 },
      { name: 'Critical Speed Test', description: 'Multiple time trials at different distances — calculates critical speed and D prime.', correct: true, dataQuality: 0.9 },
      { name: 'Wingate Test', description: '30-second all-out cycle test — peak anaerobic power.', correct: false, dataQuality: 0.5 },
      { name: 'Beep Test', description: 'Multi-stage shuttle run to estimate VO2max.', correct: false, dataQuality: 0.6 },
    ],
    testInsight: 'Lactate threshold and critical speed provide the precise pacing and training intensity data Aisha needs.',
    dataOutput: 'LT Test: LT1 pace 3:45/km at 2.0mmol/L, LT2 pace 3:20/km at 4.0mmol/L, VO2max 65ml/kg/min, Max pace 2:55/km, HR at LT2 175bpm',
    variables: [
      { name: 'LT1 Pace (3:45/km)', correct: true, explanation: 'First lactate threshold pace defines aerobic training intensity.' },
      { name: 'LT2 Pace (3:20/km)', correct: true, explanation: 'Second threshold pace is the ceiling for sustained race pace.' },
      { name: 'VO2max (65 ml/kg/min)', correct: false, explanation: 'VO2max confirms high aerobic fitness but doesnt set training paces.' },
      { name: 'Max Pace (2:55/km)', correct: true, explanation: 'Max pace reveals speed reserve above threshold — key for finishing kick.' },
      { name: 'HR at LT2 (175bpm)', correct: false, explanation: 'HR at threshold is useful for monitoring but not for pace prescription.' },
    ],
    variableInsight: 'LT1, LT2 and max pace define the training zones that will build Aishas finishing speed.',
    zones: [
      { name: 'Sub-threshold (LT1-LT2 pace)', correct: true, description: 'Running between thresholds to push lactate clearance higher.' },
      { name: 'Supra-threshold Intervals (faster than LT2)', correct: true, description: 'Short reps above threshold to develop speed reserve.' },
      { name: 'Easy Running (slower than LT1)', correct: false, description: 'Recovery running — necessary but not the priority intervention.' },
      { name: 'Sprint Training (near max pace)', correct: true, description: 'Short maximal bursts to develop neuromuscular speed for finishing kick.' },
    ],
    zoneInsight: 'Sub-threshold, supra-threshold and sprint work will develop the speed reserve Aisha needs to kick.',
    predictionScenario: 'After 10 weeks of speed reserve training, what is the expected outcome?',
    predictions: [
      { text: 'Last 400m kick improves from 62s to 57s', correct: true },
      { text: 'VO2max increases from 65 to 75 ml/kg/min', correct: false },
      { text: 'LT2 pace stays at 3:20/km', correct: false },
      { text: 'Body weight drops significantly', correct: false },
    ],
    predictionInsight: 'A faster finishing kick from improved speed reserve is the realistic, targeted adaptation.',
    bossEvent: 'POWER SURGE',
    bossStat: 'power',
    rivalName: 'Dr. Okafor',
    rivalTaunt: 'Your threshold data was sloppy. My runner has the kick to prove it.',
    rivalLoseLine: 'Your speed reserve protocol... I need to study your methods.',
  },
];
