// The support scores (what the four stats are called on screen), the showdown's focus per level, and the SUPPORT
// BOARD's text: the lines it shows, what it says to a screen reader, and Dr Ellis's provisional board lines.
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

vi.mock('../src/audio/Sfx', () => ({ sfx: { play: () => {}, isMuted: () => false, toggleMuted: () => {} } }));

const GS = await import('../src/state/GameState');
const SS = await import('../src/systems/SupportScores');
const SB = await import('../src/render/SupportBoard');
const { MINIGAME_FOR_STAT, rivalFinalScore, roomLabelForStat } = await import('../src/systems/BossMinigame');
const { LEVEL_DATA } = await import('../src/data/sports');
const { BOARD_RUNNING, boardContentFor } = await import('../src/rooms/content/board-running');
const { wrapText } = await import('../src/render/DialogueBox');
const { measureText } = await import('../src/render/PixelFont');
const { objectivesSummary } = await import('../src/render/OverworldHud');
const { DIRECTOR_HUB } = await import('../src/data/rooms/hub');
const { HUB_MAP } = await import('../src/data/maps');
const { BOARD_KEY, BOARD_RECT, BOARD_SPOTS } = await import('../src/data/supportBoard');

const running = () => {
  const s = GS.createInitialState();
  GS.activateLevel(s, 3);
  s.meetRoom = true;
  return s;
};

describe('the support scores', () => {
  it('name each stat after the work its room grades, keeping the save keys', () => {
    expect(GS.STAT_KEYS).toEqual(['speed', 'strength', 'endurance', 'power']);
    expect(GS.ROOM_KEYS.map(k => SS.SCORE_LABEL[GS.ROOM_STAT[k]])).toEqual(['TEST CHOICE', 'DATA INSIGHT', 'TRAINING PLAN', 'EVALUATION']);
    expect(GS.ROOM_KEYS.map(k => SS.SCORE_SHORT[GS.ROOM_STAT[k]])).toEqual(['TEST', 'DATA', 'PLAN', 'EVAL']);
    expect(GS.STAT_KEYS.map(k => roomLabelForStat(k))).toEqual(['TESTING', 'DATA', 'TRAINING', 'ANALYSIS']);
    expect(SS.scoreSpoken('endurance')).toBe('training plan score');
  });

  it('no on-screen code names a stat after an athlete quality any more', () => {
    for (const file of ['scenes/BossBattleScene.ts', 'scenes/LevelClearScene.ts', 'scenes/RoomChallengeScene.ts', 'render/OverworldHud.ts']) {
      const src = readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8');
      expect(src, file).not.toMatch(/'SPEED'|'STRENGTH'|'ENDURANCE'|'POWER'|statKey\.toUpperCase/);
    }
  });

  it('the objectives panel says which score each room gives', () => {
    const s = running();
    s.roomProgress.testSelection = true;
    s.playerStats.speed = 0.85;
    expect(objectivesSummary(s)).toMatch(/TESTING gives the test choice score, 85 percent\. DATA gives the data insight score, /);
  });
});

describe('the showdown focus', () => {
  it('is TRAINING PLAN in Distance Running, whose bout stays the POWER SURGE', () => {
    expect(LEVEL_DATA[3]!.sport).toBe('Distance Running');
    expect(SS.showdownFocus(3)).toBe('endurance');
    expect(SS.boutStat(3)).toBe('power');
    expect(MINIGAME_FOR_STAT[SS.boutStat(3)]).toBe('power');
  });

  it('keeps the classic levels on their sport\'s boss stat (relabelled)', () => {
    for (const level of [0, 1, 2]) expect(SS.showdownFocus(level)).toBe(LEVEL_DATA[level]!.bossStat);
  });

  it('weights the focus score 70% and the mean of all four 30%', () => {
    const s = running();
    Object.assign(s.playerStats, { speed: 0.9, strength: 0.6, endurance: 0.8, power: 0.5 });
    expect(SS.levelRating(s)).toBeCloseTo(0.7 * 0.8 + 0.3 * 0.7, 9);
    expect(SS.levelRating(s)).toBe(GS.showdownRating(s.playerStats, 'endurance'));
  });

  it('gives the board the same TARGET as the arena, unchanged by the new focus', () => {
    for (let level = 0; level < LEVEL_DATA.length; level++) {
      const stat = LEVEL_DATA[level]!.bossStat;
      expect(SS.showdownTarget(level)).toBe(rivalFinalScore(MINIGAME_FOR_STAT[stat], SS.rivalCeilingFor(level, stat)));
    }
    expect(Math.round(SS.showdownTarget(3) * 100)).toBe(53); // 0.7 x 0.75, as before
  });
});

