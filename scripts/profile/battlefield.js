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
  const defeated = !!hp && hp.value <= 0
    || !!combatant?.isDefeated
    || conditions.slugs.has('dead')
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

  return {
    hasAdjacentEnemy:       adjacent.length > 0,
    adjacentEnemyCount:     adjacent.length,
    hasNearbyEnemy:         nearby.length > 0,
    nearbyEnemyTokens:      nearby.map(o => o.token),
    hasAdjacentAlly:        adjacentAllies.length > 0,
    hasInjuredAdjacentAlly: adjacentAllies.some(o => o.hpRatio < INJURED_RATIO),
    hasFeintableEnemy:      adjacent.some(o => !o.conditions.slugs.has('off-guard')),
    hasDemoralizableEnemy:  nearby.some(o => (o.conditions.values['frightened'] ?? 0) < 4),
    hasTrippableEnemy:      adjacent.some(o => !o.conditions.slugs.has('prone')),
    hasGrapplableEnemy:     adjacent.some(o => !o.conditions.slugs.has('restrained')),
    hasDisarmableEnemy:     adjacent.some(o => o.holdsItem),
    hasAdjacentGrabbedEnemy: adjacent.some(o => o.conditions.slugs.has('grabbed') || o.conditions.slugs.has('restrained')),
  };
}
