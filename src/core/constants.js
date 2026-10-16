// Görünüm ve akışla ilgili sabitler. Oyun kuralları için bkz. game/config.js

export const CELL = 112; // bir sembol karesinin boyutu (tasarım pikseli)

// Tasarım çözünürlükleri; ResponsiveRoot ekrana sığdırır
export const DESIGN = {
  landscape: { width: 1280, height: 720 },
  portrait: { width: 720, height: 1280 },
};

export const BETS = [1, 2, 5, 10, 20, 50, 100];
export const START_BALANCE = 1000;

export const COLORS = {
  background: 0x0f0b1f,
  panel: 0x1d1740,
  panelEdge: 0x3b2f78,
  gold: 0xffd25a,
  text: 0xffffff,
  textDim: 0xa9a3d4,
  button: 0x4a3f8a,
  spin: 0xd6336c,
  disabled: 0x3a3556,
};

// Animasyon süreleri (ms). Turbo modda Animator bunları hızlandırır.
export const TIMING = {
  columnDelay: 70,    // sütunlar arası gecikme
  dropIn: 460,        // ilk düşüş
  exit: 240,          // eski semboller çıkış
  highlight: 420,     // kazanan sembol vurgusu
  remove: 240,        // patlama
  refill: 380,        // tumble sonrası düşüş
  stepGap: 120,
  collect: 380,       // çarpan toplama
  countUp: 500,       // kazanç sayacı
  spinGap: 350,       // bedava dönüşler arası
  banner: 1100,
};
