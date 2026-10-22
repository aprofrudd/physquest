// Pointer, touch and keyboard-feedback wiring for the on-screen console buttons.
import { BUTTONS, type Button, type Input } from '../engine/Input';
import type { Sfx } from '../audio/Sfx';
import type { ConsoleDom } from './consoleDom';

type Dir = 'up' | 'down' | 'left' | 'right';
const DIRS: readonly Button[] = ['up', 'down', 'left', 'right'];

interface Hold {
  /** The button this pointer currently holds (the D-pad can change it while sliding). */
  button: Button | null;
  /** D-pad box measured at pointerdown; null for the plain buttons. */
  pad: DOMRect | null;
}

const asButton = (value: string | undefined): Button | null =>
  BUTTONS.find(b => b === value) ?? null;

const buzz = () => {
  try {
    navigator.vibrate?.(8);
  } catch {
    // vibration unsupported or blocked by the browser
  }
};

/**
 * Map a pointer position to the D-pad direction: the dominant axis from the centre, nothing inside a
 * small dead zone. Once a direction is held its axis gets a little hysteresis so a thumb rolling across
 * a diagonal does not flicker between two directions.
 */
const dirAt = (pad: DOMRect, x: number, y: number, prev: Button | null): Dir | null => {
  const dx = x - (pad.left + pad.width / 2);
  const dy = y - (pad.top + pad.height / 2);
  if (Math.hypot(dx, dy) < Math.min(pad.width, pad.height) * 0.12) return null;
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  const wasHorizontal = prev === 'left' || prev === 'right';
  const wasVertical = prev === 'up' || prev === 'down';
  let horizontal = ax > ay;
  if (wasHorizontal) horizontal = ax >= ay * 0.85;
  else if (wasVertical) horizontal = ax > ay * 1.18;
  if (horizontal) return dx < 0 ? 'left' : 'right';
  return dy < 0 ? 'up' : 'down';
};

