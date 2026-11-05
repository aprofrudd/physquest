# Content open for team review

Alan approved the redesigned Distance Running rooms' content for release on 23 October 2026 without reviewing it item by item, so the team can review it afterwards. Everything listed here is live in the game and may change.

**Review page** (one card per item, with the exact on-screen wording, the reasoning and sources; reviewers mark Approve, Change or Not sure, and answers save on the page): https://claude.ai/artifact/3RQzdEabat2tX9gtmyNzVR. It is private to Alan until he shares it (Contributor access lets a reviewer record answers).

All of the new content lives in `src/rooms/content/running.ts` (types in `src/rooms/content/types.ts`). Test, variable and zone names, descriptions, right answers and explanations still come from `src/data/sports.ts` and are not part of this review. When an answer comes back, apply its wording verbatim in `running.ts` and run `npm test` (the content tests check that the numbers still agree with `sports.ts`).

## What is provisional (review page ids)

**Superseded on 5 November 2026** by Aisha's new profile (section "Aisha's new profile, the test battery and the per-test files" below): D1-D12 (the treadmill-plus-sprint file, the flying 30 m sprint, speed reserve), W2 (the session cards and targets), A2-A5 (the last 400 m and VO2max numbers) and the old Data Lab and Analysis how-to lines (D10, D11, A9). The rows below are kept for the history of the review page.

