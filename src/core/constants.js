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
  background: 0x24140e,
  wood: 0x3a1e13,
  woodLight: 0x61351f,
  panel: 0x432719,
  panelEdge: 0xb86b3c,
  copper: 0xc47743,
  cream: 0xf4dfaf,
  creamDark: 0xd7b977,
  gold: 0xf0c65c,
  tomato: 0xbf3f2e,
  basil: 0x47734a,
  text: 0xfff2d2,
  textDark: 0x35190f,
  textDim: 0xe0bf85,
  button: 0x694027,
  spin: 0xbf3f2e,
  disabled: 0x624333,
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
