import type { Blend, Layer, SiteState } from '../core/types';
import { snap } from '../core/align';
import { keyToNudge } from '../core/keys';
import { shadowModeFor } from './shadowMode';

export interface LayersView {
  render(s: SiteState, images: Map<string, string>): void;
  destroy(): void;
}

export function mountLayers(opts: {
  doc: Document;
  onDragStart?: () => void;
  onMove(id: string, x: number, y: number): void;
  onNudge(dx: number, dy: number): void;
}): LayersView {
  const host = opts.doc.createElement('pixel-overlay-layers');
  const shadow = host.attachShadow({ mode: shadowModeFor(import.meta.env.MODE) });

  const styleEl = opts.doc.createElement('style');
  styleEl.textContent = `
    :host {
      all: initial;
    }
  `;
  shadow.appendChild(styleEl);

  function applyHostStyles(el: HTMLElement, blend: Blend) {
    el.style.setProperty('position', 'absolute', 'important');
    el.style.setProperty('left', '0', 'important');
    el.style.setProperty('top', '0', 'important');
    el.style.setProperty('width', '0', 'important');
    el.style.setProperty('height', '0', 'important');
    el.style.setProperty('z-index', '2147483646', 'important');
    el.style.setProperty('overflow', 'visible', 'important');
    el.style.setProperty('display', 'block', 'important');
    el.style.setProperty('margin', '0', 'important');
    el.style.setProperty('padding', '0', 'important');
    el.style.setProperty('border', '0', 'important');
    el.style.setProperty('pointer-events', 'none', 'important');
    el.style.setProperty('mix-blend-mode', blend, 'important');
  }

  applyHostStyles(host, 'normal');

  if (opts.doc.documentElement) {
    opts.doc.documentElement.appendChild(host);
  } else if (opts.doc.body) {
    opts.doc.body.appendChild(host);
  } else {
    opts.doc.appendChild(host);
  }

  const imageElements = new Map<string, HTMLImageElement>();
  const renderedImageIds = new Map<string, string>();
  let currentState: SiteState | null = null;
  let activeDraggingId: string | null = null;

  function applyImageStyles(
    img: HTMLImageElement,
    layer: Layer,
    isActiveUnlocked: boolean,
    isDragging: boolean,
    invert: boolean,
  ) {
    img.style.position = 'absolute';
    if (!isDragging) {
      img.style.left = `${layer.x}px`;
      img.style.top = `${layer.y}px`;
    }
    img.style.width = `${layer.naturalWidth * layer.scale}px`;
    img.style.height = `${layer.naturalHeight * layer.scale}px`;
    img.style.maxWidth = 'none';
    img.style.maxHeight = 'none';
    img.style.opacity = String(layer.opacity);
    if (invert) {
      img.style.filter = 'invert(1)';
    } else {
      img.style.removeProperty('filter');
    }
    img.style.margin = '0';
    img.style.padding = '0';
    img.style.border = '0';
    img.style.userSelect = 'none';
    img.style.setProperty('-webkit-user-select', 'none');
    img.style.pointerEvents = isActiveUnlocked ? 'auto' : 'none';
    img.style.cursor = isActiveUnlocked ? 'move' : 'default';
  }

  function createImg(layerId: string): HTMLImageElement {
    const img = opts.doc.createElement('img');
    img.setAttribute('data-layer-id', layerId);
    img.draggable = false;

    let isDragging = false;
    let dragPointerId: number | null = null;
    let dragStartX = 0;
    let dragStartY = 0;
    let dragInitialX = 0;
    let dragInitialY = 0;

    img.addEventListener('pointerdown', (e: PointerEvent) => {
      try {
        if (e.button !== 0) return;
        if (!currentState || !currentState.shown || currentState.allHidden) return;
        const isActUnlocked =
          currentState.activeLayerId === layerId &&
          currentState.layers.some((l) => l.id === layerId && !l.locked && l.visible);
        if (!isActUnlocked) return;

        // The panel blurs its own focused field (B1 item 1). Never reach into another
        // host's shadowRoot: it is null in the Store build, where roots are closed.
        opts.onDragStart?.();

        e.preventDefault();
        try {
          img.setPointerCapture(e.pointerId);
        } catch (err) {
          console.warn('[pixel-overlay]', err);
        }

        const layer = currentState.layers.find((l) => l.id === layerId);
        if (!layer) return;

        isDragging = true;
        activeDraggingId = layerId;
        dragPointerId = e.pointerId;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        dragInitialX = layer.x;
        dragInitialY = layer.y;
      } catch (err) {
        console.warn('[pixel-overlay]', err);
      }
    });

    const computePosition = (clientX: number, clientY: number, altKey: boolean) => {
      const dx = clientX - dragStartX;
      const dy = clientY - dragStartY;
      const rawX = Math.round(dragInitialX + dx);
      const rawY = Math.round(dragInitialY + dy);
      if (altKey) {
        return { x: rawX, y: rawY };
      }
      const layer = currentState?.layers.find((l) => l.id === layerId);
      const w = layer ? layer.naturalWidth * layer.scale : 0;
      const pageWidth =
        opts.doc.documentElement?.clientWidth ??
        (opts.doc.defaultView ?? window).innerWidth;
      return snap({ x: rawX, y: rawY, w }, pageWidth);
    };

    img.addEventListener('pointermove', (e: PointerEvent) => {
      try {
        if (!isDragging || (dragPointerId !== null && e.pointerId !== dragPointerId)) {
          return;
        }
        const pos = computePosition(e.clientX, e.clientY, e.altKey);
        img.style.left = `${pos.x}px`;
        img.style.top = `${pos.y}px`;
      } catch (err) {
        console.warn('[pixel-overlay]', err);
      }
    });

    const finishDrag = (e: PointerEvent, commit: boolean) => {
      try {
        if (!isDragging || (dragPointerId !== null && e.pointerId !== dragPointerId)) {
          return;
        }
        isDragging = false;
        activeDraggingId = null;
        dragPointerId = null;
        try {
          img.releasePointerCapture(e.pointerId);
        } catch (err) {
          console.warn('[pixel-overlay]', err);
        }
        if (commit) {
          const pos = computePosition(e.clientX, e.clientY, e.altKey);
          img.style.left = `${pos.x}px`;
          img.style.top = `${pos.y}px`;
          opts.onMove(layerId, pos.x, pos.y);
        }
      } catch (err) {
        console.warn('[pixel-overlay]', err);
      }
    };

    img.addEventListener('pointerup', (e: PointerEvent) => finishDrag(e, true));
    img.addEventListener('pointercancel', (e: PointerEvent) => finishDrag(e, false));

    return img;
  }

  const win = opts.doc.defaultView ?? window;

  const handleKeyDown = (e: KeyboardEvent) => {
    try {
      const path = e.composedPath();
      const target =
        path.length > 0 ? (path[0] as HTMLElement | null) : (e.target as HTMLElement | null);
      let inEditable = false;
      const el = target instanceof Element ? target : (target as Node | null)?.parentElement;
      if (el) {
        const tag = el.tagName.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select') {
          inEditable = true;
        } else if ((el as HTMLElement).isContentEditable) {
          inEditable = true;
        } else if (
          tag.includes('-') &&
          tag !== 'pixel-overlay-layers' &&
          tag !== 'pixel-overlay-panel'
        ) {
          inEditable = true;
        }
      }

      const nudge = keyToNudge({
        key: e.key,
        shiftKey: e.shiftKey,
        altKey: e.altKey,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        inEditable,
      });

      if (nudge !== null && currentState && currentState.shown && !currentState.allHidden) {
        const activeLayer = currentState.layers.find(
          (l) => l.id === currentState?.activeLayerId,
        );
        if (activeLayer && !activeLayer.locked && activeLayer.visible) {
          e.preventDefault();
          opts.onNudge(nudge.dx, nudge.dy);
        }
      }
    } catch (err) {
      console.warn('[pixel-overlay]', err);
    }
  };

  win.addEventListener('keydown', handleKeyDown, true);

  let listeningBody: HTMLElement | null = null;

  const handleBodyScroll = () => {
    try {
      const body = opts.doc.body;
      const docEl = opts.doc.documentElement;
      if (!body || !docEl) return;
      const bodyStyle = win.getComputedStyle(body);
      const htmlStyle = win.getComputedStyle(docEl);
      const bodyOverflowY = bodyStyle.overflowY;
      const htmlOverflowY = htmlStyle.overflowY;
      const isBodyScrollable =
        (bodyOverflowY === 'auto' || bodyOverflowY === 'scroll') &&
        (htmlOverflowY === 'hidden' || htmlOverflowY === 'clip');

      if (isBodyScrollable) {
        host.style.setProperty(
          'transform',
          `translate(${-body.scrollLeft}px, ${-body.scrollTop}px)`,
        );
      } else {
        host.style.removeProperty('transform');
      }
    } catch (err) {
      console.warn('[pixel-overlay]', err);
    }
  };

  const updateScroller = () => {
    try {
      const body = opts.doc.body;
      if (body && listeningBody !== body) {
        if (listeningBody) {
          listeningBody.removeEventListener('scroll', handleBodyScroll);
        }
        body.addEventListener('scroll', handleBodyScroll, { passive: true });
        listeningBody = body;
      }
      handleBodyScroll();
    } catch (err) {
      console.warn('[pixel-overlay]', err);
    }
  };

  win.addEventListener('resize', updateScroller);
  updateScroller();

  return {
    render(s: SiteState, images: Map<string, string>) {
      try {
        if (!host.isConnected) {
          opts.doc.documentElement?.appendChild(host);
        }
        updateScroller();
        currentState = s;
        applyHostStyles(host, s.blend);

        const currentLayerIds = new Set(s.layers.map((l) => l.id));
        for (const [id, img] of imageElements.entries()) {
          if (!currentLayerIds.has(id)) {
            img.remove();
            imageElements.delete(id);
            renderedImageIds.delete(id);
          }
        }

        if (!s.shown || s.allHidden) {
          for (const img of imageElements.values()) {
            img.remove();
          }
          return;
        }

        for (const layer of s.layers) {
          if (!layer.visible) {
            const existing = imageElements.get(layer.id);
            if (existing) {
              existing.remove();
            }
            continue;
          }

          let img = imageElements.get(layer.id);
          if (!img) {
            img = createImg(layer.id);
            imageElements.set(layer.id, img);
          }

          const dataUrl = images.get(layer.imageId);
          if (dataUrl && renderedImageIds.get(layer.id) !== layer.imageId) {
            img.src = dataUrl;
            renderedImageIds.set(layer.id, layer.imageId);
          }

          const isActiveUnlocked = s.activeLayerId === layer.id && !layer.locked;
          const isDragging = activeDraggingId === layer.id;
          applyImageStyles(img, layer, isActiveUnlocked, isDragging, s.invert);

          shadow.appendChild(img);
        }
      } catch (err) {
        console.warn('[pixel-overlay]', err);
      }
    },

    destroy() {
      try {
        win.removeEventListener('keydown', handleKeyDown, true);
        win.removeEventListener('resize', updateScroller);
        if (listeningBody) {
          listeningBody.removeEventListener('scroll', handleBodyScroll);
          listeningBody = null;
        }
        host.remove();
        imageElements.clear();
        renderedImageIds.clear();
      } catch (err) {
        console.warn('[pixel-overlay]', err);
      }
    },
  };
}
