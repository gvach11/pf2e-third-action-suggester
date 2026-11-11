# Changelog

All notable changes to **PF2E Third Action Suggester** are documented here.

---

## [1.2.0] — 2026-11-11

### Added
- Trip, Shove, Grapple, Disarm, Reposition and Escape have **−5** and **−10** buttons next to the dice button, to roll them with the multiple attack penalty
- The suggestion panel can be resized from its bottom-right corner; its size is remembered, including across encounters
- The panel refreshes mid-turn when tokens move, conditions or HP change, a combatant is defeated, or your target changes; a refresh never closes it, and with nothing to suggest it says "No suggestions right now."
- The MAP button that applies this turn is highlighted (d20 before any attack, −5 after one, −10 after two or more); its tooltip says how many attacks you've made
- With exactly one target, a suggestion your target makes pointless is dimmed with a reason, e.g. "Your target is already prone." It never names the target
- New client setting "GM: Auto-Open For" (All turns, NPC turns only, Never); the keybind always works
- NPCs get Trip, Shove and Disarm, and their skill labels show the modifier (e.g. "Athletics +12") instead of a rank
- Take Cover now rolls (posts its effect), and Battle Medicine rolls a Medicine check labelled Battle Medicine

### Fixed
- A long suggestion list no longer runs off screen: it scrolls, and the expanded panel moves up to stay on screen
- Large and Huge enemies count as adjacent, and reach weapons are respected
- Defeated enemies and enemies you can't see are ignored
- NPC skills are read correctly
- Unconscious, dying, paralyzed and petrified characters get no suggestions
- Rogues (with the Sneak Attack class feature) now see Sneak
- Raise a Shield is only suggested when pf2e has a shield in use; an unequipped buckler doesn't count
- Escape comes first while you're Grabbed; it is now a Defensive action, and its text names Athletics, Acrobatics or your unarmed attack
- Disarm is only suggested when an adjacent enemy is holding something
- Battle Medicine is only suggested for an adjacent injured ally, or for yourself when you're low on HP
- Demoralize needs trained Intimidation and Create a Diversion needs trained Deception, replacing the Charisma +1 check; the minimum-rank setting now applies to them
- Recall Knowledge is suggested with a trained knowledge skill (it used to need expert)
- "Athletics Actions" is now "Athletics & Acrobatics Actions" (Grapple, Trip, Shove, Disarm, Reposition, Tumble Through)

---

## [1.1.1] — 2026-11-04

### Fixed
- Installing on Foundry v13 no longer offers Recall Knowledge Assistant, which needs Foundry v14. The integration still works the same whenever Recall Knowledge Assistant is installed and active.

---

## [1.1.0] — 2026-11-02

### Recall Knowledge Assistant integration
- With PF2e Recall Knowledge Assistant 1.0.0+ active, a character's Recall Knowledge button opens its guided dialog (dice icon instead of info)
- Recall Knowledge is only suggested while a nearby enemy you can see is still worth an attempt (not failed against this encounter, something left to learn); hidden enemies never keep it showing
- NPC turns and worlds without Recall Knowledge Assistant keep the 1.0.0 behaviour
- Recall Knowledge Assistant is listed as a recommended module

### Internal
- Nearby enemies' distance and conditions are read in one pass
- Added an automated test suite (vitest) for the integration

---

## [1.0.0] — 2026-06-08

Initial public release.

### Action Catalog
- 17 actions across 5 categories: Athletics, Social, Defensive, Knowledge, Stealth
- Athletics: Trip, Shove, Grapple, Disarm, Reposition, Escape, Tumble Through
- Social: Demoralize, Feint, Create a Diversion, Bon Mot
- Defensive: Raise a Shield, Take Cover, Battle Medicine
- Knowledge: Recall Knowledge, Aid
- Stealth: Sneak
- All rules verified against Archives of Nethys (Remaster)

### Suggestion Engine
- Reads actor abilities, skill ranks, feats, equipped items, and HP state
- Reads battlefield context: adjacent/nearby enemies and allies, canvas distances
- Reads active conditions: suppresses actions blocked by Grabbed, Restrained, Prone, off-guard, Frightened
- Surfaces Escape automatically when actor is Grabbed or Restrained
- Dynamic priority scoring with situational boosts (low HP, Athletics modifier, adjacent grabbed enemy)

### UI Panel
- Floating ApplicationV2 panel, appears automatically on turn start
- Collapsed by default; expands on click
- Colour-coded suggestion cards by category with category icons
- Skill rank indicator on each card
- Archives of Nethys source link on each card
- Roll button on each card — rolls the action directly via the native PF2E system
- Create a Diversion variant picker (Distracting Words / Gesture / Trick)
- Recall Knowledge and Aid post a whispered chat reminder instead of rolling
- Panel position and expanded state persist across page refreshes (localStorage)
- Panel closes automatically when combat ends

### Settings
- Per-category enable/disable toggles (Athletics, Social, Defensive, Knowledge, Stealth)
- Minimum skill rank threshold (Untrained / Trained / Expert / Master)
- Auto-open on turn start toggle (client-scoped)
- Keybind for manual panel toggle (default: Alt+Shift+S)

### Compatibility
- Requires Foundry VTT v13 and the PF2E system
- Tested with PF2E Workbench, Toolbelt, Dorako UI, Modifiers Matter, Token HUD
