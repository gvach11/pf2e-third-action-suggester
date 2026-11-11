import { describe, it, expect } from 'vitest';
import { shouldAutoOpen } from '../../scripts/ui/auto-open.js';

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
