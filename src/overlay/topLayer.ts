// A5: put a host element in the browser's top layer, so a `transform` (or filter, contain,
// perspective) on <html> or <body> cannot become its containing block. In the top layer an
// absolute host still scrolls with the page, a fixed one stays put, and mix-blend-mode still
// blends with the page beneath (spike, 2026-11-12).
//
// A manual popover is the top-layer entry point that needs no dialog semantics. The browser's
// own popover styles, and any page rule aimed at [popover], are cancelled here where the caller
// does not already set them (the callers set margin, padding and border to 0 themselves); the
// caller keeps setting position, left, top, width, height, z-index, display and mix-blend-mode.
// Browsers without popovers keep the old attach, which is right on every page that has no such
// transform.

const OVERRIDES: ReadonlyArray<readonly [string, string]> = [
  ['right', 'auto'],
  ['bottom', 'auto'],
  ['background', 'transparent'],
  ['color', 'inherit'],
  ['overflow', 'visible'],
  ['max-width', 'none'],
  ['max-height', 'none'],
  ['min-width', '0'],
  ['min-height', '0'],
  ['opacity', '1'],
  ['filter', 'none'],
  ['transform', 'none'],
  ['translate', 'none'],
  ['scale', 'none'],
  ['rotate', 'none'],
  ['visibility', 'visible'],
];

export function promoteToTopLayer(el: HTMLElement): void {
  try {
    if (typeof el.showPopover !== 'function') return;
    if (el.getAttribute('popover') !== 'manual') el.setAttribute('popover', 'manual');
    for (const [prop, value] of OVERRIDES) {
      if (
        prop === 'transform' &&
        el.style.getPropertyValue('transform') &&
        el.style.getPropertyValue('transform') !== 'none'
      ) {
        continue;
      }
      el.style.setProperty(prop, value, 'important');
    }
    if (el.tagName.toLowerCase() === 'pixel-overlay-panel') {
      el.style.setProperty('height', 'auto', 'important');
    }
    if (el.isConnected && !el.matches(':popover-open')) el.showPopover();
  } catch (err) {
    console.warn('[pixel-overlay]', err);
  }
}

export function raisePanel(doc: Document): void {
  try {
    const panel = doc.querySelector('pixel-overlay-panel');
    if (panel instanceof HTMLElement && panel.matches(':popover-open')) {
      if (typeof panel.hidePopover === 'function' && typeof panel.showPopover === 'function') {
        panel.hidePopover();
        panel.showPopover();
      }
    }
  } catch (err) {
    console.warn('[pixel-overlay]', err);
  }
}
