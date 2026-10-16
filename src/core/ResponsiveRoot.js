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
  #photographicBackdrop;
  orientation = 'landscape';

  constructor(app, { photographicBackdrop = false } = {}) {
    super();
    this.#app = app;
    this.#photographicBackdrop = photographicBackdrop;
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

    this.#drawKitchenBackdrop(design);
    this.#layoutables.forEach((item) => item.layout(this.orientation));
  }

  /** Koyu ahşap tezgâh ve sade fayans yansıması; dikkat odağı ızgarada kalır. */
  #drawKitchenBackdrop(design) {
    const { width, height } = design;
    if (this.#photographicBackdrop) {
      this.#backdrop.clear().rect(0, 0, width, height).fill({ color: 0x130d08, alpha: 0.06 });
      this.#ambient.clear().circle(width * 0.5, height * 0.05, width * 0.42)
        .fill({ color: COLORS.gold, alpha: 0.025 });
      return;
    }
    this.#backdrop.clear().rect(0, 0, width, height).fill({ color: COLORS.background });

    // Fesleğen yeşili seramik duvar, altında ahşap servis tezgâhı.
    const counterY = Math.round(height * 0.76);
    const tile = this.orientation === 'landscape' ? 94 : 80;
    this.#backdrop.rect(0, 0, width, counterY).fill({ color: 0x15251e });
    for (let x = 0; x < width; x += tile) {
      for (let y = 0; y < counterY; y += tile) {
        const tileHeight = Math.min(tile - 4, counterY - y - 2);
        if (tileHeight <= 0) continue;
        this.#backdrop.roundRect(x + 2, y + 2, tile - 4, tileHeight, 5)
          .fill({ color: (x / tile + y / tile) % 2 ? 0x26382b : 0x203127 })
          .stroke({ width: 1, color: COLORS.cream, alpha: 0.055 });
        this.#backdrop.rect(x + 7, y + 7, tile - 14, 2).fill({ color: COLORS.cream, alpha: 0.035 });
      }
    }
    const plankHeight = (height - counterY) / 4;
    for (let i = 0; i < 4; i++) {
      const y = counterY + i * plankHeight;
      this.#backdrop.rect(0, y, width, plankHeight - 2).fill({ color: i % 2 ? COLORS.wood : 0x2e180f });
      for (let grain = 0; grain < 5; grain++) {
        const x = ((i * 131 + grain * 227) % width);
        this.#backdrop.rect(x, y + 8 + grain * plankHeight / 7, 90 + grain * 43, 1)
          .fill({ color: COLORS.cream, alpha: 0.035 });
      }
    }
    this.#backdrop.rect(0, counterY, width, 7).fill({ color: COLORS.copper, alpha: 0.45 })
      .rect(0, counterY + 7, width, 8).fill({ color: 0x110b07, alpha: 0.45 });

    this.#ambient.clear()
      .circle(width * 0.5, height * 0.08, width * 0.42).fill({ color: COLORS.cream, alpha: 0.025 })
      .circle(width * 0.17, height * 0.15, width * 0.18).fill({ color: COLORS.gold, alpha: 0.025 })
      .circle(width * 0.83, height * 0.72, width * 0.28).fill({ color: COLORS.basil, alpha: 0.03 });
  }
}
