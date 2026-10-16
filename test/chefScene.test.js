import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import * as fake from './helpers/fakePixi.js';

const frames = Object.fromEntries(Array.from({ length: 8 }, (_, i) => ['stir-' + i, { id: i }]));
mock.module('pixi.js', { namedExports: {
  Container: fake.Container, Graphics: fake.Graphics, Sprite: fake.Sprite, Text: fake.Text,
  Assets: { load: async (url) => url.endsWith('.json') ? { textures: frames } : { id: 'flame' } },
} });
const { ChefBonusView, loadChefScene } = await import('../src/view/ChefBonusView.js');
await loadChefScene('/assets/');

test('çarpan tepkisi ödülü değiştirmez; ateş tencerenin altında kalır ve yön değişiminde korunur', () => {
  const chef = new ChefBonusView();
  chef.startBonus();
  chef.setTotal(250);
  for (let i = 0; i < 100; i++) chef.update(16);
  chef.collectPulse();
  chef.update(32);
  const fire = chef.children.find(child => child.label === 'chef-fire');
  const art = chef.children.find(child => child.label === 'chef-art');
  assert.equal(art.children.length, 2, 'atlas geçişi iki poz ile yumuşatılır');
  assert.ok(fire.children.every(flame => Math.abs(flame.x - 160) <= 49 && flame.y >= 525));
  assert.ok(fire.children.every(flame => flame.height < 80), 'alevler karakterin yanlarına kadar uzamaz');
  assert.ok(chef.children.filter(child => child.label === 'soup-ripple').some(child => child.alpha > 0));
  chef.layout('portrait');
  assert.equal(chef.total, 250);
  assert.deepEqual(chef.collectionTarget, { x: 190, y: 1146 });
  assert.equal(art.children[0].width, 240);
  assert.equal(art.children[0].height, 320);
  assert.ok(art.y - art.children[0].height / 2 > 900, 'şef bahis satırının altında kalmalı');
  assert.ok(art.y + art.children[0].height / 2 < 1280, 'şef ekranın dışına taşmamalı');
  assert.ok(fire.children.every(flame => flame.y <= 1260));
  chef.finishBonus();
  assert.equal(art.children[0].width, 240, 'bonus bitince aşçı küçülmemeli');
  assert.deepEqual(chef.collectionTarget, { x: 190, y: 1146 });
  chef.celebrate('mega');
  assert.equal(chef.total, 250);
  chef.resetRound();
  chef.update(0);
  assert.equal(art.children[0].height, 320, 'ana oyunda da büyük kalmalı');
  assert.ok(fire.children.every(flame => flame.alpha === 0));
});

test('hareket azaltma açıkken şef ve atlas sabit; çarpan ve ateş göstergesi çalışır', () => {
  const previous = globalThis.matchMedia;
  globalThis.matchMedia = () => ({ matches: true });
  try {
    const chef = new ChefBonusView();
    chef.startBonus();
    chef.setTotal(50);
    chef.collectPulse();
    const art = chef.children.find(child => child.label === 'chef-art');
    for (let i = 0; i < 60; i++) chef.update(16);
    assert.equal(chef.total, 50);
    assert.equal(art.rotation, 0);
    assert.equal(art.y, 330);
    assert.equal(art.scale.x, 1);
    assert.equal(art.children[0].texture, frames['stir-0']);
    assert.equal(art.children[1].alpha, 0);
    assert.ok(chef.children.find(child => child.label === 'chef-fire').children.every(flame => flame.alpha > 0));
    assert.ok(chef.children.filter(child => child.label === 'soup-ripple').every(child => child.alpha === 0));
  } finally {
    if (previous === undefined) delete globalThis.matchMedia;
    else globalThis.matchMedia = previous;
  }
});
