import { CONTENT_SCRIPT_REGISTRATION_ID, KEPT_KEY } from '../core/types';
import type { StorageAreaLike } from '../shared/storage';

export interface KeptDeps {
  area: StorageAreaLike;
  permissions: {
    contains(p: { origins: string[] }): Promise<boolean>;
    remove(p: { origins: string[] }): Promise<boolean>;
  };
  scripting: {
    getRegisteredContentScripts(f?: { ids: string[] }): Promise<{ id: string; matches?: string[] }[]>;
    registerContentScripts(s: object[]): Promise<void>;
    updateContentScripts(s: object[]): Promise<void>;
    unregisterContentScripts(f: { ids: string[] }): Promise<void>;
  };
}

export async function keptOrigins(d: KeptDeps): Promise<string[]> {
  const data = await d.area.get(KEPT_KEY);
  const raw = data[KEPT_KEY];
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter((item): item is string => typeof item === 'string');
}

const queues = new WeakMap<KeptDeps, Promise<void>>();

async function doSyncRegistration(d: KeptDeps): Promise<void> {
  const origins = await keptOrigins(d);
  const validMatches: string[] = [];
  for (const origin of origins) {
    const pattern = `${origin}/*`;
    try {
      const hasPerm = await d.permissions.contains({ origins: [pattern] });
      if (hasPerm) {
        validMatches.push(pattern);
      }
    } catch {
      // ignore check error
    }
  }

  const existingScripts = await d.scripting.getRegisteredContentScripts({
    ids: [CONTENT_SCRIPT_REGISTRATION_ID],
  });
  const existing = existingScripts.find((s) => s.id === CONTENT_SCRIPT_REGISTRATION_ID);

  if (validMatches.length === 0) {
    if (existing) {
      await d.scripting.unregisterContentScripts({ ids: [CONTENT_SCRIPT_REGISTRATION_ID] });
    }
    return;
  }

  if (existing) {
    const existingMatches = existing.matches ?? [];
    const isSame =
      existingMatches.length === validMatches.length &&
      [...existingMatches].sort().every((m, idx) => m === [...validMatches].sort()[idx]);

    if (isSame) {
      return;
    }

    await d.scripting.updateContentScripts([
      {
        id: CONTENT_SCRIPT_REGISTRATION_ID,
        matches: validMatches,
        js: ['content-scripts/overlay.js'],
        runAt: 'document_idle',
        persistAcrossSessions: true,
      },
    ]);
  } else {
    await d.scripting.registerContentScripts([
      {
        id: CONTENT_SCRIPT_REGISTRATION_ID,
        matches: validMatches,
        js: ['content-scripts/overlay.js'],
        runAt: 'document_idle',
        persistAcrossSessions: true,
      },
    ]);
  }
}

export async function syncRegistration(d: KeptDeps): Promise<void> {
  const prev = queues.get(d) ?? Promise.resolve();
  const next = prev.catch(() => {}).then(() => doSyncRegistration(d));
  queues.set(d, next);
  return next;
}

export async function keep(d: KeptDeps, origin: string): Promise<void> {
  const origins = await keptOrigins(d);
  if (!origins.includes(origin)) {
    origins.push(origin);
    await d.area.set({ [KEPT_KEY]: origins });
  }
  await syncRegistration(d);
}

export async function unkeep(d: KeptDeps, origin: string): Promise<void> {
  const origins = await keptOrigins(d);
  const next = origins.filter((o) => o !== origin);
  await d.area.set({ [KEPT_KEY]: next });
  try {
    await d.permissions.remove({ origins: [`${origin}/*`] });
  } catch {
    // ignore failure
  }
  await syncRegistration(d);
}
