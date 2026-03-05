# PhysQuest

A retro-style RPG where players apply sports science knowledge to train athletes across four levels. Built as a pixel-art canvas game with TypeScript and Vite.

## Gameplay

You play as a sports scientist guiding athletes through test selection, data analysis, training prescription, and performance prediction. Each level features a different sport and athlete:

| Level | Sport | Athlete | Focus | Boss |
|-------|-------|---------|-------|------|
| 1 — Pre-Season Camp | Rugby League | Jake, 24, winger | Speed / Repeated sprint ability | Dr. Voss |
| 2 — Regional Championship | Cycling | Mia, 28, road cyclist | Strength / Maximal aerobic power | Prof. Krane |
| 3 — National Finals | Boxing | Carlos, 22, middleweight | Endurance / Anaerobic capacity | Coach Steele |
| 4 — International Selection | Distance Running | Aisha, 26, 5000m runner | Power / Speed reserve | Dr. Okafor |

Each level has 4 challenge rooms:
1. **Test Selection** — Choose appropriate fitness tests for the athlete
2. **Variable Identification** — Identify key performance variables from test data
3. **Training Prescription** — Select correct training zones
4. **Performance Prediction** — Predict realistic training adaptations

Complete all rooms to face the level's rival boss in a stat-based showdown.

## Tech Stack

- **TypeScript** + **Vite** (no game framework — pure canvas)
- Pixel font rendering, tile maps, sprite sheets, dialogue system
- Scene-based architecture: Intro, Title, Level Select, Overworld, Room Challenge, Boss Battle, Level Clear
- Save system with localStorage persistence across sessions
- Mobile support with touch d-pad, action button, and pause button
- Fractional canvas scaling for crisp pixel art at any resolution

## Getting Started

```bash
npm install
npm run dev        # dev server at http://localhost:5173
npm run build      # production build to dist/
npm run preview    # preview production build
```

## Deployment

Deployed on [Vercel](https://physquest.vercel.app). Auto-deploys on push to `master`.

## Project Structure

```
src/
├── engine/       GameLoop, Input, SceneManager
├── render/       SpriteSheet, PixelFont, DialogueBox, TileMap, Palettes
├── scenes/       IntroScene, TitleScene, LevelSelectScene, OverworldScene,
│                 RoomChallengeScene, BossBattleScene, LevelClearScene
├── systems/      Movement, Collision, Dialogue, BossMinigame, PauseMenu, SaveSystem
├── data/         sprites, maps, sports, levels, dialogue
└── state/        GameState
```
