import { MAP_ACTIONS } from '../actions/roll-action.js';

// Why the single selected target makes a suggestion pointless, or null.
// Pure: facts come from tokenFacts(); reasons never name the target.
const ATHLETICS = new Set([...MAP_ACTIONS].filter(s => s !== 'escape'));
const FAR_SKILLS = new Set(['demoralize', 'bon-mot', 'create-a-diversion']);
const TARGETED = new Set([...ATHLETICS, 'feint', ...FAR_SKILLS]);

export function targetIssue(slug, target, { reach = 5 } = {}) {
  if (!target || !TARGETED.has(slug)) return null;
  if (target.relation !== 'enemy') return "Your target isn't an enemy.";

  const d = target.distance;
  if ((ATHLETICS.has(slug) || slug === 'feint') && typeof d === 'number' && d > reach)
    return 'Your target is out of reach.';
  if (FAR_SKILLS.has(slug) && typeof d === 'number' && d > 30)
    return 'Your target is more than 30 ft away.';

  const slugs = target.conditions?.slugs;
  switch (slug) {
    case 'trip': if (slugs?.has('prone')) return 'Your target is already prone.'; break;
    case 'grapple': if (slugs?.has('restrained')) return 'Your target is already restrained.'; break;
    case 'feint': if (slugs?.has('off-guard')) return 'Your target is already off-guard.'; break;
    case 'demoralize':
      if ((target.conditions?.values?.frightened ?? 0) >= 4) return 'Your target is already badly frightened.';
      break;
    case 'disarm': if (!target.holdsItem) return "Your target isn't holding anything."; break;
  }
  return null;
}
