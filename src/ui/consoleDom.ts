// Static markup for the handheld. All styling lives in console.css.
import { BUTTONS, type Button } from '../engine/Input';

// Every control here is tabindex="-1": keyboard players use the mapped keys (Input.ts) and the pause
// menu's SOUND option, and a Tab-focused button would turn Enter/Space into a click as well as an A press
// (the SOUND switch even swallowed them). The buttons keep their roles and labels for assistive tech,
// and a click without a pointer sequence (screen reader activation) still presses them (consoleInput.ts).
//
// The D-pad cross is one silhouette (so the arms never show seams); the four <button> arms sit on top
// of it as transparent hit targets. Polygon points are inset by 3 so the round-joined stroke brings the
// outline out to the full 0..96 box.
const CROSS_PATH = 'M35 3H61V35H93V61H61V93H35V61H3V35H35Z';

const DPAD = `
<div class="pq-dpad" role="group" aria-label="Directional pad">
  <svg class="pq-dpad-cross" viewBox="-1 -1 98 98" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="pq-dp-body" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="96">
        <stop offset="0" stop-color="#454752"/>
        <stop offset="1" stop-color="#22242b"/>
      </linearGradient>
      <linearGradient id="pq-dp-shine" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="60">
        <stop offset="0" stop-color="#fff" stop-opacity=".2"/>
        <stop offset="1" stop-color="#fff" stop-opacity="0"/>
      </linearGradient>
      <radialGradient id="pq-dp-dimple" cx=".5" cy=".5" r=".5">
        <stop offset="0" stop-color="#101116"/>
        <stop offset=".7" stop-color="#1c1d23"/>
        <stop offset="1" stop-color="#2c2e37"/>
      </radialGradient>
    </defs>
    <path d="${CROSS_PATH}" fill="#0e0f13" stroke="#0e0f13" stroke-width="6" stroke-linejoin="round" transform="translate(0 2.5)"/>
    <path d="${CROSS_PATH}" fill="url(#pq-dp-body)" stroke="url(#pq-dp-body)" stroke-width="6" stroke-linejoin="round"/>
    <path d="${CROSS_PATH}" fill="url(#pq-dp-shine)" stroke="url(#pq-dp-shine)" stroke-width="6" stroke-linejoin="round"/>
    <g fill="#0f1014" fill-opacity=".75">
      <path d="M48 9 41 20H55Z"/>
      <path d="M48 87 41 76H55Z"/>
      <path d="M9 48 20 41V55Z"/>
      <path d="M87 48 76 41V55Z"/>
    </g>
    <circle cx="48" cy="48" r="12" fill="url(#pq-dp-dimple)"/>
    <circle cx="48" cy="48" r="12" fill="none" stroke="#fff" stroke-opacity=".08" stroke-width="1"/>
  </svg>
  <button type="button" class="pq-arm pq-arm-up" data-button="up" aria-label="Up" tabindex="-1"></button>
  <button type="button" class="pq-arm pq-arm-right" data-button="right" aria-label="Right" tabindex="-1"></button>
  <button type="button" class="pq-arm pq-arm-down" data-button="down" aria-label="Down" tabindex="-1"></button>
  <button type="button" class="pq-arm pq-arm-left" data-button="left" aria-label="Left" tabindex="-1"></button>
  <span class="pq-hint pq-hint-dpad" aria-hidden="true">ARROWS / WASD</span>
</div>`;

const ACTIONS = `
<div class="pq-ab" role="group" aria-label="Action buttons">
  <div class="pq-ab-pill">
    <div class="pq-ab-key">
      <button type="button" class="pq-ab-btn" data-button="b" aria-label="B button" tabindex="-1"></button>
      <span class="pq-ab-label" aria-hidden="true">B</span>
    </div>
    <div class="pq-ab-key">
      <button type="button" class="pq-ab-btn" data-button="a" aria-label="A button" tabindex="-1"></button>
      <span class="pq-ab-label" aria-hidden="true">A</span>
    </div>
  </div>
  <span class="pq-hint pq-hint-ab" aria-hidden="true">
    <span><b>A</b> Z · SPACE · ENTER</span>
    <span><b>B</b> X · BKSP</span>
  </span>
</div>`;

