// The ATHLETE room (Distance Running) through the real RoomChallengeScene, dialogue and pause menu: a full playthrough,
// the score kept apart from the stats, replays keeping the best, the LEAVE? question, and the room gating TESTING.
import { beforeAll, describe, expect, it, vi } from 'vitest';

const announced: string[] = [];
vi.mock('../../src/audio/Sfx', () => ({ sfx: { play: () => {}, isMuted: () => false, toggleMuted: () => {} } }));
vi.mock('../../src/ui/announce', () => ({ announce: (t: string) => void announced.push(t) }));

const H = await import('./harness');
const { setNameSource } = await import('../../src/engine/nameToken');
const { MEET_RUNNING } = await import('../../src/rooms/content/meet-running');
const GS = await import('../../src/state/GameState');

beforeAll(() => {
  H.installFakeDom();
});

interface MeetDebug {
  step: string;
  cursor: number;
  options: string[];
  asked: string[];
  good: number;
  of: number;
  notes: string[];
  shown: number;
  finished: boolean;
}

const GOOD = new Set(MEET_RUNNING.questions.filter(q => q.good).map(q => q.id));

/** Text on the dialogue box's current page. */
const page = (w: H.World): string => (w.dialogue.isActive() ? (w.dialogue.state.pages[w.dialogue.state.page] ?? []).join(' ') : '');

/**
 * Play one visit: A through every line; at each question move to a good one (or a weak one when `pickGood` says no).
 * Returns every page seen.
 */
const play = (w: H.World, pickGood: (n: number) => boolean, maxSteps = 60 * 240): string[] => {
  const seen: string[] = [];
  const before = w.log.completes;
  for (let i = 0; i < maxSteps && w.log.completes === before && w.current() === 'roomChallenge'; i++) {
    const text = page(w);
    if (text && seen[seen.length - 1] !== text) seen.push(text);
    const d = w.scene.debug() as MeetDebug | null;
    if (!w.dialogue.isActive() && d?.step === 'choose') {
      const wanted = pickGood(d.asked.length);
      // the kind wanted, if any of it is left
      const want = d.options.some(o => GOOD.has(o) === wanted) ? wanted : !wanted;
      const id = d.options[d.cursor]!;
      if (GOOD.has(id) !== want) {
        w.press('down', 1, 2);
        continue;
      }
      w.step(24); // past the decision lock
      w.press('a', 1, 3);
      continue;
    }
    w.press('a', 1, 6);
  }
  return seen;
};

const world = async () => {
  const w = await H.makeWorld(3);
  w.gameState.playerName = 'ALAN';
  setNameSource(() => w.gameState.playerName);
  return w;
};

