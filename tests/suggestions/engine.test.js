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

describe('buildSuggestions', () => {
  it('valeros L1 next to a goblin', () => {
    const profile = makeProfile({
      ...nextToEnemy,
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
      ['Reposition', 'Demoralize', 'Tumble Through', 'Create a Diversion'],
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
