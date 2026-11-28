![Pixel Veil: lay your design over the page you built.](art/banner.png)

# Pixel Veil

<a href="https://github.com/Ank-KhoaHo/pixel-overlay/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/Ank-KhoaHo/pixel-overlay/ci.yml?branch=main&style=flat-square&label=ci" alt="CI"></a>
<img src="https://img.shields.io/github/package-json/v/Ank-KhoaHo/pixel-overlay?style=flat-square&color=0d1117&label=version" alt="Version">
<img src="https://img.shields.io/badge/chrome-MV3-0d1117?style=flat-square" alt="Chrome Manifest V3">
<img src="https://img.shields.io/badge/site%20access%20at%20install-none-0d1117?style=flat-square" alt="Site access at install: none">
<img src="https://img.shields.io/badge/license-MIT-0d1117?style=flat-square" alt="MIT license">

*Lay your design over the page you built. Every pixel that disagrees shows.*

## What it is

A free, open-source Chrome extension for front-end developers. It lays a design export (a Figma frame as a
PNG, a screenshot, any image) over the live page you built, so you can check the page against its design.
It needs no account, and reads no site until you click its icon.

A veil is thin enough to see through. Lay it over the page, and only what should not be there stands out.

## Get started

**Download the Chrome zip from [the latest release](https://github.com/Ank-KhoaHo/pixel-overlay/releases/latest),**
unzip it, and load the folder with **Load unpacked** at `chrome://extensions`. It is not on the Chrome Web
Store yet. → [Getting started](https://ank-khoaho.github.io/pixel-overlay/guide/getting-started), from source
and for Edge and Firefox too

## How to use it

| You want to | Pixel Veil | Guide |
|---|---|---|
| Lay a design over a page | Click the icon, then **Add image**, drop a file, or paste one | [Compare a design](https://ank-khoaho.github.io/pixel-overlay/guide/compare) |
| Line it up | Drag, arrow keys, **Center**, **Fit width**, snapping edges | [Compare a design](https://ank-khoaho.github.io/pixel-overlay/guide/compare#line-it-up) |
| See what differs | See-through, **Difference**, Multiply, Screen, Invert | [Compare a design](https://ank-khoaho.github.io/pixel-overlay/guide/compare#compare-in-four-ways) |
| Show one page's designs | Groups, and layers pinned to the window | [Organise your layers](https://ank-khoaho.github.io/pixel-overlay/guide/organise) |
| Keep layers after a reload | **Keep on this site**; Chrome asks once per site | [Organise your layers](https://ank-khoaho.github.io/pixel-overlay/guide/organise#keep-on-this-site) |
| Move them to another computer | Export and import one `.json` file | [Organise your layers](https://ank-khoaho.github.io/pixel-overlay/guide/organise#export-and-import) |
| Work from the keyboard | Shortcuts for show, hide and opacity | [Keyboard](https://ank-khoaho.github.io/pixel-overlay/guide/keyboard) |
| Know what it can read | Nothing at install; one tab when you click | [Privacy and permissions](https://ank-khoaho.github.io/pixel-overlay/guide/privacy) |

**The whole guide, with pictures and search: [ank-khoaho.github.io/pixel-overlay](https://ank-khoaho.github.io/pixel-overlay/).**

## Status

Version 0.2.2, before its first Chrome Web Store release.

## Limits

- Images: PNG, JPEG, WebP and GIF, up to 25 MB each. SVG is not accepted.
- Layers are kept per site, not per page. Groups show one page's designs at a time.
- Chrome lets no extension draw on its own pages (`chrome://`, the Web Store).

→ [All limits](https://ank-khoaho.github.io/pixel-overlay/guide/reference)

## Alternatives

Pixel Veil compares a picture of the design with a page. Something else is the better choice when:

- **You measure spacing, not compare a picture.** Your design tool's inspect mode gives exact sizes, and
  DevTools give the page's.
- **A test must fail when a page changes.** A screenshot test, such as Playwright's `toHaveScreenshot`,
  checks every build with nobody looking.
- **You work in a browser other than Chrome, Edge or Firefox.** Look in that browser's own store.

## FAQ

**Is it really free?**
Yes. Every layer, no account, and no paid plan waiting behind a button.

**Why does it need a click before it works on a page?**
That click is the permission. Pixel Veil starts with access to no site, so it has nothing to leak.

→ [More questions](https://ank-khoaho.github.io/pixel-overlay/guide/reference#questions)

## Documentation

| File | What it holds |
|---|---|
| [Documentation site](https://ank-khoaho.github.io/pixel-overlay/) | how to use every feature, one page each, with search; its pages are [guide/](guide/README.md) |
| [CONTRIBUTING.md](CONTRIBUTING.md) | how to build and test it, and what gets rejected |
| [SECURITY.md](SECURITY.md) | how to report a vulnerability, and what is not one |
| [ROADMAP.md](ROADMAP.md) | direction, and the things deliberately not coming |
| [CHANGELOG.md](CHANGELOG.md) | what changed in each version |
| [PUBLIC.md](PUBLIC.md) | why some material is deliberately not published here |
| [LICENSE](LICENSE) | what you may do with this |

The repository keeps its first working name, `pixel-overlay`.

## Licence

Licensed under MIT; see [LICENSE](LICENSE).
