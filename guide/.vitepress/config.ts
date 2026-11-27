// The guide, built from its own Markdown pages by VitePress: `npm run docs:build` writes it to
// guide/.vitepress/dist, and .github/workflows/pages.yml publishes it at /pixel-overlay/guide/, beside
// the project page in site/.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitepress';

const REPO = 'https://github.com/Ank-KhoaHo/pixel-overlay';

// The guide's order is written once, in the table of guide/README.md, which is also what GitHub
// shows for the folder. Each row starts with a link to its page.
const table = readFileSync(new URL('../README.md', import.meta.url), 'utf-8');
const pages = [...table.matchAll(/^\| \[([^\]]+)\]\(([\w-]+)\.md\) \|/gm)].map(([, text, file]) => ({
  text: text!,
  link: `/${file!}`,
}));
if (pages.length === 0) throw new Error('No page was read from the table in guide/README.md');

export default defineConfig({
  title: 'Pixel Veil',
  titleTemplate: ':title | Pixel Veil guide',
  description: 'How to use Pixel Veil: lay a design image over a live page and check it pixel by pixel.',
  lang: 'en',
  base: '/pixel-overlay/guide/',
  cleanUrls: true,
  // GitHub opens README.md for the folder; on the site the same page is the guide's front page.
  // The pages link to README.md, which is right on GitHub. VitePress counts a link to a page it
  // renamed as dead, so on the site each such link is pointed at the new name before it is read.
  rewrites: { 'README.md': 'index.md' },
  markdown: {
    config(md) {
      md.core.ruler.push('guide-index-links', (state) => {
        for (const block of state.tokens) {
          for (const token of block.children ?? []) {
            const href = token.type === 'link_open' ? token.attrGet('href') : null;
            if (href) token.attrSet('href', href.replace(/^(\.\/)?README\.md(?=$|#)/, 'index.md'));
          }
        }
      });
      // A page is a Vue template, so `{{` in text or in a code span would run as code.
      for (const rule of ['text', 'code_inline'] as const) {
        const render = md.renderer.rules[rule]!;
        md.renderer.rules[rule] = (...args) => render(...args).replace(/\{\{/g, '&#123;&#123;');
      }
    },
  },
  head: [['link', { rel: 'icon', type: 'image/png', href: '/pixel-overlay/guide/32.png' }]],
  // The extension's own icons, so the site has one copy of each, not two.
  vite: { publicDir: fileURLToPath(new URL('../../public/icon', import.meta.url)) },
  themeConfig: {
    logo: '/48.png',
    nav: [
      { text: 'Guide', link: '/' },
      { text: 'Changelog', link: '/changelog' },
      { text: 'Download', link: `${REPO}/releases/latest` },
      { text: 'Project page', link: 'https://ank-khoaho.github.io/pixel-overlay/' },
    ],
    sidebar: [
      { text: 'Guide', link: '/', items: pages },
      { text: 'Changelog', link: '/changelog' },
    ],
    search: { provider: 'local' },
    socialLinks: [{ icon: 'github', link: REPO }],
    footer: {
      message:
        'Pixel Veil is maintained by <a href="https://wanksolution.com/">WillowAnk Solution</a>. ' +
        'Product page: <a href="https://wanksolution.com/pixel-veil/">wanksolution.com/pixel-veil</a>.',
      copyright: 'MIT licence',
    },
  },
});
