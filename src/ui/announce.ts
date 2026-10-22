// Mirrors in-game text into a visually hidden live region so screen readers can follow the
// dialogue (the game itself is a canvas, which assistive tech can't read).

let region: HTMLElement | null = null;
let lastText = '';
let lastAt = -Infinity;
let pending = 0;

const getRegion = (): HTMLElement | null => {
  if (region) return region;
  if (typeof document === 'undefined' || !document.body) return null;
  region = document.createElement('div');
  region.setAttribute('aria-live', 'polite');
  region.setAttribute('aria-atomic', 'true');
  region.className = 'sr-only';
  Object.assign(region.style, {
    position: 'absolute',
    width: '1px',
    height: '1px',
    margin: '-1px',
    padding: '0',
    overflow: 'hidden',
    clip: 'rect(0 0 0 0)',
    whiteSpace: 'nowrap',
    border: '0',
  });
  document.body.appendChild(region);
  return region;
};

/**
 * Announce a line of game text to screen readers. An identical line within 250ms is skipped (one event
 * reported twice), but a prompt that genuinely appears again is read again.
 */
export const announce = (text: string): void => {
  if (!text) return;
  const now = performance.now();
  if (text === lastText && now - lastAt < 250) return;
  lastText = text;
  lastAt = now;
  const el = getRegion();
  if (!el) return;
  // Clearing first makes screen readers treat a repeat of the previous line as new content
  el.textContent = '';
  window.clearTimeout(pending);
  pending = window.setTimeout(() => {
    el.textContent = text;
  }, 30);
};
