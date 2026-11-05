# Content open for team review

Alan approved the redesigned Distance Running rooms' content for release on 23 October 2026 without reviewing it item by item, so the team can review it afterwards. Everything listed here is live in the game and may change.

**Review page** (one card per item, with the exact on-screen wording, the reasoning and sources; reviewers mark Approve, Change or Not sure, and answers save on the page): https://claude.ai/artifact/3RQzdEabat2tX9gtmyNzVR. It is private to Alan until he shares it (Contributor access lets a reviewer record answers).

All of the new content lives in `src/rooms/content/running.ts` (types in `src/rooms/content/types.ts`). Test, variable and zone names, descriptions, right answers and explanations still come from `src/data/sports.ts` and are not part of this review. When an answer comes back, apply its wording verbatim in `running.ts` and run `npm test` (the content tests check that the numbers still agree with `sports.ts`).

## What is provisional (review page ids)

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

The biggest open questions: D1 (the running test file includes VO2max, vVO2max and a sprint, which the Testing Lab's lactate threshold test does not produce), A2 (typical error and smallest worthwhile change for the last 400 m are placeholders), W3 (whether sub-threshold sessions should cost less than intervals and sprints) and T1 (neither correct test measures speed reserve directly).

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
| P1-P5 | Hub | First welcome, by name: who they are, the player's job, the rooms in order (ATHLETE, TESTING, DATA, TRAINING, ANALYSIS, then ARENA), doors and {A} to talk, arrow, {SELECT}/{START}/{B}, room work raises her stats for the showdown, autosave, the request to meet Aisha. P4 is now two pages (P4a: doors, {A}, arrow, {SELECT}; P4b: {START}, {B}, stats, autosave), carrying the old coach tutorial's how-to-play lines. Counted as given only once its last page is read | `directorWelcome` | - |
| P6 | Hub | Reminder before Aisha is met | `directorReminder` | - |
| P7, P8 | Hub | After Aisha is met: TESTING is open | `directorAfter` | - |
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
