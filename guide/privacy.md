# Privacy and permissions

Many extensions can read every site you visit from the moment you install them. Pixel Veil asks one step at a time, and you can always see which step you are on.

## Site access, one step at a time

1. **You install it.** It can read no site at all. Chrome shows no site access for it.
2. **You click its icon on a page.** It may draw on that one tab, until you leave the page. This is Chrome's `activeTab` permission.
3. **You tick Keep on this site.** Chrome asks you for that one site, so the layers come back after a reload. Untick it, and the permission goes back.

## Where your designs go

- Your images and settings stay in your browser, in the extension's own storage (`chrome.storage.local`).
- Pixel Veil sends nothing anywhere. It has no account, no server and no analytics.
- The page cannot read your designs. The layers live in a closed shadow root, and Pixel Veil ignores key presses that a page's script makes up.
- **Export** makes a file only when you click it, and the file stays on your computer.

The full policy is on [wanksolution.com](https://wanksolution.com/pixel-veil/privacy/). To report a vulnerability, see [SECURITY.md](https://github.com/Ank-KhoaHo/pixel-overlay/blob/main/SECURITY.md). Every line of the extension is open source under MIT, [on GitHub](https://github.com/Ank-KhoaHo/pixel-overlay).
