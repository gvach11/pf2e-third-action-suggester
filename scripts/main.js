/**
 * PF2E Third Action Suggester - main.js
 */

import { canRouteToRka, hasWorthwhileRecallTarget, openRecallKnowledge } from './integrations/rka.js';
import { rollSystemAction } from './actions/roll-action.js';
import { expandedHeight, fitTop } from './ui/panel-geometry.js';
import { debounce, isRelevantTokenChange, isStaleTurn, turnKey } from './ui/refresh.js';
import { countAttacksSince, mapButtonState, mapStepFor } from './ui/map-tracker.js';
import { buildSuggestions } from './suggestions/engine.js';
import { CHAT_ACTIONS } from './suggestions/rules.js';
import { readActorProfile } from './profile/actor-profile.js';
import { assessBattlefield, tokenFacts } from './profile/battlefield.js';
import { targetIssue } from './ui/target-check.js';
import { shouldAutoOpen } from './ui/auto-open.js';

let _activePanel = null;
// When the current turn began, as TAS saw it. Panels opened in a turn TAS did
// not see start (reload, keybind) have no reliable count and show no MAP hint.
let _turnStart = null;

Hooks.once('init', () => {
  // ── Action category toggles ─────────────────────────────────────────────────
  const CATEGORIES = [
    ['athletics', 'Athletics & Acrobatics Actions',          'Grapple, Trip, Shove, Disarm, Reposition, Tumble Through'],
    ['social',    'Social Actions',                          'Demoralize, Feint, Create a Diversion, Bon Mot'],
    ['defensive', 'Defensive Actions',                       'Raise a Shield, Take Cover, Battle Medicine, Escape'],
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

  game.settings.register('pf2e-third-action-suggester', 'gmAutoOpen', {
    name: 'GM: Auto-Open For',
    hint: "Which combatants' turns open the panel automatically on the GM's screen. The keybind always works.",
    scope: 'client',
    config: true,
    type:  String,
    choices: { all: 'All turns', npc: 'NPC turns only', none: 'Never' },
    default: 'all',
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
        _activePanel = new ThirdActionPanel(actor, suggestions, game.combat);
        _activePanel.render(true);
      }
      return true;
    },
  });
});

function autoOpenAllowed(actor) {
  return shouldAutoOpen({
    isGM: game.user.isGM,
    hasPlayerOwner: !!actor.hasPlayerOwner,
    gmMode: game.settings.get('pf2e-third-action-suggester', 'gmAutoOpen'),
  });
}

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
  if (!autoOpenAllowed(actor)) return;
  const suggestions = getSuggestions(actor);
  if (suggestions.length === 0) return;
  _activePanel = new ThirdActionPanel(actor, suggestions, combat);
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
  _turnStart = { key: turnKey(combat), at: combat._stats?.modifiedTime ?? Date.now() };
  if (_activePanel) { _activePanel.close(); _activePanel = null; }
  if (!game.settings.get('pf2e-third-action-suggester', 'autoTrigger')) return;
  if (!autoOpenAllowed(actor)) return;
  const suggestions = getSuggestions(actor);
  if (suggestions.length === 0) return;
  _activePanel = new ThirdActionPanel(actor, suggestions, combat);
  _activePanel.render(true);
});

// ── Mid-turn refresh ────────────────────────────────────────────────
// Players usually move before their third action, so the panel recomputes
// whenever the battlefield changes. Every hook just pokes the debounced
// refresh, which does nothing unless the open panel's turn is still on.
const refreshIfCurrent = debounce(() => {
  const panel = _activePanel;
  if (!panel?.rendered) return;
  if (isStaleTurn(panel.turnKey, game.combats?.get(panel.combatId))) return;
  panel.refresh();
}, 250);

