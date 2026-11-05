// Round 3: random pin-phase play against the Data Lab's LOCK IN rules (commit 54327e9).
//  I1  the pins are never locked in less than 0.35 s after the cursor landed on LOCK IN.
//  I2  an A on a pin row (no decision lock running) always toggles / refuses, whatever LOCK IN did a moment before.
//  I3  an A on LOCK IN, 0.35 s or more after arriving (and no other lock running) does lock in.
import { describe, expect, it, vi } from 'vitest';
vi.mock('../../src/audio/Sfx', () => ({ sfx: { play: () => {}, isMuted: () => false, toggleMuted: () => {} } }));
const announced: string[] = [];
vi.mock('../../src/ui/announce', () => ({ announce: (t: string) => void announced.push(t) }));
const { makeRig, tap, idle, DT, cleanAll } = await import('../datalab-rig');
type Rig = ReturnType<typeof makeRig>;

const reachPin = (seed: number): Rig | null => {
  const rig = makeRig(seed, { firstVisit: false });
  cleanAll(rig, () => seed % 2 === 0); // right or wrong, it does not matter here
  for (let g = 0; g < 40 && rig.talking(); g++) rig.closeDialogue();
  rig.wait(0.5);
  return rig.debug().phase === 'pin' ? rig : null;
};

const rnd = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const GAPS = [0, 1, 2, 4, 6, 10, 16, 20, 21, 22, 24, 30, 45];

describe('Data Lab LOCK IN wait under random play', () => {
  it('keeps I1, I2 and I3 over many random pin sessions', () => {
    let sessions = 0;
    let lockIns = 0;
    let toggles = 0;
    const problems: string[] = [];
    for (let seed = 1; seed <= 150; seed++) {
      const rig = reachPin(seed);
      if (!rig) continue;
      sessions++;
      const rand = rnd(seed * 977);
      const rows = rig.debug().list.length;
      let step = 0; // steps since the session began
      let arrived = -1; // the step at which the cursor last landed on LOCK IN (-1: not on it)
      let lastCursor = rig.debug().cursor;
      let lastToggle = -999;
      const run = (inp = idle()) => {
        rig.step(inp);
        step++;
        const c = rig.debug().cursor;
        if (c !== lastCursor) {
          arrived = c === rows ? step : -1;
          lastCursor = c;
        }
      };
      for (let action = 0; action < 70 && rig.debug().phase === 'pin'; action++) {
        const roll = rand();
        const button = roll < 0.3 ? 'up' : roll < 0.6 ? 'down' : 'a';
        // make sure no dialogue (the first-visit question, leave questions) is in the way
        if (rig.talking()) {
          rig.closeDialogue();
          continue;
        }
        const before = rig.debug();
        const onRow = before.cursor < rows;
        const pinnedBefore = onRow ? before.list[before.cursor]!.pinned : false;
        const sinceArrive = arrived < 0 ? -1 : (step - arrived) * DT;
        const lockedBefore = before.locked;
        const sinceToggle = (step - lastToggle) * DT;
        run(tap(button as 'up' | 'down' | 'a'));
        const after = rig.debug();
        if (button === 'a') {
          if (before.cursor === rows) {
            // A on LOCK IN: it asks first (STAY / LOCK IN); answering LOCK IN locks in
            if (rig.talking()) {
              if (sinceArrive >= 0 && sinceArrive < 0.35 - 1e-9) problems.push(`I1 seed ${seed}: asked to lock in ${sinceArrive.toFixed(3)} s after arriving`);
              rig.pick(1);
              if (rig.debug().phase === 'reveal') lockIns++;
              else problems.push(`seed ${seed}: LOCK IN answered but no reveal`);
              break;
            } else if (sinceArrive >= 0.36 && !lockedBefore) {
              problems.push(`I3 seed ${seed}: A on LOCK IN ${sinceArrive.toFixed(3)} s after arriving did nothing (locked=${lockedBefore})`);
            }
          } else if (onRow && !lockedBefore && sinceToggle > 0.2) {
            // A on a pin row with no lock running: it must toggle or refuse the 4th pin
            const expected = pinnedBefore ? before.pins.length - 1 : before.pins.length < before.pinLimit ? before.pins.length + 1 : before.pins.length;
            toggles++;
            if (after.pins.length !== expected) problems.push(`I2 seed ${seed}: A on row ${before.cursor} (pinned=${pinnedBefore}, ${before.pins.length} pins) gave ${after.pins.length} pins, expected ${expected}; since arriving on LOCK IN ${sinceArrive}`);
            lastToggle = step;
          }
        }
        // a random gap before the next press
        const gap = GAPS[Math.floor(rand() * GAPS.length)]!;
        for (let i = 0; i < gap; i++) run();
      }
    }
    // eslint-disable-next-line no-console
    console.log(`r3 lock-in fuzz: ${sessions} sessions, ${toggles} pin-row presses, ${lockIns} lock-ins, ${problems.length} problems`);
    for (const p of problems.slice(0, 15)) console.log(p);
    expect(sessions).toBeGreaterThan(100);
    expect(lockIns).toBeGreaterThan(20);
    expect(problems).toEqual([]);
  });
});
