import test from 'node:test';
import assert from 'node:assert/strict';
import { Autoplay } from '../src/core/Autoplay.js';

test('autoplay seçenekleri 10, 25, 50 ve 100 arasında döner', () => {
  const auto = new Autoplay({ play: async () => ({}), canSpin: () => true });
  assert.equal(auto.selected, 10);
  for (const count of [25, 50, 100, 10]) {
    auto.selectNext();
    assert.equal(auto.selected, count);
  }
});

test('autoplay seçilen sayıda dönüş oynatıp kalan sayıyı sıfırlar', async () => {
  let plays = 0;
  const auto = new Autoplay({
    play: async () => { plays++; return { total: 1, freeTriggered: false }; },
    canSpin: () => true,
  });
  auto.selectNext(); // 25
  auto.selectNext(); // 50
  auto.selectNext(); // 100
  auto.selectNext(); // 10
  await auto.start();
  assert.equal(plays, 10);
  assert.equal(auto.remaining, 0);
  assert.equal(auto.running, false);
});

test('autoplay bonus, 50x kazanç veya yetersiz bakiye sonrası durur', async (t) => {
  for (const [name, round, canSpin] of [
    ['bonus tetiklenmesi', { total: 0, freeTriggered: true }, () => true],
    ['50x kazanç', { total: 50, freeTriggered: false }, () => true],
    ['yetersiz bakiye', { total: 1, freeTriggered: false }, (() => { let calls = 0; return () => ++calls <= 2; })()],
  ]) {
    await t.test(name, async () => {
      let plays = 0;
      const auto = new Autoplay({ play: async () => { plays++; return round; }, canSpin });
      await auto.start();
      assert.equal(plays, 1);
      assert.equal(auto.running, false);
    });
  }
});

test('durdurma isteği mevcut dönüşü bitirir ama yenisini başlatmaz', async () => {
  let releaseRound;
  let plays = 0;
  const auto = new Autoplay({
    play: () => {
      plays++;
      return new Promise((resolve) => { releaseRound = () => resolve({ total: 1, freeTriggered: false }); });
    },
    canSpin: () => true,
  });
  const task = auto.start();
  auto.stop();
  releaseRound();
  await task;
  assert.equal(plays, 1);
  assert.equal(auto.remaining, 9);
  assert.equal(auto.running, false);
});
