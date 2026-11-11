// Decides whether a turn should open the panel automatically. Pure so it can be
// tested without Foundry. Players are never filtered here (owner checks live in
// main.js); the GM chooses via the gmAutoOpen setting.
export function shouldAutoOpen({ isGM, hasPlayerOwner, gmMode }) {
  if (!isGM) return true;
  if (gmMode === 'none') return false;
  if (gmMode === 'npc') return !hasPlayerOwner;
  return true;
}
