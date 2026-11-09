import { isMessage } from '../core/messages';
import { originOf } from '../core/site';
import { chromeLocalArea } from '../shared/store';
import { keep, syncRegistration, unkeep, type KeptDeps } from '../background/kept';

export async function clickTab(tabId: number): Promise<void> {
  try {
    let isLive = false;
    try {
      const reply = (await browser.tabs.sendMessage(tabId, { type: 'po/ping' })) as
        | { ok?: boolean }
        | undefined;
      if (reply && typeof reply === 'object' && reply.ok === true) {
        isLive = true;
      }
    } catch {
      isLive = false;
    }

    if (isLive) {
      await browser.tabs.sendMessage(tabId, { type: 'po/toggle' });
    } else {
      await browser.scripting.executeScript({
        target: { tabId },
        files: ['/content-scripts/overlay.js'],
      });
      await browser.tabs.sendMessage(tabId, { type: 'po/show' });
    }
  } catch (e) {
    // Pages Chrome forbids (chrome://, the Web Store) land here. Nothing to do.
    console.warn('[pixel-overlay]', e);
  }
}

if (import.meta.env.MODE === 'e2e' || import.meta.env.PO_E2E) {
  (self as unknown as { poClick: typeof clickTab }).poClick = clickTab;
}

function createKeptDeps(): KeptDeps {
  return {
    area: chromeLocalArea(),
    permissions: {
      contains: (p) => browser.permissions.contains(p),
      remove: (p) => browser.permissions.remove(p),
    },
    scripting: {
      getRegisteredContentScripts: (f) =>
        browser.scripting.getRegisteredContentScripts(
          f as Parameters<typeof browser.scripting.getRegisteredContentScripts>[0],
        ),
      registerContentScripts: (s) =>
        browser.scripting.registerContentScripts(
          s as Parameters<typeof browser.scripting.registerContentScripts>[0],
        ),
      updateContentScripts: (s) =>
        browser.scripting.updateContentScripts(
          s as Parameters<typeof browser.scripting.updateContentScripts>[0],
        ),
      unregisterContentScripts: (f) =>
        browser.scripting.unregisterContentScripts(
          f as Parameters<typeof browser.scripting.unregisterContentScripts>[0],
        ),
    },
  };
}

export default defineBackground(() => {
  if (import.meta.env.MODE === 'e2e' || import.meta.env.PO_E2E) {
    // poClick already set
  }

  const deps = createKeptDeps();

  void syncRegistration(deps).catch((err) => {
    console.warn('[pixel-overlay]', err);
  });

  browser.runtime.onStartup.addListener(() => {
    void syncRegistration(deps).catch((err) => {
      console.warn('[pixel-overlay]', err);
    });
  });

  browser.action.onClicked.addListener(async (tab) => {
    if (tab.id === undefined) return;
    await clickTab(tab.id);
  });

  browser.runtime.onMessage.addListener((msg: unknown) => {
    try {
      if (!isMessage(msg)) return;

      if (msg.type === 'po/keep') {
        const origin = originOf(msg.origin);
        if (!origin || origin !== msg.origin) return;

        if (msg.on) {
          void browser.windows.create({
            url:
              browser.runtime.getURL('/grant.html') +
              '?origin=' +
              encodeURIComponent(origin),
            type: 'popup',
            width: 420,
            height: 220,
          }).catch((err) => {
            console.warn('[pixel-overlay]', err);
          });
        } else {
          void unkeep(deps, origin).catch((err) => {
            console.warn('[pixel-overlay]', err);
          });
        }
        return;
      }

      if (msg.type === 'po/granted') {
        const origin = originOf(msg.origin);
        if (!origin || origin !== msg.origin) return;

        return (async () => {
          try {
            await keep(deps, origin);
            return { ok: true };
          } catch (err) {
            console.warn('[pixel-overlay]', err);
            return { ok: false };
          }
        })();
      }
    } catch (err) {
      console.warn('[pixel-overlay]', err);
    }
  });
});
