import { useEffect, useRef } from 'react';
import { createGameLoop } from './engine/GameLoop';
import { createInput } from './engine/Input';
import { createSceneManager } from './engine/SceneManager';
import { createInitialState } from './state/GameState';
import { createDialogueSystem } from './systems/Dialogue';
import { createMovement } from './systems/Movement';
import { createTitleScene } from './scenes/TitleScene';
import { createOverworldScene } from './scenes/OverworldScene';
import { createRoomChallengeScene } from './scenes/RoomChallengeScene';
import { createBossBattleScene } from './scenes/BossBattleScene';
import { createLevelClearScene } from './scenes/LevelClearScene';
import { GAME_W, GAME_H } from './render/DialogueBox';

const SCALE = 3;

export const App = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Disable image smoothing for pixel-perfect rendering
    ctx.imageSmoothingEnabled = false;

    // Game state
    const gameState = createInitialState();
    const inputManager = createInput();
    const sceneManager = createSceneManager();
    const dialogue = createDialogueSystem();
    const movement = createMovement();

    let bossWon = false;

    // Room challenge scene with custom method
    const roomChallengeScene = createRoomChallengeScene(
      inputManager,
      sceneManager,
      gameState,
      dialogue,
      () => {
        // Return to overworld after challenge
        sceneManager.switchTo('overworld');
      }
    );

    const resetLevelProgress = () => {
      gameState.roomProgress = {
        testSelection: false,
        variableId: false,
        trainingPrescription: false,
        performancePrediction: false,
      };
      gameState.challengeResults = [];
      gameState.playerStats = { speed: 0, strength: 0, endurance: 0, power: 0 };
    };

    // Register scenes
    sceneManager.register('title', createTitleScene(inputManager, sceneManager));

    sceneManager.register('overworld', createOverworldScene(
      inputManager,
      sceneManager,
      gameState,
      dialogue,
      movement,
      (roomId: string) => {
        // Enter room challenge
        sceneManager.switchTo('roomChallenge');
        (roomChallengeScene as ReturnType<typeof createRoomChallengeScene> & { setRoom: (r: string) => void }).setRoom(roomId);
      },
      () => {
        // Enter boss battle
        sceneManager.switchTo('bossBattle');
      }
    ));

    sceneManager.register('roomChallenge', roomChallengeScene);

    sceneManager.register('bossBattle', createBossBattleScene(
      inputManager,
      sceneManager,
      gameState,
      dialogue,
      () => {
        // Boss won
        bossWon = true;
        gameState.bossDefeated[gameState.currentLevel] = true;

        if (gameState.currentLevel >= 3) {
          gameState.gameComplete = true;
        }

        sceneManager.switchTo('levelClear');
      },
      () => {
        // Boss lost
        bossWon = false;
        sceneManager.switchTo('levelClear');
      }
    ));

    sceneManager.register('levelClear', createLevelClearScene(
      inputManager,
      sceneManager,
      gameState,
      () => bossWon,
      () => {
        if (bossWon) {
          if (gameState.gameComplete) {
            // Back to title
            gameState.currentLevel = 0;
            resetLevelProgress();
            sceneManager.switchTo('title');
          } else {
            // Next level
            gameState.currentLevel = Math.min(3, gameState.currentLevel + 1);
            gameState.maxLevelUnlocked = Math.max(gameState.maxLevelUnlocked, gameState.currentLevel);
            resetLevelProgress();
            sceneManager.switchTo('overworld');
          }
        } else {
          // Retry — reset room progress but keep level
          resetLevelProgress();
          sceneManager.switchTo('overworld');
        }
      }
    ));

    // Start on title
    sceneManager.switchTo('title');

    // Game loop
    const loop = createGameLoop(ctx, () => sceneManager.getCurrent());
    loop.start();

    // Handle canvas scaling
    const resize = () => {
      const container = containerRef.current;
      if (!container) return;

      const maxW = window.innerWidth;
      const maxH = window.innerHeight;
      const scale = Math.max(1, Math.min(
        Math.floor(maxW / GAME_W),
        Math.floor(maxH / GAME_H)
      ));

      canvas.style.width = `${GAME_W * scale}px`;
      canvas.style.height = `${GAME_H * scale}px`;
    };

    resize();
    window.addEventListener('resize', resize);

    // Touch controls
    const touchState = { up: false, down: false, left: false, right: false };
    let touchStartX = 0;
    let touchStartY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      if (!touch) return;
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;

      // Tap in right half = action
      if (touch.clientX > window.innerWidth * 0.6) {
        inputManager.setTouchAction(true);
        setTimeout(() => inputManager.setTouchAction(false), 100);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      if (!touch) return;
      const dx = touch.clientX - touchStartX;
      const dy = touch.clientY - touchStartY;
      const threshold = 20;

      touchState.up = dy < -threshold;
      touchState.down = dy > threshold;
      touchState.left = dx < -threshold;
      touchState.right = dx > threshold;
      inputManager.setTouchDir({ ...touchState });
    };

    const handleTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      touchState.up = false;
      touchState.down = false;
      touchState.left = false;
      touchState.right = false;
      inputManager.setTouchDir({ ...touchState });
    };

    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });

    cleanupRef.current = () => {
      loop.stop();
      inputManager.destroy();
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
    };

    return () => {
      cleanupRef.current?.();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0f0f0f',
        position: 'relative',
      }}
    >
      <canvas
        ref={canvasRef}
        width={GAME_W}
        height={GAME_H}
        style={{
          imageRendering: 'pixelated',
          background: '#0a0a0a',
        }}
      />
      {/* Scanline overlay */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.2) 0px, rgba(0,0,0,0.2) 1px, transparent 1px, transparent 3px)',
        }}
      />
      {/* Mobile touch hint */}
      <div
        style={{
          position: 'absolute',
          bottom: 8,
          left: '50%',
          transform: 'translateX(-50%)',
          color: '#333',
          fontFamily: 'monospace',
          fontSize: '10px',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        SWIPE TO MOVE | TAP RIGHT TO ACT
      </div>
    </div>
  );
};
