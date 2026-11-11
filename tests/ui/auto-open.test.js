import { describe, it, expect } from 'vitest';
import { isDismissal, shouldAutoOpen, shouldOpenPendingTurn } from '../../scripts/ui/auto-open.js';

const gm = (gmMode, hasPlayerOwner) => shouldAutoOpen({ isGM: true, hasPlayerOwner, gmMode });

describe('shouldAutoOpen', () => {
  it("'all' opens for PC and NPC turns", () => {
    expect(gm('all', true)).toBe(true);
    expect(gm('all', false)).toBe(true);
  });

  it("'npc' opens only for NPC turns", () => {
    expect(gm('npc', false)).toBe(true);
    expect(gm('npc', true)).toBe(false);
  });

  it("'none' never opens", () => {
    expect(gm('none', true)).toBe(false);
    expect(gm('none', false)).toBe(false);
  });

  it('treats an unknown mode as all', () => {
    expect(gm('bogus', true)).toBe(true);
    expect(gm(undefined, false)).toBe(true);
  });

  it('players are unaffected', () => {
    for (const gmMode of ['all', 'npc', 'none']) {
      expect(shouldAutoOpen({ isGM: false, hasPlayerOwner: true, gmMode })).toBe(true);
      expect(shouldAutoOpen({ isGM: false, hasPlayerOwner: false, gmMode })).toBe(true);
    }
  });
});

describe('shouldOpenPendingTurn', () => {
  const combat = { id: 'c1', round: 2, turn: 1 };
  const pending = { combatId: 'c1', turnKey: 'c1:2:1', actorId: 'a1' };
  const open = (over = {}) => shouldOpenPendingTurn({ pending, dismissedKey: null, hasPanel: false, combat, ...over });

  it('opens a pending turn that is still current', () => {
    expect(open()).toBe(true);
  });

  it('does nothing without a pending turn', () => {
    expect(open({ pending: null })).toBe(false);
  });

  it('never opens a second panel', () => {
    expect(open({ hasPanel: true })).toBe(false);
  });

  it('does nothing once the turn has moved on or the combat is gone', () => {
    expect(open({ combat: { ...combat, turn: 2 } })).toBe(false);
    expect(open({ combat: undefined })).toBe(false);
  });

  it("doesn't reopen a turn the user dismissed", () => {
    expect(open({ dismissedKey: 'c1:2:1' })).toBe(false);
    expect(open({ dismissedKey: 'c1:2:0' })).toBe(true);
  });
});

describe('isDismissal', () => {
  const combat = { id: 'c1', round: 2, turn: 1 };

  it('closing during the panel\'s own turn is a dismissal', () => {
    expect(isDismissal('c1:2:1', combat)).toBe(true);
  });

  it('a close after the turn changed or the combat ended is not', () => {
    expect(isDismissal('c1:2:0', combat)).toBe(false);
    expect(isDismissal('c1:2:1', undefined)).toBe(false);
  });

  it('a panel without a turn is never a dismissal', () => {
    expect(isDismissal(null, combat)).toBe(false);
  });
});
