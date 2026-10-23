// Testing Lab instrument (placeholder until the redesign lands): says so and leaves without recording anything.
import type { InstrumentFactory } from '../types';

export const createTestingRoom: InstrumentFactory = host => {
  host.say('This room is being rebuilt. Come back soon!', undefined, () => host.quit());
  return {
    update() {},
    render() {},
  };
};
