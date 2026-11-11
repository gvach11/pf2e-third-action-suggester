import { isStaleTurn } from './refresh.js';

// Decides whether a turn should open the panel automatically. Pure so it can be
// tested without Foundry. Players are never filtered here (owner checks live in
// main.js); the GM chooses via the gmAutoOpen setting.
export function shouldAutoOpen({ isGM, hasPlayerOwner, gmMode }) {
  if (!isGM) return true;
  if (gmMode === 'none') return false;
  if (gmMode === 'npc') return !hasPlayerOwner;
  return true;
}

// A turn that could auto-open but had nothing to suggest at its start is
// "pending": a mid-turn refresh opens it once there is something to show,
// unless a panel is already up, the turn has moved on, or the user closed
// this turn's panel. `pending` is { combatId, turnKey, actorId } or null;
// `combat` is the encounter named by pending.combatId.
export function shouldOpenPendingTurn({ pending, dismissedKey, hasPanel, combat }) {
  if (!pending || hasPanel) return false;
  if (pending.turnKey === dismissedKey) return false;
  return !isStaleTurn(pending.turnKey, combat);
}

// A panel closed while its own turn is still on was closed by the user, and
// TAS won't reopen that turn. Closes caused by a turn change don't count.
export function isDismissal(panelKey, combat) {
  return !!panelKey && !isStaleTurn(panelKey, combat);
}
