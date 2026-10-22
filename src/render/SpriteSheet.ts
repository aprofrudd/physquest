// Draw a sprite from a 2D pixel array using palette colors
// Each cell is a palette index (0 = transparent)

// Rasterised once per (sprite, scale, colours). Keyed by the sprite array itself, so callers must pass
// the same array each frame (a fresh copy per frame gets a fresh canvas).
const spriteCache = new WeakMap<number[][], Map<string, HTMLCanvasElement>>();

// Per-pixel fills, the original drawing method. Builds the sprite canvas and serves partial-alpha draws.
const paintSprite = (
  ctx: CanvasRenderingContext2D,
  sprite: number[][],
  x: number,
  y: number,
  colors: string[],
  scale: number
) => {
  for (let row = 0; row < sprite.length; row++) {
    const spriteRow = sprite[row];
    if (!spriteRow) continue;
    for (let col = 0; col < spriteRow.length; col++) {
      const idx = spriteRow[col];
      if (idx === undefined || idx === 0) continue; // transparent
      const color = colors[idx];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x + col * scale, y + row * scale, scale, scale);
    }
  }
};

const renderSprite = (sprite: number[][], colors: string[], scale: number): HTMLCanvasElement => {
  let cols = 0;
  for (const row of sprite) cols = Math.max(cols, row.length);
  const canvas = document.createElement('canvas');
  canvas.width = cols * scale;
  canvas.height = sprite.length * scale;
  paintSprite(canvas.getContext('2d')!, sprite, 0, 0, colors, scale);
  return canvas;
};

export const drawSprite = (
  ctx: CanvasRenderingContext2D,
  sprite: number[][],
  x: number,
  y: number,
  colors: string[],
  scale: number = 1
) => {
  const sx = Math.floor(x);
  const sy = Math.floor(y);
  // Partial alpha: drawImage rounds the blend differently from fillRect, so draw per pixel instead
  if (ctx.globalAlpha !== 1) {
    paintSprite(ctx, sprite, sx, sy, colors, scale);
    return;
  }
  let bySize = spriteCache.get(sprite);
  if (!bySize) {
    bySize = new Map<string, HTMLCanvasElement>();
    spriteCache.set(sprite, bySize);
  }
  const key = `${scale}|${colors.join(',')}`;
  let canvas = bySize.get(key);
  if (!canvas) {
    canvas = renderSprite(sprite, colors, scale);
    bySize.set(key, canvas);
  }
  if (canvas.width === 0 || canvas.height === 0) return; // drawImage throws on an empty canvas
  ctx.drawImage(canvas, sx, sy);
};

// Draw a filled rect with GBC style
export const drawPixelRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string
) => {
  ctx.fillStyle = color;
  ctx.fillRect(Math.floor(x), Math.floor(y), w, h);
};

// Draw a bordered box (for dialogue, UI panels)
export const drawBox = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  bgColor: string,
  borderColor: string,
  borderWidth: number = 2
) => {
  ctx.fillStyle = borderColor;
  ctx.fillRect(Math.floor(x), Math.floor(y), w, h);
  ctx.fillStyle = bgColor;
  ctx.fillRect(
    Math.floor(x + borderWidth),
    Math.floor(y + borderWidth),
    w - borderWidth * 2,
    h - borderWidth * 2
  );
};

// Pokemon-style double-bordered box — outer black, inner dark, white fill
export const drawPokemonBox = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  borderColor: string = '#303030'
) => {
  ctx.fillStyle = '#080808';
  ctx.fillRect(Math.floor(x), Math.floor(y), w, h);
  ctx.fillStyle = borderColor;
  ctx.fillRect(Math.floor(x + 2), Math.floor(y + 2), w - 4, h - 4);
  ctx.fillStyle = '#f8f8f0';
  ctx.fillRect(Math.floor(x + 4), Math.floor(y + 4), w - 8, h - 8);
};
