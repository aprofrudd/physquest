# PhysQuest

Retro-style sports science RPG — pure canvas game, no game framework.

## Architecture

- **Engine**: `GameLoop` (requestAnimationFrame), `Input` (keyboard), `SceneManager` (scene transitions)
- **Rendering**: All pixel-art rendered to a single `<canvas>` — `SpriteSheet`, `PixelFont`, `DialogueBox`, `TileMap`, `Palettes`
- **Scenes**: `TitleScene` → `OverworldScene` → `RoomChallengeScene` → `BossBattleScene` → `LevelClearScene`
- **Systems**: `Movement`, `Collision`, `Dialogue`, `BossMinigame` — run each frame within scenes
- **Data**: All game content in `src/data/` — sports science questions, maps, sprites, dialogue are data-driven
- **State**: Single `GameState` object passed through scenes; `calcStat()` derives stats from challenge performance

## Key Patterns

- Scene-based: each scene exports a factory function `createXScene()` returning `{ update, render, onEnter?, onExit? }`
- No React rendering — React is a vestigial dependency from the Vite template (entry is `main.tsx` but renders to canvas)
- All rendering is imperative canvas calls — no virtual DOM
- Game runs at native requestAnimationFrame rate with delta-time

## Build & Deploy

- `npm run dev` — Vite dev server
- `npm run build` — `tsc -b && vite build` → `dist/`
- Deployed on Vercel (auto-deploy on push to `master`)

## Game Content

4 levels, each with a sport/athlete/rival boss. Each level has 4 rooms (test selection, variable ID, training prescription, performance prediction). All content defined in `src/data/sports.ts`.