| Ids | Room | Content | Where in `running.ts` |
|---|---|---|---|
| T1 | Testing Lab | "Aisha needs" line | `testing.needs` |
| T2-T5 | Testing Lab | Each test's chips, what it gives, how it is shown | `testing.cards` |
| T6-T10 | Testing Lab | Test-day readiness checks and the right call | `testing.checks` |
| T11 | Testing Lab | Cost of a wrong test-day call (x0.7, x0.95) | `testing.ranAnyway`, `testing.needlessRebook` |
| D1 | Data Lab | How the file was collected (and whether Room 1's test description should match it) | `data.protocol` |
| D2, D3 | Data Lab | Lactate at each stage; flying 30 m times | `data.stages`, `data.sprintTimes` |
| D4, D12 | Data Lab | What each variable is on the file; speed reserve label | `data.features`, `data.reserveLabel` |
| D5-D9 | Data Lab | Glitches (contaminated sample, failed sample, gate misfire) and real readings (steep rise, highest value) | `data.contaminated`, `failed`, `misfire`, `knee`, `peak` |
| D8b | Data Lab | Plain description of the steep rise, used when a glitch the player kept means the file no longer rises most steeply into it ("At 18 km/h lactate reads 4.0 mmol/L. The stages either side read 6.2 and 6.3."). Added after the approval, during testing | `data.kneePlain` |
| D10, D11 | Data Lab | The lens rule and how-to lines | `data.lensRule`, `data.rules`, `data.rulesShort` |
| D13 | Data Lab | Data quality = how well the file was cleaned | instrument scoring |
| W1, W2 | Training Floor | Easy running as a support session; the four session cards and targets | `training.cards`, `training.supportNote` |
| W3, W4 | Training Floor | Tired-legs rule; what makes a good week | `training.legs`, `training.checks` |
| W5-W7 | Training Floor | Away day; how-to and debrief lines | `training.awayDay`, `training.rules`, quality lines |
| A2-A4 | Analysis Room | Typical error, smallest worthwhile change, baseline trials, earlier blocks | `analysis.trained`, `baselineTrials`, `history` |
| A5 | Analysis Room | Second result to judge (VO2max 65 to 67) | `analysis.decoy` |
| A6-A9 | Analysis Room | Noise band width, verdict wording, how-to, forecast scoring | `analysis.verdicts`, `noiseWhy`, `smallWhy`, `worthWhy`, `rules` |

The biggest open questions: D1 (the running test file includes VO2max, vVO2max and a sprint, which the Testing Lab's lactate profile does not produce), A2 (typical error and smallest worthwhile change for the last 400 m are placeholders), W3 (whether sub-threshold sessions should cost less than intervals and sprints) and T1 (neither correct test measures speed reserve directly).

## Presentation notes for the team

- The Training Floor's debrief lines name the board codes (`SUB: full quality (legs 100%).`), as the content templates use `{label}`; a screen reader then says "supper" or spells SPRT. The planner and the run already speak the full zone names. If the team prefers, the templates could use the zone name instead.

## Design questions for Alan (current choice in brackets)

- Q1: build Room 1's "run the test yourself" timekeeper step? (not built)
- Q2: rename the ANALYSIS sign or the PERFORMANCE PREDICTION header? (unchanged)
- Q3: switch the new room looks on for the other three sports before their tasks are ready? (no)

## New: Performance Director and the ATHLETE room (provisional)

Added on 5 November 2026 and not yet reviewed by Alan. The player is now a sport scientist addressed by the name typed at name entry (`{NAME}`), not "Coach". All of this content is in `src/rooms/content/meet-running.ts` (types in `src/rooms/content/meet-types.ts`); comments in the file carry the same ids. The questions follow Phase 1 (Athlete overview) of Ruddock, Boyd, Winter and Ranchordas (2018), IJSPP, Table 1 (`docs/reference/scientific-support-process.txt`). Aisha's physiology is unchanged from `sports.ts` and `running.ts`; only biographical detail is new (goals, job, coach "Pete", club physio, funding, track access, 80-90 km weeks, a stress fracture at 22, sleep and refuelling). The meet room's OVERVIEW score does not feed the showdown rating or the four stats.

| Ids | Where | Content | Field | Table 1 row |
|---|---|---|---|---|
| P0 | Hub | The Director's name and role: DR ELLIS, PERFORMANCE DIRECTOR (gender-neutral; they/them) | `director` | - |
| P1-P5 | Hub | First welcome, by name: who they are, the player's job, the rooms in order (ATHLETE, TESTING, DATA, TRAINING, ANALYSIS, then ARENA), doors and {A} to talk, arrow, {SELECT}/{START}/{B}, room work raises your support scores on the board (reworded 5 November 2026; was "raises her stats for the showdown"), autosave, the request to meet Aisha. P4 is now two pages (P4a: doors, {A}, arrow, {SELECT}; P4b: {START}, {B}, stats, autosave), carrying the old coach tutorial's how-to-play lines. Counted as given only once its last page is read | `directorWelcome` | - |
| P6 | Hub | Reminder before Aisha is met | `directorReminder` | - |
| P7, P8 | Hub | Talked to again once the next room is open: "Good work so far, {NAME}. Next stop: {ROOM}. The arrow points the way." and "{SELECT} shows your objectives any time." ({ROOM} is the next room's hub sign; reworded on 5 November 2026, see below) | `directorAfter` | - |
| M1-M3 | ATHLETE room | Aisha introduces herself (26, "I race the women's 5000 m", good aerobic base, outkicked on the last lap) | `athleteIntro` | - |
| M4, M5 | ATHLETE room | How the chat works; one-line reminder on later visits | `rules`, `rulesShort` | - |
| M6 | ATHLETE room | Good: "What are your goals?" (note GOAL: NATIONALS FINAL) | `questions` `goals` | Goals: short, medium, long term; SMART; how far away |
| M7 | ATHLETE room | Good: "Why do you want our support?" (EXPECTS: EVIDENCE + PLAN) | `why` | Why seek scientific support; expectations |
| M8 | ATHLETE room | Good: "Who has supported you so far?" (COACH PETE, CLUB PHYSIO) | `support` | Previous support; coaching team; multidisciplinary team |
| M9 | ATHLETE room | Good: "What do you think you need?" (SAYS: NO FINISHING KICK) | `improve` | What do they think they need to improve |
| M10 | ATHLETE room | Good: "What else fills your week?" (WORKS 30 H; SELF-FUNDED) | `life` | Lifestyle demands; financial or logistical constraints |
| M11 | ATHLETE room | Good: "Training history? Injuries?" (OLD FOOT STRESS FRACTURE) | `history` | Training history; injuries |
| M12 | ATHLETE room | Good: "How is your training set out?" (NO SPRINTS; NO RPE LOG) | `week` | Typical training year, week and day; training load assessment |
| M13 | ATHLETE room | Good: "How are your sleep and food?" (SLEEP 7 H; LATE REFUEL) | `basics` | Basic/foundational good practices |
| M14 | ATHLETE room | Weaker: "Can we do a VO2max test now?" (a test before the needs are known) | `test-now` | Premature: Phase 2 (choice of tests) |
| M15 | ATHLETE room | Weaker: "Shall I write your new plan?" (a plan before the needs analysis, without the coach) | `plan-now` | Premature: Phase 3 (intervention planning) |
| M16 | ATHLETE room | Weaker: "You just need more miles, eh?" (a leading question) | `more-miles` | Not in Table 1: leading question |
| M17 | ATHLETE room | Weaker: "Which shoes do you race in?" ("Kit comes up in the needs analysis, not yet.") | `shoes` | Premature: Phase 2 (Table 2 asks how clothing or equipment influences performance) |
| M18 | ATHLETE room | Debrief by how many good questions were asked (0 to 5 of 5 asks). With 4 weaker questions and 5 asks at least 1 is always good, so the 0 entry is a safety line that cannot show today | `debrief` | - |
| M19, M20 | ATHLETE room | Aisha's farewell, setting up TESTING. M19 is now neutral ("Thanks for the chat, {NAME}. Good to meet you.") because it follows every debrief, including a poor one | `farewell` | - |
| M21 | ATHLETE room | After each answer, two pages: the note said aloud in sentence case (good, e.g. "Noted: her goal is the nationals final."; the notebook keeps the capitals) or the short reason (weaker), then the why | `said`, `note`, `why` | - |

Other new or reworded player-facing lines from this change (outside `meet-running.ts`):

| Ids | Where | Content | File |
|---|---|---|---|
| P9 | Intro, after name entry | "Welcome, {NAME}. You're the new sport scientist at the Sports Performance Centre. Pick a sport to start." | `src/scenes/IntroScene.ts` (`WELCOME_LINE`) |
| R1 | ATHLETE room | Notebook: "Your notebook. What you learn about Aisha goes in here." | `src/data/rooms/meet.ts` |
| R2 | ATHLETE room | Chair: "A comfy chair. Talk to Aisha to start the chat." | `src/data/rooms/meet.ts` |
| R3 | ATHLETE room | Window: "The track outside, under a big sky." | `src/data/rooms/meet.ts` |
| R4 | ATHLETE room | Whiteboard: "PHASE 1, ATHLETE OVERVIEW. Goals, support, needs, life, history, training, the basics." This lists the good-question topics on screen: a deliberate hint, or should it go? | `src/data/rooms/meet.ts` |
| R5 | ATHLETE room | Clock: "There is time for a proper chat." | `src/data/rooms/meet.ts` |
| R6 | ATHLETE room | Kit shelf: "A kit shelf: racing spikes, a foam roller, a medal, a bottle and a stopwatch." | `src/data/rooms/meet.ts` |
| R7 | ATHLETE room | Bib: "A framed race bib." | `src/data/rooms/meet.ts` |
| R8 | ATHLETE room | Screen-reader description of the room (`describe`) | `src/data/rooms/meet.ts` |
| D1 | Hub (classic) | `hub_athlete` line 1: "Hey {NAME}! Welcome to the Sports Performance Centre." | `src/data/dialogue.ts` |
| D2, D3 | Rooms (classic) | `room1_athlete` and `room3_athlete`: "Coach" dropped, otherwise unchanged | `src/data/dialogue.ts` |
| B1 | Showdown, defeat | "Better data next time, {NAME}. The margins matter." | `src/scenes/BossBattleScene.ts` |
| H1 | Room complete, last room | "Every room is done: the ARENA is open!" on a level with an ATHLETE room ("All four rooms are done: the ARENA is open!" kept on classic visits) | `src/scenes/RoomChallengeScene.ts` |
| L1 | Level select, objectives panel | Labels SPORT SCIENTIST <name>, ATHLETE (OVERVIEW) | `src/scenes/LevelSelectScene.ts`, `src/render/OverworldHud.ts` |
| S1 | Hub, ATHLETE door replay | "YOU HAVE MET THE ATHLETE (BEST OVERVIEW n/5). CHAT AGAIN TO RAISE IT?" ("CHAT AGAIN?" at 5/5) | `src/scenes/OverworldScene.ts` |

Questions for Alan from the review of this change:
- M6 (goals): Table 1 asks whether the goals are SMART. Should the why mention it (e.g. "...and whether they are specific and measurable...")? Her short-term goal ("stop losing races on the last lap") could be made measurable with the existing last-400 m figure (62 s to 60 s), no new numbers.
- M8 (support) vs the Testing Lab: `running.ts` checks speak of "her last test" and "same shoes ... as my last test" as a routine, while M8 says her only lab test was one at university. Should M8 allow for earlier tests (e.g. "a couple of lab tests"), or the checks change?
- M10 (life): now "once or twice a week" at the track, to match M12's one track session (Tuesday). Or should M12 add a second track session?
- M15 (plan-now) and M17 (shoes) were reworded so the note and the why no longer repeat each other, and M17 now follows Table 2 (equipment belongs in the needs analysis). Please confirm.
- M5 (rules page 2) now says "Some questions can wait, and some don't help at all." so it also covers the leading question (M16).

Open questions: whether 5 asks from 12 (8 good) is the right balance; whether training load monitoring (M12) and lifestyle with money and logistics (M10) should be separate questions, as in Table 1; whether Aisha's biographical details (teaching assistant, self-funded, track once or twice a week) suit the case.

## New: the needs chat and the Director's check-ins (provisional)

Added on 5 November 2026 and not yet reviewed by Alan. All of it is in `src/rooms/content/meet-running.ts` (`needs`, `checkIns`; types in `src/rooms/content/meet-types.ts`); comments there carry the ids. The needs chat follows Phase 2 (Needs analysis) of Ruddock et al. (2018), Table 2; the check-ins after the later rooms draw on Tables 2 to 4. Rule throughout: nothing claims a result before the room that produces it, the needs chat names no test (choosing it is the Testing Lab's job), and, as Aisha's physiology is being rebuilt (new 5 km PB, VO2max about 58, new LT1/LT2), no line quotes a pace, VO2max, heart rate, sprint speed or the 62 s last 400 m, mentions the flying 30 m sprint as a result, or refers to the four stats.

Also changed in this round:

| Ids | Where | Change | File |
|---|---|---|---|
| X1 | Every room, docs and tests | The test "Lactate Threshold Test" is now called "Lactate Profile" (name only; description, right answer and data quality unchanged) | `src/data/sports.ts`, `src/rooms/content/running.ts` (card), `docs/rooms.md`, `tests/` |
| X2 | Classic Testing Lab brief, laptop, Analysis whiteboard ("Goal: ...") | Level 4 goal was "Develop speed reserve and critical speed for race-ending surges." (it presupposed results). Now "Find out why she loses the last lap, and what to train to fix it." | `src/data/sports.ts` `goal` |
| X3 | Testing Lab band (T1) | "AISHA NEEDS: THRESHOLD AND SPEED RESERVE" is now "AISHA NEEDS: ZONES AND FINISHING SPEED" (the same as N7) | `running.ts` `testing.needs` |
| X4 | Classic Testing Lab insight | Was "Lactate threshold and critical speed provide ..." (read as if both tests were run). Now "Either a lactate profile or a critical speed test gives the pacing and training-intensity data Aisha needs." | `src/data/sports.ts` `testInsight` |

| Ids | Where | Content | Field | Paper row |
|---|---|---|---|---|
| N1 | Hub, needs chat | Dr Ellis opens by name: before any testing, work out what she needs; event, then Aisha, then what testing must tell us | `needs.intro` | Table 2, Phase 2 as a whole |
| N2 | Needs chat Q1 | "What does a 5000 m race demand most?" Good: "Mostly aerobic, fast finish" (most energy aerobic at a high share of VO2max; races often won on the last lap; external demands like pace, internal like heart rate, VO2 and lactate). Weaker: "Mostly sprint power", "Strength and muscle size", "A steady pace, no surges" | `needs.questions` `demands` | Table 2: physiological demands; external, internal demands |
| N3 | Needs chat Q2 | "Where is she strong, and where do races slip away?" Good: "Good base; loses the last lap". Weaker: "Weak base; fades mid-race", "She starts too fast", "No weak spot yet" | `strengths` | Table 2: strengths and areas for improvement (from Table 1, M9, M11, M12) |
| N4 | Needs chat Q3 | "What might she need? A working idea, to be tested." Good: "Her finish, on a sound base" (no sprint work at all, so finishing speed may be the gap; her aerobic paces need measuring too). Weaker: "Just more miles" (already 85 km, old stress fracture), "New racing shoes" (already carbon plates), "Lose some weight" (no evidence, health risk) | `hypothesis` | Table 2: what mechanisms are well developed and what need improving |
| N5 | Needs chat Q4 | "Before you choose a test, what must testing tell us?" Good: "Zones and finishing speed" (threshold paces set her zones; how fast she can finish; choose a valid, reliable test for a runner). Weaker: "Her VO2max, nothing else", "How strong her legs are", "Her body fat" | `measure` | Table 2: what tests have you chosen; is the test valid, reproducible and sensitive |
| N6 | Needs chat end | The working idea (good base, the finish lets her down, nothing in her week trains it), "an idea, not a result", TESTING is open, check she is ready on the day | `needs.agreed` | Table 2: rationale for the choice of test |
| N7 | Testing Lab band | "ZONES AND FINISHING SPEED" | `needs.testingNeeds` (= `running.ts testing.needs`) | - |
| N8 | Testing Lab brief | "Testing must find her training zones, and how much speed she has for the finish." (replaces "Goal: ..." after the athlete profile) | `needs.testingBrief` | - |
| N9 | Hub | Reminder before TESTING | `needs.reminder` | - |
| K1 | Check-in after TESTING | Lactate Profile: stages of rising pace with a lactate sample after each; gives LT1 and LT2 paces and her heart rate at each, which mark out her training zones | `checkIns.testing['Lactate Profile']` | Table 2: rationale for the test |
| K2 | Check-in after TESTING | Critical Speed Test: all-out runs over a few distances; critical speed (near the heavy/severe boundary) and D prime (how far she can run beyond it) set the top of her heavy zone and her interval targets | `checkIns.testing['Critical Speed Test']` | Table 2: rationale for the test |
| K3 | Check-in after TESTING | Wingate Test: 30 s all-out on a bike, peak and mean anaerobic power; wrong mode for a runner, no running paces, so no zones | `checkIns.testing['Wingate Test']` | Table 2: is the test valid (specific) |
| K4 | Check-in after TESTING | Beep Test: shuttles to failure estimate VO2max; rough with the turns, one number, no paces, so no zones | `checkIns.testing['Beep Test']` | Table 2: is the test valid, reproducible and sensitive |
| K5-K7 | Check-in after TESTING | The test-day call: right; ran when she should have been re-booked (treat the file with care, re-book once rested and well); re-booked needlessly (two days for nothing) | `checkIns.testingCall` | Table 2: reproducible (standardised test conditions) |
| K8 | Check-in after TESTING | Next: the DATA lab, clean the file, pin the variables that should guide her training | `checkIns.testingNext` | Table 2: how will you analyse the results |
| K9 | Check-in after DATA | By band: her threshold paces and vVO2max pace mark out her zones and give key sessions their targets (mixed and weak say which variables matter) | `checkIns.data` | Table 2: strengths and areas for improvement from the tests |
| K10 | Check-in after DATA | Next: the TRAINING room, plan her week around those paces, key sessions on fresh legs | `checkIns.dataNext` | Table 3: how do you intend to target, when and why |
| K11 | Check-in after TRAINING | By band: the week's balance (key sessions on fresh legs, easy runs for volume, rest; about two days between hard days, 5 or more sessions, 1 to 3 rest days) | `checkIns.training` | Table 3: how much recovery is needed |
| K12 | Check-in after TRAINING | Next: the ANALYSIS room, forecast the retest after the 10-week block, judge real or noise | `checkIns.trainingNext` | Table 3: smallest worthwhile change a priori |
| K13 | Check-in after ANALYSIS | By band: her faster last 400 m beats the typical error and the smallest worthwhile change (worth acting on); her VO2max rise beats the typical error but not the smallest worthwhile change (real, too small to matter). No numbers | `checkIns.analysis` | Table 4: were the changes practically meaningful |
| K14 | Check-in after ANALYSIS | The support process done (overview, needs, testing, training, evaluation); the ARENA is open | `checkIns.analysisNext` | Table 4: take-home messages |
| K15 | Hub doors | "TALK TO DR ELLIS FIRST." when the next room is tried before the check-in | `checkIns.doorRefusal` | - |

Questions for Alan:
- K1-K4 vs the Data Lab (D1): the Data Lab file is the same whatever the test (lactate stages, VO2max, vVO2max and a flying 30 m sprint). K2 says the critical speed test gives CS and D prime, which the file does not show; K3 and K4 say the wrong tests give no zones, yet the same full file follows. Should the Data Lab file differ by test (a CS file of trial times and a CS/D prime fit; a short or shaky file after a wrong test), or should the check-ins say only what the test is for? And should a wrong test still send a file at all?
- N5 and N7 ask testing for "finishing speed", but neither correct test measures it (T1), and the sprint is not tested anywhere. Keep finishing speed in the question (testing then answers it only in part), drop it to "TRAINING ZONES", or add a sprint test to the Testing Lab?
- K2: CS is described as near the heavy/severe boundary and D prime as how far she can run beyond it. Is "the top of her heavy zone" the wording you want?
- K9: the Data Lab pins LT2 pace, vVO2max and max sprint speed, and labels a speed reserve. With the sprint not tested, K9 no longer mentions speed reserve or the sprint. Should the Data Lab drop them too when the numbers are rebuilt?
- K9: `sports.ts` says LT2 pace is "the ceiling for sustained race pace", but a 5000 m is usually run above LT2 (near CS). K9 avoids the claim; should the variable's explanation change?
- K13 keeps the current Analysis results (last 400 m worth acting on, VO2max real but too small). When the numbers are rebuilt, will that still hold?
- N4 (good answer "Her finish, on a sound base"): is that hypothesis right for her, or should it name both her finish and her paces?

## Support scores and the SUPPORT BOARD (provisional)

The four stats are now shown as **support scores**, named for the work each room grades (not for qualities of the athlete): TEST CHOICE (TESTING), DATA INSIGHT (DATA), TRAINING PLAN (TRAINING), EVALUATION (ANALYSIS). Distance Running's showdown focus (70% of the rating) is TRAINING PLAN: the showdown is the RACE TO THE LINE, where her KICK gauge is her D prime, and the plan decides how much D prime and finishing speed she brings to the race (see "RACE TO THE LINE and the ending" below). The rival's TARGET is unchanged (53%). Dr Ellis's lines about them are new and provisional; they live in `src/rooms/content/board-running.ts` (not in `meet-running.ts`).

| # | Where | Line | Content key |
|---|-------|------|-------------|
| B1 | Welcome, before its last page | "See the SUPPORT BOARD on the wall, top left? Each room gives you a score: TEST CHOICE, DATA INSIGHT, TRAINING PLAN and EVALUATION." | `welcome[0]` |
| B2 | Welcome, before its last page | "They grade your work, not Aisha's, and make your showdown rating: TRAINING PLAN counts most. Face the board and press {A} to read it." | `welcome[1]` |
| B3 | Check-in after TESTING, before K8 | "Your TEST CHOICE score is {PCT}%. It is up on the SUPPORT BOARD." | `checkIn.testSelection` |
| B4 | Check-in after DATA, before K10 | "Your DATA INSIGHT score is {PCT}%. It is up on the SUPPORT BOARD." | `checkIn.variableId` |
| B5 | Check-in after TRAINING, before K12 | "Your TRAINING PLAN score is {PCT}%. It counts most in the showdown, so check the SUPPORT BOARD." | `checkIn.trainingPrescription` |
| B6 | Check-in after ANALYSIS, before K14 | "Your EVALUATION score is {PCT}%. The SUPPORT BOARD now has your full showdown rating." | `checkIn.performancePrediction` |
| B7 | Board panel, under its title | "SCORES GRADE YOUR WORK, NOT AISHA" (read aloud: "Scores grade your work, not Aisha.") | `note`, `noteSpoken` |

Questions for Alan:
- Is TRAINING PLAN the right focus for the RACE TO THE LINE, or should the kick weigh the EVALUATION score (as before, under the name POWER) or the DATA INSIGHT score (her D prime is found in the Data Lab)?
- Are the four names right for the team (e.g. EVALUATION or REVIEW for the ANALYSIS room)?
- P4b (`meet-running.ts directorWelcome[4]`) now says "Good work in each room raises your support scores on the board." (changed 5 November 2026; was "raises her stats for the showdown").

## Aisha's new profile, the test battery and the per-test files (provisional)

Added on 5 November 2026. Alan approved the anchor numbers (5 km PB 16:20; VO2max 58 ml/kg/min; vVO2max 19.0 km/h, 3:09/km; economy about 182 ml/kg/km; LT1 14.5 km/h, 4:08/km, HR 158; LT2 = 4 mmol/L at 16.8 km/h, 3:34/km, HR 176; HRmax about 192; critical speed trials 1200 m 3:34, 2400 m 7:37, 3600 m 11:40, so CS 17.8 km/h, 4.94 m/s, 3:22/km, D prime about 140 m; no sprint test). Everything else below is derived or new wording and is not yet reviewed. Content: `src/data/sports.ts` (level 4), `src/rooms/content/running.ts`, `src/rooms/content/meet-running.ts`; comments there carry the ids.

**Conventions used**: a pace is worked out from the speed as reported to 0.1 km/h (16.82 km/h is reported 16.8 km/h, so 3:34/km); critical speed and D prime are the least-squares line of distance against time through the trials (4.938 m/s, 143 m; D prime shown to the nearest 10 m, 140 m); LT1 is where lactate first rises 0.5 mmol/L above her lowest reading; HR at a threshold is interpolated between the stages either side. Check: (5000 - 143) / 4.938 = 984 s = 16:24, close to her PB.

### Numbers and physiology

| Id | Where | Content | Field |
|---|---|---|---|
| R1 | Profile line (classic room, briefs) | "Aisha, 26, 5000m runner (PB 16:20). Good aerobic base but lacks finishing kick." | `sports.ts athleteProfile` |
| R2 | Lactate profile stages | 12 km/h 1.0 mmol/L (HR 143), 13: 1.1 (149), 14: 1.3 (155), 15: 1.7 (161), 16: 2.6 (169), 17: 4.3 (178), 18: 7.0 (185). Tuned from the spec (15 km/h 1.8 to 1.7 so LT1 lands at 14.5; 17 km/h 4.4 to 4.3 so LT2 reads 16.8 km/h, 3:34/km); HR per stage is derived (158 at LT1, 176 at LT2) | `running.ts data.lactate.stages` |
| R3 | Lactate profile protocol | "Treadmill at 1% gradient: 4-minute stages from 12 km/h, up 1 km/h each, with a fingertip blood lactate and her heart rate at the end of each. Then a ramp to exhaustion, with expired gas, for her VO2max." | `data.lactate.protocol` |
| R4 | LT1 definition | 0.5 mmol/L above her lowest reading (1.0 + 0.5 = 1.5 mmol/L, at 14.5 km/h) | `data.lactate.lt1Rise` |
| R5 | Final ramp | VO2max 58 ml/kg/min, vVO2max 19.0 km/h, HRmax 192 bpm | `data.lactate.vo2max`, `vvo2maxKmh`, `hrMax` |
| R6 | Lactate glitches | Contaminated sample (+3.5 mmol/L) or failed sample (0.0), at 13 or 16 km/h (only where removing the reading leaves LT1, LT2 and HR at LT2 as they are); one or both per attempt. Real flags: the steep rise at 17 km/h (4.3), the highest at 18 km/h (7.0). Wording of `seen`/`why` re-tuned to the new numbers | `data.lactate.contaminated`, `failed`, `knee`, `kneePlain`, `peak` |
| R7 | Critical speed trials file | 1200 m 3:34 (2:58/km), 2400 m 7:37 (3:10/km), 3600 m 11:40 (3:14/km); "Each trial was run all-out on the track, on separate days with full recovery. Critical speed and D prime come from the straight line through distance against time." | `data.trials.trials`, `protocol` |
| R8 | Trials glitch (replaces the gate misfire) | One trial mistimed per attempt: the 2400 m reads 40 s long (8:17, a late stop) or the 3600 m 40 s short (11:00, a missed lap). Why: "A glitch: the timing went wrong (a missed lap or a late stop). In all-out trials a longer one is always slower per km, and this breaks that." Real flag: the 1200 m, fastest per km ("Real: the shorter the all-out trial, the faster she can run it, because she can spend all of her D prime in it."). Both are described with the same neutral words | `data.trials.mistimings`, `mistimed`, `fastest` |
| R9 | Variables (8, by file) | Profile: LT1 Pace (4:08/km) not key; LT2 Pace (3:34/km) key; HR at LT2 (176 bpm) not key; VO2max (58 ml/kg/min) not key; vVO2max Pace (3:09/km) key. Trials: Critical Speed (3:22/km) key; D Prime (140 m) key; Best Trial Pace (2:58/km) not key (a decoy so a trials-only battery is not a free choice). Explanations rewritten (no sprint, no speed reserve) | `sports.ts variables`, `running.ts data.features` |
| R10 | Insights | Full battery: "LT2, critical speed and vVO2max set her training paces; her small D prime explains why she has little left for the last lap." One file only: the file's own insight (profile: "LT2 and vVO2max set her threshold and severe sessions. Without the trials we cannot yet see what she has for the finish."; trials: "Critical speed sets her threshold and severe sessions, and her small D prime explains why she has little left for the last lap.") | `sports.ts variableInsight`, `data.lactate.insight`, `data.trials.insight` |
| R11 | Training zones (4 cards) | Threshold Running (LT2 to CS pace) 3:34-3:22/km, key; Severe Intervals (CS to vVO2max pace) 3:22-3:09/km, key; Fast Reps (faster than vVO2max) faster than 3:09/km, key ("to build D prime and her finish"); Easy Running (slower than LT1) slower than 4:08/km, support. Steady running (LT1-LT2) is not a card. Labels THR, SEV, FAST, EASY. A target from a test not run shows in words (LT2 TO CS PACE, CS TO VVO2MAX PACE, FASTER THAN VVO2MAX, SLOWER THAN LT1 PACE) | `sports.ts zones`, `zoneInsight`; `running.ts training.cards` (`uses`, `plain`) |
| R12 | Analysis numbers | Last 400 m of a 5000 m: 72 s before, 70 s after 10 weeks; typical error 0.6 s, smallest worthwhile change 0.8 s; baseline trials 71.6 and 72.4 s; earlier blocks 1.6 and 2.4 s. Decoy VO2max 58 to 60 ml/kg/min (TE 1.5, SWC 3.0: real but too small) | `analysis.trained`, `baselineTrials`, `history`, `decoy` |
| R13 | Classic prediction | "Last 400m kick improves from 72s to 70s" (right); "VO2max increases from 58 to 68 ml/kg/min"; "Critical speed stays at 3:22/km"; "Body weight drops significantly"; insight "A 2-second faster last lap is realistic: a bigger D prime and a higher critical speed leave her more to kick with off the same race pace." | `sports.ts predictions`, `predictionInsight`, `predictionScenario` |
| R14 | Classic data line, test insight, rival | Data line now lists the profile and the trials; test insight "Run the lactate profile and the critical speed test together: ..."; rival line "Her finish held up... I need to study your training plan." | `sports.ts dataOutput`, `testInsight`, `rivalLoseLine` |
| M11 | ATHLETE room, history answer | New page: "My 5000 m PB is 16:20, from last summer. This season I've run 16:28 and 16:35, and lost both on the last lap." Note "PB 16:20; FOOT FRACTURE" (said: "Noted: a 16:20 PB, and an old stress fracture in her foot.") | `meet-running.ts questions` `history` |

### The Testing Lab battery

| Id | Where | Content | Field |
|---|---|---|---|
| T12 | Testing Lab | The player picks a battery of 2 tests; one test-day check for the whole battery | `testing.battery` |
| T13 | Testing Lab scoring | variableAccuracy 1 (Lactate Profile + Critical Speed Test), 0.65 (one of them), 0.3 (neither); data quality = the battery's mean x the readiness factor (full 0.97, partial about 0.68, neither 0.40) | `testing/model.ts` |
| T14 | Testing Lab wording (UI) | "Choose 2 tests for her battery." / "Test 1: X. Now choose test 2." / "That test is already in her battery." / tip "... then {A} to add it to her battery. {B} takes the last one out." / RUN THE TESTS / printout verdicts BOTH SENT TO THE DATA LAB, 1 OF 2 TO THE DATA LAB, NO FILE FOR THE DATA LAB | `testing/index.ts`, `testing/model.ts` |
| N5, N6, N9 | Needs chat | "Choose tests that are valid and reliable ..."; "Choose a battery of tests that answers our question ..."; reminder "Choose tests that give us ..."; N5's good reply now says "how much she has above the pace she can sustain shows what she has for a kick" | `meet-running.ts needs` |
| K1-K4 | Check-in after TESTING, per test in the battery | Rewritten and shortened (one or two lines each) | `checkIns.testing` |
| K16 | Battery: full | "Together they answer our question: her zones from her thresholds and critical speed, and her finish from D prime." | `checkIns.battery.full` |
| K17, K18 | Battery: one missing (DATA opens) | No trials: "But without the critical speed trials we have no D prime, so we can't yet say how much she has for the finish. Next time, add them." No profile: "But without the lactate profile we have no thresholds, so her easy and threshold zones have no anchors. Next time, add it." | `checkIns.battery.missing` |
| K19, K20, K22 | Battery: none (send-back) | "So neither test gives running zones or D prime, {NAME}. Only the lactate profile or the critical speed test can." "Those files are what the DATA lab works on, so it stays shut for now." Next: "Go back to the TESTING lab and re-test her with a better battery. You can run it as often as you need." DATA door: "RE-TEST IN TESTING FIRST."; objectives: "NEXT: RE-TEST IN TESTING" | `checkIns.battery.none`, `retestNext`, `retestRefusal` |
| K5-K8 | Check-in after TESTING | Plural ("the tests went ahead", "her files are in", "choose the key variables") | `checkIns.testingCall`, `testingNext` |
| K9, K21 | Check-in after DATA | Bands now say only how the clean-up and the choice went; then the real numbers of each file in the battery: "The clean profile puts LT1 at 4:08/km and LT2 at 3:34/km. Her VO2max is 58 ml/kg/min, and her vVO2max pace 3:09/km." / "The trials put her critical speed at 3:22/km, with a D prime of only about 140 m. That is why she has so little left for the last lap." | `checkIns.data`, `checkIns.dataFiles` |
| K11 | Check-in after TRAINING, strong | Adds "The fast reps are the sessions that build her D prime for the last lap." | `checkIns.training.strong` |
| K13 | Check-in after ANALYSIS | Now quotes the retest: last 400 m 72 to 70 s (TE 0.6 s, SWC 0.8 s), VO2max 58 to 60 ml/kg/min | `checkIns.analysis` |

### The Data Lab: per-test files, clearer controls, KEY VARIABLES (wording)

| Id | Where | Content | Field |
|---|---|---|---|
| U1 | Data Lab rules, first visit | "Aisha's test files are in. The software has flagged readings that look odd: decide if each one is real data or a glitch." / "For example, if three stages read 2.0, 5.5 and 2.2 mmol/L, the middle one jumps and falls straight back: a glitch. 2.0, 2.8, 4.1, 6.5 keeps climbing: real." / "Use {DPAD} to choose KEEP or REMOVE, then {A}." | `data.rules` |
| U2 | Data Lab, later visits | "For each flagged reading, use {DPAD} to choose KEEP or REMOVE, then {A}." | `data.rulesShort` |
| U3 | Each flagged reading | Question "Reading {i} of {n}: lactate at {kmh} km/h. Real data, or a glitch?" / "Reading {i} of {n}: the {m} m trial. Real data, or a glitch?", then what the software says; options KEEP IT (REAL) / REMOVE IT (GLITCH); KEPT / REMOVED on the chart or table (word and symbol), "?" on the reading in question | `data.lactate.ask`, `data.trials.ask`, `data.options` |
| U4 | File switch | Header plates "FILE 1/2: LACTATE PROFILE (TREADMILL)", "FILE 2/2: CRITICAL SPEED (TRACK TRIALS)"; lines "First file: / Next file: / Her file:" + "her lactate profile on the treadmill. Stages from 12 to 18 km/h, with a blood lactate sample after each." / "her critical speed trials on the track. Three all-out time trials: 1200, 2400 and 3600 m." Axis and column labels: LACTATE (MMOL/L), SPEED (KM/H); DISTANCE (M), TIME (MIN:S), PACE (MIN:S/KM); "CS AND D PRIME: AFTER THE CLEAN-UP" until the trials are clean | `data.*.title`, `intro`; `datalab/views.ts` |
| U5 | Rules per file (first visit) | Profile: "A jump or drop that the readings either side don't back up is a glitch. A change that keeps building over several readings is real." Trials: "In all-out trials, a longer trial is slower per km. A trial that breaks that pattern is a glitch." | `data.lactate.lensRule`, `data.trials.lensRule` |
| U6 | Before choosing | "Files clean. / File clean." + "Now choose her KEY VARIABLES: the {N} numbers you would use to set her training paces and explain her finish." ({N} from the files present: 4, or 2 with one file) | `data.chooseIntro` |
| U7 | First visit, what makes a variable key | "For example, for a cyclist, the power she can hold for an hour sets her sessions; her body mass only describes her." | `data.keyExample` |
| U8 | Key-variable screen | KEY VARIABLES n/N panel with slots (short name, value and unit), headings FROM THE LACTATE PROFILE: / FROM THE CS TRIALS:, hints "{A}: CHOOSE   {DPAD}: MOVE   {B}: QUIT", "{A}: LOCK IN   {B}: QUIT"; "All {N} key variables are chosen. Take one out first." / "All {N} key variables chosen. {A}: LOCK IN, or {UP} to change one." (the cursor moves to LOCK IN); LOCK IN asks "Lock in these {N} key variables? You can't change them after." (STAY / LOCK IN); reveal "Key!" / "Not key." / "Missed: ..." | `data.lockAsk`, `datalab/model.ts`, `datalab/index.ts` |
| U9 | Data Lab map | The video wall shows labels only and the results desk says "Results desk: the files from your tests load here." (no number from a test that may not have been run); the Testing Lab's lactate analyser no longer shows threshold paces before any test | `data/rooms/datalab*.ts`, `data/rooms/testing.ts` |

### The Analysis Room: YOUR GUESS and the labelled ruler (wording)

| Id | Where | Content | Field |
|---|---|---|---|
| A10 | Walk-through 1 (first visit) | "Before the block, Aisha's last 400 m took 72 s: that is BEFORE, the dark pole. Her two baseline trials sit either side of it." | `analysis.rules[0]` (tour `before`) |
| A11 | Walk-through 2 | "The hatched NOISE band is the typical error, 0.6 s either side of BEFORE. A change inside it could just be noise." | `rules[1]` (`noise`) |
| A12 | Walk-through 3 | "The gold dashed lines mark the WORTHWHILE CHANGE, 0.8 s either side: the smallest change that would matter in a race." | `rules[2]` (`worth`) |
| A13 | Walk-through 4 | "The blue marker is YOUR GUESS. Move it to where you think her retest will land. The grey ticks show her last two blocks." | `rules[3]` (`guess`) |
| A14 | Later visits | "Move YOUR GUESS to forecast her retest, then judge each result: noise, too small, or worth acting on." | `rulesShort` |
| A15 | Forecast prompt | "Where will her last 400 m be after the 10-week block? Move YOUR GUESS with {LEFT} and {RIGHT}, then {A} to lock it in." | `forecastAsk` |
| A16 | Verdict question | "Her {name} retest: {before} → {after} {unit}. Is that change noise, real but too small, or worth acting on?" (the three verdicts as a choice list) | `judgeAsk` |
| A17 | Board labels | "YOUR GUESS 70.4 S", "BEFORE 72 S", "NOISE: TYPICAL ERROR 0.6 S", "WORTHWHILE CHANGE: 0.8 S", "FASTER →" / "HIGHER →"; report head "YOUR GUESS 70.4 S (1.6 FASTER)"; screen readers "Your guess: 70.4 s, 1.6 faster." These replace the two old rules pages, "Move the pin with {LEFT} and {RIGHT}", and FORECAST / BETTER / WORSE / BASELINE / WORTH IT / YOU | row fields `name`, `betterWord`, `worseWord`; `analysis/` |

Questions for Alan:
- R2: the spec's 15 km/h (1.8) and 17 km/h (4.4) readings were tuned to 1.7 and 4.3 so LT1 is exactly 14.5 km/h and LT2 reads 16.8 km/h (3:34/km). Are the tuned values and the derived per-stage heart rates right? Should the stages be 3 minutes instead of 4?
- R4: is "0.5 mmol/L above her lowest reading" the LT1 definition you want (other options: baseline + 1.0 mmol/L, a fixed 2 mmol/L, or the first sustained rise by eye)?
- R6: a lactate glitch can now sit at 16 km/h (between LT1 and LT2), where a kept glitch moves LT2 off 3:34/km. Fine, or keep glitches below LT1 only?
- R7/R8: is a 40 s timing error plausible for a hand-timed track trial (a missed lap of a 400 m track would be about 75 s)? Should the trials glitch be a GPS distance error instead?
- R9: key variables are LT2, vVO2max, CS and D prime. Should LT1 be key too (it caps her easy running, and the Training Floor uses it), and is HR at LT2 rightly not key? Is "Best Trial Pace" a fair decoy?
- R11: should steady running (LT1 to LT2) be its own card, and are Threshold (LT2 to CS) and Fast Reps both key, with easy running as support?
- R12: are TE 0.6 s and SWC 0.8 s right for a 72 s last 400 m at this level? Would a D prime retest (e.g. 140 to 165 m) be a better trained metric now that D prime is the story?
- K21: the check-in quotes the clean files' numbers even when the player kept a glitch (their own file then shows a '?'). Quote the clean values (as now) or the player's own?
- T13: is 0.65 the right accuracy for a battery with one right test (TEST CHOICE about 68%, the mixed band)?

## RACE TO THE LINE and the ending (provisional)

Added on 5 November 2026, not yet reviewed by Alan; the race model was retuned the same day from Alan's answers (rival pacing from Filipas et al. 2019, Front Sports Act Living, Figure 3: even laps, no early kick, a last lap of about 20 km/h, 72 s; the gauge refills, depending on speed). The POWER SURGE (one tap at a mark) is replaced in Distance Running by the **RACE TO THE LINE**: a compressed 5000 m (12.5 laps, about 28 s of play, the last 800 m slower) against the rival's runner, built on the critical speed model. Her **KICK gauge is her D prime**, sized by the showdown rating (rating x 250 m, so a 56% rating is the 140 m her trials found). It drains by the speed above critical speed (3:22/km, 4.95 m/s) and refills only below it, faster the further below (Skiba's W' balance). With A up she sits on the rival's pace; holding A kicks at 5.7 + 0.3 x rating m/s (about 21 km/h, a 67-68 s lap); empty, she fades to 90% of CS until it has refilled to a quarter. The rival runs even 79.3 s laps and a 72 s last lap, finishing in 16:23.5: their even laps are just above her CS, so following them to the line costs her exactly a TARGET-sized D prime (131 m) and is a dead heat (a loss). Only a rating above the TARGET (unchanged, 53%) leaves spare D prime to kick with; the ideal kick starts about 380 m out at 60%, 560 m at 70%, 710 m at 80%, and kicking too early (the gauge runs dry) is the way to lose. Then the case study ends in the hub instead of the title screen: Aisha on the race, then Dr Ellis's debrief (Phase 4, Table 4: results, evaluation and conclusion), shorter after a defeat. All of it is in `src/rooms/content/finale-running.ts`; comments there carry the ids.

| # | Where | Line | Content key |
|---|-------|------|-------------|
| Q1 | Arena title | "RACE TO THE LINE" | `race.event` |
| Q2 | Beside the A button in the race | "HOLD TO KICK!" | `race.prompt` |
| Q3 | Rules card page 1 (first race of a session) | "Your rating, NN%, mostly your TRAINING PLAN score, sets the size of Aisha's KICK gauge: her D', how far she can run above critical speed." | `race.rules[0]` |
| Q4 | Rules card page 2 (A: PRACTICE) | "Let go: she sits on the rival's pace, draining the gauge slowly. Hold A: she kicks, draining it fast. Beat the TARGET of NN%." | `race.rules[1]` |
| Q5 | Rules card after that (one line) | "Beat NN% to win. Sit on the pace, hold A to kick, and run the gauge dry at the line." | `race.rulesShort` |
| Q6 | Practice straight (6 s, no rival, no score, toy gauge) | "HOLD TO SURGE, LET GO TO SETTLE" | `race.practice.banner` |
| Q7-Q10 | After the practice (A: READY), by what the player did | held and let go: "That's the kick... Empty, she fades, and it refills only slowly."; emptied it: "See the fade? Once the gauge is empty she drops below critical speed, and only there does it refill, slowly."; never let go: "She surged the whole way..."; no A: "Hold A to make her surge..."; each then "In the race, let go and she sits on the rival's pace, just above critical speed, so the gauge drains slowly. Save the rest for the finish." (practice: no rival, let go settles her at CS) | `race.practice.*` |
| Q11 | Under the gauge | "SURGING" / "ON THE RIVAL'S PACE" (practice: "AT CRITICAL SPEED") / "FADING: BELOW CRITICAL SPEED" | `race.status` |
| Q12 | Gauge label | "KICK (D')" with the metres of D prime left | `race.gauge` |
| Q13 | Defeat advice (science good enough) | "YOU KICKED TOO EARLY: THE GAUGE RAN DRY WITH 300 M / A LAP / 1.5 LAPS TO GO." | `race.advice.early` |
| Q14 | Defeat advice | "YOU KICKED TOO LATE: SHE CROSSED THE LINE WITH NN% OF HER KICK UNUSED." | `race.advice.late` |
| F1-F3 | Results screen after the winning race (was GAME COMPLETE!) | "CASE COMPLETE!", "AISHA'S CASE STUDY IS DONE. DR ELLIS IS WAITING IN THE HUB FOR YOUR DEBRIEF.", "PRESS A FOR THE DEBRIEF" | `clear` |
| F4 | Hub, Aisha (after a win) | "We did it, {NAME}! 16:10.4, and I beat her to the line. She ran 16:23.5." / "I sat on her shoulder, then kicked..." | `win.athlete` |
| F5 | Debrief: aims (Table 4: were the aims achieved?) | "Congratulations... let's debrief" / "Our aim was a finish she can trust... one race is one result" | `win.director.opening` |
| F6 | Debrief: main findings | Overview and needs (good base, weak finish), the trials (D prime about 140 m), the plan (fast reps on fresh legs), last 400 m 72 s to 70 s | `win.director.found` |
| F7-F8 | Debrief: what worked (the SUPPORT BOARD) | "...your strongest score was X at NN%, and your weakest Y at NN%." (or all level) | `win.director.board`, `boardEven` |
| F9-F10 | Debrief: was the change real (by EVALUATION, 70% or more is strong) | Last 400 m beat the typical error and the smallest worthwhile change; VO2max real but too small; the weak version: "claim with care... one race is not proof" | `win.director.real` |
| F11 | Debrief: honest reflection, next steps (Table 4: what do you still need to know?) | "We never measured her D prime again, so we are inferring it grew... retest her critical speed and D prime" / track her last 400 m over several races, report to her coach in plain numbers, work on the weakest score | `win.director.next` |
| F12 | Debrief: thanks | "Thank you, {NAME}... And thank you, Aisha, for trusting the process." / the rooms stay open, the ARENA for a rematch | `win.director.thanks` |
| F13-F16 | Hub, Aisha (after a defeat, when the player picks BACK TO HUB) | too early, too late, rating too low, no A | `lose.athlete` |
| F17-F21 | Hub, Dr Ellis (after a defeat) | rating too low (replay the TRAINING room) or "the timing of the kick"; the board's strongest and weakest; "The rooms are open..." | `lose.director` |
| F22 | Dr Ellis when talked to after the case is won | "The case study is done, {NAME}..." | `directorAfter` |

Questions for Alan:
- Answered (5 Nov): the rival's last lap is 72 s (20 km/h) with no earlier kick (Filipas et al. 2019, Figure 3), and the gauge refills depending on speed. Still to check: fading to 90% of CS and running with the pace again once a quarter has refilled; the recovery time constant (Skiba's, with DCP = share below CS x 250 W, about 12 min at 90% of CS); her kick at 5.7 + 0.3 x rating m/s (67-68 s laps).
- With following the pace free of decisions, any kick that does not run dry wins once the rating beats the TARGET; the skill is not going too soon. Is that the lesson you want, or should a late kick also be able to lose (e.g. the rival answering a kick)?
- F6 and F9 quote the current Analysis numbers (last 400 m 72 s to 70 s, VO2max real but too small). If R12 changes them (e.g. a D prime retest), these lines should follow.
- F11 admits D prime was never retested. If the Analysis room gains a D prime retest (R12), this reflection should change to what is still unknown after it.
- The ending replaces "the game ends": after the win the player stays in the hub with the scores kept on the SUPPORT BOARD and every room open (before, a won level reset its rooms). Is that the ending you want?