const pill = (button: 'select' | 'start', label: string, hint: string): string => `
<button type="button" class="pq-pill-btn pq-${button}" data-button="${button}" aria-label="${label}" tabindex="-1">
  <span class="pq-pill" aria-hidden="true"></span>
  <span class="pq-pill-label" aria-hidden="true">${label.toUpperCase()}</span>
  <span class="pq-hint pq-hint-pill" aria-hidden="true">${hint}</span>
</button>`;

const TEMPLATE = `
<div class="pq-stage">
  <div class="pq-console" data-mode="portrait">
    <div class="pq-top">
      <button type="button" class="pq-switch" role="switch" aria-checked="true" aria-label="Sound" tabindex="-1">
        <span class="pq-switch-label" aria-hidden="true">SOUND</span>
        <span class="pq-switch-track" aria-hidden="true"><span class="pq-switch-knob"></span></span>
        <span class="pq-switch-state" aria-hidden="true">ON</span>
      </button>
    </div>
    <div class="pq-bezel">
      <div class="pq-bezel-head" aria-hidden="true">
        <span class="pq-lines"><i></i><i></i></span>
        <span class="pq-caps">DOT MATRIX · SPORTS SCIENCE EDITION</span>
        <span class="pq-lines"><i></i><i></i></span>
      </div>
      <div class="pq-led" aria-hidden="true"><i></i><span>POWER</span></div>
      <div class="pq-screen">
        <div class="pq-lcd"><canvas class="pq-display" role="img" aria-label="PhysQuest game screen"></canvas></div>
      </div>
    </div>
    <div class="pq-under">
      <div class="pq-brand" aria-hidden="true">
        <span class="pq-logo">PhysQuest</span>
        <span class="pq-tag">SPORTS SCIENCE</span>
      </div>
      <div class="pq-meta">${pill('select', 'Select', 'SHIFT')}${pill('start', 'Start', 'ESC · P')}
      </div>
      <div class="pq-speaker" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>
    </div>
    ${DPAD}
    ${ACTIONS}
  </div>
</div>`;

export interface ConsoleDom {
  stage: HTMLElement;
  body: HTMLElement;
  /** The glass the display canvas sits in; the layout gives it an exact size. */
  screen: HTMLElement;
  /** Sized by script to the display canvas' CSS size; carries the optional LCD grid. */
  lcd: HTMLElement;
  display: HTMLCanvasElement;
  dpad: HTMLElement;
  sound: HTMLButtonElement;
  soundState: HTMLElement;
  /** Every element carrying data-button, per button (the D-pad arms are plain buttons too). */
  controls: Record<Button, HTMLElement[]>;
}

const must = <T extends Element>(parent: ParentNode, selector: string): T => {
  const el = parent.querySelector<T>(selector);
  if (!el) throw new Error(`PhysQuest console: missing ${selector}`);
  return el;
};

export const buildConsoleDom = (root: HTMLElement): ConsoleDom => {
  const host = document.createElement('div');
  host.innerHTML = TEMPLATE.trim();
  const stage = must<HTMLElement>(host, '.pq-stage');
  root.appendChild(stage);

  const controls = {} as Record<Button, HTMLElement[]>;
  for (const button of BUTTONS) {
    controls[button] = Array.from(stage.querySelectorAll<HTMLElement>(`[data-button="${button}"]`));
  }

  return {
    stage,
    body: must<HTMLElement>(stage, '.pq-console'),
    screen: must<HTMLElement>(stage, '.pq-screen'),
    lcd: must<HTMLElement>(stage, '.pq-lcd'),
    display: must<HTMLCanvasElement>(stage, '.pq-display'),
    dpad: must<HTMLElement>(stage, '.pq-dpad'),
    sound: must<HTMLButtonElement>(stage, '.pq-switch'),
    soundState: must<HTMLElement>(stage, '.pq-switch-state'),
    controls,
  };
};
