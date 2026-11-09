import { defineConfig } from 'wxt';

// See docs/superpowers/specs/A1-free-design-overlay-chrome-extension.md, section 7.
// No site access at install: the icon click uses activeTab, and a site is kept
// (layers restored after reload) only after the user grants that one origin.
// The e2e build (`wxt build --mode e2e`, output .output/chrome-mv3-e2e) adds localhost,
// because Playwright cannot click Chrome's permission prompt. Never ship that build.
export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react'],
  manifest: ({ mode }) => ({
    name: 'Pixel Overlay',
    description:
      'Lay design images over a live page and check it pixel by pixel. Unlimited layers, free.',
    permissions: ['activeTab', 'scripting', 'storage', 'unlimitedStorage'],
    optional_host_permissions: ['<all_urls>'],
    ...(mode === 'e2e' ? { host_permissions: ['http://localhost/*'] } : {}),
    action: { default_title: 'Pixel Overlay' },
  }),
});
