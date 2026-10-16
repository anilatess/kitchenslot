import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import * as fake from './helpers/fakePixi.js';

mock.module('pixi.js', {
  namedExports: {
    Assets: fake.Assets,
    Container: fake.Container,
    Graphics: fake.Graphics,
    Sprite: fake.Sprite,
    Text: fake.Text,
  },
});

const { createSymbolSkin, loadSymbolAtlas } = await import('../src/view/skins.js');
const { CELL } = await import('../src/core/constants.js');

test('atlas sembolü sprite olarak üretir ve çarpan değerini üstte gösterir', async () => {
  const tomato = { id: 'tomato-frame' };
  const multiplier = { id: 'multiplier-frame' };
  fake.Assets.load = async () => ({ textures: { tomato, multiplier } });

  assert.equal(await loadSymbolAtlas('/assets/symbols.json'), true);
  const symbol = createSymbolSkin(0);
  assert.ok(symbol instanceof fake.Sprite);
  assert.equal(symbol.texture, tomato);
  assert.equal(symbol.width, CELL - 10);

  const mul = createSymbolSkin(104);
  assert.ok(mul instanceof fake.Container);
  assert.ok(mul.children[0] instanceof fake.Sprite);
  assert.equal(mul.children[0].texture, multiplier);
  assert.equal(mul.children[1].text, 'x4');
});

test('atlas yüklenemezse emoji görünümüne geri döner', async () => {
  fake.Assets.load = async () => { throw new Error('atlas yok'); };

  assert.equal(await loadSymbolAtlas('/assets/missing.json'), false);
  const symbol = createSymbolSkin(0);
  assert.ok(symbol instanceof fake.Container);
  assert.ok(symbol.children[0] instanceof fake.Graphics);
  assert.equal(symbol.children[1].text, '🍅');
});

test('atlasta tekil kare yoksa o sembol emoji yedeğini kullanır', async () => {
  fake.Assets.load = async () => ({ textures: { tomato: { id: 'tomato-frame' } } });

  assert.equal(await loadSymbolAtlas('/assets/symbols.json'), true);
  const missing = createSymbolSkin(1);
  assert.ok(missing instanceof fake.Container);
  assert.equal(missing.children[1].text, '🧄');
});
