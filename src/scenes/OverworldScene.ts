import type { Scene } from '../engine/GameLoop';
import type { Input } from '../engine/Input';
import type { SceneManager } from '../engine/SceneManager';
import {
  MEET_MAP,
  ROOM_KEYS,
  ROOM_LABEL,
  ROOM_STAT,
  allRoomsComplete,
  arenaOpen,
  athleteMet,
  checkInDue,
  doorLabel,
  meetOf,
  nextStop,
  roomKeyForMap,
  roomUnlocked,
  roomsCompleted,
  roomsTotal,
  waitingOnDirector,
  retestDue,
  type CheckInKey,
  type GameState,
  type HubExit,
  type RoomKey,
} from '../state/GameState';
import type { DialogueSystem } from '../systems/Dialogue';
import type { Movement } from '../systems/Movement';
import type { PauseMenu } from '../systems/PauseMenu';
import { renderTileMap, TILE_SIZE } from '../render/TileMap';
import { drawSprite } from '../render/SpriteSheet';
import { GAME_W, GAME_H, type DialogueOptions } from '../render/DialogueBox';
import {
  drawAlertBubble,
  drawDoneStar,
  drawDoorArrow,
  drawHubLabels,
  drawNpcArrow,
  drawMapBanner,
  drawObjectivesPanel,
  drawRoomsBadge,
  drawSelectHint,
  drawTalkPrompt,
  drawTalkPromptBeside,
  levelLine,
  objectivesSummary,
  type BannerSpot,
} from '../render/OverworldHud';
import { ALL_MAPS, HUB_RETURN, HUB_START, ROOM_SPAWN, type MapData, type Spawn } from '../data/maps';
import { mapFor } from '../data/rooms';
import { LEVEL_DATA } from '../data/sports';
import { ambientTime, prefersReducedMotion } from '../render/motion';
import { DIALOGUES } from '../data/dialogue';
import { athleteColorsFor, athleteSpriteFor, getCoachSprite, getDirectorSprite, SPRITE_COLORS } from '../data/sprites';
import { DIRECTOR_KEY, MEET_RETURN } from '../data/meetDoor';
import { BOARD_KEY } from '../data/supportBoard';
import { boardSummary, drawBoardPanel, drawWallBoard } from '../render/SupportBoard';
import { boardContentFor } from '../rooms/content/board-running';
import { SCORE_LABEL } from '../systems/SupportScores';
import { athleteSpeaker, DIRECTOR_SPEAKER } from '../data/speakers';
import { meetContentFor } from '../rooms/content';
import type { NeedsQuestion } from '../rooms/content/meet-types';
import { checkInLines, checkInNext, directorAgain } from '../systems/CheckIns';
import type { TalkPart } from '../systems/Finale';
import { finaleContentFor } from '../rooms/content/finale-running';
import { saveGame } from '../systems/SaveSystem';
import { checkInteraction, checkStandingOnDoor, findOpenNeighbour } from '../systems/Collision';
import { PALETTES } from '../render/Palettes';
import { sfx } from '../audio/Sfx';
import { announce } from '../ui/announce';

const FADE_TIME = 0.15; // seconds to black, then again back in
const EPS = 1e-4;
const BANNER_TIME = 2;
const BANNER_TIME_LONG = BANNER_TIME + 1; // a banner that says what to do (or brings news) stays up a second longer
const BANNER_FADE = 0.4;
const A_BUFFER = 0.25; // an A press while stepping is kept this long and used when the step ends

const HUB_DOORS: readonly HubExit[] = ['meet', 'room1', 'room2', 'room3', 'room4', 'boss'];
const asHubDoor = (target: string): HubExit | null => HUB_DOORS.find(d => d === target) ?? null;

// Banner lines name buttons as tokens; they are filled in for the player's device when the banner is drawn
const TALK_HINT = '{A}: TALK TO THE ATHLETE'; // third line of a room's banner while its challenge is open
const ARENA_BANNER = ['THE ARENA IS OPEN!', 'BEAT THE RIVAL TO CLEAR THE LEVEL'];

// Notices that only need an OK: the B part of the hint is left off, B still closes them
const NOTICE: DialogueOptions = { nextLabel: 'OK', exitLabel: '' };

