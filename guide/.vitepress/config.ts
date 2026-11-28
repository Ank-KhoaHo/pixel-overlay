// The Pages site, built from the guide's own Markdown pages by VitePress: `npm run docs:build` writes
// it to guide/.vitepress/dist, and .github/workflows/pages.yml publishes it at /pixel-overlay/, with the
// static files of site/ (robots.txt, sitemap.xml, llms.txt, pictures) laid over it.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitepress';

const REPO = 'https://github.com/Ank-KhoaHo/pixel-overlay';

// The guide's order is written once, in the table of guide/README.md, which is also what GitHub
// shows for the folder. Each row starts with a link to its page.
const table = readFileSync(new URL('../README.md', import.meta.url), 'utf-8');
const pages = [...table.matchAll(/^\| \[([^\]]+)\]\(([\w-]+)\.md\) \|/gm)].map(([, text, file]) => ({
  text: text!,
  link: `/guide/${file!}`,
}));
if (pages.length === 0) throw new Error('No page was read from the table in guide/README.md');

export default defineConfig({
  title: 'Pixel Veil',
  titleTemplate: ':title | Pixel Veil',
  description: 'How to use Pixel Veil: lay a design image over a live page and check it pixel by pixel.',
  lang: 'en',
  base: '/pixel-overlay/',
  cleanUrls: true,
  // index.md is the home page, at the site's root. Every other page is served under guide/, where
  // the guide was first published, so no address changes. GitHub opens README.md for the folder;
  // on the site the same page is the guide's front page, guide/. The pages link to README.md, which
  // is right on GitHub. VitePress resolves a link against the renamed page, and counts a link to README.md as
  // dead, so on the site each such link is pointed at index.md, the guide's front page beside it.
  rewrites: (id) => (id === 'index.md' ? id : id === 'README.md' ? 'guide/index.md' : `guide/${id}`),
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
  head: [['link', { rel: 'icon', type: 'image/png', href: '/pixel-overlay/32.png' }]],
  // The extension's own icons, so the site has one copy of each, not two.
  vite: { publicDir: fileURLToPath(new URL('../../public/icon', import.meta.url)) },
  themeConfig: {
    logo: '/48.png',
    nav: [
      { text: 'Guide', link: '/guide/' },
      { text: 'Changelog', link: '/guide/changelog' },
      { text: 'Download', link: `${REPO}/releases/latest` },
    ],
    sidebar: [
      { text: 'Guide', link: '/guide/', items: pages },
      { text: 'Changelog', link: '/guide/changelog' },
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
