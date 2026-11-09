import { browser } from 'wxt/browser';
import { imageKey, siteKey } from '../core/site';
import { emptySiteState, parseSiteState } from '../core/state';
import type { SiteState } from '../core/types';
import type { StorageAreaLike } from './storage';

export interface SiteStore {
  load(): Promise<SiteState>;
  save(s: SiteState): Promise<void>;
  putImage(id: string, dataUrl: string): Promise<void>;
  getImage(id: string): Promise<string | null>;
  removeImage(id: string): Promise<void>;
  subscribe(cb: (s: SiteState) => void): () => void;
}

export function createSiteStore(area: StorageAreaLike, origin: string): SiteStore {
  const siteStorageKey = siteKey(origin);
  let warned = false;

  const warnMalformedOnce = (raw: unknown) => {
    if (!warned) {
      warned = true;
      console.warn(`[pixel-overlay] Malformed stored state for origin ${origin}:`, raw);
    }
  };

  return {
    async load(): Promise<SiteState> {
      try {
        const data = await area.get(siteStorageKey);
        const raw = data[siteStorageKey];
        if (raw === undefined) {
          return emptySiteState();
        }
        const parsed = parseSiteState(raw);
        if (parsed === null) {
          warnMalformedOnce(raw);
          return emptySiteState();
        }
        return parsed;
      } catch (err) {
        console.warn(`[pixel-overlay] Failed to load state for ${origin}:`, err);
        return emptySiteState();
      }
    },

    async save(s: SiteState): Promise<void> {
      await area.set({ [siteStorageKey]: s });
    },

    async putImage(id: string, dataUrl: string): Promise<void> {
      await area.set({ [imageKey(id)]: dataUrl });
    },

    async getImage(id: string): Promise<string | null> {
      const key = imageKey(id);
      const res = await area.get(key);
      const val = res[key];
      if (typeof val === 'string') {
        return val;
      }
      return null;
    },

    async removeImage(id: string): Promise<void> {
      await area.remove(imageKey(id));
    },

    subscribe(cb: (s: SiteState) => void): () => void {
      const listener = (changes: Record<string, { newValue?: unknown }>) => {
        if (!Object.prototype.hasOwnProperty.call(changes, siteStorageKey)) {
          return;
        }
        const change = changes[siteStorageKey];
        if (!change) {
          return;
        }
        const raw = change.newValue;
        if (raw === undefined || raw === null) {
          cb(emptySiteState());
          return;
        }
        const parsed = parseSiteState(raw);
        if (parsed === null) {
          warnMalformedOnce(raw);
          cb(emptySiteState());
          return;
        }
        cb(parsed);
      };

      area.onChanged.addListener(listener);
      return () => {
        area.onChanged.removeListener(listener);
      };
    },
  };
}

export function chromeLocalArea(): StorageAreaLike {
  const listenerMap = new Map<
    (changes: Record<string, { newValue?: unknown }>) => void,
    (changes: Record<string, { newValue?: unknown }>, areaName: string) => void
  >();

  return {
    async get(keys: string | string[]): Promise<Record<string, unknown>> {
      return (await browser.storage.local.get(keys)) as Record<string, unknown>;
    },

    async set(items: Record<string, unknown>): Promise<void> {
      await browser.storage.local.set(items);
    },

    async remove(keys: string | string[]): Promise<void> {
      await browser.storage.local.remove(keys);
    },

    onChanged: {
      addListener(cb: (changes: Record<string, { newValue?: unknown }>) => void): void {
        if (listenerMap.has(cb)) return;
        const wrapper = (
          changes: Record<string, { newValue?: unknown }>,
          areaName: string,
        ) => {
          if (areaName === 'local') {
            cb(changes);
          }
        };
        listenerMap.set(cb, wrapper);
        browser.storage.onChanged.addListener(wrapper);
      },

      removeListener(cb: (changes: Record<string, { newValue?: unknown }>) => void): void {
        const wrapper = listenerMap.get(cb);
        if (wrapper) {
          listenerMap.delete(cb);
          browser.storage.onChanged.removeListener(wrapper);
        }
      },
    },
  };
}
