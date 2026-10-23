import {
  clearDialogue,
  createDialogueState,
  startDialogue,
  updateDialogue,
  renderDialogue,
  type DialogueOptions,
  type DialogueState,
} from '../render/DialogueBox';
import { consoleLabel, fillButtonNames, type ButtonLabel, type InputState } from '../engine/Input';

export interface DialogueSystem {
  state: DialogueState;
  /** onCancel runs if the player leaves with B instead (see DialogueBox cancelDialogue). */
  show(
    text: string,
    choices?: string[],
    onComplete?: (choiceIndex?: number) => void,
    onCancel?: () => void,
    options?: DialogueOptions,
  ): void;
  /** B on any line ends the whole sequence: onCancel if given, otherwise onComplete. options.nextLabel names A on the last line only. */
  showSequence(texts: string[], onComplete?: () => void, onCancel?: () => void, options?: DialogueOptions): void;
  update(dt: number, input: InputState): void;
  render(ctx: CanvasRenderingContext2D): void;
  isActive(): boolean;
  /** Close any open dialogue and drop pending callbacks (call when leaving a scene abruptly). */
  reset(): void;
}

/**
 * Text and choices may name buttons as {A}, {B}, {START}, {SELECT} or {DPAD}; `name` fills them in for
 * the player's device (console wording when it is omitted).
 */
export const createDialogueSystem = (onChoicesShown?: () => void, name: ButtonLabel = consoleLabel): DialogueSystem => {
  const state = createDialogueState();
  const fill = (text: string) => fillButtonNames(text, name);

  return {
    state,

    show(
      text: string,
      choices?: string[],
      onComplete?: (choiceIndex?: number) => void,
      onCancel?: () => void,
      options?: DialogueOptions,
    ) {
      startDialogue(state, fill(text), choices?.map(fill), onComplete, onCancel, options);
    },

    showSequence(texts: string[], onComplete?: () => void, onCancel?: () => void, options?: DialogueOptions) {
      let index = 0;
      const leave = () => (onCancel ?? onComplete)?.();
      const showNext = () => {
        if (index < texts.length) {
          const text = texts[index]!;
          index++;
          const last = index === texts.length;
          startDialogue(state, fill(text), undefined, showNext, leave, last ? options : { ...options, nextLabel: undefined });
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
      renderDialogue(ctx, state, name);
    },

    isActive() {
      return state.active;
    },

    reset() {
      clearDialogue(state);
    },
  };
};
