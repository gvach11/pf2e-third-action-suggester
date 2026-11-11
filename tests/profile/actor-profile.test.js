import { describe, expect, it } from 'vitest';
import { readActorProfile } from '../../scripts/profile/actor-profile.js';

const ZERO = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };

function stub({ type = 'character', abilities = {}, skills = {}, attributes = {}, conditions = [] } = {}) {
  const abs = {};
  for (const [k, v] of Object.entries({ ...ZERO, ...abilities })) abs[k] = { mod: v };
  return {
    type,
    level: 1,
    items: [],
    itemTypes: { condition: conditions.map(slug => ({ slug, system: { value: { value: null } } })) },
    system: { abilities: abs, skills, attributes: { hp: { value: 10, max: 10 }, ...attributes } },
  };
}

describe('readActorProfile', () => {
  it('character skills keep their rank', () => {
    const actor = stub({ skills: { athletics: { rank: 1, totalModifier: 7, attribute: 'str' } } });
    expect(readActorProfile(actor).skills.athletics).toEqual({ rank: 1, mod: 7, rankKnown: true });
  });

  it('NPC skill above its attribute counts as trained', () => {
    const actor = stub({
      type: 'npc', abilities: { str: 5 },
      skills: { athletics: { base: 12, totalModifier: 12, mod: 12, attribute: 'str' } },
    });
    expect(readActorProfile(actor).skills.athletics).toEqual({ rank: 1, mod: 12, rankKnown: false });
  });

  it('NPC skill equal to its attribute is untrained', () => {
    const actor = stub({
      type: 'npc', abilities: { cha: 1 },
      skills: { intimidation: { base: 1, totalModifier: 1, mod: 1, attribute: 'cha' } },
    });
    expect(readActorProfile(actor).skills.intimidation.rank).toBe(0);
  });

  it('shield counts only when pf2e has one in use', () => {
    const shield = (s) => readActorProfile(stub({ attributes: { shield: s } })).hasShield;
    expect(shield({ itemId: null, broken: false, destroyed: false })).toBe(false);
    expect(shield({ itemId: 'abc', broken: false, destroyed: false })).toBe(true);
    expect(shield({ itemId: 'abc', broken: true, destroyed: false })).toBe(false);
    expect(shield({ itemId: 'abc', broken: false, destroyed: true })).toBe(false);
    expect(readActorProfile(stub()).hasShield).toBe(false);
  });

  it('NPC hands are unknown', () => {
    const npc = readActorProfile(stub({ type: 'npc' }));
    expect(npc.handsKnown).toBe(false);
    expect(npc.hasFreeHand).toBe(true);
    const pc = readActorProfile(stub({ attributes: { handsFree: 0 } }));
    expect(pc.hasFreeHand).toBe(false);
    expect(pc.handsKnown).toBe(true);
  });

  it('incapacitating conditions', () => {
    for (const slug of ['unconscious', 'dying', 'paralyzed', 'petrified']) {
      expect(readActorProfile(stub({ conditions: [slug] })).isIncapacitated).toBe(true);
    }
    expect(readActorProfile(stub({ conditions: ['prone'] })).isIncapacitated).toBe(false);
  });

  it('reads grabbed and restrained, and restrained implies grabbed', () => {
    const p = readActorProfile(stub({ conditions: ['restrained'] }));
    expect(p.isRestrained).toBe(true);
    expect(p.isGrabbed).toBe(true);
    expect(readActorProfile(stub({ conditions: ['grabbed'] })).isRestrained).toBe(false);
  });
});
