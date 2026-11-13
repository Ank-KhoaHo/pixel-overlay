export interface ScrollOffset {
  x: number;
  y: number;
}

export function isBodyScroller(doc: Document = document): boolean {
  try {
    const win = doc.defaultView ?? window;
    const body = doc.body;
    const docEl = doc.documentElement;
    if (!body || !docEl) return false;
    const bodyStyle = win.getComputedStyle(body);
    const htmlStyle = win.getComputedStyle(docEl);
    return (
      (bodyStyle.overflowY === 'auto' || bodyStyle.overflowY === 'scroll') &&
      (htmlStyle.overflowY === 'hidden' || htmlStyle.overflowY === 'clip')
    );
  } catch (err) {
    console.warn('[pixel-overlay]', err);
    return false;
  }
}

export function getScrollOffset(doc: Document = document): ScrollOffset {
  try {
    const win = doc.defaultView ?? window;
    if (isBodyScroller(doc)) {
      const body = doc.body;
      return { x: body?.scrollLeft ?? 0, y: body?.scrollTop ?? 0 };
    }
    return { x: win.scrollX, y: win.scrollY };
  } catch (err) {
    console.warn('[pixel-overlay]', err);
    return { x: 0, y: 0 };
  }
}
