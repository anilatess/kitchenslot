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
