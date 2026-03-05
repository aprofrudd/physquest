// Draw a sprite from a 2D pixel array using palette colors
// Each cell is a palette index (0 = transparent)
export const drawSprite = (
  ctx: CanvasRenderingContext2D,
  sprite: number[][],
  x: number,
  y: number,
  colors: string[],
  scale: number = 1
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
      ctx.fillRect(
        Math.floor(x + col * scale),
        Math.floor(y + row * scale),
        scale,
        scale
      );
    }
  }
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
