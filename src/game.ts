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

// Scenes where the player is mid-level: auto-pause and auto-save when the app is backgrounded
const IN_LEVEL: readonly SceneId[] = ['overworld', 'roomChallenge', 'bossBattle'];

export const startGame = (root: HTMLElement) => {
  const input = createInput();
  const ui = mountConsole(root, input, { gameWidth: GAME_W, gameHeight: GAME_H, sfx });
  const ctx = ui.canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Canvas 2D is not available');
  ctx.imageSmoothingEnabled = false;

  const gameState = createInitialState();
  // A direction held from the previous screen must not scroll a menu that has just opened
  const sceneManager = createSceneManager(() => input.blockRepeats());
  const dialogue = createDialogueSystem(() => input.blockRepeats());
  const movement = createMovement();
  const pauseMenu = createPauseMenu(sceneManager, gameState, dialogue, () => input.blockRepeats());

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

  sceneManager.register('levelSelect', createLevelSelectScene(
    input,
    sceneManager,
    gameState,
    (levelIndex: number) => {
      stashLevel(gameState); // keep any unfinished progress in the level we're leaving
      activateLevel(gameState, levelIndex);
      saveGame(gameState);
      sceneManager.switchTo('overworld');
    },
  ));

  sceneManager.register('overworld', createOverworldScene(
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
  ));

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

  // Test hook for automated playthroughs (dev server, or ?debug on a build)
  if (import.meta.env.DEV || new URLSearchParams(location.search).has('debug')) {
    (window as unknown as Record<string, unknown>).__pq = {
      state: gameState,
      scene: () => sceneManager.getCurrentId(),
      go: (id: SceneId) => sceneManager.switchTo(id),
      enterRoom: (roomId: string) => {
        sceneManager.switchTo('roomChallenge');
        roomChallengeScene.setRoom(roomId);
      },
      input,
      dialogue,
      pauseMenu,
      sfx,
    };
  }

  return () => {
    loop.stop();
    input.destroy();
    ui.destroy();
    document.removeEventListener('visibilitychange', onHidden);
    window.removeEventListener('pagehide', onPageHide);
  };
};
