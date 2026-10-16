import test from 'node:test';
import assert from 'node:assert/strict';
import { RoundPlayer } from '../src/presenter/RoundPlayer.js';
import { playRound } from '../src/game/engine.js';
import { createRng } from '../src/game/rng.js';
import { RULES } from '../src/game/config.js';

function setup() {
  const log = { wins: [], grids: [], progress: [], intros: [], summaries: [], celebrations: [], free: [], mult: [], modes: [] };
  const hud = {
    beginRound() {}, finishRound() {},
    setSpinMode: (mode) => log.modes.push(mode),
    setWin: (value) => log.wins.push(value),
    countWinTo: async (value) => log.wins.push(value),
    setMultiplier: (value) => log.mult.push(value),
    setFreeSpins: (value) => log.free.push(value),
    showBonusIntro: async (value) => log.intros.push(value),
    showBonusRetrigger: async () => {},
    showBonusSummary: async (value) => log.summaries.push(value),
    showWinCelebration: async (value) => log.celebrations.push(value),
    showBanner: async () => {},
  };
  const grid = {
    dropIn: async (value) => log.grids.push(value), pulseWhere: async () => {},
    playStep: async (step, collect) => { for (const item of step.collected) collect(item.value); },
    collectCells: async (items, collect) => { for (const item of items) collect(item.value); },
  };
  return { log, player: new RoundPlayer({ hud, grid, animator: { wait: async () => {} } }) };
}

const cappedBonus = () => playRound(createRng(137), { record: true, buy: true });

test('gerçek tavan turunda tüm ara sayaçlar resmi ödeme sınırında ve monoton kalır', async () => {
  const round = cappedBonus();
  const before = JSON.stringify(round);
  assert.equal(round.capped, true);
  assert.ok(round.spins.reduce((sum, spin) => sum + spin.win, 0) > round.total);
  const { player, log } = setup();
  const bet = 5;
  const payout = await player.play(round, bet, { onProgress: (next) => log.progress.push(next) });
  assert.equal(payout, RULES.maxWin * bet);
  assert.equal(log.wins.at(-1), payout);
  for (let index = 0; index < log.wins.length; index++) {
    assert.ok(log.wins[index] <= payout, `ara tutar sınırı aştı: ${log.wins[index]}`);
    if (index > 0) assert.ok(log.wins[index] >= log.wins[index - 1], 'kazanç geri saymamalı');
  }
  assert.deepEqual(log.progress, round.spins.map((_, index) => index + 1));
  assert.deepEqual(log.summaries, [{ win: payout, multiplier: round.freeMult, spins: round.freeCount, bet }]);
  assert.equal(log.celebrations[0].capped, true);
  assert.equal(log.celebrations[0].win, payout);
  assert.equal(JSON.stringify(round), before, 'sunum motor kaydını değiştirmemeli');
});

test('yenilemeden devam: biten dönüşler atlanır, çarpan ve sayaçlar doğru kurulur', async () => {
  const round = cappedBonus();
  const bet = 2;
  const split = 6;
  const initial = setup();
  let saved = 0;
  await assert.rejects(initial.player.play(round, bet, { onProgress: async (next) => {
    saved = next;
    if (next === split) throw new Error('yenileme');
  } }), /yenileme/);
  assert.equal(saved, split);

  const resumed = setup();
  const payout = await resumed.player.play(round, bet, {
    startSpin: saved, onProgress: (next) => resumed.log.progress.push(next),
  });
  const prefixWin = Math.min(round.total, round.spins.slice(0, split).reduce((sum, spin) => sum + spin.win, 0));
  assert.equal(resumed.log.wins[0], prefixWin * bet);
  assert.equal(resumed.log.mult[0], round.spins[split - 1].freeMult);
  assert.deepEqual(resumed.log.free[0], { current: split, total: RULES.freeSpins });
  assert.equal(resumed.log.modes[0], 'free');
  assert.deepEqual(resumed.log.grids, round.spins.slice(split).map((spin) => spin.initialGrid));
  assert.deepEqual(resumed.log.progress, round.spins.slice(split).map((_, index) => split + index + 1));
  assert.deepEqual(resumed.log.intros, [], 'bonus girişini tekrar oynatmamalı');
  assert.equal(payout, round.total * bet);
  assert.equal(resumed.log.summaries[0].multiplier, round.freeMult);
  assert.equal(resumed.log.summaries[0].spins, round.freeCount);
});

test('tüm dönüşler bitmişse yalnızca resmi sonuç sunulur ve yeni dönüş oynatılmaz', async () => {
  const round = cappedBonus();
  const { player, log } = setup();
  assert.equal(await player.play(round, 1, { startSpin: round.spins.length, onProgress: (next) => log.progress.push(next) }), round.total);
  assert.equal(log.wins[0], round.total);
  assert.deepEqual(log.grids, [round.spins.at(-1).finalGrid], 'son kayıtlı ızgara dekoratif açılışın yerini almalı');
  assert.deepEqual(log.progress, []);
  assert.deepEqual(log.intros, []);
  assert.equal(log.mult[0], round.freeMult);
});

test('yeniden tetiklenen bonusta devam sayacı verilen ek dönüşleri korur', async () => {
  const rng = createRng(77);
  let round;
  let split;
  for (let index = 0; index < 100; index++) {
    round = playRound(rng, { record: true, buy: true });
    const found = round.spins.findIndex((spin, position) => spin.scatters >= RULES.scatterTrigger && position < round.spins.length - 1);
    if (found >= 0) { split = found + 1; break; }
  }
  assert.ok(split > 0, 'gerçek yeniden tetikleme örneği bulunmalı');
  const { player, log } = setup();
  await player.play(round, 1, { startSpin: split });
  const retriggers = round.spins.slice(0, split).filter((spin) => spin.scatters >= RULES.scatterTrigger).length;
  assert.deepEqual(log.free[0], { current: split, total: RULES.freeSpins + retriggers * RULES.retriggerSpins });
});
