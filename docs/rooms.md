# PhysQuest: Room Design Document

## Overview

Each level contains **4 challenge rooms** plus a **boss arena**. The player navigates a hub overworld (Sports Performance Centre) and enters rooms through doors. The rooms are taken **in order** (TESTING, DATA, TRAINING, ANALYSIS): a room opens once the one before it is done, and a finished room stays open for replays. All 4 rooms must be completed before the arena opens.

Each room awards a **player stat** (0 to 100%) based on performance. The stats combine into a **showdown rating** that caps how well the player's athlete can perform in the boss minigame.

**Distance Running** (level 4) plays the **redesigned rooms**: four different places, each with its own task (see "Redesigned rooms" below). The other levels play the **classic rooms** (a question and a choice list over the dimmed room). A browser can switch level 4 back to the classic rooms with `?rooms=classic` (remembered on that device; `?rooms=new` undoes it).

For now **only Distance Running can be played** (`PLAYABLE_LEVELS` in `src/data/levels.ts`): the level select shows Rugby League, Cycling and Boxing greyed out as COMING SOON, the cursor skips them, and clearing Distance Running completes the game. Their classic rooms are still in the code, so a sport can be reopened by adding its index to `PLAYABLE_LEVELS`.

Controls are console buttons (keyboard equivalents in brackets): D-pad (arrows/WASD) to move, A (Z/Space/Enter) to talk and confirm, B (X/Backspace) to go back and to run while held, START (Esc/P) for the pause menu, SELECT (Shift) for the objectives panel. Prompts name the buttons the player is using: console names after a touch or click on the console, key names (SPACE, X, ESC, SHIFT, ARROWS) after a key press; desktops start on key names. The title screen lists every control.

Progress saves automatically after name entry, after every room and after every showdown (and from the pause menu, which says so). Unfinished levels keep their room progress, even when the player switches to another level.

The player is a **sport scientist**, called by the name typed at name entry: game text writes `{NAME}` and it is filled at render time (`engine/nameToken.ts`, through `fillButtonNames`, so dialogue, `input.fill()` and `announce()` all fill it; `ALAN` is said as "Alan"). No line calls the player "Coach". The intro opens **straight on name entry**, then one line by name ("Welcome, {NAME}. You're the new sport scientist...") and the level select. How to play is the **Performance Director**'s to explain, in the Distance Running hub (below).

---

## Hub: Sports Performance Centre

