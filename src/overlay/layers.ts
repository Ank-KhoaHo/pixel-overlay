import type { Layer, SiteState } from '../core/types';
import { keyToNudge } from '../core/keys';

export interface LayersView {
  render(s: SiteState, images: Map<string, string>): void;
  destroy(): void;
}

export function mountLayers(opts: {
  doc: Document;
  onMove(id: string, x: number, y: number): void;
  onNudge(dx: number, dy: number): void;
}): LayersView {
  const host = opts.doc.createElement('pixel-overlay-layers');
  const shadow = host.attachShadow({ mode: 'open' });

  const styleEl = opts.doc.createElement('style');
  styleEl.textContent = `
    :host {
      all: initial;
    }
  `;
  shadow.appendChild(styleEl);

  function applyHostStyles(el: HTMLElement, blend: 'normal' | 'difference') {
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
  let currentState: SiteState | null = null;
  let activeDraggingId: string | null = null;

  function applyImageStyles(
    img: HTMLImageElement,
    layer: Layer,
    isActiveUnlocked: boolean,
    isDragging: boolean,
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
        if (!currentState || !currentState.shown) return;
        const isActUnlocked =
          currentState.activeLayerId === layerId &&
          currentState.layers.some((l) => l.id === layerId && !l.locked && l.visible);
        if (!isActUnlocked) return;

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

    img.addEventListener('pointermove', (e: PointerEvent) => {
      try {
        if (!isDragging || (dragPointerId !== null && e.pointerId !== dragPointerId)) {
          return;
        }
        const dx = e.clientX - dragStartX;
        const dy = e.clientY - dragStartY;
        const curX = Math.round(dragInitialX + dx);
        const curY = Math.round(dragInitialY + dy);
        img.style.left = `${curX}px`;
        img.style.top = `${curY}px`;
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
          const dx = e.clientX - dragStartX;
          const dy = e.clientY - dragStartY;
          const finalX = Math.round(dragInitialX + dx);
          const finalY = Math.round(dragInitialY + dy);
          img.style.left = `${finalX}px`;
          img.style.top = `${finalY}px`;
          opts.onMove(layerId, finalX, finalY);
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

      if (nudge !== null && currentState && currentState.shown) {
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

  return {
    render(s: SiteState, images: Map<string, string>) {
      try {
        currentState = s;
        applyHostStyles(host, s.blend);

        if (!s.shown) {
          for (const img of imageElements.values()) {
            img.remove();
          }
          return;
        }

        const currentLayerIds = new Set(s.layers.map((l) => l.id));
        for (const [id, img] of imageElements.entries()) {
          if (!currentLayerIds.has(id)) {
            img.remove();
            imageElements.delete(id);
          }
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
          if (dataUrl && img.src !== dataUrl) {
            img.src = dataUrl;
          }

          const isActiveUnlocked = s.activeLayerId === layer.id && !layer.locked;
          const isDragging = activeDraggingId === layer.id;
          applyImageStyles(img, layer, isActiveUnlocked, isDragging);

          shadow.appendChild(img);
        }
      } catch (err) {
        console.warn('[pixel-overlay]', err);
      }
    },

    destroy() {
      try {
        win.removeEventListener('keydown', handleKeyDown, true);
        host.remove();
        imageElements.clear();
      } catch (err) {
        console.warn('[pixel-overlay]', err);
      }
    },
  };
}
