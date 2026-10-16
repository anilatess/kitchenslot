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

test('dönüşü bitirmek etkin tween ve sonraki zincirleri ticker beklemeden sonlandırır', async () => {
  const ticker = fakeTicker();
  const anim = new Animator(ticker);
  const segment = anim.beginSegment();
  const target = { x: 0, scale: { x: 1, set(value) { this.x = value; } } };
  const updates = [];
  const chain = anim.tween(target, { x: 100 }, 1000, undefined, () => updates.push(target.x))
    .then(() => anim.wait(500))
    .then(() => anim.tween(target, { scale: 2 }, 500));
  ticker.pump(50);
  assert.equal(target.x, 5);
  assert.equal(anim.fastForwardSegment(segment), true);
  assert.equal(anim.fastForwardSegment(segment), false, 'aynı dönüş iki kez bitirilemez');
  await chain;
  assert.equal(target.x, 100);
  assert.equal(target.scale.x, 2);
  assert.deepEqual(updates, [5, 100], 'son onUpdate sayaçları da hedefe götürür');
  anim.endSegment(segment);

  const next = { x: 0 };
  let nextDone = false;
  anim.tween(next, { x: 100 }, 100).then(() => { nextDone = true; });
  await Promise.resolve();
  assert.equal(next.x, 0);
  assert.equal(nextDone, false, 'sonraki dönüş kendi normal süresini kullanır');
  ticker.pump(50);
  assert.equal(next.x, 50);
  ticker.pump(50);
  await Promise.resolve();
  assert.equal(nextDone, true);
});

test('yanlış veya bitmiş dönüş anahtarı yeni animasyonları bitiremez', async () => {
  const ticker = fakeTicker();
  const anim = new Animator(ticker);
  assert.equal(anim.fastForwardSegment(), false);
  const first = anim.beginSegment();
  anim.endSegment(first);
  const second = anim.beginSegment();
  assert.equal(anim.fastForwardSegment(first), false);
  const target = { x: 0 };
  const done = anim.tween(target, { x: 10 }, 100);
  anim.endSegment(first);
  assert.equal(anim.fastForwardSegment(second), true);
  await done;
  assert.equal(target.x, 10);
});

test('bitirilen tween yok edilmiş hedefe dokunmaz ve hata veren onUpdate beklemez', async () => {
  const anim = new Animator(fakeTicker());
  const segment = anim.beginSegment();
  const removed = { x: 0, destroyed: false };
  const destroyed = anim.tween(removed, { x: 10 }, 100);
  const failed = anim.tween({ x: 0 }, { x: 10 }, 100, undefined, () => { throw new Error('sunum hatası'); });
  removed.destroyed = true;
  anim.fastForwardSegment(segment);
  await destroyed;
  await assert.rejects(failed, /sunum hatası/);
  assert.equal(removed.x, 0);
  anim.endSegment(segment);
});
