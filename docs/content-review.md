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
| D10, D11 | Data Lab | The lens rule and how-to lines | `data.lensRule`, `data.rules`, `data.rulesShort` |
| D13 | Data Lab | Data quality = how well the file was cleaned | instrument scoring |
| W1, W2 | Training Floor | Easy running as a support session; the four session cards and targets | `training.cards`, `training.supportNote` |
| W3, W4 | Training Floor | Tired-legs rule; what makes a good week | `training.legs`, `training.checks` |
| W5-W7 | Training Floor | Away day; how-to and debrief lines | `training.awayDay`, `training.rules`, quality lines |
| A2-A4 | Analysis Room | Typical error, smallest worthwhile change, baseline trials, earlier blocks | `analysis.trained`, `baselineTrials`, `history` |
| A5 | Analysis Room | Second result to judge (VO2max 65 to 67) | `analysis.decoy` |
| A6-A9 | Analysis Room | Noise band width, verdict wording, how-to, forecast scoring | `analysis.verdicts`, `noiseWhy`, `smallWhy`, `worthWhy`, `rules` |

The biggest open questions: D1 (the running test file includes VO2max, vVO2max and a sprint, which the Testing Lab's lactate threshold test does not produce), A2 (typical error and smallest worthwhile change for the last 400 m are placeholders), W3 (whether sub-threshold sessions should cost less than intervals and sprints) and T1 (neither correct test measures speed reserve directly).

## Design questions for Alan (current choice in brackets)

- Q1: build Room 1's "run the test yourself" timekeeper step? (not built)
- Q2: rename the ANALYSIS sign or the PERFORMANCE PREDICTION header? (unchanged)
- Q3: switch the new room looks on for the other three sports before their tasks are ready? (no)
