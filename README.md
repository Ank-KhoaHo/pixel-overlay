# pixel-overlay

Lay design images over a live page in Chrome and check it pixel by pixel. Unlimited layers, free.

## What this is

A Chrome extension for front-end developers who build pages from a design export. Export the
design as an image (a Figma frame as PNG, for example), open the page you built, click the
**Pixel Overlay** icon and drop the image on the panel. The design sits over the page, and you
can see where the two disagree.

- **Any number of layers**, kept per site: desktop, tablet and mobile designs side by side.
- **See-through level**, from 0 to 100 %.
- **Position**: drag the layer, type X and Y, or nudge with the arrow keys (Shift for 10 px).
- **Scale**, with a one-click "½" for designs exported at 2x.
- **Lock** a layer so clicks pass through it to the page.
- **Difference view**: matching pixels turn black, so every mismatch stands out.
- **Keep on this site**: layers come back by themselves after a reload.

Your images and settings stay in your browser (`chrome.storage.local`). Pixel Overlay sends
nothing anywhere and has no account.

## Use it

Pixel Overlay is not on the Chrome Web Store yet. To run it from source:

```
npm ci
npm run build
```

Then open `chrome://extensions`, turn on **Developer mode**, choose **Load unpacked**, and pick
`.output/chrome-mv3`.

1. Open your page and click the **Pixel Overlay** toolbar icon. A panel appears at the top right.
2. Click **Add image**, drop image files on the panel, or paste one with Ctrl+V.
3. Move the layer into place, then set its see-through level, or switch the view to
   **Difference**.
4. To have the layers return after a reload, switch on **Keep on this site** and allow it in
   the small window that opens. Chrome asks once per site.
5. Click the icon again to hide everything.

## Permissions

At install Pixel Overlay asks for no access to any site. A click on its icon lets it draw on
that one tab (Chrome's `activeTab`). **Keep on this site** asks Chrome for that one site only,
and switching it off gives the permission back.

## Limits

- Images: PNG, JPEG, WebP and GIF, up to 25 MB each. SVG is not accepted.
- Layers are kept per site (scheme, host and port), not per page: `/login` and `/home` on the
  same site share one list. Hide the layers you are not using.
- Chrome does not let extensions draw on its own pages (`chrome://`, the Web Store).
- On the rare page that sets a CSS `transform` on `<html>`, the panel scrolls with the page.
- Only Chrome (and Chromium browsers) for now.

## Where things live

| File | What it holds |
|---|---|
| [PUBLIC.md](PUBLIC.md) | why some material is deliberately not published here |
| [CONTRIBUTING.md](CONTRIBUTING.md) | how to build and test it, and what gets rejected |
| [SECURITY.md](SECURITY.md) | how to report a vulnerability, and what is not one |
| [ROADMAP.md](ROADMAP.md) | direction, and the things deliberately not coming |
| [LICENSE](LICENSE) | what you may do with this |

## Status

Version 0.1.0, before its first Store release. Licensed under MIT; see [LICENSE](LICENSE).
