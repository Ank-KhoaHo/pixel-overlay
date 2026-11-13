# Pixel Veil

<img src="art/icon.svg" width="64" height="64" alt="">

Lay design images over a live page in Chrome and check it pixel by pixel. Unlimited layers, free.

The repository keeps its first working name, `pixel-overlay`.

## What this is

A Chrome extension for front-end developers who build pages from a design export. Export the
design as an image (a Figma frame as PNG, for example), open the page you built, click the
**Pixel Veil** icon and drop the image on the panel. The design sits over the page, and you
can see where the two disagree.

- **Any number of layers**, kept per site: desktop, tablet and mobile designs side by side.
- **See-through level**, from 0 to 100 %.
- **Position**: drag the layer, type X and Y, or nudge with the arrow keys (Shift for 10 px).
- **Scale**, with a one-click "½" for designs exported at 2x.
- **Lock** a layer so clicks pass through it to the page.
- **Difference view**: matching pixels turn black, so every mismatch stands out.
- **Keep on this site**: layers come back by themselves after a reload.

Your images and settings stay in your browser (`chrome.storage.local`). Pixel Veil sends
nothing anywhere and has no account.

## Use it

Pixel Veil is not on the Chrome Web Store yet. To run it from source:

```
npm ci
npm run build
```

Then open `chrome://extensions`, turn on **Developer mode**, choose **Load unpacked**, and pick
`.output/chrome-mv3`.

1. Open your page and click the **Pixel Veil** toolbar icon. A panel appears at the top right.
2. Click **Add image**, drop image files on the panel, or paste one with Ctrl+V.
3. Move the layer into place, then set its see-through level, or switch the view to
   **Difference**.
4. To have the layers return after a reload, switch on **Keep on this site** and allow it in
   the small window that opens. Chrome asks once per site.
5. Click the icon again to hide everything.
6. **Export** saves this site's layers and images to one `.json` file. **Import** adds the
   layers from such a file on top of the ones already there, on any site or computer.
7. **Side panel** (Chrome) moves the controls into Chrome's side panel, so they stop covering a
   narrow page. The page panel comes back when you close the side panel.
8. **Group** names a layer's group (say `login` or `home`). Once a group exists, the list above
   the layers shows one group at a time, on the page too, and remembers your choice per site.

Keyboard shortcuts (change them in `chrome://extensions/shortcuts`):

| Keys | Does |
|---|---|
| Alt+Shift+V | Show or hide Pixel Veil, like the icon |
| Alt+Shift+H | Hide or show all layers |
| Alt+Shift+. and Alt+Shift+, | Active layer 10 % more solid, or 10 % more see-through |
| (none set) | Turn Difference view on or off; pick your own keys |

## Permissions

At install Pixel Veil asks for no access to any site. A click on its icon lets it draw on
that one tab (Chrome's `activeTab`). **Keep on this site** asks Chrome for that one site only,
and switching it off gives the permission back.

## Limits

- Images: PNG, JPEG, WebP and GIF, up to 25 MB each. SVG is not accepted.
- Layers are kept per site (scheme, host and port), not per page: `/login` and `/home` on the
  same site share one list. Put them in groups to show one page's designs at a time.
- Local files (`file://`) work in Chrome after you turn on **Allow access to file URLs** in the
  extension's details; Pixel Veil opens a page that shows how. Layers are kept per folder there,
  and **Keep on this site** is off. Firefox does not allow it: serve the folder with a local web
  server instead.
- A layer pinned to the window is always drawn above the layers that scroll with the page,
  whatever their order in the list.
- Chrome does not let extensions draw on its own pages (`chrome://`, the Web Store).
- Built for Chrome and Chromium browsers. A Firefox build exists (`npm run build:firefox`,
  Firefox 140 or later) but is not on Firefox Add-ons yet.

## Where things live

| File | What it holds |
|---|---|
| [PUBLIC.md](PUBLIC.md) | why some material is deliberately not published here |
| [CONTRIBUTING.md](CONTRIBUTING.md) | how to build and test it, and what gets rejected |
| [SECURITY.md](SECURITY.md) | how to report a vulnerability, and what is not one |
| [ROADMAP.md](ROADMAP.md) | direction, and the things deliberately not coming |
| [LICENSE](LICENSE) | what you may do with this |
| [art/icon.svg](art/icon.svg) | the icon; `node scripts/make_icons.mjs` renders the PNGs in `public/icon/` |

## Status

Version 0.2.2, before its first Store release. Licensed under MIT; see [LICENSE](LICENSE).
