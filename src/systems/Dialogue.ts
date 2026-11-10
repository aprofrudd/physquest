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
  /**
   * B on any line ends the whole sequence: onCancel if given, otherwise onComplete. options.nextLabel names A on the
   * last line only. LEFT goes back a page, across lines too.
   */
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
      // LEFT on a line's first page goes back to the line before, opened on its last page; on the first line it is
      // the caller's options.onBack (e.g. the previous speaker's lines). options.fromEnd opens on the last line.
      const showLine = (i: number, fromEnd: boolean) => {
        index = i + 1;
        const last = index === texts.length;
        startDialogue(state, fill(texts[i]!), undefined, showNext, leave, {
          ...options,
          nextLabel: last ? options?.nextLabel : undefined,
          onBack: i > 0 ? () => showLine(i - 1, true) : options?.onBack,
          fromEnd,
        });
      };
      const showNext = () => {
        if (index < texts.length) showLine(index, false);
        else onComplete?.();
      };
      if (options?.fromEnd && texts.length > 0) showLine(texts.length - 1, true);
      else showNext();
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
