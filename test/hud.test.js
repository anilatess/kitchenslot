import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import * as fake from './helpers/fakePixi.js';

mock.module('pixi.js', { namedExports: { Container: fake.Container, Graphics: fake.Graphics, Text: fake.Text, Sprite: fake.Sprite, Assets: fake.Assets } });

const { Hud } = await import('../src/view/Hud.js');

const buttonWith = (hud, label) => hud.children.find((item) => item.children?.some((child) => child.text === label));

test('bonus satın alma penceresi bedeli gösterir ve Evet/Vazgeç sonucunu döndürür', async () => {
  const hud = new Hud({});
  const dialog = hud.children.find((item) => item.children?.some((child) => child.text === 'BONUS SATIN AL'));

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
  assert.equal(buttonWith(hud, 'BONUS AL (100x)').alpha, 0.45);
  hud.setControls({ canSpin: true, canChangeBet: true, canBuyBonus: true });
  assert.equal(buttonWith(hud, 'BONUS AL (100x)').alpha, 1);
});

test('autoplay HUD kalan dönüşü gösterir ve durdur düğmesini değiştirir', () => {
  const hud = new Hud({});
  const countButton = buttonWith(hud, 'OTO ×10');
  const toggleButton = buttonWith(hud, 'OTO BAŞLAT');
  hud.setAutoplay({ selected: 25, remaining: 17, running: true });
  const status = hud.children.find((item) => item.text === 'KALAN 17 TUR');
  assert.ok(countButton.children.some((child) => child.text === 'OTO ×25'));
  assert.ok(toggleButton.children.some((child) => child.text === 'DURDUR'));
  assert.equal(status.text, 'KALAN 17 TUR');

  hud.setAutoplay({ selected: 25, remaining: 0, running: false });
  assert.ok(toggleButton.children.some((child) => child.text === 'OTO BAŞLAT'));
  assert.equal(status.text, '');
});

test('bakiye sıfırlama düğmesi yalnızca bakiye bittiğinde görünür', () => {
  const hud = new Hud({});
  const resetButton = buttonWith(hud, 'BAKİYEYİ SIFIRLA');
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
  const audioButton = buttonWith(hud, 'SES AÇIK');
  hud.setAudioEnabled(false);
  assert.ok(audioButton.children.some((child) => child.text === 'SES KAPALI'));
  hud.setAudioEnabled(true);
  assert.ok(audioButton.children.some((child) => child.text === 'SES AÇIK'));
});

test('soru düğmesi kurallar ekranını açıp kapatır', () => {
  const hud = new Hud({});
  const rulesButton = buttonWith(hud, '?');
  const panel = hud.children.at(-1);
  assert.equal(panel.visible, false);
  rulesButton.emit('pointertap');
  assert.equal(panel.visible, true);
  assert.equal(hud.hasModal, true);
  assert.equal(hud.dismissModal(), true);
  assert.equal(hud.hasModal, false);
  rulesButton.emit('pointertap');
  rulesButton.emit('pointertap');
  assert.equal(panel.visible, false);
});

test('mobil kontroller büyür, yön değişince masaüstü ölçülerine döner', () => {
  const hud = new Hud({});
  const help = buttonWith(hud, '?');
  const minus = buttonWith(hud, '−');
  const auto = buttonWith(hud, 'OTO BAŞLAT');
  hud.layout('portrait');
  for (const button of [help, minus, auto]) {
    assert.ok(button.hitArea.contains(41, 41), '390px ekranda yaklaşık 45px dokunma alanı');
    assert.equal(button.hitArea.contains(0, 43), false);
  }
  hud.layout('landscape');
  assert.equal(help.hitArea.contains(17, 0), false);
  assert.equal(minus.hitArea.contains(18, 0), false);
});

test('bonus sonucu atlanınca resmi tutar görünür ve modal kapanır', async () => {
  const animator = { tween: async (target, to, duration, ease, update) => {
    Object.assign(target, to); update?.();
  }, wait: () => new Promise(() => {}) };
  const hud = new Hud(animator);
  hud.layout('portrait');
  const result = hud.showBonusSummary({ win: 123.45, multiplier: 25, spins: 10, bet: 1 });
  assert.equal(hud.hasModal, true);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(hud.dismissModal(), true);
  await result;
  assert.equal(hud.hasModal, false);
});


test('HUD bonus çarpanını şefe yönlendirir ve yeni turda temizler', async () => {
  const { ChefBonusView } = await import('../src/view/ChefBonusView.js');
  const animator = { tween: async (target, to) => {
    for (const [key, value] of Object.entries(to)) {
      if (key === 'scale') target.scale.set(value); else target[key] = value;
    }
  } };
  const hud = new Hud(animator);
  const chef = hud.children.find(item => item instanceof ChefBonusView);
  hud.beginRound(); hud.setMultiplier(7);
  assert.equal(chef.total, 0, 'ana oyun tencereye eklenmemeli');
  hud.setSpinMode('free'); hud.setMultiplier(2); hud.setMultiplier(5);
  assert.equal(chef.total, 5);
  assert.equal(chef.active, true);
  hud.layout('portrait'); hud.update(16); hud.layout('landscape');
  assert.equal(chef.total, 5, 'yön değişikliği toplamı sıfırlamamalı');
  hud.finishRound();
  assert.equal(chef.total, 5);
  assert.equal(chef.active, false);
  hud.beginRound();
  assert.equal(chef.total, 0);
});
