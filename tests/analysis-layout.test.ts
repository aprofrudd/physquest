// Everything the board writes must fit the panel with room to spare, whatever the content says: if a verdict or a
// metric gets longer, this fails before a word runs into a border on a phone.
import { describe, expect, it } from 'vitest';
import { measureText } from '../src/render/PixelFont';
import { DIALOGUE_BOX, optionListHeight, wrapText } from '../src/render/DialogueBox';
import { STAGE } from '../src/rooms/frame';
import { RUNNING } from '../src/rooms/content/running';
import {
  VERDICTS,
  beforeLabel,
  betterLabel,
  guessLabel,
  improvementOf,
  noiseLabel,
  worthLabel,
  pinImprovement,
  plain,
  readoutFor,
  scaleFor,
  summaryOf,
  ticksFor,
  judgeText,
  titleOf,
} from '../src/rooms/analysis/model';
import {
  BESIDE_ICON,
  FALL,
  FALL_2,
  FIRST_ROW,
  GEOMETRY,
  GEOMETRY_2,
  ICON_X,
  LEFT,
  PANEL_H,
  REPORT_ROW,
  RIGHT,
  SECOND_ROW,
  guessPlateX,
  guessSpan,
} from '../src/rooms/analysis/board';
import { LEGEND_X, xOf } from '../src/rooms/analysis/ruler';

const { trained, decoy, verdicts, step } = RUNNING.analysis;
const width = (text: string) => measureText(text) - 1;

/** The panel's paper runs from STAGE.x + 4 to STAGE.x + STAGE.w - 4; text keeps 2px clear of that. */
const INNER_LEFT = STAGE.x + 4 + 2;
const INNER_RIGHT = STAGE.x + STAGE.w - 4 - 2;

const fits = (label: string, x: number, text: string) => {
  expect(x, label).toBeGreaterThanOrEqual(INNER_LEFT);
  expect(x + width(text), `${label}: "${text}" ends at ${x + width(text)}`).toBeLessThanOrEqual(INNER_RIGHT);
};

describe('the board\'s words fit the panel', () => {
  it('has margins that leave 2px clear of the border', () => {
    expect(LEFT).toBeGreaterThanOrEqual(INNER_LEFT);
    expect(RIGHT).toBeLessThanOrEqual(INNER_RIGHT);
    expect(ICON_X).toBeGreaterThanOrEqual(INNER_LEFT);
    expect(BESIDE_ICON).toBeGreaterThan(ICON_X + 5 + 2); // a tick is 5px wide, and a gap before the text
  });

  it('fits both headings with which way is better beside them, and the finished row\'s summary with its tick', () => {
    fits('trained title', LEFT, titleOf(trained));
    expect(LEFT + width(titleOf(trained))).toBeLessThan(RIGHT - width(betterLabel(trained)) - 6);
    const decoyTitle = `${titleOf(decoy)} ${plain(decoy.baseline)} → ${plain(decoy.retest)}`;
    fits('decoy title', LEFT, decoyTitle);
    expect(LEFT + width(decoyTitle)).toBeLessThan(RIGHT - width(betterLabel(decoy)) - 6);
    fits('summary + tick', LEFT, `${summaryOf(trained)}  ✓`);
    fits('summary + tick', LEFT, `${summaryOf(decoy)}  ✓`);
  });

  it('fits every verdict in the stamp, the report and the question list', () => {
    for (const verdict of verdicts) {
      fits('said', BESIDE_ICON, `YOU SAID: ${verdict}`);
      fits('truth', BESIDE_ICON, `IT IS: ${verdict}`);
      fits('report', BESIDE_ICON, verdict);
    }
    expect(verdicts).toHaveLength(VERDICTS.length);
  });

  it('fits the report\'s heads and its forecast lines at their longest', () => {
    for (const row of [trained, decoy]) fits('report head', BESIDE_ICON, summaryOf(row));
    const scale = scaleFor(trained);
    const range = { worse: Math.round(scale.worse / step), better: Math.round(scale.better / step) };
    for (const steps of [range.worse, 0, range.better]) {
      fits('forecast head', BESIDE_ICON, readoutFor(trained, steps, step));
    }
    fits('off by', BESIDE_ICON, 'OFF BY 99.9: OUTSIDE THE ERROR BARS');
    fits('caption', LEFT, 'OUTSIDE THE ERROR BARS');
  });

  it('fits the first row\'s keys and BEFORE, with the noise and worthwhile words in full', () => {
    fits('noise key', LEFT + 13, noiseLabel(trained));
    fits('worth key', LEFT + 10, worthLabel(trained));
    const pole = xOf(GEOMETRY, scaleFor(trained), 0);
    const before = beforeLabel(trained);
    fits('before', Math.round(pole - width(before) / 2), before);
    // BEFORE ends left of LAST BLOCKS (the earlier blocks' label on the same row)
    const lastBlocks = Math.max(...RUNNING.analysis.history.map(h => xOf(GEOMETRY, scaleFor(trained), h))) - 6;
    expect(Math.round(pole + width(before) / 2) + 4).toBeLessThan(lastBlocks);
    fits('last blocks', lastBlocks, 'LAST BLOCKS');
  });

  it('keeps YOUR GUESS\'s label and arrows inside the panel wherever it goes, and between the numbers and the chips', () => {
    const scale = scaleFor(trained);
    const range = { worse: Math.round(scale.worse / step), better: Math.round(scale.better / step) };
    for (let k = range.worse; k <= range.better; k++) {
      const text = guessLabel(trained, k, step);
      const x = xOf(GEOMETRY, scale, pinImprovement(k, step));
      const left = guessPlateX(x, text) - 7; // the left arrow
      expect(left, text).toBeGreaterThanOrEqual(LEFT);
      expect(left + guessSpan(text), text).toBeLessThanOrEqual(RIGHT);
    }
    const numbersBottom = GEOMETRY.axisY + GEOMETRY.half + 6 + GLYPH - 1;
    expect(FIRST_ROW.guess - 2 - numbersBottom).toBeGreaterThanOrEqual(2); // the plate's border starts 2px above the words
    expect(128 - (FIRST_ROW.guess + 8)).toBeGreaterThanOrEqual(2); // the chips start at y 128
  });

  it('fits the two chips side by side', () => {
    const chip = (text: string) => width(`  ${text}`) + 6;
    expect(chip('BEYOND NOISE') + 8 + chip('WORTHWHILE')).toBeLessThanOrEqual(INNER_RIGHT - INNER_LEFT);
  });
});

