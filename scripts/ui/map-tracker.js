/**
 * Pure helpers for the multiple attack penalty (MAP) highlight. Nothing here
 * touches Foundry globals; main.js passes in the chat messages.
 */

/** Counts `actorId`'s attack-trait rolls made at or after `since` (ms). */
export function countAttacksSince(messages, { actorId, since }) {
  let count = 0;
  for (const m of messages ?? []) {
    if (m?.speaker?.actor !== actorId) continue;
    if (!(m.timestamp >= since)) continue;
    if (m.flags?.pf2e?.context?.traits?.includes('attack')) count++;
  }
  return count;
}

/** The MAP step (0, 1 or 2) that applies to the next attack. */
export function mapStepFor(count) {
  return Math.min(count, 2);
}
