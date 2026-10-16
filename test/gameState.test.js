import test from 'node:test';
import assert from 'node:assert/strict';
import { GameState } from '../src/core/GameState.js';
import { BETS, START_BALANCE } from '../src/core/constants.js';
import { RULES } from '../src/game/config.js';

test('bahis sınırlar içinde kalır', () => {
  const s = new GameState();
  for (let i = 0; i < 20; i++) s.changeBet(+1);
  assert.equal(s.bet, BETS.at(-1));
  for (let i = 0; i < 20; i++) s.changeBet(-1);
  assert.equal(s.bet, BETS[0]);
});

test('meşgulken bahis değişmez ve dönüş başlatılamaz', () => {
  const s = new GameState();
  s.setBusy(true);
  const before = s.bet;
  s.changeBet(+1);
  assert.equal(s.bet, before);
  assert.equal(s.canSpin, false);
});

test('bakiye yetmiyorsa dönüş başlatılamaz; değişiklikler olay yayar', () => {
  const s = new GameState();
  let changes = 0;
  s.on('change', () => changes++);
  s.debit(START_BALANCE - 0.5);
  assert.equal(s.canSpin, false);
  s.credit(10);
  assert.equal(s.canSpin, true);
  assert.equal(changes, 2);
});

test('bonus satın alma yalnızca maliyet kadar bakiye varken ve meşgul değilken açılır', () => {
  const s = new GameState();
  assert.equal(s.canBuyBonus, s.balance >= s.bet * RULES.buyCost);

  while (s.bet < 10) s.changeBet(+1);
  assert.equal(s.canBuyBonus, true);
  s.debit(s.balance - s.bet * RULES.buyCost + 0.01);
  assert.equal(s.canBuyBonus, false);

  s.credit(1);
  assert.equal(s.canBuyBonus, true);
  s.setBusy(true);
  assert.equal(s.canBuyBonus, false);
});

test('bakiye, bahis ve turbo localStorage üzerinden saklanıp geri yüklenir', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  let stored = JSON.stringify({ balance: 45.75, betIndex: 3, turbo: true });
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: () => stored, setItem: (_key, value) => { stored = value; } },
  });
  try {
    const state = new GameState();
    assert.equal(state.balance, 45.75);
    assert.equal(state.betIndex, 3);
    assert.equal(state.turbo, true);

    state.changeBet(+1);
    state.toggleTurbo();
    state.debit(5);
    const restored = new GameState();
    assert.equal(restored.balance, 40.75);
    assert.equal(restored.betIndex, 4);
    assert.equal(restored.turbo, false);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else delete globalThis.localStorage;
  }
});

test('bozuk veya erişilemeyen localStorage oyunu durdurmaz', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: () => '{bozuk', setItem: () => { throw new Error('kapalı'); } },
  });
  try {
    const state = new GameState();
    assert.equal(state.balance, START_BALANCE);
    assert.doesNotThrow(() => state.toggleTurbo());
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else delete globalThis.localStorage;
  }
});

test('bakiye sıfırlama yalnızca başlangıç bakiyesini yükler ve durumdan çıkarır', () => {
  const state = new GameState();
  state.debit(START_BALANCE - 0.5);
  assert.equal(state.isBankrupt, true);
  state.resetBalance();
  assert.equal(state.balance, START_BALANCE);
  assert.equal(state.isBankrupt, false);
});
