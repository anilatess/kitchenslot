import { Container, Graphics, Text } from 'pixi.js';
import { COLORS } from '../core/constants.js';

// Basit, yeniden kullanılabilir düğme. Tıklanınca 'press' olayı yayar.
export class Button extends Container {
  #bg = new Graphics();
  #label;
  #width;
  #height;
  #radius;
  #fill;
  #enabled = true;

  constructor({ label, width, height, radius = height / 2, fill = COLORS.button, fontSize = 26 }) {
    super();
    this.#width = width;
    this.#height = height;
    this.#radius = radius;
    this.#fill = fill;
    this.#label = new Text({
      text: label,
      style: { fontFamily: 'system-ui, sans-serif', fontSize, fontWeight: '800', fill: COLORS.text },
    });
    this.#label.anchor.set(0.5);
    this.addChild(this.#bg, this.#label);
    this.#redraw();

    this.eventMode = 'static';
    this.cursor = 'pointer';
    this.on('pointerdown', () => this.#enabled && this.scale.set(0.94));
    const release = () => this.scale.set(1);
    this.on('pointerup', release);
    this.on('pointerupoutside', release);
    this.on('pointertap', () => this.#enabled && this.emit('press'));
  }

  setLabel(text) {
    this.#label.text = text;
  }

  setFill(color) {
    this.#fill = color;
    this.#redraw();
  }

  setEnabled(enabled) {
    this.#enabled = enabled;
    this.cursor = enabled ? 'pointer' : 'default';
    this.alpha = enabled ? 1 : 0.45;
  }

  #redraw() {
    this.#bg
      .clear()
      .roundRect(-this.#width / 2, -this.#height / 2, this.#width, this.#height, this.#radius)
      .fill({ color: this.#fill });
  }
}
