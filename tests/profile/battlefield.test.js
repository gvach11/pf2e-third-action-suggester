import { describe, expect, it } from 'vitest';
import { assessBattlefield, tokenFacts } from '../../scripts/profile/battlefield.js';

function facts(overrides = {}) {
  return {
    token: {}, relation: 'enemy', distance: 5, visible: true, defeated: false,
    holdsItem: false, hpRatio: 1, conditions: { slugs: new Set(), values: {} },
    ...overrides,
  };
}

describe('assessBattlefield', () => {
  it('an enemy within reach is adjacent', () => {
    const r = assessBattlefield([facts({ distance: 5 })], { reach: 5 });
    expect(r.hasAdjacentEnemy).toBe(true);
    expect(r.adjacentEnemyCount).toBe(1);
  });

  it('a reach weapon reaches 10 ft', () => {
    const e = facts({ distance: 10 });
    expect(assessBattlefield([e], { reach: 10 }).hasAdjacentEnemy).toBe(true);
    const short = assessBattlefield([e], { reach: 5 });
    expect(short.hasAdjacentEnemy).toBe(false);
    expect(short.hasNearbyEnemy).toBe(true);
  });

  it('defeated enemies count for nothing', () => {
    const r = assessBattlefield([facts({ defeated: true })], { reach: 5 });
    expect(Object.values(r).every(v => v === false || v === 0 || (Array.isArray(v) && !v.length))).toBe(true);
  });

  it("enemies the user can't see count for nothing", () => {
    const r = assessBattlefield([facts({ visible: false })], { reach: 5 });
    expect(r.hasNearbyEnemy).toBe(false);
    expect(r.nearbyEnemyTokens).toEqual([]);
  });

  it('disarm needs an enemy holding something', () => {
    expect(assessBattlefield([facts()], { reach: 5 }).hasDisarmableEnemy).toBe(false);
    expect(assessBattlefield([facts({ holdsItem: true })], { reach: 5 }).hasDisarmableEnemy).toBe(true);
  });

  it("an injured ally far away doesn't count", () => {
    const far = facts({ relation: 'ally', distance: 30, hpRatio: 0.4 });
    const near = facts({ relation: 'ally', distance: 5, hpRatio: 0.4 });
    expect(assessBattlefield([far], { reach: 5 }).hasInjuredAdjacentAlly).toBe(false);
    expect(assessBattlefield([near], { reach: 5 }).hasInjuredAdjacentAlly).toBe(true);
  });
});

function tok({ size = 1, hp = { value: 10, max: 10 }, disposition = -1, combatant, conditions = [], items = {} } = {}) {
  return {
    document: { disposition, combatant: undefined },
    combatant,
    visible: true,
    center: { x: 0, y: 0 },
    actor: {
      itemTypes: { condition: conditions.map(slug => ({ slug, system: { value: { value: null } } })), weapon: [], shield: [], ...items },
      system: { attributes: { hp } },
    },
  };
}

describe('tokenFacts', () => {
  it("uses pf2e's size-aware distance", () => {
    const self = tok({ disposition: 1 });
    self.distanceTo = () => 5;
    expect(tokenFacts(tok({ size: 2 }), self).distance).toBe(5);
  });

  it('marks a defeated combatant', () => {
    const self = tok({ disposition: 1 });
    self.distanceTo = () => 5;
    expect(tokenFacts(tok({ combatant: { isDefeated: true } }), self).defeated).toBe(true);
    expect(tokenFacts(tok(), self).defeated).toBe(false);
  });

  it('reads relation, held items and HP', () => {
    const self = tok({ disposition: 1 });
    self.distanceTo = () => 5;
    const other = tok({ disposition: 0, hp: { value: 5, max: 10 }, items: { shield: [{ isHeld: true }] } });
    const f = tokenFacts(other, self);
    expect(f.relation).toBe('neutral');
    expect(f.holdsItem).toBe(true);
    expect(f.hpRatio).toBe(0.5);
  });
});
