// Stub from Task 1. Task 4 replaces the click handler; Task 6 adds kept sites.
export default defineBackground(() => {
  browser.action.onClicked.addListener(async (tab) => {
    if (tab.id === undefined) return;
    try {
      await browser.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['/content-scripts/overlay.js'],
      });
      await browser.tabs.sendMessage(tab.id, { type: 'po/toggle' });
    } catch (e) {
      // Pages Chrome forbids (chrome://, the Web Store) land here. Nothing to do.
      console.warn('[pixel-overlay]', e);
    }
  });
});
