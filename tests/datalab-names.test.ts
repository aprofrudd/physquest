// Reading sports.ts variable names apart: the feature each is, the number in its brackets, and its short screen label.
import { describe, expect, it } from 'vitest';
import { LEVEL_DATA } from '../src/data/sports';
import { RUNNING } from '../src/rooms/content/running';
import { LABEL_MAX, featureOf, paceOf, paceText, partsOf, screenText, shortLabel } from '../src/rooms/datalab/names';

const names = LEVEL_DATA[3]!.variables.map(v => v.name);

describe('which feature a variable is', () => {
  it('knows all five of the running level, vVO2max apart from VO2max', () => {
    expect(names.map(featureOf)).toEqual(['lt1', 'lt2', 'vo2max', 'vvo2max', 'sprint']);
  });

  it('gives every variable of the level a line in the content', () => {
    for (const name of names) expect(RUNNING.data.features[name], name).toBeTruthy();
  });

  it('does not know a name it was not written for', () => {
    expect(featureOf('Body Mass (75kg)')).toBeUndefined();
  });

  it('still matches when a number in the brackets changes', () => {
    expect(featureOf('LT1 Pace (4:10/km)')).toBe('lt1');
    expect(featureOf('Max Sprint Speed (30 km/h)')).toBe('sprint');
  });
});

describe('the number in the brackets', () => {
  it('splits a name around its first number, exactly as written', () => {
    expect(partsOf('LT1 Pace (3:45/km)')).toEqual({ words: 'LT1 Pace', head: 'LT1 Pace (', value: '3:45', tail: '/km)' });
    expect(partsOf('VO2max (65 ml/kg/min)')).toEqual({ words: 'VO2max', head: 'VO2max (', value: '65', tail: ' ml/kg/min)' });
    expect(partsOf('Max Sprint Speed (28 km/h)').value).toBe('28');
    expect(partsOf('Fatigue Index (42%)').value).toBe('42');
  });

  it('gives back the whole name when there are no brackets', () => {
    expect(partsOf('Body Mass')).toEqual({ words: 'Body Mass', head: 'Body Mass', value: '', tail: '' });
  });

  it('puts a different number back in the same place', () => {
    const p = partsOf('LT1 Pace (3:45/km)');
    expect(`${p.head}4:13${p.tail}`).toBe('LT1 Pace (4:13/km)');
  });
});

describe('screen labels', () => {
  it('shortens the five names the way the video wall shows them, at most 6 characters', () => {
    expect(names.map(shortLabel)).toEqual(['LT1', 'LT2', 'VO2MAX', 'VVO2', 'SPRINT']);
    for (const name of names) expect(shortLabel(name).length).toBeLessThanOrEqual(LABEL_MAX);
  });

  it('takes the value as written', () => {
    expect(names.map(n => screenText(n).value)).toEqual(['3:45', '3:20', '65', '2:55', '28']);
  });
});

describe('paces', () => {
  it('turns a speed into m:ss per km', () => {
    expect(paceOf(16)).toBe('3:45');
    expect(paceOf(18)).toBe('3:20');
    expect(paceOf(20.6)).toBe('2:55');
    expect(paceOf(14.2373)).toBe('4:13');
  });

  it('pads seconds', () => {
    expect(paceText(245)).toBe('4:05');
    expect(paceText(59.6)).toBe('1:00');
  });
});