describe('the room\'s sentences fit the dialogue box', () => {
  // the longest name each button can have (SPACE for {A}, the rest as written)
  const longest = (text: string) => text.replace(/\{A\}/g, 'SPACE').replace(/\{LEFT\}/g, 'LEFT').replace(/\{RIGHT\}/g, 'RIGHT');

  it('fits the forecast prompt in the four lines of the box, and each walk-through page on one page', () => {
    expect(wrapText(longest(RUNNING.analysis.forecastAsk)).length).toBeLessThanOrEqual(DIALOGUE_BOX.lines);
    for (const page of RUNNING.analysis.rules) expect(wrapText(page).length, page).toBeLessThanOrEqual(DIALOGUE_BOX.lines);
    expect(wrapText(RUNNING.analysis.rulesShort).length).toBeLessThanOrEqual(DIALOGUE_BOX.lines);
    expect(RUNNING.analysis.forecastAsk).toContain('YOUR GUESS');
    expect(RUNNING.analysis.rules.join(' ') + RUNNING.analysis.rulesShort + RUNNING.analysis.forecastAsk).not.toMatch(/\bpin\b/i);
  });

  it('fits the verdict question in one page', () => {
    for (const row of [trained, decoy]) expect(wrapText(judgeText(RUNNING.analysis, row)).length).toBeLessThanOrEqual(DIALOGUE_BOX.lines);
  });
});

