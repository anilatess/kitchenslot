import { Container, Graphics, Text } from 'pixi.js';

const mix = (color, light, amount) => {
  const channel = (shift) => Math.round(((color >> shift) & 255) * (1 - amount) + ((light >> shift) & 255) * amount);
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
};

const spokenLabel = (label) => ({ '?': 'Ödeme tablosu ve oyun kuralları', '+': 'Bahsi artır', '−': 'Bahsi azalt', SPIN: 'Döndür' }[label] ?? label);

/** Matte controls with a single accent treatment for the main action. */
export class Button extends Container {
  #glow = new Graphics();
  #shadow = new Graphics();
  #bg = new Graphics();
  #detail = new Graphics();
  #focus = new Graphics();
  #label;
  #arrow;
  #width; #height; #radius; #fill; #border; #variant;
  #enabled = true;
  #hover = false;
  #selected = false;
  #selectable = false;
  #keyboardFocused = false;
  #accessibleLabel;
  #phase = 0;

  constructor({ label, width, height, radius = 12, fill = 0x1c2824, color = 0xf3f0e7,
    border = 0xb7a16f, fontSize = 20, variant = 'default', glow = false, accessibleLabel = null }) {
    super();
    this.#width = width;
    this.#height = height;
    this.#radius = radius;
    this.#fill = fill;
    this.#border = border;
    this.#variant = variant === 'spin' || glow ? 'spin' : variant;
    this.#accessibleLabel = accessibleLabel;
    this.isAccessibleButton = true;
    this.#label = new Text({ text: label, style: {
      fontFamily: 'system-ui, sans-serif', fontSize,
      fontWeight: this.#variant === 'spin' ? '800' : '600', fill: color,
      letterSpacing: this.#variant === 'spin' ? 3 : 0.7,
    } });
    this.#label.anchor.set(0.5);
    this.addChild(this.#glow, this.#shadow, this.#bg, this.#detail);
    if (this.#variant === 'spin') {
      const arrow = new Text({ text: '↻', style: {
        fontFamily: 'Arial, sans-serif', fontSize: 99 * (width / 156), fontWeight: '400', fill: 0x17231e,
      } });
      arrow.anchor.set(0.5);
      this.#arrow = arrow;
      arrow.y = -12 * (width / 156);
      this.#label.y = 44 * (width / 156);
      this.addChild(arrow);
    }
    this.addChild(this.#label, this.#focus);
    this.setSize(width, height, radius);
    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.on('pointerdown', () => { if (this.#enabled) this.scale.set(0.97); });
    const release = () => this.scale.set(this.#enabled && this.#hover ? 1.015 : 1);
    this.on('pointerup', release);
    this.on('pointerupoutside', release);
    this.on('pointerover', () => {
      if (!this.#enabled) return;
      this.#hover = true;
      this.scale.set(1.015);
      this.#redraw();
    });
    this.on('pointerout', () => {
      this.#hover = false;
      this.scale.set(1);
      this.#redraw();
    });
    this.on('pointertap', () => this.press());
  }

  get enabled() { return this.#enabled; }
  get accessibleLabel() { return this.#accessibleLabel ?? spokenLabel(this.#label.text); }
  get selected() { return this.#selectable ? this.#selected : null; }
  press() { if (this.#enabled) this.emit('press'); }
  setKeyboardFocused(value) {
    const focused = !!value && this.#enabled;
    if (focused === this.#keyboardFocused) return;
    this.#keyboardFocused = focused;
    this.#redraw();
  }
  setAccessibleLabel(value) { this.#accessibleLabel = value; }
  setLabel(value) { this.#label.text = value; }
  setSize(width, height, radius = this.#radius) {
    this.#width = width;
    this.#height = height;
    this.#radius = radius;
    // Hit testing follows the visible control, including after orientation changes.
    this.hitArea = { x: -width / 2, y: -height / 2, width, height,
      contains: (x, y) => Math.abs(x) <= width / 2 && Math.abs(y) <= height / 2 };
    if (this.#arrow) {
      this.#arrow.style ??= {};
      this.#arrow.style.fontSize = 99 * (width / 156);
      this.#arrow.y = -12 * (width / 156);
      this.#label.y = 44 * (width / 156);
    }
    this.#redraw();
  }
  setFontSize(value) {
    this.#label.style ??= {};
    this.#label.style.fontSize = value;
  }
  setFill(value) { this.#fill = value; this.#redraw(); }
  setSelected(value) {
    this.#selectable = true;
    if (this.#selected === value) return;
    this.#selected = value;
    this.#redraw();
  }
  setEnabled(value) {
    this.#enabled = !!value;
    this.alpha = value ? 1 : 0.45;
    this.cursor = value ? 'pointer' : 'default';
    if (!value) { this.#hover = false; this.#keyboardFocused = false; this.scale.set(1); }
    this.#redraw();
  }
  update(deltaMS) {
    if (this.#variant !== 'spin') return;
    this.#phase += Math.min(deltaMS, 50) * 0.0018;
    this.#glow.alpha = 0.5 + Math.sin(this.#phase) * 0.18;
  }

  #redraw() {
    const w = this.#width, h = this.#height;
    this.#glow.clear(); this.#shadow.clear(); this.#bg.clear(); this.#detail.clear(); this.#focus.clear();
    if (this.#keyboardFocused) {
      if (this.#variant === 'spin') this.#focus.circle(0, 0, w / 2 + 7).stroke({ width: 3, color: 0xf4d58b });
      else this.#focus.roundRect(-w / 2 - 4, -h / 2 - 4, w + 8, h + 8, this.#radius + 4)
        .stroke({ width: 3, color: 0xf4d58b });
    }
    if (this.#variant === 'spin') {
      const r = w / 2;
      this.#glow.circle(0, 0, r + 8).stroke({ width: 10, color: 0xd9be7f, alpha: 0.09 });
      this.#shadow.circle(0, 5, r + 2).fill({ color: 0x030806, alpha: 0.42 });
      this.#bg.circle(0, 0, r + 3).fill({ color: 0x101b17 })
        .stroke({ width: 1, color: 0xc5ac73, alpha: 0.55 })
        .circle(0, 0, r - 4).fill({ color: this.#hover ? 0xf2dda8 : 0xdfc58a })
        .circle(0, 0, r - 10).stroke({ width: 1, color: 0x695b39, alpha: 0.28 });
      return;
    }
    const fill = this.#selected ? mix(this.#fill, 0x9caa70, 0.16) : this.#fill;
    this.#shadow.roundRect(-w / 2, -h / 2 + 3, w, h, this.#radius)
      .fill({ color: 0x030907, alpha: 0.2 });
    this.#bg.roundRect(-w / 2, -h / 2, w, h, this.#radius)
      .fill({ color: this.#hover ? mix(fill, 0xffffff, 0.06) : fill, alpha: 0.98 })
      .stroke({ width: 1, color: this.#border, alpha: this.#selected ? 0.8 : this.#hover ? 0.5 : 0.23 });
    this.#detail.roundRect(-w / 2 + 2, -h / 2 + 2, w - 4, 1, 0)
      .fill({ color: 0xffffff, alpha: 0.06 });
  }
}
