import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { Emitter } from '../src/core/Emitter.js';
import { GameState } from '../src/core/GameState.js';
import { playRound as engineRound } from '../src/game/engine.js';
import { createRng } from '../src/game/rng.js';

const fixture = engineRound(createRng(77), { record: true, buy: true });
let hud, behavior, plays, generated, events, guardOwned, guardAllowed, guardLoss, panels, skips, releasePlay, ticker;

class Hud extends Emitter {
  hasModal = false;
  dismissals = 0;
  constructor() { super(); hud = this; }
  setAudioEnabled() {} setAutoplay() {} setBalance(value) { this.balance = value; }
  setBankrupt() {} setBet() {} setTurbo() {} setControls(value) { this.controls = value; } update() {}
  setWin(value) { this.win = value; } setMultiplier() {} setFreeSpins() {} finishRound() {}
  async showBanner() {} async confirmBonusPurchase() { return true; }
  dismissModal() { this.hasModal = false; this.dismissals++; }
}

mock.module('pixi.js', { namedExports: { Application: class {
  canvas = {}; ticker = ticker = { paused: false, add() {}, stop() { this.paused = true; }, start() { this.paused = false; } }; stage = { addChild() {} };
  async init() {} destroy() {}
} } });
mock.module('../src/game/engine.js', { namedExports: { playRound: () => {
  generated++; events.push('generated'); return structuredClone(fixture);
} } });
mock.module('../src/presenter/RoundPlayer.js', { namedExports: { RoundPlayer: class {
  canSkip = false;
  skipCurrentSpin() { skips++; this.canSkip = false; return true; }
  async play(round, bet, options) {
    plays.push({ round, bet, options });
    this.canSkip = true;
    options.onSkippableChange?.(true);
    if (behavior === 'hold') await new Promise((resolve) => { releasePlay = resolve; });
    this.canSkip = false;
    options.onSkippableChange?.(false);
    options.onProgress(Math.min(round.spins.length, options.startSpin + 1));
    if (behavior === 'fail') throw new Error('görsel hata');
    return 987654321; // Sunumun dönüş değeri resmi ödeme yerine kullanılamaz.
  }
} } });
mock.module('../src/core/SessionGuard.js', { namedExports: { SessionGuard: class {
  constructor({ onLost }) { guardLoss = onLost; }
  get owned() { return guardOwned; }
  async acquire() { guardOwned = guardAllowed; return guardAllowed; }
  destroy() { guardOwned = false; }
} } });
mock.module('../src/view/ButtonAccessibility.js', { namedExports: { ButtonAccessibility: class { update() {} destroy() {} } } });
mock.module('../src/view/PlayerPanels.js', { namedExports: { PlayerPanels: class {
  visible = false;
  constructor(_host, callbacks) { panels = this; this.callbacks = callbacks; }
  openSettings(value) { this.settings = value; this.visible = true; this.callbacks.onOpen(); }
  openHistory(value) { this.history = value; this.visible = true; this.callbacks.onOpen(); }
  close() { this.visible = false; this.callbacks.onClose(); }
  destroy() {}
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
  behavior = 'success'; plays = []; generated = 0; events = []; guardOwned = true; guardAllowed = true; skips = 0; hud = null;
  const original = Object.fromEntries(['window', 'document', 'localStorage'].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const values = new Map();
  const storageControl = { reject: false, rejectSettlement: false };
  const listeners = new Set();
  const documentListeners = new Map();
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
  Object.defineProperty(globalThis, 'document', { configurable: true, value: {
    hidden: false,
    addEventListener: (name, callback) => documentListeners.set(name, callback),
    removeEventListener: (name) => documentListeners.delete(name),
    createElement: () => { const created = node(); nodes.push(created); return created; },
  } });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {
    devicePixelRatio: 1, addEventListener: (_name, fn) => listeners.add(fn), removeEventListener: (_name, fn) => listeners.delete(fn),
  } });
  const host = node();
  return { host, nodes, storageControl,
    visibility(hidden) { document.hidden = hidden; documentListeners.get('visibilitychange')?.(); },
    key: (code, repeat = false, target) => {
    for (const listener of listeners) listener({ code, repeat, target, preventDefault() {} });
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

test('SPIN veya Space devam eden dönüşü bitirir; ikinci bahis ve ikinci geçmiş kaydı açmaz', async () => {
  const env = setup();
  behavior = 'hold';
  const game = new Game(env.host);
  try {
    await game.start();
    hud.emit('spin');
    await tick();
    assert.equal(hud.controls.canFinishSpin, true);
    assert.equal(new GameState().balance, 998);
    env.key('Space');
    assert.equal(skips, 1);
    assert.equal(generated, 1);
    env.key('Space');
    assert.equal(skips, 1);
    releasePlay(); await tick();
    assert.equal(new GameState().history.length, 1);
    assert.equal(new GameState().balance, 998 + fixture.total * 2);
  } finally { game.destroy(); env.restore(); }
});

test('ayarlar ve gizlenen sekme sunumu duraklatır; Space yeni bahis açmaz', async () => {
  const env = setup();
  behavior = 'hold';
  const game = new Game(env.host);
  try {
    await game.start(); hud.emit('spin'); await tick();
    hud.emit('settings');
    assert.equal(panels.visible, true);
    assert.equal(ticker.paused, true);
    env.key('Space'); assert.equal(skips, 0);
    panels.close(); assert.equal(ticker.paused, false);
    env.visibility(true); assert.equal(ticker.paused, true);
    env.key('Space'); assert.equal(skips, 0);
    env.visibility(false); assert.equal(ticker.paused, false);
    env.key('Space', false, { tagName: 'INPUT' });
    assert.equal(skips, 0);
    releasePlay(); await tick();
    hud.emit('history');
    assert.equal(panels.history.length, 1);
    assert.equal(generated, 1);
  } finally { game.destroy(); env.restore(); }
});

test('kilidi alamayan ikinci sekme oyun açmaz ve bakiye kaydına dokunmaz', async () => {
  const env = setup();
  guardAllowed = false;
  const game = new Game(env.host);
  try {
    await game.start();
    assert.equal(hud, null);
    assert.equal(generated, 0);
    assert.equal(new GameState().balance, 1000);
    assert.ok(env.nodes.some((item) => item.textContent === 'OYUN OTURUMU DURAKLATILDI'));
  } finally { game.destroy(); env.restore(); }
});

test('sahiplik kaybından önce kuyruğa alınan sunum sonucu ödeme veya tekrar-dene penceresi açamaz', async () => {
  const env = setup(); behavior = 'hold';
  const game = new Game(env.host);
  try {
    await game.start(); hud.emit('spin'); await tick();
    guardOwned = false;
    releasePlay(); await tick();
    assert.equal(new GameState().balance, 998);
    assert.ok(new GameState().pendingRound);
    assert.equal(new GameState().history.length, 0);
    assert.ok(env.nodes.some((item) => item.textContent === 'OYUN OTURUMU DURAKLATILDI'));
    assert.ok(!env.nodes.some((item) => item.textContent === 'TEKRAR DENE'));
    guardLoss();
    assert.equal(env.nodes.filter((item) => item.textContent === 'OYUN OTURUMU DURAKLATILDI').length, 1);
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
