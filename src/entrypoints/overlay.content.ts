import { isMessage } from '../core/messages';
import {
  addLayer,
  emptySiteState,
  moveLayer,
  nudge,
  removeLayer,
  selectLayer,
  setAllVisible,
  setBlend,
  setPanel,
  setShown,
  updateLayer,
} from '../core/state';
import type { SiteState } from '../core/types';
import { mountLayers } from '../overlay/layers';
import { mountPanel, type PanelView } from '../panel/mountPanel';
import { chromeLocalArea, createSiteStore } from '../shared/store';

export default defineContentScript({
  matches: [],
  registration: 'runtime',
  main() {
    const win = window as unknown as { __pixelOverlay?: boolean };
    if (win.__pixelOverlay) {
      return;
    }
    win.__pixelOverlay = true;

    try {
      const origin = location.origin;
      const store = createSiteStore(chromeLocalArea(), origin);
      const images = new Map<string, string>();
      let currentState: SiteState = emptySiteState();
      let panelView: PanelView | null = null;

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
                async onAddLayer(newLayer, dataUrl) {
                  try {
                    await store.putImage(newLayer.imageId, dataUrl);
                    images.set(newLayer.imageId, dataUrl);
                    currentState = addLayer(currentState, newLayer);
                    renderAll();
                    await store.save(currentState);
                  } catch (err) {
                    console.warn('[pixel-overlay]', err);
                    throw err;
                  }
                },
                onSelectLayer(id) {
                  try {
                    currentState = selectLayer(currentState, id);
                    renderAll();
                    void store.save(currentState).catch((err) => {
                      console.warn('[pixel-overlay]', err);
                    });
                  } catch (err) {
                    console.warn('[pixel-overlay]', err);
                  }
                },
                onUpdateLayer(id, patch) {
                  try {
                    currentState = updateLayer(currentState, id, patch);
                    renderAll();
                    void store.save(currentState).catch((err) => {
                      console.warn('[pixel-overlay]', err);
                    });
                  } catch (err) {
                    console.warn('[pixel-overlay]', err);
                  }
                },
                onMoveLayer(id, dir) {
                  try {
                    currentState = moveLayer(currentState, id, dir);
                    renderAll();
                    void store.save(currentState).catch((err) => {
                      console.warn('[pixel-overlay]', err);
                    });
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
                    void store.save(currentState).catch((err) => {
                      console.warn('[pixel-overlay]', err);
                    });
                  } catch (err) {
                    console.warn('[pixel-overlay]', err);
                  }
                },
                onSetBlend(blend) {
                  try {
                    currentState = setBlend(currentState, blend);
                    renderAll();
                    void store.save(currentState).catch((err) => {
                      console.warn('[pixel-overlay]', err);
                    });
                  } catch (err) {
                    console.warn('[pixel-overlay]', err);
                  }
                },
                onSetAllVisible(visible) {
                  try {
                    currentState = setAllVisible(currentState, visible);
                    renderAll();
                    void store.save(currentState).catch((err) => {
                      console.warn('[pixel-overlay]', err);
                    });
                  } catch (err) {
                    console.warn('[pixel-overlay]', err);
                  }
                },
                onSetCollapsed(collapsed) {
                  try {
                    currentState = setPanel(currentState, { collapsed });
                    renderAll();
                    void store.save(currentState).catch((err) => {
                      console.warn('[pixel-overlay]', err);
                    });
                  } catch (err) {
                    console.warn('[pixel-overlay]', err);
                  }
                },
                onClose() {
                  try {
                    currentState = setShown(currentState, false);
                    renderAll();
                    void store.save(currentState).catch((err) => {
                      console.warn('[pixel-overlay]', err);
                    });
                  } catch (err) {
                    console.warn('[pixel-overlay]', err);
                  }
                },
                onSavePanelPosition(x, y) {
                  try {
                    currentState = setPanel(currentState, { x, y });
                    renderAll();
                    void store.save(currentState).catch((err) => {
                      console.warn('[pixel-overlay]', err);
                    });
                  } catch (err) {
                    console.warn('[pixel-overlay]', err);
                  }
                },
              });
            }
            panelView.render(currentState, images);
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
        onMove(id, x, y) {
          try {
            currentState = updateLayer(currentState, id, { x, y });
            renderAll();
            void store.save(currentState).catch((err) => {
              console.warn('[pixel-overlay]', err);
            });
          } catch (err) {
            console.warn('[pixel-overlay]', err);
          }
        },
        onNudge(dx, dy) {
          try {
            currentState = nudge(currentState, dx, dy);
            renderAll();
            void store.save(currentState).catch((err) => {
              console.warn('[pixel-overlay]', err);
            });
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

      browser.runtime.onMessage.addListener((msg: unknown) => {
        try {
          if (!isMessage(msg)) return;
          void (async () => {
            try {
              await initialLoadPromise;
              if (msg.type === 'po/show') {
                currentState = setShown(currentState, true);
                renderAll();
                await store.save(currentState);
              } else if (msg.type === 'po/toggle') {
                currentState = setShown(currentState, !currentState.shown);
                renderAll();
                await store.save(currentState);
              }
            } catch (err) {
              console.warn('[pixel-overlay]', err);
            }
          })();
        } catch (err) {
          console.warn('[pixel-overlay]', err);
        }
      });
    } catch (err) {
      console.warn('[pixel-overlay]', err);
    }
  },
});
