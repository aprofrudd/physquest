// The objectives panel (SELECT) says it has closed, like the pause menu, so a screen-reader player knows the hub is live again
// (found by the third verification round).
import { describe, expect, it, vi } from 'vitest';
vi.mock('../../src/audio/Sfx', () => ({ sfx: { play: () => {}, isMuted: () => false, toggleMuted: () => {} } }));
const heard: string[] = [];
vi.mock('../../src/ui/announce', () => ({ announce: (t: string) => void heard.push(t) }));
const { idle } = await import('../datalab-rig');
const { createInitialState, activateLevel } = await import('../../src/state/GameState');
const { createDialogueSystem } = await import('../../src/systems/Dialogue');
const { createMovement } = await import('../../src/systems/Movement');
const { createPauseMenu } = await import('../../src/systems/PauseMenu');
const { createOverworldScene } = await import('../../src/scenes/OverworldScene');
const { consoleLabel, fillButtonNames } = await import('../../src/engine/Input');

describe('the objectives panel', () => {
  it('says something when it closes (as the pause menu does)', () => {
    const gameState = createInitialState();
    gameState.playerName = 'TEST';
    activateLevel(gameState, 0);
    let next = idle();
    const input = {
      read: () => {
        const out = next;
        next = idle();
        return out;
      },
      fill: (t: string) => fillButtonNames(t, consoleLabel),
      label: consoleLabel,
      blockRepeats: () => {},
      lastDevice: () => 'console',
    };
    const dialogue = createDialogueSystem();
    const sceneManager = { switchTo: () => {}, getCurrentId: () => 'overworld' };
    const pause = createPauseMenu(sceneManager as never, gameState, dialogue);
    const scene = createOverworldScene(input as never, sceneManager as never, gameState, dialogue, createMovement(), () => {}, () => {}, pause);
    scene.onEnter?.();
    const press = (button: 'selectPressed') => {
      next = { ...idle(), [button]: true } as never;
      scene.update(1 / 60);
    };
    for (let i = 0; i < 20; i++) scene.update(1 / 60);
    heard.length = 0;
    press('selectPressed'); // opens
    for (let i = 0; i < 5; i++) scene.update(1 / 60);
    expect(heard.join(' | ')).toMatch(/Objectives/);
    heard.length = 0;
    press('selectPressed'); // closes
    for (let i = 0; i < 5; i++) scene.update(1 / 60);
    expect(heard, 'nothing is said when the panel closes').not.toEqual([]);
  });
});
