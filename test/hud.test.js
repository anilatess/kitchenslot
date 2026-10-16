import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import * as fake from './helpers/fakePixi.js';

mock.module('pixi.js', { namedExports: { Container: fake.Container, Graphics: fake.Graphics, Text: fake.Text } });

const { Hud } = await import('../src/view/Hud.js');

test('bonus satın alma penceresi bedeli gösterir ve Evet/Vazgeç sonucunu döndürür', async () => {
  const hud = new Hud({});
  const dialog = hud.children.at(-1);

  const accepted = hud.confirmBonusPurchase(200);
  assert.equal(dialog.visible, true);
  assert.match(dialog.children[3].text, /200,00/);
  dialog.children[4].emit('pointertap');
  assert.equal(await accepted, true);
  assert.equal(dialog.visible, false);

  const cancelled = hud.confirmBonusPurchase(500);
  dialog.children[5].emit('pointertap');
  assert.equal(await cancelled, false);
  assert.equal(dialog.visible, false);
});

test('bonus düğmesi bakiye uygun değilken pasif görünür', () => {
  const hud = new Hud({});
  hud.setControls({ canSpin: true, canChangeBet: true, canBuyBonus: false });
  assert.equal(hud.children[10].alpha, 0.45);
  hud.setControls({ canSpin: true, canChangeBet: true, canBuyBonus: true });
  assert.equal(hud.children[10].alpha, 1);
});
