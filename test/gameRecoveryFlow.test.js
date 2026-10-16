import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { Emitter } from '../src/core/Emitter.js';
import { GameState } from '../src/core/GameState.js';
import { playRound as engineRound } from '../src/game/engine.js';
import { createRng } from '../src/game/rng.js';

const fixture = engineRound(createRng(77), { record: true, buy: true });
let hud, behavior, plays, generated, events;

class Hud extends Emitter {
  hasModal = false;
  dismissals = 0;
  constructor() { super(); hud = this; }
  setAudioEnabled() {} setAutoplay() {} setBalance(value) { this.balance = value; }
  setBankrupt() {} setBet() {} setTurbo() {} setControls() {} update() {}
  setWin(value) { this.win = value; } setMultiplier() {} setFreeSpins() {} finishRound() {}
  async showBanner() {} async confirmBonusPurchase() { return true; }
  dismissModal() { this.hasModal = false; this.dismissals++; }
}

mock.module('pixi.js', { namedExports: { Application: class {
  canvas = {}; ticker = { add() {} }; stage = { addChild() {} };
  async init() {} destroy() {}
} } });
mock.module('../src/game/engine.js', { namedExports: { playRound: () => {
  generated++; events.push('generated'); return structuredClone(fixture);
} } });
mock.module('../src/presenter/RoundPlayer.js', { namedExports: { RoundPlayer: class {
  async play(round, bet, options) {
    plays.push({ round, bet, options });
    options.onProgress(Math.min(round.spins.length, options.startSpin + 1));
    if (behavior === 'fail') throw new Error('görsel hata');
    return 987654321; // Sunumun dönüş değeri resmi ödeme yerine kullanılamaz.
  }
} } });
mock.module('../src/view/Hud.js', { namedExports: { Hud } });
mock.module('../src/view/GridView.js', { namedExports: { GridView: class { showPreview() {} } } });
mock.module('../src/core/ResponsiveRoot.js', { namedExports: { ResponsiveRoot: class {
  add(item) { return item; } resize() {}
} } });
mock.module('../src/animation/Animator.js', { namedExports: { Animator: class { setTurbo() {} } } });
mock.module('../src/audio/AudioManager.js', { namedExports: { AudioManager: class {
  enabled = true; unlock() {} setEnabled(value) { this.enabled = value; }
} } });

const { Game } = await import('../src/core/Game.js');
const tick = () => new Promise((resolve) => setImmediate(resolve));

function setup() {
  behavior = 'success'; plays = []; generated = 0; events = [];
  const original = Object.fromEntries(['window', 'document', 'localStorage'].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const values = new Map();
  const storageControl = { reject: false, rejectSettlement: false };
  const listeners = new Set();
  const nodes = [];
  const node = () => ({
    style: {}, children: [], setAttribute() {}, focus() {}, remove() { this.removed = true; },
    addEventListener(name, action) { this[name] = action; },
    append(...children) { this.children.push(...children); }, appendChild(child) { this.children.push(child); },
  });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      const record = JSON.parse(value);
      const previous = JSON.parse(values.get(key) ?? 'null');
      if (storageControl.reject || (storageControl.rejectSettlement && previous?.pendingRound && !record.pendingRound))
        throw new Error('kota');
      if (record.pendingRound) events.push('pending saved');
      values.set(key, value);
    },
  } });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => { const created = node(); nodes.push(created); return created; } } });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    devicePixelRatio: 1, addEventListener: (_name, fn) => listeners.add(fn), removeEventListener: (_name, fn) => listeners.delete(fn),
  } });
  const host = node();
  return { host, nodes, storageControl, key: (code, repeat = false) => {
    for (const listener of listeners) listener({ code, repeat, preventDefault() {} });
  }, restore: () => {
    for (const [key, descriptor] of Object.entries(original)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  } };
}

