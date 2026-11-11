/**
 * PF2E Third Action Suggester - actor profile reader.
 *
 * Pure: reads an actor's own facts (skills, shield, hands, conditions). Touches
 * no Foundry globals.
 */

import { slugify } from '../suggestions/rules.js';

const INCAPACITATING = ['unconscious', 'dying', 'paralyzed', 'petrified'];
const ABILITY_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

export function readConditions(actor) {
  const slugs  = new Set();
  const values = {};
  try {
    for (const c of (actor.itemTypes?.condition ?? [])) {
      const slug = c.slug ?? c.system?.slug;
      if (!slug) continue;
      slugs.add(slug);
      const val = c.system?.value?.value ?? c.value ?? null;
      if (val !== null) values[slug] = val;
    }
  } catch { /* empty */ }
  return { slugs, values };
}

export function readActorProfile(actor) {
  const system = actor.system;
  const isCharacter = actor.type === 'character';

  const abilities = {};
  for (const key of ABILITY_KEYS) abilities[key] = system.abilities?.[key]?.mod ?? 0;

  // NPC skills carry no rank, only a modifier. A modifier above the governing
  // attribute means the NPC is at least trained.
  const skills = {};
  for (const [key, skill] of Object.entries(system.skills ?? {})) {
    const mod = skill.totalModifier ?? 0;
    if (isCharacter) {
      skills[key] = { rank: skill.rank ?? 0, mod, rankKnown: true };
    } else {
      const attrMod = abilities[skill.attribute] ?? 0;
      skills[key] = { rank: mod > attrMod ? 1 : 0, mod, rankKnown: false };
    }
  }

  const featSlugs = new Set(
    actor.items
      .filter(i => ['feat', 'feature', 'action'].includes(i.type))
      .map(i => i.system?.slug ?? slugify(i.name))
  );

  const shield = system.attributes?.shield;
  const hasShield = !!shield?.itemId && !shield.broken && !shield.destroyed;

  // PF2E tracks handsFree as a computed integer for characters only.
  const handsKnown  = typeof system.attributes?.handsFree === 'number';
  const hasFreeHand = handsKnown ? system.attributes.handsFree >= 1 : true;

  const hpCurrent = system.attributes?.hp?.value ?? 1;
  const hpMax     = system.attributes?.hp?.max   ?? 1;
  const hpPercent = hpCurrent / hpMax;

  const { slugs } = readConditions(actor);
  const isRestrained = slugs.has('restrained');

  return {
    actorType: actor.type,
    level: actor.level,
    abilities,
    skills,
    featSlugs,
    hasShield,
    hasFreeHand,
    handsKnown,
    hpPercent,
    isLowHp: hpPercent < 0.5,
    isGrabbed: slugs.has('grabbed') || isRestrained,
    isRestrained,
    isIncapacitated: INCAPACITATING.some(s => slugs.has(s)),
  };
}
