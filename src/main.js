import { Game } from './core/Game.js';
import { loadSymbolAtlas } from './view/skins.js';

async function start() {
  const host = document.getElementById('app');
  const loading = document.createElement('div');
  loading.textContent = 'MUTFAK SLOT YÜKLENİYOR…';
  Object.assign(loading.style, {
    position: 'fixed', inset: '0', zIndex: '10', display: 'grid', placeItems: 'center',
    background: '#0f0b1f', color: '#ffd25a', font: '800 24px system-ui, sans-serif',
  });
  host.appendChild(loading);

  const atlasUrl = `${import.meta.env.BASE_URL}assets/symbols.json`;
  try {
    const available = await fetch(atlasUrl, { method: 'HEAD' }).then((response) => response.ok).catch(() => false);
    if (available) await loadSymbolAtlas(atlasUrl);
    await new Game(host).start();
  } finally {
    loading.remove();
  }
}

start();
