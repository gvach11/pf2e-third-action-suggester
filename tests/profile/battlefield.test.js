import { afterEach, describe, expect, it, vi } from 'vitest';
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

  it("neutral and ally tokens don't drive the enemy flags", () => {
    const r = assessBattlefield([facts({ relation: 'neutral' }), facts({ relation: 'ally' })], { reach: 5 });
    expect(r.hasAdjacentEnemy).toBe(false);
    expect(r.hasNearbyEnemy).toBe(false);
    expect(r.hasAdjacentAlly).toBe(true);
  });

  it('an ally at exactly 75% HP is not injured', () => {
    const r = assessBattlefield([facts({ relation: 'ally', hpRatio: 0.75 })], { reach: 5 });
    expect(r.hasInjuredAdjacentAlly).toBe(false);
  });
});

function tok({ hp = { value: 10, max: 10 }, disposition = -1, combatant, conditions = [], items = {}, center = { x: 0, y: 0 } } = {}) {
  return {
    document: { disposition },
    combatant,
    visible: true,
    center,
    actor: {
      itemTypes: { condition: conditions.map(slug => ({ slug, system: { value: { value: null } } })), weapon: [], shield: [], ...items },
      system: { attributes: { hp } },
    },
  };
}

const selfWith = (distanceTo) => ({ ...tok({ disposition: 1 }), ...(distanceTo ? { distanceTo } : {}) });

describe('tokenFacts', () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uses pf2e's size-aware distance, not centre-to-centre", () => {
    vi.stubGlobal('canvas', { grid: { measurePath: () => ({ distance: 7.5 }) } });
    const self = selfWith(() => 5);
    expect(tokenFacts(tok(), self).distance).toBe(5);
  });

  it('falls back to grid measurement when distanceTo is missing', () => {
    const measurePath = vi.fn(() => ({ distance: 10 }));
    vi.stubGlobal('canvas', { grid: { measurePath } });
    const self = { ...tok({ disposition: 1, center: { x: 1, y: 2 } }) };
    const other = tok({ center: { x: 3, y: 4 } });
    expect(tokenFacts(other, self).distance).toBe(10);
    expect(measurePath).toHaveBeenCalledWith([{ x: 1, y: 2 }, { x: 3, y: 4 }]);
  });

  it('marks a defeated combatant', () => {
    expect(tokenFacts(tok({ combatant: { isDefeated: true } }), selfWith(() => 5)).defeated).toBe(true);
  });

  it('HP at 0 is defeated', () => {
    expect(tokenFacts(tok({ hp: { value: 0, max: 10 } }), selfWith(() => 5)).defeated).toBe(true);
  });

  it.each(['dead', 'unconscious'])('a %s condition is defeated', (slug) => {
    expect(tokenFacts(tok({ conditions: [slug] }), selfWith(() => 5)).defeated).toBe(true);
  });

  it('a live token is not defeated', () => {
    expect(tokenFacts(tok(), selfWith(() => 5)).defeated).toBe(false);
  });

  it('reads relation, held items and HP', () => {
    const other = tok({ disposition: 0, hp: { value: 5, max: 10 }, items: { shield: [{ isHeld: true }] } });
    const f = tokenFacts(other, selfWith(() => 5));
    expect(f.relation).toBe('neutral');
    expect(f.holdsItem).toBe(true);
    expect(f.hpRatio).toBe(0.5);
  });
});
