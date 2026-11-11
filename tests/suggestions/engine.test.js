import { describe, expect, it } from 'vitest';
import { buildSuggestions } from '../../scripts/suggestions/engine.js';
import { makeProfile } from '../helpers/profile.js';

const allOn = { minRank: 1, isCategoryEnabled: () => true, routesRecallKnowledge: false };
const names = (list) => list.map(s => s.name);

const nextToEnemy = {
  hasAdjacentEnemy: true,
  adjacentEnemyCount: 1,
  hasNearbyEnemy: true,
  hasTrippableEnemy: true,
  hasGrapplableEnemy: true,
  hasFeintableEnemy: true,
  hasDemoralizableEnemy: true,
};
const armed = { hasDisarmableEnemy: true };

describe('buildSuggestions', () => {
  it('valeros L1 next to a goblin', () => {
    const profile = makeProfile({
      ...nextToEnemy,
      ...armed,
      abilities: { str: 4, dex: 2, con: 0, int: 0, wis: 0, cha: 0 },
      skills: { athletics: { rank: 1, mod: 7 }, acrobatics: { rank: 1, mod: 5 } },
      hasShield: true,
      hasFreeHand: true,
    });
    expect(names(buildSuggestions(profile, allOn))).toEqual(
      ['Trip', 'Shove', 'Grapple', 'Reposition', 'Disarm', 'Tumble Through', 'Raise a Shield'],
    );
  });

  it('minRank 2 hides trained-only rules', () => {
    const profile = makeProfile({
      ...nextToEnemy,
      abilities: { str: 1, dex: 4, con: 0, int: 0, wis: 0, cha: 2 },
      skills: {
        athletics: { rank: 1, mod: 4 }, acrobatics: { rank: 1, mod: 7 },
        deception: { rank: 1, mod: 5 }, intimidation: { rank: 1, mod: 5 },
        stealth: { rank: 1, mod: 7 },
      },
    });
    expect(names(buildSuggestions(profile, { ...allOn, minRank: 2 }))).toEqual(
      ['Reposition', 'Tumble Through'],
    );
  });

  it('a disabled category is skipped', () => {
    const profile = makeProfile({
      ...nextToEnemy,
      abilities: { str: 4, dex: 2, con: 0, int: 0, wis: 0, cha: 0 },
      skills: { athletics: { rank: 1, mod: 7 }, acrobatics: { rank: 1, mod: 5 } },
      hasShield: true,
    });
    const out = buildSuggestions(profile, { ...allOn, isCategoryEnabled: c => c !== 'athletics' });
    expect(out.length).toBeGreaterThan(0);
    expect(out.filter(s => s.category === 'athletics')).toEqual([]);
    expect(names(out)).toEqual(['Raise a Shield']);
  });

  it('recall knowledge is chat-only unless routed', () => {
    const profile = makeProfile({
      hasWorthwhileRecallTarget: true,
      skills: { arcana: { rank: 2, mod: 8 } },
    });
    const find = (opts) => buildSuggestions(profile, { ...allOn, ...opts }).find(s => s.slug === 'recall-knowledge');
    expect(find({ routesRecallKnowledge: false }).isChatOnly).toBe(true);
    expect(find({ routesRecallKnowledge: true }).isChatOnly).toBe(false);
  });
});

