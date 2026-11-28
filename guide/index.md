---
layout: home
title: Pixel Veil
titleTemplate: Your design over the page you built
description: A free Chrome extension for front-end developers. Lay a design export over a live page and see every pixel that disagrees. Unlimited layers, no account, no site access until you click.
# What crawlers and link previews read. One JSON entry per line (JSON is YAML too), so
# tests/test_site.py reads them without a build. One address, four places: canonical, og:url,
# the JSON-LD url and sitemap.xml.
head:
  - ["link", {"rel": "canonical", "href": "https://ank-khoaho.github.io/pixel-overlay/"}]
  - ["meta", {"property": "og:type", "content": "website"}]
  - ["meta", {"property": "og:site_name", "content": "Pixel Veil"}]
  - ["meta", {"property": "og:url", "content": "https://ank-khoaho.github.io/pixel-overlay/"}]
  - ["meta", {"property": "og:title", "content": "Pixel Veil | Your design over the page you built"}]
  - ["meta", {"property": "og:description", "content": "A free Chrome extension for front-end developers. Lay a design export over a live page and see every pixel that disagrees. Unlimited layers, no account, no site access until you click."}]
  - ["meta", {"property": "og:image", "content": "https://ank-khoaho.github.io/pixel-overlay/img/social.png"}]
  - ["meta", {"name": "twitter:card", "content": "summary_large_image"}]
  - ["script", {"type": "application/ld+json"}, "{\"@context\":\"https://schema.org\",\"@type\":\"SoftwareApplication\",\"name\":\"Pixel Veil\",\"description\":\"A free Chrome extension for front-end developers. Lay a design export over a live page and see every pixel that disagrees. Unlimited layers, no account, no site access until you click.\",\"url\":\"https://ank-khoaho.github.io/pixel-overlay/\",\"applicationCategory\":\"DeveloperApplication\",\"operatingSystem\":\"Chrome\",\"isAccessibleForFree\":true,\"offers\":{\"@type\":\"Offer\",\"price\":\"0\",\"priceCurrency\":\"USD\"},\"license\":\"https://github.com/Ank-KhoaHo/pixel-overlay/blob/main/LICENSE\",\"downloadUrl\":\"https://github.com/Ank-KhoaHo/pixel-overlay/releases\",\"image\":\"https://ank-khoaho.github.io/pixel-overlay/img/social.png\"}"]

hero:
  name: Pixel Veil
  text: Lay your design over the page you built.
  tagline: A free Chrome extension for front-end developers. Drop a design export on any page, line it up, and every pixel that disagrees shows.
  image:
    src: /128.png
    alt: The Pixel Veil icon
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: Read the guide
      link: /guide/
    - theme: alt
      text: Download
      link: https://github.com/Ank-KhoaHo/pixel-overlay/releases/latest

features:
  - title: Any number of layers
    details: Desktop, tablet and mobile designs side by side, kept per site. Free, every one.
    link: /guide/compare
  - title: Four ways to compare
    details: See-through, Difference, Multiply and Screen, plus Invert. In Difference, matching pixels turn black.
    link: /guide/compare#compare-in-four-ways
  - title: Groups and pinned layers
    details: Show one page's designs at a time, and pin a sticky header's design to the window.
    link: /guide/organise
  - title: Keyboard first
    details: Shortcuts for show, hide and opacity. Every control has a name a screen reader reads.
    link: /guide/keyboard
  - title: No site access until you click
    details: At install it can read no site. Your designs stay in your browser; it sends nothing anywhere.
    link: /guide/privacy
  - title: Export and import
    details: One .json file holds a site's layers and images. Take it to another site or computer.
    link: /guide/organise#export-and-import
---

![A real product page with its design laid over it. Left of an orange line, the design at 50 % shows doubled text; right of it, Difference view turns matching pixels black, so only the heading, the paragraph and one button light up.](../site/img/hero.webp)
