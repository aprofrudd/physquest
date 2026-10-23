import type { Scene } from '../engine/GameLoop';
import type { Input } from '../engine/Input';
import type { SceneManager } from '../engine/SceneManager';
import { ROOM_KEYS, type GameState } from '../state/GameState';
import { drawText, measureText } from '../render/PixelFont';
import { drawPokemonBox } from '../render/SpriteSheet';
import { GAME_W, GAME_H } from '../render/DialogueBox';
import { PALETTES } from '../render/Palettes';
import { LEVEL_DATA } from '../data/sports';
import { sfx } from '../audio/Sfx';
import { announce } from '../ui/announce';

// A and START are ignored for this long after entering, so a double-tap on the button that
// brought us here can't pick a sport before the player has seen the list.
const ENTER_LOCK = 0.3;

// Layout (game pixels). Four cards, then a footer prompt that sits below the last card.
const HEADER_Y = 8;
const SUBLINE_Y = 26;
const CARD_X = 16;
const CARD_W = GAME_W - 32;
const CARD_Y = 38;
const CARD_H = 39;
const CARD_GAP = 4;
const FOOTER_Y = GAME_H - 13;

// Badge plates (text contrast: light on green 5.1:1, dark on gold 8.9:1)
const CLEAR_PLATE = '#1f7a30';
const CLEAR_TEXT = '#f8f8f0';
const ROOMS_PLATE = '#d0a830';
const ROOMS_TEXT = '#080808';

const STAR = [
  '...#...',
  '..###..',
  '#######',
  '.#####.',
  '..###..',
  '.##.##.',
  '.#...#.',
];

/** Dark-rimmed gold star: the rim keeps the gold readable on the cream background. */
const drawStar = (ctx: CanvasRenderingContext2D, x: number, y: number, rim: string, fill: string) => {
  const paint = (dx: number, dy: number, color: string) => {
    ctx.fillStyle = color;
    for (let row = 0; row < STAR.length; row++) {
      const line = STAR[row]!;
      for (let col = 0; col < line.length; col++) {
        if (line[col] === '#') ctx.fillRect(x + col + dx, y + row + dy, 1, 1);
      }
    }
  };
  paint(-1, 0, rim);
  paint(1, 0, rim);
  paint(0, -1, rim);
  paint(0, 1, rim);
  paint(0, 0, fill);
};

/** "Jake, 24, winger. Fast but..." -> "Jake, winger": the short who-is-this line for a card. */
const athleteLabel = (profile: string): string => {
  const firstSentence = profile.split('.')[0] ?? '';
  return firstSentence
    .split(',')
    .map(part => part.trim())
    .filter(part => part !== '' && !/^\d+$/.test(part))
    .join(', ');
};

/** Cut text to fit maxWidth, ending in '..' when it had to be shortened. */
const fitText = (text: string, maxWidth: number): string => {
  if (measureText(text) <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && measureText(cut + '..') > maxWidth) cut = cut.slice(0, -1);
  return cut.trimEnd() + '..';
};

