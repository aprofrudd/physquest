// Name entry comes first in the intro, then one line by name; the Performance Director welcomes the player by that
// name on the first entry to the Distance Running hub (remembered in the save); the hub's ATHLETE door comes before
// TESTING, and Aisha is no longer in the hub.
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { InputState } from '../../src/engine/Input';

const heard: string[] = [];
vi.mock('../../src/audio/Sfx', () => ({ sfx: { play: () => {}, isMuted: () => false, toggleMuted: () => {} } }));
vi.mock('../../src/ui/announce', async () => {
  const { fillName } = await import('../../src/engine/nameToken');
  return { announce: (t: string) => void heard.push(fillName(t)) };
});

const H = await import('./harness'); // loads the room chunk
const { idle, tap } = await import('../datalab-rig');
const GS = await import('../../src/state/GameState');
const { createDialogueSystem } = await import('../../src/systems/Dialogue');
const { createMovement } = await import('../../src/systems/Movement');
const { createPauseMenu } = await import('../../src/systems/PauseMenu');
const { createOverworldScene } = await import('../../src/scenes/OverworldScene');
const { createIntroScene, WELCOME_LINE } = await import('../../src/scenes/IntroScene');
const { consoleLabel, fillButtonNames } = await import('../../src/engine/Input');
const { setNameSource } = await import('../../src/engine/nameToken');
const { commitLevel, meetRoomFor } = await import('../../src/rooms/loader');
const { mapFor } = await import('../../src/data/rooms');
const { MEET_RUNNING } = await import('../../src/rooms/content/meet-running');
const { loadSave } = await import('../../src/systems/SaveSystem');
const { MEET_DOOR, MEET_RETURN } = await import('../../src/data/meetDoor');
const { T } = await import('../../src/render/TileMap');

beforeAll(() => {
  H.installFakeDom();
});

const makeInput = () => {
  let next: InputState = idle();
  let textMode = false;
  return {
    feed(inp: InputState) {
      next = inp;
    },
    read: () => {
      const out = next;
      next = idle();
      return out;
    },
    fill: (t: string) => fillButtonNames(t, consoleLabel),
    label: consoleLabel,
    blockRepeats: () => {},
    lastDevice: () => 'keyboard',
    setTextMode: (on: boolean) => {
      textMode = on;
    },
    textMode: () => textMode,
  };
};

const page = (d: ReturnType<typeof createDialogueSystem>) => (d.isActive() ? (d.state.pages[d.state.page] ?? []).join(' ') : '');

describe('the intro', () => {
  it('opens on name entry, then says one line by name, then goes to the level select', () => {
    const gameState = GS.createInitialState();
    setNameSource(() => gameState.playerName);
    const input = makeInput();
    const dialogue = createDialogueSystem();
    const switches: string[] = [];
    const scene = createIntroScene(input as never, { switchTo: (id: string) => void switches.push(id) } as never, gameState, dialogue);
    heard.length = 0;
    scene.onEnter?.();
    expect(dialogue.isActive(), 'no speech before the name').toBe(false);
    expect(input.textMode()).toBe(true);
    expect(heard.join(' ')).toMatch(/Enter your name/);
    for (let i = 0; i < 40; i++) scene.update(1 / 60); // the entry lock
    input.feed({ ...idle(), typed: ['A', 'L', 'A', 'N'] } as InputState);
    scene.update(1 / 60);
    input.feed(tap('start'));
    scene.update(1 / 60);
    expect(gameState.playerName).toBe('ALAN');
    expect(input.textMode(), 'letters stop typing once the name is done').toBe(false);
    expect(dialogue.isActive()).toBe(true);
    expect(WELCOME_LINE).toContain('{NAME}');
    expect(WELCOME_LINE).not.toMatch(/coach/i);
    expect(heard.join(' ')).toContain('Welcome, Alan.');
    // one line: A finishes the typing, A again goes on
    for (let i = 0; i < 300 && switches.length === 0; i++) {
      input.feed(i % 10 === 0 ? tap('a') : idle());
      scene.update(1 / 60);
    }
    expect(switches).toEqual(['levelSelect']);
  });
});

const makeHub = (level = 3) => {
  const gameState = GS.createInitialState();
  gameState.playerName = 'ALAN';
  setNameSource(() => gameState.playerName);
  commitLevel(level);
  GS.activateLevel(gameState, level);
  gameState.meetRoom = meetRoomFor(level);
  const input = makeInput();
  const dialogue = createDialogueSystem();
  const sceneManager = { switchTo: () => {}, getCurrentId: () => 'overworld' };
  const pause = createPauseMenu(sceneManager as never, gameState, dialogue);
  const entered: string[] = [];
  const scene = createOverworldScene(input as never, sceneManager as never, gameState, dialogue, createMovement(), id => void entered.push(id), () => {}, pause);
  const ctx = new H.FakeCtx(256, 224) as unknown as CanvasRenderingContext2D;
  const step = (inp: InputState = idle(), n = 1) => {
    for (let i = 0; i < n; i++) {
      input.feed(i === 0 ? inp : idle());
      scene.update(1 / 60);
      scene.render(ctx);
    }
  };
  /** A until the dialogue closes. */
  const readAll = () => {
    for (let i = 0; i < 2000 && dialogue.isActive(); i++) step(i % 8 === 0 ? tap('a') : idle());
  };
  return { gameState, dialogue, scene, step, readAll, entered };
};

