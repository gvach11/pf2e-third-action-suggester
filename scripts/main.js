/**
 * PF2E Third Action Suggester - main.js
 */

import { canRouteToRka, hasWorthwhileRecallTarget, openRecallKnowledge } from './integrations/rka.js';
import { MAP_ACTIONS, rollSystemAction } from './actions/roll-action.js';
import { expandedHeight, fitTop } from './ui/panel-geometry.js';

let _activePanel = null;

Hooks.once('init', () => {
  // ── Action category toggles ─────────────────────────────────────────────────
  const CATEGORIES = [
    ['athletics', 'Athletics Actions',                       'Grapple, Trip, Shove, Disarm, Reposition, Escape, Tumble Through'],
    ['social',    'Social Actions',                          'Demoralize, Feint, Create a Diversion, Bon Mot'],
    ['defensive', 'Defensive Actions',                       'Raise a Shield, Take Cover, Battle Medicine'],
    ['knowledge', 'Knowledge & Support Actions',             'Recall Knowledge, Aid'],
    ['stealth',   'Stealth Actions',                         'Sneak'],
  ];
  for (const [key, name, hint] of CATEGORIES) {
    game.settings.register('pf2e-third-action-suggester', `cat-${key}`, {
      name,
      hint,
      scope: 'world',
      config: true,
      type:  Boolean,
      default: true,
    });
  }

  // ── Minimum skill rank threshold ────────────────────────────────────────────
  game.settings.register('pf2e-third-action-suggester', 'minRank', {
    name: 'Minimum Skill Rank for Suggestions',
    hint: 'Only suggest trained-skill actions if the actor meets this proficiency rank. Untrained actions (Escape, Grapple, etc.) always appear.',
    scope: 'world',
    config: true,
    type:  Number,
    choices: { 0: 'Untrained', 1: 'Trained (default)', 2: 'Expert', 3: 'Master' },
    default: 1,
  });

  // ── Auto-open on turn start ─────────────────────────────────────────────────
  game.settings.register('pf2e-third-action-suggester', 'autoTrigger', {
    name: 'Auto-Open Panel on Turn Start',
    hint: "Automatically show the suggestion panel at the start of a combatant's turn. Disable to open it manually with the keybind only.",
    scope: 'client',
    config: true,
    type:  Boolean,
    default: true,
  });

  // ── Keybind: manual panel toggle ────────────────────────────────────────────
  game.keybindings.register('pf2e-third-action-suggester', 'togglePanel', {
    name: 'Toggle Suggestion Panel',
    hint: 'Open or close the Third Action suggestion panel during combat.',
    editable: [{ key: 'KeyS', modifiers: ['Alt', 'Shift'] }],
    onDown: () => {
      if (!game.combat?.started) return false;
      const actor = game.combat.combatant?.actor;
      if (!actor) return false;
      if (!game.user.isGM && !actor.isOwner) return false;
      if (_activePanel) {
        _activePanel.close();
        _activePanel = null;
      } else {
        const suggestions = getSuggestions(actor);
        if (suggestions.length === 0) return false;
        _activePanel = new ThirdActionPanel(actor, suggestions);
        _activePanel.render(true);
      }
      return true;
    },
  });
});

Hooks.once('ready', () => {
  console.log('PF2E Third Action Suggester | Ready');
  // Restore panel after a page refresh if combat is already running and it's
  // the user's turn (or a GM-controlled combatant).
  if (!game.settings.get('pf2e-third-action-suggester', 'autoTrigger')) return;
  const combat = game.combat;
  if (!combat?.started) return;
  const actor = combat.combatant?.actor;
  if (!actor) return;
  if (!game.user.isGM && !actor.isOwner) return;
  const suggestions = getSuggestions(actor);
  if (suggestions.length === 0) return;
  _activePanel = new ThirdActionPanel(actor, suggestions);
  _activePanel.render(true);
});

Hooks.on('deleteCombat', () => {
  if (_activePanel) { _activePanel.close(); _activePanel = null; }
  ThirdActionPanel._clearState();
});