test('oyun motoru kesintiden önce üretir ve sunumun keyfi dönüş değeri yerine resmi toplamı öder', async () => {
  const env = setup();
  const game = new Game(env.host);
  try {
    await game.start();
    hud.emit('spin');
    await tick();
    assert.equal(generated, 1);
    assert.ok(events.indexOf('generated') < events.indexOf('pending saved'));
    const state = new GameState();
    assert.equal(state.balance, 1000 - 2 + fixture.total * 2);
    assert.equal(state.pendingRound, null);
    assert.equal(hud.win, fixture.total * 2);
  } finally { game.destroy(); env.restore(); }
});

test('oyun açılışta kayıtlı kontrol noktasını sunuma geçirir; motoru yeniden çalıştırmaz ve tekrar bahis kesmez', async () => {
  const env = setup();
  const prepared = new GameState();
  prepared.beginRound(fixture, { buy: true });
  prepared.checkpointRound(4);
  const afterDebit = prepared.balance;
  const game = new Game(env.host);
  try {
    await game.start();
    await tick();
    assert.equal(generated, 0);
    assert.equal(plays.length, 1);
    assert.equal(plays[0].options.startSpin, 4);
    assert.equal(plays[0].bet, 2);
    assert.deepEqual(plays[0].round, fixture);
    assert.equal(new GameState().balance, afterDebit + fixture.total * 2);
    assert.equal(new GameState().pendingRound, null);
  } finally { game.destroy(); env.restore(); }
});

test('sunum hata verse bile kazanılmış resmi sonuç bir kez ödenir ve oyuncuya bildirilir', async () => {
  const env = setup();
  behavior = 'fail';
  const game = new Game(env.host);
  try {
    await game.start();
    hud.emit('spin');
    await tick();
    const state = new GameState();
    assert.equal(state.balance, 1000 - 2 + fixture.total * 2);
    assert.equal(state.pendingRound, null);
    assert.equal(state.settleRound(), 0);
    assert.ok(env.nodes.some((item) => item.textContent === 'TUR TAMAMLANDI'));
  } finally { game.destroy(); env.restore(); }
});

test('yardım penceresi açıkken ve Space basılı tutulurken dönüş başlamaz; Escape pencereyi kapatır', async () => {
  const env = setup();
  const game = new Game(env.host);
  try {
    await game.start();
    hud.hasModal = true;
    env.key('Space');
    await tick();
    assert.equal(generated, 0);
    env.key('Escape');
    assert.equal(hud.dismissals, 1);
    env.key('Space', true);
    await tick();
    assert.equal(generated, 0);
    env.key('Space');
    await tick();
    assert.equal(generated, 1);
  } finally { game.destroy(); env.restore(); }
});

test('elle ve otomatik dönüşte depolama reddi yakalanır; reddedilen bahis kesilmez', async () => {
  for (const action of ['spin', 'autoplayToggle']) {
    const env = setup();
    const game = new Game(env.host);
    try {
      await game.start();
      env.storageControl.reject = true;
      hud.emit(action);
      await tick();
      assert.equal(generated, 1);
      assert.equal(plays.length, 0);
      assert.equal(new GameState().balance, 1000);
      assert.equal(new GameState().pendingRound, null);
      assert.ok(env.nodes.some((item) => item.textContent === 'TUR BAŞLATILAMADI'));
    } finally { game.destroy(); env.restore(); }
  }
});

test('ödemeyi kaydetmek reddedilirse tur korunur; tekrar dene aynı resmi sonucu tek kez öder', async () => {
  const env = setup();
  const game = new Game(env.host);
  try {
    await game.start();
    env.storageControl.rejectSettlement = true;
    hud.emit('spin');
    await tick();
    assert.equal(new GameState().balance, 998);
    assert.ok(new GameState().pendingRound);
    assert.ok(env.nodes.some((item) => item.textContent === 'TUR SONUCUN KORUNUYOR'));
    env.storageControl.rejectSettlement = false;
    const retry = env.nodes.find((item) => item.textContent === 'TEKRAR DENE');
    retry.click();
    assert.equal(new GameState().balance, 998 + fixture.total * 2);
    assert.equal(new GameState().pendingRound, null);
    assert.equal(generated, 1);
    assert.equal(plays.length, 1);
  } finally { game.destroy(); env.restore(); }
});
