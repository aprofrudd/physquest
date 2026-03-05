import type { Scene } from '../engine/GameLoop';
import type { Input } from '../engine/Input';
import type { SceneManager } from '../engine/SceneManager';
import type { GameState } from '../state/GameState';
import type { DialogueSystem } from '../systems/Dialogue';
import type { Movement } from '../systems/Movement';
import { renderTileMap, TILE_SIZE } from '../render/TileMap';
import { drawSprite } from '../render/SpriteSheet';
import { drawText } from '../render/PixelFont';
import { GAME_W, GAME_H } from '../render/DialogueBox';
import { ALL_MAPS, type MapData } from '../data/maps';
import { DIALOGUES } from '../data/dialogue';
import { getCoachSprite, NPC_SPRITE, SPRITE_COLORS } from '../data/sprites';
import { checkInteraction, checkStandingOnDoor } from '../systems/Collision';
import { PALETTES } from '../render/Palettes';
import { LEVELS } from '../data/levels';

export const createOverworldScene = (
  input: Input,
  sceneManager: SceneManager,
  gameState: GameState,
  dialogue: DialogueSystem,
  movement: Movement,
  onEnterRoom: (roomId: string) => void,
  onEnterBoss: () => void
): Scene => {
  let currentMapId = 'hub';
  let currentMap: MapData = ALL_MAPS['hub']!;
  let roomLabel = '';
  let roomLabelTimer = 0;

  const switchMap = (mapId: string) => {
    const map = ALL_MAPS[mapId];
    if (!map) return;
    currentMapId = mapId;
    currentMap = map;
    // Place player at the door going back
    if (mapId === 'hub') {
      gameState.playerPos = { x: 7, y: 7 };
      gameState.playerDir = 'up';
    } else {
      gameState.playerPos = { x: 7, y: 11 };
      gameState.playerDir = 'up';
    }
    roomLabel = map.name;
    roomLabelTimer = 2;
  };

  return {
    onEnter() {
      switchMap('hub');
      roomLabel = currentMap.name;
      roomLabelTimer = 2;
    },

    update(dt: number) {
      const inp = input.read();

      // Track if dialogue was active before this frame's update
      const dialogueWasActive = dialogue.isActive();

      // Update dialogue
      dialogue.update(dt, inp);

      // Room label fade
      if (roomLabelTimer > 0) roomLabelTimer -= dt;

      // Movement (blocked during dialogue)
      movement.update(dt, inp, gameState, currentMap.tiles, dialogue.isActive());

      // Check standing on door (automatic transition)
      if (!dialogue.isActive() && !dialogueWasActive && !gameState.playerMoving) {
        const standing = checkStandingOnDoor(gameState, currentMap);
        if (standing.type === 'door' && standing.target) {
          if (standing.target === 'hub' && currentMapId !== 'hub') {
            switchMap('hub');
            return;
          }
          if (standing.target.startsWith('room') && currentMapId === 'hub') {
            const roomNum = parseInt(standing.target.replace('room', ''));
            if (!isNaN(roomNum)) {
              // Check if room challenge is needed
              const roomKeys = ['testSelection', 'variableId', 'trainingPrescription', 'performancePrediction'] as const;
              const roomKey = roomKeys[roomNum - 1];
              if (roomKey && !gameState.roomProgress[roomKey]) {
                switchMap(standing.target);
                roomLabelTimer = 2;
                return;
              } else {
                // Already completed — show message
                dialogue.show('This room challenge is complete. Good work, Coach!');
                // Push player back
                gameState.playerPos.y -= 1;
                return;
              }
            }
          }
        }
        if (standing.type === 'bossDoor' && currentMapId === 'hub') {
          // Check if all rooms are complete
          const { testSelection, variableId, trainingPrescription, performancePrediction } = gameState.roomProgress;
          if (testSelection && variableId && trainingPrescription && performancePrediction) {
            onEnterBoss();
            return;
          } else {
            dialogue.show('Complete all four room challenges before entering the arena.');
            gameState.playerPos.y -= 1;
            return;
          }
        }
      }

      // Interaction check — skip if dialogue just closed this frame
      if (inp.actionPressed && !dialogue.isActive() && !dialogueWasActive && !gameState.playerMoving) {
        const interaction = checkInteraction(gameState, currentMap);

        if (interaction.type === 'npc' || interaction.type === 'equipment') {
          if (interaction.dialogueKey) {
            // Check if this is a room NPC that should trigger a challenge
            if (currentMapId.startsWith('room') && interaction.type === 'npc') {
              onEnterRoom(currentMapId);
              return;
            }

            const lines = DIALOGUES[interaction.dialogueKey];
            if (lines && lines.length > 0) {
              const texts = lines.map(l => l.text);
              dialogue.showSequence(texts);
            }
          }
        }
      }
    },

    render(ctx: CanvasRenderingContext2D) {
      // Clear with background color
      const pal = PALETTES[currentMap.palette];
      ctx.fillStyle = pal.colors[4];
      ctx.fillRect(0, 0, GAME_W, GAME_H);

      // Render tile map (no scrolling — single screen)
      renderTileMap(ctx, currentMap.tiles, currentMap.palette, 0, 0, GAME_W, GAME_H);

      // Render NPCs
      for (const npc of currentMap.npcs) {
        drawSprite(
          ctx,
          NPC_SPRITE,
          npc.x * TILE_SIZE,
          npc.y * TILE_SIZE,
          SPRITE_COLORS['npc_athlete']!
        );
      }

      // Render player
      const frame = movement.getAnimFrame();
      const sprite = getCoachSprite(gameState.playerDir, gameState.playerMoving ? frame : 0);
      drawSprite(
        ctx,
        sprite,
        Math.floor(gameState.playerPos.x * TILE_SIZE),
        Math.floor(gameState.playerPos.y * TILE_SIZE),
        SPRITE_COLORS['default']!
      );

      // Room label
      if (roomLabelTimer > 0) {
        const alpha = Math.min(1, roomLabelTimer);
        ctx.globalAlpha = alpha;
        const labelColor = pal.colors[5] ?? '#ffffff';
        drawText(ctx, currentMap.name, 8, 8, labelColor);

        // Level info
        const level = LEVELS[gameState.currentLevel];
        if (level) {
          drawText(ctx, level.name, 8, 18, pal.colors[3] ?? '#aaaaaa');
        }
        ctx.globalAlpha = 1;
      }

      // Render dialogue
      dialogue.render(ctx);
    },
  };
};
