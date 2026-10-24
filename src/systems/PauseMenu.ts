import { consoleLabel, fillButtonNames, type ButtonLabel, type InputState } from '../engine/Input';
import type { SceneManager } from '../engine/SceneManager';
import { CHAR_W, drawText, measureText } from '../render/PixelFont';
import { drawPokemonBox } from '../render/SpriteSheet';
import { GAME_W, GAME_H } from '../render/DialogueBox';
import { saveGame } from './SaveSystem';
import type { GameState } from '../state/GameState';
import type { DialogueSystem } from './Dialogue';
import { sfx } from '../audio/Sfx';
import { announce } from '../ui/announce';

type Option = 'resume' | 'save' | 'sound' | 'quit';
const OPTIONS: readonly Option[] = ['resume', 'save', 'sound', 'quit'];

/** What a screen reader hears for an option. */
const spokenOption = (opt: Option): string => {
  switch (opt) {
    case 'resume': return 'Resume';
    case 'save': return 'Save game';
    case 'sound': return sfx.isMuted() ? 'Sound off' : 'Sound on';
    case 'quit': return 'Quit to title';
  }
};

// The second step when quitting would lose work: STAY is first, so a hasty A changes nothing
type ConfirmOption = 'stay' | 'quit';
const CONFIRM_OPTIONS: readonly ConfirmOption[] = ['stay', 'quit'];
const CONFIRM_LABEL: Record<ConfirmOption, string> = { stay: 'STAY', quit: 'QUIT TO TITLE' };
const CONFIRM_HINT = '{A}: CHOOSE   {B}: STAY';

const optionLabel = (opt: Option): string => {
  switch (opt) {
    case 'resume': return 'RESUME';
    case 'save': return 'SAVE GAME';
    case 'sound': return sfx.isMuted() ? 'SOUND: OFF' : 'SOUND: ON';
    case 'quit': return 'QUIT TO TITLE';
  }
};

// Layout (game pixels), top to bottom inside the box: header, the options, a rule, the button hint and the
// save note. The box is wide enough for the 168px note, with air either side.
const BOX_W = 200;
const OPTIONS_Y = 30;
const OPTION_PITCH = 14;
const RULE_Y = OPTIONS_Y + OPTIONS.length * OPTION_PITCH;
const HINT_Y = RULE_Y + 7;
const NOTE_Y = HINT_Y + 11;
const BOX_H = NOTE_Y + 16;

const HINT = '{A}: CHOOSE   {B}: BACK';
const NOTE = 'PROGRESS SAVES AUTOMATICALLY';
const NOTE_IN_ROOM = 'THIS ROOM SAVES WHEN FINISHED'; // while a room is being played (finished rooms are saved)

export interface PauseMenu {
  isActive(): boolean;
  open(): void;
  close(): void;
  /**
   * Call at the top of a scene's update(). Opens the menu on START, runs it while open.
   * Returns true when the menu consumed this step — the scene should skip the rest of its update.
   */
  handle(dt: number, inp: InputState): boolean;
  render(ctx: CanvasRenderingContext2D): void;
}

