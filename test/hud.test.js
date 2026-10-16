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

test('autoplay HUD kalan dönüşü gösterir ve durdur düğmesini değiştirir', () => {
  const hud = new Hud({});
  const countButton = hud.children[11];
  const toggleButton = hud.children[12];
  const status = hud.children[13];
  hud.setAutoplay({ selected: 25, remaining: 17, running: true });
  assert.equal(countButton.children[1].text, 'OTO ×25');
  assert.equal(toggleButton.children[1].text, 'DURDUR');
  assert.equal(status.text, 'KALAN 17 TUR');

  hud.setAutoplay({ selected: 25, remaining: 0, running: false });
  assert.equal(toggleButton.children[1].text, 'OTO BAŞLAT');
  assert.equal(status.text, '');
});

test('bakiye sıfırlama düğmesi yalnızca bakiye bittiğinde görünür', () => {
  const hud = new Hud({});
  const resetButton = hud.children[14];
  let clicked = false;
  hud.on('resetBalance', () => { clicked = true; });

  hud.setBankrupt(false);
  assert.equal(resetButton.visible, false);
  hud.setBankrupt(true);
  assert.equal(resetButton.visible, true);
  resetButton.emit('pointertap');
  assert.equal(clicked, true);
});

test('ses düğmesi açık/kapalı tercihini görünür biçimde gösterir', () => {
  const hud = new Hud({});
  const audioButton = hud.children[15];
  hud.setAudioEnabled(false);
  assert.equal(audioButton.children[1].text, 'SES KAPALI');
  hud.setAudioEnabled(true);
  assert.equal(audioButton.children[1].text, 'SES AÇIK');
});