describe('buildSuggestions with NPC and incapacitated profiles', () => {
  const npc = (extra = {}) => makeProfile({
    ...nextToEnemy,
    actorType: 'npc',
    abilities: { str: 5, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
    skills: { athletics: { rank: 1, mod: 12, rankKnown: false } },
    ...extra,
  });

  it('NPC skill label shows the modifier, not a rank', () => {
    const trip = buildSuggestions(npc(), allOn).find(s => s.name === 'Trip');
    expect(trip.skillLabel).toBe('Athletics +12');
  });

  it('minRank does not filter skills with unknown rank', () => {
    const out = buildSuggestions(npc(), { ...allOn, minRank: 2 });
    expect(names(out)).toContain('Trip');
  });

  it('an incapacitated actor gets nothing', () => {
    expect(buildSuggestions(npc({ isIncapacitated: true }), allOn)).toEqual([]);
  });
});

describe('rule gates', () => {
  const find = (profile, name, opts = allOn) => buildSuggestions(profile, opts).find(s => s.name === name);

  it('rogue with sneak-attack gets Sneak', () => {
    const profile = makeProfile({
      featSlugs: new Set(['sneak-attack']),
      abilities: { str: 0, dex: 2, con: 0, int: 0, wis: 0, cha: 0 },
      skills: { stealth: { rank: 1, mod: 5 } },
    });
    expect(names(buildSuggestions(profile, allOn))).toContain('Sneak');
  });

  it('Escape tops the list while Grabbed', () => {
    const profile = makeProfile({
      ...nextToEnemy, ...armed, isGrabbed: true, hasAdjacentGrabbedEnemy: true,
      abilities: { str: 4, dex: 2, con: 0, int: 0, wis: 0, cha: 4 },
      skills: { athletics: { rank: 3, mod: 17 }, acrobatics: { rank: 1, mod: 5 } },
      hasShield: true,
    });
    expect(names(buildSuggestions(profile, allOn))[0]).toBe('Escape');
  });

  it('Escape is a defensive action', () => {
    expect(find(makeProfile({ isGrabbed: true }), 'Escape').category).toBe('defensive');
  });

  it('Escape names all three options', () => {
    const why = find(makeProfile({ isGrabbed: true }), 'Escape').why;
    expect(why).toContain('Athletics');
    expect(why).toContain('Acrobatics');
    expect(why).toContain('unarmed');
  });

  it('Disarm needs an enemy holding something', () => {
    const profile = makeProfile({
      ...nextToEnemy, hasDisarmableEnemy: false,
      abilities: { str: 4, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
      skills: { athletics: { rank: 1, mod: 7 } },
    });
    expect(names(buildSuggestions(profile, allOn))).not.toContain('Disarm');
  });

  it('Battle Medicine needs an adjacent injured ally or yourself low', () => {
    const profile = makeProfile({
      featSlugs: new Set(['battle-medicine']),
      skills: { medicine: { rank: 1, mod: 5 } },
      hasInjuredAdjacentAlly: false, isLowHp: false,
    });
    expect(names(buildSuggestions(profile, allOn))).not.toContain('Battle Medicine');
  });

  it('Demoralize needs trained Intimidation', () => {
    const base = { ...nextToEnemy };
    const untrained = makeProfile({ ...base, abilities: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 4 }, skills: { intimidation: { rank: 0, mod: 4 } } });
    const trained = makeProfile({ ...base, abilities: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }, skills: { intimidation: { rank: 1, mod: 3 } } });
    expect(names(buildSuggestions(untrained, allOn))).not.toContain('Demoralize');
    expect(names(buildSuggestions(trained, allOn))).toContain('Demoralize');
  });

  it('Create a Diversion needs trained Deception', () => {
    const base = { ...nextToEnemy };
    const untrained = makeProfile({ ...base, abilities: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 4 }, skills: { deception: { rank: 0, mod: 4 } } });
    const trained = makeProfile({ ...base, abilities: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }, skills: { deception: { rank: 1, mod: 3 } } });
    expect(names(buildSuggestions(untrained, allOn))).not.toContain('Create a Diversion');
    expect(names(buildSuggestions(trained, allOn))).toContain('Create a Diversion');
  });

  it('Recall Knowledge needs a trained knowledge skill', () => {
    const profile = makeProfile({ hasWorthwhileRecallTarget: true, skills: { arcana: { rank: 1, mod: 5 } } });
    expect(names(buildSuggestions(profile, allOn))).toContain('Recall Knowledge');
  });

  it('Recall Knowledge is suggested for characters, not NPCs', () => {
    const base = { hasWorthwhileRecallTarget: true, skills: { arcana: { rank: 1, mod: 5 } } };
    expect(names(buildSuggestions(makeProfile({ ...base, actorType: 'character' }), allOn))).toContain('Recall Knowledge');
    expect(names(buildSuggestions(makeProfile({ ...base, actorType: 'npc' }), allOn))).not.toContain('Recall Knowledge');
  });

  it('Reposition text mentions a free hand only for characters', () => {
    const base = { ...nextToEnemy, abilities: { str: 4, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }, skills: { athletics: { rank: 1, mod: 7 } } };
    const npc = makeProfile({ ...base, actorType: 'npc', hasFreeHand: true, handsKnown: false });
    const pc = makeProfile({ ...base, hasFreeHand: true, handsKnown: true });
    expect(find(npc, 'Reposition').why).not.toContain('free hand');
    expect(find(pc, 'Reposition').why).toContain('free hand');
  });
});
