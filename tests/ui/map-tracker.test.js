import { describe, it, expect } from 'vitest';
import { countAttacksSince, mapStepFor } from '../../scripts/ui/map-tracker.js';

const msg = (actor, timestamp, traits = ['attack']) => ({
  speaker: { actor },
  timestamp,
  flags: { pf2e: { context: { traits } } },
});

describe('countAttacksSince', () => {
  it("counts this actor's attack-trait rolls this turn", () => {
    const messages = [msg('a', 1000), msg('a', 2000), msg('a', 3000)];
    expect(countAttacksSince(messages, { actorId: 'a', since: 1000 })).toBe(3);
  });

  it('ignores other actors, earlier messages and non-attack rolls', () => {
    const messages = [
      msg('b', 2000),
      msg('a', 999),
      msg('a', 2000, ['skill']),
      { speaker: { actor: 'a' }, timestamp: 2000, flags: {} },
      msg('a', 2000),
    ];
    expect(countAttacksSince(messages, { actorId: 'a', since: 1000 })).toBe(1);
  });
});

describe('mapStepFor', () => {
  it('caps the step at 2', () => {
    expect(mapStepFor(0)).toBe(0);
    expect(mapStepFor(1)).toBe(1);
    expect(mapStepFor(2)).toBe(2);
    expect(mapStepFor(5)).toBe(2);
  });
});
