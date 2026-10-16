import { Container, Graphics } from 'pixi.js';
import { COLORS, DESIGN } from './constants.js';

// Ekrana sığan, yatay/dikey düzen arasında geçiş yapan kök konteyner.
// Çocuklar "tasarım koordinatlarında" çalışır; layout(orientation) metodu olanlar
// yön değiştiğinde konumlarını yeniden ayarlar.
export class ResponsiveRoot extends Container {
  #app;
  #layoutables = [];
  #backdrop = new Graphics();
  #ambient = new Graphics();
  #phase = 0;
  orientation = 'landscape';

  constructor(app) {
    super();
    this.#app = app;
    this.addChild(this.#backdrop, this.#ambient);
    app.ticker.add((tick) => {
      this.#phase += tick.deltaMS * 0.00022;
      this.#ambient.position.set(Math.sin(this.#phase) * 16, Math.cos(this.#phase * 0.8) * 12);
    });
    app.renderer.on('resize', () => this.resize());
  }

  /** Bir görünümü sahneye ekler ve yön değişimlerinde layout(orientation) çağrılmasını sağlar. */
  add(layoutable) {
    this.addChild(layoutable);
    this.#layoutables.push(layoutable);
    layoutable.layout(this.orientation);
    return layoutable;
  }

  resize() {
    const { width, height } = this.#app.screen;
    this.orientation = width >= height ? 'landscape' : 'portrait';
    const design = DESIGN[this.orientation];
    const scale = Math.min(width / design.width, height / design.height);

    this.scale.set(scale);
    this.position.set((width - design.width * scale) / 2, (height - design.height * scale) / 2);

    this.#backdrop.clear().rect(0, 0, design.width, design.height).fill({ color: COLORS.background });
    this.#ambient.clear()
      .circle(design.width * 0.18, design.height * 0.22, design.width * 0.42)
      .fill({ color: 0x453286, alpha: 0.1 })
      .circle(design.width * 0.82, design.height * 0.8, design.width * 0.38)
      .fill({ color: 0x145b51, alpha: 0.075 });
    this.#layoutables.forEach((item) => item.layout(this.orientation));
  }
}
