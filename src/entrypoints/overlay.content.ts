import { centerX, fitWidth } from '../core/align';
import { applyCommand } from '../core/commands';
import { isMessage } from '../core/messages';
import { isPanelOp, SIDE_PORT, type SideUpdate } from '../core/remote';
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
  setFilter,
  setInvert,
  setPanel,
  setShown,
  updateLayer,
} from '../core/state';
import { appendImported, parseImport } from '../core/transfer';
import type { Blend, Layer, LayerPatch, NewLayer, SiteState } from '../core/types';
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

      const connectedPorts = new Set<
        Parameters<Parameters<typeof browser.runtime.onConnect.addListener>[0]>[0]
      >();

      const handleAddLayer = async (newLayer: NewLayer, dataUrl: string) => {
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
      };

      const handleImportLayers = async (imported: {
        layers: Layer[];
        images: Record<string, string>;
      }) => {
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
      };

      const handleSelectLayer = (id: string) => {
        try {
          currentState = selectLayer(currentState, id);
          renderAll();
          void saveState();
        } catch (err) {
          console.warn('[pixel-overlay]', err);
        }
      };

      const handleUpdateLayer = (id: string, patch: LayerPatch) => {
        try {
          currentState = updateLayer(currentState, id, patch);
          renderAll();
          void saveState();
        } catch (err) {
          console.warn('[pixel-overlay]', err);
        }
      };

      const handleMoveLayer = (id: string, dir: 'up' | 'down') => {
        try {
          currentState = moveLayer(currentState, id, dir);
          renderAll();
          void saveState();
        } catch (err) {
          console.warn('[pixel-overlay]', err);
        }
      };

      const handleDeleteLayer = (id: string) => {
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
      };

      const handleSetBlend = (blend: Blend) => {
        try {
          currentState = setBlend(currentState, blend);
          renderAll();
          void saveState();
        } catch (err) {
          console.warn('[pixel-overlay]', err);
        }
      };

      const handleSetInvert = (invert: boolean) => {
        try {
          currentState = setInvert(currentState, invert);
          renderAll();
          void saveState();
        } catch (err) {
          console.warn('[pixel-overlay]', err);
        }
      };

      const handleSetAllHidden = (hidden: boolean) => {
        try {
          currentState = setAllHidden(currentState, hidden);
          renderAll();
          void saveState();
        } catch (err) {
          console.warn('[pixel-overlay]', err);
        }
      };

      const handleSetCollapsed = (collapsed: boolean) => {
        try {
          currentState = setPanel(currentState, { collapsed });
          renderAll();
          void saveState();
        } catch (err) {
          console.warn('[pixel-overlay]', err);
        }
      };

      const handleClose = () => {
        try {
          currentState = setShown(currentState, false);
          renderAll();
          void saveState();
        } catch (err) {
          console.warn('[pixel-overlay]', err);
        }
      };

      const handleSavePanelPosition = (x: number, y: number) => {
        try {
          currentState = setPanel(currentState, { x, y });
          renderAll();
          void saveState();
        } catch (err) {
          console.warn('[pixel-overlay]', err);
        }
      };

      const handleAlign = (id: string, how: 'center' | 'fit-width') => {
        try {
          const layer = currentState.layers.find((l) => l.id === id);
          if (!layer) return;
          const cw = document.documentElement.clientWidth;
          if (how === 'center') {
            currentState = updateLayer(currentState, id, { x: centerX(layer, cw) });
          } else if (how === 'fit-width') {
            const { scale, x } = fitWidth(layer, cw);
            currentState = updateLayer(currentState, id, { scale, x });
          }
          renderAll();
          void saveState();
        } catch (err) {
          console.warn('[pixel-overlay]', err);
        }
      };

      const handleSetFilter = (filter: string) => {
        try {
          currentState = setFilter(currentState, filter);
          renderAll();
          void saveState();
        } catch (err) {
          console.warn('[pixel-overlay]', err);
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
                onAddLayer: handleAddLayer,
                onImportLayers: handleImportLayers,
                onSelectLayer: handleSelectLayer,
                onUpdateLayer: handleUpdateLayer,
                onMoveLayer: handleMoveLayer,
                onDeleteLayer: handleDeleteLayer,
                onSetBlend: handleSetBlend,
                onSetInvert: handleSetInvert,
                onSetAllHidden: handleSetAllHidden,
                onSetCollapsed: handleSetCollapsed,
                onClose: handleClose,
                onSavePanelPosition: handleSavePanelPosition,
                onAlign: handleAlign,
                onSetFilter: handleSetFilter,
              });
            }
            panelView.render(currentState, images, panelError);
            if (connectedPorts.size > 0) {
              panelView.setHidden(true);
            }
          } else {
            if (panelView) {
              panelView.destroy();
              panelView = null;
            }
          }

          const update: SideUpdate = {
            type: 'state',
            site,
            state: currentState,
          };
          for (const port of connectedPorts) {
            try {
              port.postMessage(update);
            } catch (err) {
              console.warn('[pixel-overlay]', err);
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

      browser.runtime.onConnect.addListener((port) => {
        try {
          if (port.name !== SIDE_PORT) return;

          connectedPorts.add(port);
          if (panelView) {
            panelView.setHidden(true);
          }

          try {
            port.postMessage({
              type: 'state',
              site,
              state: currentState,
            } satisfies SideUpdate);
          } catch (err) {
            console.warn('[pixel-overlay]', err);
          }

          port.onDisconnect.addListener(() => {
            connectedPorts.delete(port);
            if (connectedPorts.size === 0 && currentState.shown && panelView) {
              panelView.setHidden(false);
            }
          });

          port.onMessage.addListener((msg: unknown) => {
            try {
              if (!isPanelOp(msg)) return;
              switch (msg.op) {
                case 'add':
                  void handleAddLayer(msg.newLayer, msg.dataUrl).catch((err) => {
                    console.warn('[pixel-overlay]', err);
                  });
                  break;
                case 'select':
                  handleSelectLayer(msg.id);
                  break;
                case 'update':
                  handleUpdateLayer(msg.id, msg.patch);
                  break;
                case 'move':
                  handleMoveLayer(msg.id, msg.dir);
                  break;
                case 'delete':
                  handleDeleteLayer(msg.id);
                  break;
                case 'blend':
                  handleSetBlend(msg.blend);
                  break;
                case 'invert':
                  handleSetInvert(msg.on);
                  break;
                case 'hide-all':
                  handleSetAllHidden(msg.on);
                  break;
                case 'filter':
                  handleSetFilter(msg.filter);
                  break;
                case 'align':
                  handleAlign(msg.id, msg.how);
                  break;
                case 'import': {
                  const res = parseImport(msg.file);
                  if (!('error' in res)) {
                    void handleImportLayers(res).catch((err) => {
                      console.warn('[pixel-overlay]', err);
                    });
                  }
                  break;
                }
              }
            } catch (err) {
              console.warn('[pixel-overlay]', err);
            }
          });
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
