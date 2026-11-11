import { describe, expect, it } from 'vitest';
import { targetIssue } from '../../scripts/ui/target-check.js';

const facts = (over = {}) => ({
  token: { name: 'Zombie Shambler' },
  relation: 'enemy',
  distance: 5,
  visible: true,
  defeated: false,
  holdsItem: true,
  hpRatio: 1,
  conditions: { slugs: new Set(), values: {} },
  ...over,
});
const withCond = (slug, value) => facts({
  conditions: { slugs: new Set([slug]), values: value === undefined ? {} : { [slug]: value } },
});
const opts = { reach: 5 };

describe('targetIssue', () => {
  it('no target, no issue', () => {
    expect(targetIssue('trip', null, opts)).toBeNull();
  });
  it('untargeted slugs and escape never get an issue', () => {
    expect(targetIssue('escape', facts({ relation: 'ally' }), opts)).toBeNull();
    expect(targetIssue('stride', facts({ relation: 'ally' }), opts)).toBeNull();
  });
  it('a clean enemy in range has no issue', () => {
    for (const s of ['trip', 'grapple', 'feint', 'demoralize', 'disarm', 'bon-mot', 'create-a-diversion'])
      expect(targetIssue(s, facts(), opts)).toBeNull();
  });
  it('not an enemy', () => {
    expect(targetIssue('trip', facts({ relation: 'ally' }), opts)).toBe("Your target isn't an enemy.");
    expect(targetIssue('demoralize', facts({ relation: 'neutral' }), opts)).toBe("Your target isn't an enemy.");
  });
  it('trip, prone', () => {
    expect(targetIssue('trip', withCond('prone'), opts)).toBe('Your target is already prone.');
  });
  it('grapple, restrained', () => {
    expect(targetIssue('grapple', withCond('restrained'), opts)).toBe('Your target is already restrained.');
  });
  it('feint, off-guard', () => {
    expect(targetIssue('feint', withCond('off-guard'), opts)).toBe('Your target is already off-guard.');
  });
  it('demoralize, frightened 4 or more', () => {
    expect(targetIssue('demoralize', withCond('frightened', 4), opts)).toBe('Your target is already badly frightened.');
    expect(targetIssue('demoralize', withCond('frightened', 3), opts)).toBeNull();
  });
  it('disarm, holding nothing', () => {
    expect(targetIssue('disarm', facts({ holdsItem: false }), opts)).toBe("Your target isn't holding anything.");
  });
  it('athletics actions and feint beyond reach', () => {
    for (const s of ['grapple', 'trip', 'shove', 'disarm', 'reposition', 'feint'])
      expect(targetIssue(s, facts({ distance: 10 }), opts)).toBe('Your target is out of reach.');
    expect(targetIssue('trip', facts({ distance: 10 }), { reach: 10 })).toBeNull();
  });
  it('demoralize, bon-mot, create-a-diversion beyond 30 ft', () => {
    for (const s of ['demoralize', 'bon-mot', 'create-a-diversion']) {
      expect(targetIssue(s, facts({ distance: 35 }), opts)).toBe('Your target is more than 30 ft away.');
      expect(targetIssue(s, facts({ distance: 30 }), opts)).toBeNull();
    }
  });
  it('order: relation, then range, then state', () => {
    expect(targetIssue('trip', facts({ relation: 'ally', distance: 50 }), opts)).toBe("Your target isn't an enemy.");
    expect(targetIssue('trip', { ...withCond('prone'), distance: 50 }, opts)).toBe('Your target is out of reach.');
  });
  it("reasons never contain the target's name", () => {
    const cases = [
      ['trip', facts({ relation: 'ally' })], ['trip', withCond('prone')], ['grapple', withCond('restrained')],
      ['feint', withCond('off-guard')], ['demoralize', withCond('frightened', 4)],
      ['disarm', facts({ holdsItem: false })], ['trip', facts({ distance: 99 })],
      ['demoralize', facts({ distance: 99 })],
    ];
    for (const [s, t] of cases) {
      const r = targetIssue(s, t, opts);
      expect(r).toBeTruthy();
      expect(r).not.toContain('Zombie');
    }
  });
});
