// Dialogue scripts keyed by dialogue key from map data

export interface DialogueLine {
  text: string;
  choices?: string[];
}

export const DIALOGUES: Record<string, DialogueLine[]> = {
  // Hub NPC. {SELECT} and {B} are filled in with the player's button names by the dialogue system
  hub_athlete: [
    { text: 'Hey Coach! Welcome to the Sports Performance Centre.' },
    { text: 'Take the rooms in order: TESTING, DATA, TRAINING, then ANALYSIS. The arrow shows where to go next.' },
    { text: 'Each room raises one of my stats. Finish all four and the ARENA opens: beat the rival there to clear this sport.' },
    { text: 'Tip: press {SELECT} to see your objectives, and hold {B} to run. {B} also leaves any chat.' },
  ],
  hub_equip_left: [
    { text: 'Performance monitoring station. Press {SELECT} any time to check your athlete\'s stats and objectives.' },
  ],
  hub_equip_right: [
    { text: 'Recovery station. Better answers in the rooms mean higher stats, and higher stats mean a higher score in the arena.' },
  ],

  // Room 1 placeholders (replaced by challenge system)
  room1_athlete: [
    { text: 'Coach, my performance has plateaued. What test should we run?' },
  ],
  room1_equip1: [{ text: 'Testing equipment: Treadmill with gas analyser.' }],
  room1_equip2: [{ text: 'Testing equipment: Cycle ergometer.' }],
  room1_equip3: [{ text: 'Testing equipment: Timing gates and cones.' }],
  room1_equip4: [{ text: 'Testing equipment: Blood lactate analyser.' }],

  // Room 2
  room2_athlete: [
    { text: 'The test data is in. Which variables matter most?' },
  ],
  room2_screen1: [{ text: 'Data screen: Raw performance output.' }],
  room2_screen2: [{ text: 'Data screen: Heart rate trace.' }],
  room2_screen3: [{ text: 'Data screen: Power curve analysis.' }],
  room2_screen4: [{ text: 'Data screen: Recovery metrics.' }],

  // Room 3
  room3_athlete: [
    { text: 'Now we know the numbers. How should I train, Coach?' },
  ],
  room3_equip1: [{ text: 'Training zone calculator.' }],
  room3_equip2: [{ text: 'Periodisation planner.' }],
  room3_equip3: [{ text: 'Interval timer station.' }],
  room3_equip4: [{ text: 'Load monitoring display.' }],

  // Room 4
  room4_athlete: [
    { text: 'If we follow this program, what should we expect?' },
  ],
  room4_screen1: [{ text: 'Prediction model: Physiological adaptation curves.' }],
  room4_screen2: [{ text: 'Prediction model: Performance trajectory.' }],
  room4_screen3: [{ text: 'Prediction model: Training load response.' }],
  room4_screen4: [{ text: 'Prediction model: Competition readiness score.' }],
};
