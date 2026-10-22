import type { Scene } from '../engine/GameLoop';
import type { Input } from '../engine/Input';
import type { SceneManager } from '../engine/SceneManager';
import { resetGameState, type GameState } from '../state/GameState';
import { drawText, measureText } from '../render/PixelFont';
import { PALETTES } from '../render/Palettes';
import { drawSprite } from '../render/SpriteSheet';
import { GAME_W, GAME_H } from '../render/DialogueBox';
import { hasSave, loadSave, applySave } from '../systems/SaveSystem';
import { sfx } from '../audio/Sfx';
import { announce } from '../ui/announce';

// Logo sprite: 48x16 clipboard and trophy icons, drawn at 2x
const LOGO_SPRITE: number[][] = [
  [0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,1,4,4,4,4,4,4,4,4,4,4,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,1,4,4,4,4,4,4,4,4,4,4,4,4,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,5,5,5,1,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,1,4,1,1,1,4,1,1,4,1,1,4,4,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,5,5,5,5,5,1,0,0,0,0,0,0,0,0,0],
  [0,0,0,1,4,4,4,4,4,4,4,4,4,4,4,4,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,5,1,1,1,5,1,0,0,0,0,0,0,0,0,0],
  [0,0,0,1,4,1,1,4,1,1,1,4,1,4,4,4,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,1,1,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,1,4,4,4,4,4,4,4,4,4,4,4,4,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,1,4,1,4,1,1,4,1,1,4,1,4,4,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,1,4,4,4,4,4,4,4,4,4,4,4,4,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,1,4,1,1,1,4,1,4,1,1,1,4,4,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,1,4,4,4,4,4,4,4,4,4,4,4,4,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
];

const LOGO_SCALE = 2;

// The artwork does not fill its 48x16 cells (empty columns on the left and right, empty rows at the
// bottom), so find where the icons really are and centre those instead of the whole sprite.
const LOGO_ART = (() => {
  let left = Infinity;
  let right = -1;
  let top = Infinity;
  let bottom = -1;
  LOGO_SPRITE.forEach((row, r) =>
    row.forEach((cell, c) => {
      if (cell === 0) return;
      left = Math.min(left, c);
      right = Math.max(right, c);
      top = Math.min(top, r);
      bottom = Math.max(bottom, r);
    }),
  );
  return { left, top, w: (right - left + 1) * LOGO_SCALE, h: (bottom - top + 1) * LOGO_SCALE };
})();

/** Draw the logo with its artwork centred on cx and its top edge at y (palette colours, cached by drawSprite). */
const drawLogo = (ctx: CanvasRenderingContext2D, cx: number, y: number, colors: string[]) => {
  drawSprite(
    ctx,
    LOGO_SPRITE,
    Math.round(cx - LOGO_ART.w / 2) - LOGO_ART.left * LOGO_SCALE,
    y - LOGO_ART.top * LOGO_SCALE,
    colors,
    LOGO_SCALE,
  );
};

const INPUT_LOCK = 0.5; // seconds: swallow the press that brought us here (e.g. A on QUIT TO TITLE)

const MENU = ['CONTINUE', 'NEW GAME'] as const;
const CONFIRM = ['NO', 'YES'] as const;

// Overwrite warning: dark enough to read on the cream background (6.5:1)
const WARN_COLOR = '#a01818';

const CONTROLS = ['D-PAD: MOVE', 'A: TALK / CHOOSE', 'B: BACK / RUN'];

const CURSOR_GAP = 4; // air between the '>' column and the labels (same as the pause menu and choice lists)

// Layout (game pixels), top to bottom: title, subtitle, rule, logo band, rule, controls legend; the prompt
// or menu follows below. Everything down to the legend is the same in every state.
const TITLE_Y = 20; // 3x text: 21px tall, plus a 1px shadow
const SUBTITLE_Y = 46;
const RULE_TOP_Y = 59;
const LOGO_Y = 67; // top of the 2x artwork: 6px below the top rule and above the bottom one
const RULE_BOTTOM_Y = 99;
const LEGEND_Y = 110;
const LEGEND_PITCH = 10;
const START_Y = 156; // 'PRESS START'
const MENU_Y = 152; // CONTINUE / NEW GAME
const CONFIRM_HEADING_Y = 148; // 'OVERWRITE SAVE?'
const CONFIRM_MENU_Y = 170; // NO / YES

// Vertical option list at scale 2: a cursor column, a gap, then the labels on one shared left edge.
// The whole block is centred, so the '>' sits in a fixed column however the options change.
const drawMenu = (
  ctx: CanvasRenderingContext2D,
  options: readonly string[],
  selected: number,
  y: number,
  activeColor: string,
  idleColor: string,
) => {
  const widest = Math.max(...options.map(opt => measureText(opt, 2)));
  const cursorW = measureText('>', 2);
  const labelX = cursorW + CURSOR_GAP;
  const cursorX = Math.floor((GAME_W - (labelX + widest - 2)) / 2); // -2: the last glyph's trailing gap
  for (let i = 0; i < options.length; i++) {
    const isSelected = i === selected;
    const color = isSelected ? activeColor : idleColor;
    if (isSelected) drawText(ctx, '>', cursorX, y + i * 20, color, 2);
    drawText(ctx, options[i]!, cursorX + labelX, y + i * 20, color, 2);
  }
};

export const createTitleScene = (
  input: Input,
  sceneManager: SceneManager,
  gameState: GameState,
): Scene => {
  let timer = 0;
  let saveExists = false;
  let menuIndex = 0; // 0 = Continue, 1 = New Game (when a save exists)
  let confirming = false; // inline "OVERWRITE SAVE?" prompt after choosing New Game
  let confirmIndex = 0; // 0 = No (the safe default), 1 = Yes

  const startNewGame = () => {
    // The old save is deliberately left alone: the new game replaces it when it first saves,
    // so backing out of the intro doesn't cost the player their progress.
    resetGameState(gameState);
    sfx.play('start');
    sceneManager.switchTo('intro');
  };

  const continueGame = () => {
    const save = loadSave();
    if (!save) {
      // The save disappeared since we looked (storage cleared in another tab)
      saveExists = false;
      sfx.play('wrong');
      announce('Save not found. Press Start to begin.');
      return;
    }
    applySave(gameState, save);
    sfx.play('start');
    sceneManager.switchTo('levelSelect');
  };

  return {
    onEnter() {
      timer = 0;
      saveExists = hasSave();
      menuIndex = 0;
      confirming = false;
      confirmIndex = 0;
      announce(saveExists ? 'PhysQuest. Continue.' : 'PhysQuest. Press Start to begin.');
    },

    update(dt: number) {
      timer += dt;
      const inp = input.read();

      if (timer < INPUT_LOCK) return;

      const confirmPressed = inp.aPressed || inp.startPressed;

      if (!saveExists) {
        if (confirmPressed) startNewGame();
        return;
      }

      if (confirming) {
        // Overwriting is destructive: only A can say YES, and B or START (Esc on a keyboard) backs out
        if (inp.bPressed || inp.startPressed) {
          confirming = false;
          sfx.play('back');
          announce(MENU[menuIndex] ?? '');
          return;
        }
        // Only two choices, so any direction flips between them
        if (inp.upRepeat || inp.downRepeat || inp.leftRepeat || inp.rightRepeat) {
          confirmIndex = 1 - confirmIndex;
          sfx.play('blip');
          announce(CONFIRM[confirmIndex] ?? '');
        }
        if (inp.aPressed) {
          if (confirmIndex === 1) {
            startNewGame();
          } else {
            confirming = false;
            sfx.play('back');
            announce(MENU[menuIndex] ?? '');
          }
        }
        return;
      }

      if (inp.upRepeat || inp.downRepeat) {
        const step = inp.upRepeat ? -1 : 1;
        menuIndex = (menuIndex + step + MENU.length) % MENU.length;
        sfx.play('blip');
        announce(MENU[menuIndex] ?? '');
      }

      if (confirmPressed) {
        if (menuIndex === 0) {
          continueGame();
        } else {
          confirming = true;
          confirmIndex = 0;
          sfx.play('select');
          announce('Overwrite save? No');
        }
      }
    },

    render(ctx: CanvasRenderingContext2D) {
      const pal = PALETTES.title;

      // Background — light (GBC style)
      ctx.fillStyle = pal.colors[4];
      ctx.fillRect(0, 0, GAME_W, GAME_H);

      // Double-line border frame around screen
      ctx.fillStyle = pal.colors[0];
      ctx.fillRect(0, 0, GAME_W, 3);
      ctx.fillRect(0, GAME_H - 3, GAME_W, 3);
      ctx.fillRect(0, 0, 3, GAME_H);
      ctx.fillRect(GAME_W - 3, 0, 3, GAME_H);
      ctx.fillStyle = pal.colors[1];
      ctx.fillRect(3, 3, GAME_W - 6, 2);
      ctx.fillRect(3, GAME_H - 5, GAME_W - 6, 2);
      ctx.fillRect(3, 3, 2, GAME_H - 6);
      ctx.fillRect(GAME_W - 5, 3, 2, GAME_H - 6);

      // Title "PHYSQUEST" at 3x with 1px drop shadow
      const title = 'PHYSQUEST';
      const titleW = measureText(title, 3);
      const titleX = (GAME_W - titleW) / 2;
      // Drop shadow
      drawText(ctx, title, titleX + 1, TITLE_Y + 1, pal.colors[1], 3);
      // Main title
      drawText(ctx, title, titleX, TITLE_Y, pal.colors[5], 3);

      // Subtitle
      const sub = 'SPORTS SCIENCE ADVENTURE';
      const subW = measureText(sub, 1);
      drawText(ctx, sub, (GAME_W - subW) / 2, SUBTITLE_Y, pal.colors[1]);

      // Horizontal divider
      ctx.fillStyle = pal.colors[2];
      ctx.fillRect(30, RULE_TOP_Y, GAME_W - 60, 2);

      // Logo sprite, at 2x
      drawLogo(ctx, GAME_W / 2, LOGO_Y, pal.colors as unknown as string[]);

      // Horizontal divider
      ctx.fillStyle = pal.colors[2];
      ctx.fillRect(30, RULE_BOTTOM_Y, GAME_W - 60, 2);

      // Controls legend: one left-aligned block, centred as a whole
      const legendW = Math.max(...CONTROLS.map(line => measureText(line)));
      const legendX = Math.floor((GAME_W - legendW) / 2);
      for (let i = 0; i < CONTROLS.length; i++) {
        drawText(ctx, CONTROLS[i]!, legendX, LEGEND_Y + i * LEGEND_PITCH, pal.colors[1]);
      }

      if (!saveExists) {
        // Press start — Pokemon-style blink (500ms on, 250ms off)
        const blinkCycle = (Date.now() % 750);
        if (blinkCycle < 500) {
          const start = 'PRESS START';
          const startW = measureText(start, 2);
          drawText(ctx, start, (GAME_W - startW) / 2, START_Y, pal.colors[0], 2);
        }
      } else if (confirming) {
        const heading = 'OVERWRITE SAVE?';
        drawText(ctx, heading, (GAME_W - measureText(heading, 2)) / 2, CONFIRM_HEADING_Y, WARN_COLOR, 2);
        drawMenu(ctx, CONFIRM, confirmIndex, CONFIRM_MENU_Y, pal.colors[0], pal.colors[2]);
      } else {
        drawMenu(ctx, MENU, menuIndex, MENU_Y, pal.colors[0], pal.colors[2]);
      }

      // Version
      drawText(ctx, 'V1.1', 8, GAME_H - 14, pal.colors[2]);
    },
  };
};
