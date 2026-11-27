# Limits and questions

What Pixel Veil does not do, what has really been tried, and the answers to what people ask.

## Limits

- Images: PNG, JPEG, WebP and GIF, up to 25 MB each. SVG is not accepted.
- Scale: from 0.1 to 4 times an image's own size.
- Layers are kept per site (scheme, host and port), not per page. Use [groups](organise.md#groups) to show one page's designs.
- On local files, layers are kept per folder, and **Keep on this site** is off.
- A layer pinned to the window is always drawn above the layers that scroll with the page.
- Chrome lets no extension draw on its own pages, such as `chrome://` pages and the Chrome Web Store.

## What has really been tried

| Where | How |
|---|---|
| Chromium on Windows | 117 end-to-end tests drive the built extension |
| Chromium on Linux | The same tests, on every push, in CI |
| Edge | Not tried; it is the same build |
| Firefox 140+ | Built, and passes Mozilla's own linter; not run in Firefox yet |

**Speed:** ten designs of 4000×8000 pixels took 1.8 seconds to show, and added no time per frame while dragging or scrolling.

## When something does not work

**The icon does nothing on this page.**  
It is one of Chrome's own pages, such as `chrome://extensions` or the Web Store. No extension can draw there.

**The layers are gone after a reload.**  
They are still kept: click the icon. To have them come back by themselves, tick [Keep on this site](organise.md#keep-on-this-site).

**A page opened from disk shows a help page instead.**  
Turn on **Allow access to file URLs** for Pixel Veil: see [Local files](organise.md#local-files).

**I cannot drag the layer, or the arrow keys scroll the page.**  
Make the layer active by clicking its name, and check that it is not locked.

**Clicks go to the layer instead of the page.**  
Lock the layer: a locked layer lets clicks through.

## Questions

**Is it really free?**  
Yes. Every layer, no account, and no paid plan waiting behind a button.

**Does it work on localhost?**  
Yes, like any other site. That is where most of the checking happens.

**Will it slow my page down?**  
Ten large designs added no time per frame: see Speed, above.

**Can it fail a test when a page changes?**  
No. For that, use a screenshot test, such as Playwright's `toHaveScreenshot`. Pixel Veil is for a person comparing a page with its design.

Something else? [Open an issue](https://github.com/Ank-KhoaHo/pixel-overlay/issues).
