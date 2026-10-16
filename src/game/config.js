// ============================================================
//  Mutfak Slot - oyun ayarları (tek yerden ayarlanır)
//  Hücre kodlaması: 0..8 = normal semboller, 100+değer = çarpan
// ============================================================
export const COLS = 5;
export const ROWS = 4;

export const SYM = {
  TOM: 0, GAR: 1, CHI: 2, CAR: 3,   // düşük değerli
  DUM: 4, SUS: 5, STK: 6,           // yüksek değerli
  ONI: 7, MUS: 8,                   // ek düşük değerli (9 sembollü sette)
  WLD: 20,                          // Şef (wild)
  SCT: 21,                          // Altın tencere (scatter)
};

// Geçici görseller: ileride sprite atlas ile değiştirilecek
export const SYMBOL_VIEW = {
  0: { name: 'Domates', emoji: '🍅' },
  1: { name: 'Sarımsak', emoji: '🧄' },
  2: { name: 'Biber', emoji: '🌶️' },
  3: { name: 'Havuç', emoji: '🥕' },
  4: { name: 'Mantı', emoji: '🥟' },
  5: { name: 'Suşi', emoji: '🍣' },
  6: { name: 'Biftek', emoji: '🥩' },
  7: { name: 'Soğan', emoji: '🧅' },
  8: { name: 'Mantar', emoji: '🍄' },
  20: { name: 'Şef (Wild)', emoji: '👨‍🍳' },
  21: { name: 'Altın Tencere (Scatter)', emoji: '🍲' },
  mul: { name: 'Çarpan', emoji: '🔥' },
};

// Sembol seti: 7 veya 9 ödeyen sembol (SYMSET ortam değişkeni ile denenir)
const SYMSET = Number(globalThis.process?.env?.SYMSET ?? 9);

// Ödeme tablosu: bahsın katı olarak, "her yol" başına. [3 makara, 4 makara, 5 makara]
// Toplam ödeme = tablo değeri x yol sayısı
// Ana oyun ve bedava dönüş için ayrı ödeme ölçeği (RTP kalibrasyonu)
export const PAY_SCALE = {
  base: Number(globalThis.process?.env?.PSBASE ?? 9.6),
  free: Number(globalThis.process?.env?.PSFREE ?? 8.6),
};
const PAY7 = {
  [SYM.TOM]: [1.0, 3.2, 9.6], [SYM.GAR]: [1.2, 4.0, 12], [SYM.CHI]: [1.4, 4.8, 14.4],
  [SYM.CAR]: [1.6, 5.6, 17.6], [SYM.DUM]: [3.2, 12, 36], [SYM.SUS]: [6, 22.4, 72], [SYM.STK]: [12, 44, 144],
};
const PAY9 = {
  [SYM.TOM]: [1.0, 3.2, 9.6], [SYM.GAR]: [1.2, 4.0, 12], [SYM.CHI]: [1.4, 4.8, 14.4],
  [SYM.CAR]: [1.6, 5.6, 17.6], [SYM.ONI]: [1.8, 6.4, 19.2], [SYM.MUS]: [2.0, 7.2, 21.6],
  [SYM.DUM]: [3.2, 12, 36], [SYM.SUS]: [6, 22.4, 72], [SYM.STK]: [12, 44, 144],
};
const RAWPAY = SYMSET === 7 ? PAY7 : PAY9;
// tablo değerleri "bahsın binde biri" biriminde yazıldı
export const PAY = Object.fromEntries(
  Object.entries(RAWPAY).map(([k, v]) => [k, v.map((x) => x / 1000)])
);
export const PAY_SYMBOLS = Object.keys(PAY).map(Number);

// Sembol ağırlıkları (hücre başına). Wild sadece 2-4. makarada çıkar.
const W7 = { 0: 20, 1: 18, 2: 16, 3: 14, 4: 9, 5: 6, 6: 4 };
const W9 = { 0: 14, 1: 13, 2: 12, 3: 11, 7: 10, 8: 9, 4: 7, 5: 5, 6: 3.5 };
const ENV = globalThis.process?.env ?? {};
const SPECIAL = { 20: Number(ENV.WILDW ?? 3), 21: Number(ENV.SCTW ?? 1.65) };
const BASEW = SYMSET === 7 ? W7 : W9;
export const WEIGHTS = {
  base: { ...BASEW, ...SPECIAL, mul: 1.2 },
  free: { ...BASEW, ...SPECIAL, mul: Number(ENV.FREEMUL ?? 12) },
};
export const WILD_REELS = [1, 2, 3];

// Çarpan değerleri ve ağırlıkları (normal / bedava dönüş)
export const MULTS = [
  { v: 2,   base: 40,   free: 14 },
  { v: 3,   base: 25,   free: 15 },
  { v: 4,   base: 15,   free: 14 },
  { v: 5,   base: 8,    free: 12 },
  { v: 6,   base: 5,    free: 10 },
  { v: 8,   base: 3,    free: 9 },
  { v: 10,  base: 2,    free: 8 },
  { v: 15,  base: 1,    free: 6 },
  { v: 25,  base: 0.5,  free: 4 },
  { v: 50,  base: 0.2,  free: 2 },
  { v: 100, base: 0.05, free: 1 },
];

export const RULES = {
  minWayLength: 3,
  scatterTrigger: 3,
  freeSpins: 10,
  retriggerSpins: 5,
  maxWin: 1000,        // bahsın katı
  buyCost: 100,        // bahsın katı
  maxTumbles: 60,      // güvenlik sınırı
  maxFreeSpins: 200,   // güvenlik sınırı
};