describe('the ruler fits the panel', () => {
  it('keeps every tick label, the guess and the ends of the axis inside the panel, for both rows', () => {
    for (const row of [trained, decoy]) {
      const scale = scaleFor(row);
      for (const tick of ticksFor(row, scale)) {
        const x = xOf(GEOMETRY, scale, tick.improvement);
        const text = String(tick.value);
        expect(x - width(text) / 2, `${row.metric} ${text}`).toBeGreaterThanOrEqual(INNER_LEFT);
        expect(x + width(text) / 2, `${row.metric} ${text}`).toBeLessThanOrEqual(INNER_RIGHT);
      }
      expect(xOf(GEOMETRY, scale, scale.worse)).toBe(GEOMETRY.x0);
      expect(xOf(GEOMETRY, scale, scale.better)).toBe(GEOMETRY.x1);
      expect(GEOMETRY.x0 - 8).toBeGreaterThanOrEqual(INNER_LEFT); // the axis starts inside
      expect(GEOMETRY.x1 + 8).toBeLessThanOrEqual(INNER_RIGHT); // and ends inside, arrowhead included
      expect(GEOMETRY.x0 - 6).toBeGreaterThanOrEqual(INNER_LEFT); // the guess's triangle at the far end is 13px wide
      expect(GEOMETRY.x1 + 6).toBeLessThanOrEqual(INNER_RIGHT);
    }
  });

  it('puts the retest, the gold lines and the whiskers inside the ruler', () => {
    for (const row of [trained, decoy]) {
      const scale = scaleFor(row);
      const retest = row.better === 'higher' ? row.retest - row.baseline : row.baseline - row.retest;
      for (const improvement of [retest - row.te, retest + row.te, row.swc, -row.swc, row.te, -row.te]) {
        const x = xOf(GEOMETRY, scale, improvement);
        expect(x, `${row.metric} ${improvement}`).toBeGreaterThanOrEqual(GEOMETRY.x0);
        expect(x, `${row.metric} ${improvement}`).toBeLessThanOrEqual(GEOMETRY.x1);
      }
    }
  });

  it('moves YOUR GUESS about 5px a step, never skipping a pixel column by more than 6', () => {
    const scale = scaleFor(trained);
    let last = xOf(GEOMETRY, scale, scale.worse);
    for (let k = -14; k <= 25; k++) {
      const x = xOf(GEOMETRY, scale, pinImprovement(k, step));
      expect(x - last).toBeGreaterThanOrEqual(4);
      expect(x - last).toBeLessThanOrEqual(7);
      last = x;
    }
  });
});

// ---- the second row's board: room between its lines, and nothing crossing anything ---------------------------------------

/** Glyphs are 7px tall; every mark of a legend entry sits within y - 1 .. y + 7. */
const GLYPH = 7;
const LEGEND_TOP = -1;
const LEGEND_BOTTOM = 7;
const MARK = 4; // the dot's half height (9px across)
/** The panel's paper: its border is 4px thick on every side. */
const PAPER_TOP = STAGE.y + 4;
const PAPER_BOTTOM = STAGE.y + PANEL_H - 5; // the last row of paper

