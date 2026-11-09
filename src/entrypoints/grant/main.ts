import { browser } from 'wxt/browser';
import { grantOriginFrom, requestGrant } from './grant';

function init() {
  const app = document.getElementById('app');
  if (!app) return;

  const origin = grantOriginFrom(window.location.search);

  if (!origin) {
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
    const result = await requestGrant(origin, {
      request: (p) => browser.permissions.request(p),
      send: (m) => browser.runtime.sendMessage(m),
    });
    if (result === 'granted') {
      window.close();
    } else {
      button.disabled = false;
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
