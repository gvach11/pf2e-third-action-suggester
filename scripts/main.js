/**
 * PF2E Third Action Suggester - main.js
 */

import { canRouteToRka, hasWorthwhileRecallTarget, openRecallKnowledge } from './integrations/rka.js';
import { rollSystemAction } from './actions/roll-action.js';
import { expandedHeight, fitTop } from './ui/panel-geometry.js';
import { buildSuggestions } from './suggestions/engine.js';
import { CHAT_ACTIONS, slugify } from './suggestions/rules.js';

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
// SUGGESTIONS
// ===============================================================

function getSuggestions(actor) {
  return buildSuggestions(readProfile(actor), {
    minRank: game.settings.get('pf2e-third-action-suggester', 'minRank'),
    isCategoryEnabled: (category) => {
      try {
        return !!game.settings.get('pf2e-third-action-suggester', `cat-${category}`);
      } catch { return true; /* settings not yet registered — skip filter */ }
    },
    routesRecallKnowledge: canRouteToRka(actor),
  });
}

// ===============================================================
// TARGET REQUIREMENTS
// ===============================================================

// Extra options required by specific PF2E system actions (overridable per-roll).
// Empty for now; kept as an extension point for actions that need preset args.
const ACTION_OPTIONS = {};
