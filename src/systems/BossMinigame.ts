import { drawPokemonBox } from '../render/SpriteSheet';
import { drawText } from '../render/PixelFont';
import { GAME_W, GAME_H } from '../render/DialogueBox';

export type MinigameType = 'sprint' | 'strength' | 'endurance' | 'power';

interface MinigameState {
  type: MinigameType;
  active: boolean;
  timer: number;
  duration: number;
  playerScore: number;
  rivalScore: number;
  playerCeiling: number; // 0-1, from stats
  rivalCeiling: number;
  // Type-specific
  mashCount: number;
  holdTimer: number;
  holdTarget: number;
  rhythmPhase: number;
  rhythmHits: number;
  rhythmMisses: number;
  rhythmBeatTimer: number;
  powerTapTime: number;
  powerSweetSpot: number;
  powerResult: number;
  complete: boolean;
  won: boolean;
}

export const createMinigameState = (
  type: MinigameType,
  playerCeiling: number,
  rivalCeiling: number
): MinigameState => ({
  type,
  active: true,
  timer: 0,
  duration: type === 'sprint' ? 5 : type === 'strength' ? 4 : type === 'endurance' ? 8 : 3,
  playerScore: 0,
  rivalScore: 0,
  playerCeiling: Math.max(0.1, Math.min(1, playerCeiling)),
  rivalCeiling: Math.max(0.1, Math.min(1, rivalCeiling)),
  mashCount: 0,
  holdTimer: 0,
  holdTarget: 2.5,
  rhythmPhase: 0,
  rhythmHits: 0,
  rhythmMisses: 0,
  rhythmBeatTimer: 0,
  powerTapTime: -1,
  powerSweetSpot: 0.5 + Math.random() * 0.3,
  powerResult: -1,
  complete: false,
  won: false,
});

export const updateMinigame = (
  state: MinigameState,
  dt: number,
  actionPressed: boolean,
  actionHeld: boolean
): void => {
  if (!state.active || state.complete) return;
  state.timer += dt;

  switch (state.type) {
    case 'sprint': {
      if (actionPressed) state.mashCount++;
      const maxMashes = 30;
      state.playerScore = Math.min(1, (state.mashCount / maxMashes)) * state.playerCeiling;
      state.rivalScore = Math.min(1, (state.timer / state.duration) * 0.85) * state.rivalCeiling;
      if (state.timer >= state.duration) {
        state.complete = true;
        state.won = state.playerScore > state.rivalScore;
      }
      break;
    }
    case 'strength': {
      if (actionHeld) {
        state.holdTimer += dt;
        state.playerScore = Math.min(1, state.holdTimer / state.holdTarget) * state.playerCeiling;
      }
      state.rivalScore = Math.min(1, (state.timer / state.duration) * 0.8) * state.rivalCeiling;
      if (state.timer >= state.duration) {
        state.complete = true;
        state.won = state.playerScore > state.rivalScore;
      }
      break;
    }
    case 'endurance': {
      const beatInterval = 0.8;
      state.rhythmBeatTimer += dt;
      if (state.rhythmBeatTimer >= beatInterval) {
        state.rhythmBeatTimer -= beatInterval;
        state.rhythmPhase = 1;
        setTimeout(() => {
          if (state.rhythmPhase === 1) {
            state.rhythmMisses++;
            state.rhythmPhase = 0;
          }
        }, 200);
      }
      if (actionPressed && state.rhythmPhase === 1) {
        state.rhythmHits++;
        state.rhythmPhase = 0;
      } else if (actionPressed && state.rhythmPhase === 0) {
        state.rhythmMisses++;
      }
      const totalBeats = Math.max(1, state.rhythmHits + state.rhythmMisses);
      state.playerScore = (state.rhythmHits / totalBeats) * state.playerCeiling;
      state.rivalScore = Math.min(1, (state.timer / state.duration) * 0.75) * state.rivalCeiling;
      if (state.timer >= state.duration) {
        state.complete = true;
        state.won = state.playerScore > state.rivalScore;
      }
      break;
    }
    case 'power': {
      const cycleSpeed = 1.5;
      const progress = (state.timer % cycleSpeed) / cycleSpeed;

      if (actionPressed && state.powerTapTime < 0) {
        state.powerTapTime = state.timer;
        const accuracy = 1 - Math.abs(progress - state.powerSweetSpot) * 3;
        state.powerResult = Math.max(0, accuracy) * state.playerCeiling;
        state.playerScore = state.powerResult;
        state.rivalScore = 0.7 * state.rivalCeiling;
        state.complete = true;
        state.won = state.playerScore > state.rivalScore;
      }
      if (state.timer >= state.duration && !state.complete) {
        state.playerScore = 0;
        state.rivalScore = 0.7 * state.rivalCeiling;
        state.complete = true;
        state.won = false;
      }
      break;
    }
  }
};

