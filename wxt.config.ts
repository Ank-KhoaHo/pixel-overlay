import { defineConfig } from 'wxt';

// See docs/superpowers/specs/A1-free-design-overlay-chrome-extension.md, section 7.
// No site access at install: the icon click uses activeTab, and a site is kept
// (layers restored after reload) only after the user grants that one origin.
// The e2e build (`wxt build --mode e2e`, output .output/chrome-mv3-e2e) adds localhost and file:///*,
// because Playwright cannot click Chrome's permission prompt. Never ship that build.
// Firefox (`npm run build:firefox`, ticket A3) adds the gecko id that signing needs and declares
// that the extension collects no data (required for new AMO listings); the Chrome manifests
// carry neither.
export default defineConfig({
  srcDir: 'src',
  // WXT's own sources zip (for Firefox review) packs the whole folder, gitignored files
  // included, and this repo keeps its working notes gitignored. `npm run zip:sources` uses
  // `git archive` instead, which can only contain tracked (already public) files.
  zip: { zipSources: false },
  modules: ['@wxt-dev/module-react'],
  manifest: ({ mode, browser }) => ({
    name: 'Pixel Veil',
    description:
      'Lay design images over a live page and check it pixel by pixel. Unlimited layers, free.',
    // A10: Chrome's side panel. Firefox gets a sidebar_action from the same page, no permission.
    permissions: [
      'activeTab',
      'scripting',
      'storage',
      'unlimitedStorage',
      ...(browser === 'firefox' ? [] : ['sidePanel']),
    ],
    optional_host_permissions: ['<all_urls>'],
    ...(mode === 'e2e' ? { host_permissions: ['http://localhost/*', 'file:///*'] } : {}),
    action: { default_title: 'Pixel Veil' },
    // A7. Chrome takes at most 4 suggested keys; users rebind all of them in
    // chrome://extensions/shortcuts. toggle-difference ships without a key.
    commands: {
      _execute_action: { suggested_key: { default: 'Alt+Shift+V' } },
      'toggle-hide-all': {
        suggested_key: { default: 'Alt+Shift+H' },
        description: 'Hide or show all layers',
      },
      'opacity-up': {
        suggested_key: { default: 'Alt+Shift+Period' },
        description: 'Make the active layer 10 % more solid',
      },
      'opacity-down': {
        suggested_key: { default: 'Alt+Shift+Comma' },
        description: 'Make the active layer 10 % more see-through',
      },
      'toggle-difference': { description: 'Turn Difference view on or off' },
    },
    ...(browser === 'firefox'
      ? {
          browser_specific_settings: {
            gecko: {
              id: 'pixel-overlay@wanksolution.com',
              strict_min_version: '140.0',
              data_collection_permissions: { required: ['none'] },
            },
          },
        }
      : {}),
  }),
});
