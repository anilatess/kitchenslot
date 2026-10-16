import { Container, Text } from 'pixi.js';
import { COLORS } from '../core/constants.js';

// Küçük etiket + büyük değer çifti (örn. "BAKİYE / 1.000,00").
export class Readout extends Container {
  #value;

  constructor(label, { valueSize = 34, valueColor = COLORS.text } = {}) {
    super();
    const caption = new Text({
      text: label,
      style: { fontFamily: 'system-ui, sans-serif', fontSize: 16, fontWeight: '700', fill: COLORS.textDim, letterSpacing: 2 },
    });
    caption.anchor.set(0.5);
    caption.y = -valueSize * 0.75;

    this.#value = new Text({
      text: '',
      style: { fontFamily: 'system-ui, sans-serif', fontSize: valueSize, fontWeight: '800', fill: valueColor },
    });
    this.#value.anchor.set(0.5);
    this.addChild(caption, this.#value);
  }

  set text(value) {
    this.#value.text = value;
  }
}
