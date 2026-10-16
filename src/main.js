import { Game } from './core/Game.js';
import { loadSymbolAtlas, loadSymbolImages } from './view/skins.js';
import { loadChefScene } from './view/ChefBonusView.js';

async function preloadBackdrop(url) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(true);
    image.onerror = () => resolve(false);
    image.src = url;
  });
}

let starting = false;
async function start() {
  if (starting) return;
  starting = true;
  const host = document.getElementById('app');
  const loading = document.createElement('div');
  loading.textContent = 'MUTFAK HAZIRLANIYOR…';
  loading.setAttribute('role', 'status');
  Object.assign(loading.style, {
    position: 'fixed', inset: '0', zIndex: '10', display: 'grid', placeItems: 'center', padding: '24px',
    background: '#122019', color: '#eed39a', font: '800 24px system-ui, sans-serif', textAlign: 'center',
  });
  host.appendChild(loading);

  const base = import.meta.env.BASE_URL;
  const backgroundUrl = base + 'assets/kitchen-realistic.png';
  try {
    const [symbolCount, photographicBackdrop] = await Promise.all([
      loadSymbolImages(base + 'assets/symbols/'),
      preloadBackdrop(backgroundUrl),
      loadChefScene(base + 'assets/'),
    ]);
    if (symbolCount < 12) {
      const atlasUrl = base + 'assets/symbols.json';
      const available = await fetch(atlasUrl, { method: 'HEAD' }).then((response) => response.ok).catch(() => false);
      if (available) await loadSymbolAtlas(atlasUrl);
    }
    if (photographicBackdrop) {
      host.style.backgroundImage = 'linear-gradient(rgba(17, 12, 7, 0.18), rgba(17, 12, 7, 0.36)), url("' + backgroundUrl + '")';
      host.style.backgroundSize = 'cover';
      host.style.backgroundPosition = 'center';
    }
    await new Game(host, { photographicBackdrop }).start();
    loading.remove();
  } catch (error) {
    console.error('Oyun açılamadı:', error);
    loading.textContent = '';
    loading.setAttribute('role', 'alert');
    const card = document.createElement('div');
    Object.assign(card.style, { maxWidth: '420px' });
    const heading = document.createElement('h1');
    heading.textContent = 'MUTFAK AÇILAMADI';
    heading.style.fontSize = '24px';
    const detail = document.createElement('p');
    detail.textContent = 'Oyun görüntüsü yüklenemedi. Tekrar deneyebilirsin; kayıtlı bakiyen ve bekleyen turun korunur.';
    Object.assign(detail.style, { color: '#e4dfd0', font: '400 16px/1.6 system-ui, sans-serif' });
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.textContent = 'TEKRAR DENE';
    Object.assign(retry.style, { marginTop: '12px', minHeight: '48px', padding: '12px 28px', border: '0', borderRadius: '12px', background: '#eed39a', color: '#17271f', font: '700 16px system-ui, sans-serif', cursor: 'pointer' });
    retry.addEventListener('click', () => { loading.remove(); void start(); }, { once: true });
    card.append(heading, detail, retry);
    loading.appendChild(card);
    retry.focus();
  } finally {
    starting = false;
  }
}

void start();
