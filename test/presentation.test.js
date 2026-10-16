// Sunum katmanı testi: gerçek motor turları, gerçek Animator/GridView/RoundPlayer,
// sahte Pixi. Ekrandaki semboller her adımda motorun ızgarasıyla uyuşuyor mu?
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
const { COLS, ROWS, RULES } = await import('../src/game/config.js');
const { CELL } = await import('../src/core/constants.js');

function createHud() {
  const log = { banners: [], freeInfo: [], multipliers: [], win: 0 };
  return {
    log,
    showBanner: async (m) => void log.banners.push(m),
    setFreeSpins: (i) => log.freeInfo.push(i),
    setMultiplier: (v) => log.multipliers.push(v),
    countWinTo: async (v) => { log.win = v; },
    setWin: (v) => { log.win = v; },
  };
}

function setup() {
  const ticker = fake.createFakeTicker();
  const animator = new Animator(ticker);
  const grid = new GridView(animator);
  const hud = createHud();
  const player = new RoundPlayer({ grid, hud, animator });
  const pump = setInterval(() => ticker.pump(), 0); // her tween bir adımda biter
  return { grid, hud, player, stop: () => clearInterval(pump) };
}

test('tumble sonrası ekran motor ızgarasıyla birebir uyuşur (500 tur, uyarı yok)', async () => {
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...a) => warnings.push(a.join(' '));
  const { grid, hud, player, stop } = setup();
  const rng = createRng(2026);
  let tumbles = 0, freeRounds = 0;

  try {
    for (let i = 0; i < 500; i++) {
      const round = playRound(rng, { record: true, buy: i % 10 === 0 });
      const bet = 2;
      const payout = await player.play(round, bet);

      assert.ok(Math.abs(payout - round.total * bet) < 1e-9);
      assert.ok(Math.abs(hud.log.win - round.total * bet) < 1e-9, 'son gösterilen kazanç = ödenen');
      tumbles += round.spins.reduce((a, s) => a + s.steps.length, 0);
      if (round.freeTriggered) freeRounds++;

      // Tur sonunda ızgara tam dolu ve hücre merkezlerinde olmalı
      const layer = grid.children[1];
      assert.equal(layer.children.length, COLS * ROWS - lastCollected(round), 'sembol sayısı');
      for (const v of layer.children) {
        assert.equal((v.x - CELL / 2) % CELL, 0);
        assert.equal((v.y - CELL / 2) % CELL, 0);
      }
    }
  } finally {
    console.warn = originalWarn;
    stop();
  }
  assert.deepEqual(warnings, [], warnings.slice(0, 3).join('\n'));
  assert.ok(tumbles > 300, `yeterli tumble test edilmeli (${tumbles})`);
  assert.ok(freeRounds > 50, `bedava dönüş turları test edilmeli (${freeRounds})`);
});

// Son dönüşün zincir sonunda toplanıp yok edilen çarpanları ızgarada boşluk bırakır.
function lastCollected(round) {
  return round.spins.at(-1)?.endCollected.length ?? 0;
}

test('bedava dönüş akışı: banner, sayaç ve tekrar tetikleme', async () => {
  const { hud, player, stop } = setup();
  const rng = createRng(77);
  try {
    let checked = 0;
    for (let i = 0; i < 300 && checked < 20; i++) {
      hud.log.banners.length = 0;
      hud.log.freeInfo.length = 0;
      const round = playRound(rng, { record: true, buy: true });
      await player.play(round, 1);

      const freeSpins = round.spins.filter((s) => s.mode === 'free');
      assert.equal(freeSpins.length, round.freeCount);
      assert.equal(hud.log.banners[0], `${RULES.freeSpins} BEDAVA DÖNÜŞ`);
      const retriggers = freeSpins.filter((s) => s.scatters >= RULES.scatterTrigger).length;
      assert.equal(hud.log.banners.filter((b) => b.startsWith('+')).length, round.capped ? retriggers : retriggers);
      const infos = hud.log.freeInfo.filter(Boolean);
      assert.equal(infos.length, freeSpins.length);
      infos.forEach((info, idx) => assert.equal(info.current, idx + 1));
      assert.equal(hud.log.freeInfo.at(-1), null, 'tur sonunda bedava dönüş göstergesi kapanmalı');
      checked++;
    }
    assert.equal(checked, 20);
  } finally {
    stop();
  }
});
