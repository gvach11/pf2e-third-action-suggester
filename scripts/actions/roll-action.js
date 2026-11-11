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
 * the penalty. Other actions call the legacy action functions (multi-word ones
 * are registered in camelCase, e.g. raiseAShield); with no legacy function
 * they fall back to the action object (e.g. take-cover), unpenalised.
 * Battle Medicine has neither, so it rolls the actor's Medicine statistic.
 *
 * Returns false when there is nothing to roll with, so the caller can tell
 * the user to roll manually. A rejected or throwing roll goes to onError.
 */
export function rollSystemAction(actions, { actor, slug, map = 0, options = {}, onError = () => {} }) {
  if (!actions) return false;
  const useOptions = { actors: [actor], ...options };

  const attempt = (fn) => {
    try {
      Promise.resolve(fn()).catch(onError);
    } catch (e) {
      onError(e);
    }
    return true;
  };

  if (slug === 'battle-medicine') {
    const medicine = actor?.skills?.medicine;
    if (typeof medicine?.roll !== 'function') return false;
    return attempt(() => medicine.roll({
      label: 'Battle Medicine',
      traits: ['healing', 'manipulate'],
      extraRollOptions: ['action:battle-medicine'],
    }));
  }

  const actionObject = actions.get?.(slug);
  const canUse = typeof actionObject?.use === 'function';
  if (canUse && MAP_ACTIONS.has(slug)) {
    if (map > 0) useOptions.multipleAttackPenalty = map;
    return attempt(() => actionObject.use(useOptions));
  }

  // The legacy functions can't take a penalty; don't roll one without it.
  if (map > 0) return false;

  const legacy = actions[slug] ?? actions[camelCase(slug)];
  if (typeof legacy === 'function') {
    legacy(useOptions);
    return true;
  }
  if (canUse) return attempt(() => actionObject.use(useOptions));
  return false;
}
