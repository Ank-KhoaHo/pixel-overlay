import { COMMANDS, type CommandName } from '../core/commands';
import { isMessage } from '../core/messages';
import { needsFileAccessHelp, originOf } from '../core/site';
import { chromeLocalArea } from '../shared/store';
import { keep, reconcileKept, syncRegistration, unkeep, type KeptDeps } from '../background/kept';

export async function clickTab(tabId: number, url?: string): Promise<void> {
  try {
    let resolvedUrl = url;
    if (!resolvedUrl) {
      try {
        const tab = await browser.tabs.get(tabId);
        resolvedUrl = tab.url;
      } catch {
        // ignore
      }
    }

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
      let fileAccessAllowed = false;
      try {
        fileAccessAllowed = await browser.extension.isAllowedFileSchemeAccess();
      } catch {
        fileAccessAllowed = false;
      }
      if (needsFileAccessHelp(resolvedUrl, fileAccessAllowed)) {
        await browser.tabs.create({
          url: browser.runtime.getURL('/local-files.html'),
        });
        return;
      }

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

export async function runCommand(name: string, tabId?: number): Promise<void> {
  try {
    if (!(COMMANDS as readonly string[]).includes(name)) {
      return;
    }
    let targetTabId = tabId;
    if (targetTabId === undefined) {
      try {
        const tabs = await browser.tabs.query({ active: true, currentWindow: true });
        targetTabId = tabs[0]?.id;
        if (targetTabId === undefined) {
          const lastFocusedTabs = await browser.tabs.query({
            active: true,
            lastFocusedWindow: true,
          });
          targetTabId = lastFocusedTabs[0]?.id;
        }
      } catch {
        return;
      }
    }
    if (targetTabId === undefined) {
      return;
    }

    let isLive = false;
    try {
      const reply = (await browser.tabs.sendMessage(targetTabId, { type: 'po/ping' })) as
        | { ok?: boolean }
        | undefined;
      if (reply && typeof reply === 'object' && reply.ok === true) {
        isLive = true;
      }
    } catch {
      isLive = false;
    }

    if (!isLive) {
      return;
    }

    await browser.tabs.sendMessage(targetTabId, {
      type: 'po/command',
      name: name as CommandName,
    });
  } catch (e) {
    console.warn('[pixel-overlay]', e);
  }
}

if (import.meta.env.MODE === 'e2e' || import.meta.env.PO_E2E) {
  (self as unknown as { poClick: typeof clickTab }).poClick = clickTab;
  (self as unknown as { poCommand: typeof runCommand }).poCommand = runCommand;
  (self as unknown as { poSidePanelLog: string[] }).poSidePanelLog = [];
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

  browser.permissions.onRemoved.addListener(() => {
    void reconcileKept(deps).catch((err) => {
      console.warn('[pixel-overlay]', err);
    });
  });

  browser.permissions.onAdded.addListener(() => {
    void syncRegistration(deps).catch((err) => {
      console.warn('[pixel-overlay]', err);
    });
  });

  browser.action.onClicked.addListener(async (tab) => {
    if (tab.id === undefined) return;
    await clickTab(tab.id, tab.url);
  });

  browser.commands.onCommand.addListener((name, tab) => {
    void runCommand(name, tab?.id).catch((err) => {
      console.warn('[pixel-overlay]', err);
    });
  });

  browser.runtime.onMessage.addListener((msg: unknown, sender) => {
    try {
      if (!isMessage(msg)) return;

      if (msg.type === 'po/host-css') {
        try {
          if (sender.tab?.id !== undefined) {
            const css =
              'pixel-overlay-layers::backdrop, pixel-overlay-fixed::backdrop, pixel-overlay-panel::backdrop { display: none !important; }';
            void browser.scripting
              .insertCSS({
                target: { tabId: sender.tab.id, frameIds: [sender.frameId ?? 0] },
                origin: 'USER',
                css,
              })
              .catch((err) => {
                console.warn('[pixel-overlay]', err);
              });
          }
        } catch (err) {
          console.warn('[pixel-overlay]', err);
        }
        return;
      }

      if (msg.type === 'po/side-panel') {
        const tabId = sender.tab?.id;
        if (tabId !== undefined) {
          try {
            const openPromise = browser.sidePanel?.open({ tabId });
            const log = (self as unknown as { poSidePanelLog?: string[] }).poSidePanelLog;
            if (log && openPromise) {
              openPromise
                .then(() => {
                  log.push('ok');
                })
                .catch((err: unknown) => {
                  log.push(err instanceof Error ? err.message : String(err));
                });
            }
          } catch (err: unknown) {
            const log = (self as unknown as { poSidePanelLog?: string[] }).poSidePanelLog;
            log?.push(err instanceof Error ? err.message : String(err));
            console.warn('[pixel-overlay]', err);
          }
        }
        return;
      }

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
