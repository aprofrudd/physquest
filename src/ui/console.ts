// The on-screen handheld: a CSS-built console around the game canvas, with touch + keyboard wiring.
//
// The game keeps drawing into an off-DOM canvas at its native size (gameWidth x gameHeight). A separate
// display canvas inside the screen bezel receives each finished frame (present()) at an integer
// multiple, and is sized so game pixels land on whole device pixels whenever that costs little.
import type { Input } from '../engine/Input';
import type { Sfx } from '../audio/Sfx';
import { buildConsoleDom } from './consoleDom';
import { wireConsoleInput } from './consoleInput';
import { pickDisplayScale, solveLayout } from './consoleLayout';

export interface ConsoleOptions {
  gameWidth: number;
  gameHeight: number;
  sfx: Sfx;
}

export interface ConsoleHandle {
  /** The canvas the game draws into. Its backing store must stay gameWidth x gameHeight. */
  canvas: HTMLCanvasElement;
  /** Called after every rendered frame (e.g. to copy the frame to an upscaled display canvas). */
  present(): void;
  destroy(): void;
}

export const mountConsole = (root: HTMLElement, input: Input, opts: ConsoleOptions): ConsoleHandle => {
  const { gameWidth: gw, gameHeight: gh } = opts;

  // Off-DOM: the game never sees layout, and the display canvas owns all scaling
  const canvas = document.createElement('canvas');
  canvas.width = gw;
  canvas.height = gh;

  const dom = buildConsoleDom(root);
  const display = dom.display;
  const dctx = display.getContext('2d', { alpha: false });
  if (!dctx) throw new Error('Canvas 2D is not available');

  let backingK = 0;
  let fit = 1; // emergency uniform shrink of the whole console (see solveLayout)
  let tight = false; // smallest phones: see pickDisplayScale

  const present = () => {
    if (backingK === 0) return;
    dctx.drawImage(canvas, 0, 0, gw * backingK, gh * backingK);
  };

  /** Size the display canvas for the screen slot as it is laid out right now. */
  const applyScale = () => {
    const rect = dom.screen.getBoundingClientRect(); // visual size: includes any fit shrink
    if (rect.width < 1 || rect.height < 1) return;
    const dpr = window.devicePixelRatio || 1;
    const scale = pickDisplayScale(rect.width, rect.height, dpr, gw, gh, tight);
    if (scale.k !== backingK) {
      backingK = scale.k;
      display.width = gw * scale.k; // resizing resets the context state
      display.height = gh * scale.k;
      dctx.imageSmoothingEnabled = false;
    }
    // The glass lives inside the (possibly shrunk) console, so its own CSS size is pre-shrink
    dom.lcd.style.width = `${scale.cssW / fit}px`;
    dom.lcd.style.height = `${scale.cssH / fit}px`;
    dom.lcd.style.setProperty('--px', `${scale.d / dpr / fit}px`);
    dom.lcd.style.setProperty('--dpr', String(dpr));
    display.classList.toggle('is-pixelated', scale.pixelated);
    // A faint pixel grid only reads as an LCD when each game pixel is a few whole device pixels
    dom.lcd.classList.toggle('has-grid', scale.pixelated && scale.d >= 3);
    display.dataset.scale = scale.d.toFixed(3);
    display.dataset.k = String(scale.k);
    present(); // a resized backing store is blank until the next frame
  };

  // --- Layout: available box -> console metrics (CSS variables) -> display scale ------------------
  let layoutKey = '';
  const applyLayout = () => {
    const cs = getComputedStyle(dom.stage);
    const box = dom.stage.getBoundingClientRect();
    const w = box.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const h = box.height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    if (w < 1 || h < 1) return;
    const dpr = window.devicePixelRatio || 1;
    const key = `${w.toFixed(2)}|${h.toFixed(2)}|${dpr}`;
    if (key === layoutKey) return;
    layoutKey = key;
    const l = solveLayout(w, h, gw, gh, dpr);
    const style = dom.body.style;
    style.setProperty('--u', `${l.u}px`);
    style.setProperty('--c', `${l.c}px`);
    style.setProperty('--cw', `${l.cw}px`);
    style.setProperty('--ch', `${l.ch}px`);
    style.setProperty('--sw', `${l.sw}px`);
    style.setProperty('--sh', `${l.sh}px`);
    style.setProperty('--side', `${l.side}px`);
    style.setProperty('--pad', `${l.pad}px`);
    style.setProperty('--led', `${l.led}px`);
    style.setProperty('--bezel-r', `${l.edge}px`);
    fit = l.fit;
    tight = l.tight;
    style.transform = fit < 1 ? `scale(${fit})` : '';
    dom.body.dataset.mode = l.mode;
    dom.body.dataset.ledLabel = l.ledLabel ? 'on' : 'off';
    dom.body.dataset.caps = l.caps ? 'on' : 'off';
    dom.body.dataset.brand = l.brand ? 'on' : 'off';
  };

  const relayout = () => {
    applyLayout();
    applyScale();
  };

  relayout(); // synchronous: the first frame is already laid out

  const stageObserver = new ResizeObserver(relayout);
  stageObserver.observe(dom.stage);
  const screenObserver = new ResizeObserver(applyScale);
  screenObserver.observe(dom.screen);
  window.addEventListener('resize', relayout);
  window.addEventListener('orientationchange', relayout);
  window.visualViewport?.addEventListener('resize', relayout);

  // devicePixelRatio changes (browser zoom, moving between monitors) without any CSS size change
  let dprQuery: MediaQueryList | null = null;
  const watchDpr = () => {
    dprQuery?.removeEventListener('change', onDprChange);
    dprQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    dprQuery.addEventListener('change', onDprChange);
  };
  function onDprChange() {
    watchDpr();
    layoutKey = '';
    relayout();
  }
  watchDpr();

  const unwire = wireConsoleInput(dom, input, opts.sfx);

  return {
    canvas,
    present,
    destroy() {
      unwire();
      stageObserver.disconnect();
      screenObserver.disconnect();
      window.removeEventListener('resize', relayout);
      window.removeEventListener('orientationchange', relayout);
      window.visualViewport?.removeEventListener('resize', relayout);
      dprQuery?.removeEventListener('change', onDprChange);
      dom.stage.remove();
    },
  };
};
