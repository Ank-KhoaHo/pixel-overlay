import { isMessage } from '../core/messages';
import { emptySiteState, nudge, setShown, updateLayer } from '../core/state';
import type { SiteState } from '../core/types';
import { mountLayers } from '../overlay/layers';
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

      const view = mountLayers({
        doc: document,
        onMove(id, x, y) {
          try {
            currentState = updateLayer(currentState, id, { x, y });
            view.render(currentState, images);
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
            view.render(currentState, images);
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
          view.render(currentState, images);
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
              view.render(currentState, images);
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
                view.render(currentState, images);
                await store.save(currentState);
              } else if (msg.type === 'po/toggle') {
                currentState = setShown(currentState, !currentState.shown);
                view.render(currentState, images);
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
