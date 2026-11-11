/**
 * PF2E Third Action Suggester - rolling pf2e system actions.
 *
 * Takes the pf2e action registry (game.pf2e.actions) as an argument so it can
 * be tested without Foundry.
 */

// Suggested actions with the attack trait. They take the multiple attack
// penalty, so the panel offers -5 and -10 rolls for them.
export const MAP_ACTIONS = new Set(['grapple', 'trip', 'shove', 'disarm', 'reposition', 'escape']);

function camelCase(slug) {
  return slug.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

/**
 * Rolls `slug` for `actor`. `map` is the multiple attack penalty step:
 * 0 = first attack, 1 = -5, 2 = -10.
 *
 * Attack actions go through the system's action objects, whose use() applies
 * the penalty. Everything else keeps calling the legacy action functions
 * (multi-word ones are registered in camelCase, e.g. raiseAShield).
 *
 * Returns false when there is nothing to roll with, so the caller can tell
 * the user to roll manually. A rejected action-object roll goes to onError.
 */
export function rollSystemAction(actions, { actor, slug, map = 0, options = {}, onError = () => {} }) {
  if (!actions) return false;
  const useOptions = { actors: [actor], ...options };

  const actionObject = MAP_ACTIONS.has(slug) ? actions.get?.(slug) : undefined;
  if (typeof actionObject?.use === 'function') {
    if (map > 0) useOptions.multipleAttackPenalty = map;
    try {
      Promise.resolve(actionObject.use(useOptions)).catch(onError);
    } catch (e) {
      onError(e);
    }
    return true;
  }

  // The legacy functions can't take a penalty; don't roll one without it.
  if (map > 0) return false;

  const legacy = actions[slug] ?? actions[camelCase(slug)];
  if (typeof legacy !== 'function') return false;
  legacy(useOptions);
  return true;
}
