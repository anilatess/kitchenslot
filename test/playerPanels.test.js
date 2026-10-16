import test from 'node:test';
import assert from 'node:assert/strict';
import { PlayerPanels } from '../src/view/PlayerPanels.js';

function fakeDocument() {
  const doc = { activeElement: null };
  doc.createElement = (tag) => ({
    tagName: tag, className: '', attributes: {}, children: [], listeners: new Map(), hidden: false, disabled: false,
    tabIndex: ['button', 'input', 'summary'].includes(tag) ? 0 : -1,
    _text: '',
    get textContent() { return this._text + this.children.map((child) => child.textContent).join(''); },
    set textContent(value) { this._text = String(value); this.replaceChildren(); },
    get isConnected() { for (let node = this; node; node = node.parentNode) if (node === doc.body) return true; return false; },
    setAttribute(key, value) { this.attributes[key] = String(value); },
    append(...children) { for (const child of children) { this.children.push(child); child.parentNode = this; } },
    appendChild(child) { this.append(child); },
    replaceChildren(...children) { for (const child of this.children) child.parentNode = null; this.children = []; this.append(...children); },
    remove() { this.parentNode?.children.splice(this.parentNode.children.indexOf(this), 1); this.parentNode = null; },
    addEventListener(name, handler) { this.listeners.set(name, handler); },
    dispatch(name, values = {}) {
      const event = { target: this, ...values, stopped: false, prevented: false,
        stopPropagation() { this.stopped = true; }, preventDefault() { this.prevented = true; } };
      this.listeners.get(name)?.(event);
      return event;
    },
    focus() { doc.activeElement = this; },
    querySelectorAll(selector) {
      const selectors = selector.split(',').map((part) => part.trim());
      const result = [];
      const visit = (node) => {
        for (const child of node.children) {
          if (selectors.some((part) => part.startsWith('.') ? child.className.split(' ').includes(part.slice(1))
            : part === '[tabindex]' ? child.tabIndex >= 0 : child.tagName === part)) result.push(child);
          visit(child);
        }
      };
      visit(this);
      return result;
    },
  });
  doc.body = doc.createElement('body');
  return doc;
}

function fixture(callbacks, run) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const doc = fakeDocument();
  Object.defineProperty(globalThis, 'document', { configurable: true, value: doc });
  const host = doc.createElement('div');
  doc.body.appendChild(host);
  const panels = new PlayerPanels(host, callbacks);
  try { run({ doc, host, panels, root: host.children[0] }); }
  finally {
    panels.destroy();
    if (previous) Object.defineProperty(globalThis, 'document', previous);
    else delete globalThis.document;
  }
}

test('ses ayarları düzeyi 0..1 ile bildirir ve kapalı ses tercihinden bağımsız korur', () => {
  const volumes = [], enabled = [];
  fixture({ onVolume: (value) => volumes.push(value), onAudioToggle: (value) => enabled.push(value) }, ({ panels, root }) => {
    panels.openSettings({ enabled: false, volume: 0.35 });
    const range = root.querySelectorAll('input')[0];
    const toggle = root.querySelectorAll('.kp-toggle')[0];
    assert.equal(panels.visible, true);
    assert.equal(range.value, '35');
    assert.equal(toggle.attributes['aria-pressed'], 'false');
    range.value = '0';
    range.dispatch('input');
    assert.deepEqual(volumes, [0]);
    assert.equal(range.attributes['aria-valuetext'], '%0');
    assert.equal(toggle.attributes['aria-pressed'], 'false');
    toggle.dispatch('click');
    assert.deepEqual(enabled, [true]);
    assert.match(root.textContent, /Ses düzeyi sıfır/);
    range.value = '150';
    range.dispatch('input');
    assert.deepEqual(volumes, [0, 1]);
    toggle.dispatch('click');
    assert.deepEqual(enabled, [true, false]);
  });
});

test('açılış ve kapanış odağı sıralıdır; Escape ve Tab oyun kısayollarına taşmaz', () => {
  let current, opened = 0, closed = 0;
  fixture({ onOpen: () => { opened++; assert.equal(current.doc.activeElement, current.prior); },
    onClose: () => { closed++; assert.equal(current.panels.visible, false); } }, ({ doc, host, panels, root }) => {
    const prior = doc.createElement('button');
    host.appendChild(prior);
    prior.focus();
    current = { doc, prior, panels };
    panels.openSettings();
    assert.equal(opened, 1);
    assert.equal(doc.activeElement, root.querySelectorAll('.kp-close')[0]);
    const range = root.querySelectorAll('input')[0];
    range.focus();
    const tab = root.dispatch('keydown', { key: 'Tab' });
    assert.equal(tab.prevented, true);
    assert.equal(doc.activeElement, root.querySelectorAll('.kp-close')[0]);
    assert.equal(root.dispatch('keydown', { key: ' ' }).stopped, true);
    const escape = root.dispatch('keydown', { key: 'Escape' });
    assert.equal(escape.prevented, true);
    assert.equal(closed, 1);
    assert.equal(doc.activeElement, prior);
    assert.equal(root.hidden, true);
    panels.close();
    assert.equal(closed, 1, 'iki kez kapatmak yaşam döngüsünü yinelemez');
  });
});

test('tur geçmişi en yeni 20 turu ve gerçek ödeme dökümünü gösterir', () => {
  fixture({}, ({ panels, root }) => {
    const entries = Array.from({ length: 22 }, (_, index) => ({
      id: String(index), time: 1000 + index, bet: 2, cost: 200, payout: 12.5, net: -187.5,
      buy: true, freeCount: 10, freeMult: 20, capped: index === 21,
      breakdown: [{ mode: 'base', raw: 0.5, multiplier: 5, payout: 2.5 }, { mode: 'free', raw: 0.5, multiplier: 20, payout: 10 }],
    }));
    panels.openHistory(entries);
    const cards = root.querySelectorAll('details');
    assert.equal(cards.length, 20);
    assert.match(cards[0].textContent, /12,50/);
    assert.match(cards[0].textContent, /-187,50/);
    assert.match(cards[0].textContent, /Bedava 1/);
    assert.match(cards[0].textContent, /×20/);
    assert.match(cards[0].textContent, /Kazanç tavanına ulaşıldı/);
    assert.doesNotMatch(cards[1].textContent, /Kazanç tavanına ulaşıldı/);
    assert.equal(root.querySelectorAll('table')[0].attributes['aria-label'], 'Turun ödeme hesabı');
    assert.equal(root.querySelectorAll('section')[0].attributes['aria-modal'], 'true');
  });
});

test('boş geçmiş anlaşılır ve tekrar açılan panel eski içeriği temizler', () => {
  fixture({}, ({ panels, root, host }) => {
    panels.openSettings();
    assert.equal(root.querySelectorAll('input').length, 1);
    panels.openHistory([]);
    assert.equal(root.querySelectorAll('input').length, 0);
    assert.match(root.textContent, /İlk servis seni bekliyor/);
    assert.equal(root.querySelectorAll('h2')[0].textContent, 'Tur geçmişi');
    panels.destroy();
    assert.equal(host.children.length, 0);
    assert.doesNotThrow(() => panels.openSettings());
  });
});
