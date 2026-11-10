import { browser } from 'wxt/browser';

function init() {
  const app = document.getElementById('app');
  if (!app) return;
  app.textContent = '';

  const header = document.createElement('div');
  header.className = 'header';

  const icon = document.createElement('img');
  icon.src = '/icon/32.png';
  icon.width = 32;
  icon.height = 32;
  icon.alt = '';
  icon.className = 'header-icon';

  const title = document.createElement('span');
  title.className = 'header-title';
  title.textContent = 'Pixel Veil on local files';

  header.appendChild(icon);
  header.appendChild(title);
  app.appendChild(header);

  if (import.meta.env.BROWSER === 'firefox') {
    const p = document.createElement('p');
    p.textContent =
      'Firefox does not let extensions draw on local files. Serve the folder with a local web server (for example npx serve).';
    app.appendChild(p);
  } else {
    const p = document.createElement('p');
    p.textContent =
      'Chrome needs one switch: open the extension\'s details and turn on "Allow access to file URLs", then click the icon again.';
    app.appendChild(p);

    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('data-po', 'open-settings');
    button.textContent = 'Open the settings';
    button.addEventListener('click', () => {
      try {
        void browser.tabs
          .create({ url: 'chrome://extensions/?id=' + browser.runtime.id })
          .catch((err) => {
            console.warn('[pixel-overlay]', err);
          });
      } catch (err) {
        console.warn('[pixel-overlay]', err);
      }
    });
    app.appendChild(button);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
