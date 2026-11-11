/**
 * Pure helpers for the multiple attack penalty (MAP) highlight. Nothing here
 * touches Foundry globals; main.js passes in the chat messages.
 */

/**
 * Counts attack-trait rolls made at or after `since` (ms) by the panel's
 * token. Unlinked NPC tokens share their base actor's id, so a message that
 * names a token must name `tokenId`; one without a token (or a panel without
 * a token id) matches on `actorId`. Both times should be server times: a
 * message's `_stats.createdTime` is preferred to its `timestamp`, which comes
 * from the sender's clock and can be skewed.
 */
export function countAttacksSince(messages, { actorId, tokenId, since }) {
  let count = 0;
  for (const m of messages ?? []) {
    const speaker = m?.speaker;
    const mine = tokenId && speaker?.token
      ? speaker.token === tokenId
      : speaker?.actor === actorId;
    if (!mine) continue;
    if (!((m._stats?.createdTime ?? m.timestamp) >= since)) continue;
    const context = m.flags?.pf2e?.context;
    // A strike's damage roll carries the attack trait too, but isn't an attack.
    if (context?.type === 'damage-roll') continue;
    if (Array.isArray(context?.traits) && context.traits.includes('attack')) count++;
  }
  return count;
}

/** The MAP step (0, 1 or 2) that applies to the next attack. */
export function mapStepFor(count) {
  return Math.min(count, 2);
}

/**
 * Highlight and tooltip for one roll button. `map` is the button's MAP step
 * (0 for the d20 button); `known` is false when the turn start is unknown.
 */
export function mapButtonState({ map, baseTitle, step, attacks, known }) {
  if (!known || map !== step) return { highlighted: false, title: baseTitle };
  const noun = attacks === 1 ? 'attack' : 'attacks';
  return { highlighted: true, title: `Suggested: you've made ${attacks} ${noun} this turn. ${baseTitle}` };
}