describe('the ATHLETE room', () => {
  it('a full playthrough: she introduces herself by name, good questions fill the notebook, OVERVIEW 5/5, no stat changes', async () => {
    const w = await world();
    const statsBefore = { ...w.gameState.playerStats };
    w.enter('meet');
    const seen = play(w, () => true);
    expect(w.log.completes, 'the room completed').toBe(1);
    expect(seen.join(' ')).toContain("Hi, you must be Alan. I'm Aisha.");
    expect(seen.join(' ')).toMatch(/I'm 26 and I race the women's 5000 m/);
    expect(seen.join(' ')).not.toMatch(/\{NAME\}|\{A\}|\bCoach\b/);
    const meet = GS.meetOf(w.gameState);
    expect(meet).toEqual({ welcomed: false, met: true, best: MEET_RUNNING.asks, of: MEET_RUNNING.asks });
    expect(w.gameState.playerStats, 'the four stats are untouched').toEqual(statsBefore);
    expect(w.gameState.roomProgress, 'no RoomKey is recorded').toEqual(GS.freshRoomProgress());
    expect(w.gameState.challengeResults).toEqual([]);
    expect(w.gameState.returnDoor).toBe('meet');
    expect(H.problems).toEqual([]);
  });

  it('weaker questions write no note and score lower; a replay keeps the best and skips the introduction', async () => {
    const w = await world();
    w.enter('meet');
    play(w, n => n < 2); // two good, then three weaker
    expect(GS.meetOf(w.gameState)).toMatchObject({ met: true, best: 2, of: 5 });
    const seenReplay: string[] = [];
    // replay: all weaker questions (there are only four, so the fifth is good): the best stays 2
    w.enter('meet');
    seenReplay.push(...play(w, () => false));
    expect(seenReplay.join(' ')).not.toContain("I'm Aisha"); // she has been met: no introduction
    expect(GS.meetOf(w.gameState).best).toBe(2);
    expect(seenReplay.join(' ')).toContain('Your best overview stays at 2/5.');
    // and a better replay raises it
    w.enter('meet');
    const better = play(w, () => true);
    expect(better.join(' ')).toContain('New best! Overview now 5/5.');
    expect(GS.meetOf(w.gameState).best).toBe(5);
  });

  it('B before any question quits at once; B after one asks LEAVE? and STAY keeps the conversation', async () => {
    const w = await world();
    w.enter('meet');
    // through the intro and the rules to the first question
    for (let i = 0; i < 400 && (w.scene.debug() as MeetDebug).step !== 'choose'; i++) w.press('a', 1, 6);
    w.step(30);
    expect((w.scene.debug() as MeetDebug).step).toBe('choose');
    w.press('a', 1, 4); // ask
    expect((w.scene.debug() as MeetDebug).asked.length).toBe(1);
    w.press('b', 1, 4); // during her answer
    expect(page(w)).toContain('Leave the chat?');
    expect(w.dialogue.state.choices).toEqual(['STAY', 'LEAVE']);
    w.press('b', 1, 4); // B on the question: stay
    expect(w.current()).toBe('roomChallenge');
    expect((w.scene.debug() as MeetDebug).asked.length).toBe(1);
    // leave for real: B, then (once the question has been typed out) pick LEAVE
    w.press('b', 1, 120);
    w.press('down', 1, 30);
    w.press('a', 1, 4);
    expect(w.current()).toBe('overworld');
    expect(GS.meetOf(w.gameState).met, 'nothing recorded').toBe(false);
    expect(w.gameState.resumeRoom).toBe(true);

    const w2 = await world();
    w2.enter('meet');
    for (let i = 0; i < 400 && (w2.scene.debug() as MeetDebug).step !== 'choose'; i++) w2.press('a', 1, 6);
    w2.step(30);
    w2.press('b', 1, 4);
    expect(w2.current(), 'nothing asked: B just quits').toBe('overworld');
  });

  it('ignores A for 0.35 s when the question list appears', async () => {
    const w = await world();
    w.enter('meet');
    for (let i = 0; i < 400 && (w.scene.debug() as MeetDebug).step !== 'choose'; i++) w.press('a', 1, 1);
    expect((w.scene.debug() as MeetDebug).step).toBe('choose');
    w.press('a', 1, 1); // straight away: too soon
    expect((w.scene.debug() as MeetDebug).asked.length).toBe(0);
  });
});