export const wireConsoleInput = (dom: ConsoleDom, input: Input, sfx: Sfx): (() => void) => {
  const cleanups: Array<() => void> = [];
  const listen = <K extends keyof WindowEventMap>(
    target: Window,
    type: K,
    fn: (e: WindowEventMap[K]) => void,
    options?: AddEventListenerOptions,
  ) => {
    target.addEventListener(type, fn as EventListener, options);
    cleanups.push(() => target.removeEventListener(type, fn as EventListener, options));
  };
  const listenOn = (
    target: EventTarget,
    type: string,
    fn: (e: Event) => void,
    options?: AddEventListenerOptions,
  ) => {
    target.addEventListener(type, fn, options);
    cleanups.push(() => target.removeEventListener(type, fn, options));
  };

  // --- Pointers: every finger is independent -------------------------------------------------
  const holds = new Map<number, Hold>();
  const sourceOf = (id: number) => `ptr:${id}`;
  let lastPointerAt = -Infinity;
  let lastInput: 'keyboard' | 'touch' | null = null;
  const hoverFine = window.matchMedia('(hover: hover) and (pointer: fine)');

  const setHints = () => {
    const show = lastInput === 'keyboard' || (lastInput === null && hoverFine.matches);
    dom.body.classList.toggle('pq-kbd', show);
  };
  setHints();
  hoverFine.addEventListener('change', setHints);
  cleanups.push(() => hoverFine.removeEventListener('change', setHints));

  const setHeld = (id: number, hold: Hold, next: Button | null) => {
    if (hold.button === next) return;
    if (hold.button) input.release(hold.button, sourceOf(id));
    hold.button = next;
    if (next) {
      input.press(next, sourceOf(id));
      buzz();
    }
  };

  const endHold = (id: number) => {
    const hold = holds.get(id);
    if (!hold) return;
    holds.delete(id);
    if (hold.button) input.release(hold.button, sourceOf(id));
  };

  const onPointerDown = (e: PointerEvent) => {
    lastPointerAt = performance.now();
    const touch = e.pointerType === 'touch';
    if (lastInput !== (touch ? 'touch' : null)) {
      lastInput = touch ? 'touch' : null;
      setHints();
    }
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const target = e.target instanceof Element ? e.target : null;
    if (!target) return;
    const padEl = target.closest<HTMLElement>('.pq-dpad');
    const btnEl = padEl ? null : target.closest<HTMLElement>('[data-button]');
    const captureEl = padEl ?? btnEl;
    if (!captureEl) return;
    e.preventDefault(); // no focus ring, text selection or compatibility mouse events
    endHold(e.pointerId); // a new press by this pointer replaces any stale one
    try {
      captureEl.setPointerCapture(e.pointerId);
    } catch {
      // The pointer is already gone, so its up/cancel will never arrive: a hold registered now would
      // keep the button down until the next blur. Ignore this press.
      return;
    }
    const hold: Hold = { button: null, pad: padEl ? padEl.getBoundingClientRect() : null };
    holds.set(e.pointerId, hold);
    if (hold.pad) setHeld(e.pointerId, hold, dirAt(hold.pad, e.clientX, e.clientY, null));
    else setHeld(e.pointerId, hold, asButton(btnEl?.dataset.button));
  };

  const onPointerMove = (e: PointerEvent) => {
    const hold = holds.get(e.pointerId);
    if (!hold?.pad) return;
    setHeld(e.pointerId, hold, dirAt(hold.pad, e.clientX, e.clientY, hold.button));
  };

  const onPointerEnd = (e: PointerEvent) => {
    lastPointerAt = performance.now();
    endHold(e.pointerId);
  };

  listenOn(dom.stage, 'pointerdown', e => onPointerDown(e as PointerEvent));
  listenOn(dom.stage, 'pointermove', e => onPointerMove(e as PointerEvent));
  listenOn(dom.stage, 'pointerup', e => onPointerEnd(e as PointerEvent));
  listenOn(dom.stage, 'pointercancel', e => onPointerEnd(e as PointerEvent));
  listenOn(dom.stage, 'lostpointercapture', e => onPointerEnd(e as PointerEvent));

  // Assistive tech (and element.click()) activate a button with a click that has no pointer sequence
  listenOn(dom.stage, 'click', e => {
    const me = e as MouseEvent;
    if (me.detail !== 0 || performance.now() - lastPointerAt < 600) return;
    const el = me.target instanceof Element ? me.target.closest<HTMLElement>('[data-button]') : null;
    const button = asButton(el?.dataset.button);
    if (!button) return;
    input.press(button, 'click');
    input.release(button, 'click');
  });

  // --- Pressed look follows the Input state, so keyboard presses animate the buttons too ---------
  const offChange = input.onChange((button, down) => {
    for (const el of dom.controls[button]) el.classList.toggle('is-pressed', down);
    if (DIRS.includes(button)) dom.dpad.classList.toggle(`dir-${button}`, down);
  });
  cleanups.push(offChange);

  // --- Keyboard hints and audio unlock ---------------------------------------------------------
  listen(window, 'keydown', () => {
    if (lastInput !== 'keyboard') {
      lastInput = 'keyboard';
      setHints();
    }
  }, { capture: true, passive: true });

  // iOS only lets audio resume from touchend/click-class events; Chrome from keydown/pointerup
  const unlock = () => sfx.unlock();
  for (const type of ['pointerdown', 'pointerup', 'keydown', 'touchend'] as const) {
    listen(window, type, unlock, { capture: true, passive: true });
  }

  // --- Sound switch ----------------------------------------------------------------------------
  const renderSound = (muted: boolean) => {
    dom.sound.setAttribute('aria-checked', String(!muted));
    dom.soundState.textContent = muted ? 'OFF' : 'ON';
  };
  renderSound(sfx.isMuted());
  cleanups.push(sfx.onMuteChange(renderSound));
  listenOn(dom.sound, 'click', e => {
    sfx.unlock();
    sfx.toggleMuted();
    sfx.play('select'); // silent when just muted, audible when just unmuted
    // After a pointer click, hand the keyboard back to the game (Space/Enter must not re-toggle the switch)
    if ((e as MouseEvent).detail > 0) dom.sound.blur();
  });
  // Space/Enter on the focused switch operate the switch, not the game's A button
  const keepKey = (e: Event) => {
    const key = (e as KeyboardEvent).key;
    if (key === ' ' || key === 'Enter') e.stopPropagation();
  };
  listenOn(dom.sound, 'keydown', keepKey);
  listenOn(dom.sound, 'keyup', keepKey);

  // --- Never leave a button stuck down ---------------------------------------------------------
  const releaseAll = () => {
    input.releaseAll();
    holds.clear();
  };
  listen(window, 'blur', releaseAll);
  listen(window, 'pagehide', releaseAll);
  listenOn(document, 'visibilitychange', () => {
    if (document.visibilityState === 'hidden') releaseAll();
  });

  // --- Stop the browser from scrolling, zooming, selecting or showing menus --------------------
  const stop = (e: Event) => e.preventDefault();
  listenOn(document, 'gesturestart', stop); // iOS pinch
  listenOn(document, 'gesturechange', stop);
  listenOn(document, 'gestureend', stop);
  listenOn(document, 'touchmove', stop, { passive: false }); // iOS rubber-band
  listenOn(dom.stage, 'contextmenu', stop);
  listenOn(dom.stage, 'dragstart', stop);
  listenOn(
    dom.stage,
    'touchstart',
    e => {
      if (e.target instanceof Element && e.target.closest('[data-button], .pq-dpad')) e.preventDefault();
    },
    { passive: false },
  );

  return () => {
    releaseAll();
    for (const fn of cleanups.splice(0)) fn();
  };
};
