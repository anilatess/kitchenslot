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

function withStorage(values, run) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) },
  });
  try { run(); } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else delete globalThis.localStorage;
  }
}

test('ses düzeyi saklanır; kapatıp açmak tercih edilen düzeyi değiştirmez', () => {
  withStorage(new Map(), () => {
    const audio = new AudioManager({ createContext: () => fakeContext() });
    assert.equal(audio.volume, 1);
    audio.setVolume(0.35);
    audio.setEnabled(false);
    const restored = new AudioManager({ createContext: () => fakeContext() });
    assert.equal(restored.enabled, false);
    assert.equal(restored.volume, 0.35);
    restored.setEnabled(true);
    assert.equal(restored.volume, 0.35);
    restored.setVolume(0);
    assert.equal(new AudioManager().volume, 0, 'sıfır geçerli ve kalıcı bir ses düzeyidir');
  });
});

test('ses düzeyi sınırlandırılır, geçersiz değerler mevcut tercihi bozmaz', () => {
  withStorage(new Map(), () => {
    const audio = new AudioManager();
    assert.equal(audio.setVolume(-2), 0);
    assert.equal(audio.setVolume(5), 1);
    audio.setVolume(0.42);
    for (const value of [NaN, Infinity, -Infinity, undefined, null, '0.5']) {
      assert.equal(audio.setVolume(value), 0.42);
    }
  });
  for (const [stored, expected] of [['invalid', 1], ['NaN', 1], ['', 1], ['-2', 0], ['5', 1], ['0', 0]]) {
    withStorage(new Map([['mutfak-slot.audio-volume.v1', stored]]), () => {
      assert.equal(new AudioManager().volume, expected);
    });
  }
});

test('tek ana kazanç hem aktif hem gecikmeli efektlerin düzeyini değiştirir', () => {
  withStorage(new Map(), () => {
    const context = trackedContext();
    context.gains = [];
    context.createGain = () => {
      const item = {
        changes: [], target: null,
        gain: { setValueAtTime: (value, time) => item.changes.push([value, time]), linearRampToValueAtTime() {} },
        connect(target) { this.target = target; }, disconnect() {},
      };
      context.gains.push(item);
      return item;
    };
    const audio = new AudioManager({ createContext: () => context });
    audio.setVolume(0.6);
    assert.equal(context.gains.length, 0, 'ayar değiştirmek kullanıcı hareketinden önce AudioContext açmaz');
    audio.unlock();
    audio.play('freeSpin');
    const master = context.gains[0];
    assert.equal(master.target, context.destination);
    assert.ok(context.gains.slice(1).every((gain) => gain.target === master));
    context.currentTime = 0.05;
    audio.setVolume(0.2);
    assert.deepEqual(master.changes.at(-1), [0.2, 0.05]);
    audio.setVolume(0);
    assert.deepEqual(master.changes.at(-1), [0, 0.05]);
    const voicesBefore = context.sources.length;
    audio.play('bigWin');
    assert.equal(context.sources.length, voicesBefore);
    audio.setVolume(1);
    for (const cue of ['bigWin', 'megaWin', 'superWin', 'bonusEnd', 'multiplyWin', 'burst', 'drop']) audio.play(cue);
    assert.ok(context.sources.length <= 20);
    assert.equal(context.gains.length, context.sources.length + 1, 'ana kazanç yeniden oluşturulmaz');
  });
});

test('geçici sessizlik aktif sesleri durdurur; aç/kapa ve düzey tercihlerini saklar', () => {
  const values = new Map();
  withStorage(values, () => {
    const context = trackedContext();
    const audio = new AudioManager({ createContext: () => context });
    audio.setVolume(0.7);
    audio.unlock();
    audio.play('freeSpin');
    audio.setSuspended(true);
    assert.ok(context.sources.every((source) => source.immediateStops === 1));
    assert.equal(audio.enabled, true);
    assert.equal(audio.volume, 0.7);
    assert.equal(values.has('mutfak-slot.audio-enabled.v1'), false);
    const before = context.sources.length;
    audio.play('bigWin');
    audio.unlock();
    assert.equal(context.sources.length, before);
    assert.equal(context.resumed, 1);
    audio.setSuspended(false);
    audio.unlock();
    audio.play('bigWin');
    assert.ok(context.sources.length > before);
    audio.setEnabled(false);
    audio.setSuspended(true);
    audio.setSuspended(false);
    assert.equal(audio.enabled, false, 'odak kazanmak kullanıcının kapattığı sesi açmaz');
  });
});
