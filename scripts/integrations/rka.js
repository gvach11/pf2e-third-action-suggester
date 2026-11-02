/**
 * PF2E Third Action Suggester - Recall Knowledge Assistant integration.
 *
 * When PF2e Recall Knowledge Assistant (RKA) is active, the Recall Knowledge
 * suggestion opens RKA's dialog, and is only offered when a nearby enemy is
 * still worth an attempt. Everything here falls back to the plain 1.0.0
 * behaviour (chat reminder; any nearby enemy counts) when RKA is missing,
 * disabled, too old, not ready yet, throws, or it's an NPC's turn.
 */

export const RKA_MODULE_ID = 'pf2e-recall-knowledge-assistant';

// RKA's API, only if it's active and new enough. Looked up on every call:
// RKA publishes it in its own 'ready' hook, which may run after ours.
export function getRkaApi() {
  const rka = game.modules.get(RKA_MODULE_ID);
  if (!rka?.active) return null;
  return rka.api?.apiVersion >= 1 ? rka.api : null;
}

// RKA only rolls for player characters; NPCs keep the chat reminder.
export function canRouteToRka(actor) {
  return getRkaApi() !== null && actor?.type === 'character';
}

// Is there a nearby enemy this actor would still learn something from?
// Only enemies this user can see count: a hidden one would otherwise keep
// the suggestion alive and give itself away (a GM sees hidden tokens).
export function hasWorthwhileRecallTarget(actor, nearbyEnemyTokens) {
  const anyNearby = nearbyEnemyTokens.length > 0;
  if (!canRouteToRka(actor)) return anyNearby;
  try {
    const api = getRkaApi();
    return nearbyEnemyTokens
      .filter(targetToken => targetToken.visible)
      .some(targetToken => api.getAttemptStatus({ actor, targetToken }) === 'available');
  } catch (e) {
    console.warn('PF2E Third Action | Recall Knowledge Assistant status check failed:', e);
    return anyNearby;
  }
}

// Opens RKA's dialog for this actor. Returns false when the caller should
// post the chat reminder instead. No target is passed: RKA uses the user's
// current target and gives its own warnings.
export function openRecallKnowledge(actor) {
  if (!canRouteToRka(actor)) return false;
  try {
    getRkaApi().openDialog({ actor });
    return true;
  } catch (e) {
    console.warn('PF2E Third Action | Could not open Recall Knowledge Assistant:', e);
    return false;
  }
}
