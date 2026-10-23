import type { Scene } from '../engine/GameLoop';
import type { Input } from '../engine/Input';
import type { SceneManager } from '../engine/SceneManager';
import {
  ROOM_KEYS,
  ROOM_LABEL,
  ROOM_MAP,
  ROOM_STAT,
  allRoomsComplete,
  nextRoom,
  roomKeyForMap,
  roomUnlocked,
  roomsCompleted,
  type GameState,
  type HubDoor,
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
import { DIALOGUES } from '../data/dialogue';
import { getCoachSprite, NPC_SPRITE, SPRITE_COLORS } from '../data/sprites';
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

const HUB_DOORS: readonly HubDoor[] = ['room1', 'room2', 'room3', 'room4', 'boss'];
const asHubDoor = (target: string): HubDoor | null => HUB_DOORS.find(d => d === target) ?? null;

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
): Scene => {
  let currentMapId = 'hub';
  let currentMap: MapData = ALL_MAPS['hub']!;
  let bannerTimer = 0;
  let banner: Banner | null = null;
  let aBuffer = 0;
  let panelOpen = false;
  let fade: Fade | null = null;
  // Cues that teach the controls and go away once used, for the rest of the session
  let metHubAthlete = false; // the hub athlete's "!" stays until the first chat with it
  let panelSeen = false; // the SELECT hint stays until the objectives panel has been opened
  const arenaNoted = new Set<number>(); // levels whose "arena is open" banner has shown

  const isHub = () => currentMapId === 'hub';

  const showBanner = (lines: string[], where: Banner['where'], seconds = BANNER_TIME) => {
    banner = { lines, where };
    bannerTimer = seconds;
  };

  const applyMap = (mapId: string, spawn: Spawn, withBanner = true) => {
    const map = ALL_MAPS[mapId];
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
    const toDo = roomKey !== null && !gameState.roomProgress[roomKey];
    if (withBanner) {
      const lines = [map.name, levelLine(gameState)];
      if (toDo) lines.push(TALK_HINT);
      showBanner(lines, mapId === 'hub' ? 'bottom' : 'top', toDo ? BANNER_TIME_LONG : BANNER_TIME);
    }
    announce(withBanner && toDo ? `${map.name}. ${input.fill(TALK_HINT)}` : map.name);
  };

  const hubSpawn = (door: HubDoor | null): Spawn => (door ? HUB_RETURN[door] : HUB_START);

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
  const goThrough = (door: HubDoor, apply: () => void) => {
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
      const roomKey = roomKeyForMap(target);
      if (!roomKey) return;
      const prev = ROOM_KEYS[ROOM_KEYS.indexOf(roomKey) - 1]; // rooms are taken in order: finish this one first
      if (prev && !roomUnlocked(gameState, roomKey)) {
        refuseDoor(`FINISH THE ${ROOM_LABEL[prev]} ROOM FIRST.`);
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
        const next = nextRoom(gameState);
        const nextLine = next ? ` NEXT: THE ${ROOM_LABEL[next]} ROOM.` : '';
        refuseDoor(`THE ARENA OPENS WHEN ALL 4 ROOMS ARE DONE (${roomsCompleted(gameState)}/4).${nextLine}`);
      }
    }
  };

  const interact = () => {
    const hit = checkInteraction(gameState, currentMap);
    if ((hit.type !== 'npc' && hit.type !== 'equipment') || !hit.dialogueKey) return;

    // A room's athlete starts that room's challenge
    if (hit.type === 'npc' && !isHub()) {
      sfx.play('select');
      onEnterRoom(currentMapId);
      return;
    }

    const lines = DIALOGUES[hit.dialogueKey];
    if (!lines || lines.length === 0) return;
    if (hit.type === 'npc') metHubAthlete = true; // a room athlete never gets here: that was the challenge above
    dialogue.showSequence(lines.map(l => l.text));
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
      applyMap('hub', hubSpawn(door), door === null && !allRoomsComplete(gameState));
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
      renderTileMap(ctx, currentMap.tiles, currentMap.palette, 0, 0, GAME_W, GAME_H);

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
        const next = nextRoom(gameState);
        const door: HubDoor = next ? ROOM_MAP[next] : 'boss';
        const front = HUB_RETURN[door]; // the tile just outside the door
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
      const bob = Math.floor(Date.now() / 500) % 2 === 1 ? 1 : 0;
      for (const npc of currentMap.npcs) {
        drawSprite(ctx, NPC_SPRITE, npc.x * TILE_SIZE, npc.y * TILE_SIZE - bob, SPRITE_COLORS['npc_athlete']!);
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
      for (const npc of currentMap.npcs) {
        if (prompt && prompt.x === npc.x && prompt.y === npc.y) continue;
        if (roomKey) {
          if (gameState.roomProgress[roomKey]) drawDoneStar(ctx, npc.x, npc.y);
          else drawAlertBubble(ctx, npc.x, npc.y);
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
  };
};
