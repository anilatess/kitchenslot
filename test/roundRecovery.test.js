import test from 'node:test';
import assert from 'node:assert/strict';
import { GameState } from '../src/core/GameState.js';
import { START_BALANCE } from '../src/core/constants.js';
import { playRound } from '../src/game/engine.js';
import { createRng } from '../src/game/rng.js';
import { RULES } from '../src/game/config.js';

const key = 'mutfak-slot.state.v1';
const makeRound = () => playRound(createRng(77), { record: true, buy: true });

function storage(initial = null) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  let saved = initial;
  const control = { reject: false, writes: 0 };
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (readKey) => { assert.equal(readKey, key); return saved; },
    setItem: (writeKey, value) => {
      assert.equal(writeKey, key);
      if (control.reject) throw new Error('kota');
      control.writes++;
      saved = value;
    },
  } });
  return { control, read: () => saved, restore: () => {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else delete globalThis.localStorage;
  } };
}

test('kayıtlı bonus yenilemede aynı bahis ve tamamlanan dönüşten devam eder; resmi ödeme yalnızca bir kez yapılır', () => {
  const store = storage();
  try {
    const state = new GameState();
    const round = makeRound();
    const bet = state.bet;
    const pending = state.beginRound(round, { buy: true });
    assert.equal(store.control.writes, 1, 'kesinti ve tam sonuç tek yazıda saklanır');
    assert.notEqual(pending.round, round, 'sonuç motorun değiştirilebilir nesnesinden ayrılır');
    assert.equal(state.balance, START_BALANCE - bet * RULES.buyCost);
    state.checkpointRound(4);
    const reloaded = new GameState();
    assert.equal(reloaded.balance, state.balance, 'ikinci kesinti yok');
    assert.equal(reloaded.canSpin, false, 'bekleyen tur varken yeni bahis açılamaz');
    assert.deepEqual(reloaded.pendingRound, { ...pending, round, bet, nextSpin: 4 });
    const payout = reloaded.settleRound();
    assert.equal(payout, round.total * bet);
    const finalBalance = START_BALANCE - bet * RULES.buyCost + payout;
    assert.equal(reloaded.balance, finalBalance);
    assert.equal(reloaded.settleRound(), 0);
    assert.equal(reloaded.balance, finalBalance);
    const settledReload = new GameState();
    assert.equal(settledReload.pendingRound, null);
    assert.equal(settledReload.balance, finalBalance);
    assert.equal(settledReload.settleRound(), 0);
  } finally { store.restore(); }
});

test('ana dönüş ve bonus kesintileri farklıdır; bekleyen tur bahis veya demo bakiye sıfırlamasıyla değiştirilemez', () => {
  const store = storage();
  try {
    const state = new GameState();
    const round = makeRound();
    state.beginRound(round);
    assert.equal(state.balance, START_BALANCE - state.bet);
    const before = state.balance;
    state.changeBet(1);
    state.resetBalance();
    assert.equal(state.bet, 2);
    assert.equal(state.balance, before);
    assert.throws(() => state.beginRound(round), /bekleyen tur/);
    assert.throws(() => state.debit(1), /Geçersiz/);
    assert.throws(() => state.credit(1), /Geçersiz/);
    assert.throws(() => state.checkpointRound(round.spins.length + 1), /ilerlemesi/);
    state.checkpointRound(2);
    assert.throws(() => state.checkpointRound(1), /ilerlemesi/);
  } finally { store.restore(); }
});

test('tavanı aşan ham dönüş toplamı yerine kayıtlı resmi maksimum kazanç ödenir', () => {
  const store = storage();
  try {
    const round = makeRound();
    round.spins[0].win = RULES.maxWin + 500;
    round.total = RULES.maxWin;
    round.capped = true;
    const state = new GameState();
    state.beginRound(round);
    assert.equal(state.settleRound(), RULES.maxWin * state.bet);
    assert.equal(state.balance, START_BALANCE - state.bet + RULES.maxWin * state.bet);
  } finally { store.restore(); }
});

test('depolama yeni turu reddederse kesinti ve bekleyen tur oluşmaz', () => {
  const store = storage(JSON.stringify({ balance: 800, betIndex: 1, turbo: false }));
  try {
    const state = new GameState();
    const before = store.read();
    store.control.reject = true;
    assert.throws(() => state.beginRound(makeRound()), /kaydedilemedi/);
    assert.equal(state.balance, 800);
    assert.equal(state.pendingRound, null);
    assert.equal(store.read(), before);
    assert.doesNotThrow(() => state.toggleTurbo(), 'tercihler depolama engelinde çalışır');
  } finally { store.restore(); }
});

