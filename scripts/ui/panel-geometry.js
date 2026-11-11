/**
 * PF2E Third Action Suggester - suggestion panel sizing. Plain numbers in and
 * out, so it can be tested without a browser.
 */

// Gap kept between the panel and the screen edges, in pixels.
export const EDGE_MARGIN = 10;

// Until the user resizes it, an expanded panel takes at most this share of
// the screen height; longer lists scroll.
export const AUTO_HEIGHT_SHARE = 0.6;

// Height of the expanded panel: the content's natural height, capped by the
// user's saved height (or a share of the screen), and always on screen.
export function expandedHeight({ contentHeight, savedHeight, viewportHeight }) {
  const usableSaved = Number.isFinite(savedHeight) && savedHeight > 0;
  const cap = usableSaved ? savedHeight : Math.floor(viewportHeight * AUTO_HEIGHT_SHARE);
  const screenMax = viewportHeight - 2 * EDGE_MARGIN;
  return Math.min(contentHeight, cap, screenMax);
}

// Top coordinate that keeps a window of `height` on screen, moving it up
// when its bottom would go past the screen edge.
export function fitTop({ top, height, viewportHeight }) {
  return Math.max(EDGE_MARGIN, Math.min(top, viewportHeight - height - EDGE_MARGIN));
}