Hooks.on('updateToken', (_token, changed) => {
  if (isRelevantTokenChange(changed)) refreshIfCurrent();
});
// updateToken fires as a move starts, while a player's vision is still
// catching up with the animation, so a refresh then can read `visible` from
// midway. sightRefresh fires after each vision update, including when the
// move ends; the trailing debounce makes the last refresh land after that.
Hooks.on('sightRefresh', () => refreshIfCurrent());
Hooks.on('createToken', () => refreshIfCurrent());
Hooks.on('targetToken', () => refreshIfCurrent());
Hooks.on('deleteToken', () => refreshIfCurrent());
for (const hook of ['createItem', 'updateItem', 'deleteItem']) {
  Hooks.on(hook, item => {
    if (item?.type === 'condition') refreshIfCurrent();
  });
}
Hooks.on('updateActor', (_actor, changed) => {
  if (foundry.utils.hasProperty(changed, 'system.attributes.hp')) refreshIfCurrent();
});
Hooks.on('updateCombatant', (_combatant, changed) => {
  if ('defeated' in changed) refreshIfCurrent();
});
// A new attack roll changes which MAP button is suggested; only classes and
// tooltips change, so no re-render.
Hooks.on('createChatMessage', () => {
  if (_activePanel?.rendered) _activePanel._applyMapHighlight();
});

// ===============================================================
// UI PANEL
// ===============================================================

