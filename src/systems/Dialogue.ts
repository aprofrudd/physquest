import {
  createDialogueState,
  startDialogue,
  updateDialogue,
  renderDialogue,
  type DialogueState,
} from '../render/DialogueBox';
import type { InputState } from '../engine/Input';

export interface DialogueSystem {
  state: DialogueState;
  show(text: string, choices?: string[], onComplete?: (choiceIndex?: number) => void): void;
  showSequence(texts: string[], onComplete?: () => void): void;
  update(dt: number, input: InputState): void;
  render(ctx: CanvasRenderingContext2D): void;
  isActive(): boolean;
}

export const createDialogueSystem = (): DialogueSystem => {
  const state = createDialogueState();
  let upWasDown = false;
  let downWasDown = false;

  return {
    state,

    show(text: string, choices?: string[], onComplete?: (choiceIndex?: number) => void) {
      startDialogue(state, text, choices, onComplete);
    },

    showSequence(texts: string[], onComplete?: () => void) {
      let index = 0;
      const showNext = () => {
        if (index < texts.length) {
          const text = texts[index]!;
          index++;
          startDialogue(state, text, undefined, () => {
            showNext();
          });
        } else {
          onComplete?.();
        }
      };
      showNext();
    },

    update(dt: number, input: InputState) {
      const upPressed = input.up && !upWasDown;
      const downPressed = input.down && !downWasDown;
      upWasDown = input.up;
      downWasDown = input.down;
      updateDialogue(state, dt, input.actionPressed, upPressed, downPressed);
    },

    render(ctx: CanvasRenderingContext2D) {
      renderDialogue(ctx, state);
    },

    isActive() {
      return state.active;
    },
  };
};
