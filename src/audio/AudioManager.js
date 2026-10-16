const PREFERENCE_KEY = 'mutfak-slot.audio-enabled.v1';
const VOLUME_KEY = 'mutfak-slot.audio-volume.v1';
const MAX_VOICES = 20;
const COOLDOWN = { spin: 0.08, drop: 0.055, burst: 0.095, multiplier: 0.09, sizzle: 0.24, tumbleWin: 0.15 };

const SOUNDS = {
  spin: [{ frequency: 230, end: 150, duration: 0.11, type: 'triangle', volume: 0.045 }],
  drop: [{ frequency: 390, end: 230, duration: 0.075, type: 'sine', volume: 0.035 }],
  burst: [
    { frequency: 520, end: 310, duration: 0.09, type: 'square', volume: 0.035 },
    { frequency: 310, end: 170, duration: 0.13, type: 'triangle', volume: 0.025, delay: 0.035 },
  ],
  multiplier: [
    { frequency: 587, end: 560, duration: 0.09, type: 'sine', volume: 0.035 },
    { frequency: 880, end: 830, duration: 0.17, type: 'sine', volume: 0.04, delay: 0.055 },
  ],
  // Kısa kızartma sesi; sürekli bir döngü veya harici ses dosyası oluşturmaz.
  sizzle: [{ noise: true, duration: 0.22, volume: 0.045 }],
  tumbleWin: [{ frequency: 784, end: 920, duration: 0.14, type: 'sine', volume: 0.035 }],
  multiplyWin: [
    { frequency: 392, duration: 0.13, type: 'sine', volume: 0.04 },
    { frequency: 587, duration: 0.18, type: 'sine', volume: 0.045, delay: 0.085 },
    { frequency: 784, duration: 0.22, type: 'sine', volume: 0.04, delay: 0.17 },
  ],
  bonusEnd: [
    { frequency: 784, duration: 0.18, type: 'triangle', volume: 0.045 },
    { frequency: 659, duration: 0.18, type: 'triangle', volume: 0.04, delay: 0.11 },
    { frequency: 523, duration: 0.32, type: 'sine', volume: 0.05, delay: 0.22 },
  ],
  scatter: [
    { frequency: 660, duration: 0.12, type: 'sine', volume: 0.045 },
    { frequency: 880, duration: 0.14, type: 'sine', volume: 0.05, delay: 0.09 },
    { frequency: 1100, duration: 0.2, type: 'sine', volume: 0.055, delay: 0.18 },
  ],
  freeSpin: [
    { frequency: 523, duration: 0.16, type: 'triangle', volume: 0.05 },
    { frequency: 659, duration: 0.16, type: 'triangle', volume: 0.05, delay: 0.11 },
    { frequency: 784, duration: 0.23, type: 'triangle', volume: 0.055, delay: 0.22 },
  ],
  bigWin: [
    { frequency: 523, duration: 0.16, type: 'triangle', volume: 0.055 },
    { frequency: 659, duration: 0.16, type: 'triangle', volume: 0.055, delay: 0.12 },
    { frequency: 784, duration: 0.16, type: 'triangle', volume: 0.06, delay: 0.24 },
    { frequency: 1046, duration: 0.35, type: 'triangle', volume: 0.065, delay: 0.36 },
  ],
  megaWin: [
    { frequency: 659, duration: 0.15, type: 'triangle', volume: 0.06 },
    { frequency: 784, duration: 0.15, type: 'triangle', volume: 0.06, delay: 0.1 },
    { frequency: 988, duration: 0.17, type: 'triangle', volume: 0.065, delay: 0.2 },
    { frequency: 1318, duration: 0.32, type: 'triangle', volume: 0.07, delay: 0.31 },
  ],
  superWin: [
    { frequency: 784, duration: 0.14, type: 'triangle', volume: 0.065 },
    { frequency: 988, duration: 0.14, type: 'triangle', volume: 0.065, delay: 0.09 },
    { frequency: 1175, duration: 0.16, type: 'triangle', volume: 0.07, delay: 0.18 },
    { frequency: 1568, duration: 0.24, type: 'triangle', volume: 0.075, delay: 0.28 },
    { frequency: 1318, duration: 0.38, type: 'triangle', volume: 0.07, delay: 0.45 },
  ],
};

/** Telifli dosya kullanmadan kısa efektleri WebAudio osilatörleriyle üretir. */
export class AudioManager {
  #createContext;
  #context = null;
  #enabled = this.#readPreference();
  #volume = this.#readVolume();
  #masterGain = null;
  #suspended = false;
  #voices = new Set();
  #lastPlayed = new Map();
  #sizzleBuffer = null;

  constructor({ createContext = () => {
    const Context = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    return Context ? new Context() : null;
  } } = {}) {
    this.#createContext = createContext;
  }

  get enabled() {
    return this.#enabled;
  }

  get volume() {
    return this.#volume;
  }

