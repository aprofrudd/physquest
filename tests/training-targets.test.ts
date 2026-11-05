// The Training Floor's targets follow the battery the Testing Lab ran: a target whose numbers come from a test that
// was not run is shown in words, so no number from an untested file ever appears.
import { describe, expect, it, vi } from 'vitest';
vi.mock('../src/audio/Sfx', () => ({ sfx: { play: () => {} } }));
vi.mock('../src/ui/announce', () => ({ announce: () => {} }));
const { targetsFor } = await import('../src/rooms/training');
const { RUNNING } = await import('../src/rooms/content/running');

const training = RUNNING.training;
const targets = (tests: string[]) => targetsFor(training, tests)!.cards.map(c => c.target);

describe('training targets by battery', () => {
  it('keeps every number after the full battery, or before any battery', () => {
    expect(targetsFor(training, ['Lactate Profile', 'Critical Speed Test'])).toBe(training);
    expect(targetsFor(training, [])).toBe(training);
  });

  it('drops the critical speed numbers without the trials, and every number without the profile', () => {
    const lp = targets(['Lactate Profile', 'Beep Test']);
    expect(lp.join(' ')).not.toContain('3:22');
    expect(lp).toContain('SLOWER THAN 4:08/KM');
    const cs = targets(['Critical Speed Test', 'Wingate Test']);
    expect(cs.join(' ')).not.toMatch(/\d:\d\d/);
    expect(cs).toEqual(training.cards.map(c => c.plain));
  });
});
