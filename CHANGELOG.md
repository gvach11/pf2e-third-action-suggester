# Changelog

All notable changes to **PF2E Third Action Suggester** are documented here.

---

## [1.1.0] — 2026-11-02

### Recall Knowledge Assistant integration
- With PF2e Recall Knowledge Assistant 0.2.0+ active, a character's Recall Knowledge button opens its guided dialog (dice icon instead of info)
- Recall Knowledge is only suggested while a nearby enemy is still worth an attempt (not failed against this encounter, something left to learn)
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
