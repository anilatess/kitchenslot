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

const { createSymbolSkin, loadSymbolAtlas, loadSymbolImages } = await import('../src/view/skins.js');
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


test('PNG semboller yüklenir; eksik dosya diğer sembolleri engellemez', async () => {
  const loaded = [];
  fake.Assets.load = async (url) => {
    loaded.push(url);
    if (url.endsWith('/garlic.png')) throw new Error('eksik PNG');
    return { id: url };
  };
  assert.equal(await loadSymbolImages('/game/assets/symbols/'), 11);
  assert.equal(loaded.length, 12);
  const tomato = createSymbolSkin(0);
  const sprite = tomato.children.find((child) => child instanceof fake.Sprite);
  assert.equal(sprite.texture.id, '/game/assets/symbols/tomato.png');
  const garlic = createSymbolSkin(1);
  assert.equal(garlic.children[1].text, '🧄');
});

test('aynı alev PNG üzerinde her gerçek çarpan değeri ayrı yazılır', () => {
  for (const value of [2, 5, 25, 100]) {
    const skin = createSymbolSkin(100 + value);
    const sprite = skin.children.find((child) => child instanceof fake.Sprite);
    assert.equal(sprite.texture.id, '/game/assets/symbols/multiplier.png');
    const labels = skin.children.filter((child) => child instanceof fake.Text);
    assert.deepEqual(labels.map((child) => child.text), ['x' + value]);
  }
});

test('bütün PNG yüklemeleri başarısızsa önceki atlas çalışmaya devam eder', async () => {
  fake.Assets.load = async () => { throw new Error('PNG yok'); };
  assert.equal(await loadSymbolImages('/missing/'), 0);
  assert.ok(createSymbolSkin(0) instanceof fake.Sprite);
});
