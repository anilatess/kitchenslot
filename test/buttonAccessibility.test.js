import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import * as fake from './helpers/fakePixi.js';

mock.module('pixi.js', { namedExports: { Container: fake.Container, Graphics: fake.Graphics, Text: fake.Text } });
const { Button } = await import('../src/view/Button.js');
const { ButtonAccessibility } = await import('../src/view/ButtonAccessibility.js');

function fakeDocument() {
  const doc = { activeElement: null };
  doc.createElement = (tag) => ({
    tagName: tag, style: {}, attributes: {}, children: [], listeners: new Map(), hidden: false, disabled: false,
    setAttribute(key, value) { this.attributes[key] = String(value); },
    removeAttribute(key) { delete this.attributes[key]; },
    appendChild(child) { this.children.push(child); child.parentNode = this; },
    remove() { this.parentNode?.children.splice(this.parentNode.children.indexOf(this), 1); this.parentNode = null; },
    addEventListener(name, handler) { this.listeners.set(name, handler); },
    dispatch(name, values = {}) {
      const event = { ...values, stopped: false, prevented: false,
        stopPropagation() { this.stopped = true; }, preventDefault() { this.prevented = true; } };
      this.listeners.get(name)?.(event);
      return event;
    },
    focus() {
      doc.activeElement?.dispatch('blur');
      doc.activeElement = this;
      this.dispatch('focus');
    },
  });
  doc.body = doc.createElement('body');
  return doc;
}

function fixture(run) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const doc = fakeDocument();
  Object.defineProperty(globalThis, 'document', { configurable: true, value: doc });
  const stage = new fake.Container();
  const hud = stage.addChild(new fake.Container());
  const modal = stage.addChild(new fake.Container());
  modal.accessibilityModal = true;
  modal.visible = false;
  const makeButton = (label, parent = hud) => {
    const button = parent.addChild(new Button({ label, width: 100, height: 40 }));
    button.getBounds = () => ({ rectangle: { x: 20, y: 30, width: 100, height: 40 } });
    return button;
  };
  let root = hud;
  const canvas = { parentNode: doc.body, getBoundingClientRect: () => ({ left: 10, top: 15, width: 640, height: 360 }) };
  const button = makeButton('SPIN');
  const bridge = new ButtonAccessibility(stage, canvas, { getRoot: () => root, getScreenSize: () => ({ width: 1280, height: 720 }) });
  const layer = doc.body.children[0];
  try { run({ doc, stage, hud, modal, makeButton, button, bridge, layer, setRoot: (value) => { root = value; } }); }
  finally {
    bridge.destroy();
    if (previous) Object.defineProperty(globalThis, 'document', previous);
    else delete globalThis.document;
  }
}

test('gerçek düğme etiketi, seçili/pasif durumu ve ölçeklenmiş sınırları güncellenir', () => {
  fixture(({ button, bridge, layer }) => {
    const element = layer.children[0];
    assert.equal(element.tagName, 'button');
    assert.equal(element.type, 'button');
    assert.equal(element.attributes['aria-label'], 'Döndür');
    assert.equal(element.style.pointerEvents, 'none', 'fare ve dokunma canvas üzerinde kalır');
    assert.equal(element.style.left, '10px');
    assert.equal(element.style.top, '15px');
    assert.equal(element.style.width, '50px');
    assert.equal(element.style.height, '20px');
    assert.equal(element.attributes['aria-pressed'], undefined);
    button.setLabel('DURDUR');
    button.setSelected(true);
    button.setEnabled(false);
    bridge.update();
    assert.equal(element.attributes['aria-label'], 'DURDUR');
    assert.equal(element.attributes['aria-pressed'], 'true');
    assert.equal(element.disabled, true);
    assert.equal(element.tabIndex, -1);
    button.setEnabled(true);
    button.setAccessibleLabel('Tur animasyonlarını tamamla');
    bridge.update();
    assert.equal(element.disabled, false);
    assert.equal(element.attributes['aria-label'], 'Tur animasyonlarını tamamla');
  });
});

test('Enter/Space yerel tuşa bırakılır, global SPIN tetiklenmez ve tekrar tuşu bastırılır', () => {
  fixture(({ button, layer }) => {
    let presses = 0;
    button.on('press', () => presses++);
    const element = layer.children[0];
    for (const code of ['Space', 'Enter']) {
      const down = element.dispatch('keydown', { code });
      assert.equal(down.stopped, true);
      assert.equal(down.prevented, false);
      assert.equal(presses, code === 'Space' ? 0 : 1, 'köprü ayrıca yapay bir keydown tıklaması üretmez');
      element.dispatch('click');
      assert.equal(element.dispatch('keyup', { code }).stopped, true);
      assert.equal(element.dispatch('keydown', { code, repeat: true }).prevented, true);
    }
    assert.equal(presses, 2);
    button.setEnabled(false);
    element.dispatch('click');
    assert.equal(presses, 2);
  });
});

test('modal odağı ve Tab döngüsü korunur; eski kapsamda kalan tuşlar tıklanamaz', () => {
  fixture(({ button, bridge, layer, hud, modal, makeButton, setRoot, doc }) => {
    const spin = layer.children[0];
    spin.focus();
    let presses = 0;
    button.on('press', () => presses++);
    const yes = makeButton('EVET', modal);
    makeButton('VAZGEÇ', modal);
    modal.visible = true;
    setRoot(modal);
    spin.dispatch('click');
    assert.equal(presses, 0, 'güncelleme gelmeden değişen kapsam da korunur');
    bridge.update();
    const accept = layer.children[1], cancel = layer.children[2];
    assert.equal(spin.hidden, true);
    assert.equal(doc.activeElement, accept);
    assert.equal(accept.dispatch('keydown', { key: 'Tab', shiftKey: true }).prevented, true);
    assert.equal(doc.activeElement, cancel);
    cancel.dispatch('keydown', { key: 'Tab', shiftKey: false });
    assert.equal(doc.activeElement, accept);
    yes.setEnabled(false);
    bridge.update();
    assert.equal(accept.disabled, true);
    modal.visible = false;
    setRoot(hud);
    bridge.update();
    assert.equal(doc.activeElement, spin, 'modal kapanınca önceki kontrol odağı geri gelir');
    setRoot(null);
    bridge.update();
    assert.ok(layer.children.every((element) => element.hidden && element.disabled));
    setRoot(hud);
    bridge.update();
    assert.equal(doc.activeElement, spin);
  });
});

test('gizlenen ebeveynlerin kontrolleri kaldırılır; destroy DOM katmanını temizler', () => {
  fixture(({ doc, hud, layer, bridge }) => {
    hud.visible = false;
    bridge.update();
    assert.equal(layer.children[0].hidden, true);
    bridge.destroy();
    assert.equal(doc.body.children.length, 0);
    assert.doesNotThrow(() => bridge.update());
  });
});
