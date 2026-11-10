import { applyCommand } from '../core/commands';
import { isMessage } from '../core/messages';
import { siteOf } from '../core/site';
import {
  addLayer,
  emptySiteState,
  moveLayer,
  nudge,
  removeLayer,
  selectLayer,
  setAllHidden,
  setBlend,
  setInvert,
  setPanel,
  setShown,
  updateLayer,
} from '../core/state';
import { appendImported } from '../core/transfer';
import type { SiteState } from '../core/types';
import { mountLayers } from '../overlay/layers';
import { mountPanel, type PanelView } from '../panel/mountPanel';
import { newId } from '../shared/ids';
import { chromeLocalArea, createSiteStore } from '../shared/store';

export default defineContentScript({
  matches: [],
  registration: 'runtime',
  main() {
    const win = window as unknown as {
      __pixelOverlay?: boolean;
      __pixelOverlayAlive?: () => boolean;
    };

    const isAlive = () => {
      try {
        return Boolean(browser.runtime?.id !== undefined);
      } catch {
        return false;
      }
    };

    if (win.__pixelOverlay) {
      let alive = false;
      try {
        alive = typeof win.__pixelOverlayAlive === 'function' && win.__pixelOverlayAlive() === true;
      } catch {
        alive = false;
      }

      if (alive) {
        return;
      }

      try {
        for (const el of Array.from(
          document.querySelectorAll('pixel-overlay-layers, pixel-overlay-panel'),
        )) {
          el.remove();
        }
      } catch (err) {
        console.warn('[pixel-overlay]', err);
      }
    }

    win.__pixelOverlay = true;
    win.__pixelOverlayAlive = isAlive;

    try {
      const site = siteOf(location.href) ?? location.origin;
      const area = chromeLocalArea();
      const store = createSiteStore(area, site);
      const images = new Map<string, string>();
      let currentState: SiteState = emptySiteState();
      let panelView: PanelView | null = null;
      let panelError = '';

      const saveState = async () => {
        try {
          await store.save(currentState);
          panelError = '';
        } catch (err) {
          console.warn('[pixel-overlay]', err);
          const msg = err instanceof Error ? err.message : String(err);
          panelError = `Could not save: ${msg}`;
          try {
            currentState = await store.load();
            await loadImagesForLayers(currentState.layers);
          } catch (loadErr) {
            console.warn('[pixel-overlay]', loadErr);
          }
          renderAll();
        }
      };

      const loadImagesForLayers = async (layers: SiteState['layers']): Promise<void> => {
        const currentImageIds = new Set(layers.map((l) => l.imageId));
        for (const imgId of Array.from(images.keys())) {
          if (!currentImageIds.has(imgId)) {
            images.delete(imgId);
          }
        }
        for (const layer of layers) {
          if (!images.has(layer.imageId)) {
            const dataUrl = await store.getImage(layer.imageId);
            if (dataUrl) {
              images.set(layer.imageId, dataUrl);
            }
          }
        }
      };

      const renderAll = () => {
        try {
          layersView.render(currentState, images);

          if (currentState.shown) {
            if (!panelView) {
              panelView = mountPanel({
                doc: document,
                area,
                async onAddLayer(newLayer, dataUrl) {
                  try {
                    await store.putImage(newLayer.imageId, dataUrl);
                    images.set(newLayer.imageId, dataUrl);
                    currentState = addLayer(currentState, newLayer);
                    renderAll();
                    await store.save(currentState);
                    panelError = '';
                  } catch (err) {
                    console.warn('[pixel-overlay]', err);
                    images.delete(newLayer.imageId);
                    try {
                      await store.removeImage(newLayer.imageId);
                    } catch (rmErr) {
                      console.warn('[pixel-overlay]', rmErr);
                    }
                    try {
                      currentState = await store.load();
                      await loadImagesForLayers(currentState.layers);
                    } catch (loadErr) {
                      console.warn('[pixel-overlay]', loadErr);
                    }
                    const msg = err instanceof Error ? err.message : String(err);
                    panelError = `Could not save: ${msg}`;
                    renderAll();
                    throw err;
                  }
                },
                async onImportLayers(imported) {
                  const appended = appendImported(currentState, imported, newId);
                  try {
                    for (const [id, dataUrl] of Object.entries(appended.images)) {
                      await store.putImage(id, dataUrl);
                      images.set(id, dataUrl);
                    }
                    currentState = appended.state;
                    renderAll();
                    await store.save(currentState);
                    panelError = '';
                  } catch (err) {
                    console.warn('[pixel-overlay]', err);
                    for (const id of Object.keys(appended.images)) {
                      images.delete(id);
                      try {
                        await store.removeImage(id);
                      } catch (rmErr) {
                        console.warn('[pixel-overlay]', rmErr);
                      }
                    }
                    try {
                      currentState = await store.load();
                      await loadImagesForLayers(currentState.layers);
                    } catch (loadErr) {
                      console.warn('[pixel-overlay]', loadErr);
                    }
                    const msg = err instanceof Error ? err.message : String(err);
                    panelError = `Could not save: ${msg}`;
                    renderAll();
                    throw err;
                  }
                },
                onSelectLayer(id) {
                  try {
                    currentState = selectLayer(currentState, id);
                    renderAll();
                    void saveState();
                  } catch (err) {
                    console.warn('[pixel-overlay]', err);
                  }
                },
                onUpdateLayer(id, patch) {
                  try {
                    currentState = updateLayer(currentState, id, patch);
                    renderAll();
                    void saveState();
                  } catch (err) {
                    console.warn('[pixel-overlay]', err);
                  }
                },
                onMoveLayer(id, dir) {
                  try {
                    currentState = moveLayer(currentState, id, dir);
                    renderAll();
                    void saveState();
                  } catch (err) {
                    console.warn('[pixel-overlay]', err);
                  }
                },
                onDeleteLayer(id) {
                  try {
                    const { state: nextState, removedImageId } = removeLayer(currentState, id);
                    currentState = nextState;
                    if (removedImageId) {
                      images.delete(removedImageId);
                      void store.removeImage(removedImageId).catch((err) => {
                        console.warn('[pixel-overlay]', err);
                      });
                    }
                    renderAll();
                    void saveState();
                  } catch (err) {
                    console.warn('[pixel-overlay]', err);
                  }
                },
                onSetBlend(blend) {
                  try {
                    currentState = setBlend(currentState, blend);
                    renderAll();
                    void saveState();
                  } catch (err) {
                    console.warn('[pixel-overlay]', err);
                  }
                },
                onSetInvert(invert) {
                  try {
                    currentState = setInvert(currentState, invert);
                    renderAll();
                    void saveState();
                  } catch (err) {
                    console.warn('[pixel-overlay]', err);
                  }
                },
                onSetAllHidden(hidden) {
                  try {
                    currentState = setAllHidden(currentState, hidden);
                    renderAll();
                    void saveState();
                  } catch (err) {
                    console.warn('[pixel-overlay]', err);
                  }
                },
                onSetCollapsed(collapsed) {
                  try {
                    currentState = setPanel(currentState, { collapsed });
                    renderAll();
                    void saveState();
                  } catch (err) {
                    console.warn('[pixel-overlay]', err);
                  }
                },
                onClose() {
                  try {
                    currentState = setShown(currentState, false);
                    renderAll();
                    void saveState();
                  } catch (err) {
                    console.warn('[pixel-overlay]', err);
                  }
                },
                onSavePanelPosition(x, y) {
                  try {
                    currentState = setPanel(currentState, { x, y });
                    renderAll();
                    void saveState();
                  } catch (err) {
                    console.warn('[pixel-overlay]', err);
                  }
                },
              });
            }
            panelView.render(currentState, images, panelError);
          } else {
            if (panelView) {
              panelView.destroy();
              panelView = null;
            }
          }
        } catch (err) {
          console.warn('[pixel-overlay]', err);
        }
      };

      const layersView = mountLayers({
        doc: document,
        onDragStart() {
          panelView?.blur();
        },
        onMove(id, x, y) {
          try {
            currentState = updateLayer(currentState, id, { x, y });
            renderAll();
            void saveState();
          } catch (err) {
            console.warn('[pixel-overlay]', err);
          }
        },
        onNudge(dx, dy) {
          try {
            currentState = nudge(currentState, dx, dy);
            renderAll();
            void saveState();
          } catch (err) {
            console.warn('[pixel-overlay]', err);
          }
        },
      });

      const initialLoadPromise = (async () => {
        try {
          currentState = await store.load();
          await loadImagesForLayers(currentState.layers);
          renderAll();
        } catch (err) {
          console.warn('[pixel-overlay]', err);
        }
      })();

      store.subscribe((s) => {
        try {
          currentState = s;
          void (async () => {
            try {
              await loadImagesForLayers(currentState.layers);
              renderAll();
            } catch (err) {
              console.warn('[pixel-overlay]', err);
            }
          })();
        } catch (err) {
          console.warn('[pixel-overlay]', err);
        }
      });

      browser.runtime.onMessage.addListener(
        (msg: unknown, _sender: unknown, sendResponse?: (r: unknown) => void) => {
          try {
            if (!isMessage(msg)) return;
            if (msg.type === 'po/ping') {
              sendResponse?.({ ok: true });
              return Promise.resolve({ ok: true });
            }
            return (async () => {
              try {
                await initialLoadPromise;
                if (msg.type === 'po/show') {
                  currentState = setShown(currentState, true);
                  renderAll();
                  await saveState();
                } else if (msg.type === 'po/toggle') {
                  currentState = setShown(currentState, !currentState.shown);
                  renderAll();
                  await saveState();
                } else if (msg.type === 'po/command') {
                  currentState = applyCommand(currentState, msg.name);
                  renderAll();
                  await saveState();
                }
              } catch (err) {
                console.warn('[pixel-overlay]', err);
              }
              sendResponse?.({ ok: true });
            })();
          } catch (err) {
            console.warn('[pixel-overlay]', err);
          }
        },
      );
    } catch (err) {
      console.warn('[pixel-overlay]', err);
    }
  },
});
