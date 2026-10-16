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

test('BİTİR mevcut dönüşü tamamlamaya açılırken yeni bahis kontrolleri kilitli kalır', () => {
  const hud = new Hud({});
  let spins = 0;
  hud.on('spin', () => { spins++; });
  hud.setControls({ canSpin: false, canFinishSpin: true, canChangeBet: false });
  const finish = buttonWith(hud, 'BİTİR');
  assert.equal(finish.enabled, true);
  assert.equal(finish.accessibleLabel, 'Bu dönüşün animasyonunu bitir');
  assert.equal(buttonWith(hud, '+').enabled, false);
  finish.press();
  assert.equal(spins, 1);
  hud.setControls({ canSpin: false, canFinishSpin: false, canChangeBet: false });
  assert.equal(finish.enabled, false);
  assert.ok(finish.children.some(child => child.text === 'SPIN'));
  finish.press();
  assert.equal(spins, 1);
});

test('geçmiş ve ayarlar düğmeleri mobilde dokunulabilir; dönüş sırasında mola için erişilebilir', () => {
  const hud = new Hud({});
  const history = buttonWith(hud, 'GEÇMİŞ');
  const settings = buttonWith(hud, 'AYARLAR');
  const events = [];
  hud.on('history', () => events.push('history'));
  hud.on('settings', () => events.push('settings'));
  hud.layout('portrait');
  hud.setControls({ canSpin: false, canChangeBet: false });
  assert.equal(history.enabled, true);
  assert.equal(settings.enabled, true);
  assert.equal(history.x, 166); assert.equal(settings.x, 350);
  assert.equal(history.hitArea.height, 84); assert.equal(settings.hitArea.width, 164);
  assert.equal(buttonWith(hud, 'SES AÇIK').visible, false, 'mobilde ses ayarlar menüsündedir');
  history.press(); settings.press();
  assert.deepEqual(events, ['history', 'settings']);
  hud.layout('landscape');
  assert.equal(history.hitArea.width, 36);
  assert.equal(settings.hitArea.width, 36);
  assert.equal(history.accessibleLabel, 'Tur geçmişi');
  assert.equal(settings.accessibleLabel, 'Ses ve oyun ayarları');
  assert.equal(buttonWith(hud, 'SES AÇIK').visible, true);
});

test('kazanç formülü para tutarlarını ve tavan açıklamasını korur; yeni dönüşte temizlenir', () => {
  const hud = new Hud({});
  hud.showSpinBreakdown({ raw: 0.4, multiplier: 12, payout: 4.8 });
  const formula = hud.children.find(item => item.label === 'spin-breakdown');
  assert.equal(formula.text, '0,40 × 12 = 4,80');
  assert.equal(formula.visible, true);
  hud.layout('portrait');
  assert.equal(formula.y, 681);
  assert.equal(formula.text, '0,40 × 12 = 4,80');
  hud.showSpinBreakdown({ raw: 2, multiplier: 4, payout: 6, capped: true });
  assert.equal(formula.text, '2,00 × 4 = 6,00 · TAVAN');
  hud.clearSpinBreakdown();
  assert.equal(formula.visible, false);
  assert.equal(formula.text, '');
});

test('mobil bonusta şef büyür, kullanılmayan kontroller gizlenir; sonuçta tekrar açılır', async () => {
  const { ChefBonusView } = await import('../src/view/ChefBonusView.js');
  const hud = new Hud({});
  const chef = hud.children.find(item => item instanceof ChefBonusView);
  hud.layout('portrait');
  const controls = ['BONUS AL (100x)', 'OTO ×10', 'OTO BAŞLAT'].map(value => buttonWith(hud, value));
  assert.ok(controls.every(button => button.visible));
  hud.setSpinMode('free'); hud.setMultiplier(25);
  assert.deepEqual(chef.collectionTarget, { x: 220, y: 1170 });
  assert.ok(controls.every(button => !button.visible));
  assert.equal(buttonWith(hud, 'GEÇMİŞ').visible, true);
  assert.equal(buttonWith(hud, 'AYARLAR').visible, true);
  hud.layout('landscape');
  assert.deepEqual(chef.collectionTarget, { x: 160, y: 400 });
  assert.ok(controls.every(button => button.visible));
  hud.layout('portrait');
  assert.deepEqual(chef.collectionTarget, { x: 220, y: 1170 });
  hud.finishRound(); hud.finishRound();
  assert.equal(chef.total, 25);
  assert.deepEqual(chef.collectionTarget, { x: 146, y: 1236 });
  assert.ok(controls.every(button => button.visible), 'yeni bonus hemen satın alınabilmeli');
  hud.beginRound();
  assert.equal(chef.total, 0);
  assert.ok(controls.every(button => button.visible));
});

test('erişilebilir klavye odağı yalnızca açık ödeme, satın alma veya sonuç penceresine gider', async () => {
  const animator = { tween: async (target, to, duration, ease, update) => {
    Object.assign(target, to); update?.();
  }, wait: () => new Promise(() => {}) };
  const hud = new Hud(animator);
  assert.equal(hud.accessibilityRoot, hud);
  buttonWith(hud, '?').press();
  assert.equal(hud.rulesOpen, true);
  assert.equal(hud.accessibilityRoot, hud.children.at(-1));
  assert.equal(hud.accessibilityRoot.accessibilityModal, true);
  hud.dismissModal();
  const purchase = hud.confirmBonusPurchase(100);
  assert.equal(hud.purchaseOpen, true);
  assert.notEqual(hud.accessibilityRoot, hud);
  assert.equal(hud.accessibilityRoot.accessibilityModal, true);
  assert.ok(hud.accessibilityRoot.children.some(child => child.text === 'BONUS SATIN AL'));
  hud.dismissModal(); await purchase;
  const summary = hud.showBonusSummary({ win: 12, multiplier: 5, spins: 10 });
  assert.equal(hud.featureOpen, true);
  assert.notEqual(hud.accessibilityRoot, hud);
  assert.equal(hud.accessibilityRoot.accessibilityModal, true);
  await new Promise(resolve => setImmediate(resolve));
  hud.dismissModal(); await summary;
  assert.equal(hud.accessibilityRoot, hud);
});