  /** Sekme odağı/kullanım kilidi için geçici sessizlik; kullanıcının tercihi korunur. */
  setSuspended(value) {
    this.#suspended = !!value;
    if (this.#suspended) this.#stopAll();
  }

  /** Sesi kapatmak tercih edilen düzeyi değiştirmez; tüm aktif efektler aynı ana kazancı kullanır. */
  setVolume(value) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return this.#volume;
    this.#volume = Math.min(1, Math.max(0, value));
    try { globalThis.localStorage?.setItem(VOLUME_KEY, String(this.#volume)); } catch { /* Tercih saklanamasa da ses çalışır. */ }
    this.#applyVolume();
    return this.#volume;
  }

  /** İlk kullanıcı eylemi sırasında çağrılarak tarayıcı ses kilidini açar. */
  unlock() {
    if (!this.#enabled || this.#suspended) return;
    try {
      this.#context ??= this.#createContext();
      if (this.#context && !this.#masterGain) {
        this.#masterGain = this.#context.createGain();
        this.#masterGain.connect(this.#context.destination);
        this.#applyVolume();
      }
      const resumed = this.#context?.resume?.();
      resumed?.catch?.(() => {});
    } catch {
      this.#context = null;
      this.#masterGain = null;
    }
  }

  setEnabled(enabled) {
    this.#enabled = !!enabled;
    try {
      globalThis.localStorage?.setItem(PREFERENCE_KEY, String(this.#enabled));
    } catch {
      // Ses tercihi saklanamasa da oyun çalışmaya devam eder.
    }
    if (this.#enabled) this.unlock();
    else this.#stopAll();
  }

  play(name) {
    if (!this.#enabled || this.#suspended || !this.#context || this.#volume === 0) return;
    const now = this.#context.currentTime;
    const last = this.#lastPlayed.get(name) ?? -Infinity;
    if (now - last < (COOLDOWN[name] ?? 0.08)) return;
    this.#lastPlayed.set(name, now);
    for (const voice of this.#voices) if (voice.end <= now) this.#release(voice);
    for (const note of SOUNDS[name] ?? []) this.#playNote(note);
  }

  #playNote({ frequency, end = frequency, duration, type, volume, delay = 0, noise = false }) {
    if (this.#voices.size >= MAX_VOICES) return;
    let voice;
    try {
      const context = this.#context;
      const start = context.currentTime + delay;
      const source = noise ? this.#createSizzle() : context.createOscillator();
      if (!source) return;
      const gain = context.createGain();
      if (!noise) {
        source.type = type;
        source.frequency.setValueAtTime(frequency, start);
        source.frequency.linearRampToValueAtTime(end, start + duration);
      }
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(volume, start + 0.012);
      gain.gain.linearRampToValueAtTime(0.0001, start + duration);
      source.connect(gain);
      gain.connect(this.#masterGain ?? context.destination);
      voice = { source, gain, end: start + duration + 0.015 };
      this.#voices.add(voice);
      source.onended = () => this.#release(voice);
      source.start(start);
      source.stop(voice.end);
    } catch {
      if (voice) this.#release(voice);
      // Bazı gömülü tarayıcılarda ses donanımı erişilemeyebilir.
    }
  }

  #createSizzle() {
    const context = this.#context;
    if (!context.createBuffer || !context.createBufferSource) return null;
    if (!this.#sizzleBuffer) {
      const rate = context.sampleRate || 44100;
      this.#sizzleBuffer = context.createBuffer(1, Math.ceil(rate * 0.25), rate);
      const data = this.#sizzleBuffer.getChannelData(0);
      let warm = 0;
      for (let index = 0; index < data.length; index++) {
        const noise = Math.random() * 2 - 1;
        warm = warm * 0.86 + noise * 0.14;
        data[index] = warm * 0.65 + noise * 0.13;
      }
    }
    const source = context.createBufferSource();
    source.buffer = this.#sizzleBuffer;
    return source;
  }

  #release(voice) {
    if (!this.#voices.delete(voice)) return;
    try { voice.source.disconnect?.(); voice.gain.disconnect?.(); } catch { /* ses aygıtı kapanmış olabilir */ }
  }

  #stopAll() {
    for (const voice of [...this.#voices]) {
      try { voice.source.stop(); } catch { /* tamamlanmış ses */ }
      this.#release(voice);
    }
    this.#lastPlayed.clear();
  }

  #readPreference() {
    try {
      return globalThis.localStorage?.getItem(PREFERENCE_KEY) !== 'false';
    } catch {
      return true;
    }
  }

  #applyVolume() {
    if (!this.#masterGain || !this.#context) return;
    try { this.#masterGain.gain.setValueAtTime(this.#volume, this.#context.currentTime); } catch { /* Ses aygıtı kapanmış olabilir. */ }
  }

  #readVolume() {
    try {
      const stored = globalThis.localStorage?.getItem(VOLUME_KEY);
      if (stored == null || stored.trim() === '') return 1;
      const value = Number(stored);
      return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 1;
    } catch {
      return 1;
    }
  }
}
