# PhysQuest — Room Design Document

## Overview

Each level contains **4 challenge rooms** plus a **boss arena**. The player navigates a hub overworld (Sports Performance Centre) and enters rooms through doors. All 4 rooms must be completed before the boss door unlocks.

Each room awards a **player stat** (0–100%) based on performance. These stats determine the player's ceiling in the boss minigame.

---

## Hub — Sports Performance Centre

- **Map**: 16x14 tile grid, `lab` palette
- **Layout**: 4 room doors (top-left, top-right, bottom-left, bottom-right), boss door at bottom centre
- **Signs**: Each door has a labeled sign tile — TESTING, DATA, TRAINING, ANALYSIS; boss door has ARENA label
- **NPCs**: Athlete at centre — introduces themselves ("Hey Coach! I am your athlete…") then gives overview dialogue. NPC is solid (player cannot walk through)
- **Equipment**: Performance monitoring station (left), Recovery station (right)
- **Gating**: Boss door blocked until all 4 `roomProgress` flags are `true`

---

## Room 1 — Test Selection

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
5. **Stat calculation**: `dataQuality` from the chosen test (0.5–0.95), `variableAccuracy` = 1.0 if correct, 0.3 if wrong

### Scoring

```
stat = dataQuality × 0.4 + variableAccuracy × 0.6
```

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

## Room 2 — Variable Identification

| Attribute | Value |
|-----------|-------|
| **Map name** | Data Analysis |
| **Palette** | `gym` |
| **Stat awarded** | Strength |
| **Equipment** | 4 data screens (raw output, HR trace, power curve, recovery metrics) |
| **Challenge type** | Sequential multi-select — pick N correct variables from 5 options |

### Flow

1. **Intro**: Test data output displayed (e.g. "Yo-Yo IR2 Result: Level 20.3, Distance 1280m, HR max 192bpm...")
2. **Challenge**: Player selects variables one at a time. Number of selections = number of correct variables (typically 3)
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
| 1 | Total Distance (1280m), Recovery HR (145bpm), Blood Lactate (11.2) | HR Max (192bpm), Test Level (20.3) |
| 2 | MAP (340W), VO2max (62 ml/kg/min), Power/Weight (5.86 W/kg) | HR Max (188bpm), Body Weight (58kg) |
| 3 | Peak Power (890W), Mean Power (640W), Fatigue Index (42%) | Body Mass (75kg), Time to Peak (4.2s) |
| 4 | LT1 Pace (3:45/km), LT2 Pace (3:20/km), Max Pace (2:55/km) | VO2max (65 ml/kg/min), HR at LT2 (175bpm) |

---

## Room 3 — Training Prescription

| Attribute | Value |
|-----------|-------|
| **Map name** | Training Floor |
| **Palette** | `track` |
| **Stat awarded** | Endurance |
| **Equipment** | Training zone calculator, Periodisation planner, Interval timer, Load monitoring display |
| **Challenge type** | Sequential multi-select — pick N correct zones from 4 options |

### Flow

1. **Intro**: "Based on the test data, which training zones should we prescribe?"
2. **Challenge**: Player selects zones one at a time. Number of selections = number of correct zones (typically 3)
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
| 1 | HIT (>170bpm), Repeated Sprint Training (95-100%), Tempo Running (160-170bpm) | Zone 2 Aerobic Base (130-150bpm) |
| 2 | Sweet Spot (88-94% FTP), VO2max Intervals (106-120% FTP), Threshold Work (95-105% FTP) | Recovery Rides (<55% FTP) |
| 3 | Alactic Power (6-10s max), Glycolytic Intervals (30-60s hard), Repeat Power Bouts (10s on/20s off) | Long Slow Distance (30+ min easy) |
| 4 | Sub-threshold (LT1-LT2), Supra-threshold Intervals (>LT2), Sprint Training (near max pace) | Easy Running (<LT1) |

---

## Room 4 — Performance Prediction

| Attribute | Value |
|-----------|-------|
| **Map name** | Analysis Room |
| **Palette** | `lab` |
| **Equipment** | 4 prediction model screens (adaptation curves, performance trajectory, training load response, competition readiness) |
| **Stat awarded** | Power |
| **Challenge type** | Single choice from 4 prediction outcomes |

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
| 4 | After 10 weeks of speed reserve training | Last 400m kick improves from 62s to 57s | VO2max 65→75, LT2 stays at 3:20/km, Weight drops significantly |

---

## Boss Arena

After completing all 4 rooms, the boss door opens. Each level has a unique rival and minigame type.

### Boss Setup

1. **Rival taunt**: The rival delivers a taunting line
2. **Stat display**: 3-second countdown showing player stats vs rival stats side-by-side
3. **Minigame**: Stat-specific skill challenge
4. **Result**: Win → rival loss line + advance; Lose → retry message

### Rival Stats

Rivals have fixed stats that scale with level:
- Base stat: `0.4 + (level × 0.1)` — so Level 1 = 0.4, Level 4 = 0.7
- Alternating stats get +0.05 boost

### Minigame Types

| Type | Level | Boss Stat | Mechanic | Duration | How to Win |
|------|-------|-----------|----------|----------|------------|
| **Sprint** | 1 | Speed | Mash spacebar rapidly | 5s | Fill bar faster than rival (max 30 mashes) |
| **Strength** | 2 | Strength | Hold spacebar | 4s | Hold bar fills over 2.5s target; rival fills at 80% rate |
| **Endurance** | 3 | Endurance | Rhythm press on beats | 8s | Hit beats (0.8s intervals) accurately; rival at 75% rate |
| **Power** | 4 | Power | Single tap timing | 3s | Tap when cursor hits sweet spot on moving bar; rival scores 70% |

### Minigame Scoring

```
playerScore = mechanicPerformance × playerCeiling
rivalScore  = rivalRate × rivalCeiling
```

Where `playerCeiling` is the stat earned from the corresponding room (e.g. speed stat for sprint minigame) and `rivalCeiling` is the rival's base stat for that attribute.

### Rivals per Level

| Level | Rival | Taunt | Loss Line |
|-------|-------|-------|-----------|
| 1 | Dr. Voss | "Your test selection was amateur hour. My athlete was optimised from day one." | "Impossible... your protocols actually worked." |
| 2 | Prof. Krane | "Your training zones are textbook errors. My athlete will crush yours on the climb." | "Your power data was... surprisingly precise." |
| 3 | Coach Steele | "Your boxer will gas out by round 3. Mine was built for 12." | "Your conditioning program... it actually held up." |
| 4 | Dr. Okafor | "Your threshold data was sloppy. My runner has the kick to prove it." | "Your speed reserve protocol... I need to study your methods." |

---

## Stat Summary

| Room | Stat | Feeds Into Boss Minigame |
|------|------|--------------------------|
| 1 — Test Selection | Speed | Sprint (mash) |
| 2 — Variable Identification | Strength | Strength (hold) |
| 3 — Training Prescription | Endurance | Endurance (rhythm) |
| 4 — Performance Prediction | Power | Power (timing) |

Formula: `stat = dataQuality × 0.4 + variableAccuracy × 0.6`

Higher room performance → higher stat ceiling → easier boss minigame.
