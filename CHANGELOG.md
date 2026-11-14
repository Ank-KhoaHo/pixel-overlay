# Changelog

Every release of Pixel Veil, newest first, in the words of whoever uses it.

A released block's heading is the version, then the date: `## 0.1.0 — 2026-01-31`. The newest
released version is also what the `VERSION` file holds, and the name of a git tag (`v` followed
by the version).

## Unreleased

- Nothing yet.

## 0.2.2 — 2026-11-13

- A page's own styles no longer stretch, fade, hide or move the panel and the layers.
- A layer pinned to the window stays where you put it on pages that scroll their body.
- Up and Down move a layer past the next shown layer, not past a hidden one.
- Every control works from the keyboard, and a screen reader reads its name.
- F2 renames a layer from the keyboard.

## 0.2.1 — 2026-11-12

- The panel and the layers are drawn in the browser's top layer, above the page's own popups.
- Fixes from a review of the whole 0.2.0 build.

## 0.2.0 — 2026-11-11

- Groups of layers, with a filter per site.
- Multiply and Screen modes, and an Invert switch.
- Center, Fit width and edge snapping.
- Keyboard shortcuts to hide all layers, change the active layer's opacity and turn on Difference.
- Local files (`file://`), once you allow file access for the extension.
- The controls can move into Chrome's side panel.
- A layer can be pinned to the window, for sticky headers and footers.
- Export a site's layers to one file, and import them anywhere.
- A Firefox build.
- The product is called Pixel Veil, with a new icon.

## 0.1.0 — 2026-11-10

- Lay any number of design images over a page; move, scale and fade each one.
- Difference view shows only the pixels that disagree.
- Add an image by file, by dropping it on the panel, or by pasting it.
- Keep on this site: the layers come back after a reload, once Chrome grants that one site.
