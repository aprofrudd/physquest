import type { Scene } from '../engine/GameLoop';
import type { Input } from '../engine/Input';
import type { SceneManager } from '../engine/SceneManager';
import {
  MEET_MAP,
  ROOM_KEYS,
  ROOM_LABEL,
  ROOM_STAT,
  allRoomsComplete,
  athleteMet,
  doorLabel,
  meetOf,
  nextDoor,
  roomKeyForMap,
  roomUnlocked,
  roomsCompleted,
  roomsTotal,
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
  drawMapBanner,
  drawObjectivesPanel,
  drawRoomsBadge,
  drawSelectHint,
  drawTalkPrompt,
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
import { meetContentFor } from '../rooms/content';
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
): Scene & { showRoom(mapId: string): void } => {
  let currentMapId = 'hub';
  let currentMap: MapData = ALL_MAPS['hub']!;
  let bannerTimer = 0;
  let banner: Banner | null = null;
  let aBuffer = 0;
  let panelOpen = false;
  let fade: Fade | null = null;
  let roomClock = 0; // seconds, for the room's animated details; stops while paused
  // Cues that teach the controls and go away once used, for the rest of the session
  let metHubAthlete = false; // the hub athlete's "!" stays until the first chat with it
  let panelSeen = false; // the SELECT hint stays until the objectives panel has been opened
  const arenaNoted = new Set<number>(); // levels whose "arena is open" banner has shown
  // Welcomes already offered this session, keyed by the level's progress object (a new game makes new ones)
  const welcomeOffered = new WeakSet<object>();
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
    announce(withBanner && toDo ? `${ended} ${input.fill(TALK_HINT)}` : described);
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
    startTransition(() => applyMap('hub', hubSpawn(door), false)); // the hub banner only greets a fresh start
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
      `THIS ROOM IS COMPLETE (BEST ${best}%). REPLAY IT TO RAISE YOUR SCORE?`,
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
        refuseDoor(`FINISH THE ${prev ? ROOM_LABEL[prev] : doorLabel(MEET_MAP)} ROOM FIRST.`);
      } else if (gameState.roomProgress[roomKey]) {
        promptReplay(roomKey, target);
      } else {
        enterRoomMap(target);
      }
      return;
    }

    if (standing.type === 'bossDoor' && isHub()) {
      if (allRoomsComplete(gameState)) {
        goThrough('boss', onEnterBoss);
      } else {
        const next = nextDoor(gameState);
        const nextLine = next !== 'boss' ? ` NEXT: THE ${doorLabel(next)} ROOM.` : '';
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
    dialogue.showSequence([...content.directorWelcome], heard, () => {});
  };

  /** Talking to the Director: the welcome if it has not been given, else a reminder, or once the athlete is met the after lines. */
  const talkToDirector = () => {
    const content = meetContentFor(gameState.currentLevel);
    if (!content) return;
    sfx.play('select');
    if (!meetOf(gameState).welcomed) welcome();
    else {
      faceDirector();
      dialogue.showSequence([...(athleteMet(gameState) ? content.directorAfter : content.directorReminder)]);
    }
  };

  const interact = () => {
    const hit = checkInteraction(gameState, currentMap);
    if ((hit.type !== 'npc' && hit.type !== 'equipment') || !hit.dialogueKey) return;

    if (hit.type === 'npc' && isHub() && hit.dialogueKey === DIRECTOR_KEY) {
      talkToDirector();
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
    dialogue.showSequence(lines);
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
      applyMap('hub', hubSpawn(door), door === null && !allRoomsComplete(gameState) && !welcoming);
      if (welcoming) welcome();
      // The first time the hub is seen with every room done (per level), say the arena is open. The banner
      // goes at the top, over the north sign plates: clear of the arrow and the player.
      if (allRoomsComplete(gameState) && !arenaNoted.has(gameState.currentLevel)) {
        arenaNoted.add(gameState.currentLevel);
        showBanner(ARENA_BANNER, 'signs', BANNER_TIME_LONG);
        announce(ARENA_BANNER.join(' '));
      }
    },

    onExit() {
      dialogue.reset();
      fade = null;
      panelOpen = false;
    },

    update(dt: number) {
      const inp = input.read();

      // START closes the objectives panel instead of opening the pause menu
      if (panelOpen && !pauseMenu.isActive() && inp.startPressed) {
        closePanel();
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

      // The world is frozen while the objectives panel is open
      if (panelOpen) {
        movement.update(dt, inp, gameState, tiles, true);
        if (inp.aPressed || inp.bPressed || inp.selectPressed) closePanel();
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
        const door = nextDoor(gameState);
        const front = hubSpawn(door); // the tile just outside the door
        const inFront =
          door !== 'boss' && Math.round(gameState.playerPos.x) === front.x && Math.round(gameState.playerPos.y) === front.y;
        if (!inFront) drawDoorArrow(ctx, door);
      }

      // What the idle player is facing (and could talk to)
      const idle = !movement.isMoving() && !dialogue.isActive() && !panelOpen && !fade;
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
          if (!meetOf(gameState).welcomed) drawAlertBubble(ctx, npc.x, npc.y); // until the welcome has been heard
        } else if (!metHubAthlete) {
          drawAlertBubble(ctx, npc.x, npc.y); // the hub athlete, until the first chat
        }
      }
      if (prompt) drawTalkPrompt(ctx, prompt.x, prompt.y, gameState.playerPos.x, gameState.playerPos.y);

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

      dialogue.render(ctx);

      if (fade) {
        const t = Math.min(1, fade.timer / FADE_TIME);
        ctx.fillStyle = `rgba(0, 0, 0, ${fade.phase === 'out' ? t : 1 - t})`;
        ctx.fillRect(0, 0, GAME_W, GAME_H);
      }

      pauseMenu.render(ctx);
    },

    /** Tests: stand in a room (at its spawn), skipping the hub and the doors. */
    showRoom(mapId: string) {
      dialogue.reset();
      fade = null;
      panelOpen = false;
      applyMap(mapId, mapId === 'hub' ? HUB_START : ROOM_SPAWN, false);
    },
  };
};
