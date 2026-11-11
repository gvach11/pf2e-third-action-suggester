import { afterEach, describe, expect, it, vi } from 'vitest';
import { debounce, isRelevantTokenChange, isStaleTurn, turnKey } from '../../scripts/ui/refresh.js';

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
