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
import { commitLevel, levelHasNewRooms, loadRooms, meetRoomFor, roomsFailed, roomsLoaded } from './rooms/loader';
import { setNameSource } from './engine/nameToken';
import { announce } from './ui/announce';
import { newRoomsOn } from './rooms/preview';
import { LEVELS, allPlayableCleared } from './data/levels';

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
  setNameSource(() => gameState.playerName); // {NAME} in any line is the name typed at name entry
  // A level pick waiting for the redesigned rooms' chunk goes stale when a newer pick, a cursor move on the level
  // select or any scene change comes first
  let pick = 0;
  let loadingLevel: number | null = null; // the level select says LOADING while this level waits for the chunk
  const dropPick = () => {
    pick++;
    loadingLevel = null;
  };
  // A direction held from the previous screen must not scroll a menu that has just opened
  const sceneManager = createSceneManager(() => {
    input.blockRepeats();
    dropPick();
  });
  const dialogue = createDialogueSystem(() => input.blockRepeats(), button => input.label(button));
  const movement = createMovement();
  const pauseMenu = createPauseMenu(
    sceneManager,
    gameState,
    dialogue,
    () => input.blockRepeats(),
    button => input.label(button),
    // Finished rooms are saved, but a room still being played is not: quitting from one asks first
    () => (sceneManager.getCurrentId() === 'roomChallenge' && roomChallengeScene.inProgress() ? "This attempt won't be saved." : null),
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
    loadingLevel = null;
    commitLevel(levelIndex); // this visit plays the redesigned rooms only if they are ready now
    stashLevel(gameState); // keep any unfinished progress in the level we're leaving
    activateLevel(gameState, levelIndex);
    gameState.meetRoom = meetRoomFor(levelIndex); // the Performance Director and the ATHLETE room, with the new rooms
    saveGame(gameState);
    sceneManager.switchTo('overworld');
  };

  // A level with redesigned rooms waits for their chunk (normally already loaded by the preload below), for a few
  // seconds at most: then it starts with the classic rooms. Classic levels never wait, and a pick the player has
  // moved on from (another pick, or leaving the screen) is dropped.
  const LOAD_WAIT_MS = 3000;
  const playLevel = (levelIndex: number) => {
    if (loadingLevel === levelIndex) return; // already waiting for it: a second press does not restart the wait
    dropPick();
    const mine = pick;
    if (!levelHasNewRooms(levelIndex) || roomsLoaded() || roomsFailed()) {
      enterLevel(levelIndex);
      return;
    }
    loadingLevel = levelIndex;
    announce('Loading the new rooms.');
    const go = (note: string) => {
      if (mine !== pick) return;
      if (note) announce(note);
      enterLevel(levelIndex);
    };
    void loadRooms().then(ok => go(ok ? '' : 'The new rooms could not load, so this visit plays the classic rooms.'));
    window.setTimeout(() => go('The new rooms are still loading, so this visit plays the classic rooms.'), LOAD_WAIT_MS);
  };

  sceneManager.register(
    'levelSelect',
    createLevelSelectScene(input, sceneManager, gameState, playLevel, () => loadingLevel !== null, () => {
      if (loadingLevel !== null) dropPick(); // moving the cursor is a change of mind
    }),
  );

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
        gameState.gameComplete = allPlayableCleared(gameState.bossDefeated);
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
    if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(preload, { timeout: 500 });
    else window.setTimeout(preload, 100); // Safari: no idle callback, so just after the first frames
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
