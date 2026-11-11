// Battlefield facts. tokenFacts is the edge (reads Foundry tokens); assessBattlefield is pure.
import { readConditions } from './actor-profile.js';

const NEARBY_FEET = 30;
const INJURED_RATIO = 0.75;

function measureFeet(token, selfToken) {
  try {
    if (typeof selfToken.distanceTo === 'function') return selfToken.distanceTo(token) ?? Infinity;
    return canvas.grid.measurePath([
      { x: selfToken.center.x, y: selfToken.center.y },
      { x: token.center.x,     y: token.center.y     },
    ]).distance ?? Infinity;
  } catch { return Infinity; }
}

export function tokenFacts(token, selfToken) {
  const actor = token.actor;
  const conditions = readConditions(actor);
  const hp = actor.system?.attributes?.hp;
  const hpRatio = hp ? hp.value / (hp.max || 1) : 1;
  const combatant = token.combatant ?? token.document?.combatant;
  // `dead` is beyond help; `defeated` also covers the downed (HP 0 or
  // unconscious), who are out of the fight but can still be treated.
  const dead = !!combatant?.isDefeated || conditions.slugs.has('dead');
  const defeated = dead
    || !!hp && hp.value <= 0
    || conditions.slugs.has('unconscious');

  const mine = selfToken.document.disposition;
  const theirs = token.document.disposition;
  const relation = theirs === mine ? 'ally' : theirs === 0 ? 'neutral' : 'enemy';

  const held = [...(actor.itemTypes?.weapon ?? []), ...(actor.itemTypes?.shield ?? [])];
  return {
    token,
    relation,
    distance: measureFeet(token, selfToken),
    visible: token.visible !== false,
    defeated,
    dead,
    holdsItem: held.some(i => i.isHeld),
    hpRatio,
    conditions,
  };
}

export function assessBattlefield(others, { reach }) {
  const live = others.filter(o => o.visible && !o.defeated);
  const enemies = live.filter(o => o.relation === 'enemy');
  const nearby = enemies.filter(o => o.distance <= NEARBY_FEET);
  const adjacent = nearby.filter(o => o.distance <= reach);
  const adjacentAllies = live.filter(o => o.relation === 'ally' && o.distance <= reach);
  // Battle Medicine can treat a downed ally, so only the dead are left out.
  const treatableAllies = others.filter(o =>
    o.visible && !o.dead && o.relation === 'ally' && o.distance <= reach);
  const isInjured = o => o.hpRatio < INJURED_RATIO || !!o.conditions?.slugs?.has('unconscious');

  return {
    hasAdjacentEnemy:       adjacent.length > 0,
    adjacentEnemyCount:     adjacent.length,
    hasNearbyEnemy:         nearby.length > 0,
    nearbyEnemyTokens:      nearby.map(o => o.token),
    hasAdjacentAlly:        adjacentAllies.length > 0,
    hasInjuredAdjacentAlly: treatableAllies.some(isInjured),
    hasFeintableEnemy:      adjacent.some(o => !o.conditions.slugs.has('off-guard')),
    hasDemoralizableEnemy:  nearby.some(o => (o.conditions.values['frightened'] ?? 0) < 4),
    hasTrippableEnemy:      adjacent.some(o => !o.conditions.slugs.has('prone')),
    hasGrapplableEnemy:     adjacent.some(o => !o.conditions.slugs.has('restrained')),
    hasDisarmableEnemy:     adjacent.some(o => o.holdsItem),
    hasAdjacentGrabbedEnemy: adjacent.some(o => o.conditions.slugs.has('grabbed') || o.conditions.slugs.has('restrained')),
  };
}
