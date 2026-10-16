import test from 'node:test';
import assert from 'node:assert/strict';
import { AudioManager } from '../src/audio/AudioManager.js';

function fakeContext() {
  const context = {
    currentTime: 0,
    destination: {},
    resumed: 0,
    oscillators: 0,
    resume() { this.resumed++; return Promise.resolve(); },
    createOscillator() {
      this.oscillators++;
      return {
        frequency: { setValueAtTime() {}, linearRampToValueAtTime() {} },
        connect() {}, start() {}, stop() {},
      };
    },
    createGain() {
      return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {} }, connect() {} };
    },
  };
  return context;
}

test('ses ilk kullanıcı eyleminde açılır ve efektler osilatörlerle üretilir', () => {
  const context = fakeContext();
  const audio = new AudioManager({ createContext: () => context });
  audio.play('spin');
  assert.equal(context.oscillators, 0);
  audio.unlock();
  audio.play('freeSpin');
  assert.equal(context.resumed, 1);
  assert.equal(context.oscillators, 3);
});

test('ses kapalıyken efekt çalmaz ve tercih saklanıp yeniden yüklenir', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const values = new Map();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) },
  });
  try {
    const context = fakeContext();
    const audio = new AudioManager({ createContext: () => context });
    audio.setEnabled(false);
    audio.unlock();
    audio.play('bigWin');
    assert.equal(context.oscillators, 0);
    assert.equal(values.get('mutfak-slot.audio-enabled.v1'), 'false');

    const restored = new AudioManager({ createContext: () => context });
    assert.equal(restored.enabled, false);
    restored.setEnabled(true);
    restored.play('burst');
    assert.equal(context.oscillators, 2);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else delete globalThis.localStorage;
  }
});

test('WebAudio olmayan veya depolaması kapalı ortamda hata dışarı taşmaz', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() { throw new Error('kapalı'); },
  });
  try {
    const audio = new AudioManager({ createContext: () => null });
    assert.doesNotThrow(() => audio.unlock());
    assert.doesNotThrow(() => audio.setEnabled(false));
    assert.doesNotThrow(() => audio.play('scatter'));
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else delete globalThis.localStorage;
  }
});

function trackedContext() {
  const context = fakeContext();
  context.sources = [];
  context.buffers = 0;
  context.sampleRate = 8000;
  const createOscillator = context.createOscillator.bind(context);
  const track = (source) => {
    source.immediateStops = 0;
    source.disconnected = 0;
    source.stop = (time) => { if (time === undefined) source.immediateStops++; };
    source.disconnect = () => source.disconnected++;
    context.sources.push(source);
    return source;
  };
  context.createOscillator = () => track(createOscillator());
  context.createBuffer = (_channels, length) => {
    context.buffers++;
    return { getChannelData: () => new Float32Array(length) };
  };
  context.createBufferSource = () => track({ connect() {}, start() {} });
  return context;
}

test('hızlı çarpan toplama sesleri yinelenmez ve kaynaklar sınırlı tutulur', () => {
  const context = trackedContext();
  const audio = new AudioManager({ createContext: () => context });
  audio.unlock();
  for (let index = 0; index < 100; index++) {
    audio.play('multiplier');
    audio.play('sizzle');
  }
  assert.equal(context.sources.length, 3, 'aynı anda iki nota ve bir kısa kızartma sesi yeterli');
  for (const cue of ['freeSpin', 'bigWin', 'megaWin', 'superWin', 'bonusEnd', 'multiplyWin', 'burst', 'drop']) audio.play(cue);
  assert.ok(context.sources.length <= 20, 'efektler üst üste geldiğinde polifoni sınırı korunmalı');
  audio.setEnabled(false);
  assert.ok(context.sources.every((source) => source.immediateStops === 1));
  assert.ok(context.sources.every((source) => source.disconnected === 1));
});

test('kızartma tamponu tekrar kullanılır; biten kaynaklar sonraki efektlere yer açar', () => {
  const context = trackedContext();
  const audio = new AudioManager({ createContext: () => context });
  audio.unlock();
  audio.play('sizzle');
  context.currentTime = 1;
  audio.play('sizzle');
  assert.equal(context.buffers, 1);
  assert.equal(context.sources.length, 2);
  assert.equal(context.sources[0].disconnected, 1);
  context.currentTime = 2;
  audio.play('freeSpin');
  assert.equal(context.oscillators, 3);
});
