/**
 * PF2E Third Action Suggester - the suggestion engine.
 *
 * Pure: takes an actor profile plus the settings it needs, touches no Foundry
 * globals.
 */

import { MAP_ACTIONS } from '../actions/roll-action.js';
import {
  CATEGORY_CONFIG, CHAT_ACTIONS, DIVERSION_VARIANTS, NO_TARGET_ACTIONS, RANKS, RULES, signed, slugify,
} from './rules.js';

export function buildSuggestions(profile, { minRank, isCategoryEnabled, routesRecallKnowledge }) {
  const results = [];
  if (profile.isIncapacitated) return results;
  for (const rule of RULES) {
    // Category filter
    if (rule.category && !isCategoryEnabled(rule.category)) continue;
    // Minimum skill rank filter (only applies to actions with a skill requirement > 0)
    if (rule.skill && rule.skillReq > 0) {
      const sk = profile.skills[rule.skill];
      // A rank pf2e does not report (NPCs) cannot be filtered on.
      if (sk?.rankKnown !== false && (sk?.rank ?? 0) < minRank) continue;
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
            skillLabel = sk.rankKnown === false
              ? `${sName} ${signed(sk.mod)}`
              : `${sName} · ${RANKS[sk.rank] ?? 'Untrained'}`;
          }
        }
        results.push({
          name:          rule.name,
          actions:       rule.actions,
          why:           rule.why(profile),
          priority:      scorePriority(rule, profile),
          slug,
          needsTarget:   !NO_TARGET_ACTIONS.has(slug),
          isChatOnly:    slug in CHAT_ACTIONS && !(slug === 'recall-knowledge' && routesRecallKnowledge),
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
