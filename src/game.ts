import { createGameLoop } from './engine/GameLoop';
import { createInput } from './engine/Input';
import { createSceneManager, type SceneId } from './engine/SceneManager';
import {
  activateLevel,
  clearActiveLevel,
  createInitialState,
  stashLevel,
  type LevelResult,
} from './state/GameState';
import { createDialogueSystem } from './systems/Dialogue';
import { createMovement } from './systems/Movement';
import { createPauseMenu } from './systems/PauseMenu';
import { saveGame } from './systems/SaveSystem';
import { createTitleScene } from './scenes/TitleScene';
import { createIntroScene } from './scenes/IntroScene';
import { createLevelSelectScene } from './scenes/LevelSelectScene';
import { createOverworldScene } from './scenes/OverworldScene';
import { createRoomChallengeScene } from './scenes/RoomChallengeScene';
import { createBossBattleScene } from './scenes/BossBattleScene';
import { createLevelClearScene } from './scenes/LevelClearScene';
import { GAME_W, GAME_H } from './render/DialogueBox';
import { mountConsole } from './ui/console';
import { sfx } from './audio/Sfx';
import { levelHasNewRooms, loadRooms } from './rooms/loader';
import { newRoomsOn } from './rooms/preview';
import { LEVELS } from './data/levels';

// Scenes where the player is mid-level: auto-pause and auto-save when the app is backgrounded
const IN_LEVEL: readonly SceneId[] = ['overworld', 'roomChallenge', 'bossBattle'];