describe('the SUPPORT BOARD', () => {
  it('hangs only in the Director\'s hub, faced from the three floor tiles below it', () => {
    expect(BOARD_SPOTS.map(e => `${e.x},${e.y}`)).toEqual(['1,0', '2,0', '3,0']);
    for (const spot of BOARD_SPOTS) {
      expect(DIRECTOR_HUB.equipment).toContainEqual(spot);
      expect(GS.ROOM_KEYS).toBeDefined();
      expect(DIRECTOR_HUB.tiles[spot.y + 1]![spot.x], 'a floor tile to stand on').toBe(1);
    }
    expect(HUB_MAP.equipment.some(e => e.dialogueKey === BOARD_KEY)).toBe(false);
    // on the wall over tiles 1-3, clear of the corner tile and the SELECT hint (x 68 or more)
    expect(BOARD_RECT.x).toBeGreaterThanOrEqual(16);
    expect(BOARD_RECT.x + BOARD_RECT.w).toBeLessThanOrEqual(66);
    expect(BOARD_RECT.y + BOARD_RECT.h).toBeLessThanOrEqual(16);
    expect(DIRECTOR_HUB.describe).toContain('SUPPORT BOARD');
  });

  it('shows -- for a room not done, the score once it is, the overview, the rating, the target and the ARENA', () => {
    const s = running();
    expect(SB.boardLines(s, BOARD_RUNNING.note)).toEqual([
      'SUPPORT BOARD',
      'SCORES GRADE YOUR WORK, NOT AISHA',
      'TEST CHOICE --',
      'DATA INSIGHT --',
      'TRAINING PLAN --',
      'EVALUATION --',
      'ATHLETE OVERVIEW --',
      'SHOWDOWN RATING 0%',
      'RIVAL TARGET 53%',
      '70% TRAINING PLAN + 30% ALL FOUR',
      'ARENA: LOCKED (0/5 ROOMS)',
    ]);
    Object.assign(GS.meetOf(s), { met: true, best: 4, of: 5 });
    s.roomProgress.testSelection = true;
    s.playerStats.speed = 0.85;
    const lines = SB.boardLines(s, BOARD_RUNNING.note);
    expect(lines).toContain('TEST CHOICE 85%');
    expect(lines).toContain('ATHLETE OVERVIEW 4/5');
    expect(lines).toContain(`SHOWDOWN RATING ${Math.round(0.3 * 0.85 / 4 * 100)}%`);
    expect(lines).toContain('ARENA: LOCKED (2/5 ROOMS)');
  });

  it('says when the ARENA waits on Dr Ellis, and when it is open', () => {
    const s = running();
    Object.assign(GS.meetOf(s), { met: true, best: 5, of: 5 });
    for (const k of GS.ROOM_KEYS) s.roomProgress[k] = true;
    expect(SB.arenaText(s)).toBe('ARENA: TALK TO DR ELLIS');
    GS.meetOf(s).heard.performancePrediction = true;
    expect(SB.arenaText(s)).toBe('ARENA: OPEN');
  });

  it('reads the whole board to a screen reader', () => {
    const s = running();
    s.roomProgress.testSelection = true;
    s.playerStats.speed = 0.85;
    const said = SB.boardSummary(s, BOARD_RUNNING.noteSpoken, 'SPACE');
    expect(said).toBe(
      'Support board. Scores grade your work, not Aisha. Test choice score, 85 percent. Data insight score, not yet. ' +
        'Training plan score, not yet. Evaluation score, not yet. Athlete overview, not yet. Showdown rating 6 percent: ' +
        '70 percent training plan score, 30 percent all four. Rival target 53 percent. Arena locked, 1 of 5 rooms done. SPACE closes.',
    );
  });

  it('fits every panel line in the box (names clear of the bars, values right-aligned inside)', () => {
    const left = 20;
    const barStart = left + 84 + 6;
    for (const k of GS.STAT_KEYS) expect(left + measureText(SS.SCORE_LABEL[k]) + 3 + measureText('*'), k).toBeLessThan(barStart);
    for (const line of [BOARD_RUNNING.note, `*${SB.ratingRule(3)}`, 'ARENA: TALK TO DR ELLIS', 'ARENA: LOCKED (4/5 ROOMS)']) {
      expect(left + measureText(line), line).toBeLessThanOrEqual(236);
    }
    expect(measureText('SUPPORT BOARD', 2)).toBeLessThanOrEqual(216);
  });
});

describe("Dr Ellis's board lines (provisional)", () => {
  it('belong to Distance Running only', () => {
    expect(boardContentFor(3)).toBe(BOARD_RUNNING);
    for (const level of [0, 1, 2]) expect(boardContentFor(level)).toBeUndefined();
  });

  it('name the score each check-in has just set, with its percent', () => {
    for (const k of GS.ROOM_KEYS) {
      expect(BOARD_RUNNING.checkIn[k], k).toContain(SS.SCORE_LABEL[GS.ROOM_STAT[k]]);
      expect(BOARD_RUNNING.checkIn[k], k).toContain('{PCT}%');
    }
  });

  it('name all four scores and the focus in the welcome, and point at the board', () => {
    const text = BOARD_RUNNING.welcome.join(' ');
    for (const k of GS.STAT_KEYS) expect(text).toContain(SS.SCORE_LABEL[k]);
    expect(text).toContain('SUPPORT BOARD');
    expect(text).toContain('{A}');
  });

  it('each fit one dialogue page, in the font', () => {
    const font = readFileSync(new URL('../src/render/PixelFont.ts', import.meta.url), 'utf8');
    const glyphs = new Set<string>([' ']);
    for (const m of font.matchAll(/^\s*(?:'(.)'|"(.)"|([A-Z0-9])):\s*\[/gm)) glyphs.add((m[1] ?? m[2] ?? m[3])!);
    // the longest names the tokens can take: a 10-letter name, SPACE for {A}, 100 for {PCT}
    const fill = (t: string) => t.replace('{NAME}', 'ABCDEFGHIJ').replace('{A}', 'SPACE').replace('{PCT}', '100');
    for (const line of [...BOARD_RUNNING.welcome, ...Object.values(BOARD_RUNNING.checkIn)]) {
      expect(wrapText(fill(line)).length, line).toBeLessThanOrEqual(4);
      for (const ch of fill(line).toUpperCase()) expect(glyphs.has(ch), `${ch} in ${line}`).toBe(true);
    }
    expect(BOARD_RUNNING.note.length).toBeLessThanOrEqual(34);
  });
});
