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