Hooks.on('updateCombat', (combat, changed, _options, _userId) => {
  if (!('turn' in changed) && !('round' in changed)) return;
  if (!combat.started) return;
  const combatant = combat.combatant;
  const actor = combatant?.actor;
  if (!actor) return;
  if (!game.user.isGM && !actor.isOwner) return;
  if (_activePanel) { _activePanel.close(); _activePanel = null; }
  if (!game.settings.get('pf2e-third-action-suggester', 'autoTrigger')) return;
  const suggestions = getSuggestions(actor);
  if (suggestions.length === 0) return;
  _activePanel = new ThirdActionPanel(actor, suggestions);
  _activePanel.render(true);
});

// ===============================================================
// UI PANEL
// ===============================================================

class ThirdActionPanel extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
) {
  constructor(actor, suggestions, options = {}) {
    super(options);
    this.actor = actor;
    this.suggestions = suggestions;
  }

  static DEFAULT_OPTIONS = {
    id: 'pf2e-third-action-suggester-panel',
    classes: ['pf2e-third-action-suggester'],
    position: { width: 360, height: 'auto' },
    window: { resizable: true, minimizable: true, icon: 'fa-solid fa-hand-fist' }
  };

  static PARTS = {
    main: { template: 'modules/pf2e-third-action-suggester/templates/suggestion-panel.hbs' }
  };

  get title() {
    const n = this.suggestions.length;
    return `⚔️ ${this.actor.name} — ${n} suggestion${n !== 1 ? 's' : ''}`;
  }

  async _prepareContext(_options) {
    return {
      suggestions: this.suggestions.map(s => ({
        name:          s.name,
        diamonds:      '◆'.repeat(s.actions),
        why:           s.why,
        slug:          s.slug,
        needsTarget:   s.needsTarget,
        isChatOnly:    s.isChatOnly    ?? false,
        hasMap:        s.hasMap        ?? false,
        category:      s.category      ?? '',
        categoryIcon:  s.categoryIcon  ?? '',
        categoryColor: s.categoryColor ?? '',
        source:        s.source        ?? '',
        skillLabel:    s.skillLabel    ?? '',
        variants:      s.variants      ?? null,
      }))
    };
  }

  _onRender(context, options) {
    if (options.isFirstRender) {
      const saved = ThirdActionPanel._loadState();
      const savedSize = ThirdActionPanel._loadSize();
      if (savedSize?.width) this.setPosition({ width: savedSize.width });

      // Position: use saved coords if available, otherwise auto-calculate.
      if (saved?.left !== undefined && saved?.top !== undefined) {
        this.setPosition({ left: saved.left, top: saved.top });
      } else {
        const sidebarWidth = document.querySelector('#sidebar')?.offsetWidth ?? 300;
        const left = Math.max(10, window.innerWidth - sidebarWidth - 370);
        const hotbarEl = document.querySelector('#hotbar');
        const hotbarTop = hotbarEl ? hotbarEl.getBoundingClientRect().top : (window.innerHeight - 60);
        const top = Math.max(10, hotbarTop - 70);
        this.setPosition({ left, top });
      }

      // Save position after the user drags the window header.
      this.element.querySelector('.window-header')?.addEventListener('pointerup', () => {
        ThirdActionPanel._saveState({ left: this.position.left, top: this.position.top });
      });

      // Save the size once the user lets go of the resize handle. The pointer
      // is usually off the handle by then, so listen on the whole window.
      // Height only counts while expanded; collapsed is always one row.
      this.element.querySelector('.window-resize-handle')?.addEventListener('pointerdown', () => {
        window.addEventListener('pointerup', () => {
          const size = { width: this.element.offsetWidth };
          if (this.element.classList.contains('is-expanded')) size.height = this.element.offsetHeight;
          ThirdActionPanel._saveSize(size);
        }, { once: true });
      });

      const row  = this.element.querySelector('.third-action-collapsed-row');
      const list = this.element.querySelector('.third-action-suggestions');
      const icon = this.element.querySelector('.third-action-expand-btn i');
      const hint = this.element.querySelector('.third-action-hint');

      // Restore expanded/collapsed state.
      if (saved?.expanded) {
        list.hidden = false;
        icon?.classList.replace('fa-chevron-down', 'fa-chevron-up');
        if (hint) hint.textContent = 'Hide suggestions';
      }
      this._fitToContent();

      row?.addEventListener('click', () => {
        const expanding = list.hidden;
        list.hidden = !expanding;
        icon?.classList.toggle('fa-chevron-down', !expanding);
        icon?.classList.toggle('fa-chevron-up',    expanding);
        if (hint) hint.textContent = expanding ? 'Hide suggestions' : 'Show suggestions';
        this._fitToContent();
        ThirdActionPanel._saveState({ expanded: expanding });
      });

      this.element.querySelectorAll('.third-action-roll-btn').forEach(btn => {
        btn.addEventListener('click', e => {
          e.stopPropagation();
          this._rollAction(btn.dataset.slug, btn.dataset.needsTarget === 'true', {}, Number(btn.dataset.map) || 0);
        });
      });

      // Variant sub-menu (Create a Diversion)
      this.element.querySelectorAll('.third-action-variant-list li').forEach(li => {
        li.addEventListener('click', () => {
          li.closest('details').removeAttribute('open');
          this._rollAction(li.dataset.slug, false, { variant: li.dataset.variant });
        });
      });
    }
  }

  // Collapsed: one row. Expanded: the list's natural height, capped so long
  // lists scroll (see expandedHeight), and moved up if it would leave the
  // screen. Foundry may shift the window while measuring, so the top it had
  // beforehand is the one kept on screen.
  _fitToContent() {
    const expanded = !this.element.querySelector('.third-action-suggestions').hidden;
    this.element.classList.toggle('is-expanded', expanded);
    const top = this.position.top;
    this.setPosition({ height: 'auto' });
    if (!expanded) return;
    const viewportHeight = window.innerHeight;
    const height = expandedHeight({
      contentHeight: this.element.offsetHeight,
      savedHeight:   ThirdActionPanel._loadSize()?.height,
      viewportHeight,
    });
    this.setPosition({ height, top: fitTop({ top, height, viewportHeight }) });
  }

  // ── Persistent state helpers (localStorage) ─────────────────────
  // Size is a separate key: unlike position and expanded state, it is a
  // standing preference and survives the end of combat.
  static _saveSize(partial) {
    const current = ThirdActionPanel._loadSize() ?? {};
    try { localStorage.setItem('pf2e-third-action-suggester-size', JSON.stringify(Object.assign(current, partial))); }
    catch { /* storage unavailable — size just isn't remembered */ }
  }

  static _loadSize() {
    try { return JSON.parse(localStorage.getItem('pf2e-third-action-suggester-size')); }
    catch { return null; }
  }

  static _saveState(partial) {
    const current = ThirdActionPanel._loadState() ?? {};
    localStorage.setItem('pf2e-third-action-suggester-state', JSON.stringify(Object.assign(current, partial)));
  }

  static _loadState() {
    try { return JSON.parse(localStorage.getItem('pf2e-third-action-suggester-state')); }
    catch { return null; }
  }

  static _clearState() {
    localStorage.removeItem('pf2e-third-action-suggester-state');
  }

  // `map` is the multiple attack penalty step: 0 = none, 1 = -5, 2 = -10.
  _rollAction(slug, needsTarget, overrideOpts = {}, map = 0) {
    if (needsTarget && game.user.targets.size === 0) {
      ui.notifications.warn('PF2E Third Action | Select a target token first, then click the roll button.');
      return;
    }

    // With Recall Knowledge Assistant active, a character's Recall Knowledge
    // opens its dialog; otherwise it falls through to the chat reminder.
    if (slug === 'recall-knowledge' && openRecallKnowledge(this.actor)) return;

    // Some actions can't be rolled programmatically — post a chat reminder instead.
    if (CHAT_ACTIONS[slug]) {
      const entry = CHAT_ACTIONS[slug];
      ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: entry.name,
        content: entry.content,
        whisper: [game.user.id],
      });
      return;
    }

    // Native PF2E system action registry. Some actions require extra options
    // (e.g. Create a Diversion needs a variant).
    const handled = rollSystemAction(game.pf2e?.actions, {
      actor:   this.actor,
      slug,
      map,
      options: { ...(ACTION_OPTIONS[slug] ?? {}), ...overrideOpts },
      onError: e => ui.notifications.warn(`PF2E Third Action | ${e?.message ?? e}`),
    });
    if (handled) return;

    ui.notifications.warn(`PF2E Third Action | No roll handler found for "${slug}". Roll manually.`);
  }

  async close(options = {}) {
    if (_activePanel === this) _activePanel = null;
    return super.close(options);
  }
}

