// Tohumlanabilir rastgele sayı üretici (mulberry32).
// Aynı seed her zaman aynı sonucu verir: test ve simülasyon için şart.
export function createRng(seed = Date.now() >>> 0) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
