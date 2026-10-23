import type { Scene } from '../engine/GameLoop';
import type { Input } from '../engine/Input';
import type { SceneManager } from '../engine/SceneManager';
import type { GameState, RoomKey } from '../state/GameState';
import type { DialogueSystem } from '../systems/Dialogue';
import type { PauseMenu } from '../systems/PauseMenu';
import { GAME_W, GAME_H, type DialogueOptions } from '../render/DialogueBox';
import { drawText, measureText } from '../render/PixelFont';
import { drawPokemonBox } from '../render/SpriteSheet';
import { PALETTES } from '../render/Palettes';
import { renderTileMap } from '../render/TileMap';
import { ALL_MAPS } from '../data/maps';
import { LEVEL_DATA, type SportData } from '../data/sports';
import { calcStat, nextRoom, roomKeyForMap, ROOM_LABEL, ROOM_MAP, ROOM_STAT } from '../state/GameState';
import { sfx } from '../audio/Sfx';

type ChallengePhase = 'intro' | 'challenge' | 'feedback' | 'complete';
type RoomType = 'room1' | 'room2' | 'room3' | 'room4';

const HEADERS: Record<RoomType, string> = {
  room1: 'TEST SELECTION',
  room2: 'VARIABLE IDENTIFICATION',
  room3: 'TRAINING PRESCRIPTION',
  room4: 'PERFORMANCE PREDICTION',
};

const HEADER_Y = 4;
const HEADER_H = 19; // 7px text, 2px padding, 4px border each side

/** Fisher-Yates: the order, as indices into the original list, in which to show `count` options. */
const shuffledOrder = (count: number): number[] => {
  const order = Array.from({ length: count }, (_, i) => i);
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const swap = order[i]!;
    order[i] = order[j]!;
    order[j] = swap;
  }
  return order;
};

const percent = (value: number): number => Math.round(value * 100);