interface Banner {
  lines: string[];
  where: BannerSpot;
}

interface Fade {
  phase: 'out' | 'in';
  timer: number;
  apply: () => void; // runs at full black
}

export const createOverworldScene = (
  input: Input,
  sceneManager: SceneManager,
  gameState: GameState,
  dialogue: DialogueSystem,
  movement: Movement,
  onEnterRoom: (roomId: string) => void,
  onEnterBoss: () => void,
  pauseMenu: PauseMenu,
): Scene & { showRoom(mapId: string): void; queueTalk(parts: TalkPart[]): void } => {
  let currentMapId = 'hub';
  let queuedTalk: TalkPart[] | null = null; // the case study's ending, played on the next hub entry (systems/Finale.ts)
  let currentMap: MapData = ALL_MAPS['hub']!;
  let bannerTimer = 0;
  let banner: Banner | null = null;
  let aBuffer = 0;
  let panelOpen = false;
  let boardOpen = false; // the SUPPORT BOARD's panel (the Director's hub only)
  let hasBoard = false; // this map has the board on its wall
  let fade: Fade | null = null;
  let roomClock = 0; // seconds, for the room's animated details; stops while paused
  // Cues that teach the controls and go away once used, for the rest of the session
  let metHubAthlete = false; // the hub athlete's "!" stays until the first chat with it
  let panelSeen = false; // the SELECT hint stays until the objectives panel has been opened
  const arenaNoted = new Set<number>(); // levels whose "arena is open" banner has shown
  // Welcomes already offered this session, keyed by the level's progress object (a new game makes new ones)
  const welcomeOffered = new WeakSet<object>();
  // The needs chat and check-ins already started by themselves this session, the same way (after that, by talking)
  const talksOffered = new WeakMap<object, Set<CheckInKey>>();
  let directorDir: 'up' | 'down' | 'left' | 'right' = 'down'; // the Director turns to whoever they are talking to

  /** Turn the Director toward the player (the larger of the two gaps decides; ties face down/up). */
  const faceDirector = () => {
    const npc = currentMap.npcs.find(n => n.dialogueKey === DIRECTOR_KEY);
    if (!npc) return;
    const dx = gameState.playerPos.x - npc.x;
    const dy = gameState.playerPos.y - npc.y;
    directorDir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
  };

  const isHub = () => currentMapId === 'hub';

  const showBanner = (lines: string[], where: Banner['where'], seconds = BANNER_TIME) => {
    banner = { lines, where };
    bannerTimer = seconds;
  };

  const sport = () => LEVEL_DATA[gameState.currentLevel] ?? LEVEL_DATA[0]!;

  const applyMap = (mapId: string, spawn: Spawn, withBanner = true) => {
    const map = mapFor(mapId, gameState.currentLevel);
    if (!map) return;
    currentMapId = mapId;
    currentMap = map;
    hasBoard = map.equipment.some(e => e.dialogueKey === BOARD_KEY);
    gameState.playerPos.x = spawn.x;
    gameState.playerPos.y = spawn.y;
    gameState.playerDir = spawn.dir;
    movement.reset(gameState); // a key held through the door must not carry into the new map
    aBuffer = 0;
    bannerTimer = 0;
    // A room whose challenge is still open also says how to start it
    const roomKey = roomKeyForMap(mapId);
    const toDo = roomKey !== null ? !gameState.roomProgress[roomKey] : mapId === MEET_MAP && !meetOf(gameState).met;
    if (withBanner) {
      const lines = [map.name, levelLine(gameState)];
      if (toDo) lines.push(TALK_HINT);
      showBanner(lines, mapId === 'hub' ? 'bottom' : 'top', toDo ? BANNER_TIME_LONG : BANNER_TIME);
    }
    const described = map.describe ? `${map.name}. ${map.describe}` : map.name;
    const ended = /[.!?]$/.test(described) ? described : `${described}.`;
    if (withBanner && toDo) announce(`${ended} ${input.fill(TALK_HINT)}`);
    else if (mapId === 'hub' && checkInDue(gameState)) announce(`${ended} Next: talk to ${DIRECTOR_SPEAKER.name}.`);
    else announce(described);
  };

  const hubSpawn = (door: HubExit | null): Spawn => (door === 'meet' ? MEET_RETURN : door ? HUB_RETURN[door] : HUB_START);

  const say = (
    text: string,
    choices?: string[],
    onComplete?: (choice?: number) => void,
    onCancel?: () => void,
    options?: DialogueOptions,
  ) => {
    announce(text);
    dialogue.show(text, choices, onComplete, onCancel, options);
  };

  const startTransition = (apply: () => void) => {
    if (fade) return;
    sfx.play('door');
    fade = { phase: 'out', timer: 0, apply };
  };

  /** Fade through a hub door; remembers which door so the hub puts the player back outside it. */
  const goThrough = (door: HubExit, apply: () => void) => {
    gameState.returnDoor = door;
    startTransition(apply);
  };

  const enterRoomMap = (roomId: string) => {
    const door = asHubDoor(roomId);
    if (door) goThrough(door, () => applyMap(roomId, ROOM_SPAWN));
  };

  const leaveRoom = () => {
    // The door we came in by is the one we leave by; returnDoor covers a scene re-entered mid-room
    const door = asHubDoor(currentMapId) ?? gameState.returnDoor;
    startTransition(() => {
      applyMap('hub', hubSpawn(door), false); // the hub banner only greets a fresh start
      offerDueTalk();
    });
  };

  /** Put the player back on the tile they stepped onto the door from (never a fixed offset). */
  const stepBack = () => {
    const px = Math.round(gameState.playerPos.x);
    const py = Math.round(gameState.playerPos.y);
    const target = movement.stepOrigin() ?? findOpenNeighbour(currentMap.tiles, px, py);
    if (target) movement.forceStep(gameState, target.x, target.y);
  };

  /** A door that stays shut: the reason, then back off the door (after A or B). */
  const refuseDoor = (text: string) => {
    sfx.play('wrong');
    say(text, undefined, stepBack, undefined, NOTICE);
  };

  const promptReplay = (roomKey: RoomKey, roomId: string) => {
    const best = Math.round(gameState.playerStats[ROOM_STAT[roomKey]] * 100);
    say(
      `THIS ROOM IS COMPLETE (BEST ${SCORE_LABEL[ROOM_STAT[roomKey]]} ${best}%). REPLAY IT TO RAISE YOUR SCORE?`,
      ['YES', 'NO'],
      choice => {
        if (choice === 0) enterRoomMap(roomId);
        else stepBack();
      },
      stepBack, // B: same as NO
      { exitLabel: 'NO' },
    );
  };

  /** The ATHLETE room, once the athlete has been met: a chat again can only raise the best overview. */
  const promptReplayMeet = () => {
    const meet = meetOf(gameState);
    say(
      !meet.of
        ? 'YOU HAVE MET THE ATHLETE. CHAT AGAIN?' // met in an older save, before overviews were scored
        : `YOU HAVE MET THE ATHLETE (BEST OVERVIEW ${meet.best}/${meet.of}). ${meet.best >= meet.of ? 'CHAT AGAIN?' : 'CHAT AGAIN TO RAISE IT?'}`,
      ['YES', 'NO'],
      choice => {
        if (choice === 0) enterRoomMap(MEET_MAP);
        else stepBack();
      },
      stepBack, // B: same as NO
      { exitLabel: 'NO' },
    );
  };

  const handleArrival = () => {
    const standing = checkStandingOnDoor(gameState, currentMap);
    const target = standing.target;
    if (!target) return;

    if (standing.type === 'door') {
      if (target === 'hub') {
        if (!isHub()) leaveRoom();
        return;
      }
      if (!isHub()) return;
      if (target === MEET_MAP) {
        if (meetOf(gameState).met) promptReplayMeet();
        else enterRoomMap(MEET_MAP);
        return;
      }
      const roomKey = roomKeyForMap(target);
      if (!roomKey) return;
      // rooms are taken in order: finish the one before first (the ATHLETE room before TESTING)
      const prev = ROOM_KEYS[ROOM_KEYS.indexOf(roomKey) - 1];
      if (!roomUnlocked(gameState, roomKey)) {
        const content = meetContentFor(gameState.currentLevel);
        if (content && waitingOnDirector(gameState, roomKey)) refuseDoor(content.checkIns.doorRefusal);
        else if (content && retestDue(gameState)) refuseDoor(content.checkIns.retestRefusal); // the battery gave no file
        else refuseDoor(`FINISH THE ${prev ? ROOM_LABEL[prev] : doorLabel(MEET_MAP)} ROOM FIRST.`);
      } else if (gameState.roomProgress[roomKey]) {
        promptReplay(roomKey, target);
      } else {
        enterRoomMap(target);
      }
      return;
    }

    if (standing.type === 'bossDoor' && isHub()) {
      const content = meetContentFor(gameState.currentLevel);
      if (arenaOpen(gameState)) {
        goThrough('boss', onEnterBoss);
      } else if (allRoomsComplete(gameState) && content) {
        // the last check-in opens it (after a battery with no Data Lab file: the re-test, then its check-in)
        refuseDoor(retestDue(gameState) && !checkInDue(gameState) ? content.checkIns.retestRefusal : content.checkIns.doorRefusal);
      } else {
        const next = nextStop(gameState);
        const nextLine =
          next === 'director'
            ? ` NEXT: TALK TO ${DIRECTOR_SPEAKER.name.toUpperCase()}.`
            : next !== 'boss'
              ? ` NEXT: THE ${doorLabel(next)} ROOM.`
              : '';
        const total = roomsTotal(gameState);
        refuseDoor(`THE ARENA OPENS WHEN ALL ${total} ROOMS ARE DONE (${roomsCompleted(gameState)}/${total}).${nextLine}`);
      }
    }
  };

  /**
   * The Performance Director's welcome (by name). It is remembered in the save only once its last page has
   * been read: it carries the how-to-play pages, so a player who leaves it with B hears all of it again
   * when they next talk to the Director (it does not start by itself again this session).
   */
  const welcome = () => {
    const content = meetContentFor(gameState.currentLevel);
    if (!content) return;
    welcomeOffered.add(meetOf(gameState));
    faceDirector();
    const heard = () => {
      if (meetOf(gameState).welcomed) return;
      meetOf(gameState).welcomed = true;
      saveGame(gameState);
    };
    // The board's pages go just before the last one, which sends the player to the ATHLETE room
    const pages = [...content.directorWelcome];
    const board = boardContentFor(gameState.currentLevel);
    if (board && hasBoard) pages.splice(Math.max(0, pages.length - 1), 0, ...board.welcome);
    dialogue.showSequence(pages, heard, () => {}, { speaker: DIRECTOR_SPEAKER });
  };

  /** The Director's lines, on the Director's name tab. B leaves at once (onDone does not run). */
  const director = (pages: readonly string[], onDone?: () => void) => {
    dialogue.showSequence([...pages], onDone, () => {}, { speaker: DIRECTOR_SPEAKER });
  };

  /** Once the arena opens (after the last check-in), say so with its banner, once per level per session. */
  const noteArena = () => {
    if (!arenaOpen(gameState) || arenaNoted.has(gameState.currentLevel)) return;
    arenaNoted.add(gameState.currentLevel);
    showBanner(ARENA_BANNER, 'signs', BANNER_TIME_LONG);
    announce(ARENA_BANNER.join(' '));
  };

  /** A needs chat or check-in read to the end: remembered and saved (the next room opens). */
  const heard = (key: CheckInKey) => {
    const meet = meetOf(gameState);
    if (key === 'needs') meet.needs = true;
    else meet.heard[key] = true;
    saveGame(gameState);
    noteArena();
  };

  /** Fisher-Yates: the order in which to show `count` options (a fresh one each time the question is asked). */
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

  /**
   * The needs chat (Phase 2): the Director's opening, then each question with its answers shuffled and the reply to
   * the pick, then what they agree. Not scored. B leaves at any point and nothing is kept: it is given again in full.
   */
  const needsChat = () => {
    const content = meetContentFor(gameState.currentLevel);
    if (!content) return;
    const { intro, questions, agreed } = content.needs;
    const askFrom = (index: number) => {
      const question: NeedsQuestion | undefined = questions[index];
      if (!question) {
        director(agreed, () => heard('needs'));
        return;
      }
      const lead = question.ask.slice(0, -1);
      const prompt = question.ask[question.ask.length - 1] ?? '';
      const order = shuffledOrder(question.options.length);
      const ask = () =>
        dialogue.show(
          prompt,
          order.map(i => question.options[i]!.text),
          choice => {
            const picked = question.options[order[choice ?? 0] ?? 0];
            director(picked?.reply ?? [], () => askFrom(index + 1));
          },
          () => {},
          { speaker: DIRECTOR_SPEAKER },
        );
      if (lead.length > 0) director(lead, ask);
      else ask();
    };
    director(intro, () => askFrom(0));
  };

  /** The check-in (or needs chat) that is due now. */
  const startTalk = (key: CheckInKey) => {
    const content = meetContentFor(gameState.currentLevel);
    if (!content) return;
    faceDirector();
    if (key === 'needs') needsChat();
    else director(withBoardLine(checkInLines(content, gameState, key), key), () => heard(key));
  };

  /** A check-in, with the Director's line on the score the room just set before its "what next" lines. */
  const withBoardLine = (lines: string[], key: RoomKey): string[] => {
    const board = boardContentFor(gameState.currentLevel);
    const content = meetContentFor(gameState.currentLevel);
    if (!board || !content || !hasBoard) return lines;
    const line = board.checkIn[key].replace(/\{PCT\}/g, String(Math.round(gameState.playerStats[ROOM_STAT[key]] * 100)));
    const next = checkInNext(content, key, gameState).length;
    lines.splice(Math.max(0, lines.length - next), 0, line);
    return lines;
  };

  /**
   * Back in the hub with a talk due: it starts by itself, once per talk per session (B leaves it unheard; talking to
   * the Director gives it again). Returns true when it started.
   */
  const dueToOffer = (): CheckInKey | null => {
    const due = checkInDue(gameState);
    if (!due || !meetOf(gameState).welcomed || dialogue.isActive() || !meetContentFor(gameState.currentLevel)) return null;
    return talksOffered.get(meetOf(gameState))?.has(due) ? null : due;
  };
  const offerDueTalk = (): boolean => {
    const due = dueToOffer();
    if (!due) return false;
    const meet = meetOf(gameState);
    const offered = talksOffered.get(meet) ?? new Set<CheckInKey>();
    talksOffered.set(meet, offered);
    offered.add(due);
    startTalk(due);
    return true;
  };

  /**
   * Talking to the Director: the welcome if it has not been given; before the athlete is met, a reminder; then the
   * needs chat or the check-in that is due; with nothing due, the latest room's findings again and where to go next.
   */
  const talkToDirector = () => {
    const content = meetContentFor(gameState.currentLevel);
    if (!content) return;
    sfx.play('select');
    if (!meetOf(gameState).welcomed) {
      welcome();
      return;
    }
    faceDirector();
    if (!athleteMet(gameState)) {
      director(content.directorReminder);
      return;
    }
    const due = checkInDue(gameState);
    const finale = finaleContentFor(gameState.currentLevel);
    if (due) startTalk(due);
    else if (finale && gameState.bossDefeated[gameState.currentLevel]) director(finale.directorAfter); // the case is done
    else director(directorAgain(content, gameState));
  };

  /** The queued talk (the ending): each speaker's pages in turn. B leaves it at once; it is not offered again. */
  const playTalk = (parts: TalkPart[], index = 0, fromEnd = false) => {
    const part = parts[index];
    if (!part) return;
    if (part.speaker === DIRECTOR_SPEAKER) faceDirector();
    // LEFT on a part's first page goes back to the previous speaker's last page
    dialogue.showSequence([...part.pages], () => playTalk(parts, index + 1), () => {}, {
      speaker: part.speaker,
      onBack: index > 0 ? () => playTalk(parts, index - 1, true) : undefined,
      fromEnd,
    });
  };

  const interact = () => {
    const hit = checkInteraction(gameState, currentMap);
    if ((hit.type !== 'npc' && hit.type !== 'equipment') || !hit.dialogueKey) return;

    if (hit.type === 'npc' && isHub() && hit.dialogueKey === DIRECTOR_KEY) {
      talkToDirector();
      return;
    }

    if (hit.type === 'equipment' && hit.dialogueKey === BOARD_KEY) {
      openBoard();
      return;
    }

    // A room's athlete starts that room's challenge
    if (hit.type === 'npc' && !isHub()) {
      sfx.play('select');
      onEnterRoom(currentMapId);
      return;
    }

    // A room's own lines (they may use the level's data), else the shared scripts
    const own = currentMap.talk?.[hit.dialogueKey]?.(sport());
    const lines = own ?? DIALOGUES[hit.dialogueKey]?.map(l => l.text);
    if (!lines || lines.length === 0) return;
    if (hit.type === 'npc') metHubAthlete = true; // a room athlete never gets here: that was the challenge above
    // The hub athlete speaks (name tab); equipment lines are the game describing what is there
    dialogue.showSequence(lines, undefined, undefined, hit.type === 'npc' ? { speaker: athleteSpeaker(gameState.currentLevel) } : undefined);
  };

  const openPanel = () => {
    panelOpen = true;
    panelSeen = true;
    sfx.play('select');
    announce(objectivesSummary(gameState, input.label('select')));
  };

  const closePanel = () => {
    panelOpen = false;
    sfx.play('back');
    announce('Objectives closed.');
  };

  const boardNote = (): string => boardContentFor(gameState.currentLevel)?.note ?? '';

  const openBoard = () => {
    boardOpen = true;
    sfx.play('select');
    announce(boardSummary(gameState, boardContentFor(gameState.currentLevel)?.noteSpoken ?? '', input.label('a')));
  };

  const closeBoard = () => {
    boardOpen = false;
    sfx.play('back');
    announce('Support board closed.');
  };

  const updateFade = (dt: number) => {
    if (!fade) return;
    fade.timer += dt;
    if (fade.timer < FADE_TIME - EPS) return;
    if (fade.phase === 'out') {
      const { apply } = fade;
      fade = { phase: 'in', timer: 0, apply };
      apply();
    } else {
      fade = null;
    }
  };

  return {
    onEnter() {
      dialogue.reset();
      fade = null;
      panelOpen = false;
      boardOpen = false;
      if (gameState.resumeRoom) {
        // Back from a challenge the player walked away from (B): still in the room, where they stood
        gameState.resumeRoom = false;
        movement.reset(gameState);
        aBuffer = 0;
        bannerTimer = 0; // the room's banner was for walking in, not for coming back
        return;
      }
      // Back from a room or the arena: stand just outside that door, with no banner (it would sit under
      // the player). Otherwise a fresh level: start in the middle of the hub and greet it with the banner,
      // unless every room is already done: then the banner would sit on the arena arrow, the thing to look at.
      const door = gameState.returnDoor;
      // The first hub entry of a level with a Performance Director: the welcome starts at once (no banner under it)
      const welcoming =
        gameState.meetRoom &&
        !meetOf(gameState).welcomed &&
        !welcomeOffered.has(meetOf(gameState)) &&
        meetContentFor(gameState.currentLevel) !== undefined;
      directorDir = 'down';
      // Back with a needs chat or check-in due: it starts by itself (no banner under it either)
      const ending = queuedTalk;
      queuedTalk = null;
      const talking = !welcoming && !ending && dueToOffer() !== null;
      applyMap('hub', hubSpawn(door), door === null && !allRoomsComplete(gameState) && !welcoming && !talking && !ending);
      if (ending) playTalk(ending); // back from the race: the result, then the debrief
      else if (welcoming) welcome();
      else if (talking) offerDueTalk();
      // The first time the hub is seen with the arena open (per level), say so. The banner goes at the top, over
      // the north sign plates: clear of the arrow and the player.
      noteArena();
    },

    onExit() {
      dialogue.reset();
      fade = null;
      panelOpen = false;
      boardOpen = false;
    },

    update(dt: number) {
      const inp = input.read();

      // START closes the objectives panel (or the board) instead of opening the pause menu
      if ((panelOpen || boardOpen) && !pauseMenu.isActive() && inp.startPressed) {
        if (panelOpen) closePanel();
        else closeBoard();
        return;
      }
      if (pauseMenu.handle(dt, inp)) return;
      roomClock += dt;

      const tiles = currentMap.tiles;

      // Input is ignored during the fade, but we still note when the keys are let go
      if (fade) {
        movement.update(dt, inp, gameState, tiles, true);
        updateFade(dt);
        return;
      }

      // The world is frozen while the objectives panel or the board is open
      if (panelOpen) {
        movement.update(dt, inp, gameState, tiles, true);
        if (inp.aPressed || inp.bPressed || inp.selectPressed) closePanel();
        return;
      }
      if (boardOpen) {
        movement.update(dt, inp, gameState, tiles, true);
        if (inp.aPressed || inp.bPressed || inp.selectPressed) closeBoard();
        return;
      }

      if (bannerTimer > 0) bannerTimer -= dt;

      // The press that closes a dialogue is used up by it
      const dialogueWasActive = dialogue.isActive();
      dialogue.update(dt, inp);
      if (dialogueWasActive || dialogue.isActive()) {
        aBuffer = 0;
        movement.update(dt, inp, gameState, tiles, true);
        return;
      }

      if (aBuffer > 0) aBuffer = Math.max(0, aBuffer - dt);
      if (inp.aPressed) aBuffer = A_BUFFER;

      if (inp.selectPressed) {
        openPanel();
        return;
      }

      const moved = movement.update(dt, inp, gameState, tiles);
      if (moved.arrived) handleArrival();
      if (fade || dialogue.isActive()) return;

      if (aBuffer > 0 && !movement.isMoving()) {
        aBuffer = 0;
        interact();
      }
    },

    render(ctx: CanvasRenderingContext2D) {
      const pal = PALETTES[currentMap.palette];
      ctx.fillStyle = pal.colors[4];
      ctx.fillRect(0, 0, GAME_W, GAME_H);

      // Single screen, no scrolling
      renderTileMap(ctx, currentMap.tiles, currentMap.palette, 0, 0, GAME_W, GAME_H, currentMap.npcFloor);
      currentMap.life?.(ctx, ambientTime(roomClock), sport());
      if (hasBoard) drawWallBoard(ctx, gameState);

      // The label plates stay off while the objectives panel is open: the arena's would peek out below it
      if (isHub() && !panelOpen) drawHubLabels(ctx, gameState);

      // The banner sits under the characters so it never hides the player
      if (banner && bannerTimer > 0) {
        drawMapBanner(ctx, banner.lines.map(line => input.fill(line)), banner.where, bannerTimer / BANNER_FADE);
      }

      // The arrow to the next room's door (the arena's once every room is done) is drawn after the banner,
      // so nothing can hide it. It steps aside for a player standing right in front of that door, who would
      // only cover it and leave a stray pixel showing.
      if (isHub()) {
        const door = nextStop(gameState);
        const px = Math.round(gameState.playerPos.x);
        const py = Math.round(gameState.playerPos.y);
        if (door === 'director') {
          // Over the Director's head while a talk is due; it steps aside for a player already next to them
          const npc = currentMap.npcs.find(n => n.dialogueKey === DIRECTOR_KEY);
          if (npc && Math.abs(px - npc.x) + Math.abs(py - npc.y) > 1) drawNpcArrow(ctx, npc.x, npc.y);
        } else {
          const front = hubSpawn(door); // the tile just outside the door
          const inFront = door !== 'boss' && px === front.x && py === front.y;
          if (!inFront) drawDoorArrow(ctx, door);
        }
      }

      // What the idle player is facing (and could talk to)
      const idle = !movement.isMoving() && !dialogue.isActive() && !panelOpen && !boardOpen && !fade;
      const facing = idle ? checkInteraction(gameState, currentMap) : null;
      const prompt =
        facing && (facing.type === 'npc' || facing.type === 'equipment') && facing.dialogueKey
          ? { x: facing.x ?? 0, y: facing.y ?? 0 }
          : null;

      // NPCs breathe: 1px up for half a second, then back down
      const bob = !prefersReducedMotion() && Math.floor(Date.now() / 500) % 2 === 1 ? 1 : 0;
      const level = gameState.currentLevel;
      for (const npc of currentMap.npcs) {
        if (npc.dialogueKey === DIRECTOR_KEY) {
          drawSprite(ctx, getDirectorSprite(directorDir), npc.x * TILE_SIZE, npc.y * TILE_SIZE - bob, SPRITE_COLORS['npc_director']!);
        } else {
          drawSprite(ctx, athleteSpriteFor(level), npc.x * TILE_SIZE, npc.y * TILE_SIZE - bob, athleteColorsFor(level));
        }
      }

      // Player
      const frame = movement.getAnimFrame();
      const sprite = getCoachSprite(gameState.playerDir, gameState.playerMoving ? frame : 0);
      drawSprite(
        ctx,
        sprite,
        Math.round(gameState.playerPos.x * TILE_SIZE),
        Math.round(gameState.playerPos.y * TILE_SIZE),
        SPRITE_COLORS['default']!,
      );

      // Markers above characters. An athlete's "!" or star gives way to the "A" prompt while it is faced.
      const roomKey = roomKeyForMap(currentMapId);
      const inMeet = currentMapId === MEET_MAP;
      for (const npc of currentMap.npcs) {
        if (prompt && prompt.x === npc.x && prompt.y === npc.y) continue;
        if (roomKey || inMeet) {
          if (roomKey ? gameState.roomProgress[roomKey] : meetOf(gameState).met) drawDoneStar(ctx, npc.x, npc.y);
          else drawAlertBubble(ctx, npc.x, npc.y);
        } else if (npc.dialogueKey === DIRECTOR_KEY) {
          // until the welcome has been heard, and while a needs chat or check-in is due
          if (!meetOf(gameState).welcomed || checkInDue(gameState)) drawAlertBubble(ctx, npc.x, npc.y);
        } else if (!metHubAthlete) {
          drawAlertBubble(ctx, npc.x, npc.y); // the hub athlete, until the first chat
        }
      }
      if (prompt && prompt.y === 0) {
        // The board on the top wall: no room above it, so the bubble goes beside the player's head
        drawTalkPromptBeside(ctx, gameState.playerPos.x, gameState.playerPos.y);
      } else if (prompt) {
        drawTalkPrompt(ctx, prompt.x, prompt.y, gameState.playerPos.x, gameState.playerPos.y);
      }

      // Top right: the ROOMS badge, and beside it the SELECT hint until the panel has been opened. The arena
      // banner takes the place of both.
      const topBannerUp = bannerTimer > 0 && banner?.where === 'signs';
      if (isHub() && !panelOpen && !topBannerUp) {
        drawRoomsBadge(ctx, gameState);
        if (!panelSeen && !dialogue.isActive() && !pauseMenu.isActive()) {
          drawSelectHint(ctx, gameState, input.fill('{SELECT}: OBJECTIVES'));
        }
      }

      if (panelOpen) drawObjectivesPanel(ctx, gameState, input.fill('{SELECT}: CLOSE'));
      if (boardOpen) drawBoardPanel(ctx, gameState, boardNote(), input.fill('{A}: CLOSE'));

      dialogue.render(ctx);

      if (fade) {
        const t = Math.min(1, fade.timer / FADE_TIME);
        ctx.fillStyle = `rgba(0, 0, 0, ${fade.phase === 'out' ? t : 1 - t})`;
        ctx.fillRect(0, 0, GAME_W, GAME_H);
      }

      pauseMenu.render(ctx);
    },

    /** Play these lines on the next hub entry, before anything else (the case study's ending, after the race). */
    queueTalk(parts: TalkPart[]) {
      queuedTalk = parts.length > 0 ? parts : null;
    },

    /** Tests: stand in a room (at its spawn), skipping the hub and the doors. */
    showRoom(mapId: string) {
      dialogue.reset();
      fade = null;
      panelOpen = false;
      boardOpen = false;
      applyMap(mapId, mapId === 'hub' ? HUB_START : ROOM_SPAWN, false);
    },
  };
};