- **Map**: 16x14 tile grid, `lab` palette
- **Layout**: 4 room doors (top-left, top-right, bottom-left, bottom-right), boss doors at bottom centre
- **Labels**: each door has a readable label plate (TESTING, DATA, TRAINING, ANALYSIS) that gains a check mark when the room is complete and shows a lock while the room is not open yet; the ARENA plate shows a lock until all rooms are done
- **Arrow**: a bobbing gold arrow points at the next room's door, and at the arena doors once all four rooms are done
- **HUD**: ROOMS N/4 badge, with a "SELECT: OBJECTIVES" hint beside it until the panel has been opened once (per session); the map name and level show briefly on a fresh start. The first time the hub is seen with all four rooms done (per level, per session), a banner says "THE ARENA IS OPEN! / BEAT THE RIVAL TO CLEAR THE LEVEL"
- **Objectives panel** (SELECT): the player's name ("SPORT SCIENTIST" beside it), level, the ATHLETE row first when there is one ("ATHLETE (OVERVIEW)": best n/5, or NEXT), each room with the stat it raises (e.g. "TESTING (SPEED)") and its status (score, NEXT, or a lock), the four stats, and a "next" hint
- **NPCs**: the athlete at the centre wears a "!" until the player has talked to it (per session); it explains the room order, the arena and the SELECT/B controls. NPCs, signs and plants are solid
- **Distance Running** (a visit that plays the redesigned rooms): the hub is `data/rooms/hub.ts` (`DIRECTOR_HUB`). The **Performance Director** (Dr Ellis, `DIRECTOR_SPRITE`) stands where the athlete stood, and a **fifth door, ATHLETE**, is set into the bottom wall left of the arena (door (3,12), plate on the wall under it, `data/meetDoor.ts`). Aisha is no longer in the hub: she is met in the ATHLETE room. On the **first hub entry** of the level the Director's welcome starts by itself (no banner under it): by name, the centre and its rooms (ATHLETE, TESTING, DATA, TRAINING, ANALYSIS, then the ARENA), SELECT, START, B and autosave, then "go and meet Aisha in the ATHLETE room". The Director turns to face the player when they speak. It counts as given once its last page is read, and is saved (per level); left early with B it does not start by itself again this session, and talking to the Director gives the full welcome until it has been read. Once given, talking to the Director gives the reminder, or once Aisha is met the after lines (`directorReminder` / `directorAfter` in `src/rooms/content/meet-running.ts`). The ATHLETE room comes **before TESTING**: TESTING says "FINISH THE ATHLETE ROOM FIRST." until it is done, the arrow and the objectives panel point at ATHLETE first, the badge reads ROOMS N/5 and the arena needs all five. A classic visit (the other levels, `?rooms=classic`, or a visit that started before the room chunk loaded or after it failed) has none of this: the classic hub and its athlete, TESTING open from the start, exactly as before (`GameState.meetRoom` is false; it is set when the level starts, from `loader.ts meetRoomFor`).
- **Doors**: returning from a room puts the player just outside that room's door. Stepping on a completed room's door offers a replay (YES/NO). A room door that is not open yet says "FINISH THE <ROOM> ROOM FIRST." and the arena doors before all rooms are done say "THE ARENA OPENS WHEN ALL 4 ROOMS ARE DONE (N/4). NEXT: THE <ROOM> ROOM."; both step the player back
- **Rooms**: the player enters at (7,10), two tiles inside the exit door; while the challenge is open the room banner adds "A: TALK TO THE ATHLETE" (3 s) and a "!" bubble marks the room athlete. Facing the athlete and pressing A starts the challenge

---

## How challenges work (all rooms)