class ThirdActionPanel extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
) {
  // `combat` is the encounter whose turn opened the panel. A refresh checks
  // that encounter by id rather than game.combat, which can be another one.
  constructor(actor, suggestions, combat, options = {}) {
    super(options);
    this.actor = actor;
    this.suggestions = suggestions;
    this.combatId = combat?.id;
    this.turnKey = combat ? turnKey(combat) : null;
    // The turn's token. Unlinked NPCs share a base actor id, so the MAP count
    // matches chat speakers by token where it can.
    this.tokenId = combat?.combatant?.tokenId ?? actor.token?.id ?? null;
    this._expanded = false;
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
    // Target facts exist only with exactly one target and a token of our own.
    let target = null;
    let reach = 5;
    try {
      const selfToken = this.actor.getActiveTokens(true)[0];
      if (game.user.targets.size === 1 && selfToken) {
        reach = this.actor.getReach?.({ action: 'attack' }) || 5;
        target = tokenFacts([...game.user.targets][0], selfToken, { reach });
      }
    } catch (e) {
      console.warn('PF2E Third Action | Could not read the target:', e);
    }
    return {
      suggestions: this.suggestions.map(s => ({
        targetIssue:   targetIssue(s.slug, target, { reach }),
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

  // The window frame (header, resize handle) survives re-renders, so its
  // listeners and the saved position and size are set up once. The part's
  // HTML is replaced on every render, so its listeners are bound each time.
  _onRender(context, options) {
    if (options.isFirstRender) {
      const saved = ThirdActionPanel._loadState();
      const savedSize = ThirdActionPanel._loadSize();
      this._expanded = !!saved?.expanded;
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
    }

    // The suggestion count changes on a refresh, and Foundry only sets the
    // title on the first render.
    if (this.window?.title) this.window.title.textContent = this.title;

    this._applyExpanded();
    // A minimized window can't be measured; maximize() fits it instead.
    if (!this.minimized) this._fitToContent();

    this.element.querySelector('.third-action-collapsed-row')?.addEventListener('click', () => {
      this._expanded = !this._expanded;
      this._applyExpanded();
      this._fitToContent();
      ThirdActionPanel._saveState({ expanded: this._expanded });
    });

    this.element.querySelectorAll('.third-action-roll-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        this._rollAction(btn.dataset.slug, btn.dataset.needsTarget === 'true', {}, Number(btn.dataset.map) || 0);
      });
    });

    this._applyMapHighlight();

    // Variant sub-menu (Create a Diversion)
    this.element.querySelectorAll('.third-action-variant-list li').forEach(li => {
      li.addEventListener('click', () => {
        li.closest('details').removeAttribute('open');
        this._rollAction(li.dataset.slug, false, { variant: li.dataset.variant });
      });
    });
  }

  // Marks the roll button for the MAP step that applies now. Only toggles
  // classes and tooltips. Without a known turn start there is no highlight.
  _applyMapHighlight() {
    const el = this.element;
    if (!el) return;
    const known = !!_turnStart && _turnStart.key === this.turnKey;
    const count = known
      ? countAttacksSince(game.messages?.contents ?? [], {
        actorId: this.actor.id, tokenId: this.tokenId, since: _turnStart.at,
      })
      : 0;
    const step = mapStepFor(count);
    el.querySelectorAll('.third-action-map-btn[data-map]').forEach(mapBtn => {
      mapBtn.parentElement.querySelectorAll('.third-action-roll-btn[data-slug]').forEach(btn => {
        if (btn.dataset.baseTitle === undefined) btn.dataset.baseTitle = btn.getAttribute('title') ?? '';
        const state = mapButtonState({
          map: Number(btn.dataset.map) || 0, baseTitle: btn.dataset.baseTitle, step, attacks: count, known,
        });
        btn.classList.toggle('is-suggested-map', state.highlighted);
        btn.title = state.title;
      });
    });
  }

  // Shows or hides the list to match this._expanded, with its chevron and hint.
  _applyExpanded() {
    const expanded = this._expanded;
    const list = this.element.querySelector('.third-action-suggestions');
    const icon = this.element.querySelector('.third-action-expand-btn i');
    const hint = this.element.querySelector('.third-action-hint');
    if (list) list.hidden = !expanded;
    icon?.classList.toggle('fa-chevron-down', !expanded);
    icon?.classList.toggle('fa-chevron-up',    expanded);
    if (hint) hint.textContent = expanded ? 'Hide suggestions' : 'Show suggestions';
  }

  // Recompute the suggestions for the current battlefield and re-render in
  // place. Position, size and expanded state carry over, and so does the
  // list's scroll, which the re-render would otherwise reset. Never closes
  // the panel.
  async refresh() {
    try {
      this.suggestions = getSuggestions(this.actor);
    } catch (e) {
      console.warn('PF2E Third Action | Could not refresh suggestions:', e);
      return;
    }
    const scrollTop = this.element?.querySelector('.third-action-suggestions')?.scrollTop ?? 0;
    await this.render();
    const list = this.element?.querySelector('.third-action-suggestions');
    if (list && scrollTop) list.scrollTop = scrollTop;
  }

  async maximize() {
    const wasMinimized = this.minimized;
    await super.maximize();
    if (wasMinimized && this.rendered) this._fitToContent();
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
  return { ...readActorProfile(actor), ...readBattlefieldContext(actor) };
}

function readBattlefieldContext(actor) {
  const defaults = {
    hasAdjacentEnemy:          false,
    adjacentEnemyCount:        0,
    hasNearbyEnemy:            false,
    hasWorthwhileRecallTarget: false,
    hasAdjacentAlly:           false,
    hasInjuredAdjacentAlly:    false,
    hasFeintableEnemy:         true,
    hasDemoralizableEnemy:     true,
    hasTrippableEnemy:         true,
    hasGrapplableEnemy:        true,
    hasDisarmableEnemy:        false,
    hasAdjacentGrabbedEnemy:   false,
  };

  try {
    const token = actor.getActiveTokens(true)[0];
    if (!token || !canvas?.tokens) return defaults;

    const reach = actor.getReach?.({ action: 'attack' }) || 5;
    const others = canvas.tokens.placeables
      .filter(t => t !== token && t.actor)
      .map(t => tokenFacts(t, token, { reach }));
    const { nearbyEnemyTokens, ...flags } = assessBattlefield(others, { reach });
    return {
      ...flags,
      hasWorthwhileRecallTarget: hasWorthwhileRecallTarget(actor, nearbyEnemyTokens),
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