// ===============================================================
// PROFILE READER
// ===============================================================

function readProfile(actor) {
  const system = actor.system;

  const abilities = {
    str: system.abilities?.str?.mod ?? 0,
    dex: system.abilities?.dex?.mod ?? 0,
    con: system.abilities?.con?.mod ?? 0,
    int: system.abilities?.int?.mod ?? 0,
    wis: system.abilities?.wis?.mod ?? 0,
    cha: system.abilities?.cha?.mod ?? 0
  };

  const skills = {};
  for (const [key, skill] of Object.entries(system.skills ?? {})) {
    skills[key] = { rank: skill.rank ?? 0, mod: skill.totalModifier ?? 0 };
  }

  const featSlugs = new Set(
    actor.items
      .filter(i => ['feat', 'feature', 'action'].includes(i.type))
      .map(i => i.system?.slug ?? slugify(i.name))
  );

  const isItemEquipped = (i) => {
    if (i.isEquipped) return true;
    const ct = i.system?.equipped?.carryType;
    if (ct === 'held' || ct === 'worn') return true;
    if (i.system?.equipped?.value === true) return true;
    if (i.system?.equipped?.inSlot === true) return true;
    return false;
  };

  const hasShield = actor.items.some(i => {
    const ok =
      (i.type === 'armor'  && i.system?.category === 'shield') ||
      (i.type === 'shield') ||
      (i.type === 'weapon' && (i.system?.traits?.value ?? []).includes('shield'));
    return ok && isItemEquipped(i);
  });

  // PF2E tracks handsFree as a computed integer (0,1,2). Default 1 if absent.
  const hasFreeHand = (system.attributes?.handsFree ?? 1) >= 1;

  const hpCurrent = system.attributes?.hp?.value ?? 1;
  const hpMax     = system.attributes?.hp?.max   ?? 1;
  const hpPercent = hpCurrent / hpMax;
  const isLowHp   = hpPercent < 0.5;

  return {
    actorType: actor.type,
    abilities,
    skills,
    featSlugs,
    hasShield,
    hasFreeHand,
    hpPercent,
    isLowHp,
    ...readBattlefieldContext(actor)
  };
}