export const renderMinigame = (
  ctx: CanvasRenderingContext2D,
  state: MinigameState
): void => {
  if (!state.active) return;

  const midY = GAME_H / 2 + 20;
  const barW = 180;
  const barH = 16;
  const barX = (GAME_W - barW) / 2;

  switch (state.type) {
    case 'sprint': {
      drawText(ctx, 'MASH SPACE!', barX, midY - 20, '#080808');
      drawPokemonBox(ctx, barX, midY, barW, barH);
      const fillW = Math.floor((barW - 8) * state.playerScore);
      ctx.fillStyle = '#38a848';
      ctx.fillRect(barX + 4, midY + 4, fillW, barH - 8);
      const remaining = Math.max(0, state.duration - state.timer);
      drawText(ctx, `TIME: ${remaining.toFixed(1)}`, barX, midY + 24, '#303030');
      break;
    }
    case 'strength': {
      drawText(ctx, 'HOLD SPACE!', barX, midY - 20, '#080808');
      drawPokemonBox(ctx, barX, midY, barW, barH);
      const fillW = Math.floor((barW - 8) * state.playerScore);
      ctx.fillStyle = '#a83030';
      ctx.fillRect(barX + 4, midY + 4, fillW, barH - 8);
      const remaining = Math.max(0, state.duration - state.timer);
      drawText(ctx, `TIME: ${remaining.toFixed(1)}`, barX, midY + 24, '#303030');
      break;
    }
    case 'endurance': {
      drawText(ctx, 'HIT THE BEAT!', barX, midY - 20, '#080808');
      const beatOn = state.rhythmPhase === 1;
      const beatBg = beatOn ? '#3858a8' : '#a0a0a0';
      drawPokemonBox(ctx, GAME_W / 2 - 14, midY, 28, 28, beatBg);
      if (beatOn) {
        drawText(ctx, 'NOW', GAME_W / 2 - 9, midY + 10, '#080808');
      }
      drawText(ctx, `HITS: ${state.rhythmHits}`, barX, midY + 36, '#38a848');
      drawText(ctx, `MISS: ${state.rhythmMisses}`, barX + 100, midY + 36, '#a83030');
      break;
    }
    case 'power': {
      drawText(ctx, 'TAP AT THE MARK!', barX - 10, midY - 20, '#080808');
      drawPokemonBox(ctx, barX, midY, barW, barH);
      // Sweet spot marker
      const sweetX = barX + 4 + state.powerSweetSpot * (barW - 8);
      ctx.fillStyle = '#38a848';
      ctx.fillRect(Math.floor(sweetX - 4), midY - 4, 8, barH + 8);
      // Moving cursor
      if (state.powerTapTime < 0) {
        const cycleSpeed = 1.5;
        const progress = (state.timer % cycleSpeed) / cycleSpeed;
        const cursorX = barX + 4 + progress * (barW - 8);
        ctx.fillStyle = '#080808';
        ctx.fillRect(Math.floor(cursorX - 2), midY - 2, 4, barH + 4);
      }
      break;
    }
  }

  if (state.complete) {
    const resultText = state.won ? 'YOU WIN!' : 'YOU LOSE!';
    const color = state.won ? '#38a848' : '#a83030';
    drawText(ctx, resultText, GAME_W / 2 - 30, midY + 50, color, 2);
  }
};