describe('the Distance Running hub', () => {
  it('has the Performance Director, a fifth ATHLETE door and no Aisha', () => {
    commitLevel(3);
    const hub = mapFor('hub', 3)!;
    expect(hub.npcs.map(n => n.dialogueKey)).toEqual(['hub_director']);
    expect(hub.doors).toContainEqual({ x: MEET_DOOR.x, y: MEET_DOOR.y, target: 'meet' });
    expect(hub.tiles[MEET_DOOR.y]![MEET_DOOR.x]).toBe(T.DOOR);
    expect(hub.tiles[MEET_RETURN.y]![MEET_RETURN.x]).toBe(T.FLOOR);
    expect(hub.describe).toMatch(/ATHLETE/);
    expect(mapFor('meet', 3)?.name).toBe('Athlete Room');
    for (const level of [0, 1, 2]) expect(mapFor('hub', level)?.npcs.map(n => n.dialogueKey)).toEqual(['hub_athlete']);
  });

  it('the Director welcomes the player by name on the first entry, once, and it is saved', () => {
    const w = makeHub();
    heard.length = 0;
    w.scene.onEnter?.();
    expect(w.dialogue.isActive(), 'the welcome starts by itself').toBe(true);
    expect(page(w.dialogue)).toContain('Welcome, Alan.');
    expect(heard.join(' ')).toContain('Welcome, Alan.');
    w.readAll();
    expect(GS.meetOf(w.gameState).welcomed).toBe(true);
    expect(loadSave()?.meet[3]?.welcomed, 'saved').toBe(true);
    // back in the hub later: no welcome again
    w.scene.onExit?.();
    w.scene.onEnter?.();
    expect(w.dialogue.isActive()).toBe(false);
  });

  it('B on the welcome leaves it unheard: it does not restart by itself, the Director gives it in full, then the reminder and the needs chat', () => {
    const w = makeHub();
    w.scene.onEnter?.();
    w.step(idle(), 30);
    w.step(tap('b'), 4);
    expect(w.dialogue.isActive()).toBe(false);
    expect(GS.meetOf(w.gameState).welcomed, 'left early: not yet given').toBe(false);
    // back in the hub this session: it does not start by itself again
    w.scene.onExit?.();
    w.scene.onEnter?.();
    expect(w.dialogue.isActive()).toBe(false);
    // stand below the Director (7,5) facing up and press A: the full welcome
    w.gameState.playerPos = { x: 7, y: 6 };
    w.gameState.playerDir = 'up';
    w.step(tap('a'), 3);
    expect(page(w.dialogue)).toContain('Welcome, Alan.');
    w.readAll();
    expect(GS.meetOf(w.gameState).welcomed).toBe(true);
    w.step(tap('a'), 3);
    expect(page(w.dialogue)).toContain(MEET_RUNNING.directorReminder[0]!.replace('{NAME}', 'Alan').slice(0, 30));
    w.readAll();
    GS.meetOf(w.gameState).met = true;
    w.step(tap('a'), 3);
    // once the athlete is met: the needs chat (tests/shell/director-checkins.test.ts follows it through)
    expect(page(w.dialogue)).toContain(MEET_RUNNING.needs.intro[0]!.replace('{NAME}', 'Alan').slice(0, 30));
  });

  it('TESTING refuses until the ATHLETE room is done; the ATHLETE door opens the room', () => {
    const w = makeHub();
    w.scene.onEnter?.();
    w.readAll();
    // just below the TESTING door (5,2), walking up onto it
    w.gameState.playerPos = { x: 5, y: 3 };
    w.gameState.playerDir = 'up';
    w.step({ ...idle(), up: true, upPressed: true, upRepeat: true } as InputState, 1);
    for (let i = 0; i < 30 && !w.dialogue.isActive(); i++) w.step({ ...idle(), up: true } as InputState);
    expect(page(w.dialogue)).toContain('FINISH THE ATHLETE ROOM FIRST.');
    w.readAll();
    w.step(idle(), 20); // the push back off the door settles
    // the ATHLETE door (3,12), from just above it
    w.gameState.playerPos = { ...MEET_RETURN };
    w.gameState.playerDir = 'down';
    w.step({ ...idle(), down: true, downPressed: true, downRepeat: true } as InputState, 1);
    for (let i = 0; i < 60; i++) w.step({ ...idle(), down: i < 20 } as InputState);
    expect(w.gameState.returnDoor).toBe('meet');
    expect(heard.some(t => t.startsWith('Athlete Room'))).toBe(true);
  });

  it('a classic level hub is unchanged: no welcome, no ATHLETE room, TESTING open', () => {
    const w = makeHub(0);
    w.scene.onEnter?.();
    expect(w.gameState.meetRoom).toBe(false);
    expect(GS.roomUnlocked(w.gameState, 'testSelection')).toBe(true);
    // the classic hub banner may show; no dialogue opens by itself
    expect(w.dialogue.isActive()).toBe(false);
  });
});
