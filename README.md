# PF2E Third Action Suggester

A [Foundry VTT](https://foundryvtt.com) module for the [Pathfinder Second Edition](https://foundryvtt.com/packages/pf2e) system.

When it's your turn in combat, a floating panel appears suggesting smart options for your third action — based on your character's abilities, skills, feats, equipped gear, and what's actually happening on the battlefield.

---

## Features

- **Automatic suggestions** on turn start, tailored to the current actor
- **Rollable actions** — click the dice button to roll directly from the panel
- **Multiple attack penalty** — Trip, Shove, Grapple, Disarm, Reposition and Escape also have **−5** and **−10** buttons for your second and later attacks
- **Colour-coded cards** by category (Athletics & Acrobatics, Social, Defensive, Knowledge, Stealth)
- **Skill rank indicator** on each card showing your current proficiency (NPCs show the modifier instead, e.g. *Athletics +12*)
- **Archives of Nethys links** on every suggestion
- **Condition awareness** — suppresses irrelevant actions (e.g. no Grapple suggestions if the target is already Restrained; Escape comes first when you are Grabbed; Disarm only when an enemy is holding something)
- **Accurate targeting** — Large and Huge enemies and reach weapons count; defeated enemies and enemies you can't see are ignored; unconscious, dying, paralyzed and petrified characters get no suggestions
- **Live panel** — refreshes mid-turn when tokens move, conditions or HP change, a combatant is defeated, or your target changes
- **MAP highlight** — the −5 or −10 button that applies this turn is highlighted, and its tooltip says how many attacks you've made
- **Target warnings** — with one target, a suggestion it makes pointless is dimmed with a reason (e.g. *Your target is already prone.*)
- **Create a Diversion variant picker** — choose Distracting Words, Gesture, or Trick before rolling
- **Persistent panel** — remembers its position and expanded/collapsed state across page refreshes
- **Scrollable, resizable panel** — long lists scroll instead of running off screen; drag the corner to resize, and the size is remembered
- **Keybind** (default `Alt+Shift+S`) to open or close the panel manually

### Action Catalog

| Category | Actions |
|---|---|
| Athletics & Acrobatics | Trip, Shove, Grapple, Disarm, Reposition, Tumble Through |
| Social | Demoralize, Feint, Create a Diversion, Bon Mot |
| Defensive | Raise a Shield, Take Cover, Battle Medicine, Escape |
| Knowledge | Recall Knowledge, Aid |
| Stealth | Sneak |

> **Design principle:** Third Strikes are never suggested. The −10 MAP penalty makes almost any maneuver, utility, or defensive action a better use of your third action.

---

## Installation

**From the Foundry module browser:**
Search for *PF2E Third Action Suggester* and click Install.

**Manual installation:**
Paste the manifest URL into Foundry's *Install Module* dialog:
```
https://raw.githubusercontent.com/gvach11/pf2e-third-action-suggester/main/module.json
```

---

## Usage

1. Enable the module in your world's module settings.
2. Start a combat encounter.
3. When a turn begins for a character you own (or any combatant if you are the GM, depending on *GM: Auto-Open For*), the suggestion panel appears automatically in the lower-right of the screen.
4. Click the collapsed row to expand the suggestions.
5. Click the **dice button** on any card to roll that action directly. On attack actions (Trip, Shove, Grapple, Disarm, Reposition, Escape), click **−5** or **−10** instead if you've already attacked this turn.
6. Click the **ⓘ icon** on Recall Knowledge or Aid to post a chat reminder (whispered to you only). With Recall Knowledge Assistant installed, Recall Knowledge gets a dice button instead (see below).
7. The panel refreshes as the turn plays out, and highlights the MAP button that applies after your attacks.
8. Drag the panel to reposition it — its location is remembered. Drag its bottom-right corner to resize it; long lists scroll.

**Keyboard shortcut:** `Alt+Shift+S` toggles the panel open/closed during combat. Rebind it in *Configure Controls → Modules*.

---

## Settings

All settings are in *Configure Settings → Module Settings → PF2E Third Action Suggester*.

| Setting | Description | Default |
|---|---|---|
| Athletics & Acrobatics Actions | Include Athletics and Acrobatics suggestions | On |
| Social Actions | Include Social suggestions | On |
| Defensive Actions | Include Defensive suggestions | On |
| Knowledge & Support Actions | Include Knowledge suggestions | On |
| Stealth Actions | Include Stealth suggestions | On |
| Minimum Skill Rank | Only suggest skill actions at or above this proficiency tier | Trained |
| Auto-Open Panel on Turn Start | Show the panel automatically; disable for manual-only mode | On |
| GM: Auto-Open For | Which turns open the panel for the GM: All turns, NPC turns only, or Never. The keybind always works | All turns |

---

## Works with Recall Knowledge Assistant

If [PF2e Recall Knowledge Assistant](https://github.com/gvach11/pf2e-recall-knowledge-assistant) 1.0.0 or later is active:

- On a character's turn, the Recall Knowledge **dice button** opens its guided dialog for that character. Target the enemy first with Foundry's Target tool.
- Recall Knowledge is only suggested while at least one enemy you can see within 30 ft is still worth an attempt: the character hasn't failed against it this encounter, and still has something left to learn about it.

On an NPC's turn, or without Recall Knowledge Assistant, Recall Knowledge works as before: a whispered chat reminder, suggested whenever an enemy is within 30 ft.

---

## Compatibility

| Module | Status |
|---|---|
| PF2E system | Required |
| PF2e Recall Knowledge Assistant | Optional (integrates; Foundry v14) |
| PF2E Workbench | Compatible |
| PF2E Toolbelt | Compatible |
| PF2E Dorako UI | Compatible |
| PF2E Modifiers Matter | Compatible |
| PF2E Token HUD | Compatible |

Requires **Foundry VTT v13** or later.

---

## Credits

Created by **Vachna**.
Action rules verified against [Archives of Nethys](https://2e.aonprd.com) (Remaster).

This module was designed and built with the assistance of [Claude](https://claude.ai) (Anthropic). All game rules, action descriptions, and PF2E mechanics were verified by a human against official sources.

---

## License

This module is licensed under the [MIT License](LICENSE).
