import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  RKA_MODULE_ID,
  canRouteToRka,
  getRkaApi,
  hasWorthwhileRecallTarget,
  openRecallKnowledge,
} from '../../scripts/integrations/rka.js';

const pc  = { type: 'character' };
const npc = { type: 'npc' };

// Installs a fake RKA module entry (or none) on game.modules.
function stubRka(entry) {
  vi.stubGlobal('game', { modules: { get: id => (id === RKA_MODULE_ID ? entry : undefined) } });
}

function currentApi(overrides = {}) {
  return { apiVersion: 1, openDialog: vi.fn(), getAttemptStatus: vi.fn(() => 'available'), ...overrides };
}

// One visible token per status; getAttemptStatus answers with that token's status.
function tokensWithStatuses(api, statuses) {
  const tokens = statuses.map(status => ({ status, visible: true }));
  api.getAttemptStatus.mockImplementation(({ targetToken }) => targetToken.status);
  return tokens;
}

let warnSpy;

beforeEach(() => {
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('getRkaApi', () => {
  it('is null when RKA is not installed', () => {
    stubRka(undefined);
    expect(getRkaApi()).toBeNull();
  });

  it('is null when RKA is installed but disabled', () => {
    stubRka({ active: false, api: currentApi() });
    expect(getRkaApi()).toBeNull();
  });

  it("is null when RKA is active but hasn't published its API yet", () => {
    stubRka({ active: true });
    expect(getRkaApi()).toBeNull();
  });

  it('is null for RKA 0.1.0, whose API has no apiVersion', () => {
    stubRka({ active: true, api: { openDialog: vi.fn() } });
    expect(getRkaApi()).toBeNull();
  });

  it('returns the API when RKA is active and current', () => {
    const api = currentApi();
    stubRka({ active: true, api });
    expect(getRkaApi()).toBe(api);
  });
});

describe('canRouteToRka', () => {
  it('routes a character when RKA is current', () => {
    stubRka({ active: true, api: currentApi() });
    expect(canRouteToRka(pc)).toBe(true);
  });

  it('never routes an NPC', () => {
    stubRka({ active: true, api: currentApi() });
    expect(canRouteToRka(npc)).toBe(false);
  });

  it('does not route without RKA', () => {
    stubRka(undefined);
    expect(canRouteToRka(pc)).toBe(false);
  });
});

describe('hasWorthwhileRecallTarget with RKA', () => {
  let api;

  beforeEach(() => {
    api = currentApi();
    stubRka({ active: true, api });
  });

  it('is false when every nearby enemy is blocked or exhausted', () => {
    expect(hasWorthwhileRecallTarget(pc, tokensWithStatuses(api, ['blocked', 'exhausted']))).toBe(false);
  });

  it('is true when one nearby enemy is still available', () => {
    expect(hasWorthwhileRecallTarget(pc, tokensWithStatuses(api, ['blocked', 'available']))).toBe(true);
  });

  it("doesn't let an invalid enemy hide an available one", () => {
    expect(hasWorthwhileRecallTarget(pc, tokensWithStatuses(api, ['invalid', 'available']))).toBe(true);
  });

  it('ignores invalid enemies', () => {
    expect(hasWorthwhileRecallTarget(pc, tokensWithStatuses(api, ['invalid']))).toBe(false);
  });

  it('is false with no nearby enemies', () => {
    expect(hasWorthwhileRecallTarget(pc, [])).toBe(false);
  });

  it("ignores enemies this user can't see, so a hidden one can't keep the suggestion alive", () => {
    const [seen, hidden] = tokensWithStatuses(api, ['exhausted', 'available']);
    hidden.visible = false;
    expect(hasWorthwhileRecallTarget(pc, [seen, hidden])).toBe(false);
  });

  it('still counts a visible available enemy next to a hidden one', () => {
    const [hidden, seen] = tokensWithStatuses(api, ['available', 'available']);
    hidden.visible = false;
    expect(hasWorthwhileRecallTarget(pc, [hidden, seen])).toBe(true);
    expect(api.getAttemptStatus).not.toHaveBeenCalledWith({ actor: pc, targetToken: hidden });
  });

  it('asks about each enemy for this actor', () => {
    const [token] = tokensWithStatuses(api, ['blocked']);
    hasWorthwhileRecallTarget(pc, [token]);
    expect(api.getAttemptStatus).toHaveBeenCalledWith({ actor: pc, targetToken: token });
  });
});

describe('hasWorthwhileRecallTarget fallback (1.0.0 behaviour)', () => {
  it('without RKA, any nearby enemy counts', () => {
    stubRka(undefined);
    expect(hasWorthwhileRecallTarget(pc, [{}, {}])).toBe(true);
  });

  it('without RKA, no nearby enemy means no suggestion', () => {
    stubRka(undefined);
    expect(hasWorthwhileRecallTarget(pc, [])).toBe(false);
  });

  it("an NPC's turn doesn't ask RKA", () => {
    const api = currentApi();
    stubRka({ active: true, api });
    expect(hasWorthwhileRecallTarget(npc, [{}])).toBe(true);
    expect(api.getAttemptStatus).not.toHaveBeenCalled();
  });

  it('falls back and warns when RKA throws', () => {
    const api = currentApi({ getAttemptStatus: vi.fn(() => { throw new Error('boom'); }) });
    stubRka({ active: true, api });
    expect(hasWorthwhileRecallTarget(pc, [{}])).toBe(true);
    expect(warnSpy).toHaveBeenCalled();
  });
});

describe('openRecallKnowledge', () => {
  it("opens RKA's dialog for the actor, without naming a target", () => {
    const api = currentApi();
    stubRka({ active: true, api });
    expect(openRecallKnowledge(pc)).toBe(true);
    expect(api.openDialog).toHaveBeenCalledWith({ actor: pc });
  });

  it('leaves an NPC to the chat reminder', () => {
    const api = currentApi();
    stubRka({ active: true, api });
    expect(openRecallKnowledge(npc)).toBe(false);
    expect(api.openDialog).not.toHaveBeenCalled();
  });

  it('leaves it to the chat reminder without RKA', () => {
    stubRka(undefined);
    expect(openRecallKnowledge(pc)).toBe(false);
  });

  it('falls back and warns when RKA throws', () => {
    const api = currentApi({ openDialog: vi.fn(() => { throw new Error('boom'); }) });
    stubRka({ active: true, api });
    expect(openRecallKnowledge(pc)).toBe(false);
    expect(warnSpy).toHaveBeenCalled();
  });
});