function readConditions(actor) {
  const slugs  = new Set();
  const values = {};
  try {
    for (const c of (actor.itemTypes?.condition ?? [])) {
      const slug = c.slug ?? c.system?.slug;
      if (!slug) continue;
      slugs.add(slug);
      const val = c.system?.value?.value ?? c.value ?? null;
      if (val !== null) values[slug] = val;
    }
  } catch { /* empty */ }
  return { slugs, values };
}

function readBattlefieldContext(actor) {
  const defaults = {
    hasAdjacentEnemy:        false,
    adjacentEnemyCount:      0,
    hasNearbyEnemy:          false,
    hasWorthwhileRecallTarget: false,
    hasAdjacentAlly:         false,
    hasInjuredAlly:          false,
    isGrabbed:               false,
    isRestrained:            false,
    hasFeintableEnemy:       true,
    hasDemoralizableEnemy:   true,
    hasTrippableEnemy:       true,
    hasGrapplableEnemy:      true,
    hasAdjacentGrabbedEnemy: false,
  };

  try {
    const token = actor.getActiveTokens(true)[0];
    if (!token || !canvas?.tokens) return defaults;

    const allTokens  = canvas.tokens.placeables.filter(t => t !== token && t.actor);
    const myDisp     = token.document.disposition;
    const enemies    = allTokens.filter(t => t.document.disposition !== myDisp && t.document.disposition !== 0);
    const allies     = allTokens.filter(t => t.document.disposition === myDisp);

    const measureFeet = (t) => {
      try {
        return canvas.grid.measurePath([
          { x: token.center.x, y: token.center.y },
          { x: t.center.x,     y: t.center.y     }
        ]).distance ?? Infinity;
      } catch { return Infinity; }
    };

    // Measure each enemy's distance and read its conditions once, then bucket.
    const adjacentEnemies = [];
    const nearbyEnemies   = [];
    const adjC = [];
    const nearC = [];
    for (const t of enemies) {
      const dist = measureFeet(t);
      if (dist > 30) continue;
      const conditions = readConditions(t.actor);
      nearbyEnemies.push(t);
      nearC.push(conditions);
      if (dist <= 5) {
        adjacentEnemies.push(t);
        adjC.push(conditions);
      }
    }

    const hasInjuredAlly = allies.some(t => {
      const hp = t.actor.system?.attributes?.hp;
      return hp && (hp.value / (hp.max || 1)) < 0.75;
    });

    const { slugs: actorSlugs } = readConditions(actor);
    const isRestrained = actorSlugs.has('restrained');
    const isGrabbed    = actorSlugs.has('grabbed') || isRestrained;

    const hasFeintableEnemy       = adjC.length  === 0 ? false : adjC.some(c => !c.slugs.has('off-guard'));
    const hasDemoralizableEnemy   = nearC.length === 0 ? false : nearC.some(c => (c.values['frightened'] ?? 0) < 4);
    const hasTrippableEnemy       = adjC.length  === 0 ? false : adjC.some(c => !c.slugs.has('prone'));
    const hasGrapplableEnemy      = adjC.length  === 0 ? false : adjC.some(c => !c.slugs.has('restrained'));
    const hasAdjacentGrabbedEnemy = adjC.some(c => c.slugs.has('grabbed') || c.slugs.has('restrained'));

    return {
      hasAdjacentEnemy:        adjacentEnemies.length > 0,
      adjacentEnemyCount:      adjacentEnemies.length,
      hasNearbyEnemy:          nearbyEnemies.length > 0,
      hasWorthwhileRecallTarget: hasWorthwhileRecallTarget(actor, nearbyEnemies),
      hasAdjacentAlly:         allies.some(t => measureFeet(t) <= 5),
      hasInjuredAlly,
      isGrabbed,
      isRestrained,
      hasFeintableEnemy,
      hasDemoralizableEnemy,
      hasTrippableEnemy,
      hasGrapplableEnemy,
      hasAdjacentGrabbedEnemy,
    };
  } catch (e) {
    console.warn('PF2E Third Action | Could not read battlefield context:', e);
    return defaults;
  }
}

