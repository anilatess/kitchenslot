import { Container, Graphics, Text } from 'pixi.js';
import { Button } from './Button.js';
import { easeOutQuad } from '../animation/easing.js';

const UI = { surface: 0x101b17, edge: 0xbda675, text: 0xf4f0e5, muted: 0xa7b4a8, gold: 0xdfc58a };
const fmt = (n) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const label = (size, fill = UI.text, weight = '600') => {
  const item = new Text({ text: '', style: { fontFamily: 'system-ui, sans-serif', fontSize: size,
    fontWeight: weight, fill, align: 'center' } });
  item.anchor.set(0.5);
  return item;
};

/** Shared, skippable presentation for bonus milestones and official results. */
export class FeatureOverlay extends Container {
  #animator;
  #shade = new Graphics();
  #panel = new Graphics();
  #halo = new Graphics();
  #sparkles = new Graphics();
  #eyebrow = label(13, UI.gold);
  #title = label(34, UI.text, '700');
  #value = label(72, UI.gold, '800');
  #detail = label(22);
  #note = label(15, UI.muted);
  #button = new Button({ label: 'DEVAM ET', width: 220, height: 48, fill: UI.gold, color: UI.surface, fontSize: 16 });
  #release;
  #token = 0;
  #phase = 0;
  #portrait = false;
  #reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;

  constructor(animator) {
    super();
    this.#animator = animator;
    this.visible = false;
    this.eventMode = 'static';
    this.#shade.eventMode = 'static';
    this.addChild(this.#shade, this.#halo, this.#panel, this.#sparkles,
      this.#eyebrow, this.#title, this.#value, this.#detail, this.#note, this.#button);
    this.#button.on('press', () => this.dismiss());
  }

  layout(orientation) {
    this.#portrait = orientation === 'portrait';
    const w = this.#portrait ? 720 : 1280, h = this.#portrait ? 1280 : 720;
    this.position.set(w / 2, h / 2);
    this.#shade.clear().rect(-w / 2, -h / 2, w, h).fill({ color: 0x030907, alpha: 0.86 });
    const pw = this.#portrait ? 624 : 670, ph = this.#portrait ? 620 : 460;
    this.#panel.clear().roundRect(-pw / 2, -ph / 2 + 10, pw, ph, 24).fill({ color: 0x020806, alpha: 0.5 })
      .roundRect(-pw / 2, -ph / 2, pw, ph, 24).fill({ color: UI.surface })
      .stroke({ width: 1.5, color: UI.edge, alpha: 0.75 })
      .rect(-45, -ph / 2 + 23, 90, 2).fill({ color: UI.gold, alpha: 0.8 });
    this.#halo.clear().circle(0, 0, pw * 0.47).fill({ color: UI.gold, alpha: 0.05 });
    const y = this.#portrait ? [-246, -178, -58, 58, 116, 220] : [-174, -122, -32, 58, 100, 166];
    [this.#eyebrow, this.#title, this.#value, this.#detail, this.#note, this.#button]
      .forEach((item, index) => item.position.set(0, y[index]));
    [[this.#eyebrow, 13, 22], [this.#title, 34, 38], [this.#value, 72, 76],
      [this.#detail, 22, 27], [this.#note, 15, 22]].forEach(([item, desktop, mobile]) => {
      item.style ??= {};
      item.style.fontSize = this.#portrait ? mobile : desktop;
      item.style.wordWrap = true;
      item.style.wordWrapWidth = pw - 54;
    });
    this.#button.setSize(this.#portrait ? 300 : 220, this.#portrait ? 84 : 48);
    this.#button.setFontSize(this.#portrait ? 25 : 16);
  }

  dismiss() { this.#release?.(); }

  update(deltaMS) {
    if (!this.visible || this.#reducedMotion) return;
    this.#phase += Math.min(deltaMS, 50) * 0.001;
    this.#halo.alpha = 0.75 + Math.sin(this.#phase * 2) * 0.2;
    this.#sparkles.clear();
    const width = this.#portrait ? 274 : 296, height = this.#portrait ? 270 : 180;
    for (let i = 0; i < 14; i++) {
      const a = i * 2.399, progress = (this.#phase * 0.17 + i / 14) % 1;
      const x = Math.sin(a) * width, y = height - progress * height * 2;
      this.#sparkles.circle(x, y, 1.3 + i % 3 * 0.5).fill({ color: UI.gold, alpha: Math.sin(progress * Math.PI) * 0.45 });
    }
  }

  async show({ eyebrow, title, value, amount, detail = '', note = '', hold = 2800, button = 'DEVAM ET' }) {
    const token = ++this.#token;
    this.#eyebrow.text = eyebrow;
    this.#title.text = title;
    this.#detail.text = detail;
    this.#note.text = note;
    this.#button.setLabel(button);
    this.#value.text = value ?? fmt(amount ?? 0);
    this.visible = true;
    this.alpha = 0;
    const skip = new Promise(resolve => { this.#release = resolve; });
    try {
      await this.#animator.tween(this, { alpha: 1 }, this.#reducedMotion ? 0 : 220, easeOutQuad);
      if (amount !== undefined) {
        const counter = { n: 0 };
        const count = this.#animator.tween(counter, { n: amount }, this.#reducedMotion ? 0 : 1050, easeOutQuad,
          () => { if (this.#token === token) this.#value.text = fmt(counter.n); });
        // A skip finishes the official amount immediately; outstanding tweens cannot overwrite it.
        await Promise.race([count, skip]);
        if (this.#token === token) { this.#token++; this.#value.text = fmt(amount); }
      }
      if (hold === null) await skip;
      else await Promise.race([this.#animator.wait(this.#reducedMotion ? Math.min(hold, 1400) : hold), skip]);
      await this.#animator.tween(this, { alpha: 0 }, this.#reducedMotion ? 0 : 180, easeOutQuad);
    } finally {
      this.#release = null;
      this.visible = false;
      this.#sparkles.clear();
    }
  }
}
