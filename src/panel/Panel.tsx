import React, { useEffect, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import { isKeepable, siteOf } from '../core/site';
import {
  KEPT_KEY,
  type Blend,
  type LayerPatch,
  type NewLayer,
  type SiteState,
} from '../core/types';
import type { StorageAreaLike } from '../shared/storage';
import { chromeLocalArea } from '../shared/store';
import { AddImage, processFiles } from './AddImage';
import { LayerControls } from './LayerControls';
import { LayerList } from './LayerList';

export interface PanelProps {
  state: SiteState;
  images: Map<string, string>;
  hostEl: HTMLElement;
  area?: StorageAreaLike;
  error?: string;
  onError?: (err: string) => void;
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

export function Panel({
  state,
  images,
  hostEl,
  area: propArea,
  error: propError,
  onError: propOnError,
  onAddLayer,
  onSelectLayer,
  onUpdateLayer,
  onMoveLayer,
  onDeleteLayer,
  onSetBlend,
  onSetInvert,
  onSetAllHidden,
  onSetCollapsed,
  onClose,
  onSavePanelPosition,
}: PanelProps) {
  const [error, setError] = useState<string>(propError ?? '');
  const [isKept, setIsKept] = useState<boolean>(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<StorageAreaLike>(propArea ?? chromeLocalArea());
  if (propArea) {
    areaRef.current = propArea;
  }
  const site = siteOf(location.href);
  const keepable = site !== null && isKeepable(site);

  useEffect(() => {
    if (propError !== undefined) {
      setError(propError);
    }
  }, [propError]);

  const syncKept = async () => {
    try {
      if (!site || !keepable) {
        setIsKept(false);
        return;
      }
      const currentArea = areaRef.current;
      const data = await currentArea.get(KEPT_KEY);
      const list = data[KEPT_KEY];
      const kept = Array.isArray(list) && list.includes(site);
      setIsKept(kept);
    } catch (err) {
      console.warn('[pixel-overlay]', err);
    }
  };

  useEffect(() => {
    const currentArea = areaRef.current;

    void syncKept();

    const listener = (changes: Record<string, { newValue?: unknown }>) => {
      if (Object.prototype.hasOwnProperty.call(changes, KEPT_KEY)) {
        if (!site || !keepable) {
          setIsKept(false);
          return;
        }
        const list = changes[KEPT_KEY]?.newValue;
        const kept = Array.isArray(list) && list.includes(site);
        setIsKept(kept);
      }
    };

    currentArea.onChanged.addListener(listener);

    const win = hostEl.ownerDocument.defaultView ?? window;
    const handleFocus = () => {
      void syncKept();
    };
    win.addEventListener('focus', handleFocus);

    return () => {
      currentArea.onChanged.removeListener(listener);
      win.removeEventListener('focus', handleFocus);
    };
  }, [hostEl, site, keepable]);

  const handleKeepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!site || !keepable) return;
    const nextChecked = e.target.checked;
    setIsKept(nextChecked);
    try {
      void browser.runtime.sendMessage({
        type: 'po/keep',
        origin: site,
        on: nextChecked,
      }).catch((err) => {
        console.warn('[pixel-overlay]', err);
      });
    } catch (err) {
      console.warn('[pixel-overlay]', err);
    }
    setTimeout(() => {
      void syncKept();
    }, 300);
  };

  const dragRef = useRef<{
    startX: number;
    startY: number;
    initialLeft: number;
    initialTop: number;
    hasMoved: boolean;
  } | null>(null);

  const handleHeaderPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button')) return;

    const win = hostEl.ownerDocument.defaultView ?? window;
    const maxLeft = Math.max(0, win.innerWidth - 300);
    const maxTop = Math.max(0, win.innerHeight - 40);

    let rawLeft = state.panel.x;
    if (rawLeft === -1) {
      rawLeft = win.innerWidth - 300 - 16;
    }
    const initialLeft = Math.min(maxLeft, Math.max(0, rawLeft));
    const initialTop = Math.min(maxTop, Math.max(0, state.panel.y));

    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialLeft,
      initialTop,
      hasMoved: false,
    };

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (err) {
      console.warn('[pixel-overlay]', err);
    }
  };

  const handleHeaderPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const win = hostEl.ownerDocument.defaultView ?? window;
    const maxLeft = Math.max(0, win.innerWidth - 300);
    const maxTop = Math.max(0, win.innerHeight - 40);

    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    dragRef.current.hasMoved = true;
    const curX = Math.min(maxLeft, Math.max(0, Math.round(dragRef.current.initialLeft + dx)));
    const curY = Math.min(maxTop, Math.max(0, Math.round(dragRef.current.initialTop + dy)));
    hostEl.style.setProperty('left', `${curX}px`, 'important');
    hostEl.style.setProperty('top', `${curY}px`, 'important');
  };

  const handleHeaderPointerUp = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const { startX, startY, initialLeft, initialTop, hasMoved } = dragRef.current;
    dragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (err) {
      console.warn('[pixel-overlay]', err);
    }
    if (hasMoved) {
      const win = hostEl.ownerDocument.defaultView ?? window;
      const maxLeft = Math.max(0, win.innerWidth - 300);
      const maxTop = Math.max(0, win.innerHeight - 40);

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const finalX = Math.min(maxLeft, Math.max(0, Math.round(initialLeft + dx)));
      const finalY = Math.min(maxTop, Math.max(0, Math.round(initialTop + dy)));
      onSavePanelPosition(finalX, finalY);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    if (e.defaultPrevented) return;
    try {
      const files = e.clipboardData?.files;
      if (files && files.length > 0) {
        e.preventDefault();
        void processFiles(
          Array.from(files),
          () => {
            setError('');
            propOnError?.('');
          },
          (err) => {
            setError(err);
            propOnError?.(err);
          },
          onAddLayer,
        );
      }
    } catch (err) {
      console.warn('[pixel-overlay]', err);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    try {
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        void processFiles(
          Array.from(files),
          () => {
            setError('');
            propOnError?.('');
          },
          (err) => {
            setError(err);
            propOnError?.(err);
          },
          onAddLayer,
        );
      }
    } catch (err) {
      console.warn('[pixel-overlay]', err);
    }
  };

  const hasLayers = state.layers.length > 0;
  const activeLayer = state.layers.find((l) => l.id === state.activeLayerId) ?? null;

  const handleBlendToggle = () => {
    onSetBlend(state.blend === 'difference' ? 'normal' : 'difference');
  };

  const handleHideAllToggle = () => {
    if (!hasLayers) return;
    onSetAllHidden(!state.allHidden);
  };

  return (
    <div
      ref={rootRef}
      className="pixel-overlay-panel-root"
      tabIndex={0}
      onPaste={handlePaste}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div
        className={state.panel.collapsed ? 'panel-header collapsed' : 'panel-header'}
        onPointerDown={handleHeaderPointerDown}
        onPointerMove={handleHeaderPointerMove}
        onPointerUp={handleHeaderPointerUp}
        onPointerCancel={handleHeaderPointerUp}
      >
        <span data-po="title" className="panel-title">
          Pixel Veil
        </span>
        <div className="panel-header-buttons">
          <button
            type="button"
            data-po="collapse"
            className="panel-header-btn"
            title={state.panel.collapsed ? 'Expand panel' : 'Collapse panel'}
            onClick={(e) => {
              e.stopPropagation();
              onSetCollapsed(!state.panel.collapsed);
            }}
          >
            {state.panel.collapsed ? '▾' : '▴'}
          </button>
          <button
            type="button"
            data-po="close"
            className="panel-header-btn"
            title="Close panel"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
          >
            ×
          </button>
        </div>
      </div>

      {!state.panel.collapsed && (
        <>
          <div className="panel-view-row">
            <div className="panel-view-row-top">
              <div className="panel-view-buttons">
                <button
                  type="button"
                  data-po="blend"
                  aria-pressed={state.blend === 'difference' ? 'true' : 'false'}
                  onClick={handleBlendToggle}
                >
                  Difference
                </button>
                <button
                  type="button"
                  data-po="hide-all"
                  disabled={!hasLayers}
                  aria-pressed={state.allHidden ? 'true' : 'false'}
                  onClick={handleHideAllToggle}
                >
                  Hide all
                </button>
              </div>
              <label className="keep-label">
                <input
                  type="checkbox"
                  data-po="keep"
                  disabled={!keepable}
                  checked={isKept}
                  onChange={handleKeepChange}
                />{' '}
                {keepable ? 'Keep on this site' : 'Keep on this site (not for local files)'}
              </label>
            </div>
            <div className="panel-compare-row">
              <select
                data-po="blend-mode"
                disabled={!hasLayers}
                value={state.blend}
                onChange={(e) => onSetBlend(e.target.value as Blend)}
              >
                <option value="normal">Normal</option>
                <option value="difference">Difference</option>
                <option value="multiply">Multiply</option>
                <option value="screen">Screen</option>
              </select>
              <button
                type="button"
                data-po="invert"
                disabled={!hasLayers}
                aria-pressed={state.invert ? 'true' : 'false'}
                onClick={() => onSetInvert(!state.invert)}
              >
                Invert
              </button>
            </div>
          </div>

          <AddImage
            error={error}
            onError={(err) => {
              setError(err);
              propOnError?.(err);
            }}
            onClearError={() => {
              setError('');
              propOnError?.('');
            }}
            onAddLayer={onAddLayer}
          />

          <LayerList
            layers={state.layers}
            activeLayerId={state.activeLayerId}
            images={images}
            onSelectLayer={onSelectLayer}
            onUpdateLayer={onUpdateLayer}
            onMoveLayer={onMoveLayer}
            onDeleteLayer={onDeleteLayer}
          />

          <LayerControls layer={activeLayer} onUpdateLayer={onUpdateLayer} />
        </>
      )}
    </div>
  );
}
