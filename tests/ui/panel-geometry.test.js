import { describe, expect, it } from 'vitest';
import { AUTO_HEIGHT_SHARE, EDGE_MARGIN, expandedHeight, fitTop } from '../../scripts/ui/panel-geometry.js';

describe('expandedHeight', () => {
  it('fits the content when it is short', () => {
    expect(expandedHeight({ contentHeight: 300, viewportHeight: 1000 })).toBe(300);
  });

  it('caps long content at a share of the screen so the list scrolls', () => {
    expect(expandedHeight({ contentHeight: 2000, viewportHeight: 1000 })).toBe(Math.floor(1000 * AUTO_HEIGHT_SHARE));
  });

  it("uses the user's resized height as the cap instead", () => {
    expect(expandedHeight({ contentHeight: 2000, savedHeight: 800, viewportHeight: 1000 })).toBe(800);
  });

  it('never grows past the content, even after the user made it taller', () => {
    expect(expandedHeight({ contentHeight: 250, savedHeight: 800, viewportHeight: 1000 })).toBe(250);
  });

  it('keeps a saved height inside a smaller screen', () => {
    expect(expandedHeight({ contentHeight: 2000, savedHeight: 900, viewportHeight: 700 })).toBe(700 - 2 * EDGE_MARGIN);
  });

  it('ignores a saved height that is not a usable number', () => {
    expect(expandedHeight({ contentHeight: 2000, savedHeight: 'auto', viewportHeight: 1000 })).toBe(Math.floor(1000 * AUTO_HEIGHT_SHARE));
  });
});

describe('fitTop', () => {
  it('leaves a window that fits where it is', () => {
    expect(fitTop({ top: 100, height: 300, viewportHeight: 1000 })).toBe(100);
  });

  it('moves a window up when its bottom would be off screen', () => {
    expect(fitTop({ top: 900, height: 300, viewportHeight: 1000 })).toBe(1000 - 300 - EDGE_MARGIN);
  });

  it('never moves the window above the top margin', () => {
    expect(fitTop({ top: 500, height: 1200, viewportHeight: 1000 })).toBe(EDGE_MARGIN);
  });
});
