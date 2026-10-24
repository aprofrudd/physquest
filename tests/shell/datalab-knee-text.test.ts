// FINDING: the Data Lab describes the knee reading as "jumps to ... its steepest rise so far" from a fixed template
// (content.knee.seen), even when the player's own file (a contaminated reading they kept) shows a FALL into it.
import { describe, expect, it } from 'vitest';
import { LEVEL_DATA } from '../../src/data/sports';
import { RUNNING } from '../../src/rooms/content/running';
import { createTraceDesk } from '../../src/rooms/datalab/model';
import { seeded } from './harness';

describe('Data Lab: what the knee reading is said to do', () => {
  it('does not say "jumps ... steepest rise" when the file shows a fall into it', () => {
    const sport = LEVEL_DATA[3]!;
    let checked = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const desk = createTraceDesk(RUNNING.data, sport, seeded(seed));
      const knee = desk.suspects.findIndex(s => s.kind === 'knee');
      for (let j = 0; j < knee; j++) desk.decide(j, false); // a player who keeps what came before
      const at = desk.suspects[knee]!.place.index;
      const before = desk.stages.slice(0, at).reverse().find(s => s.present);
      const here = desk.stages[at]!;
      if (!before || here.mmol >= before.mmol) continue; // only the files where the reading FALLS into the knee
      checked++;
      const text = desk.seen(knee);
      expect(text, `seed ${seed}: file ${desk.stages.map(s => `${s.kmh}:${s.mmol}`).join(' ')}`).not.toMatch(/jumps|steepest rise/);
    }
    expect(checked).toBeGreaterThan(0);
  });
});
