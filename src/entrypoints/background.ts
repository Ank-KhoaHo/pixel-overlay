export async function clickTab(tabId: number): Promise<void> {
  try {
    const results = await browser.scripting.executeScript({
      target: { tabId },
      func: () => Boolean((window as unknown as { __pixelOverlay?: boolean }).__pixelOverlay),
    });
    const isRunning = Boolean(results?.[0]?.result);

    if (isRunning) {
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

export default defineBackground(() => {
  if (import.meta.env.MODE === 'e2e' || import.meta.env.PO_E2E) {
    (self as unknown as { poClick: typeof clickTab }).poClick = clickTab;
  }

  browser.action.onClicked.addListener(async (tab) => {
    if (tab.id === undefined) return;
    await clickTab(tab.id);
  });
});
