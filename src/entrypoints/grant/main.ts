import { browser } from 'wxt/browser';
import { originOf } from '../../core/site';

function init() {
  const app = document.getElementById('app');
  if (!app) return;

  const params = new URLSearchParams(window.location.search);
  const rawOrigin = params.get('origin');
  const origin = rawOrigin ? originOf(rawOrigin) : null;
  const isValid = origin !== null && rawOrigin === origin;

  if (!isValid) {
    const p = document.createElement('p');
    p.textContent = 'Nothing to do.';
    app.appendChild(p);
    return;
  }

  const desc = document.createElement('p');
  desc.textContent = `Let Pixel Overlay restore your layers on ${origin} after a reload.`;
  app.appendChild(desc);

  const button = document.createElement('button');
  button.type = 'button';
  button.setAttribute('data-po', 'grant');
  button.textContent = 'Allow';

  const status = document.createElement('p');
  status.id = 'status';

  button.addEventListener('click', async () => {
    button.disabled = true;
    status.textContent = '';
    try {
      const granted = await browser.permissions.request({
        origins: [`${origin}/*`],
      });
      if (granted) {
        await browser.runtime.sendMessage({ type: 'po/granted', origin });
        window.close();
      } else {
        button.disabled = false;
        status.textContent = 'Not allowed. You can try again.';
      }
    } catch (err) {
      button.disabled = false;
      console.warn('[pixel-overlay]', err);
      status.textContent = 'Not allowed. You can try again.';
    }
  });

  app.appendChild(button);
  app.appendChild(status);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