export const startGame = (root: HTMLElement) => {
  newRoomsOn(); // a ?rooms= choice in the address is remembered from the first page load
  const input = createInput();
  const ui = mountConsole(root, input, { gameWidth: GAME_W, gameHeight: GAME_H, sfx });
  const ctx = ui.canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Canvas 2D is not available');
  ctx.imageSmoothingEnabled = false;

  const gameState = createInitialState();
  // A direction held from the previous screen must not scroll a menu that has just opened
  const sceneManager = createSceneManager(() => input.blockRepeats());
  const dialogue = createDialogueSystem(() => input.blockRepeats(), button => input.label(button));
  const movement = createMovement();
  const pauseMenu = createPauseMenu(
    sceneManager,
    gameState,
    dialogue,
    () => input.blockRepeats(),
    button => input.label(button),
    // Finished rooms are saved, but a room still being played is not: quitting from one asks first
    () => (sceneManager.getCurrentId() === 'roomChallenge' && roomChallengeScene.inProgress() ? "THIS ROOM WON'T BE SAVED." : null),
  );

  let lastResult: LevelResult | null = null;

  const roomChallengeScene = createRoomChallengeScene(
    input,
    sceneManager,
    gameState,
    dialogue,
    () => {
      // Room finished: persist, then back to the hub outside that room's door
      saveGame(gameState);
      sceneManager.switchTo('overworld');
    },
    pauseMenu,
  );

  sceneManager.register('title', createTitleScene(input, sceneManager, gameState));

  sceneManager.register('intro', createIntroScene(input, sceneManager, gameState, dialogue));

  const enterLevel = (levelIndex: number) => {
    stashLevel(gameState); // keep any unfinished progress in the level we're leaving
    activateLevel(gameState, levelIndex);
    saveGame(gameState);
    sceneManager.switchTo('overworld');
  };

  // A level with redesigned rooms first makes sure their chunk has loaded (it normally has, see the preload below);
  // if the player moves on while it loads, the level is not started from under them
  let starting = false;
  const playLevel = (levelIndex: number) => {
    if (starting) return;
    if (!levelHasNewRooms(levelIndex)) {
      enterLevel(levelIndex);
      return;
    }
    starting = true;
    const from = sceneManager.getCurrentId();
    void loadRooms().then(() => {
      starting = false;
      if (sceneManager.getCurrentId() === from) enterLevel(levelIndex);
    });
  };

  sceneManager.register('levelSelect', createLevelSelectScene(input, sceneManager, gameState, playLevel));

  const overworldScene = createOverworldScene(
    input,
    sceneManager,
    gameState,
    dialogue,
    movement,
    (roomId: string) => {
      sceneManager.switchTo('roomChallenge');
      roomChallengeScene.setRoom(roomId);
    },
    () => {
      sceneManager.switchTo('bossBattle');
    },
    pauseMenu,
  );
  sceneManager.register('overworld', overworldScene);

  sceneManager.register('roomChallenge', roomChallengeScene);

  sceneManager.register('bossBattle', createBossBattleScene(
    input,
    sceneManager,
    gameState,
    dialogue,
    (result) => {
      const level = gameState.currentLevel;
      const stats = { ...gameState.playerStats };
      if (result.won) {
        const wasComplete = gameState.gameComplete;
        gameState.bossDefeated[level] = true;
        gameState.gameComplete = gameState.bossDefeated.every(Boolean);
        clearActiveLevel(gameState); // a won level replays from scratch
        lastResult = { ...result, level, stats, outcome: gameState.gameComplete && !wasComplete ? 'complete' : 'win' };
      } else {
        // Keep room progress so the player can retry the bout or improve a room
        lastResult = { ...result, level, stats, outcome: 'lose' };
      }
      saveGame(gameState);
      sceneManager.switchTo('levelClear');
    },
    pauseMenu,
  ));

  sceneManager.register('levelClear', createLevelClearScene(
    input,
    sceneManager,
    gameState,
    () => lastResult,
    (choice) => {
      if (choice === 'retry') {
        sceneManager.switchTo('bossBattle');
      } else if (choice === 'hub') {
        gameState.returnDoor = 'boss';
        sceneManager.switchTo('overworld');
      } else if (lastResult?.outcome === 'complete') {
        sceneManager.switchTo('title');
      } else {
        sceneManager.switchTo('levelSelect');
      }
    },
  ));

  sceneManager.switchTo('title');

  const loop = createGameLoop(ctx, () => sceneManager.getCurrent(), ui.present);
  loop.start();

  // The redesigned rooms' chunk loads in the background once the title is up, so it is ready before anyone
  // reaches a redesigned level without slowing the first screen
  const anyNewRooms = LEVELS.some((_, level) => levelHasNewRooms(level));
  if (anyNewRooms) {
    const preload = () => void loadRooms();
    if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(preload, { timeout: 3000 });
    else window.setTimeout(preload, 1000);
  }

  // Phones background tabs constantly: pause mid-level and save so nothing is lost
  const onHidden = () => {
    if (document.visibilityState !== 'hidden') return;
    const id = sceneManager.getCurrentId();
    if (id && IN_LEVEL.includes(id)) {
      if (!pauseMenu.isActive()) pauseMenu.open();
      saveGame(gameState);
    }
  };
  const onPageHide = () => {
    const id = sceneManager.getCurrentId();
    if (id && IN_LEVEL.includes(id)) saveGame(gameState);
  };
  document.addEventListener('visibilitychange', onHidden);
  window.addEventListener('pagehide', onPageHide);

  // Test hook for automated playthroughs (dev server, or ?debug on a build). Tests start levels and rooms
  // straight away, so the hook appears once the redesigned rooms' chunk is ready.
  if (import.meta.env.DEV || new URLSearchParams(location.search).has('debug')) {
    const hook = {
      state: gameState,
      scene: () => sceneManager.getCurrentId(),
      go: (id: SceneId) => sceneManager.switchTo(id),
      enterRoom: (roomId: string) => {
        sceneManager.switchTo('roomChallenge');
        roomChallengeScene.setRoom(roomId);
      },
      playLevel,
      instrument: () => roomChallengeScene.debug(),
      showRoom: (mapId: string) => {
        sceneManager.switchTo('overworld');
        overworldScene.showRoom(mapId);
      },
      input,
      dialogue,
      pauseMenu,
      sfx,
    };
    void (anyNewRooms ? loadRooms() : Promise.resolve(true)).then(() => {
      (window as unknown as Record<string, unknown>).__pq = hook;
    });
  }

  return () => {
    loop.stop();
    input.destroy();
    ui.destroy();
    document.removeEventListener('visibilitychange', onHidden);
    window.removeEventListener('pagehide', onPageHide);
  };
};
