// CHOOSE YOUR LOOK: the player's sprite, picked after name entry (IntroScene) and changed later from the level
// select (SELECT). A full screen on the title's cream background: a big preview that turns to show every side, a row
// of the looks with a cursor, the look's description, and the buttons.
import type { InputState } from '../engine/Input';
import { drawText, measureText } from '../render/PixelFont';
import { drawPokemonBox, drawSprite } from '../render/SpriteSheet';
import { GAME_W, GAME_H } from '../render/DialogueBox';
import { PALETTES } from '../render/Palettes';
import { prefersReducedMotion } from '../render/motion';
import { LOOK_COUNT, PLAYER_LOOKS, cleanLook, playerColors, playerSprite, type Facing } from '../data/playerLooks';
import { sfx } from '../audio/Sfx';
import { announce } from '../ui/announce';

/** A and B are ignored this long after the picker opens, so the press that opened it can't also pick. */
export const LOOK_LOCK = 0.35;

// Layout (game pixels)
const HEADER = 'CHOOSE YOUR LOOK';
const HEADER_Y = 8;
const PREVIEW_SCALE = 4;
const PREVIEW_SIZE = 16 * PREVIEW_SCALE;
const PREVIEW_BOX_W = 96;
const PREVIEW_BOX_H = PREVIEW_SIZE + 16;
const PREVIEW_BOX_Y = 28;
const LABEL_Y = PREVIEW_BOX_Y + PREVIEW_BOX_H + 6;
const CHOICE_SCALE = 2;
const CHOICE_SIZE = 16 * CHOICE_SCALE;
const CHOICE_BOX = CHOICE_SIZE + 4; // a 2px rim round the sprite (its outer pixels are see-through)
const CHOICE_PITCH = CHOICE_BOX + 4;
const CHOICE_Y = LABEL_Y + 16;
const CHOICE_X = Math.round((GAME_W - (LOOK_COUNT * CHOICE_PITCH - 4)) / 2);
const FOOTER_Y = GAME_H - 16;

// The preview turns to each side in turn, walking on the spot
const TURN: readonly Facing[] = ['down', 'left', 'up', 'right'];
const TURN_TIME = 0.8;
const STEP_TIME = 0.2;

// Each look's description, in capitals for the pixel font (built once)
const LABELS: readonly string[] = PLAYER_LOOKS.map(l => l.spoken.toUpperCase());

export type LookPickerResult = 'pick' | 'cancel' | null;

export interface LookPicker {
  /** Show the picker with `current` selected (announced for screen readers). */
  open(current: number): void;
  /** One step: 'pick' when A or START chose the selected look, 'cancel' on B, else null. */
  update(dt: number, inp: InputState): LookPickerResult;
  selected(): number;
  /** Draws the whole screen (background included). `fill` names the buttons for the player's device. */
  render(ctx: CanvasRenderingContext2D, fill: (text: string) => string): void;
}

/** `backLabel` names what B does in the footer (BACK to the name, or CANCEL at the level select). */
export const createLookPicker = (backLabel = 'BACK'): LookPicker => {
  let index = 0;
  let clock = 0;
  let lock = 0;
  const footer = `{DPAD}: CHOOSE   {A}: OK   {B}: ${backLabel}`;

  const spoken = (i: number) => `Look ${i + 1} of ${LOOK_COUNT}: ${PLAYER_LOOKS[i]!.spoken}.`;

  const move = (step: number) => {
    index = (index + step + LOOK_COUNT) % LOOK_COUNT;
    clock = 0; // the new look starts facing the player
    sfx.play('blip');
    announce(spoken(index));
  };

  return {
    open(current: number) {
      index = cleanLook(current);
      clock = 0;
      lock = LOOK_LOCK;
      announce(`Choose your look. Left and right to choose. ${spoken(index)}`);
    },

    update(dt: number, inp: InputState): LookPickerResult {
      clock += dt;
      const unlocked = lock <= 0;
      lock = Math.max(0, lock - dt);
      if (inp.leftRepeat || inp.upRepeat) move(-1);
      if (inp.rightRepeat || inp.downRepeat) move(1);
      if (!unlocked) return null;
      if (inp.aPressed || inp.startPressed) {
        sfx.play('select');
        return 'pick';
      }
      if (inp.bPressed) {
        sfx.play('back');
        return 'cancel';
      }
      return null;
    },

    selected: () => index,

    render(ctx: CanvasRenderingContext2D, fill: (text: string) => string) {
      const pal = PALETTES.title;
      ctx.fillStyle = pal.colors[4];
      ctx.fillRect(0, 0, GAME_W, GAME_H);
      ctx.fillStyle = pal.colors[0];
      ctx.fillRect(0, 0, GAME_W, 3);
      ctx.fillRect(0, GAME_H - 3, GAME_W, 3);
      ctx.fillRect(0, 0, 3, GAME_H);
      ctx.fillRect(GAME_W - 3, 0, 3, GAME_H);

      drawText(ctx, HEADER, (GAME_W - measureText(HEADER, 2)) / 2, HEADER_Y, pal.colors[0], 2);

      // The big preview, turning (standing still, facing the player, with reduced motion)
      const still = prefersReducedMotion();
      const facing = still ? 'down' : TURN[Math.floor(clock / TURN_TIME) % TURN.length]!;
      const step = still ? 0 : Math.floor(clock / STEP_TIME) % 2;
      const boxX = (GAME_W - PREVIEW_BOX_W) / 2;
      drawPokemonBox(ctx, boxX, PREVIEW_BOX_Y, PREVIEW_BOX_W, PREVIEW_BOX_H, pal.colors[1]);
      drawSprite(
        ctx,
        playerSprite(index, facing, step),
        (GAME_W - PREVIEW_SIZE) / 2,
        PREVIEW_BOX_Y + 8,
        playerColors(index),
        PREVIEW_SCALE,
      );

      const label = LABELS[index]!;
      drawText(ctx, label, (GAME_W - measureText(label)) / 2, LABEL_Y, pal.colors[2]);

      // Every look, standing; the selected one on a gold-framed plate
      for (let i = 0; i < LOOK_COUNT; i++) {
        const x = CHOICE_X + i * CHOICE_PITCH;
        const selected = i === index;
        drawPokemonBox(ctx, x, CHOICE_Y, CHOICE_BOX, CHOICE_BOX, selected ? pal.colors[5] : pal.colors[1]);
        if (selected) {
          ctx.fillStyle = '#fff1c2';
          ctx.fillRect(x + 4, CHOICE_Y + 4, CHOICE_BOX - 8, CHOICE_BOX - 8);
        }
        drawSprite(ctx, playerSprite(i, 'down', 0), x + 2, CHOICE_Y + 2, playerColors(i), CHOICE_SCALE);
      }

      const text = fill(footer);
      drawText(ctx, text, (GAME_W - measureText(text)) / 2, FOOTER_Y, pal.colors[2]);
    },
  };
};