// ===============================================================
// SUGGESTION ENGINE
// ===============================================================

function getSuggestions(actor) {
  const profile = readProfile(actor);
  const results = [];
  const minRank = game.settings.get('pf2e-third-action-suggester', 'minRank');
  for (const rule of RULES) {
    // Category filter
    if (rule.category) {
      try {
        if (!game.settings.get('pf2e-third-action-suggester', `cat-${rule.category}`)) continue;
      } catch { /* settings not yet registered — skip filter */ }
    }
    // Minimum skill rank filter (only applies to actions with a skill requirement > 0)
    if (rule.skill && rule.skillReq > 0) {
      const charRank = profile.skills[rule.skill]?.rank ?? 0;
      if (charRank < minRank) continue;
    }
    try {
      if (rule.condition(profile)) {
        const slug = slugify(rule.name);
        const catCfg = CATEGORY_CONFIG[rule.category] ?? {};
        let skillLabel = '';
        if (rule.skill) {
          const sk = profile.skills[rule.skill];
          if (sk !== undefined) {
            const sName = rule.skill.charAt(0).toUpperCase() + rule.skill.slice(1);
            skillLabel = `${sName} · ${RANKS[sk.rank] ?? 'Untrained'}`;
          }
        }
        results.push({
          name:          rule.name,
          actions:       rule.actions,
          why:           rule.why(profile),
          priority:      scorePriority(rule, profile),
          slug,
          needsTarget:   !NO_TARGET_ACTIONS.has(slug),
          isChatOnly:    slug in CHAT_ACTIONS && !(slug === 'recall-knowledge' && canRouteToRka(actor)),
          hasMap:        MAP_ACTIONS.has(slug),
          category:      rule.category      ?? '',
          categoryIcon:  catCfg.icon        ?? '',
          categoryColor: catCfg.color       ?? '',
          source:        rule.source        ?? '',
          skillLabel,
          variants:      slug === 'create-a-diversion' ? DIVERSION_VARIANTS : null,
        });
      }
    } catch (e) {
      console.warn(`PF2E Third Action | Rule "${rule.name}" threw:`, e);
    }
  }
  results.sort((a, b) => b.priority - a.priority);
  return results;
}

