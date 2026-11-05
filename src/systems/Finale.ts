// The case study's ending (Phase 4: results, evaluation and conclusion), built from the race's result and the
// support scores: back in the hub, Aisha on the race, then Dr Ellis's debrief (a shorter one after a defeat). The
// lines are in rooms/content/finale-running.ts; this fills their tokens. OverworldScene plays the talk.
import type { Speaker } from '../render/DialogueBox';
import { DIRECTOR_SPEAKER, athleteSpeaker } from '../data/speakers';
import type { FinaleContent } from '../rooms/content/finale-running';
import { EVAL_STRONG } from '../rooms/content/finale-running';
import { STAT_KEYS, type LevelResult, type PlayerStats, type RaceSummary, type StatKey } from '../state/GameState';
import { raceClock } from './RaceModel';
import { SCORE_LABEL, roomOfScore, showdownFocus } from './SupportScores';

/** One speaker's pages; a talk is several, played in order. */
export interface TalkPart {
  speaker: Speaker;
  pages: string[];
}

const pct = (v: number): number => Math.round(Math.max(0, Math.min(1, v)) * 100);

/** How far from the line the gauge ran dry, as the advice says it: "250 M", "A LAP", "1.5 LAPS". */
export const distText = (m: number): string => {
  if (m < 350) return `${Math.max(10, Math.round(m / 50) * 50)} M`;
  if (m < 600) return 'A LAP';
  return `${Math.round(m / 200) / 2} LAPS`;
};

/** The defeat advice for a race the science could have won (capitals, for the results screen). */
export const raceAdvice = (content: FinaleContent, race: RaceSummary): string =>
  race.kick === 'early'
    ? content.race.advice.early.replace('{DIST}', distText(race.emptyToGo))
    : content.race.advice.late.replace('{PCT}', String(Math.max(1, pct(race.unused))));

/** The strongest and weakest support scores (the first in room order on a tie), or null when all four are level. */
export const strongestWeakest = (stats: PlayerStats): { strong: StatKey; weak: StatKey } | null => {
  let strong: StatKey = STAT_KEYS[0]!;
  let weak: StatKey = STAT_KEYS[0]!;
  for (const k of STAT_KEYS) {
    if (stats[k] > stats[strong]) strong = k;
    if (stats[k] < stats[weak]) weak = k;
  }
  return pct(stats[strong]) === pct(stats[weak]) ? null : { strong, weak };
};

const boardLine = (stats: PlayerStats, line: string, even: string): string => {
  const sw = strongestWeakest(stats);
  if (!sw) return even.replace('{STRONG_PCT}', String(pct(stats[STAT_KEYS[0]!])));
  return line
    .replace('{STRONG}', SCORE_LABEL[sw.strong])
    .replace('{STRONG_PCT}', String(pct(stats[sw.strong])))
    .replace('{WEAK}', SCORE_LABEL[sw.weak])
    .replace('{WEAK_PCT}', String(pct(stats[sw.weak])));
};

const fill = (lines: readonly string[], r: LevelResult): string[] => {
  const focus = showdownFocus(r.level);
  return lines.map(line =>
    line
      .replace('{TIME}', r.race ? raceClock(r.race.time) : '')
      .replace('{RIVAL_TIME}', r.race ? raceClock(r.race.rivalTime) : '')
      .replace('{EVAL_PCT}', String(pct(r.stats.power)))
      .replace('{FOCUS}', SCORE_LABEL[focus])
      .replace('{ROOM}', roomOfScore(focus)),
  );
};

/** Why a race was lost: the rating could not beat the TARGET, no A at all, or the kick's timing. */
const lossReason = (r: LevelResult): 'rating' | 'idle' | 'early' | 'late' => {
  if (r.rating <= r.rivalScore) return 'rating';
  if (r.idle) return 'idle';
  return r.race?.kick === 'early' ? 'early' : 'late';
};

/** The talk back in the hub after the race: the full debrief after a win, a shorter one after a defeat. */
export const finaleTalk = (content: FinaleContent, r: LevelResult): TalkPart[] => {
  const athlete = athleteSpeaker(r.level);
  if (r.outcome !== 'lose') {
    const d = content.win.director;
    return [
      { speaker: athlete, pages: fill(content.win.athlete, r) },
      {
        speaker: DIRECTOR_SPEAKER,
        pages: fill(
          [
            ...d.opening,
            ...d.found,
            boardLine(r.stats, d.board, d.boardEven),
            ...(r.stats.power >= EVAL_STRONG ? d.real.strong : d.real.weak),
            ...d.next,
            ...d.thanks,
          ],
          r,
        ),
      },
    ];
  }
  const reason = lossReason(r);
  const d = content.lose.director;
  return [
    { speaker: athlete, pages: fill(content.lose.athlete[reason], r) },
    {
      speaker: DIRECTOR_SPEAKER,
      pages: fill([...(reason === 'rating' ? d.rating : d.kick), boardLine(r.stats, d.board, d.boardEven), ...d.stay], r),
    },
  ];
};
