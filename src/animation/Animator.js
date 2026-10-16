import { linear } from './easing.js';

const read = (target, key) => (key === 'scale' ? target.scale.x : target[key]);
const write = (target, key, value) => {
  if (key === 'scale') target.scale.set(value);
  else target[key] = value;
};

// Promise tabanlı tween yöneticisi. Tek bir ticker üzerinden çalışır.
// "await animator.tween(...)" ile animasyonlar sırayla yazılabilir.
export class Animator {
  #tweens = new Set();
  #segment = null;
  speed = 1;

  constructor(ticker) {
    ticker.add((t) => this.#update(t.deltaMS));
  }

  setTurbo(on) {
    this.speed = on ? 2.4 : 1;
  }

  /** Yalnızca o dönüşün mevcut ve sonradan zincirlenen animasyonlarını kapsar. */
  beginSegment() {
    const segment = { fast: false };
    this.#segment = segment;
    return segment;
  }

  fastForwardSegment(segment = this.#segment) {
    if (!segment || segment !== this.#segment || segment.fast) return false;
    segment.fast = true;
    for (const tw of this.#tweens) this.#finish(tw);
    return true;
  }

  endSegment(segment = this.#segment) {
    if (segment && segment === this.#segment) this.#segment = null;
  }

  /**
   * target'ın özelliklerini `to` değerlerine süre boyunca götürür.
   * 'scale' anahtarı tekdüze ölçek için kullanılır. onUpdate her karede çağrılır.
   */
  tween(target, to, duration, ease = linear, onUpdate = null) {
    return new Promise((resolve, reject) => {
      const from = {};
      for (const key of Object.keys(to)) from[key] = read(target, key);
      if (duration <= 0 || this.#segment?.fast) {
        if (!target.destroyed) {
          for (const key of Object.keys(to)) write(target, key, to[key]);
          onUpdate?.();
        }
        resolve();
        return;
      }
      this.#tweens.add({ target, from, to, duration, elapsed: 0, ease, resolve, reject, onUpdate });
    });
  }

  wait(ms) {
    return this.tween({}, {}, ms);
  }

  #finish(tw) {
    this.#tweens.delete(tw);
    try {
      if (!tw.target.destroyed) {
        for (const key of Object.keys(tw.to)) write(tw.target, key, tw.to[key]);
        tw.onUpdate?.();
      }
      tw.resolve();
    } catch (error) {
      tw.reject(error);
    }
  }

  #update(deltaMS) {
    const dt = deltaMS * this.speed;
    for (const tw of this.#tweens) {
      if (tw.target.destroyed) {
        this.#tweens.delete(tw);
        tw.resolve();
        continue;
      }
      tw.elapsed += dt;
      const t = Math.min(1, tw.elapsed / tw.duration);
      const k = tw.ease(t);
      for (const key of Object.keys(tw.to)) write(tw.target, key, tw.from[key] + (tw.to[key] - tw.from[key]) * k);
      tw.onUpdate?.();
      if (t >= 1) {
        this.#tweens.delete(tw);
        tw.resolve();
      }
    }
  }
}