export const createPauseMenu = (
  sceneManager: SceneManager,
  gameState: GameState,
  dialogue: DialogueSystem,
  onOpen?: () => void,
  name: ButtonLabel = consoleLabel, // button names for prompts (see Input.label)
  /** A warning when quitting now would lose work (e.g. a room half done), or null to quit straight away. */
  quitWarning: () => string | null = () => null,
): PauseMenu => {
  let active = false;
  let selectedIndex = 0;
  let flashText = '';
  let flashTimer = 0;
  let warning: string | null = null; // set while the menu asks before quitting

  const open = () => {
    active = true;
    selectedIndex = 0;
    flashTimer = 0;
    warning = null;
    onOpen?.();
    sfx.play('pause');
    announce(`Paused. ${OPTIONS.map(spokenOption).join(', ')}.`);
  };

  const close = () => {
    active = false;
    warning = null;
  };

  /** Back to the game: say so, and say again what was waiting on screen (a question and its options). */
  const resume = () => {
    close();
    sfx.play('back');
    const s = dialogue.state;
    const waiting = dialogue.isActive() ? (s.pages[s.page] ?? []).join(' ') : '';
    const options = dialogue.isActive() && s.choices && s.waitingForInput ? ` Options: ${s.choices.join('; ')}` : '';
    announce(`Resumed.${waiting ? ` ${waiting}` : ''}${options}`);
  };

  /** From the quit question back to the menu, on its QUIT TO TITLE line. */
  const backToMenu = () => {
    warning = null;
    selectedIndex = OPTIONS.indexOf('quit');
    sfx.play('back');
    announce('Back to the pause menu. Quit to title.');
  };

  const quit = () => {
    saveGame(gameState);
    close();
    dialogue.reset();
    sceneManager.switchTo('title');
  };

  const choose = (opt: Option) => {
    switch (opt) {
      case 'resume':
        resume();
        break;
      case 'save': {
        const ok = saveGame(gameState);
        flashText = ok ? 'SAVED!' : 'CANNOT SAVE';
        flashTimer = 1.5;
        sfx.play(ok ? 'save' : 'wrong');
        announce(ok ? 'Saved.' : 'Cannot save.');
        break;
      }
      case 'sound':
        sfx.toggleMuted();
        sfx.play('select'); // silent when just muted, audible when just unmuted
        announce(spokenOption('sound'));
        break;
      case 'quit':
        warning = quitWarning();
        if (!warning) {
          quit();
          break;
        }
        selectedIndex = 0; // STAY
        sfx.play('wrong');
        announce(`Quit to title? ${warning} Stay, or quit to title.`);
        break;
    }
  };

  /** The second step before quitting: STAY goes back to the menu, QUIT TO TITLE quits. */
  const handleConfirm = (inp: InputState) => {
    if (inp.startPressed || inp.bPressed) {
      backToMenu();
      return;
    }
    if (inp.upPressed || inp.downPressed) {
      selectedIndex = 1 - selectedIndex;
      sfx.play('blip');
      announce(CONFIRM_OPTIONS[selectedIndex] === 'stay' ? 'Stay' : 'Quit to title');
    }
    if (inp.aPressed) {
      if (CONFIRM_OPTIONS[selectedIndex] === 'quit') quit();
      else backToMenu();
    }
  };

  return {
    isActive: () => active,
    open,
    close,

    handle(dt: number, inp: InputState): boolean {
      if (!active) {
        if (inp.startPressed) {
          open();
          return true;
        }
        return false;
      }

      if (flashTimer > 0) flashTimer -= dt;

      if (warning) {
        handleConfirm(inp);
        return true;
      }

      if (inp.startPressed || inp.bPressed) {
        resume();
        return true;
      }
      if (inp.upPressed) {
        selectedIndex = (selectedIndex - 1 + OPTIONS.length) % OPTIONS.length;
        sfx.play('blip');
        announce(spokenOption(OPTIONS[selectedIndex]!));
      }
      if (inp.downPressed) {
        selectedIndex = (selectedIndex + 1) % OPTIONS.length;
        sfx.play('blip');
        announce(spokenOption(OPTIONS[selectedIndex]!));
      }
      if (inp.aPressed) {
        const opt = OPTIONS[selectedIndex];
        if (opt) choose(opt);
      }
      return true;
    },

    render(ctx: CanvasRenderingContext2D) {
      if (!active) return;

      // Semi-transparent overlay
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(0, 0, GAME_W, GAME_H);

      // Pause box
      const boxW = BOX_W;
      const boxH = BOX_H;
      const boxX = Math.floor((GAME_W - boxW) / 2);
      const boxY = Math.floor((GAME_H - boxH) / 2);
      drawPokemonBox(ctx, boxX, boxY, boxW, boxH);

      // Header
      const header = warning ? 'QUIT?' : 'PAUSED';
      const headerW = measureText(header, 2);
      drawText(ctx, header, (GAME_W - headerW) / 2, boxY + 8, '#080808', 2);

      // Asking before quitting: the warning, then STAY / QUIT TO TITLE in the options' place
      if (warning) {
        drawText(ctx, warning, (GAME_W - measureText(warning)) / 2, boxY + OPTIONS_Y, '#303030');
        const labels = CONFIRM_OPTIONS.map(o => CONFIRM_LABEL[o]);
        const labelsW = Math.max(...labels.map(l => measureText(l)));
        const cursorX = Math.floor(boxX + (boxW - (CHAR_W + 4 + labelsW)) / 2);
        for (let i = 0; i < labels.length; i++) {
          const isSelected = i === selectedIndex;
          const y = boxY + OPTIONS_Y + (i + 1.5) * OPTION_PITCH;
          if (isSelected) drawText(ctx, '>', cursorX, y, '#080808');
          drawText(ctx, labels[i]!, cursorX + CHAR_W + 4, y, isSelected ? '#080808' : '#606060');
        }
        ctx.fillStyle = '#a0a0a0';
        ctx.fillRect(boxX + 12, boxY + RULE_Y, boxW - 24, 1);
        const hint = fillButtonNames(CONFIRM_HINT, name);
        drawText(ctx, hint, (GAME_W - measureText(hint)) / 2, boxY + HINT_Y, '#303030');
        return;
      }

      // Options: a cursor column with a gap, the block centred in the box
      const labels = OPTIONS.map(optionLabel);
      const labelsW = Math.max(...labels.map(l => measureText(l)));
      const cursorX = Math.floor(boxX + (boxW - (CHAR_W + 4 + labelsW)) / 2);
      const optStartY = boxY + OPTIONS_Y;
      for (let i = 0; i < labels.length; i++) {
        const isSelected = i === selectedIndex;
        const y = optStartY + i * OPTION_PITCH;
        if (isSelected) drawText(ctx, '>', cursorX, y, '#080808');
        drawText(ctx, labels[i]!, cursorX + CHAR_W + 4, y, isSelected ? '#080808' : '#606060');
      }

      // What the buttons do here, and why SAVE GAME is rarely needed (button names follow the device)
      ctx.fillStyle = '#a0a0a0';
      ctx.fillRect(boxX + 12, boxY + RULE_Y, boxW - 24, 1);
      const hint = fillButtonNames(HINT, name);
      drawText(ctx, hint, (GAME_W - measureText(hint)) / 2, boxY + HINT_Y, '#303030');
      const note = quitWarning() ? NOTE_IN_ROOM : NOTE;
      drawText(ctx, note, (GAME_W - measureText(note)) / 2, boxY + NOTE_Y, '#606060');

      // Save confirmation, just under the box
      if (flashTimer > 0) {
        const flashW = measureText(flashText, 2);
        ctx.fillStyle = '#080808';
        ctx.fillRect((GAME_W - flashW) / 2 - 4, boxY + boxH + 4, flashW + 8, 22);
        drawText(ctx, flashText, (GAME_W - flashW) / 2, boxY + boxH + 8, flashText === 'SAVED!' ? '#38a848' : '#e04040', 2);
      }
    },
  };
};
