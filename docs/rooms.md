# PhysQuest: Room Design Document

## Overview

Each level contains **4 challenge rooms** plus a **boss arena**. The player navigates a hub overworld (Sports Performance Centre) and enters rooms through doors. The rooms are taken **in order** (TESTING, DATA, TRAINING, ANALYSIS): a room opens once the one before it is done, and a finished room stays open for replays. All 4 rooms must be completed before the arena opens.

Each room records a **support score** (0 to 100%) that grades the player's own work there: **TEST CHOICE** (TESTING), **DATA INSIGHT** (DATA), **TRAINING PLAN** (TRAINING) and **EVALUATION** (ANALYSIS). They are not qualities of the athlete, so they are not named like them. The save keeps the original keys (`speed`, `strength`, `endurance`, `power` in `PlayerStats`, in that room order); only what the player sees changed (`SCORE_LABEL` / `SCORE_SHORT` in `src/systems/SupportScores.ts`). The scores combine into a **showdown rating** that caps how well the player's athlete can perform in the boss minigame. The ATHLETE room's OVERVIEW (n/5) is kept apart: it is not a support score and never feeds the rating.

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
- **Objectives panel** (SELECT): the player's name ("SPORT SCIENTIST" beside it), level, the ATHLETE row first when there is one ("ATHLETE (OVERVIEW)": best n/5, or NEXT), each room with the score it records (e.g. "TESTING (TEST CHOICE)") and its status (score, NEXT, or a lock), the four SUPPORT SCORES as bars, and a "next" hint. Read aloud as e.g. "TESTING gives the test choice score, 85 percent".
- **SUPPORT BOARD** (Distance Running hub only, `src/render/SupportBoard.ts`, placed by `src/data/supportBoard.ts`): a small board on the north wall top left (over tiles (1-3, 0), clear of the ROOMS badge and its hint) with each score's initial (T, D, P, E) and a bar that fills as it rises (an empty track until the room is done). Facing it from (1-3, 1) shows the A bubble beside the player's head; A opens the full board: the four scores by name with bars and values ("--" until the room is done; the focus score in blue with a star), ATHLETE OVERVIEW n/5, SHOWDOWN RATING (green when it beats the target, red when not), RIVAL TARGET, how the rating is made ("*70% TRAINING PLAN + 30% ALL FOUR") and the ARENA's status (LOCKED (n/5 ROOMS), TALK TO DR ELLIS, or OPEN). The world freezes while it is open; A, B, SELECT or START close it (START never opens the pause menu over it). The whole board is read to screen readers when it opens, and the hub's description names it. Dr Ellis explains it: two pages in the welcome, just before the last ("Aisha is waiting in the ATHLETE room"), and one line in each check-in, after the findings and before what next, naming the score the room just set and its percent (`src/rooms/content/board-running.ts`, provisional, see `docs/content-review.md`). The classic hub has no board.
- **NPCs**: the athlete at the centre wears a "!" until the player has talked to it (per session); it explains the room order, the arena and the SELECT/B controls. NPCs, signs and plants are solid
- **Distance Running** (a visit that plays the redesigned rooms): the hub is `data/rooms/hub.ts` (`DIRECTOR_HUB`). The **Performance Director** (Dr Ellis, `DIRECTOR_SPRITE`) stands where the athlete stood, and a **fifth door, ATHLETE**, is set into the bottom wall left of the arena (door (3,12), plate on the wall under it, `data/meetDoor.ts`). Aisha is no longer in the hub: she is met in the ATHLETE room. On the **first hub entry** of the level the Director's welcome starts by itself (no banner under it): by name, the centre and its rooms (ATHLETE, TESTING, DATA, TRAINING, ANALYSIS, then the ARENA), SELECT, START, B and autosave, then "go and meet Aisha in the ATHLETE room". The Director turns to face the player when they speak. It counts as given once its last page is read, and is saved (per level); left early with B it does not start by itself again this session, and talking to the Director gives the full welcome until it has been read. Once given, talking to the Director gives the reminder (`directorReminder` in `src/rooms/content/meet-running.ts`) until Aisha is met, then the needs chat and check-ins below. The ATHLETE room comes **before TESTING**: TESTING says "FINISH THE ATHLETE ROOM FIRST." until it is done, the arrow and the objectives panel point at ATHLETE first, the badge reads ROOMS N/5 and the arena needs all five.
- **The Director's needs chat and check-ins** (Distance Running visits with the ATHLETE room; `needs` and `checkIns` in `meet-running.ts`, typed by `meet-types.ts`; lines in `systems/CheckIns.ts`, flow in `OverworldScene`). Every line is on the Director's name tab.
  - **Needs chat** (Phase 2, after the ATHLETE room, before TESTING): the intro, then each question in order (its last page asks, with the answers shuffled each time it is asked), the Director's reply to the pick, then what they agree. Not scored, no stat. TESTING opens once it has been read to the end.
  - **Check-ins**: after the first completion of TESTING, DATA, TRAINING and ANALYSIS, the Director talks the room over before the next room (or the ARENA) opens. TESTING: the lines for the test that was run (`checkIns.testing[<test name>]`), then the test-day call (`testingCall.right` / `ranAnyway` / `needlessRebook`), then `testingNext`. DATA / TRAINING / ANALYSIS: the band by the room's support score as shown (strong 80%+, mixed 50%+, weak below), then `dataNext` / `trainingNext` / `analysisNext`. `{ROOM}` is the next room's hub sign (ARENA after ANALYSIS).
  - **Gating**: a room whose talk is still due stays shut and its door says `checkIns.doorRefusal` (TALK TO DR ELLIS FIRST.); so do the arena doors once all five rooms are done. The arrow points at the Director (over the "!"), the objectives panel's hint says NEXT: TALK TO DR ELLIS and shows the room locked, the room's completion line says "Next: talk to Dr Ellis in the hub.", and arriving in the hub tells screen readers "Next: talk to Dr Ellis.".
  - **Starting and leaving**: back in the hub with a talk due, it starts by itself (once per talk per session). B leaves it at once and nothing is kept: it counts only once read to the end, and talking to the Director gives it again from the start. Replays need no new check-in; talking to the Director with nothing due gives the latest room's findings again, then `directorAfter` (Next stop: {ROOM}); before TESTING, `needs.reminder`.
  - **Saved** per level in `GameState.meet[level]`: `needs`, `heard` (per room) and the Testing Lab's last `test` and `call` (save format v4). Saves from before (v2, v3) count the needs chat as done and each finished room's check-in as heard, so no one is locked out. A finished room in a classic visit (no Director) counts as heard. Winning the level clears `heard`, `test` and `call` with the rooms. A classic visit (the other levels, `?rooms=classic`, or a visit that started before the room chunk loaded or after it failed) has none of this: the classic hub and its athlete, TESTING open from the start, exactly as before (`GameState.meetRoom` is false; it is set when the level starts, from `loader.ts meetRoomFor`).
