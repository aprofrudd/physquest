// The SUPPORT BOARD in the Distance Running hub, driven through the real OverworldScene: drawn on the wall, opened
// by facing it and pressing A, closed by A, B, SELECT or START (never the pause menu), read to screen readers; and
// Dr Ellis's board lines in the welcome and in each check-in. The classic hub has no board.
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { InputState } from '../../src/engine/Input';

const heard: string[] = [];
const drawn: string[] = [];
vi.mock('../../src/audio/Sfx', () => ({ sfx: { play: () => {}, isMuted: () => false, toggleMuted: () => {} } }));
vi.mock('../../src/ui/announce', async () => {
  const { fillName } = await import('../../src/engine/nameToken');
  return { announce: (t: string) => void heard.push(fillName(t)) };
});
vi.mock('../../src/render/PixelFont', async importOriginal => {
  const real = await importOriginal<typeof import('../../src/render/PixelFont')>();
  return {
    ...real,
    drawText: (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, scale = 1) => {
      drawn.push(text);
      real.drawText(ctx, text, x, y, color, scale);
    },
  };
});

const H = await import('./harness'); // loads the room chunk
const { idle, tap } = await import('../datalab-rig');
const GS = await import('../../src/state/GameState');
const { createDialogueSystem } = await import('../../src/systems/Dialogue');
const { createMovement } = await import('../../src/systems/Movement');
const { createPauseMenu } = await import('../../src/systems/PauseMenu');
const { createOverworldScene } = await import('../../src/scenes/OverworldScene');
const { consoleLabel, fillButtonNames } = await import('../../src/engine/Input');
const { setNameSource, fillName } = await import('../../src/engine/nameToken');
const { commitLevel, meetRoomFor } = await import('../../src/rooms/loader');
const { MEET_RUNNING } = await import('../../src/rooms/content/meet-running');
const { BOARD_RUNNING } = await import('../../src/rooms/content/board-running');

beforeAll(() => {
  H.installFakeDom();
});

const makeInput = () => {
  let next: InputState = idle();
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
    setTextMode: () => {},
  };
};

const page = (d: ReturnType<typeof createDialogueSystem>) => (d.isActive() ? (d.state.pages[d.state.page] ?? []).join(' ') : '');
const start = (line: string) => fillButtonNames(fillName(line), consoleLabel).split(' ').slice(0, 5).join(' ');

const makeHub = (level: number, setup?: (s: ReturnType<typeof GS.createInitialState>) => void) => {
  const gameState = GS.createInitialState();
  gameState.playerName = 'ALAN';
  setNameSource(() => gameState.playerName);
  commitLevel(level);
  GS.activateLevel(gameState, level);
  gameState.meetRoom = meetRoomFor(level);
  setup?.(gameState);
  const input = makeInput();
  const dialogue = createDialogueSystem();
  const sceneManager = { switchTo: () => {}, getCurrentId: () => 'overworld' };
  const pause = createPauseMenu(sceneManager as never, gameState, dialogue);
  const scene = createOverworldScene(input as never, sceneManager as never, gameState, dialogue, createMovement(), () => {}, () => {}, pause);
  const ctx = new H.FakeCtx(256, 224) as unknown as CanvasRenderingContext2D;
  const pages: string[] = [];
  const step = (inp: InputState = idle(), n = 1) => {
    for (let i = 0; i < n; i++) {
      input.feed(i === 0 ? inp : idle());
      drawn.length = 0;
      scene.update(1 / 60);
      scene.render(ctx);
      const text = page(dialogue);
      if (text && pages[pages.length - 1] !== text) pages.push(text);
    }
  };
  const readAll = () => {
    for (let i = 0; i < 4000 && dialogue.isActive(); i++) step(i % 8 === 0 ? tap('a') : idle());
  };
  const back = (door: GS.HubExit | null) => {
    scene.onExit?.();
    gameState.returnDoor = door;
    scene.onEnter?.();
    step(idle(), 2);
  };
  /** Stand below the board's middle (2,1), face it and press A. */
  const faceBoard = () => {
    gameState.playerPos = { x: 2, y: 1 };
    gameState.playerDir = 'up';
    step(idle(), 2);
    step(tap('a'), 3);
  };
  return { gameState, dialogue, pause, scene, step, readAll, back, faceBoard, pages };
};

/** Welcome heard, athlete met, needs chat done: the TESTING room is next, nothing is due. */
const settled = (s: ReturnType<typeof GS.createInitialState>) => Object.assign(GS.meetOf(s), { welcomed: true, met: true, best: 4, of: 5, needs: true });

