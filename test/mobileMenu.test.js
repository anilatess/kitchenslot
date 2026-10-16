import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import * as fake from './helpers/fakePixi.js';

mock.module('pixi.js', { namedExports: { Container: fake.Container, Graphics: fake.Graphics, Text: fake.Text } });
const { MobileMenu } = await import('../src/view/MobileMenu.js');
const buttonWith = (menu, value) => menu.children.find(item => item.children?.some(child => child.text === value));

test('mobil menü modal açılır, durum değişimini bir kez bildirir ve kapatma çalışır', () => {
  const menu = new MobileMenu();
  const visibility = [];
  menu.on('visibilityChange', value => visibility.push(value));
  assert.equal(menu.visible, false);
  assert.equal(menu.accessibilityModal, true);
  assert.equal(menu.eventMode, 'static');
  assert.equal(menu.children.find(item => item.label === 'menu-shade').eventMode, 'static');
  menu.show(); menu.show();
  assert.equal(menu.visible, true);
  buttonWith(menu, '×').press();
  assert.equal(menu.visible, false);
  menu.hide(); menu.toggle(); menu.toggle();
  assert.deepEqual(visibility, [true, false, true, false]);
});

test('geçmiş, ses, kurallar ve otomatik dönüş eyleminden önce menü kapanır', () => {
  for (const [text, action] of [
    ['GEÇMİŞ', 'history'], ['SES AYARLARI', 'settings'], ['ÖDEME TABLOSU', 'rules'], ['OTO BAŞLAT', 'autoplayToggle'],
  ]) {
    const menu = new MobileMenu();
    const order = [];
    menu.on('visibilityChange', visible => { if (!visible) order.push('closed'); });
    menu.on('action', value => { assert.equal(menu.visible, false); order.push(value); });
    menu.show();
    buttonWith(menu, text).press();
    assert.deepEqual(order, ['closed', action]);
  }
});

test('turbo ve dönüş sayısı değişirken menü açık kalır ve resmi tercihyle güncellenir', () => {
  const menu = new MobileMenu();
  const actions = [];
  menu.on('action', value => actions.push(value));
  menu.show();
  buttonWith(menu, 'TURBO').press();
  menu.setTurbo(true);
  assert.equal(menu.visible, true);
  assert.equal(buttonWith(menu, 'TURBO AÇIK').selected, true);
  buttonWith(menu, 'OTO ×10').press();
  menu.setAutoplay({ selected: 25, remaining: 17, running: true });
  assert.ok(buttonWith(menu, 'OTO ×25'));
  assert.equal(buttonWith(menu, 'DURDUR').selected, true);
  assert.equal(menu.children.find(item => item.label === 'menu-autoplay-status').text, 'KALAN 17 TUR');
  assert.equal(menu.visible, true);
  assert.deepEqual(actions, ['turbo', 'autoplayCount']);
});

test('devam eden turda kurallar ve yeni oto başlangıcı kilitlenir; ses/geçmiş/turbo açık kalır', () => {
  const menu = new MobileMenu();
  const actions = [];
  menu.on('action', value => actions.push(value));
  menu.setControls({ canChangeBet: false, canAutoplay: false, autoplayRunning: false });
  for (const text of ['ÖDEME TABLOSU', 'OTO ×10', 'OTO BAŞLAT']) {
    assert.equal(buttonWith(menu, text).enabled, false);
    buttonWith(menu, text).press();
  }
  assert.deepEqual(actions, []);
  for (const text of ['GEÇMİŞ', 'SES AYARLARI', 'TURBO']) assert.equal(buttonWith(menu, text).enabled, true);
  menu.setAutoplay({ selected: 10, remaining: 8, running: true });
  menu.setControls({ canChangeBet: false, canAutoplay: false, autoplayRunning: true });
  assert.equal(buttonWith(menu, 'DURDUR').enabled, true, 'çalışan oto akış her zaman durdurulabilmeli');
  buttonWith(menu, 'DURDUR').press();
  assert.deepEqual(actions, ['autoplayToggle']);
});

test('düğmeler her iki yönde panel içinde ve erişilebilir dokunma ölçülerinde kalır', () => {
  const menu = new MobileMenu();
  for (const orientation of ['portrait', 'landscape', 'portrait']) {
    menu.layout(orientation);
    const width = orientation === 'portrait' ? 720 : 1280;
    const height = orientation === 'portrait' ? 1280 : 720;
    for (const button of menu.children.filter(item => item.isAccessibleButton)) {
      assert.ok(button.hitArea.width >= 72 && button.hitArea.height >= 72);
      assert.ok(button.x - button.hitArea.width / 2 >= 0);
      assert.ok(button.x + button.hitArea.width / 2 <= width);
      assert.ok(button.y - button.hitArea.height / 2 >= 0);
      assert.ok(button.y + button.hitArea.height / 2 <= height);
      assert.ok(button.accessibleLabel.length > 0);
    }
  }
  menu.show();
  menu.children.find(item => item.label === 'menu-shade').emit('pointertap');
  assert.equal(menu.visible, false, 'panel dışı dokunuş kapatmalı');
});