describe('the second row\'s board', () => {
  it('keeps its lines ten pixels apart, down from the summary to the legend', () => {
    const rows = [SECOND_ROW.summary, SECOND_ROW.divider, SECOND_ROW.title, SECOND_ROW.legend];
    for (let i = 1; i < rows.length; i++) expect((rows[i] as number) - (rows[i - 1] as number), `line ${i}`).toBeGreaterThanOrEqual(10);
  });

  it('keeps every first line two pixels clear of the panel\'s top edge, and the report clear of its bottom edge', () => {
    for (const [name, y] of [['first row heading', FIRST_ROW.title], ['second row summary', SECOND_ROW.summary], ['report divider', REPORT_ROW.divider]] as const) {
      expect(y - PAPER_TOP, name).toBeGreaterThanOrEqual(2);
    }
    // the report at its longest: the forecast (head and one line), then two rows of three lines (head, truth, what was said)
    const blocks = [10 + 10 + 4, 10 + 10 + 10 + 4, 10 + 10 + 10 + 4];
    const lastLine = REPORT_ROW.first + blocks[0]! + blocks[1]! + 10 + 10 + 10 + GLYPH - 1;
    expect(PAPER_BOTTOM - lastLine, 'report bottom').toBeGreaterThanOrEqual(2);
  });

  it('leaves the legend clear of the gold lines that start above the band', () => {
    const goldTop = GEOMETRY_2.axisY - GEOMETRY_2.half - 2;
    expect(goldTop - (SECOND_ROW.legend + LEGEND_BOTTOM) - 1, 'rows between the legend and the gold lines').toBeGreaterThanOrEqual(2);
    // on the first row the keys sit above BEFORE, which ends above the gold lines
    const goldTop1 = GEOMETRY.axisY - GEOMETRY.half - 2;
    expect(goldTop1 - (FIRST_ROW.before + GLYPH - 1) - 1, 'rows between BEFORE and the gold lines').toBeGreaterThanOrEqual(0);
    expect(FIRST_ROW.before - (FIRST_ROW.worthKey + LEGEND_BOTTOM) - 1).toBeGreaterThanOrEqual(1);
    // the first row's lines are apart too
    expect(FIRST_ROW.noiseKey + LEGEND_TOP - (FIRST_ROW.title + GLYPH) - 1, 'rows between the first heading and its key').toBeGreaterThanOrEqual(2);
    expect(FIRST_ROW.worthKey + LEGEND_TOP - (FIRST_ROW.noiseKey + LEGEND_BOTTOM) - 1, 'rows between the two keys').toBeGreaterThanOrEqual(1);
  });

  it('keeps the retest legend away from every gold line, so it never looks attached to one', () => {
    const swatch = LEGEND_X.retest + 4; // the green dot's centre
    for (const [row, g] of [[trained, GEOMETRY], [decoy, GEOMETRY_2]] as const) {
      const scale = scaleFor(row);
      for (const side of [-1, 1]) {
        const x = xOf(g, scale, side * row.swc);
        expect(Math.abs(x - swatch), `${row.metric} gold line at ${x}`).toBeGreaterThan(MARK + 6);
      }
    }
    // the last words of the legend stay inside the panel
    fits('retest legend', LEGEND_X.retest + 13, 'RETEST');
  });

  it('ends the numbers above the question list, with two clear rows between', () => {
    const verdictList = optionListHeight(verdicts);
    const listTop = DIALOGUE_BOX.y - 2 - verdictList; // where the list panel's border starts
    for (const g of [GEOMETRY, GEOMETRY_2]) {
      const numbersBottom = g.axisY + g.half + 6 + GLYPH - 1;
      expect(listTop - numbersBottom - 1, `axis ${g.axisY}`).toBeGreaterThanOrEqual(2);
    }
  });

  it('keeps the stamp below the numbers, so the ruler and what was said never touch', () => {
    const stampTop = 118;
    for (const g of [GEOMETRY, GEOMETRY_2]) {
      const numbersBottom = g.axisY + g.half + 6 + GLYPH - 1;
      expect(stampTop - numbersBottom - 1).toBeGreaterThanOrEqual(4);
    }
  });

  it('shares the first ruler\'s width, so the same verdicts and the same x positions hold', () => {
    expect(GEOMETRY_2.x0).toBe(GEOMETRY.x0);
    expect(GEOMETRY_2.x1).toBe(GEOMETRY.x1);
    expect(GEOMETRY_2.half).toBe(GEOMETRY.half);
  });
});

describe('the retest dot\'s fall', () => {
  /** Where the legend's marks and words are, left to right, for the entries that show with this row. */
  const spans = (entries: Array<'noise' | 'worth' | 'retest'>): Array<[number, number]> =>
    entries.map((entry): [number, number] => {
      const x = LEGEND_X[entry];
      if (entry === 'noise') return [x, x + 13 + width('NOISE')];
      if (entry === 'worth') return [x, x + 10 + width('WORTHWHILE')];
      return [x, x + 13 + width('RETEST')];
    });

  it('starts under the keys on the first row, so it crosses no words on the way down', () => {
    const top = GEOMETRY.axisY - FALL - MARK;
    expect(top).toBeGreaterThan(FIRST_ROW.worthKey + LEGEND_BOTTOM); // under the lower key's lowest mark
    // BEFORE sits over the pole; the dot lands to the right of it (the retest is better than the baseline)
    const x = xOf(GEOMETRY, scaleFor(trained), improvementOf(trained));
    expect(x - MARK).toBeGreaterThan(xOf(GEOMETRY, scaleFor(trained), 0) + width(beforeLabel(trained)) / 2);
  });

  it('starts under the heading on the second row, and falls where the legend has no words', () => {
    const top = GEOMETRY_2.axisY - FALL_2 - MARK;
    expect(top).toBeGreaterThan(SECOND_ROW.title + GLYPH); // clear of the heading
    const x = xOf(GEOMETRY_2, scaleFor(decoy), improvementOf(decoy));
    for (const [from, to] of spans(['noise', 'worth', 'retest'])) {
      expect(x + MARK < from || x - MARK > to, `the dot at ${x} against the legend entry ${from}..${to}`).toBe(true);
    }
  });

  it('lands at least the dot\'s own height below where it starts', () => {
    expect(FALL).toBeGreaterThanOrEqual(2 * MARK);
    expect(FALL_2).toBeGreaterThanOrEqual(2 * MARK);
  });
});
