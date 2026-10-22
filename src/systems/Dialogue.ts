import {
  clearDialogue,
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
  /** Close any open dialogue and drop pending callbacks (call when leaving a scene abruptly). */
  reset(): void;
}

export const createDialogueSystem = (onChoicesShown?: () => void): DialogueSystem => {
  const state = createDialogueState();

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
      const listShown = state.active && !!state.choices && state.waitingForInput;
      updateDialogue(state, dt, input);
      if (!listShown && state.active && state.choices && state.waitingForInput) onChoicesShown?.();
    },

    render(ctx: CanvasRenderingContext2D) {
      renderDialogue(ctx, state);
    },

    isActive() {
      return state.active;
    },

    reset() {
      clearDialogue(state);
    },
  };
};
