/**
 * Pure helpers for refreshing the suggestion panel mid-turn. Nothing here
 * touches Foundry globals; main.js wires them to hooks.
 */

// Token fields that can change what the battlefield looks like to TAS.
const RELEVANT_TOKEN_FIELDS = ['x', 'y', 'elevation', 'hidden', 'disposition', 'width', 'height'];

/** True if a token update's `changed` diff touches anything TAS reads. */
export function isRelevantTokenChange(changed) {
  if (!changed) return false;
  return RELEVANT_TOKEN_FIELDS.some(field => field in changed);
}

/** Calls `fn` once, `ms` after the last of a burst of calls. */
export function debounce(fn, ms) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => { timer = null; fn(...args); }, ms);
  };
}

/** Identifies one combatant's turn: the combat, its round and its turn index. */
export function turnKey(combat) {
  return `${combat.id}:${combat.round}:${combat.turn}`;
}

/** A panel opened on `panelKey` is stale once its combat is gone or has moved on. */
export function isStaleTurn(panelKey, combat) {
  return !combat || turnKey(combat) !== panelKey;
}