export const createLevelSelectScene = (
  input: Input,
  sceneManager: SceneManager,
  gameState: GameState,
  onSelectLevel: (levelIndex: number) => void,
): Scene => {
  const levelCount = LEVEL_DATA.length;
  let selectedIndex = 0;
  let enterTimer = 0;

  const roomsDone = (level: number): number | null => {
    const progress = gameState.levelProgress[level];
    return progress ? ROOM_KEYS.filter(key => progress.roomProgress[key]).length : null;
  };

  // What a screen reader hears for a card (the canvas itself is invisible to it)
  const describe = (level: number): string => {
    const sport = LEVEL_DATA[level]?.sport ?? `Level ${level + 1}`;
    if (gameState.bossDefeated[level]) return `${sport}, cleared`;
    const done = roomsDone(level);
    return done === null ? `${sport}, not started` : `${sport}, ${done} of ${ROOM_KEYS.length} rooms done`;
  };

  const moveSelection = (step: number) => {
    selectedIndex = (selectedIndex + step + levelCount) % levelCount;
    sfx.play('blip');
    announce(describe(selectedIndex));
  };

  return {
    onEnter() {
      // Resume the sport left half-done (e.g. after CONTINUE); otherwise the first sport still to beat;
      // with everything beaten, the one last played. (You can always replay a sport.)
      const current = Math.min(Math.max(gameState.currentLevel, 0), levelCount - 1);
      let first = -1;
      for (let i = 0; i < levelCount; i++) {
        if (!gameState.bossDefeated[i]) {
          first = i;
          break;
        }
      }
      const inProgress = !!gameState.levelProgress[current] && !gameState.bossDefeated[current];
      selectedIndex = inProgress ? current : first >= 0 ? first : current;
      enterTimer = 0;
      announce(`Select a sport. ${describe(selectedIndex)}`);
    },

    update(dt: number) {
      const inp = input.read();
      enterTimer += dt;

      if (inp.upRepeat) moveSelection(-1);
      if (inp.downRepeat) moveSelection(1);

      if ((inp.aPressed || inp.startPressed) && enterTimer >= ENTER_LOCK) {
        sfx.play('select');
        onSelectLevel(selectedIndex);
        return;
      }

      if (inp.bPressed) {
        sfx.play('back');
        sceneManager.switchTo('title');
      }
    },

    render(ctx: CanvasRenderingContext2D) {
      const pal = PALETTES.title;

      // Background
      ctx.fillStyle = pal.colors[4];
      ctx.fillRect(0, 0, GAME_W, GAME_H);

      // Border frame
      ctx.fillStyle = pal.colors[0];
      ctx.fillRect(0, 0, GAME_W, 3);
      ctx.fillRect(0, GAME_H - 3, GAME_W, 3);
      ctx.fillRect(0, 0, 3, GAME_H);
      ctx.fillRect(GAME_W - 3, 0, 3, GAME_H);

      // Header
      const header = 'SELECT A SPORT';
      const headerW = measureText(header, 2);
      drawText(ctx, header, (GAME_W - headerW) / 2, HEADER_Y, pal.colors[0], 2);

      // Subline: coach name, or a celebration once every sport is cleared
      if (gameState.gameComplete) {
        const text = 'ALL LEVELS COMPLETE';
        const textW = measureText(text) - 1; // visible width, minus the trailing gap
        const starW = STAR[0]!.length;
        const gap = 6;
        const startX = Math.floor((GAME_W - (starW + gap + textW + gap + starW)) / 2);
        drawStar(ctx, startX, SUBLINE_Y, pal.colors[1], pal.colors[5]);
        drawText(ctx, text, startX + starW + gap, SUBLINE_Y, pal.colors[2]);
        drawStar(ctx, startX + starW + gap + textW + gap, SUBLINE_Y, pal.colors[1], pal.colors[5]);
      } else if (gameState.playerName) {
        const nameText = `COACH ${gameState.playerName}`;
        drawText(ctx, nameText, (GAME_W - measureText(nameText)) / 2, SUBLINE_Y, pal.colors[2]);
      }

      // Sport cards
      const nameX = CARD_X + 24;
      const bob = Math.floor(Date.now() / 300) % 2; // cosmetic: nudges the cursor left and right

      for (let i = 0; i < levelCount; i++) {
        const sport = LEVEL_DATA[i];
        if (!sport) continue;

        const y = CARD_Y + i * (CARD_H + CARD_GAP);
        const isSelected = i === selectedIndex;
        const isComplete = gameState.bossDefeated[i] ?? false;
        const done = roomsDone(i);

        // Card box: selected gets a gold frame, a pale-gold fill and a dark cursor
        drawPokemonBox(ctx, CARD_X, y, CARD_W, CARD_H, isSelected ? pal.colors[5] : pal.colors[1]);
        if (isSelected) {
          ctx.fillStyle = '#fff1c2';
          ctx.fillRect(CARD_X + 4, y + 4, CARD_W - 8, CARD_H - 8);
          drawText(ctx, '>', CARD_X + 8 + bob * 2, y + 12, pal.colors[0], 2);
        }

        // Sport name
        drawText(ctx, sport.sport, nameX, y + 7, '#080808', 2);

        // Badge: bottom-right, on the athlete line, so it can never sit over the sport name
        let badgeX = CARD_X + CARD_W - 8;
        if (isComplete || done !== null) {
          const label = isComplete ? 'CLEAR' : `ROOMS ${done}/${ROOM_KEYS.length}`;
          const plateW = measureText(label) - 1 + 6;
          badgeX = CARD_X + CARD_W - 8 - plateW;
          ctx.fillStyle = isComplete ? CLEAR_PLATE : ROOMS_PLATE;
          ctx.fillRect(badgeX, y + 24, plateW, 9);
          drawText(ctx, label, badgeX + 3, y + 25, isComplete ? CLEAR_TEXT : ROOMS_TEXT);
        }

        // Athlete line, shortened if it would run into the badge
        const athlete = fitText(athleteLabel(sport.athleteProfile), badgeX - 6 - nameX);
        drawText(ctx, athlete, nameX, y + 25, pal.colors[1]);
      }

      // Footer prompt, in the player's button names; a cleared sport is replayed rather than played
      const footer = input.fill(gameState.bossDefeated[selectedIndex] ? '{A}: REPLAY   {B}: BACK' : '{A}: PLAY   {B}: BACK');
      drawText(ctx, footer, (GAME_W - measureText(footer)) / 2, FOOTER_Y, pal.colors[2]);
    },
  };
};