function scorePriority(rule, profile) {
  let score = rule.priority ?? 0;
  if (rule.defensiveBoost     && profile.isLowHp)                 score += 4;
  if (rule.athleticsBoost)      score += Math.max(0, (profile.skills['athletics']?.mod ?? 0) / 2);
  if (rule.grabComboBoost     && profile.hasAdjacentGrabbedEnemy) score += 2;
  if (rule.requiresAdjacentEnemy && profile.hasAdjacentEnemy)     score += 2;
  return score;
}

// ===============================================================
// UTILITIES
// ===============================================================

function signed(n = 0)  { return n >= 0 ? `+${n}` : `${n}`; }
function slugify(str)   { return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

const RANKS = ['Untrained', 'Trained', 'Expert', 'Master', 'Legendary'];

// ===============================================================
// TARGET REQUIREMENTS
// ===============================================================

// Extra options required by specific PF2E system actions (overridable per-roll).
// Empty for now; kept as an extension point for actions that need preset args.
const ACTION_OPTIONS = {};

// Actions that can't be rolled programmatically — clicking the button posts a
// chat reminder instead so the player knows what to do.
const CHAT_ACTIONS = {
  'recall-knowledge': {
    name: 'Recall Knowledge',
    content: '<p><strong>Recall Knowledge</strong> — Use your best knowledge skill (Arcana, Nature, Occultism, Religion, Society, or Crafting) to identify the creature and learn its traits, abilities, weaknesses, and immunities.</p>'
  },
  'aid': {
    name: 'Aid',
    content: '<p><strong>Aid</strong> — Prepare to help an adjacent ally. Declare which action you are preparing for. When they attempt that action, trigger your Aid reaction to give them a +1 circumstance bonus (higher on a critical success).</p>'
  },
};

const CATEGORY_CONFIG = {
  athletics: { icon: 'fa-hand-fist',     color: '#5a8fc7' },
  social:    { icon: 'fa-comments',      color: '#c9a84c' },
  defensive: { icon: 'fa-shield-halved', color: '#5a9e6a' },
  knowledge: { icon: 'fa-book-open',     color: '#9b7cc8' },
  stealth:   { icon: 'fa-eye-slash',     color: '#7a9e8a' },
};

const DIVERSION_VARIANTS = [
  { id: 'distracting-words', label: 'Distracting Words' },
  { id: 'gesture',           label: 'Gesture' },
  { id: 'trick',             label: 'Trick' },
];

const NO_TARGET_ACTIONS = new Set([
  'escape', 'battle-medicine', 'raise-a-shield', 'take-cover',
  'recall-knowledge', 'sneak', 'create-a-diversion', 'aid',
]);

// ===============================================================
// ACTION RULES CATALOG
// ===============================================================

const RULES = [

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
      (p.skills['medicine']?.rank ?? 0) >= 1 && (p.isLowHp || p.hasInjuredAlly),
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
      ['arcana','nature','occultism','religion','society','crafting'].some(s => (p.skills[s]?.rank ?? 0) >= 2),
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
