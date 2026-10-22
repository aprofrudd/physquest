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
  /** onCancel runs if the player leaves with B instead (see DialogueBox cancelDialogue). */
  show(text: string, choices?: string[], onComplete?: (choiceIndex?: number) => void, onCancel?: () => void): void;
  /** B on any line ends the whole sequence: onCancel if given, otherwise onComplete. */
  showSequence(texts: string[], onComplete?: () => void, onCancel?: () => void): void;
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

    show(text: string, choices?: string[], onComplete?: (choiceIndex?: number) => void, onCancel?: () => void) {
      startDialogue(state, text, choices, onComplete, onCancel);
    },

    showSequence(texts: string[], onComplete?: () => void, onCancel?: () => void) {
      let index = 0;
      const leave = () => (onCancel ?? onComplete)?.();
      const showNext = () => {
        if (index < texts.length) {
          const text = texts[index]!;
          index++;
          startDialogue(state, text, undefined, showNext, leave);
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