- **Doors**: returning from a room puts the player just outside that room's door. Stepping on a completed room's door offers a replay (YES/NO). A room door that is not open yet says "FINISH THE <ROOM> ROOM FIRST." and the arena doors before all rooms are done say "THE ARENA OPENS WHEN ALL 4 ROOMS ARE DONE (N/4). NEXT: THE <ROOM> ROOM."; both step the player back
- **Rooms**: the player enters at (7,10), two tiles inside the exit door; while the challenge is open the room banner adds "A: TALK TO THE ATHLETE" (3 s) and a "!" bubble marks the room athlete. Facing the athlete and pressing A starts the challenge

---

## How challenges work (all rooms)

- Options are **shuffled** every time a list is shown, so the cursor's starting option is never a reliable answer
- A list ignores A for its first 0.35 s, so a press meant to skip text can't pick an option by accident
- **B leaves** a challenge at any point (the box's hint reads "B: QUIT"): the player is back in the room in front of the athlete, nothing is recorded, and a replay keeps the previous best
- **Completion**: "Room complete! Your <SCORE> score is now NN%." (e.g. TEST CHOICE) followed by the next room ("Next up: the DATA room. You can replay any room to raise its score.") or, after the last room, "Every room is done: the ARENA is open!" ("All four rooms are done: the ARENA is open!" on a classic visit)
- Multi-select rooms **remove options already picked** and show progress, e.g. "PICK A KEY VARIABLE (2 OF 3)"
- **Replays**: a completed room can be replayed from its hub door; the score keeps the best result ("New best! <SCORE> now NN%" or "Your best <SCORE> score stays at NN%"); the door asks "THIS ROOM IS COMPLETE (BEST <SCORE> NN%). REPLAY IT TO RAISE YOUR SCORE?"

### Scoring

```
stat = dataQuality × 0.4 + variableAccuracy × 0.6
```

---

## Redesigned rooms (Distance Running)

Each redesigned room is an **instrument** (`src/rooms/<room>/`): a dt-driven state machine plus its renderer, run by `RoomChallengeScene` between the header plates and the dialogue box. It ends in the same `calcStat(dataQuality, variableAccuracy)` as the classic rooms, so the showdown maths is unchanged. Its map, tiles, animation and equipment lines live in `src/data/rooms/<room>*.ts`. All new physiology wording comes from `src/rooms/content/running.ts` (approved by Alan on 23 October 2026 and open for team review: `docs/content-review.md`); names, descriptions, right answers and explanations still come from `src/data/sports.ts`.

Shared behaviour: the first visit of a session shows the full rules, later visits the short line (a room counts as seen once its full rules were read to the end); B quits with nothing recorded, but asks "LEAVE?" (STAY / LEAVE) once decisions would be lost; new decisions ignore A and B for 0.35 s; START pauses everything; button names follow the device; screen readers hear every decision and result; ambient animation stops under reduced motion.

### Athlete Room (no support score): meet the athlete

The first room of Distance Running, before TESTING, following Phase 1 (athlete overview) of the scientific support process (Ruddock, Boyd, Winter and Ranchordas 2018, IJSPP; `docs/reference/scientific-support-process.txt`, Table 1). Content: `src/rooms/content/meet-running.ts` (`MEET_RUNNING`, typed by `meet-types.ts`), provisional and listed in `docs/content-review.md`.

- **Look** (`data/rooms/meet*.ts`, tiles 500-599): a calm consultation room. Sage wall with a window (clouds drift past), a whiteboard (PHASE 1, ATHLETE OVERVIEW), a clock (its second hand ticks), a kit shelf and a framed race bib; an oak floor; a teal rug with a table (the notebook, two steaming mugs) and two chairs. Aisha stands by her chair right of the table.
- **Flow** (`src/rooms/meet/`): until she has been met, Aisha introduces herself by name (26, 5000 m, her last-lap problem). The rules (full the first time, one line after), then **5 asks** from a shuffled list of 12 (8 good Phase 1 questions: goals, why support, previous support, her own view of her needs, lifestyle and money, training history and injuries, her training year and week, sleep and food; 4 weaker ones: a VO2max test now, writing her plan now, a leading question, her shoes). The list shows 5 at a time and scrolls; an asked question leaves it. She answers; a good question writes its note into the **NOTEBOOK** on screen (it glows) and says why it matters; a weaker one says why it can wait. Then a debrief by how many good questions were asked and her farewell, which points to TESTING.
- **Score**: OVERVIEW n/5 (good questions asked), shown on her card and in the completion line ("Room complete! Your athlete overview: 4/5. Next: talk to Dr Ellis in the hub.": the needs chat comes before TESTING). It is kept apart from the four support scores: it never changes `playerStats`, `roomProgress` or the showdown rating. Replays (YES/NO at the door) keep the best ("New best! Overview now 5/5." / "Your best overview stays at 4/5."), and skip her introduction.
- **Buttons**: D-pad moves the cursor, A asks (ignored for 0.35 s when the list appears), B quits while nothing has been asked and asks "Leave the chat? Your notes will be lost." (STAY / LEAVE) once a question has been asked.
- **Saved**: `GameState.meet[level]` (`welcomed`, `met`, `best`, `of`, and the Director's `needs`, `heard`, `tests` (the last battery), `call`), save format v4 (an early v4 save's single `test` loads as a battery of one); v1 saves load with no meetings. A v2 save marks a level already under way (a room finished, or its boss beaten) as welcomed and met with no overview score (`of` 0, shown as DONE), so its open rooms and arena stay open; its other levels start with the welcome and the ATHLETE room. A later chat records a real overview.

### Testing Lab (TEST CHOICE): show the test, then run it

- **Look**: lab cabinets, whiteboard and wall clock; treadmill with console and gas-analysis cart; cycle ergometer; a sprint lane with timing gates, cones and a finish; the lactate bench (analyser, tube rack, laptop, centrifuge); a technician. Aisha waits at the start of the lane.
- **Flow**: brief (the profile, then `needs.testingBrief` agreed in the needs chat; the classic goal for a level without meet content) -> pick a **battery of 2 tests** (`testing.battery`; the highlighted test plays live on a stage: its kit, three chips, what it gives and an effort chart, under "AISHA NEEDS: ..." (`needs.testingNeeds`); the prompt asks "Choose 2 tests for her battery." and shows its sports.ts description; A adds it (ticked and greyed in the list, the cursor moves on to the next test), B takes the last one out, then quits) -> test day (one readiness check for the whole battery, at random from five: RUN THE TESTS or RE-BOOK IT; a re-book turns the calendar on two days) -> each test runs in turn (about 5 s each on its own kit, A skips one; SHAKY if she should have been re-booked) -> lab printout (each test with a tick when it gives the Data Lab a file, a cross when not, and what it records; verdict BOTH SENT TO THE DATA LAB, 1 OF 2 TO THE DATA LAB or NO FILE FOR THE DATA LAB) -> A completes the room. The room records the battery (in the order picked) and the call; the Director's check-in in the hub says what each test found and what the battery means.
- **Score**: variableAccuracy = 1 (Lactate Profile + Critical Speed Test), 0.65 (one of them) or 0.3 (neither); dataQuality = the battery's mean data quality x 1 (right call), 0.7 (ran when she should have been re-booked) or 0.95 (re-booked a ready athlete). Perfect 0.97; one right test about 0.68-0.69; neither 0.40.
- **Send-back**: after a battery with neither test that has a Data Lab file (Wingate + Beep), Dr Ellis explains why those tests can't give zones or D prime and DATA stays shut (`retestDue`; even a DATA room finished earlier, and the ARENA) until TESTING is run again: the arrow and the objectives say NEXT: RE-TEST IN TESTING and the DATA door says RE-TEST IN TESTING FIRST. A re-test (or any battery after a send-back) gets its check-in again. After a partial battery Ellis says what is missing and DATA opens.

### Data Lab (DATA INSIGHT): Trace Desk

- **Look**: a dark control room (`data` palette): a video wall naming five variables (labels only: no number from a test that may not have been run), workstations with analysts, server racks, a printer and the results desk where Aisha stands.
- **Files**: one per test the battery ran that has one (`data.lactate`, `data.trials`; the room gets the battery as `host.tests`, every file before any battery). **Lactate profile**: lactate (mmol/L) against treadmill speed (km/h), stages 12-18 km/h; LT1 = where lactate first rises 0.5 mmol/L above her lowest reading, LT2 = 4 mmol/L; HR at LT2 between the stages either side; VO2max and vVO2max from the final ramp. Flagged: 1 or 2 glitches (contaminated sample, failed 0.0 sample, at a stage whose removal leaves the clean numbers as they are: 13 or 16 km/h) and the real steep rise (17 km/h) and highest value (18 km/h). **Critical speed trials**: a table of distance (m), time (min:s) and pace (min:s per km) for 1200, 2400 and 3600 m; CS and D prime are the least-squares line of distance against time, shown under the table once the file is clean. Flagged: the real 1200 m (fastest per km) and one mistimed trial (2400 m 40 s long, or 3600 m 40 s short).
- **Flow**: brief (first visit: what to do, a worked example of a glitch against a real rise, "Use {DPAD} to choose KEEP or REMOVE, then {A}."; later: one line) -> each file in turn under its own header plate ("FILE 1/2: LACTATE PROFILE (TREADMILL)", "FILE 2/2: CRITICAL SPEED (TRACK TRIALS)", a colour per file with the words), introduced by a line in the box ("First file: ...", "Next file: ...", "Her file: ..."; first visit adds its protocol and its rule) -> for each flagged reading the box asks "Reading 2 of 3: lactate at 16 km/h. Real data, or a glitch?" with what the software says, and a KEEP IT (REAL) / REMOVE IT (GLITCH) list above it (cursor on KEEP; UP/DOWN, A confirms after 0.35 s; LEFT looks back); the reading is bracketed with a "?" on the chart, then shows KEPT or REMOVED (word and symbol); a removed point leaves a grey ring and the line is redrawn without it -> "Files clean. Now choose her KEY VARIABLES: the 4 numbers ..." (the count from the files present; first visit adds an example from another sport) -> the KEY VARIABLES panel (slots that fill with name and value with units, LOCK IN once full) over the candidates grouped by file (FROM THE LACTATE PROFILE: / FROM THE CS TRIALS:); a value changed by the player's own cleaning shows with a '?' -> LOCK IN asks "Lock in these 4 key variables? You can't change them after." (STAY / LOCK IN) -> reveal (sports.ts explanations; the insight, or the one file's own insight).
- **Score**: dataQuality = 0.5 + 0.3 x the share of flagged readings judged right; variableAccuracy = right key variables / how many the files present have (4 with both files: LT2, vVO2max, CS, D prime; 2 with one). Perfect 0.92; random about 0.6; worst 0.2.

### Training Floor (TRAINING PLAN): Hard-Easy Week

- **Look**: an orange running track (fenced; a jogger loops it), turf, plyo boxes, racks and mats; four coach boards (ZONES, INTERVAL, LEGS, WEEK) that are the same widgets as the planner; a coach with a stopwatch; Aisha skipping.
- **Flow**: brief -> plan a 7-day week (LEFT/RIGHT day, UP/DOWN session: the three KEY zones, EASY as a support session, REST; one random AWAY day, Tuesday to Thursday) while each morning's LEGS gauge updates live -> "Run the week?" -> the week plays out on the track (hold A to fast-forward) -> debrief (each key session's quality, the week's checks, the zone insight).
- **Zones** (from her anchors): Threshold Running (LT2 to CS, 3:34-3:22/km), Severe Intervals (CS to vVO2max, 3:22-3:09/km) and Fast Reps (faster than vVO2max, 3:09/km) are key; Easy Running (slower than LT1, 4:08/km) is support. A target whose numbers come from a test the battery did not run is shown in words (e.g. LT2 TO CS PACE: `card.uses`, `card.plain`).
- **Score**: legs drop 50 the morning after a key session, 20 two mornings after, 5 after an easy run; a key session is full quality at 75+ and worthless at 45 or less. variableAccuracy = mean best quality of the three key sessions; dataQuality = 0.5 + 0.4 x structure (5+ sessions, 1-3 rest days, no morning under 45) when that mean is over 0.5, else 0.5. Perfect 0.96; key every day about 0.43.

### Analysis Room (EVALUATION): Signal or Noise

- **Look**: a warm wood briefing room (`office` palette): projector chart, whiteboard with the noise band (TE, SWC), season planner, conference table, colleagues and a presenter; Aisha at the head of the table.
- **Flow**: brief (first visit: a walk-through of the board one element at a time, each highlighted as it is explained: BEFORE 72 S, the NOISE band (NOISE: TYPICAL ERROR 0.6 S), the WORTHWHILE CHANGE lines, then YOUR GUESS; later visits: one line) -> the 10-week block fills in -> forecast ("Where will her last 400 m be after the 10-week block? Move YOUR GUESS with {LEFT} and {RIGHT}, then {A} to lock it in."; the YOUR GUESS marker carries its value and unit, arrows either side; her earlier blocks show as ticks) -> the retest lands with error bars -> judge it from a choice list (noise, real but too small, or real and worth acting on) -> judge VO2max (58 to 60 ml/kg/min), set aside in the Data Lab, the same way -> the prediction insight. The trained result is her last 400 m of a 5000 m: 72 s before, 70 s after (typical error 0.6 s, smallest worthwhile change 0.8 s).
- **Score**: forecast c1 = full marks within one typical error of the retest, falling to 0 at four; c2 = share of the two verdicts right; q = 0.6 c1 + 0.4 c2; stat = 0.32 + 0.64 q. Perfect 0.96; all wrong 0.32.

---

## Classic rooms (levels 1-3)

The sections below describe the classic rooms, which levels 1-3 play (and level 4 with `?rooms=classic`).

## Room 1: Test Selection

| Attribute | Value |
|-----------|-------|
| **Map name** | Testing Lab |
| **Palette** | `lab` |
| **Score recorded** | TEST CHOICE (key `speed`) |
| **Equipment** | Treadmill + gas analyser, Cycle ergometer, Timing gates + cones, Blood lactate analyser |
| **Challenge type** | Single choice from 4 test options |

### Flow

1. **Intro**: Athlete profile and goal displayed (e.g. "Jake, 24, winger. Goal: Improve repeated sprint ability")
2. **Challenge**: Player selects one of 4 fitness tests
3. **Feedback**: Correct choice → praise + test description; wrong choice → "Not ideal" + explanation
4. **Insight**: Sport-specific explanation of why the correct tests are appropriate
5. **Stat calculation**: `dataQuality` from the chosen test (0.5 to 0.95), `variableAccuracy` = 1.0 if correct, 0.3 if wrong

### Scoring

- Perfect answer: ~0.96 (96% TEST CHOICE)
- Wrong answer: ~0.38 (38% TEST CHOICE)

### Content per Level

| Level | Sport | Correct Tests | Incorrect Tests |
|-------|-------|---------------|-----------------|
| 1 | Rugby League | Yo-Yo IR2 (0.9), Repeated Sprint Ability (0.85) | Cooper 12-min Run (0.5), Wingate Test (0.6) |
| 2 | Cycling | Ramp Test/MAP (0.95), Critical Power Test (0.9) | Beep Test (0.5), 20-min FTP Test (0.7) |
| 3 | Boxing | Wingate Test (0.9), Boxing RSA Protocol (0.85) | Treadmill VO2max (0.6), Cooper 12-min Run (0.5) |
| 4 | Distance Running | Lactate Profile (0.95), Critical Speed Test (0.9) | Wingate Test (0.5), Beep Test (0.6) |

> Note: Player selects **one** test. Multiple tests may be "correct" but only one is chosen.

---

## Room 2: Variable Identification

| Attribute | Value |
|-----------|-------|
| **Map name** | Data Lab |
| **Palette** | `gym` |
| **Score recorded** | DATA INSIGHT (key `strength`) |
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
| **Score recorded** | TRAINING PLAN (key `endurance`) |
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
| **Score recorded** | EVALUATION (key `power`) |
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
rating = 0.7 × focus score + 0.3 × mean(TEST CHOICE, DATA INSIGHT, TRAINING PLAN, EVALUATION)
```

The focus score is the support score that best decides the level's bout (`showdownFocus` in `src/systems/SupportScores.ts`). The bout itself (which minigame, and the rival's strength) still comes from the sport's `bossStat` in `sports.ts` (`boutStat`).

- **Distance Running**: the bout is the **RACE TO THE LINE** (below), and the focus is **TRAINING PLAN** (the TRAINING room): the training plan decides how much D' (her KICK gauge) and finishing speed she brings to the race. The ANALYSIS room's EVALUATION (which would follow her `bossStat`, power) judges whether a change is real; it does not give her the kick, so it counts in the 30% like the others. The bout type comes from `boutType` (`src/systems/SupportScores.ts`); the rival's ceiling still follows `bossStat`, so the TARGET is unchanged (53%).
- **Classic levels** keep their mapping, relabelled: Rugby League TEST CHOICE (sprint), Cycling DATA INSIGHT (strength), Boxing TRAINING PLAN (endurance).

The rating is the player's ceiling: perfect play scores exactly the rating. The hub's SUPPORT BOARD shows the same rating and TARGET as the arena.

### Boss Flow

1. **Rival taunt**: the rival jabs at the skill the bout tests. From here until the countdown the score comparison stays on screen: player vs rival bars for TEST, DATA, PLAN and EVAL (short names, so they fit between the bars), the focus score highlighted, "FOCUS: <SCORE> (<ROOM> ROOM)", and "RATING NN% VS TARGET NN%". B on any dialogue before the countdown ("B: LEAVE ARENA") returns to the hub outside the arena doors
2. **Pre-check**: if the rating cannot beat the rival's target, a warning ("YOUR RATING (NN%) CAN'T BEAT <RIVAL>'S NN%. IT IS MOSTLY YOUR <SCORE> SCORE: REPLAY THE <ROOM> ROOM TO RAISE IT.") offers BACK TO HUB (to replay the room) or FIGHT ANYWAY
3. **Rules card** (the gate before every bout; "A: READY" on its last page; for the race, the first card says "A: PRACTICE" and the practice straight follows, see below): the first time this session that a bout type comes up, two pages: "Your showdown rating is NN%, mostly from your <SCORE> score: that is the most your bar can reach. Finish above <RIVAL>'s target of NN% to win." and how to play (e.g. "Tap A as fast as you can until the time runs out. Every tap pushes your bar higher."). Later bouts of that type get one line, e.g. "Beat 34% to win. Tap A as fast as you can."
4. **Countdown**: 3, 2, 1, GO with the control prompt on screen; A is ignored for the first 0.3 s after GO
5. **Minigame**: the prompt shows the A button (or, on a keyboard, a SPACE key) and what to do ("TAP FAST!", "HOLD IT DOWN!", "TAP ON THE BEAT!", "TAP AT THE MARK!"). The player's bar is labelled YOU, hatched beyond the rating, with a marker at the rival's "TARGET NN%"
6. **Result**: 1.5 s later the rival's line (win) or "Better data next time, {NAME}." (loss), which ignores A and B for 1 s so a mash carried over from the bout can't skip it, then the results screen (which ignores input for 1.5 s)

### Rival Target

- Rival ceiling: `0.4 + 0.1 × level index` (index 0 to 3), plus 0.05 for the strength and power bouts (Level 1 sprint 0.40 ... Level 4 power 0.75); it follows the bout, not the focus score, so Distance Running's target is unchanged (53%)
- Rival target (final score) = factor × rival ceiling, with factor 0.85 (sprint), 0.8 (strength), 0.75 (endurance), 0.7 (power)
- The player wins by finishing strictly above the target

### Minigame Types

| Type | Level | Focus score | Mechanic | Duration | Full score |
|------|-------|-------------|----------|----------|------------|
| **Sprint** | 1 | TEST CHOICE | Tap A fast | 5s | 30 presses |
| **Strength** | 2 | DATA INSIGHT | Hold A | 4s | 2.5 s of holding |
| **Endurance** | 3 | TRAINING PLAN | Press A on the beat as notes approach | ~8 s | Hit all 9 beats (every 0.8 s, from 1 s); window 0.12 s early to 0.18 s late; stray presses count as misses, once per gap |
| **Power** | (none now) | EVALUATION | One press when the cursor crosses the mark | 3s | Within ±2% of the sweet spot; the mark first comes round ~0.5 s after GO |
| **Race** | 4 | TRAINING PLAN | RACE TO THE LINE: sit on the rival's pace, hold A to kick; empty the KICK gauge at the line | ~28 s | Whole gauge spent exactly at the line |

### RACE TO THE LINE (Distance Running)

`src/systems/RaceModel.ts` (pure, unit-tested in `tests/race-model.test.ts`), drawn by `src/systems/RaceView.ts`, run by `BossMinigame` as the `race` type; its text is in `src/rooms/content/finale-running.ts` (provisional, `docs/content-review.md` Q1-Q14).

- **Model** (critical speed): a compressed 5000 m, 12.5 laps, 44 race seconds per game second, 16 over her last 800 m so the finish plays slower (a race takes about 28 s). Her **KICK gauge is D'**, the distance she can run faster than critical speed (CS 3:22/km, 4.95 m/s): rating x 250 m (a 56% rating is the 140 m her trials found). It drains by (speed - CS) every second above CS and refills only below CS, after Skiba's W' balance (recovery time constant 546 e^(-0.01 DCP) + 316 s, DCP = the share below CS x 250 W), so faster the further below CS and slower as it nears full. A up, she sits on the rival's pace (their even laps are just faster than her CS, so the gauge drains slowly; she holds any gap). Holding A kicks at 5.7 + 0.3 x rating m/s (about 21 km/h, a 67-68 s lap). Empty, she fades to 90% of CS until the gauge has refilled to 25%.
- **Score**: the metres gained on an even run at CS, over 250 m, clamped to 0..rating. However the surges are spread, spending the whole gauge by the line gains exactly D', so perfect timing scores the rating; too early (she fades) or too late (some gauge is left) scores less. No A at all is an even CS race: 0, and idle.
- **Rival**: paced like elite 5000 m fields (Filipas et al. 2019, Front Sports Act Living, Figure 3: even laps, no early kick, the last lap at about 20 km/h): even 79.3 s laps to the bell, then a 72 s last lap, finishing in 16:23.5, the time a runner with Aisha's CS reaches by spending a TARGET-sized D' (131 m). So sitting on their pace to the line costs her exactly that, and is a dead heat (a loss: she must be ahead by 0.05 s). A rating at or below the TARGET runs dry and cannot win; above it, the spare D' is the kick. The ideal kick (the gauge dry at the line) starts about 380 m out at a 60% rating, 560 m at 70%, 710 m at 80%; any kick that does not run dry wins, so too early is the way to lose.
- **Screen**: the prompt (A glyph, "HOLD TO KICK!"); LAP n/12.5 (laps done: 0, 0.5 after the opening half lap, ... 12.5) and "NNNN M TO GO"; a track strip with both runners in their lanes (a 140 m window that follows them, so a gap of a metre shows; lane marks every 10 m scroll at her pace and the finish line is checkered); the KICK (D') gauge, its length from the rating, its fill what is left (and the metres); SURGING / ON THE RIVAL'S PACE (the practice: AT CRITICAL SPEED) / FADING: BELOW CRITICAL SPEED. At the bell "BELL" replaces VS between the athletes for 1.5 s and "BELL!" stays on the lap line. At the end both finishing times (m:ss.s). Sounds: lap lines `beat`, the bell `correct`, a new surge `mash`, an empty gauge `wrong`, a change of lead `blip`. Screen readers hear the practice prompt, the bell and an empty gauge. Under reduced motion the lane marks do not scroll, the runners do not stride and nothing blinks.
- **Practice straight**: before the first race of a session, after the two-page rules card: 6 s, no rival, no score, a toy gauge that empties after 1.6 s of holding. Its follow-up line says what the player did (held and let go, emptied it, never let go, or never pressed), then A: READY starts the countdown. Later races that session get the one-line card and no practice.
- **Defeat advice**: "YOU KICKED TOO EARLY: THE GAUGE RAN DRY WITH 300 M / A LAP / 1.5 LAPS TO GO." or "YOU KICKED TOO LATE: SHE CROSSED THE LINE WITH NN% OF HER KICK UNUSED." (after the rating and idle checks, as for every bout; `BoutResult.race` carries the times and the kick call).

### After the Bout

- **Win**: LEVEL CLEAR (or GAME COMPLETE after the last unbeaten level) with the four support scores; the level's room progress resets, so a replay starts fresh. In a Distance Running visit with the Performance Director the win is the end of the case study instead: the screen says CASE COMPLETE! ("PRESS A FOR THE DEBRIEF"), the rooms and scores are kept, and A goes back to the hub for the ending (below); the game no longer returns to the title
- **Win** screen line: "SCORE NN% VS TARGET NN%"
- **Loss**: DEFEATED with "RATING NN% VS TARGET NN%", "SCORE NN% VS TARGET NN%" and a diagnosis: if the rating could not beat the target, "YOUR RATING WAS TOO LOW. REPLAY THE <ROOM> ROOM TO RAISE YOUR <SCORE> SCORE."; if the bout saw no A at all, "NO A PRESSES DETECTED. PRESS A DURING THE BOUT."; otherwise "YOUR SCIENCE WAS GOOD ENOUGH." with a tip for the bout type (tap faster, keep A held, press as each note hits the zone, tap when the cursor is in the green). Choices: RETRY SHOWDOWN, BACK TO HUB (room progress kept), LEVEL SELECT

### The ending (Distance Running, Phase 4: results, evaluation and conclusion)

Back in the hub after the race (`systems/Finale.ts` builds the talk from `rooms/content/finale-running.ts`; `OverworldScene.queueTalk` plays it on the next hub entry, before anything else; B leaves it, and it is not offered again):

- **After a win** (A on CASE COMPLETE! or LEVEL CLEAR): Aisha (her name tab) on the race, with both finishing times; then Dr Ellis's debrief, after Table 4: the aims and the result (one race is one result), what the support found (overview and needs, the critical speed trials, the plan, the last 400 m), the SUPPORT BOARD's strongest and weakest score by name and percent, whether the change was real (EVALUATION 70% or more: judged well; under: claim with care), an honest reflection and next steps (D' was never retested; retest CS and D', track her last 400 m over several races, report to the coach, work on the weakest score), and thanks by name. The player stays in the hub: the board keeps the scores, every room stays open for replays, and the ARENA for a rematch. Talking to Dr Ellis afterwards gives one line: the case study is done.
- **After a defeat** (BACK TO HUB on DEFEATED): shorter. Aisha says why (too early, too late, not enough in the tank, or no call to kick), Dr Ellis says whether it was the rating (replay the TRAINING room) or the kick's timing, names the board's strongest and weakest score, and sends the player back to the rooms and the ARENA. RETRY SHOWDOWN and LEVEL SELECT skip it.
- A classic visit (no Performance Director) has no ending talk; winning the last playable sport still goes back to the hub, not the title.

### Rivals per Level

| Level | Rival | Taunt | Loss Line |
|-------|-------|-------|-----------|
| 1 | Dr. Voss | "Your test selection was amateur hour. My athlete was optimised from day one." | "Impossible... your protocols actually worked." |
| 2 | Prof. Krane | "Your data analysis was full of textbook errors. My athlete will crush yours on the climb." | "Your power data was... surprisingly precise." |
| 3 | Coach Steele | "Your boxer will gas out by round 3. Mine was built for 12." | "Your conditioning program... it actually held up." |
| 4 | Dr. Okafor | "Your predictions were wishful thinking. My runner has the kick to prove it." | "Her finish held up... I need to study your training plan." |

---

## Support Score Summary

| Room | Score (save key) | Focus of |
|------|------------------|----------|
| 1: Test Selection (TESTING) | TEST CHOICE (`speed`) | Level 1 Sprint (mash) |
| 2: Variable Identification (DATA) | DATA INSIGHT (`strength`) | Level 2 Strength (hold) |
| 3: Training Prescription (TRAINING) | TRAINING PLAN (`endurance`) | Level 3 Endurance (rhythm), Level 4 Race to the line (kick timing) |
| 4: Performance Prediction (ANALYSIS) | EVALUATION (`power`) | none (30% share only) |

Formula: `score = dataQuality × 0.4 + variableAccuracy × 0.6`; `rating = 0.7 × focus + 0.3 × mean of all four`.

Better work in the rooms → higher support scores → higher showdown rating → easier boss minigame.
