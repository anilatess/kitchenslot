import { Container, Graphics, Text } from 'pixi.js';
import { Button } from './Button.js';

const UI = { surface: 0x101b17, edge: 0xbda675, text: 0xf4f0e5, muted: 0x9aaa9e, gold: 0xdfc58a };
const label = (value, size, fill = UI.text) => {
  const item = new Text({ text: value, style: {
    fontFamily: 'system-ui, sans-serif', fontSize: size, fontWeight: '600', fill,
    align: 'center', wordWrap: true, wordWrapWidth: 500,
  } });
  item.anchor.set(0.5);
  return item;
};

/** Touch-sized utility menu; it emits intentions and never changes the wager. */
export class MobileMenu extends Container {
  #shade = new Graphics();
  #panel = new Graphics();
  #title = label('DİĞER İŞLEMLER', 29, UI.gold);
  #close = new Button({ label: '×', width: 84, height: 84, fontSize: 36, accessibleLabel: 'Menüyü kapat' });
  #history = new Button({ label: 'GEÇMİŞ', width: 500, height: 80, fontSize: 25, accessibleLabel: 'Tur geçmişi' });
  #settings = new Button({ label: 'SES AYARLARI', width: 500, height: 80, fontSize: 25 });
  #rules = new Button({ label: 'ÖDEME TABLOSU', width: 500, height: 80, fontSize: 25 });
  #turbo = new Button({ label: 'TURBO', width: 230, height: 80, fontSize: 23 });
  #autoplayCount = new Button({ label: 'OTO ×10', width: 230, height: 80, fontSize: 23 });
  #autoplayToggle = new Button({ label: 'OTO BAŞLAT', width: 500, height: 80, fontSize: 25 });
  #status = label('Hız ve otomatik dönüş seçenekleri', 19, UI.muted);

  constructor() {
    super();
    this.visible = false;
    this.eventMode = 'static';
    this.accessibilityModal = true;
    this.#shade.eventMode = 'static';
    this.#panel.eventMode = 'static';
    this.#shade.label = 'menu-shade';
    this.#panel.label = 'menu-panel';
    this.#status.label = 'menu-autoplay-status';
    this.addChild(this.#shade, this.#panel, this.#title, this.#close,
      this.#history, this.#settings, this.#rules, this.#turbo,
      this.#autoplayCount, this.#autoplayToggle, this.#status);
    this.#close.on('press', () => this.hide());
    this.#shade.on('pointertap', () => this.hide());
    const entries = [
      [this.#history, 'history', true], [this.#settings, 'settings', true], [this.#rules, 'rules', true],
      [this.#turbo, 'turbo', false], [this.#autoplayCount, 'autoplayCount', false],
      [this.#autoplayToggle, 'autoplayToggle', true],
    ];
    entries.forEach(([button, action, close]) => button.on('press', () => {
      if (close) this.hide();
      this.emit('action', action);
    }));
    this.layout('portrait');
  }

  show() {
    if (this.visible) return;
    this.visible = true;
    this.emit('visibilityChange', true);
  }

  hide() {
    if (!this.visible) return;
    this.visible = false;
    this.emit('visibilityChange', false);
  }

  toggle() { if (this.visible) this.hide(); else this.show(); }

  layout(orientation) {
    const portrait = orientation === 'portrait';
    const width = portrait ? 720 : 1280;
    const height = portrait ? 1280 : 720;
    const panelWidth = 608;
    const panelHeight = portrait ? 760 : 652;
    const centreX = width / 2, centreY = height / 2;
    this.position.set(0, 0);
    this.#shade.clear().rect(0, 0, width, height).fill({ color: 0x030907, alpha: 0.86 });
    this.#panel.clear().roundRect(centreX - panelWidth / 2, centreY - panelHeight / 2 + 8, panelWidth, panelHeight, 22)
      .fill({ color: 0x030907, alpha: 0.4 })
      .roundRect(centreX - panelWidth / 2, centreY - panelHeight / 2, panelWidth, panelHeight, 22)
      .fill({ color: UI.surface }).stroke({ width: 1.5, color: UI.edge, alpha: 0.65 });
    this.#title.position.set(centreX - 22, centreY - panelHeight / 2 + (portrait ? 68 : 55));
    this.#close.position.set(centreX + 248, centreY - panelHeight / 2 + (portrait ? 54 : 49));
    const ys = portrait ? [-205, -105, -5, 95, 195] : [-176, -88, 0, 88, 176];
    [this.#history, this.#settings, this.#rules]
      .forEach((button, index) => button.position.set(centreX, centreY + ys[index]));
    this.#turbo.position.set(centreX - 130, centreY + ys[3]);
    this.#autoplayCount.position.set(centreX + 130, centreY + ys[3]);
    this.#autoplayToggle.position.set(centreX, centreY + ys[4]);
    this.#status.position.set(centreX, centreY + (portrait ? 292 : 264));
  }

  setTurbo(on) {
    this.#turbo.setLabel(on ? 'TURBO AÇIK' : 'TURBO');
    this.#turbo.setSelected(!!on);
  }

  setAutoplay({ selected, remaining, running }) {
    this.#autoplayCount.setLabel(`OTO ×${selected}`);
    this.#autoplayToggle.setLabel(running ? 'DURDUR' : 'OTO BAŞLAT');
    this.#autoplayToggle.setSelected(!!running);
    this.#status.text = running ? `KALAN ${remaining} TUR` : 'Hız ve otomatik dönüş seçenekleri';
  }

  setControls({ canChangeBet, canAutoplay = false, autoplayRunning = false }) {
    this.#rules.setEnabled(!!canChangeBet);
    this.#autoplayCount.setEnabled(!!canAutoplay);
    this.#autoplayToggle.setEnabled(!!canAutoplay || !!autoplayRunning);
  }
}
