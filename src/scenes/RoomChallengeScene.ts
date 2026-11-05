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
import { ambientTime } from '../render/motion';
import { mapFor } from '../data/rooms';
import { LEVEL_DATA, type SportData } from '../data/sports';
import { instrumentFor } from '../rooms';
import type { RoomHost, RoomInstrument, RoomResult } from '../rooms/types';
import {
  allRoomsComplete,
  calcStat,
  doorLabel,
  MEET_MAP,
  meetOf,
  testGivesFile,
  nextDoor,
  nextStop,
  roomKeyForMap,
  ROOM_MAP,
  ROOM_STAT,
} from '../state/GameState';
import { DIRECTOR_SPEAKER } from '../data/speakers';
import { sfx } from '../audio/Sfx';
import { SCORE_LABEL } from '../systems/SupportScores';

type ChallengePhase = 'intro' | 'challenge' | 'feedback' | 'complete';
type RoomType = 'room1' | 'room2' | 'room3' | 'room4' | 'meet';

const HEADERS: Record<RoomType, string> = {
  meet: 'ATHLETE OVERVIEW',
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
): Scene & { setRoom(room: string): void; debug(): unknown; inProgress(): boolean } => {
  let phase: ChallengePhase = 'intro';
  let roomType: RoomType = 'room1';
  let roomKey: RoomKey | null = 'testSelection'; // null in the ATHLETE room, which raises no stat
  let wasComplete = false; // finished before this visit: a replay can only raise the stat
  let sport: SportData = LEVEL_DATA[0]!;
  let dataQuality = 0;
  let variableAccuracy = 0;
  let overview: { good: number; of: number } | null = null; // the ATHLETE room's result
  let testing: RoomResult['testing'] | null = null; // the Testing Lab's test and test-day call, for the Director
  let headerText = '';
  let instrument: RoomInstrument | null = null; // a redesigned room runs the challenge instead of the lists below
  let clock = 0; // seconds since the room opened, for the background's animation
  const rulesRead = new Set<string>(); // `${level}:${room}` whose full rules have been read this session (short rules after)

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

  /** What a redesigned room is given to run the challenge (see rooms/types.ts). */
  const makeHost = (): RoomHost => {
    let done = false;
    const seenKey = `${gameState.currentLevel}:${roomType}`;
    return {
      sport,
      level: gameState.currentLevel,
      input,
      dialogue,
      // A speaker on its own (or any option without exitLabel) keeps the room's QUIT hint
      say: (text, choices, onDone, options) => say(text, choices, onDone, options ? { exitLabel: 'QUIT', ...options } : undefined),
      sayAll: (texts, onDone, options = { exitLabel: 'QUIT' }) =>
        dialogue.showSequence(texts, onDone, leave, { exitLabel: 'QUIT', ...options }),
      quit: leave,
      complete: (result: RoomResult) => {
        if (done) return;
        done = true;
        dataQuality = result.dataQuality;
        variableAccuracy = result.variableAccuracy;
        overview = result.overview ?? null;
        testing = result.testing ?? null;
        if (roomType === MEET_MAP) completeMeet();
        else completeRoom();
      },
      firstVisit: !rulesRead.has(seenKey),
      rulesRead: () => {
        rulesRead.add(seenKey);
      },
      replay: wasComplete,
      tests: [...meetOf(gameState).tests],
    };
  };

  const startRoom = (room: string) => {
    const key = roomKeyForMap(room);
    const meet = room === MEET_MAP;
    if (!key && !meet) {
      sceneManager.switchTo('overworld');
      return;
    }
    roomKey = key;
    roomType = key ? ROOM_MAP[key] : MEET_MAP;
    wasComplete = key ? gameState.roomProgress[key] : meetOf(gameState).met;
    sport = LEVEL_DATA[gameState.currentLevel] ?? LEVEL_DATA[0]!;
    phase = 'intro';
    dataQuality = 0;
    variableAccuracy = 0;
    overview = null;
    testing = null;
    headerText = HEADERS[roomType];
    clock = 0;
    instrument = null;

    const make = instrumentFor(roomType, gameState.currentLevel);
    if (make) {
      phase = 'challenge';
      instrument = make(makeHost());
      return;
    }
    if (meet) {
      // The ATHLETE room only exists in a visit that plays the redesigned rooms, so this is never reached in play
      sceneManager.switchTo('overworld');
      return;
    }

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

  /** What to do next, once this room is recorded: the next door, or the arena. */
  const nextLine = (): string => {
    // In a visit with the ATHLETE room, the Performance Director talks each room over before the next one opens
    if (nextStop(gameState) === 'director') return `Next: talk to ${DIRECTOR_SPEAKER.name} in the hub.`;
    const next = nextDoor(gameState);
    if (next === 'boss' || allRoomsComplete(gameState)) {
      // classic visits keep their old wording; a level with an ATHLETE room has five rooms
      return gameState.meetRoom ? 'Every room is done: the ARENA is open!' : 'All four rooms are done: the ARENA is open!';
    }
    return `Next up: the ${doorLabel(next)} room. You can replay any room to raise its score.`;
  };

  /** The ATHLETE room: the athlete is met (TESTING opens) and the best overview is kept. No stat changes. */
  const completeMeet = () => {
    phase = 'complete';
    const record = meetOf(gameState);
    const good = overview?.good ?? 0;
    const of = overview?.of ?? 0;
    const firstTime = !record.met;
    const better = firstTime || good > record.best || record.of === 0; // of 0: met before overviews were scored
    record.met = true;
    if (better) {
      record.best = good;
      record.of = of;
    }
    let message: string;
    if (firstTime) message = `Room complete! Your athlete overview: ${good}/${of}. ${nextLine()}`;
    else if (better) message = `New best! Overview now ${good}/${of}.`;
    else message = `Your best overview stays at ${record.best}/${record.of}.`;
    say(message, undefined, finish, { exitLabel: '' });
  };

  const completeRoom = () => {
    if (!roomKey) return;
    phase = 'complete';
    gameState.roomProgress[roomKey] = true;
    const meet = meetOf(gameState);
    if (!gameState.meetRoom) meet.heard[roomKey] = true; // no Director in this visit: nothing to talk over later
    if (testing) {
      // The latest battery is the one the Director talks over and the Data Lab works on. A battery that gives the
      // Data Lab no file, or the first one after such a battery, gets its check-in again (the send-back, the re-test)
      const level = gameState.currentLevel;
      const gaveFile = (tests: readonly string[]) => tests.some(t => testGivesFile(level, t));
      const again = gameState.meetRoom && wasComplete && (!gaveFile(testing.tests) || (meet.tests.length > 0 && !gaveFile(meet.tests)));
      meet.tests = [...testing.tests];
      meet.call = testing.call;
      if (again) meet.heard.testSelection = false;
    }

    const statValue = calcStat(dataQuality, variableAccuracy);
    gameState.challengeResults.push({ dataQuality, variableAccuracy });

    const statKey = ROOM_STAT[roomKey];
    const label = SCORE_LABEL[statKey]; // what the player sees: the score grades their work in this room
    const previous = gameState.playerStats[statKey];
    // A replay can only raise the stat, never lower it
    const best = wasComplete ? Math.max(previous, statValue) : statValue;
    gameState.playerStats[statKey] = best;

    let message: string;
    if (!wasComplete) {
      // This room is recorded, so the next door is what is left: the room to do next, or the arena
      message = `Room complete! Your ${label} score is now ${percent(statValue)}%. ${nextLine()}`;
    } else if (percent(statValue) > percent(previous)) {
      message = `New best! ${label} now ${percent(best)}%`;
    } else {
      message = `Your best ${label} score stays at ${percent(best)}%`;
    }

    say(message, undefined, finish, { exitLabel: '' }); // B just finishes here, like A
  };

  return {
    onEnter() {
      // Room type set externally before switching scene
    },

    onExit() {
      instrument = null;
    },

    update(dt: number) {
      const inp = input.read();

      // Pause menu
      if (pauseMenu.handle(dt, inp)) return;
      clock += dt;

      // The press that closes a line is used up by it: the instrument only acts when the box is idle
      const busy = dialogue.isActive();
      dialogue.update(dt, inp);
      instrument?.update(dt, inp, busy || dialogue.isActive());
    },

    render(ctx: CanvasRenderingContext2D) {
      // The room itself, dimmed, behind the challenge
      const mapData = mapFor(roomType, gameState.currentLevel);
      const palId = mapData?.palette ?? 'lab';
      const pal = PALETTES[palId];
      if (mapData) {
        renderTileMap(ctx, mapData.tiles, palId, 0, 0, GAME_W, GAME_H, mapData.npcFloor);
        mapData.life?.(ctx, ambientTime(clock), sport);
        // Dim overlay
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fillRect(0, 0, GAME_W, GAME_H);
        // A redesigned room's wall art is busy: behind the plates it is darkened further, so no half-letters show
        if (instrument) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
          ctx.fillRect(0, 0, GAME_W, 38);
        }
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

      // A redesigned room draws its instrument between the plates and the dialogue box
      instrument?.render(ctx);

      // Render dialogue
      dialogue.render(ctx);

      // Pause overlay
      pauseMenu.render(ctx);
    },

    setRoom(room: string) {
      startRoom(room);
    },

    debug() {
      return instrument?.debug?.() ?? null;
    },

    /** The room is not finished yet: leaving now would lose what was done in it. */
    inProgress() {
      return phase !== 'complete';
    },
  };
};
