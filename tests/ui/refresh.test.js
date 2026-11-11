import { afterEach, describe, expect, it, vi } from 'vitest';
import { debounce, isRelevantTokenChange, isStaleTurn, panelSignature, turnKey } from '../../scripts/ui/refresh.js';

describe('isRelevantTokenChange', () => {
  it('token moves are relevant, name changes are not', () => {
    expect(isRelevantTokenChange({ x: 100 })).toBe(true);
    expect(isRelevantTokenChange({ y: 200 })).toBe(true);
    expect(isRelevantTokenChange({ elevation: 10 })).toBe(true);
    expect(isRelevantTokenChange({ hidden: true })).toBe(true);
    expect(isRelevantTokenChange({ disposition: -1 })).toBe(true);
    expect(isRelevantTokenChange({ width: 2 })).toBe(true);
    expect(isRelevantTokenChange({ height: 2 })).toBe(true);
    expect(isRelevantTokenChange({ name: 'Bob' })).toBe(false);
    expect(isRelevantTokenChange({})).toBe(false);
  });
});

describe('debounce', () => {
  afterEach(() => vi.useRealTimers());

  it('debounce runs once after the last call', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = debounce(fn, 250);
    debounced();
    vi.advanceTimersByTime(100);
    debounced();
    vi.advanceTimersByTime(100);
    debounced();
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(249);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('turnKey', () => {
  it('turnKey changes when the turn changes', () => {
    const combat = { id: 'c1', round: 2, turn: 0 };
    expect(turnKey(combat)).toBe('c1:2:0');
    expect(turnKey({ ...combat, turn: 1 })).not.toBe(turnKey(combat));
    expect(turnKey({ ...combat, round: 3 })).not.toBe(turnKey(combat));
  });
});

describe('isStaleTurn', () => {
  const combat = { id: 'c1', round: 2, turn: 1 };

  it('a panel from another turn is stale', () => {
    expect(isStaleTurn('c1:2:0', combat)).toBe(true);
  });

  it('a missing combat is stale', () => {
    expect(isStaleTurn('c1:2:1', undefined)).toBe(true);
    expect(isStaleTurn('c1:2:1', null)).toBe(true);
  });

  it('the current turn is not stale', () => {
    expect(isStaleTurn('c1:2:1', combat)).toBe(false);
  });
});

describe('panelSignature', () => {
  const list = () => [
    { slug: 'trip', why: 'Knock it down.', skillLabel: 'Athletics: Trained', targetIssue: null, name: 'Trip' },
    { slug: 'demoralize', why: 'Scare it.', skillLabel: '', targetIssue: null, name: 'Demoralize' },
  ];

  it('the same panel gives the same string', () => {
    const sig = panelSignature('Valeros — 2 suggestions', list());
    expect(typeof sig).toBe('string');
    expect(panelSignature('Valeros — 2 suggestions', list())).toBe(sig);
  });

  it('a changed target issue changes it', () => {
    const changed = list();
    changed[0].targetIssue = 'Your target is already prone.';
    expect(panelSignature('t', changed)).not.toBe(panelSignature('t', list()));
  });

  it('a changed title, why, skill label or order changes it', () => {
    const base = panelSignature('t', list());
    expect(panelSignature('u', list())).not.toBe(base);
    const why = list(); why[1].why = 'Scare it more.';
    expect(panelSignature('t', why)).not.toBe(base);
    const label = list(); label[0].skillLabel = 'Athletics: Expert';
    expect(panelSignature('t', label)).not.toBe(base);
    expect(panelSignature('t', list().reverse())).not.toBe(base);
  });

  it('ignores fields the panel signature does not track', () => {
    const renamed = list(); renamed[0].name = 'Other';
    expect(panelSignature('t', renamed)).toBe(panelSignature('t', list()));
  });

  it('treats a missing target issue or skill label like an empty one', () => {
    const bare = list().map(({ targetIssue, skillLabel, ...s }) => s);
    const empty = list().map(s => ({ ...s, targetIssue: undefined, skillLabel: '' }));
    expect(panelSignature('t', bare)).toBe(panelSignature('t', empty));
  });
});
