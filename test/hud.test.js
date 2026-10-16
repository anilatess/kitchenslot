import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import * as fake from './helpers/fakePixi.js';

mock.module('pixi.js', { namedExports: { Container: fake.Container, Graphics: fake.Graphics, Text: fake.Text, Sprite: fake.Sprite, Assets: fake.Assets } });

const { Hud } = await import('../src/view/Hud.js');
const { MobileMenu } = await import('../src/view/MobileMenu.js');

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
  const menu = buttonWith(hud, '☰');
  hud.layout('portrait');
  for (const button of [menu, buttonWith(hud, 'BONUS AL (100x)')]) {
    assert.ok(button.hitArea.contains(41, 41), '390px ekranda yaklaşık 45px dokunma alanı');
    assert.equal(button.hitArea.contains(0, 43), false);
  }
  assert.ok(minus.hitArea.width < menu.hitArea.width, 'bahis düğmeleri ana kontrollerden küçük olmalı');
  assert.equal(buttonWith(hud, '+').hitArea.width, minus.hitArea.width);
  assert.equal(help.visible, false, 'yardım menüye taşınır');
  assert.equal(menu.visible, true);
  hud.layout('landscape');
  assert.equal(menu.visible, false);
  assert.equal(help.visible, true);
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

test('mobilde yardımcı kontroller tek menüdedir; geçmiş ve ayarlar menü kapandıktan sonra açılır', () => {
  const hud = new Hud({});
  const history = buttonWith(hud, 'GEÇMİŞ');
  const settings = buttonWith(hud, 'AYARLAR');
  const events = [];
  hud.on('history', () => events.push('history'));
  hud.on('settings', () => events.push('settings'));
  hud.layout('portrait');
  hud.setControls({ canSpin: false, canChangeBet: false });
  assert.equal(history.visible, false);
  assert.equal(settings.visible, false);
  const menu = hud.children.find(item => item instanceof MobileMenu);
  const opener = buttonWith(hud, '☰');
  for (const [label, event] of [['GEÇMİŞ', 'history'], ['SES AYARLARI', 'settings']]) {
    opener.press();
    assert.equal(hud.menuOpen, true);
    assert.equal(hud.hasModal, true);
    assert.equal(hud.accessibilityRoot, menu);
    assert.equal(menu.accessibilityModal, true);
    const action = buttonWith(menu, label);
    assert.equal(action.enabled, true);
    assert.ok(action.hitArea.width >= 230 && action.hitArea.height >= 80);
    let closedBeforeAction = false;
    hud.on(event, () => { closedBeforeAction = !hud.hasModal; });
    action.press();
    assert.equal(closedBeforeAction, true);
  }
  assert.equal(buttonWith(hud, 'SES AÇIK').visible, false, 'mobilde ses ayarlar menüsündedir');
  assert.deepEqual(events, ['history', 'settings']);
  opener.press();
  hud.layout('landscape');
  assert.equal(hud.menuOpen, false);
  assert.equal(history.visible, true);
  assert.equal(settings.visible, true);
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

test('mobilde şef her durumda büyük kalır; yalnızca ana kontroller görünür ve çakışmaz', async () => {
  const { ChefBonusView } = await import('../src/view/ChefBonusView.js');
  const hud = new Hud({});
  const chef = hud.children.find(item => item instanceof ChefBonusView);
  hud.layout('portrait');
  hud.setBankrupt(false);
  const visible = () => hud.children.filter(item => item.isAccessibleButton && item.visible);
  assert.equal(visible().length, 5, 'bahis−/+, bonus, SPIN ve menü');
  const controls = visible();
  const overlaps = (a, b) => Math.abs(a.x - b.x) < (a.hitArea.width + b.hitArea.width) / 2
    && Math.abs(a.y - b.y) < (a.hitArea.height + b.hitArea.height) / 2;
  for (let a = 0; a < controls.length; a++) for (let b = a + 1; b < controls.length; b++) {
    assert.equal(overlaps(controls[a], controls[b]), false, 'dokunma alanları birbirine girmemeli');
  }
  for (const button of controls) {
    assert.ok(button.x - button.hitArea.width / 2 >= 0 && button.x + button.hitArea.width / 2 <= 720);
    assert.ok(button.y - button.hitArea.height / 2 >= 0 && button.y + button.hitArea.height / 2 <= 1280);
  }
  const target = { x: 190, y: 1146 };
  assert.deepEqual(chef.collectionTarget, target);
  hud.setSpinMode('free'); hud.setMultiplier(25);
  assert.deepEqual(chef.collectionTarget, target);
  assert.equal(visible().length, 4);
  assert.equal(buttonWith(hud, 'BONUS AL (100x)').visible, false);
  assert.equal(buttonWith(hud, '☰').visible, true);
  hud.layout('landscape');
  assert.deepEqual(chef.collectionTarget, { x: 160, y: 400 });
  assert.equal(buttonWith(hud, 'OTO BAŞLAT').visible, true);
  hud.layout('portrait');
  assert.deepEqual(chef.collectionTarget, target);
  hud.finishRound(); hud.finishRound();
  assert.equal(chef.total, 25);
  assert.deepEqual(chef.collectionTarget, target);
  assert.equal(buttonWith(hud, 'BONUS AL (100x)').visible, true);
  hud.beginRound();
  assert.equal(chef.total, 0);
  assert.deepEqual(chef.collectionTarget, target);
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
