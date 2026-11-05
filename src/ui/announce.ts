// Mirrors in-game text into a visually hidden live region so screen readers can follow the
// dialogue (the game itself is a canvas, which assistive tech can't read).
import { fillName } from '../engine/nameToken';

let region: HTMLElement | null = null;
let lastText = '';
let lastAt = -Infinity;
let pending = 0;
let queued = ''; // lines waiting to be read together
let queuedAt = -Infinity;
// Calls this close together come from one game step (a step is 16.7 ms): a dialogue line and a room's own note
const SAME_STEP_MS = 8;

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
 * reported twice), but a prompt that genuinely appears again is read again. Lines from the same game step are
 * read together.
 */
export const announce = (raw: string): void => {
  if (!raw) return;
  const text = fillName(raw); // a line may name the player as {NAME}
  const now = performance.now();
  if (text === lastText && now - lastAt < 250) return;
  lastText = text;
  lastAt = now;
  const el = getRegion();
  if (!el) return;
  // Lines said in the same step are read together, never dropped (and never twice); a later line replaces one still
  // waiting, so typing a name reads the name so far rather than every letter
  if (queued && now - queuedAt < SAME_STEP_MS) {
    if (text.includes(queued)) queued = text;
    else if (!queued.includes(text)) queued = `${queued}${/[.!?:]$/.test(queued) ? '' : '.'} ${text}`;
  } else {
    queued = text;
  }
  queuedAt = now;
  // Clearing first makes screen readers treat a repeat of the previous line as new content
  el.textContent = '';
  window.clearTimeout(pending);
  pending = window.setTimeout(() => {
    el.textContent = queued;
    queued = '';
  }, 30);
};
