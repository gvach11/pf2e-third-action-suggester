/**
 * PF2E Third Action Suggester - the rule catalogue.
 *
 * Plain data and helpers, no Foundry globals, so the rules can be unit-tested.
 */

export function signed(n = 0)  { return n >= 0 ? `+${n}` : `${n}`; }
export function slugify(str)   { return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

export const RANKS = ['Untrained', 'Trained', 'Expert', 'Master', 'Legendary'];

export const KNOWLEDGE_SKILLS = ['arcana', 'nature', 'occultism', 'religion', 'society', 'crafting'];

// Actions that can't be rolled programmatically — clicking the button posts a
// chat reminder instead so the player knows what to do.
export const CHAT_ACTIONS = {
  'recall-knowledge': {
    name: 'Recall Knowledge',
    content: '<p><strong>Recall Knowledge</strong> — Use your best knowledge skill (Arcana, Nature, Occultism, Religion, Society, or Crafting) to identify the creature and learn its traits, abilities, weaknesses, and immunities.</p>'
  },
  'aid': {
    name: 'Aid',
    content: '<p><strong>Aid</strong> — Prepare to help an adjacent ally. Declare which action you are preparing for. When they attempt that action, trigger your Aid reaction to give them a +1 circumstance bonus (higher on a critical success).</p>'
  },
};

export const CATEGORY_CONFIG = {
  athletics: { icon: 'fa-hand-fist',     color: '#5a8fc7' },
  social:    { icon: 'fa-comments',      color: '#c9a84c' },
  defensive: { icon: 'fa-shield-halved', color: '#5a9e6a' },
  knowledge: { icon: 'fa-book-open',     color: '#9b7cc8' },
  stealth:   { icon: 'fa-eye-slash',     color: '#7a9e8a' },
};

export const DIVERSION_VARIANTS = [
  { id: 'distracting-words', label: 'Distracting Words' },
  { id: 'gesture',           label: 'Gesture' },
  { id: 'trick',             label: 'Trick' },
];

export const NO_TARGET_ACTIONS = new Set([
  'escape', 'battle-medicine', 'raise-a-shield', 'take-cover',
  'recall-knowledge', 'sneak', 'create-a-diversion', 'aid',
]);

// ===============================================================
// ACTION RULES CATALOG
// ===============================================================

export const RULES = [

  // -- ATHLETICS

  {
    name: 'Reposition', actions: 1, priority: 7, category: 'athletics', skill: 'athletics', skillReq: 0,
    requiresAdjacentEnemy: true, athleticsBoost: true, grabComboBoost: true,
    source: 'https://2e.aonprd.com/Actions.aspx?ID=2379',
    condition: p =>
      !p.isRestrained && p.hasAdjacentEnemy && p.abilities.str >= 1 &&
      (p.hasFreeHand || p.hasAdjacentGrabbedEnemy),
    why: p => {
      const intro = p.hasAdjacentGrabbedEnemy ? 'You have an enemy Grabbed - Reposition' : 'With a free hand, Reposition';
      return `${intro} uses Athletics ${signed(p.skills['athletics']?.mod)} to muscle them up to 5 ft into a space of your choice (10 ft on a crit). Target must stay within your reach.`;
    }
  },

  {
    name: 'Trip', actions: 1, priority: 10, category: 'athletics', skill: 'athletics', skillReq: 1,
    requiresAdjacentEnemy: true, athleticsBoost: true,
    source: 'https://2e.aonprd.com/Actions.aspx?ID=2382',
    condition: p =>
      !p.isRestrained && p.hasAdjacentEnemy && p.hasTrippableEnemy &&
      (p.skills['athletics']?.rank ?? 0) >= 1 && p.abilities.str >= 1,
    why: p =>
      `Athletics ${signed(p.skills['athletics']?.mod)} - knocks target prone: -2 to attack rolls, must spend an action to Stand.`
  },

  {
    name: 'Shove', actions: 1, priority: 9, category: 'athletics', skill: 'athletics', skillReq: 1,
    requiresAdjacentEnemy: true, athleticsBoost: true,
    source: 'https://2e.aonprd.com/Actions.aspx?ID=2380',
    condition: p =>
      !p.isRestrained && p.hasAdjacentEnemy &&
      (p.skills['athletics']?.rank ?? 0) >= 1 && p.abilities.str >= 1,
    why: p =>
      `Athletics ${signed(p.skills['athletics']?.mod)} - push target back 5 ft (10 ft on a crit). Excellent for hazards, ledges, or breaking formation.`
  },

  {
    name: 'Grapple', actions: 1, priority: 9, category: 'athletics', skill: 'athletics', skillReq: 0,
    requiresAdjacentEnemy: true, athleticsBoost: true,
    source: 'https://2e.aonprd.com/Actions.aspx?ID=2376',
    condition: p =>
      !p.isRestrained && p.hasAdjacentEnemy && p.hasGrapplableEnemy && p.abilities.str >= 2,
    why: p =>
      `Athletics ${signed(p.skills['athletics']?.mod)} - Grabbed: enemy is off-guard and cannot move away. Critical success Restrains them entirely.`
  },

  {
    name: 'Disarm', actions: 1, priority: 7, category: 'athletics', skill: 'athletics', skillReq: 1,
    requiresAdjacentEnemy: true, athleticsBoost: true,
    source: 'https://2e.aonprd.com/Actions.aspx?ID=2383',
    condition: p =>
      !p.isRestrained && p.hasAdjacentEnemy &&
      (p.skills['athletics']?.rank ?? 0) >= 1 && p.abilities.str >= 1,
    why: p =>
      `Athletics ${signed(p.skills['athletics']?.mod)} - success: -2 to enemy attacks with that weapon. Critical success: weapon falls to the ground.`
  },

  {
    name: 'Escape', actions: 1, priority: 12, category: 'athletics', skillReq: 0,
    defensiveBoost: true,
    source: 'https://2e.aonprd.com/Actions.aspx?ID=2371',
    condition: p => p.isGrabbed,
    why: p => {
      const ath = p.skills['athletics']?.mod ?? 0;
      const acr = p.skills['acrobatics']?.mod ?? 0;
      const best = ath >= acr ? `Athletics ${signed(ath)}` : `Acrobatics ${signed(acr)}`;
      return `You are Grabbed or Restrained - Escape uses ${best} to break free and end the condition.`;
    }
  },

  // -- INTIMIDATION

  {
    name: 'Demoralize', actions: 1, priority: 9, category: 'social', skill: 'intimidation', skillReq: 0,
    source: 'https://2e.aonprd.com/Actions.aspx?ID=2395',
    condition: p => p.hasNearbyEnemy && p.hasDemoralizableEnemy && p.abilities.cha >= 1,
    why: p =>
      `Intimidation ${signed(p.skills['intimidation']?.mod)} - Frightened 1: -1 status penalty to all checks and DCs (Frightened 2 on a crit). Target immune for 10 minutes after.`
  },

  // -- DECEPTION

  {
    name: 'Feint', actions: 1, priority: 8, category: 'social', skill: 'deception', skillReq: 1,
    requiresAdjacentEnemy: true,
    source: 'https://2e.aonprd.com/Actions.aspx?ID=2390',
    condition: p =>
      p.hasAdjacentEnemy && p.hasFeintableEnemy && (p.skills['deception']?.rank ?? 0) >= 1,
    why: p =>
      `Deception ${signed(p.skills['deception']?.mod)} - success: target is off-guard against your next melee attack. Critical success: off-guard until end of your next turn.`
  },

  {
    name: 'Create a Diversion', actions: 1, priority: 7, category: 'social', skill: 'deception', skillReq: 0,
    source: 'https://2e.aonprd.com/Actions.aspx?ID=2387',
    condition: p => p.hasNearbyEnemy && p.abilities.cha >= 1,
    why: p =>
      `Deception ${signed(p.skills['deception']?.mod)} - on success you become Hidden, allowing you to Sneak away or set up an off-guard Strike.`
  },

  // -- DIPLOMACY

  {
    name: 'Bon Mot', actions: 1, priority: 9, category: 'social', skill: 'diplomacy', skillReq: 1,
    source: 'https://2e.aonprd.com/Feats.aspx?ID=6466',
    condition: p =>
      p.featSlugs.has('bon-mot') && p.hasNearbyEnemy && (p.skills['diplomacy']?.rank ?? 0) >= 1,
    why: p =>
      `Bon Mot feat - Diplomacy ${signed(p.skills['diplomacy']?.mod)} - success: -2 status penalty to target's Perception and Will saves for 1 minute (-3 on a crit).`
  },

  // -- MEDICINE

  {
    name: 'Battle Medicine', actions: 1, priority: 11, category: 'defensive', skill: 'medicine', skillReq: 1,
    defensiveBoost: true,
    source: 'https://2e.aonprd.com/Feats.aspx?ID=5125',
    condition: p =>
      !p.isRestrained && p.featSlugs.has('battle-medicine') &&
      (p.skills['medicine']?.rank ?? 0) >= 1 && (p.isLowHp || p.hasInjuredAdjacentAlly),
    why: p =>
      p.isLowHp
        ? `Battle Medicine feat - Medicine ${signed(p.skills['medicine']?.mod)} - heal yourself using Treat Wounds DCs. Requires healer's toolkit.`
        : `Battle Medicine feat - Medicine ${signed(p.skills['medicine']?.mod)} - patch up an injured ally. Requires healer's toolkit.`
  },

  // -- DEFENSIVE

  {
    name: 'Raise a Shield', actions: 1, priority: 7, category: 'defensive', skillReq: 0,
    defensiveBoost: true,
    source: 'https://2e.aonprd.com/Actions.aspx?ID=98',
    condition: p => !p.isRestrained && p.hasShield,
    why: () => 'Shield equipped - +2 circumstance bonus to AC until your next turn. Free insurance.'
  },

  {
    name: 'Take Cover', actions: 1, priority: 6, category: 'defensive', skillReq: 0,
    defensiveBoost: true,
    source: 'https://2e.aonprd.com/Actions.aspx?ID=90',
    condition: p => p.isLowHp && p.hasNearbyEnemy,
    why: () => 'Low HP - Take Cover grants +2 circumstance bonus to AC against ranged attacks and area effects.'
  },

  // -- AID & KNOWLEDGE

  {
    name: 'Aid', actions: 1, priority: 5, category: 'knowledge', skillReq: 2,
    source: 'https://2e.aonprd.com/Actions.aspx?ID=75',
    condition: p => p.hasAdjacentAlly && Object.values(p.skills).some(s => s.rank >= 2),
    why: () =>
      'You have expert skills and an adjacent ally - Aid prepares a reaction that gives them +1 (or better) on their next check.'
  },

  {
    name: 'Recall Knowledge', actions: 1, priority: 5, category: 'knowledge', skillReq: 2,
    source: 'https://2e.aonprd.com/Actions.aspx?ID=26',
    condition: p =>
      p.hasWorthwhileRecallTarget &&
      KNOWLEDGE_SKILLS.some(s => (p.skills[s]?.rank ?? 0) >= 2),
    why: () =>
      "Expert knowledge skills - identifying a creature's weakness or immunity can change the encounter strategy entirely."
  },

  // -- ACROBATICS

  {
    name: 'Tumble Through', actions: 1, priority: 7, category: 'athletics', skill: 'acrobatics', skillReq: 0,
    requiresAdjacentEnemy: true,
    source: 'https://2e.aonprd.com/Actions.aspx?ID=2370',
    condition: p => !p.isGrabbed && p.hasAdjacentEnemy && p.abilities.dex >= 2,
    why: p =>
      `Acrobatics ${signed(p.skills['acrobatics']?.mod)} - Stride through an enemy's space to reach a flanking position or bypass a blocker. Movement ends on a failure.`
  },

  // -- STEALTH

  {
    name: 'Sneak', actions: 1, priority: 8, category: 'stealth', skill: 'stealth', skillReq: 1,
    source: 'https://2e.aonprd.com/Actions.aspx?ID=63',
    condition: p =>
      !p.isRestrained && (
        (p.skills['stealth']?.rank ?? 0) >= 1 && p.abilities.dex >= 2 &&
        p.featSlugs.has('sneak-attacker') ||
        ((p.skills['stealth']?.rank ?? 0) >= 2 && p.abilities.dex >= 3)
      ),
    why: p =>
      `Stealth ${signed(p.skills['stealth']?.mod)} - move into a Hidden state to set up an off-guard Strike against your target next turn.`
  }

];