test('kontrol noktası veya ödeme yazısı reddedilirse önceki kayıt kalır ve tekrar ödeme çift sayılmaz', () => {
  const store = storage();
  try {
    const state = new GameState();
    state.beginRound(makeRound(), { buy: true });
    state.checkpointRound(2);
    const before = state.balance;
    store.control.reject = true;
    assert.throws(() => state.checkpointRound(3), /kaydedilemedi/);
    assert.equal(state.pendingRound.nextSpin, 2);
    assert.equal(new GameState().pendingRound.nextSpin, 2);
    assert.throws(() => state.settleRound(), /kaydedilemedi/);
    assert.equal(state.balance, before);
    assert.ok(state.pendingRound);
    store.control.reject = false;
    const recovered = new GameState();
    const payout = recovered.pendingRound.round.total * recovered.pendingRound.bet;
    assert.equal(recovered.settleRound(), payout);
    assert.equal(recovered.balance, before + payout);
    assert.equal(new GameState().balance, before + payout);
    assert.equal(recovered.settleRound(), 0);
  } finally { store.restore(); }
});

test('eski kayıtlar açılır; bozuk tur kaydı ödeme veya animasyon için kabul edilmez', () => {
  const legacy = storage(JSON.stringify({ balance: 125, betIndex: 2, turbo: true }));
  try {
    const state = new GameState();
    assert.equal(state.pendingRound, null);
    assert.equal(state.balance, 125);
    assert.equal(state.bet, 5);
    assert.equal(state.turbo, true);
  } finally { legacy.restore(); }
  const round = makeRound();
  for (const corrupt of [
    null,
    { round, bet: 3, nextSpin: 0 },
    { round, bet: 2, nextSpin: -1 },
    { round, bet: 2, nextSpin: round.spins.length + 1 },
    { round: { ...round, total: RULES.maxWin + 1 }, bet: 2, nextSpin: 0 },
    { round: { ...round, total: round.total + 0.5 }, bet: 2, nextSpin: 0 },
    { round: { ...round, spins: [{ ...round.spins[0], initialGrid: [] }] }, bet: 2, nextSpin: 0 },
    { round: { ...round, spins: [] }, bet: 2, nextSpin: 0 },
  ]) {
    const store = storage(JSON.stringify({ balance: 125, betIndex: 1, pendingRound: corrupt }));
    try {
      const state = new GameState();
      assert.equal(state.pendingRound, null);
      assert.equal(state.settleRound(), 0);
      assert.equal(state.balance, 125);
    } finally { store.restore(); }
  }
});

test('depolama yokken tur başlatma güvenli biçimde reddedilir, başlangıç bakiyesi korunur', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  delete globalThis.localStorage;
  try {
    const state = new GameState();
    assert.throws(() => state.beginRound(makeRound()), /kaydedilemedi/);
    assert.equal(state.balance, START_BALANCE);
    assert.equal(state.pendingRound, null);
  } finally { if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor); }
});

test('eski sekmenin turbo ve bahis tercihleri yeni turun kesintisini veya sonucunu ezemez', () => {
  const store = storage();
  try {
    const active = new GameState();
    const stale = new GameState();
    const round = makeRound();
    active.beginRound(round, { buy: true });
    const balance = active.balance;
    stale.toggleTurbo();
    stale.changeBet(1);
    assert.equal(stale.balance, balance);
    assert.equal(stale.bet, active.bet);
    assert.ok(stale.pendingRound);
    const reloaded = new GameState();
    assert.equal(reloaded.balance, balance);
    assert.deepEqual(reloaded.pendingRound.round, round);
    assert.equal(reloaded.turbo, true);
  } finally { store.restore(); }
});

test('iki eski durum nesnesi aynı turu kapatsa da ödeme ve geçmiş yalnızca bir kez yazılır', () => {
  const store = storage();
  try {
    const first = new GameState();
    first.beginRound(makeRound(), { buy: true });
    const second = new GameState();
    const pending = first.pendingRound;
    const payout = pending.round.total * pending.bet;
    assert.equal(second.settleRound(), payout);
    assert.equal(first.settleRound(), 0);
    assert.equal(first.balance, second.balance);
    assert.equal(first.history.length, 1);
    assert.equal(first.history[0].id, pending.id);
    assert.equal(first.history[0].cost, pending.bet * RULES.buyCost);
    assert.equal(first.history[0].payout, payout);
    assert.equal(first.history[0].net, payout - pending.cost);
    assert.equal(first.history[0].buy, true);
    assert.equal(first.history[0].freeCount, pending.round.spins.length);
    assert.equal(first.history[0].freeMult, pending.round.freeMult);
    assert.ok(Math.abs(first.history[0].breakdown.reduce((sum, spin) => sum + spin.payout, 0) - payout) < 1e-7);
    const history = first.history;
    history[0].payout = 900000;
    history[0].breakdown[0].raw = 900000;
    assert.notEqual(first.history[0].payout, 900000, 'dışarı verilen geçmiş kopyadır');
    assert.notEqual(first.history[0].breakdown[0].raw, 900000);
    const restored = new GameState();
    assert.deepEqual(restored.getHistory(), first.history);
  } finally { store.restore(); }
});

