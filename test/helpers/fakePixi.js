// Pixi.js'in tarayıcısız test için çok sade taklidi: sadece GridView/RoundPlayer'ın
// kullandığı yüzey (konum, ölçek, çocuk ekleme/silme, destroy).
class Point {
  constructor(x = 0, y = 0) { this.x = x; this.y = y; }
  set(x, y = x) { this.x = x; this.y = y; }
}

export class Container {
  constructor() {
    this.children = [];
    this.position = new Point();
    this.scale = new Point(1, 1);
    this.pivot = new Point();
    this.alpha = 1;
    this.mask = null;
    this.parent = null;
    this.destroyed = false;
    this.visible = true;
    this.eventMode = 'none';
    this.cursor = 'default';
    this.#handlers = new Map();
  }
  #handlers;
  get x() { return this.position.x; }
  set x(v) { this.position.x = v; }
  get y() { return this.position.y; }
  set y(v) { this.position.y = v; }
  addChild(...items) {
    for (const item of items) { item.parent = this; this.children.push(item); }
    return items[0];
  }
  on(event, fn) {
    if (!this.#handlers.has(event)) this.#handlers.set(event, new Set());
    this.#handlers.get(event).add(fn);
    return this;
  }
  emit(event, ...args) {
    this.#handlers.get(event)?.forEach((fn) => fn(...args));
  }
  destroy() {
    this.destroyed = true;
    this.parent?.children.splice(this.parent.children.indexOf(this), 1);
  }
}

export class Graphics extends Container {
  clear() { return this; }
  roundRect() { return this; }
  rect() { return this; }
  circle() { return this; }
  fill() { return this; }
  stroke() { return this; }
}

export class Text extends Container {
  constructor(opts = {}) {
    super();
    this.text = opts.text ?? '';
    this.anchor = new Point();
  }
}

export class Sprite extends Container {
  constructor(texture) {
    super();
    this.texture = texture;
    this.anchor = new Point();
    this.width = 0;
    this.height = 0;
  }
}

export const Assets = { load: async () => ({ textures: {} }) };

/** Elle sürülen ticker: Animator'a verilir, pump() ile ilerletilir. */
export function createFakeTicker() {
  const fns = [];
  return {
    add: (fn) => fns.push(fn),
    pump: (deltaMS = 1e6) => fns.forEach((fn) => fn({ deltaMS })),
  };
}
