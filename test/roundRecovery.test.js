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
    assert.deepEqual(reloaded.pendingRound, { round, bet, nextSpin: 4 });
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