- Options are **shuffled** every time a list is shown, so the cursor's starting option is never a reliable answer
- A list ignores A for its first 0.35 s, so a press meant to skip text can't pick an option by accident
- **B leaves** a challenge at any point (the box's hint reads "B: QUIT"): the player is back in the room in front of the athlete, nothing is recorded, and a replay keeps the previous best
- **Completion**: "Room complete! Your <STAT> stat is now NN%." followed by the next room ("Next up: the DATA room. You can replay any room to raise its score.") or, after the last room, "Every room is done: the ARENA is open!" ("All four rooms are done: the ARENA is open!" on a classic visit)
- Multi-select rooms **remove options already picked** and show progress, e.g. "PICK A KEY VARIABLE (2 OF 3)"
- **Replays**: a completed room can be replayed from its hub door; the stat keeps the best result ("NEW BEST!" or "YOUR BEST STAYS AT NN%")

### Scoring

```
stat = dataQuality × 0.4 + variableAccuracy × 0.6
```

---

## Redesigned rooms (Distance Running)

Each redesigned room is an **instrument** (`src/rooms/<room>/`): a dt-driven state machine plus its renderer, run by `RoomChallengeScene` between the header plates and the dialogue box. It ends in the same `calcStat(dataQuality, variableAccuracy)` as the classic rooms, so the showdown maths is unchanged. Its map, tiles, animation and equipment lines live in `src/data/rooms/<room>*.ts`. All new physiology wording comes from `src/rooms/content/running.ts` (approved by Alan on 23 October 2026 and open for team review: `docs/content-review.md`); names, descriptions, right answers and explanations still come from `src/data/sports.ts`.

Shared behaviour: the first visit of a session shows the full rules, later visits the short line (a room counts as seen once its full rules were read to the end); B quits with nothing recorded, but asks "LEAVE?" (STAY / LEAVE) once decisions would be lost; new decisions ignore A and B for 0.35 s; START pauses everything; button names follow the device; screen readers hear every decision and result; ambient animation stops under reduced motion.

### Athlete Room (no stat): meet the athlete

The first room of Distance Running, before TESTING, following Phase 1 (athlete overview) of the scientific support process (Ruddock, Boyd, Winter and Ranchordas 2018, IJSPP; `docs/reference/scientific-support-process.txt`, Table 1). Content: `src/rooms/content/meet-running.ts` (`MEET_RUNNING`, typed by `meet-types.ts`), provisional and listed in `docs/content-review.md`.

- **Look** (`data/rooms/meet*.ts`, tiles 500-599): a calm consultation room. Sage wall with a window (clouds drift past), a whiteboard (PHASE 1, ATHLETE OVERVIEW), a clock (its second hand ticks), a kit shelf and a framed race bib; an oak floor; a teal rug with a table (the notebook, two steaming mugs) and two chairs. Aisha stands by her chair right of the table.
- **Flow** (`src/rooms/meet/`): until she has been met, Aisha introduces herself by name (26, 5000 m, her last-lap problem). The rules (full the first time, one line after), then **5 asks** from a shuffled list of 12 (8 good Phase 1 questions: goals, why support, previous support, her own view of her needs, lifestyle and money, training history and injuries, her training year and week, sleep and food; 4 weaker ones: a VO2max test now, writing her plan now, a leading question, her shoes). The list shows 5 at a time and scrolls; an asked question leaves it. She answers; a good question writes its note into the **NOTEBOOK** on screen (it glows) and says why it matters; a weaker one says why it can wait. Then a debrief by how many good questions were asked and her farewell, which points to TESTING.
- **Score**: OVERVIEW n/5 (good questions asked), shown on her card and in the completion line ("Room complete! Your athlete overview: 4/5. Next up: the TESTING room."). It is kept apart from the four stats: it never changes `playerStats`, `roomProgress` or the showdown rating. Replays (YES/NO at the door) keep the best ("New best! Overview now 5/5." / "Your best overview stays at 4/5."), and skip her introduction.
- **Buttons**: D-pad moves the cursor, A asks (ignored for 0.35 s when the list appears), B quits while nothing has been asked and asks "Leave the chat? Your notes will be lost." (STAY / LEAVE) once a question has been asked.
- **Saved**: `GameState.meet[level]` (`welcomed`, `met`, `best`, `of`), save format v3; v1 saves load with no meetings. A v2 save marks a level already under way (a room finished, or its boss beaten) as welcomed and met with no overview score (`of` 0, shown as DONE), so its open rooms and arena stay open; its other levels start with the welcome and the ATHLETE room. A later chat records a real overview.

### Testing Lab (SPEED): show the test, then run it

- **Look**: lab cabinets, whiteboard and wall clock; treadmill with console and gas-analysis cart; cycle ergometer; a sprint lane with timing gates, cones and a finish; the lactate bench (analyser, tube rack, laptop, centrifuge); a technician. Aisha waits at the start of the lane.
- **Flow**: brief (profile and goal) -> pick (the highlighted test plays live on a stage: its kit, three chips, what it gives and an effort chart, under "AISHA NEEDS: ..."; the prompt shows its sports.ts description) -> test day (one of five readiness checks at random: RUN THE TEST or RE-BOOK IT; a re-book turns the calendar on two days) -> run (about 5 s on the test's own kit, A skips; SHAKY if she should have been re-booked) -> lab printout (what it records; sent to the Data Lab, or not what she needs) -> the classic verdict and insight.
- **Score**: variableAccuracy = 1 (right test) or 0.3; dataQuality = the test's data quality x 1 (right call), 0.7 (ran when she should have been re-booked) or 0.95 (re-booked a ready athlete). Perfect 0.98; random about 0.64.

### Data Lab (STRENGTH): Trace Desk

- **Look**: a dark control room (`data` palette): a video wall of the level's five variables, workstations with analysts, server racks, a printer and the results desk where Aisha stands.
- **Flow**: brief (how the file was collected, the rules) -> clean-up (blood lactate against speed with the 2 and 4 mmol/L lines, plus three flying 30 m times; 4-5 flagged readings per attempt: the real steep rise and the real highest value, and 2-3 glitches from a contaminated sample, a failed 0.0 sample and a gate misfire; the lens shows each with its neighbours; A removes, RIGHT keeps; each call is explained) -> pin (the cleaned file beside a speed ladder with the speed reserve bracketed; pin 3 of the 5 variables; a value changed by the player's own cleaning shows with a '?') -> reveal (sports.ts explanations and insight).
- **Score**: dataQuality = 0.5 + 0.3 x the share of flagged readings judged right; variableAccuracy = right pins / 3. Perfect 0.92; random about 0.62.

### Training Floor (ENDURANCE): Hard-Easy Week

- **Look**: an orange running track (fenced; a jogger loops it), turf, plyo boxes, racks and mats; four coach boards (ZONES, INTERVAL, LEGS, WEEK) that are the same widgets as the planner; a coach with a stopwatch; Aisha skipping.
- **Flow**: brief -> plan a 7-day week (LEFT/RIGHT day, UP/DOWN session: the three KEY zones, EASY as a support session, REST; one random AWAY day, Tuesday to Thursday) while each morning's LEGS gauge updates live -> "Run the week?" -> the week plays out on the track (hold A to fast-forward) -> debrief (each key session's quality, the week's checks, the zone insight).
- **Score**: legs drop 50 the morning after a key session, 20 two mornings after, 5 after an easy run; a key session is full quality at 75+ and worthless at 45 or less. variableAccuracy = mean best quality of the three key sessions; dataQuality = 0.5 + 0.4 x structure (5+ sessions, 1-3 rest days, no morning under 45) when that mean is over 0.5, else 0.5. Perfect 0.96; key every day about 0.43.

### Analysis Room (POWER): Signal or Noise

- **Look**: a warm wood briefing room (`office` palette): projector chart, whiteboard with the noise band (TE, SWC), season planner, conference table, colleagues and a presenter; Aisha at the head of the table.
- **Flow**: brief (the ruler builds: baseline, two baseline trials, the NOISE band = baseline ± typical error, gold WORTH IT lines at ± the smallest worthwhile change) -> the 10-week block fills in -> forecast (LEFT/RIGHT move a pin; her earlier blocks show as ticks) -> the retest lands with error bars -> judge it (noise, real but too small, or real and worth acting on) -> judge VO2max, set aside in the Data Lab, the same way -> the prediction insight.
- **Score**: forecast c1 = full marks within one typical error of the retest, falling to 0 at four; c2 = share of the two verdicts right; q = 0.6 c1 + 0.4 c2; stat = 0.32 + 0.64 q. Perfect 0.96; all wrong 0.32.

---

## Classic rooms (levels 1-3)

The sections below describe the classic rooms, which levels 1-3 play (and level 4 with `?rooms=classic`).

## Room 1: Test Selection

| Attribute | Value |
|-----------|-------|
| **Map name** | Testing Lab |
| **Palette** | `lab` |
| **Stat awarded** | Speed |
| **Equipment** | Treadmill + gas analyser, Cycle ergometer, Timing gates + cones, Blood lactate analyser |
| **Challenge type** | Single choice from 4 test options |

### Flow

1. **Intro**: Athlete profile and goal displayed (e.g. "Jake, 24, winger. Goal: Improve repeated sprint ability")
2. **Challenge**: Player selects one of 4 fitness tests
3. **Feedback**: Correct choice → praise + test description; wrong choice → "Not ideal" + explanation
4. **Insight**: Sport-specific explanation of why the correct tests are appropriate
5. **Stat calculation**: `dataQuality` from the chosen test (0.5 to 0.95), `variableAccuracy` = 1.0 if correct, 0.3 if wrong

### Scoring

- Perfect answer: ~0.96 (96% speed stat)
- Wrong answer: ~0.38 (38% speed stat)

### Content per Level

| Level | Sport | Correct Tests | Incorrect Tests |
|-------|-------|---------------|-----------------|
| 1 | Rugby League | Yo-Yo IR2 (0.9), Repeated Sprint Ability (0.85) | Cooper 12-min Run (0.5), Wingate Test (0.6) |
| 2 | Cycling | Ramp Test/MAP (0.95), Critical Power Test (0.9) | Beep Test (0.5), 20-min FTP Test (0.7) |
| 3 | Boxing | Wingate Test (0.9), Boxing RSA Protocol (0.85) | Treadmill VO2max (0.6), Cooper 12-min Run (0.5) |
| 4 | Distance Running | Lactate Threshold Test (0.95), Critical Speed Test (0.9) | Wingate Test (0.5), Beep Test (0.6) |

> Note: Player selects **one** test. Multiple tests may be "correct" but only one is chosen.

---

## Room 2: Variable Identification

| Attribute | Value |
|-----------|-------|
| **Map name** | Data Lab |
| **Palette** | `gym` |
| **Stat awarded** | Strength |
| **Equipment** | 4 data screens (raw output, HR trace, power curve, recovery metrics) |
| **Challenge type** | Sequential multi-select: pick N correct variables from 5 options |

### Flow

1. **Intro**: Test data output displayed (e.g. "Yo-Yo IR2 Result: Level 22.5, Distance 1280m, HR max 192bpm...")
2. **Challenge**: Player selects variables one at a time; picked variables leave the list. Number of selections = number of correct variables (3)
3. **Feedback per pick**: Correct → explanation of why it matters; wrong → explanation of why it's not key
4. **Insight**: Summary of the trainable variables
5. **Stat calculation**: `variableAccuracy` = correctCount / totalCorrect; `dataQuality` = 0.8 if >50% correct, else 0.5

### Scoring

- All correct: `0.8 × 0.4 + 1.0 × 0.6 = 0.92` (92%)
- 2 of 3 correct: `0.8 × 0.4 + 0.67 × 0.6 = 0.72` (72%)
- 0 correct: `0.5 × 0.4 + 0.0 × 0.6 = 0.20` (20%)

### Content per Level

| Level | Correct Variables | Incorrect Variables |
|-------|-------------------|---------------------|
| 1 | Total Distance (1280m), Recovery HR (145bpm), Blood Lactate (11.2) | HR Max (192bpm), Test Level (22.5) |
| 2 | MAP (340W), VO2max (62 ml/kg/min), Power/Weight (5.86 W/kg) | HR Max (188bpm), Body Weight (58kg) |
| 3 | Peak Power (890W), Mean Power (640W), Fatigue Index (42%) | Body Mass (75kg), Time to Peak (4.2s) |
| 4 | LT2 Pace (3:20/km), vVO2max Pace (2:55/km), Max Sprint Speed (28 km/h) | LT1 Pace (3:45/km), VO2max (65 ml/kg/min) |

Level 2's data line also reports the critical power test (CP 255W, W' 15kJ), which anchors the Room 3 zones. Level 4's speed reserve is max sprint speed minus vVO2max.

---

## Room 3: Training Prescription

| Attribute | Value |
|-----------|-------|
| **Map name** | Training Floor |
| **Palette** | `track` |
| **Stat awarded** | Endurance |
| **Equipment** | Training zone calculator, Periodisation planner, Interval timer, Load monitoring display |
| **Challenge type** | Sequential multi-select: pick N correct zones from 4 options |

### Flow

1. **Intro**: "Based on the test data, which training zones should we prescribe?"
2. **Challenge**: Player selects zones one at a time; picked zones leave the list. Number of selections = number of correct zones (3)
3. **Feedback per pick**: Correct → "Good call!" + description; wrong → "Not the priority" + description
4. **Insight**: Summary of correct zone rationale
5. **Stat calculation**: `variableAccuracy` = correctCount / totalCorrect; `dataQuality` = 0.85 if >50% correct, else 0.5

### Scoring

- All correct: `0.85 × 0.4 + 1.0 × 0.6 = 0.94` (94%)
- 2 of 3 correct: `0.85 × 0.4 + 0.67 × 0.6 = 0.74` (74%)
- 0 correct: `0.5 × 0.4 + 0.0 × 0.6 = 0.20` (20%)

### Content per Level

| Level | Correct Zones | Incorrect Zone |
|-------|---------------|----------------|
| 1 | High Intensity Intervals (>170bpm), Repeated Sprint Training (95-100% max), Tempo Running (160-170bpm) | Zone 2 Aerobic Base (130-150bpm) |
| 2 | Tempo / Sweet Spot (85-95% CP), VO2max Intervals (90-100% MAP), Threshold Work (95-105% CP) | Recovery Rides (<55% CP) |
| 3 | Alactic Power (6-10s max), Glycolytic Intervals (30-60s hard), Repeat Power Bouts (10s on/20s off) | Long Slow Distance (30+ min easy) |
| 4 | Sub-threshold (LT1-LT2), Supra-threshold Intervals (faster than LT2), Sprint Training (near max sprint speed) | Easy Running (slower than LT1) |

---

## Room 4: Performance Prediction

| Attribute | Value |
|-----------|-------|
| **Map name** | Analysis Room |
| **Palette** | `lab` |
| **Equipment** | 4 prediction model screens (adaptation curves, performance trajectory, training load response, competition readiness) |
| **Stat awarded** | Power |
| **Challenge type** | Single choice from 4 prediction outcomes |

The conference table has a gap at (7,8) so the athlete can be reached walking straight up from the door.

### Flow

1. **Intro**: Prediction scenario presented (e.g. "After 6 weeks of targeted training, what adaptation do you expect?")
2. **Challenge**: Player selects one of 4 predicted outcomes
3. **Feedback**: Correct → "Excellent prediction!" + insight; wrong → "Not the most likely outcome" + insight
4. **Stat calculation**: Correct: `dataQuality` = 0.9, `variableAccuracy` = 1.0; Wrong: `dataQuality` = 0.5, `variableAccuracy` = 0.2

### Scoring

- Correct: `0.9 × 0.4 + 1.0 × 0.6 = 0.96` (96%)
- Wrong: `0.5 × 0.4 + 0.2 × 0.6 = 0.32` (32%)

### Content per Level

| Level | Scenario | Correct Prediction | Incorrect Predictions |
|-------|----------|--------------------|-----------------------|
| 1 | After 6 weeks of targeted training | Sprint decrement reduces from 8% to 4% | VO2max +15%, Body mass -5kg, RHR drops to 40bpm |
| 2 | After 8 weeks of structured power training | MAP increases from 340W to 360W | Sprint power doubles, Weight drops to 50kg, Recovery HR +30bpm |
| 3 | After 6 weeks of anaerobic-focused training | Fatigue index drops from 42% to 30% | VO2max +20%, Peak power same/technique improves, Body mass -10kg |
| 4 | After 10 weeks of speed reserve training | Last 400m kick improves from 62s to 60s | VO2max 65→75, LT2 stays at 3:20/km, Weight drops significantly |

---

## Boss Arena

After completing all 4 rooms, the arena opens. Each level has a unique rival and minigame type.

### Showdown Rating

```
rating = 0.7 × focusStat + 0.3 × mean(speed, strength, endurance, power)
```

The focus stat is the level's boss stat (speed, strength, endurance or power), awarded by one room (see Stat Summary). The rating is the player's ceiling: perfect play scores exactly the rating.

### Boss Flow

1. **Rival taunt**: the rival jabs at the skill the bout tests. From here until the countdown the stat comparison stays on screen: player vs rival stats, the focus stat highlighted, its room named, and "RATING NN% VS TARGET NN%". B on any dialogue before the countdown ("B: LEAVE ARENA") returns to the hub outside the arena doors
2. **Pre-check**: if the rating cannot beat the rival's target, a warning offers BACK TO HUB (to replay the room) or FIGHT ANYWAY
3. **Rules card** (the gate before every bout; "A: READY" on its last page): the first time this session that a bout type comes up, two pages: "Your <STAT> rating is NN%: that is the most your bar can reach. Finish above <RIVAL>'s target of NN% to win." and how to play (e.g. "Tap A as fast as you can until the time runs out. Every tap pushes your bar higher."). Later bouts of that type get one line, e.g. "Beat 34% to win. Tap A as fast as you can."
4. **Countdown**: 3, 2, 1, GO with the control prompt on screen; A is ignored for the first 0.3 s after GO
5. **Minigame**: the prompt shows the A button (or, on a keyboard, a SPACE key) and what to do ("TAP FAST!", "HOLD IT DOWN!", "TAP ON THE BEAT!", "TAP AT THE MARK!"). The player's bar is labelled YOU, hatched beyond the rating, with a marker at the rival's "TARGET NN%"
6. **Result**: 1.5 s later the rival's line (win) or "Better data next time, {NAME}." (loss), which ignores A and B for 1 s so a mash carried over from the bout can't skip it, then the results screen (which ignores input for 1.5 s)

### Rival Target

- Rival ceiling: `0.4 + 0.1 × level index` (index 0 to 3), plus 0.05 for strength and power (Level 1 speed 0.40 ... Level 4 power 0.75)
- Rival target (final score) = factor × rival ceiling, with factor 0.85 (sprint), 0.8 (strength), 0.75 (endurance), 0.7 (power)
- The player wins by finishing strictly above the target

### Minigame Types

| Type | Level | Boss Stat | Mechanic | Duration | Full score |
|------|-------|-----------|----------|----------|------------|
| **Sprint** | 1 | Speed | Tap A fast | 5s | 30 presses |
| **Strength** | 2 | Strength | Hold A | 4s | 2.5 s of holding |
| **Endurance** | 3 | Endurance | Press A on the beat as notes approach | ~8 s | Hit all 9 beats (every 0.8 s, from 1 s); window 0.12 s early to 0.18 s late; stray presses count as misses, once per gap |
| **Power** | 4 | Power | One press when the cursor crosses the mark | 3s | Within ±2% of the sweet spot; the mark first comes round ~0.5 s after GO |

### After the Bout

- **Win**: LEVEL CLEAR (or GAME COMPLETE after the last unbeaten level) with the four stats; the level's room progress resets, so a replay starts fresh
- **Win** screen line: "SCORE NN% VS TARGET NN%"
- **Loss**: DEFEATED with "RATING NN% VS TARGET NN%", "SCORE NN% VS TARGET NN%" and a diagnosis: if the rating could not beat the target, "YOUR <STAT> RATING WAS TOO LOW. REPLAY THE <ROOM> ROOM."; if the bout saw no A at all, "NO A PRESSES DETECTED. PRESS A DURING THE BOUT."; otherwise "YOUR SCIENCE WAS GOOD ENOUGH." with a tip for the bout type (tap faster, keep A held, press as each note hits the zone, tap when the cursor is in the green). Choices: RETRY SHOWDOWN, BACK TO HUB (room progress kept), LEVEL SELECT

### Rivals per Level

| Level | Rival | Taunt | Loss Line |
|-------|-------|-------|-----------|
| 1 | Dr. Voss | "Your test selection was amateur hour. My athlete was optimised from day one." | "Impossible... your protocols actually worked." |
| 2 | Prof. Krane | "Your data analysis was full of textbook errors. My athlete will crush yours on the climb." | "Your power data was... surprisingly precise." |
| 3 | Coach Steele | "Your boxer will gas out by round 3. Mine was built for 12." | "Your conditioning program... it actually held up." |
| 4 | Dr. Okafor | "Your predictions were wishful thinking. My runner has the kick to prove it." | "Your speed reserve protocol... I need to study your methods." |

---

## Stat Summary

| Room | Stat | Focus of |
|------|------|----------|
| 1: Test Selection | Speed | Level 1 Sprint (mash) |
| 2: Variable Identification | Strength | Level 2 Strength (hold) |
| 3: Training Prescription | Endurance | Level 3 Endurance (rhythm) |
| 4: Performance Prediction | Power | Level 4 Power (timing) |

Formula: `stat = dataQuality × 0.4 + variableAccuracy × 0.6`; `rating = 0.7 × focus + 0.3 × mean of all four`.

Higher room performance → higher showdown rating → easier boss minigame.
