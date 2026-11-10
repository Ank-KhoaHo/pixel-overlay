import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Blend, LayerPatch, NewLayer, SiteState } from '../core/types';
import { shadowModeFor } from '../overlay/shadowMode';
import type { StorageAreaLike } from '../shared/storage';
import { Panel } from './Panel';
import panelCss from './panel.css?inline';

export interface PanelMountOptions {
  doc: Document;
  area?: StorageAreaLike;
  onAddLayer: (newLayer: NewLayer, dataUrl: string) => Promise<void>;
  onSelectLayer: (id: string) => void;
  onUpdateLayer: (id: string, patch: LayerPatch) => void;
  onMoveLayer: (id: string, dir: 'up' | 'down') => void;
  onDeleteLayer: (id: string) => void;
  onSetBlend: (blend: Blend) => void;
  onSetInvert: (invert: boolean) => void;
  onSetAllHidden: (hidden: boolean) => void;
  onSetCollapsed: (collapsed: boolean) => void;
  onClose: () => void;
  onSavePanelPosition: (x: number, y: number) => void;
}

export interface PanelView {
  render(s: SiteState, images: Map<string, string>, error?: string): void;
  destroy(): void;
  blur(): void;
}

function applyHostPosition(host: HTMLElement, panel: { x: number; y: number }, win: Window) {
  let rawLeft = panel.x;
  if (rawLeft === -1) {
    rawLeft = win.innerWidth - 300 - 16;
  }
  const maxLeft = Math.max(0, win.innerWidth - 300);
  const maxTop = Math.max(0, win.innerHeight - 40);

  const left = Math.min(maxLeft, Math.max(0, rawLeft));
  const top = Math.min(maxTop, Math.max(0, panel.y));

  host.style.setProperty('position', 'fixed', 'important');
  host.style.setProperty('z-index', '2147483647', 'important');
  host.style.setProperty('top', `${top}px`, 'important');
  host.style.setProperty('left', `${left}px`, 'important');
  host.style.setProperty('width', '300px', 'important');
  host.style.setProperty('display', 'block', 'important');
  host.style.setProperty('margin', '0', 'important');
  host.style.setProperty('padding', '0', 'important');
  host.style.setProperty('border', '0', 'important');
}

export function mountPanel(opts: PanelMountOptions): PanelView {
  const host = opts.doc.createElement('pixel-overlay-panel');
  const shadow = host.attachShadow({ mode: shadowModeFor(import.meta.env.MODE) });

  const styleEl = opts.doc.createElement('style');
  styleEl.textContent = panelCss;
  shadow.appendChild(styleEl);

  const rootDiv = opts.doc.createElement('div');
  shadow.appendChild(rootDiv);

  const root: Root = createRoot(rootDiv);

  const win = opts.doc.defaultView ?? window;

  const targetDoc = opts.doc.documentElement ?? opts.doc.body ?? opts.doc;
  targetDoc.appendChild(host);

  let latestState: SiteState | null = null;
  let latestImages: Map<string, string> = new Map();

  const handleResize = () => {
    if (latestState) {
      applyHostPosition(host, latestState.panel, win);
    }
  };

  win.addEventListener('resize', handleResize);

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
  };
  host.addEventListener('dragover', handleDragOver);

  return {
    render(s: SiteState, images: Map<string, string>, error?: string) {
      try {
        if (!host.isConnected) {
          opts.doc.documentElement?.appendChild(host);
        }
        latestState = s;
        latestImages = images;
        applyHostPosition(host, s.panel, win);

        root.render(
          <Panel
            state={s}
            images={latestImages}
            hostEl={host}
            area={opts.area}
            error={error}
            onAddLayer={opts.onAddLayer}
            onSelectLayer={opts.onSelectLayer}
            onUpdateLayer={opts.onUpdateLayer}
            onMoveLayer={opts.onMoveLayer}
            onDeleteLayer={opts.onDeleteLayer}
            onSetBlend={opts.onSetBlend}
            onSetInvert={opts.onSetInvert}
            onSetAllHidden={opts.onSetAllHidden}
            onSetCollapsed={opts.onSetCollapsed}
            onClose={opts.onClose}
            onSavePanelPosition={opts.onSavePanelPosition}
          />,
        );
      } catch (err) {
        console.warn('[pixel-overlay]', err);
      }
    },

    destroy() {
      try {
        win.removeEventListener('resize', handleResize);
        host.removeEventListener('dragover', handleDragOver);
        root.unmount();
        host.remove();
      } catch (err) {
        console.warn('[pixel-overlay]', err);
      }
    },

    blur() {
      try {
        const active = shadow.activeElement as HTMLElement | null;
        if (active && typeof active.blur === 'function') {
          active.blur();
        }
      } catch (err) {
        console.warn('[pixel-overlay]', err);
      }
    },
  };
}
