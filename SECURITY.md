# Security policy

## Reporting a vulnerability

**Report privately, to hello@wanksolution.com.** Please do not open a public issue for a suspected
vulnerability: that tells everyone at once, before there is a fix.

Include the extension version (`chrome://extensions`), the Chrome version, the shortest steps that
reproduce it, and what you expected instead.

### What to expect

One person maintains this project and reads every report personally. You get a reply once the
report is read, and a fix in the next release once it is confirmed. No fixed response time is
promised, because one that cannot be kept is worse than none.

## Supported versions

Only the latest version is supported: the one on the Chrome Web Store, or `main` until the first
store release. There are no maintenance branches, so a fix ships in the next release.

## What the extension promises

These are the promises a report can break:

1. **No site access at install.** It reads a page only after you click its icon there, or after
   you turn on "Keep on this site" and Chrome asks you to allow that one site.
2. **Your designs stay in your browser.** Images and layer settings live in the extension's own
   storage (`chrome.storage.local`). The extension makes no network requests.
3. **The page cannot read your designs.** Layers and the panel live in closed shadow roots, so the
   page's own scripts cannot read the image data.

## Scope

### In scope

- Anything that breaks one of the three promises above.
- A web page that can make the extension act: change layers, register a site, or open the grant
  window, without the user's click.
- Access to a site the user did not allow, or access that stays after the user turns
  "Keep on this site" off.

### Not findings

These are known limits, not bugs. A report is welcome only if it shows the real behaviour is
worse than what is written here or in the [README](README.md#limits).

- **A page can tell the extension is there.** The two host elements
  (`<pixel-overlay-layers>` and `<pixel-overlay-panel>`) are in the page's DOM, with their size and
  position. The page can also remove or hide them; it owns its DOM.
- **An unlocked layer covers the page's clicks.** That is how dragging works; lock the layer to
  click through.
- **The test build** (`npm run build:e2e`) opens its shadow roots and has localhost access, on
  purpose, for Playwright. It is never uploaded to a store.
- **Anyone who controls your computer or Chrome profile** can read the stored images.
- A scanner report with no demonstrated, working impact.

### Out of scope

A vulnerability in a dependency (WXT, React and others), rather than in this project's code.
Report that to the dependency's maintainers.