export const createRoomChallengeScene = (
  input: Input,
  sceneManager: SceneManager,
  gameState: GameState,
  dialogue: DialogueSystem,
  onComplete: () => void,
  pauseMenu: PauseMenu,
): Scene & { setRoom(room: string): void } => {
  let phase: ChallengePhase = 'intro';
  let roomType: RoomType = 'room1';
  let roomKey: RoomKey = 'testSelection';
  let wasComplete = false; // finished before this visit: a replay can only raise the stat
  let sport: SportData = LEVEL_DATA[0]!;
  let dataQuality = 0;
  let variableAccuracy = 0;
  let headerText = '';

  /** The room is finished: back to the hub outside this room's door. */
  const finish = () => {
    gameState.returnDoor = roomType; // the hub puts the player back outside this door
    onComplete();
  };

  /** B walks away. Nothing is recorded until the room completes, so a replay keeps the old best. */
  const leave = () => {
    if (phase === 'complete') {
      finish();
      return;
    }
    gameState.resumeRoom = true; // back in the room, in front of the athlete
    sceneManager.switchTo('overworld');
  };

  /** Every line of a challenge can be left with B, so its hint says QUIT (the completion line hides it). */
  const say = (
    text: string,
    choices?: string[],
    onDone?: (choiceIndex?: number) => void,
    options: DialogueOptions = { exitLabel: 'QUIT' },
  ) => dialogue.show(text, choices, onDone, leave, options);

  /** Ask a multiple-choice question with the options in a fresh random order. */
  const ask = <T>(
    prompt: string,
    options: readonly T[],
    label: (option: T) => string,
    onPick: (option: T) => void,
  ) => {
    const order = shuffledOrder(options.length);
    say(prompt, order.map(i => label(options[i]!)), (choiceIdx) => {
      const picked = options[order[choiceIdx ?? 0] ?? 0];
      if (picked !== undefined) onPick(picked);
    });
  };

  const giveFeedback = (correct: boolean, text: string, then: () => void) => {
    sfx.play(correct ? 'correct' : 'wrong');
    say(text, undefined, then);
  };

  /**
   * One pick per correct answer. A picked option leaves the list, so no answer can score twice.
   */
  const pickSeveral = <T extends { correct: boolean }>(
    options: readonly T[],
    noun: string,
    label: (option: T) => string,
    feedbackFor: (option: T) => string,
    onDone: (correctCount: number, total: number) => void,
  ) => {
    const total = options.filter(o => o.correct).length;
    const remaining = [...options];
    let picks = 0;
    let correctCount = 0;

    const askNext = () => {
      if (picks >= total || remaining.length === 0) {
        onDone(correctCount, total);
        return;
      }
      ask(`Pick a ${noun} (${picks + 1} of ${total}):`, remaining, label, (chosen) => {
        remaining.splice(remaining.indexOf(chosen), 1);
        picks++;
        if (chosen.correct) correctCount++;
        giveFeedback(chosen.correct, feedbackFor(chosen), askNext);
      });
    };
    askNext();
  };

  const startRoom = (room: string) => {
    const key = roomKeyForMap(room);
    if (!key) {
      sceneManager.switchTo('overworld');
      return;
    }
    roomKey = key;
    roomType = ROOM_MAP[key];
    wasComplete = gameState.roomProgress[key];
    sport = LEVEL_DATA[gameState.currentLevel] ?? LEVEL_DATA[0]!;
    phase = 'intro';
    dataQuality = 0;
    variableAccuracy = 0;
    headerText = HEADERS[roomType];

    switch (roomType) {
      case 'room1':
        runTestSelection();
        break;
      case 'room2':
        runVariableId();
        break;
      case 'room3':
        runTrainingZones();
        break;
      case 'room4':
        runPrediction();
        break;
    }
  };

  const runTestSelection = () => {
    phase = 'challenge';
    say(
      `${sport.athleteProfile} Goal: ${sport.goal}`,
      undefined,
      () => {
        ask('Which test should we use to assess this athlete?', sport.tests, t => t.name, (chosen) => {
          dataQuality = chosen.dataQuality;
          variableAccuracy = chosen.correct ? 1 : 0.3;

          const text = chosen.correct
            ? `Good choice! ${chosen.description}`
            : `Not ideal. ${chosen.description} This isn't the best match for the athlete's needs.`;
          giveFeedback(chosen.correct, text, () => {
            say(sport.testInsight, undefined, completeRoom);
          });
        });
      }
    );
  };

  const runVariableId = () => {
    phase = 'challenge';
    say(
      `Test data: ${sport.dataOutput}`,
      undefined,
      () => {
        pickSeveral(
          sport.variables,
          'key variable',
          v => v.name,
          v => (v.correct ? `Correct! ${v.explanation}` : `Not quite. ${v.explanation}`),
          (correctCount, total) => {
            variableAccuracy = correctCount / Math.max(1, total);
            dataQuality = variableAccuracy > 0.5 ? 0.8 : 0.5;
            say(sport.variableInsight, undefined, completeRoom);
          }
        );
      }
    );
  };

  const runTrainingZones = () => {
    phase = 'challenge';
    say(
      'Based on the test data, which training zones should we prescribe?',
      undefined,
      () => {
        pickSeveral(
          sport.zones,
          'training zone',
          z => z.name,
          z => (z.correct ? `Good call! ${z.description}` : `Not the priority. ${z.description}`),
          (correctCount, total) => {
            variableAccuracy = correctCount / Math.max(1, total);
            dataQuality = variableAccuracy > 0.5 ? 0.85 : 0.5;
            say(sport.zoneInsight, undefined, completeRoom);
          }
        );
      }
    );
  };

  const runPrediction = () => {
    phase = 'challenge';
    say(
      sport.predictionScenario,
      undefined,
      () => {
        ask('What adaptation do you predict?', sport.predictions, p => p.text, (chosen) => {
          variableAccuracy = chosen.correct ? 1 : 0.2;
          dataQuality = chosen.correct ? 0.9 : 0.5;

          const lead = chosen.correct ? 'Excellent prediction!' : 'Not the most likely outcome.';
          giveFeedback(chosen.correct, `${lead} ${sport.predictionInsight}`, completeRoom);
        });
      }
    );
  };

  const completeRoom = () => {
    phase = 'complete';
    gameState.roomProgress[roomKey] = true;

    const statValue = calcStat(dataQuality, variableAccuracy);
    gameState.challengeResults.push({ dataQuality, variableAccuracy });

    const statKey = ROOM_STAT[roomKey];
    const label = statKey.toUpperCase();
    const previous = gameState.playerStats[statKey];
    // A replay can only raise the stat, never lower it
    const best = wasComplete ? Math.max(previous, statValue) : statValue;
    gameState.playerStats[statKey] = best;

    let message: string;
    if (!wasComplete) {
      // This room is recorded, so nextRoom is what is left: the room to do next, or nothing, which opens the arena
      const next = nextRoom(gameState);
      const what = next
        ? `Next up: the ${ROOM_LABEL[next]} room. You can replay any room to raise its score.`
        : 'All four rooms are done: the ARENA is open!';
      message = `Room complete! Your ${label} stat is now ${percent(statValue)}%. ${what}`;
    } else if (percent(statValue) > percent(previous)) {
      message = `New best! ${label} now ${percent(best)}%`;
    } else {
      message = `Your best stays at ${percent(best)}%`;
    }

    say(message, undefined, finish, { exitLabel: '' }); // B just finishes here, like A
  };

  return {
    onEnter() {
      // Room type set externally before switching scene
    },

    update(dt: number) {
      const inp = input.read();

      // Pause menu
      if (pauseMenu.handle(dt, inp)) return;

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

      // Header in bordered panel, the same height in every room: text sits 2px clear of the inner border
      const headerW = measureText(headerText) - 1; // drop the trailing letter gap
      const panelW = headerW + 16;
      const panelX = Math.floor((GAME_W - panelW) / 2);
      drawPokemonBox(ctx, panelX, HEADER_Y, panelW, HEADER_H, pal.colors[1]);
      drawText(ctx, headerText, panelX + 8, HEADER_Y + 6, '#080808');

      // Sport name on a dark plate so it reads over any room background
      const sportW = measureText(sport.sport) - 1;
      const plateW = sportW + 12;
      const plateX = Math.floor((GAME_W - plateW) / 2);
      const plateY = HEADER_Y + HEADER_H + 2;
      ctx.fillStyle = '#080808';
      ctx.fillRect(plateX, plateY, plateW, 11);
      ctx.fillStyle = pal.colors[1];
      ctx.fillRect(plateX + 1, plateY + 1, plateW - 2, 9);
      drawText(ctx, sport.sport, plateX + 6, plateY + 2, '#f8f8f0');

      // Render dialogue
      dialogue.render(ctx);

      // Pause overlay
      pauseMenu.render(ctx);
    },

    setRoom(room: string) {
      startRoom(room);
    },
  };
};
