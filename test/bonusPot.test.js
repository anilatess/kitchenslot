import test from 'node:test';
import assert from 'node:assert/strict';
import { BonusPotState } from '../src/view/BonusPotState.js';
import { RoundPlayer } from '../src/presenter/RoundPlayer.js';
import { playRound } from '../src/game/engine.js';
import { createRng } from '../src/game/rng.js';

test('tencere yalnızca aktif bonusta toplam alır; yeni bonus ve tur sıfırlar', () => {
  const pot = new BonusPotState();
  pot.setTotal(50);
  assert.equal(pot.total, 0);
  pot.startBonus();
  pot.setTotal(2); pot.setTotal(7);
  pot.finishBonus();
  assert.equal(pot.total, 7);
  assert.equal(pot.active, false);
  pot.setTotal(100);
  assert.equal(pot.total, 7);
  pot.startBonus();
  assert.equal(pot.total, 0);
  pot.setTotal(25); pot.resetRound();
  assert.equal(pot.total, 0);
  assert.equal(pot.phase, 'idle');
});

test('ateş artan gerçek çarpanla güçlenir, sınırda kalır ve geçersiz değeri kabul etmez', () => {
  const pot = new BonusPotState();
  pot.startBonus();
  let previous = -1;
  for (const value of [0, 2, 10, 50, 250]) {
    pot.setTotal(value);
    assert.ok(pot.heat > previous);
    previous = pot.heat;
  }
  pot.setTotal(1000);
  assert.equal(pot.heat, 1);
  for (const invalid of [-1, NaN, Infinity]) pot.setTotal(invalid);
  assert.equal(pot.total, 1000);
});

function setup() {
  const pot = new BonusPotState();
  const totals = [];
  let mode = 'base';
  const hud = {
    beginRound: () => { mode = 'base'; pot.resetRound(); },
    setSpinMode: (next) => { if (next === 'free' && mode !== 'free') pot.startBonus(); mode = next; },
    setMultiplier: (value) => { if (mode === 'free') { pot.setTotal(value); totals.push(value); } },
    finishRound: () => pot.finishBonus(),
    showBanner: async () => {}, countWinTo: async () => {}, setFreeSpins: () => {},
  };
  const grid = {
    dropIn: async () => {}, pulseWhere: async () => {},
    playStep: async (step, collect) => { for (const item of step.collected) collect(item.value, { x: 620, y: 330 }); },
    collectCells: async (items, collect) => { for (const item of items) collect(item.value, { x: 620, y: 330 }); },
  };
  return { pot, totals, player: new RoundPlayer({ grid, hud, animator: { wait: async () => {} } }) };
}

test('ana oyun çarpanı tencereye girmez; bedava dönüşler arasında 5 → 15 korunur', async () => {
  const { pot, totals, player } = setup();
  const spin = (mode, values, freeMult, win) => ({
    mode, initialGrid: [], scatters: 0, raw: 1, appliedMult: win, win,
    freeMult, multSum: values.reduce((a, b) => a + b, 0), endCollected: [],
    steps: [{ removed: [[true]], stepWin: 1, collected: values.map(value => ({ value })) }],
  });
  const round = { total: 27, capped: false, spins: [spin('base', [7], 0, 7), spin('free', [2, 3], 5, 5), spin('free', [10], 15, 15)] };
  assert.equal(await player.play(round, 2), 54);
  assert.deepEqual(totals, [0, 2, 5, 5, 15]);
  assert.equal(pot.total, 15);
  assert.equal(pot.phase, 'complete');
  await player.play({ total: 0, capped: false, spins: [] }, 2);
  assert.equal(pot.total, 0);
});

test('20 gerçek bonus turunda tencere toplamı son freeMult ile aynı; ödeme değişmez', async () => {
  const rng = createRng(20261016);
  const { pot, totals, player } = setup();
  for (let i = 0; i < 20; i++) {
    const round = playRound(rng, { record: true, buy: true });
    totals.length = 0;
    const payout = await player.play(round, 5);
    assert.equal(payout, round.total * 5);
    assert.equal(pot.total, round.spins.at(-1).freeMult);
    assert.ok(totals.every((value, index) => index === 0 || value >= totals[index - 1]));
  }
});
