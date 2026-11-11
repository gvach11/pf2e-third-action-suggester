import { describe, it, expect } from 'vitest';
import { countAttacksSince, mapButtonState, mapStepFor } from '../../scripts/ui/map-tracker.js';

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

describe('countAttacksSince clocks', () => {
  it("uses the server's created time over the client timestamp", () => {
    const m = { ...msg('a', 500), _stats: { createdTime: 2000 } };
    expect(countAttacksSince([m], { actorId: 'a', since: 1000 })).toBe(1);
    const late = { ...msg('a', 5000), _stats: { createdTime: 500 } };
    expect(countAttacksSince([late], { actorId: 'a', since: 1000 })).toBe(0);
  });

  it('falls back to timestamp without _stats', () => {
    expect(countAttacksSince([msg('a', 2000), { ...msg('a', 2000), _stats: {} }], { actorId: 'a', since: 1000 })).toBe(2);
  });
});

describe('mapButtonState', () => {
  const base = 'Roll Trip';
  it('is not highlighted and keeps the base title when the turn start is unknown', () => {
    expect(mapButtonState({ map: 0, baseTitle: base, step: 0, attacks: 0, known: false }))
      .toEqual({ highlighted: false, title: base });
  });
  it('highlights the button matching the step, with the prefix before the base title', () => {
    expect(mapButtonState({ map: 1, baseTitle: base, step: 1, attacks: 1, known: true }))
      .toEqual({ highlighted: true, title: "Suggested: you've made 1 attack this turn. Roll Trip" });
  });
  it('does not highlight other buttons', () => {
    expect(mapButtonState({ map: 0, baseTitle: base, step: 1, attacks: 1, known: true }))
      .toEqual({ highlighted: false, title: base });
  });
  it('uses the plural for 0 and 3 attacks', () => {
    expect(mapButtonState({ map: 0, baseTitle: base, step: 0, attacks: 0, known: true }).title)
      .toBe("Suggested: you've made 0 attacks this turn. Roll Trip");
    expect(mapButtonState({ map: 2, baseTitle: base, step: 2, attacks: 3, known: true }).title)
      .toBe("Suggested: you've made 3 attacks this turn. Roll Trip");
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
