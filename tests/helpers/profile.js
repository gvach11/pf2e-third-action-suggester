// A neutral actor profile for rule tests: no enemies, untrained everything,
// full HP. Pass overrides for what the test cares about.
export function makeProfile(overrides = {}) {
  return {
    actorType: 'character',
    abilities: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
    skills: {},
    featSlugs: new Set(),
    hasShield: false,
    hasFreeHand: true,
    hpPercent: 1,
    isLowHp: false,
    hasAdjacentEnemy: false,
    adjacentEnemyCount: 0,
    hasNearbyEnemy: false,
    hasWorthwhileRecallTarget: false,
    hasAdjacentAlly: false,
    hasInjuredAdjacentAlly: false,
    isGrabbed: false,
    isRestrained: false,
    hasFeintableEnemy: false,
    hasDemoralizableEnemy: false,
    hasTrippableEnemy: false,
    hasGrapplableEnemy: false,
    hasAdjacentGrabbedEnemy: false,
    hasDisarmableEnemy: false,
    ...overrides,
  };
}
