import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import * as fake from './helpers/fakePixi.js';

mock.module('pixi.js', { namedExports: {
  Assets: fake.Assets, Container: fake.Container, Graphics: fake.Graphics,
  Sprite: fake.Sprite, Text: fake.Text,
} });

const { Animator } = await import('../src/animation/Animator.js');
const { GridView } = await import('../src/view/GridView.js');
const { RoundPlayer } = await import('../src/presenter/RoundPlayer.js');
const { playRound } = await import('../src/game/engine.js');
const { createRng } = await import('../src/game/rng.js');

async function flush(times = 50) { for (let i = 0; i < times; i++) await Promise.resolve(); }

async function drive(promise, ticker) {
  let done = false;
  promise.finally(() => { done = true; }).catch(() => {});
  for (let i = 0; i < 3000 && !done; i++) { ticker.pump(1e6); await flush(); }
  assert.equal(done, true, 'sunum sonlu sayıda animasyonla bitmeli');
  return promise;
}

function recordedTumbleRound() {
  const rng = createRng(20261016);
  for (let index = 0; index < 2000; index++) {
    const round = playRound(rng, { record: true });
    const spin = round.spins[0];
    if (round.spins.length === 1 && spin.steps.length >= 2 && spin.multSum > 0) return round;
  }
  assert.fail('çarpan ve çoklu patlama içeren motor kaydı bulunmalı');
}

function setup({ simpleGrid = false } = {}) {
  const ticker = fake.createFakeTicker();
  const animator = new Animator(ticker);
  const log = { win: 0, mult: [], flights: [], breakdowns: [], sounds: [], progress: [], changes: [], drops: [] };
  const hud = {
    beginRound() {}, finishRound() {}, clearSpinBreakdown() {},
    setMultiplier: (value) => log.mult.push(value),
    flyMultiplier: (value) => log.flights.push(value),
    setFreeSpins() {}, setSpinMode() {}, setWin: (value) => { log.win = value; },
    countWinTo: async (value) => {
      if (Math.abs(log.win - value) < 1e-9) return;
      const counter = { value: log.win };
      await animator.tween(counter, { value }, 500, undefined, () => { log.win = counter.value; });
    },
    showBanner: async () => {},
    showSpinBreakdown: (value) => log.breakdowns.push(value),
  };
  const grid = simpleGrid ? {
    async dropIn() { const item = { value: 0 }; log.drops.push(item); await animator.tween(item, { value: 1 }, 100); },
    collectCells: async () => {}, pulseWhere: async () => {}, playStep: async () => {},
  } : new GridView(animator);
  const player = new RoundPlayer({ grid, hud, animator, audio: { play: (name) => log.sounds.push(name) } });
  const options = {
    onProgress: (next) => log.progress.push(next),
    onSkippableChange: (value) => log.changes.push(value),
  };
  return { ticker, animator, grid, hud, player, log, options };
}

for (const moment of ['active', 'before-first-tween']) {
  test(`BİTİR ${moment}: gerçek tumble, son ızgara, çarpanlar ve ödeme bir kez ve aynı kalır`, async () => {
    const round = recordedTumbleRound();
    const original = JSON.stringify(round);
    const normal = setup();
    await drive(normal.player.play(round, 2, normal.options), normal.ticker);
    const skipped = setup();
    const result = skipped.player.play(round, 2, skipped.options);
    assert.equal(skipped.player.isPlaying, true);
    assert.equal(skipped.player.canSkip, true);
    if (moment === 'active') {
      await flush();
      skipped.ticker.pump(35);
      await flush();
    }
    assert.equal(skipped.player.skipCurrentSpin(), true);
    assert.equal(skipped.player.skipCurrentSpin(), false, 'ikinci tık yeni toplama veya bahis oluşturmaz');
    await flush(500);
    // Bitirildikten sonra hiçbir ticker karesi gerekmez; zincirdeki sonraki tweenler de tamamlanır.
    assert.equal(skipped.player.isPlaying, false);
    assert.equal(await result, round.total * 2);
    assert.equal(skipped.log.win, normal.log.win);
    assert.deepEqual(skipped.log.flights, normal.log.flights);
    assert.deepEqual(skipped.log.mult, normal.log.mult);
    assert.deepEqual(skipped.log.sounds, normal.log.sounds);
    assert.deepEqual(skipped.log.progress, [1]);
    assert.deepEqual(skipped.log.breakdowns, normal.log.breakdowns);
    const cells = (grid) => grid.children[1].children.map(({ cell, x, y }) => ({ cell, x, y }));
    assert.deepEqual(cells(skipped.grid), cells(normal.grid));
    assert.deepEqual(skipped.log.changes, [true, false]);
    assert.equal(skipped.player.canSkip, false);
    assert.equal(JSON.stringify(round), original, 'motor sonucu değişmemeli');
  });
}

test('bonusun yalnızca mevcut dönüşü biter, sonraki dönüş normal sürer; modallar atlanmaz', async () => {
  const env = setup({ simpleGrid: true });
  const { player, hud, log, ticker, options } = env;
  const spin = () => ({ mode: 'free', initialGrid: [], steps: [], endCollected: [], scatters: 0, raw: 0, appliedMult: 1, win: 0, freeMult: 0, multSum: 0 });
  const round = { total: 0, capped: false, spins: [spin(), spin()] };
  let intros = 0, summaries = 0;
  hud.showBonusIntro = async () => { intros++; assert.equal(player.canSkip, false); assert.equal(player.skipCurrentSpin(), false); };
  hud.showBonusSummary = async () => { summaries++; assert.equal(player.canSkip, false); assert.equal(player.skipCurrentSpin(), false); };
  const result = player.play(round, 1, options);
  await flush();
  assert.equal(log.drops.length, 1);
  assert.equal(player.skipCurrentSpin(), true);
  await flush();
  assert.equal(log.drops[0].value, 1);
  assert.equal(log.drops.length, 1, 'dönüşler arası ara da normal süresini korur');
  ticker.pump(400);
  await flush();
  assert.equal(log.drops.length, 2);
  assert.equal(log.drops[1].value, 0, 'ikinci dönüş otomatik bitirilmemeli');
  assert.equal(player.canSkip, true);
  ticker.pump(50);
  await flush();
  assert.equal(log.drops[1].value, 0.5);
  assert.equal(await drive(result, ticker), 0);
  assert.deepEqual(log.progress, [1, 2]);
  assert.deepEqual(log.changes, [true, false, true, false]);
  assert.equal(intros, 1);
  assert.equal(summaries, 1);
});

test('sunum hatasında bitirme durumu temizlenir; yeni tur ve animasyonlar normal başlar', async () => {
  const env = setup({ simpleGrid: true });
  env.hud.clearSpinBreakdown = () => { throw new Error('sunum kesildi'); };
  const spin = { mode: 'base', initialGrid: [], steps: [], endCollected: [], scatters: 0, raw: 0, appliedMult: 1, win: 0, multSum: 0 };
  const round = { total: 0, spins: [spin] };
  await assert.rejects(env.player.play(round, 1, env.options), /sunum kesildi/);
  assert.equal(env.player.canSkip, false);
  assert.equal(env.player.isPlaying, false);
  assert.equal(env.player.skipCurrentSpin(), false);
  env.hud.clearSpinBreakdown = () => {};
  assert.equal(await drive(env.player.play(round, 1, env.options), env.ticker), 0);
});