test('kayıt başarısız olduğunda ödeme ve geçmiş birlikte bekler, tekrar denemede bir kez kapanır', () => {
  const store = storage();
  try {
    const state = new GameState();
    state.beginRound(makeRound());
    store.control.reject = true;
    assert.throws(() => state.settleRound(), /kaydedilemedi/);
    assert.equal(state.history.length, 0);
    assert.ok(state.pendingRound);
    store.control.reject = false;
    state.settleRound();
    assert.equal(state.history.length, 1);
    assert.equal(state.pendingRound, null);
    assert.equal(new GameState().history.length, 1);
  } finally { store.restore(); }
});

test('geçmiş son 20 turla sınırlıdır; tavanlı tur dökümü resmi ödemeyi aşmaz', () => {
  const store = storage();
  try {
    const state = new GameState();
    const round = makeRound();
    round.spins[0].win = RULES.maxWin + 500;
    round.total = RULES.maxWin;
    round.capped = true;
    for (let i = 0; i < 23; i++) { state.beginRound(round); state.settleRound(); }
    assert.equal(state.history.length, 20);
    assert.equal(new Set(state.history.map(({ id }) => id)).size, 20);
    const newest = state.history[0];
    assert.equal(newest.capped, true);
    assert.equal(newest.payout, state.bet * RULES.maxWin);
    assert.equal(newest.breakdown[0].payout, newest.payout);
    assert.ok(newest.breakdown.slice(1).every(({ payout }) => payout === 0));
    assert.equal(new GameState().history.length, 20);
  } finally { store.restore(); }
});

test('başka sekmeye geçen oturum bakiye, tercih, bekleyen tur veya geçmiş yazamaz', () => {
  const store = storage();
  try {
    let owned = true;
    const state = new GameState({ canWrite: () => owned });
    state.beginRound(makeRound(), { buy: true });
    const before = store.read();
    owned = false;
    assert.equal(state.canSpin, false);
    assert.equal(state.canBuyBonus, false);
    state.toggleTurbo();
    state.changeBet(1);
    state.resetBalance();
    state.setBusy(false);
    assert.throws(() => state.debit(1), /başka bir sekmede/);
    assert.throws(() => state.credit(1), /başka bir sekmede/);
    assert.throws(() => state.checkpointRound(1), /başka bir sekmede/);
    assert.throws(() => state.settleRound(), /başka bir sekmede/);
    assert.equal(store.read(), before);
    assert.equal(state.history.length, 0);
  } finally { store.restore(); }
});

test('geçersiz geçmiş satırları ve yinelenen kimlikler görünür geçmişe alınmaz', () => {
  const store = storage();
  try {
    const state = new GameState();
    state.beginRound(makeRound());
    state.settleRound();
    const entry = state.history[0];
    const saved = JSON.parse(store.read());
    saved.history = [
      { ...entry, id: '<script>alert(1)</script>' },
      { ...entry, id: 'negative', payout: -1 },
      { ...entry, id: 'overflow', freeCount: RULES.maxFreeSpins + 1 },
      { ...entry, id: 'invalid-breakdown', breakdown: [{ mode: '<img>', raw: 1, multiplier: 1, payout: 1 }] },
      entry, entry,
    ];
    globalThis.localStorage.setItem(key, JSON.stringify(saved));
    assert.deepEqual(new GameState().history, [entry]);
  } finally { store.restore(); }
});

test('eski satın alınmış bonus kaydı kapanırken geçmiş maliyeti ana dönüş gibi gösterilmez', () => {
  const round = makeRound();
  const store = storage(JSON.stringify({ balance: 800, betIndex: 1, pendingRound: { round, bet: 2, nextSpin: 3 } }));
  try {
    const state = new GameState();
    const payout = state.settleRound();
    assert.equal(state.balance, 800 + payout, 'maliyet yeniden kesilmez');
    assert.equal(state.history[0].buy, true);
    assert.equal(state.history[0].cost, 2 * RULES.buyCost);
    assert.equal(state.history[0].net, payout - 2 * RULES.buyCost);
    assert.deepEqual(new GameState().history, state.history);
  } finally { store.restore(); }
});