describe('the ATHLETE room gates TESTING (Distance Running only)', () => {
  it('locks TESTING until the athlete is met, and points the arrow at the ATHLETE door first', () => {
    const s = GS.createInitialState();
    GS.activateLevel(s, 3);
    s.meetRoom = true;
    expect(GS.roomUnlocked(s, 'testSelection')).toBe(false);
    expect(GS.nextDoor(s)).toBe('meet');
    expect(GS.roomsTotal(s)).toBe(5);
    expect(GS.allRoomsComplete(s)).toBe(false);
    GS.meetOf(s).met = true;
    expect(GS.roomUnlocked(s, 'testSelection')).toBe(true);
    expect(GS.nextDoor(s)).toBe('room1');
    expect(GS.roomsCompleted(s)).toBe(1);
    for (const k of GS.ROOM_KEYS) s.roomProgress[k] = true;
    expect(GS.allRoomsComplete(s)).toBe(true);
    expect(GS.nextDoor(s)).toBe('boss');
  });

  it('a visit without the ATHLETE room (classic levels, or a classic fallback) plays exactly as before', () => {
    for (const level of [0, 1, 2, 3]) {
      const s = GS.createInitialState();
      GS.activateLevel(s, level);
      expect(s.meetRoom).toBe(false);
      expect(GS.roomUnlocked(s, 'testSelection')).toBe(true);
      expect(GS.roomUnlocked(s, 'variableId')).toBe(false);
      expect(GS.nextDoor(s)).toBe('room1');
      expect(GS.roomsTotal(s)).toBe(4);
    }
  });

  it('the overview never changes the showdown rating', () => {
    const s = GS.createInitialState();
    GS.activateLevel(s, 3);
    s.meetRoom = true;
    s.playerStats = { speed: 0.5, strength: 0.6, endurance: 0.7, power: 0.8 };
    const before = GS.showdownRating(s.playerStats, 'power');
    Object.assign(GS.meetOf(s), { met: true, best: 5, of: 5 });
    expect(GS.showdownRating(s.playerStats, 'power')).toBe(before);
  });
});

describe('save round-trip', () => {
  it('saves the welcome and the meeting per level (v3), and loads v2 saves (a level under way counts as met, unscored)', async () => {
    const { saveGame, loadSave, applySave } = await import('../../src/systems/SaveSystem');
    const s = GS.createInitialState();
    s.playerName = 'ALAN';
    GS.activateLevel(s, 3);
    s.meetRoom = true;
    Object.assign(GS.meetOf(s), { welcomed: true, met: true, best: 4, of: 5 });
    expect(saveGame(s)).toBe(true);
    const save = loadSave()!;
    expect(save.version).toBe(3);
    expect(save.meet[3]).toEqual({ welcomed: true, met: true, best: 4, of: 5 });
    expect(save.meet[0]).toEqual(GS.freshMeet());
    const back = GS.createInitialState();
    applySave(back, save);
    expect(back.meet[3]).toEqual({ welcomed: true, met: true, best: 4, of: 5 });
    expect(back.meetRoom, 'set again when the level starts').toBe(false);

    // a v2 save (before the ATHLETE room): everything else kept; the level under way counts as welcomed and met
    localStorage.setItem(
      'physquest_save',
      JSON.stringify({
        version: 2,
        playerName: 'ALAN',
        bossDefeated: [false, false, false, false],
        gameComplete: false,
        currentLevel: 3,
        levelProgress: [null, null, null, { roomProgress: { testSelection: true, variableId: false, trainingPrescription: false, performancePrediction: false }, playerStats: { speed: 0.8, strength: 0, endurance: 0, power: 0 } }],
      }),
    );
    const v2 = loadSave()!;
    expect(v2.version).toBe(3);
    expect(v2.currentLevel).toBe(3);
    expect(v2.levelProgress[3]?.playerStats.speed).toBe(0.8);
    expect(v2.meet).toEqual([GS.freshMeet(), GS.freshMeet(), GS.freshMeet(), { welcomed: true, met: true, best: 0, of: 0 }]);
    // ...so its finished rooms and arena are not locked behind the new ATHLETE room
    const resumed = GS.createInitialState();
    applySave(resumed, v2);
    GS.activateLevel(resumed, 3);
    resumed.meetRoom = true;
    expect(GS.roomUnlocked(resumed, 'variableId')).toBe(true);

    // a malformed meet entry reads as not done
    localStorage.setItem('physquest_save', JSON.stringify({ ...save, meet: [null, 'x', { met: 'yes', best: 99, of: 5 }, { welcomed: true, met: true, best: -3, of: NaN }] }));
    const odd = loadSave()!;
    expect(odd.meet[2]).toEqual({ welcomed: false, met: false, best: 5, of: 5 });
    expect(odd.meet[3]).toEqual({ welcomed: true, met: true, best: 0, of: 0 });
  });
});
