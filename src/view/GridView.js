import { Container, Graphics } from 'pixi.js';
import { COLS, ROWS, SYM } from '../game/config.js';
import { isMul } from '../game/engine.js';
import { CELL, TIMING } from '../core/constants.js';
import { easeInQuad, easeOutBack, easeOutQuad, easeInBack } from '../animation/easing.js';
import { SymbolView } from './SymbolView.js';

const WIDTH = COLS * CELL;
const HEIGHT = ROWS * CELL;
const ORIGIN = { landscape: { x: 340, y: 140 }, portrait: { x: 80, y: 205 } };

// 5x4 sembol ızgarası. Sadece "ne gösterilecek" ile ilgilenir;
// oyunun sonucunu hesaplamaz, motorun ürettiği adımları oynatır.
export class GridView extends Container {
  #animator;
  #layer = new Container();
  #particles = new Container();
  #reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
  /** @type {(SymbolView|null)[][]} [kolon][satır] */
  #symbols = [];

  constructor(animator) {
    super();
    this.#animator = animator;

    const panel = new Graphics()
      // Same forest surface and fine champagne edge as the controls.
      .roundRect(-27, -22, WIDTH + 54, HEIGHT + 54, 26)
      .fill({ color: 0x080e0b, alpha: 0.6 })
      .roundRect(-24, -28, WIDTH + 48, HEIGHT + 52, 23)
      .fill({ color: 0x101b17, alpha: 0.97 })
      .stroke({ width: 1.5, color: 0xbda675, alpha: 0.72 })
      .roundRect(-20, -24, WIDTH + 40, HEIGHT + 44, 20)
      .stroke({ width: 1, color: 0xf4f0e5, alpha: 0.08 })
      .roundRect(-10, -14, WIDTH + 20, HEIGHT + 24, 14)
      .fill({ color: 0x080e0b, alpha: 0.9 })
      .stroke({ width: 1, color: 0xbda675, alpha: 0.23 })
      .roundRect(-4, -8, WIDTH + 8, HEIGHT + 12, 10)
      .fill({ color: 0x152019, alpha: 0.9 });
    for (let col = 1; col < COLS; col++)
      panel.rect(col * CELL - 0.5, 0, 1, HEIGHT).fill({ color: 0xf4f0e5, alpha: 0.065 });
    for (let row = 1; row < ROWS; row++)
      panel.rect(0, row * CELL - 0.5, WIDTH, 1).fill({ color: 0xf4f0e5, alpha: 0.045 });
    const mask = new Graphics().rect(0, 0, WIDTH, HEIGHT).fill({ color: 0xffffff });
    this.#layer.mask = mask;
    this.#particles.mask = mask;
    this.addChild(panel, this.#layer, this.#particles, mask);
  }

  layout(orientation) {
    this.position.set(ORIGIN[orientation].x, ORIGIN[orientation].y);
  }

  /** Dekoratif açılış vitrini; oyun RNG'sini ve bakiyeyi kullanmaz. */
  showPreview() {
    if (this.#symbols.length) return;
    const ingredients = [SYM.TOM, SYM.GAR, SYM.CHI, SYM.CAR, SYM.ONI, SYM.MUS, SYM.DUM, SYM.SUS, SYM.STK];
    this.#symbols = Array.from({ length: COLS }, (_, c) =>
      Array.from({ length: ROWS }, (_, r) => this.#spawn(ingredients[(c * 3 + r) % ingredients.length], c, r, this.#cellY(r))));
  }

  // ---------- Dışarıya açılan akışlar ----------

  /** Eski sembolleri aşağı indirir, yeni ızgarayı yukarıdan düşürür. */
  async dropIn(grid) {
    await this.#exit();
    const falls = [];
    this.#symbols = grid.map((column, c) =>
      column.map((cell, r) => {
        const view = this.#spawn(cell, c, r, this.#cellY(r) - (ROWS + 1) * CELL);
        const delay = this.#reducedMotion ? 0 : c * TIMING.columnDelay + (ROWS - 1 - r) * 35;
        falls.push(this.#animator.wait(delay)
          .then(() => this.#fall(view, this.#cellY(r), TIMING.dropIn))
          .then(() => this.#specialLanding(view)));
        return view;
      }),
    );
    await Promise.all(falls);
  }

  /** Bir tumble adımını oynatır: vurgula -> patlat -> düşür -> doldur. */
  async playStep(step, onCollect) {
    const cells = this.#cellsWhere((c, r) => step.removed[c][r]);
    await this.#focusCells(cells, 1.12);

    this.#burstCells(cells);
    step.collected.forEach((m) => onCollect?.(m.value, this.#cellPosition(m.col, m.row)));
    await this.#vanish(cells);
    await this.#settle(step.nextGrid);
    await this.#animator.wait(TIMING.stepGap);
  }

  /** Zincir sonunda ızgarada kalan çarpanları toplar. */
  async collectCells(collected, onCollect) {
    const cells = collected.map(({ col, row }) => ({ col, row, view: this.#symbols[col][row] }));
    await this.#focusCells(cells, 1.18);
    this.#burstCells(cells);
    collected.forEach((m) => onCollect?.(m.value, this.#cellPosition(m.col, m.row)));
    await this.#vanish(cells);
  }

  /** Koşula uyan sembolleri vurgular (örn. scatter tetiklemesi). */
  async pulseWhere(predicate) {
    const cells = this.#cellsWhere((c, r) => predicate(this.#symbols[c][r].cell));
    await this.#focusCells(cells, 1.16);
  }

  // ---------- Özel yardımcılar ----------

  #cellY = (row) => row * CELL + CELL / 2;
  #cellX = (col) => col * CELL + CELL / 2;
  #cellPosition = (col, row) => ({ x: this.x + this.#cellX(col), y: this.y + this.#cellY(row) });

  #specialLanding(view) {
    if (this.#reducedMotion) return Promise.resolve();
    if (view.cell === SYM.SCT) return this.#pulse(view, 1.14);
    if (view.cell !== SYM.WLD) return Promise.resolve();
    const direction = view.x % 2 ? 1 : -1;
    return this.#animator.tween(view, { rotation: direction * 0.12 }, 130, easeOutQuad)
      .then(() => this.#animator.tween(view, { rotation: 0 }, 180, easeInQuad));
  }

  #burstCells(cells) {
    if (this.#reducedMotion) return;
    for (const { col, row, view } of cells) {
      const color = isMul(view.cell) || view.cell === SYM.SCT ? 0xdfc58a
        : view.cell === SYM.WLD ? 0xc2dbb3 : 0xe7dcc2;
      const origin = { x: this.#cellX(col), y: this.#cellY(row) };
      const ring = new Graphics().circle(0, 0, 29).stroke({ width: 1.6, color, alpha: 0.8 });
      ring.position.set(origin.x, origin.y);
      this.#particles.addChild(ring);
      this.#animator.tween(ring, { scale: 1.75, alpha: 0 }, 300, easeOutQuad)
        .then(() => ring.destroy({ children: true }));
      for (let i = 0; i < 5; i++) {
        const angle = (Math.PI * 2 * i) / 5 + Math.random() * 0.18;
        const distance = 24 + Math.random() * 24;
        const particle = new Graphics().circle(0, 0, 1.5 + Math.random() * 1.5).fill({ color });
        particle.position.set(origin.x, origin.y);
        particle.alpha = 0.9;
        particle.scale.set(0.7);
        this.#particles.addChild(particle);
        this.#animator.tween(particle, {
          x: origin.x + Math.cos(angle) * distance,
          y: origin.y + Math.sin(angle) * distance,
          scale: 0,
          alpha: 0,
        }, 260 + Math.random() * 130, easeOutQuad)
          .then(() => particle.destroy({ children: true }));
      }
    }
  }

  #spawn(cell, col, row, y) {
    const view = new SymbolView(cell);
    view.position.set(this.#cellX(col), y);
    this.#layer.addChild(view);
    return view;
  }

  async #fall(view, targetY, duration, ease = (t) => easeOutBack(t, 0.35)) {
    if (this.#reducedMotion) { view.y = targetY; return; }
    await this.#animator.tween(view, { y: targetY }, duration, ease);
    // İnişte kısa bir esneme: hücre konumu ve motorun ızgarası sabit kalır.
    await this.#animator.tween(view.scale, { x: 1.055, y: 0.91 }, 55, easeOutQuad);
    await this.#animator.tween(view.scale, { x: 1, y: 1 }, 125, (t) => easeOutBack(t, 0.8));
  }

  async #pulse(view, peak) {
    if (this.#reducedMotion) { await this.#animator.wait(TIMING.highlight * 0.65); return; }
    await this.#animator.tween(view, { scale: peak }, TIMING.highlight / 2, easeOutQuad);
    await this.#animator.tween(view, { scale: 1 }, TIMING.highlight / 2, easeInQuad);
  }

  /** A readable, short hold separates the winning cells from the next tumble. */
  async #focusCells(cells, peak) {
    if (!cells.length) return;
    const selected = new Set(cells.map(({ view }) => view));
    const muted = this.#symbols.flat().filter(view => view && !selected.has(view));
    const highlights = cells.map(({ col, row }) => {
      const light = new Graphics()
        .roundRect(-CELL / 2 + 6, -CELL / 2 + 6, CELL - 12, CELL - 12, 14)
        .fill({ color: 0xdfc58a, alpha: 0.06 })
        .stroke({ color: 0xdfc58a, width: 2, alpha: 0.8 })
        .roundRect(-CELL / 2 + 9, -CELL / 2 + 9, CELL - 18, CELL - 18, 11)
        .stroke({ color: 0xf4f0e5, width: 1, alpha: 0.18 });
      light.position.set(this.#cellX(col), this.#cellY(row));
      this.#particles.addChild(light);
      return light;
    });
    const previousAlpha = muted.map(view => view.alpha);
    muted.forEach(view => { view.alpha *= 0.48; });
    try {
      await Promise.all(cells.map(({ view }) => this.#pulse(view, peak)));
    } finally {
      muted.forEach((view, i) => { if (!view.destroyed) view.alpha = previousAlpha[i]; });
      highlights.forEach(light => light.destroy({ children: true }));
    }
  }

  #cellsWhere(predicate) {
    const out = [];
    for (let c = 0; c < COLS; c++)
      for (let r = 0; r < ROWS; r++) if (this.#symbols[c]?.[r] && predicate(c, r)) out.push({ col: c, row: r, view: this.#symbols[c][r] });
    return out;
  }

  async #vanish(cells) {
    await Promise.all(
      cells.map(({ view }) => this.#animator.tween(view, this.#reducedMotion ? { alpha: 0 } : { scale: 0, alpha: 0 },
        this.#reducedMotion ? 0 : TIMING.remove, (t) => easeInBack(t, 1.2))),
    );
    for (const { col, row, view } of cells) {
      view.destroy({ children: true });
      this.#symbols[col][row] = null;
    }
  }

  /** Kalan sembolleri aşağı kaydırır, boşluklara yukarıdan yenilerini düşürür. */
  async #settle(nextGrid) {
    const falls = [];
    for (let c = 0; c < COLS; c++) {
      const survivors = this.#symbols[c].filter(Boolean);
      const fresh = ROWS - survivors.length;
      const column = new Array(ROWS).fill(null);

      survivors.forEach((view, i) => {
        const row = fresh + i;
        column[row] = view;
        const rowsMoved = (this.#cellY(row) - view.y) / CELL;
        if (rowsMoved > 0.01) falls.push(this.#fall(view, this.#cellY(row), this.#fallTime(rowsMoved)));
      });
      for (let i = 0; i < fresh; i++) {
        const view = this.#spawn(nextGrid[c][i], c, i, -(fresh - i) * CELL + CELL / 2);
        column[i] = view;
        falls.push(this.#fall(view, this.#cellY(i), this.#fallTime(fresh))
          .then(() => this.#specialLanding(view)));
      }
      this.#symbols[c] = column;
    }
    await Promise.all(falls);
    this.#verify(nextGrid);
  }

  #fallTime(rows) {
    return TIMING.refill * Math.min(1, 0.55 + 0.15 * rows);
  }

  async #exit() {
    const views = this.#symbols.flatMap((col, c) => col.filter(Boolean).map((view) => ({ view, c })));
    if (!views.length) return;
    if (!this.#reducedMotion) await Promise.all(
      views.map(({ view, c }) =>
        this.#animator
          .wait(c * TIMING.columnDelay * 0.5)
          .then(() => this.#animator.tween(view, { y: view.y + (ROWS + 1) * CELL }, TIMING.exit, easeInQuad)),
      ),
    );
    views.forEach(({ view }) => view.destroy({ children: true }));
    this.#symbols = [];
  }

  /** Geliştirme güvencesi: ekrandaki semboller motorun ızgarasıyla aynı mı? */
  #verify(expected) {
    for (let c = 0; c < COLS; c++)
      for (let r = 0; r < ROWS; r++)
        if (this.#symbols[c][r]?.cell !== expected[c][r])
          console.warn(`GridView: [${c},${r}] beklenen ${expected[c][r]}, görünen ${this.#symbols[c][r]?.cell}`);
  }
}
