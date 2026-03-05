import type { Scene } from '../engine/GameLoop';
import type { Input } from '../engine/Input';
import type { SceneManager } from '../engine/SceneManager';
import type { GameState } from '../state/GameState';
import type { DialogueSystem } from '../systems/Dialogue';
import { GAME_W, GAME_H } from '../render/DialogueBox';
import { drawText, measureText } from '../render/PixelFont';
import { drawPokemonBox } from '../render/SpriteSheet';
import { PALETTES } from '../render/Palettes';
import { renderTileMap } from '../render/TileMap';
import { ALL_MAPS } from '../data/maps';
import { LEVEL_DATA, type SportData } from '../data/sports';
import { calcStat } from '../state/GameState';

type ChallengePhase = 'intro' | 'challenge' | 'feedback' | 'complete';
type RoomType = 'room1' | 'room2' | 'room3' | 'room4';

export const createRoomChallengeScene = (
  input: Input,
  sceneManager: SceneManager,
  gameState: GameState,
  dialogue: DialogueSystem,
  onComplete: () => void
): Scene => {
  let phase: ChallengePhase = 'intro';
  let roomType: RoomType = 'room1';
  let sport: SportData = LEVEL_DATA[0]!;
  let dataQuality = 0;
  let variableAccuracy = 0;
  let headerText = '';

  const startRoom = (room: RoomType) => {
    roomType = room;
    sport = LEVEL_DATA[gameState.currentLevel] ?? LEVEL_DATA[0]!;
    phase = 'intro';
    dataQuality = 0;
    variableAccuracy = 0;

    switch (room) {
      case 'room1':
        headerText = 'TEST SELECTION';
        runTestSelection();
        break;
      case 'room2':
        headerText = 'VARIABLE IDENTIFICATION';
        runVariableId();
        break;
      case 'room3':
        headerText = 'TRAINING PRESCRIPTION';
        runTrainingZones();
        break;
      case 'room4':
        headerText = 'PERFORMANCE PREDICTION';
        runPrediction();
        break;
    }
  };

  const runTestSelection = () => {
    phase = 'challenge';
    dialogue.show(
      `${sport.athleteProfile} Goal: ${sport.goal}`,
      undefined,
      () => {
        const testNames = sport.tests.map(t => t.name);
        dialogue.show(
          'Which test should we use to assess this athlete?',
          testNames,
          (choiceIdx) => {
            const chosen = sport.tests[choiceIdx ?? 0];
            if (chosen) {
              dataQuality = chosen.dataQuality;
              variableAccuracy = chosen.correct ? 1 : 0.3;

              if (chosen.correct) {
                dialogue.show(
                  `Good choice! ${chosen.description}`,
                  undefined,
                  () => {
                    dialogue.show(sport.testInsight, undefined, () => {
                      completeRoom('testSelection');
                    });
                  }
                );
              } else {
                dialogue.show(
                  `Not ideal. ${chosen.description} This isnt the best match for the athletes needs.`,
                  undefined,
                  () => {
                    dialogue.show(sport.testInsight, undefined, () => {
                      completeRoom('testSelection');
                    });
                  }
                );
              }
            }
          }
        );
      }
    );
  };

  const runVariableId = () => {
    phase = 'challenge';
    dialogue.show(
      `Test data: ${sport.dataOutput}`,
      undefined,
      () => {
        const varNames = sport.variables.map(v => v.name);
        let correctCount = 0;
        let totalCorrect = sport.variables.filter(v => v.correct).length;
        let selectionsLeft = totalCorrect;

        const askNext = () => {
          if (selectionsLeft <= 0) {
            variableAccuracy = correctCount / totalCorrect;
            dataQuality = variableAccuracy > 0.5 ? 0.8 : 0.5;
            dialogue.show(
              sport.variableInsight,
              undefined,
              () => completeRoom('variableId')
            );
            return;
          }

          dialogue.show(
            `Select a key variable (${selectionsLeft} remaining):`,
            varNames,
            (choiceIdx) => {
              const chosen = sport.variables[choiceIdx ?? 0];
              if (chosen) {
                if (chosen.correct) {
                  correctCount++;
                  dialogue.show(`Correct! ${chosen.explanation}`, undefined, () => {
                    selectionsLeft--;
                    askNext();
                  });
                } else {
                  dialogue.show(`Not quite. ${chosen.explanation}`, undefined, () => {
                    selectionsLeft--;
                    askNext();
                  });
                }
              }
            }
          );
        };

        askNext();
      }
    );
  };

  const runTrainingZones = () => {
    phase = 'challenge';
    dialogue.show(
      'Based on the test data, which training zones should we prescribe?',
      undefined,
      () => {
        const zoneNames = sport.zones.map(z => z.name);
        let correctCount = 0;
        const totalCorrect = sport.zones.filter(z => z.correct).length;
        let selectionsLeft = totalCorrect;

        const askNext = () => {
          if (selectionsLeft <= 0) {
            variableAccuracy = correctCount / totalCorrect;
            dataQuality = variableAccuracy > 0.5 ? 0.85 : 0.5;
            dialogue.show(
              sport.zoneInsight,
              undefined,
              () => completeRoom('trainingPrescription')
            );
            return;
          }

          dialogue.show(
            `Select a training zone (${selectionsLeft} remaining):`,
            zoneNames,
            (choiceIdx) => {
              const chosen = sport.zones[choiceIdx ?? 0];
              if (chosen) {
                if (chosen.correct) {
                  correctCount++;
                  dialogue.show(`Good call! ${chosen.description}`, undefined, () => {
                    selectionsLeft--;
                    askNext();
                  });
                } else {
                  dialogue.show(`Not the priority. ${chosen.description}`, undefined, () => {
                    selectionsLeft--;
                    askNext();
                  });
                }
              }
            }
          );
        };

        askNext();
      }
    );
  };

  const runPrediction = () => {
    phase = 'challenge';
    dialogue.show(
      sport.predictionScenario,
      undefined,
      () => {
        const predNames = sport.predictions.map(p => p.text);
        dialogue.show(
          'What adaptation do you predict?',
          predNames,
          (choiceIdx) => {
            const chosen = sport.predictions[choiceIdx ?? 0];
            if (chosen) {
              variableAccuracy = chosen.correct ? 1 : 0.2;
              dataQuality = chosen.correct ? 0.9 : 0.5;

              if (chosen.correct) {
                dialogue.show(
                  `Excellent prediction! ${sport.predictionInsight}`,
                  undefined,
                  () => completeRoom('performancePrediction')
                );
              } else {
                dialogue.show(
                  `Not the most likely outcome. ${sport.predictionInsight}`,
                  undefined,
                  () => completeRoom('performancePrediction')
                );
              }
            }
          }
        );
      }
    );
  };

  const completeRoom = (roomKey: keyof typeof gameState.roomProgress) => {
    phase = 'complete';
    gameState.roomProgress[roomKey] = true;

    const statValue = calcStat(dataQuality, variableAccuracy);
    gameState.challengeResults.push({ dataQuality, variableAccuracy });

    const statMap: Record<RoomType, keyof typeof gameState.playerStats> = {
      room1: 'speed',
      room2: 'strength',
      room3: 'endurance',
      room4: 'power',
    };
    const statKey = statMap[roomType];
    gameState.playerStats[statKey] = statValue;

    dialogue.show(
      `Challenge complete! ${statKey.toUpperCase()} stat: ${Math.round(statValue * 100)}%`,
      undefined,
      () => {
        onComplete();
      }
    );
  };

  return {
    onEnter() {
      // Room type set externally before switching scene
    },

    update(dt: number) {
      const inp = input.read();
      dialogue.update(dt, inp);
    },

    render(ctx: CanvasRenderingContext2D) {
      const palId = roomType === 'room1' ? 'lab' : roomType === 'room2' ? 'gym' : roomType === 'room3' ? 'track' : 'lab';
      const pal = PALETTES[palId];

      // Render actual tile map as dimmed background
      const mapData = ALL_MAPS[roomType];
      if (mapData) {
        renderTileMap(ctx, mapData.tiles, palId, 0, 0, GAME_W, GAME_H);
        // Dim overlay
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fillRect(0, 0, GAME_W, GAME_H);
      } else {
        ctx.fillStyle = pal.colors[4];
        ctx.fillRect(0, 0, GAME_W, GAME_H);
      }

      // Header in bordered panel
      const headerScale = measureText(headerText, 2) > GAME_W - 32 ? 1 : 2;
      const headerW = measureText(headerText, headerScale);
      const panelW = headerW + 16;
      drawPokemonBox(ctx, (GAME_W - panelW) / 2, 4, panelW, headerScale === 2 ? 22 : 16, pal.colors[1]);
      drawText(ctx, headerText, (GAME_W - headerW) / 2, headerScale === 2 ? 8 : 7, '#080808', headerScale);

      // Sport info
      drawText(ctx, sport.sport, 8, 30, pal.colors[5]);

      // Render dialogue
      dialogue.render(ctx);
    },

    setRoom(room: string) {
      startRoom(room as RoomType);
    },
  } as Scene & { setRoom: (room: string) => void };
};
