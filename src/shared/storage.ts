export interface StorageAreaLike {
  get(keys: string | string[]): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
  onChanged: {
    addListener(cb: (changes: Record<string, { newValue?: unknown }>) => void): void;
    removeListener(cb: (changes: Record<string, { newValue?: unknown }>) => void): void;
  };
}

export function createMemoryArea(): StorageAreaLike {
  const store = new Map<string, unknown>();
  const listeners = new Set<(changes: Record<string, { newValue?: unknown }>) => void>();

  return {
    async get(keys: string | string[]): Promise<Record<string, unknown>> {
      const keyList = typeof keys === 'string' ? [keys] : keys;
      const result: Record<string, unknown> = {};
      for (const key of keyList) {
        if (store.has(key)) {
          const val = store.get(key);
          result[key] = val !== undefined ? structuredClone(val) : undefined;
        }
      }
      return result;
    },

    async set(items: Record<string, unknown>): Promise<void> {
      const changes: Record<string, { newValue?: unknown }> = {};
      const entries = Object.entries(items);
      for (const [key, val] of entries) {
        const cloned = val !== undefined ? structuredClone(val) : undefined;
        store.set(key, cloned);
        changes[key] = { newValue: cloned !== undefined ? structuredClone(cloned) : undefined };
      }
      if (entries.length > 0) {
        for (const listener of [...listeners]) {
          listener(changes);
        }
      }
    },

    async remove(keys: string | string[]): Promise<void> {
      const keyList = typeof keys === 'string' ? [keys] : keys;
      const changes: Record<string, { newValue?: unknown }> = {};
      for (const key of keyList) {
        store.delete(key);
        changes[key] = { newValue: undefined };
      }
      if (keyList.length > 0) {
        for (const listener of [...listeners]) {
          listener(changes);
        }
      }
    },

    onChanged: {
      addListener(cb: (changes: Record<string, { newValue?: unknown }>) => void): void {
        listeners.add(cb);
      },
      removeListener(cb: (changes: Record<string, { newValue?: unknown }>) => void): void {
        listeners.delete(cb);
      },
    },
  };
}
