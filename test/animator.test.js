import test from 'node:test';
import assert from 'node:assert/strict';
import { Animator } from '../src/animation/Animator.js';
import { easeOutQuad } from '../src/animation/easing.js';

function fakeTicker() {
  const fns = [];
  return { add: (fn) => fns.push(fn), pump: (d) => fns.forEach((fn) => fn({ deltaMS: d })) };
}

test('tween süre boyunca ilerler ve bitince hedefe oturur', async () => {
  const ticker = fakeTicker();
  const anim = new Animator(ticker);
  const target = { x: 0 };
  let done = false;
  anim.tween(target, { x: 100 }, 1000, easeOutQuad).then(() => (done = true));
  ticker.pump(500);
  await Promise.resolve();
  assert.ok(target.x > 0 && target.x < 100 && !done);
  ticker.pump(600);
  await Promise.resolve();
  assert.equal(target.x, 100);
  assert.ok(done);
});

test('turbo hızı süreleri kısaltır, wait çalışır', async () => {
  const ticker = fakeTicker();
  const anim = new Animator(ticker);
  anim.setTurbo(true);
  let done = false;
  anim.wait(1000).then(() => (done = true));
  ticker.pump(500); // 500 x 2.4 = 1200 ms
  await Promise.resolve();
  assert.ok(done);
});

test('yok edilmiş hedefte tween takılı kalmaz', async () => {
  const ticker = fakeTicker();
  const anim = new Animator(ticker);
  const target = { x: 0, destroyed: false };
  const p = anim.tween(target, { x: 10 }, 1000);
  target.destroyed = true;
  ticker.pump(16);
  await p;
});
