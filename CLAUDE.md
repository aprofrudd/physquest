# PhysQuest

Retro-style sports science RPG: pure canvas game, no game framework and no UI framework.

## Architecture

- **Entry**: `main.ts` loads the console CSS and calls `startGame()` in `game.ts`, which wires every scene, the pause menu, autosave/auto-pause on `visibilitychange`/`pagehide`, and the debug hook.
- **Console shell** (`src/ui/`): a CSS-built handheld around the screen. `mountConsole()` builds the DOM (`consoleDom.ts`), solves the portrait and landscape layouts screen-first (`consoleLayout.ts`: thin bezel, brand row only when there is height to spare, controls never under 44px) and wires Pointer Events for every button (`consoleInput.ts`). The game draws into an off-DOM 256x224 canvas; `present()` copies each frame to the display canvas at an integer multiple (sharp-bilinear when the fit is fractional).
- **Engine**: `GameLoop` (fixed 60 Hz updates, renders only after an update, keeps running after a thrown frame), `Input` (keyboard + console buttons), `SceneManager`.
- **Rendering**: imperative canvas calls. `PixelFont` (5x7 font, cached glyph canvases), `SpriteSheet` (cached sprites), `TileMap` (whole maps pre-rendered per palette), `DialogueBox`, `OverworldHud`, `Palettes`.
- **Scenes**: `TitleScene` → `IntroScene` (coach dialogue + name entry) → `LevelSelectScene` → `OverworldScene` (hub + 4 rooms) → `RoomChallengeScene` → `BossBattleScene` → `LevelClearScene`.
- **Systems**: `Movement`, `Collision`, `Dialogue`, `BossMinigame`, `PauseMenu`, `SaveSystem`.
- **Audio**: `audio/Sfx.ts` synthesises chiptune blips with Web Audio (no files); unlocked on the first gesture; mute persisted.
- **State**: single `GameState`. The active level's rooms and stats live in `roomProgress`/`playerStats`; unfinished levels are stashed in `levelProgress` (`stashLevel`, `activateLevel`, `clearActiveLevel`). `returnDoor` puts the player back outside the hub door they used.

## Key Patterns

- Scenes are factory functions `createXScene()` returning `{ update, render, onEnter?, onExit? }`.
- Input: call `input.read()` exactly once per update. Use the edge fields (`aPressed`, `bPressed`, `startPressed`, `selectPressed`, `upPressed`...) for presses, `upRepeat`/`downRepeat`/`leftRepeat`/`rightRepeat` for menu cursors (auto-repeat), and held fields (`a`, `up`...) only for holds. Presses are latched between reads, so never add local "wasDown" debouncing. `input.blockRepeats()` stops an already-held direction auto-repeating until it is released; it runs on every scene switch, when a choice list appears and when the pause menu opens, so call it for any new menu. Name entry uses `input.setTextMode(true)` so physical keys type letters.
- Buttons: A confirms/interacts; B goes back or deletes, advances dialogue text but never confirms a choice, and runs while held; START opens the pause menu in levels (confirms on menus); SELECT opens the objectives panel. Game text names console buttons, never keyboard keys.
- In-level scenes start `update()` with `if (pauseMenu.handle(dt, inp)) return;` and draw `pauseMenu.render(ctx)` last.
- No `setTimeout`/`setInterval` in game logic: timers advance with `dt`, so pausing freezes them. `Date.now()` is only for cosmetic blinking.
- Dialogue choices are shuffled per prompt, multi-select rooms remove picked options, and replayed rooms keep the best stat.
- Showdown rating = 70% of the level's focus stat + 30% of the mean of all four stats (`showdownRating`). The boss scene warns before the fight when the rating cannot beat the rival's target.
- `saveGame()` also stashes the active level. It runs after name entry, every room, every showdown, from the pause menu, and when the page is hidden mid-level. The save format is versioned (v2; v1 saves migrate).
- `ui/announce.ts` mirrors dialogue into an aria-live region for screen readers.

## Build, Test & Deploy

- `npm run dev`: Vite dev server
- `npm run build`: `tsc -b && vite build` → `dist/`
- Debug hook: on the dev server, or any build opened with `?debug`, `window.__pq` exposes `{ state, scene(), go(sceneId), enterRoom('room1'..'room4'), input, dialogue, pauseMenu, sfx }` for automated playthroughs (e.g. Playwright with WebKit/Chromium device emulation).
- Deployed on Vercel (auto-deploy on push to `master`).

## Game Content

4 levels, each with a sport, athlete and rival boss. Each level has 4 rooms (test selection, variable ID, training prescription, performance prediction). The sports-science content is in `src/data/sports.ts` (maps, dialogue, sprites and level names are in the other `src/data/` files); `docs/rooms.md` documents rooms, scoring and bosses. Physiology content (numbers, correct answers, explanations) is reviewed by Alan: ask before changing it.
