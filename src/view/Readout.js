import { Container, Text } from 'pixi.js';

/** Caption and value sit directly on the shared information bar. */
export class Readout extends Container {
  #value;
  #caption;
  #maxWidth;

  constructor(label, { valueSize = 30, valueColor = 0xf3f0e7, captionColor = 0x9da99f, width = 220 } = {}) {
    super();
    this.#maxWidth = width;
    const caption = new Text({ text: label, style: {
      fontFamily: 'system-ui, sans-serif', fontSize: 12, fontWeight: '500',
      fill: captionColor, letterSpacing: 2.2,
    } });
    this.#caption = caption;
    caption.anchor.set(0.5);
    caption.y = -22;
    this.#value = new Text({ text: '', style: {
      fontFamily: 'system-ui, sans-serif', fontSize: valueSize, fontWeight: '600', fill: valueColor,
    } });
    this.#value.anchor.set(0.5);
    this.#value.y = 8;
    this.addChild(caption, this.#value);
  }

  setCaptionSize(value) {
    this.#caption.style ??= {};
    this.#caption.style.fontSize = value;
  }

  setValueSize(value) {
    this.#value.style ??= {};
    this.#value.style.fontSize = value;
    this.text = this.#value.text;
  }

  set text(value) {
    this.#value.text = value;
    this.#value.scale.set(1);
    if (this.#value.width > this.#maxWidth) this.#value.scale.set(this.#maxWidth / this.#value.width);
  }
}
