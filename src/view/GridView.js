import { Container, Graphics } from 'pixi.js';
import { COLS, ROWS } from '../game/config.js';
import { isMul } from '../game/engine.js';
import { CELL, COLORS, TIMING } from '../core/constants.js';
import { easeInQuad, easeOutBack, easeOutQuad, easeInBack } from '../animation/easing.js';
import { SymbolView } from './SymbolView.js';

const WIDTH = COLS * CELL;
const HEIGHT = ROWS * CELL;
const ORIGIN = { landscape: { x: 360, y: 105 }, portrait: { x: 80, y: 250 } };

// 5x4 sembol ızgarası. Sadece "ne gösterilecek" ile ilgilenir;
// oyunun sonucunu hesaplamaz, motorun ürettiği adımları oynatır.
export class GridView extends Container {
  #animator;
  #layer = new Container();
  /** @type {(SymbolView|null)[][]} [kolon][satır] */
  #symbols = [];

  constructor(animator) {
    super();
    this.#animator = animator;

    const panel = new Graphics()
      .roundRect(-16, -16, WIDTH + 32, HEIGHT + 32, 24)
      .fill({ color: COLORS.panel })
      .stroke({ width: 4, color: COLORS.panelEdge });
    const mask = new Graphics().rect(0, 0, WIDTH, HEIGHT).fill({ color: 0xffffff });
    this.#layer.mask = mask;
    this.addChild(panel, this.#layer, mask);
  }

  layout(orientation) {
    this.position.set(ORIGIN[orientation].x, ORIGIN[orientation].y);
  }

  // ---------- Dışarıya açılan akışlar ----------

  /** Eski sembolleri aşağı indirir, yeni ızgarayı yukarıdan düşürür. */
  async dropIn(grid) {
    await this.#exit();
    const falls = [];
    this.#symbols = grid.map((column, c) =>
      column.map((cell, r) => {
        const view = this.#spawn(cell, c, r, this.#cellY(r) - (ROWS + 1) * CELL);
        const delay = c * TIMING.columnDelay + (ROWS - 1 - r) * 35;
        falls.push(this.#animator.wait(delay).then(() => this.#fall(view, this.#cellY(r), TIMING.dropIn)));
        return view;
      }),
    );
    await Promise.all(falls);
  }

  /** Bir tumble adımını oynatır: vurgula -> patlat -> düşür -> doldur. */
  async playStep(step, onCollect) {
    const cells = this.#cellsWhere((c, r) => step.removed[c][r]);
    await Promise.all(cells.map(({ view }) => this.#pulse(view, isMul(view.cell) ? 1.35 : 1.18)));

    step.collected.forEach((m) => onCollect?.(m.value));
    await this.#vanish(cells);
    await this.#settle(step.nextGrid);
    await this.#animator.wait(TIMING.stepGap);
  }

  /** Zincir sonunda ızgarada kalan çarpanları toplar. */
  async collectCells(collected, onCollect) {
    const cells = collected.map(({ col, row }) => ({ col, row, view: this.#symbols[col][row] }));
    await Promise.all(cells.map(({ view }) => this.#pulse(view, 1.35)));
    collected.forEach((m) => onCollect?.(m.value));
    await this.#vanish(cells);
  }

  /** Koşula uyan sembolleri vurgular (örn. scatter tetiklemesi). */
  async pulseWhere(predicate) {
    const cells = this.#cellsWhere((c, r) => predicate(this.#symbols[c][r].cell));
    await Promise.all(cells.map(({ view }) => this.#pulse(view, 1.3)));
  }

  // ---------- Özel yardımcılar ----------

  #cellY = (row) => row * CELL + CELL / 2;
  #cellX = (col) => col * CELL + CELL / 2;

  #spawn(cell, col, row, y) {
    const view = new SymbolView(cell);
    view.position.set(this.#cellX(col), y);
    this.#layer.addChild(view);
    return view;
  }

  #fall(view, targetY, duration, ease = (t) => easeOutBack(t, 0.7)) {
    return this.#animator.tween(view, { y: targetY }, duration, ease);
  }

  async #pulse(view, peak) {
    await this.#animator.tween(view, { scale: peak }, TIMING.highlight / 2, easeOutQuad);
    await this.#animator.tween(view, { scale: 1 }, TIMING.highlight / 2, easeInQuad);
  }

  #cellsWhere(predicate) {
    const out = [];
    for (let c = 0; c < COLS; c++)
      for (let r = 0; r < ROWS; r++) if (this.#symbols[c]?.[r] && predicate(c, r)) out.push({ col: c, row: r, view: this.#symbols[c][r] });
    return out;
  }

  async #vanish(cells) {
    await Promise.all(
      cells.map(({ view }) => this.#animator.tween(view, { scale: 0, alpha: 0 }, TIMING.remove, (t) => easeInBack(t, 1.2))),
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
        falls.push(this.#fall(view, this.#cellY(i), this.#fallTime(fresh)));
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
    await Promise.all(
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
