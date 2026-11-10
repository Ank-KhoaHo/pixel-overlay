import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { browser } from 'wxt/browser';
import { SIDE_PORT, type PanelOp, type SideUpdate } from '../../core/remote';
import { EXPORT_FORMAT } from '../../core/transfer';
import type { SiteState } from '../../core/types';
import { Panel } from '../../panel/Panel';
import '../../panel/panel.css';
import { chromeLocalArea, createSiteStore } from '../../shared/store';

export function SidePanelApp() {
  const [site, setSite] = useState<string | null>(null);
  const [state, setState] = useState<SiteState | null>(null);
  const [images, setImages] = useState<Map<string, string>>(new Map());
  const [isEmpty, setIsEmpty] = useState<boolean>(false);

  const portRef = useRef<ReturnType<typeof browser.tabs.connect> | null>(null);
  const timerRef = useRef<number | null>(null);
  const receivedStateRef = useRef<boolean>(false);
  const imagesRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tabIdParam = urlParams.get('tabId');
    const isE2E = import.meta.env.MODE === 'e2e';
    const hasUrlTabId = isE2E && tabIdParam !== null && !isNaN(Number(tabIdParam));
    const urlTabId = hasUrlTabId ? Number(tabIdParam) : null;

    const cleanupPort = () => {
      if (portRef.current) {
        try {
          portRef.current.disconnect();
        } catch {}
        portRef.current = null;
      }
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const showEmpty = () => {
      cleanupPort();
      setIsEmpty(true);
      setState(null);
      setSite(null);
    };

    const connectToTab = (tabId: number) => {
      cleanupPort();
      receivedStateRef.current = false;
      setIsEmpty(false);

      timerRef.current = window.setTimeout(() => {
        if (!receivedStateRef.current) {
          showEmpty();
        }
      }, 1000);

      try {
        const port = browser.tabs.connect(tabId, { name: SIDE_PORT });
        portRef.current = port;

        port.onDisconnect.addListener(() => {
          showEmpty();
        });

        port.onMessage.addListener((msg: unknown) => {
          try {
            if (!msg || typeof msg !== 'object') return;
            const u = msg as SideUpdate;
            if (u.type === 'state' && typeof u.site === 'string' && u.state) {
              receivedStateRef.current = true;
              if (timerRef.current !== null) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
              }
              setIsEmpty(false);
              setSite(u.site);
              setState(u.state);

              const store = createSiteStore(chromeLocalArea(), u.site);

              void (async () => {
                try {
                  const currentLayers = u.state.layers;
                  const nextImages = new Map(imagesRef.current);
                  let changed = false;

                  const layerImageIds = new Set(currentLayers.map((l) => l.imageId));
                  for (const id of Array.from(nextImages.keys())) {
                    if (!layerImageIds.has(id)) {
                      nextImages.delete(id);
                      changed = true;
                    }
                  }

                  for (const l of currentLayers) {
                    if (!nextImages.has(l.imageId)) {
                      const dataUrl = await store.getImage(l.imageId);
                      if (dataUrl) {
                        nextImages.set(l.imageId, dataUrl);
                        changed = true;
                      }
                    }
                  }

                  if (changed) {
                    imagesRef.current = nextImages;
                    setImages(new Map(nextImages));
                  }
                } catch (err) {
                  console.warn('[pixel-overlay]', err);
                }
              })();
            }
          } catch (err) {
            console.warn('[pixel-overlay]', err);
          }
        });
      } catch (err) {
        console.warn('[pixel-overlay]', err);
        showEmpty();
      }
    };

    if (hasUrlTabId && urlTabId !== null) {
      connectToTab(urlTabId);
      return () => {
        cleanupPort();
      };
    }

    const connectToActiveTab = async () => {
      try {
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        const activeTabId = tabs[0]?.id;
        if (activeTabId !== undefined) {
          connectToTab(activeTabId);
        } else {
          showEmpty();
        }
      } catch (err) {
        console.warn('[pixel-overlay]', err);
        showEmpty();
      }
    };

    void connectToActiveTab();

    const handleActivated = () => {
      void connectToActiveTab();
    };

    const handleUpdated = async (
      _updatedTabId: number,
      changeInfo: { status?: string },
      tab?: { active?: boolean; windowId?: number },
    ) => {
      if (changeInfo.status === 'complete' && tab?.active) {
        try {
          const currentWindow = await browser.windows.getCurrent();
          if (tab.windowId === currentWindow.id) {
            void connectToActiveTab();
          }
        } catch (err) {
          console.warn('[pixel-overlay]', err);
        }
      }
    };

    browser.tabs.onActivated.addListener(handleActivated);
    browser.tabs.onUpdated.addListener(handleUpdated);

    return () => {
      browser.tabs.onActivated.removeListener(handleActivated);
      browser.tabs.onUpdated.removeListener(handleUpdated);
      cleanupPort();
    };
  }, []);

  if (isEmpty || !state || !site) {
    if (isEmpty) {
      return (
        <p data-po="side-empty">
          Click the Pixel Veil icon on this page, then open the side panel again.
        </p>
      );
    }
    return null;
  }

  return (
    <Panel
      mode="side"
      site={site}
      state={state}
      images={images}
      onAddLayer={async (newLayer, dataUrl) => {
        const next = new Map(imagesRef.current);
        next.set(newLayer.imageId, dataUrl);
        imagesRef.current = next;
        setImages(new Map(next));

        portRef.current?.postMessage({
          op: 'add',
          newLayer,
          dataUrl,
        } satisfies PanelOp);
      }}
      onImportLayers={async (imported) => {
        const next = new Map(imagesRef.current);
        for (const [id, dataUrl] of Object.entries(imported.images)) {
          next.set(id, dataUrl);
        }
        imagesRef.current = next;
        setImages(new Map(next));

        portRef.current?.postMessage({
          op: 'import',
          file: {
            format: EXPORT_FORMAT,
            version: 1,
            site,
            exportedAt: new Date().toISOString(),
            layers: imported.layers,
            images: imported.images,
          },
        } satisfies PanelOp);
      }}
      onSelectLayer={(id) => {
        portRef.current?.postMessage({
          op: 'select',
          id,
        } satisfies PanelOp);
      }}
      onUpdateLayer={(id, patch) => {
        portRef.current?.postMessage({
          op: 'update',
          id,
          patch,
        } satisfies PanelOp);
      }}
      onMoveLayer={(id, dir) => {
        portRef.current?.postMessage({
          op: 'move',
          id,
          dir,
        } satisfies PanelOp);
      }}
      onDeleteLayer={(id) => {
        portRef.current?.postMessage({
          op: 'delete',
          id,
        } satisfies PanelOp);
      }}
      onSetBlend={(blend) => {
        portRef.current?.postMessage({
          op: 'blend',
          blend,
        } satisfies PanelOp);
      }}
      onSetInvert={(invert) => {
        portRef.current?.postMessage({
          op: 'invert',
          on: invert,
        } satisfies PanelOp);
      }}
      onSetAllHidden={(hidden) => {
        portRef.current?.postMessage({
          op: 'hide-all',
          on: hidden,
        } satisfies PanelOp);
      }}
      onAlign={(id, how) => {
        portRef.current?.postMessage({
          op: 'align',
          id,
          how,
        } satisfies PanelOp);
      }}
      onClose={() => {}}
      onSetCollapsed={() => {}}
      onSavePanelPosition={() => {}}
    />
  );
}

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<SidePanelApp />);
}
