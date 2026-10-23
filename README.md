# PhysQuest

A retro-style RPG where players apply sports science knowledge to train athletes across four levels. Built as a pixel-art canvas game with TypeScript and Vite, played inside an on-screen handheld console that works with touch or a keyboard.

**Play:** [physquest.vercel.app](https://physquest.vercel.app)

## Gameplay

You play as a sports scientist guiding athletes through test selection, data analysis, training prescription, and performance prediction. Each level features a different sport and athlete:

| Level | Sport | Athlete | Focus | Boss |
|-------|-------|---------|-------|------|
| 1: Pre-Season Camp | Rugby League | Jake, 24, winger | Speed / Repeated sprint ability | Dr. Voss |
| 2: Regional Championship | Cycling | Mia, 28, road cyclist | Strength / Maximal aerobic power | Prof. Krane |
| 3: National Finals | Boxing | Carlos, 22, middleweight | Endurance / Anaerobic capacity | Coach Steele |
| 4: International Selection | Distance Running | Aisha, 26, 5000m runner | Power / Speed reserve | Dr. Okafor |

Each level has 4 challenge rooms, taken in order (a gold arrow in the hub points at the next door):
1. **Testing** (Test Selection, raises Speed): choose appropriate fitness tests for the athlete
2. **Data** (Variable Identification, raises Strength): identify key performance variables from test data
3. **Training** (Training Prescription, raises Endurance): select correct training zones
4. **Analysis** (Performance Prediction, raises Power): predict realistic training adaptations

Answer options are shuffled every time, and a finished room can be replayed to raise your best score. Complete all rooms to open the arena and face the level's rival in a showdown minigame. Your showdown rating is 70% the level's focus stat and 30% your average across all four rooms, so every room counts: it is the most your bar can reach. A rules card before each bout explains the controls and the target to beat. Lose, and the game tells you why: which room to replay if your rating was too low, otherwise how to play the bout better; your room progress is kept.

## Controls

The game sits inside a handheld console. Tap its buttons on a phone or tablet, click them with a mouse, or use the keyboard:

| Console | Keyboard | Use |
|---------|----------|-----|
| D-pad | Arrow keys or WASD | Move, choose options |
| A | Z, Space or Enter | Talk, interact, confirm |
| B | X or Backspace | Leave a conversation or challenge, go back, delete a letter; hold to run |
| START | Esc or P | Pause menu (resume, save, sound, quit) |
| SELECT | Shift | Objectives panel in the hub |

On-screen prompts follow what you are using: key names (SPACE, X, ESC, SHIFT, ARROWS) after a key press, console names after a tap or click on the console. On a keyboard you can also type your coach's name directly and finish it with Enter. Progress saves automatically after naming your coach, after every room and after every showdown. On a phone, add the page to your home screen for a full-screen, app-like experience.

## Tech Stack

- **TypeScript** + **Vite** (no game or UI framework: pure canvas plus a CSS console shell)
- Pixel font rendering with cached glyphs, cached sprites and pre-rendered tile maps
- Scene-based architecture: Title, Intro, Level Select, Overworld, Room Challenge, Boss Battle, Level Clear
- One input layer for the keyboard and multi-touch console buttons (Pointer Events); quick taps are never lost
- Versioned localStorage saves that keep unfinished levels
- Synthesised chiptune sound effects (Web Audio, no audio files) with a mute switch
- Crisp scaling: game pixels land on whole device pixels where possible, otherwise a sharp-bilinear upscale
- Installable web app manifest and icons

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
├── main.ts       Entry point
├── game.ts       Scene wiring, autosave and pause when the app is backgrounded
├── engine/       GameLoop, Input, SceneManager
├── render/       SpriteSheet, PixelFont, DialogueBox, TileMap, Palettes, OverworldHud
├── scenes/       TitleScene, IntroScene, LevelSelectScene, OverworldScene,
│                 RoomChallengeScene, BossBattleScene, LevelClearScene
├── systems/      Movement, Collision, Dialogue, BossMinigame, PauseMenu, SaveSystem
├── ui/           Handheld console (DOM, layout, touch input) and screen-reader announcer
├── audio/        Sfx
├── data/         sprites, maps, sports, levels, dialogue
└── state/        GameState
public/           Web app manifest and icons
```

## Author

Alan Ruddock, exercise physiologist, Sheffield Hallam University ([alanruddock.com](https://alanruddock.com)). Built with AI coding assistance (Claude Code); `CLAUDE.md` holds the notes it works from.
