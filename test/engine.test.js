import test from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../src/game/rng.js';
import { playSpin, playRound, playSpinFromGrid, mulCell, isMul } from '../src/game/engine.js';
import { SYM, COLS, ROWS, RULES, PAY_SYMBOLS, getSymbolPays } from '../src/game/config.js';

test('aynı seed aynı sonucu verir', () => {
  const a = playRound(createRng(7), { record: true });
  const b = playRound(createRng(7), { record: true });
  assert.deepEqual(a, b);
});

test('kaydedilen adımlar kazançla tutarlı: sum(stepWin) = raw, win = raw x çarpan', () => {
  const rng = createRng(42);
  let checked = 0;
  for (let i = 0; i < 20000; i++) {
    const s = playSpin(rng, 'base', 0, true);
    const sum = s.steps.reduce((a, st) => a + st.stepWin, 0);
    assert.ok(Math.abs(sum - s.raw) < 1e-9);
    assert.ok(Math.abs(s.win - s.raw * s.appliedMult) < 1e-9);
    if (s.steps.length > 1) checked++;
  }
  assert.ok(checked > 100, 'tumble zincirleri test edilmeli');
});

test('her adımda: kalan semboller düşer, grid boyutu korunur, yeniler üstte', () => {
  const rng = createRng(99);
  for (let i = 0; i < 5000; i++) {
    const s = playSpin(rng, 'base', 0, true);
    for (const st of s.steps) {
      assert.equal(st.nextGrid.length, COLS);
      for (let c = 0; c < COLS; c++) {
        assert.equal(st.nextGrid[c].length, ROWS);
        const kept = st.grid[c].filter((_, r) => !st.removed[c][r]);
        const tail = st.nextGrid[c].slice(ROWS - kept.length);
        assert.deepEqual(tail, kept, 'kalanlar altta aynı sırayla durmalı');
      }
    }
    // zincir bitişinde kazanç kalmamalı
    if (s.finalGrid) {
      for (const st of s.steps) assert.ok(st.stepWin > 0);
    }
  }
});

test('çarpan yalnızca kazanç varsa uygulanır; kazanç yoksa win = 0', () => {
  const rng = createRng(5);
  for (let i = 0; i < 20000; i++) {
    const s = playSpin(rng, 'base', 0, false);
    if (s.raw === 0) { assert.equal(s.win, 0); assert.equal(s.appliedMult, 1); }
    else assert.equal(s.appliedMult, Math.max(1, s.multSum));
  }
});

test('bedava dönüşte çarpan birikir ve asla azalmaz', () => {
  const rng = createRng(11);
  let prev = 0;
  for (let i = 0; i < 3000; i++) {
    const s = playSpin(rng, 'free', prev, false);
    assert.ok(s.freeMult >= prev);
    prev = s.freeMult;
    if (i % 25 === 24) prev = 0;
  }
});

test('çarpan hücresi kodlaması', () => {
  assert.ok(isMul(mulCell(2)));
  assert.ok(!isMul(SYM.SCT));
  assert.ok(!isMul(SYM.WLD));
});

test('tavan: hiçbir tur 1000x geçmez; satın alma bonus dönüş sayısı >= 10', () => {
  const rng = createRng(2024);
  for (let i = 0; i < 20000; i++) {
    const r = playRound(rng);
    assert.ok(r.total <= RULES.maxWin + 1e-9);
  }
  for (let i = 0; i < 2000; i++) {
    const r = playRound(rng, { buy: true });
    assert.ok(r.freeTriggered);
    assert.ok(r.freeCount >= 1);
    assert.ok(r.total <= RULES.maxWin + 1e-9);
  }
});

test('ways hesabı: elle kurulan gridde beklenen ödeme', () => {
  // Domates: 1. makarada 2, 2. makarada 1 (+1 wild), 3. makarada 1, 4. makarada yok
  // yol sayısı = 2 x 2 x 1 = 4, uzunluk 3
  const T = SYM.TOM, X = SYM.SCT;
  const grid = [
    [T, T, X, X],
    [T, SYM.WLD, X, X],
    [X, X, X, T],
    [X, X, X, X],
    [X, X, X, X],
  ];
  const res = playSpinFromGrid(grid, 'base');
  const expected = 0.01 * 4;
  assert.ok(Math.abs(res.pay - expected) < 1e-9, `${res.pay} vs ${expected}`);
  assert.equal(res.wins[0].ways, 4);
  assert.equal(res.wins[0].length, 3);
});

test('ödeme tablosundaki iki basamaklı katsayılar her iki modda da doğrudan uygulanır', () => {
  for (const mode of ['base', 'free']) {
    for (const symbol of PAY_SYMBOLS) {
      const pays = getSymbolPays(symbol, mode);
      assert.equal(pays.length, 3);
      for (let index = 0; index < pays.length; index++) {
        const pay = pays[index];
        assert.ok(pay > 0);
        assert.ok(Math.abs(pay * 100 - Math.round(pay * 100)) < 1e-9, 'en fazla iki ondalık basamak');
        if (index) assert.ok(pay > pays[index - 1], 'daha uzun eşleşme daha fazla ödemeli');
        const length = RULES.minWayLength + index;
        const grid = Array.from({ length: COLS }, (_, col) =>
          col < length ? [symbol, SYM.SCT, SYM.SCT, SYM.SCT] : Array(ROWS).fill(SYM.SCT));
        const result = playSpinFromGrid(grid, mode);
        assert.equal(result.wins.length, 1);
        assert.equal(result.wins[0].ways, 1);
        assert.equal(result.pay, pay, 'tabloda görünen değer dışında ölçek uygulanmamalı');
      }
    }
  }
  // Beş makarada dört sarımsak yolu: ana oyun 4 × 0,12, bonus 4 × 0,10.
  const G = SYM.GAR, X = SYM.SCT;
  const garlicGrid = [[G, G, X, X], [G, G, X, X], [G, X, X, X], [G, X, X, X], [G, X, X, X]];
  assert.equal(playSpinFromGrid(garlicGrid, 'base').pay, 0.48);
  assert.equal(playSpinFromGrid(garlicGrid, 'free').pay, 0.40);
});
