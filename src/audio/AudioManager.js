const PREFERENCE_KEY = 'mutfak-slot.audio-enabled.v1';

const SOUNDS = {
  spin: [{ frequency: 230, end: 150, duration: 0.11, type: 'triangle', volume: 0.045 }],
  drop: [{ frequency: 390, end: 230, duration: 0.075, type: 'sine', volume: 0.035 }],
  burst: [
    { frequency: 520, end: 310, duration: 0.09, type: 'square', volume: 0.035 },
    { frequency: 310, end: 170, duration: 0.13, type: 'triangle', volume: 0.025, delay: 0.035 },
  ],
  multiplier: [
    { frequency: 440, duration: 0.09, type: 'sine', volume: 0.04 },
    { frequency: 660, duration: 0.12, type: 'sine', volume: 0.045, delay: 0.065 },
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
};

/** Telifli dosya kullanmadan kısa efektleri WebAudio osilatörleriyle üretir. */
export class AudioManager {
  #createContext;
  #context = null;
  #enabled = this.#readPreference();

  constructor({ createContext = () => {
    const Context = globalThis.AudioContext ?? globalThis.webkitAudioContext;
    return Context ? new Context() : null;
  } } = {}) {
    this.#createContext = createContext;
  }

  get enabled() {
    return this.#enabled;
  }

  /** İlk kullanıcı eylemi sırasında çağrılarak tarayıcı ses kilidini açar. */
  unlock() {
    if (!this.#enabled) return;
    try {
      this.#context ??= this.#createContext();
      const resumed = this.#context?.resume?.();
      resumed?.catch?.(() => {});
    } catch {
      this.#context = null;
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
  }

  play(name) {
    if (!this.#enabled || !this.#context) return;
    for (const note of SOUNDS[name] ?? []) this.#playNote(note);
  }

  #playNote({ frequency, end = frequency, duration, type, volume, delay = 0 }) {
    try {
      const context = this.#context;
      const start = context.currentTime + delay;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, start);
      oscillator.frequency.linearRampToValueAtTime(end, start + duration);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(volume, start + 0.012);
      gain.gain.linearRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.015);
    } catch {
      // Bazı gömülü tarayıcılarda ses donanımı erişilemeyebilir.
    }
  }

  #readPreference() {
    try {
      return globalThis.localStorage?.getItem(PREFERENCE_KEY) !== 'false';
    } catch {
      return true;
    }
  }
}