describe('the SUPPORT BOARD', () => {
  it('opens on A when faced, shows every score line, reads it out, and closes on A without moving the player', () => {
    const w = makeHub(3, s => {
      settled(s);
      s.roomProgress.testSelection = true;
      s.playerStats.speed = 0.85;
      GS.meetOf(s).heard.testSelection = true;
    });
    w.back(null);
    w.faceBoard();
    expect(w.dialogue.isActive()).toBe(false);
    for (const line of ['SUPPORT BOARD', BOARD_RUNNING.note, 'TEST CHOICE', '85%', 'DATA INSIGHT', '--', 'TRAINING PLAN', 'EVALUATION', 'ATHLETE OVERVIEW', '4/5', 'SHOWDOWN RATING', 'RIVAL TARGET', '53%', 'ARENA: LOCKED (2/5 ROOMS)']) {
      expect(drawn, line).toContain(line);
    }
    expect(heard[heard.length - 1]).toMatch(/^Support board\. Scores grade your work, not Aisha\. Test choice score, 85 percent\..* A closes\.$/);
    // the world is frozen while it is open: holding a direction does nothing
    w.step({ ...idle(), left: true, leftPressed: true, leftRepeat: true } as InputState, 30);
    expect(w.gameState.playerPos).toEqual({ x: 2, y: 1 });
    w.step(tap('a'), 2);
    expect(drawn).not.toContain('SUPPORT BOARD');
    expect(heard[heard.length - 1]).toBe('Support board closed.');
  });

  it('closes on B, SELECT and START, and START never opens the pause menu over it', () => {
    const w = makeHub(3, settled);
    w.back(null);
    for (const button of ['b', 'select', 'start'] as const) {
      w.faceBoard();
      expect(drawn, button).toContain('SUPPORT BOARD');
      w.step(tap(button), 2);
      expect(drawn, button).not.toContain('SUPPORT BOARD');
      expect(w.pause.isActive(), button).toBe(false);
    }
  });

  it('draws the small board on the wall of the Director\'s hub only', () => {
    const run = makeHub(3, settled);
    run.back(null);
    run.step(idle(), 1);
    expect(drawn).toContain('T'); // the initials on the wall board
    expect(drawn).toContain('E');

    const classic = makeHub(0);
    classic.back(null);
    classic.faceBoard();
    expect(drawn).not.toContain('SUPPORT BOARD');
    expect(drawn).not.toContain('T');
  });
});

describe("Dr Ellis's board lines", () => {
  it('the welcome points at the board just before it sends the player to the ATHLETE room', () => {
    const w = makeHub(3);
    w.back(null); // the first hub entry: the welcome starts by itself
    w.readAll();
    const at = (line: string) => w.pages.findIndex(p => p.startsWith(start(line)));
    const last = MEET_RUNNING.directorWelcome[MEET_RUNNING.directorWelcome.length - 1]!;
    for (const line of BOARD_RUNNING.welcome) {
      expect(at(line), line).toBeGreaterThan(at(MEET_RUNNING.directorWelcome[0]!));
      expect(at(line), line).toBeLessThan(at(last));
    }
    expect(GS.meetOf(w.gameState).welcomed).toBe(true);
  });

  it('each check-in names the score the room just set, before what next', () => {
    const cases: [GS.RoomKey, GS.StatKey, number, GS.HubExit][] = [
      ['testSelection', 'speed', 0.85, 'room1'],
      ['variableId', 'strength', 0.62, 'room2'],
      ['trainingPrescription', 'endurance', 0.91, 'room3'],
      ['performancePrediction', 'power', 0.4, 'room4'],
    ];
    for (const [key, stat, value, door] of cases) {
      const w = makeHub(3, s => {
        settled(s);
        for (const k of GS.ROOM_KEYS) {
          s.roomProgress[k] = true;
          if (k === key) break;
          GS.meetOf(s).heard[k] = true;
        }
        s.playerStats[stat] = value;
      });
      w.back(door);
      w.readAll();
      const line = BOARD_RUNNING.checkIn[key].replace('{PCT}', String(Math.round(value * 100)));
      const text = w.pages.join(' ');
      expect(text, key).toContain(line);
      expect(text, key).not.toContain('{PCT}');
      expect(GS.meetOf(w.gameState).heard[key], key).toBe(true);
    }
  });
});
