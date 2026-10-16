import { Emitter } from './Emitter.js';
import { BETS, START_BALANCE } from './constants.js';
import { RULES } from '../game/config.js';

const STORAGE_KEY = 'mutfak-slot.state.v1';

// Oyuncunun durumu. Görünüm bunu dinler ('change' olayı), kendisi görünümü bilmez.
export class GameState extends Emitter {
  balance = START_BALANCE;
  betIndex = 1;
  turbo = false;
  busy = false;

  constructor() {
    super();
    try {
      const saved = JSON.parse(globalThis.localStorage?.getItem(STORAGE_KEY) ?? 'null');
      if (!saved || typeof saved !== 'object') return;
      if (Number.isFinite(saved.balance) && saved.balance >= 0) this.balance = saved.balance;
      if (Number.isInteger(saved.betIndex) && saved.betIndex >= 0 && saved.betIndex < BETS.length)
        this.betIndex = saved.betIndex;
      if (typeof saved.turbo === 'boolean') this.turbo = saved.turbo;
    } catch {
      // Gizli gezinme, kota veya bozuk kayıt oyun başlamasını engellemesin.
    }
  }

  get bet() {
    return BETS[this.betIndex];
  }

  get canSpin() {
    return !this.busy && this.balance >= this.bet;
  }

  get canBuyBonus() {
    return !this.busy && this.balance >= this.bet * RULES.buyCost;
  }

  get isBankrupt() {
    return this.balance < BETS[0];
  }

  changeBet(direction) {
    if (this.busy) return;
    this.betIndex = Math.min(BETS.length - 1, Math.max(0, this.betIndex + direction));
    this.#changed();
  }

  toggleTurbo() {
    this.turbo = !this.turbo;
    this.#changed();
  }

  setBusy(busy) {
    this.busy = busy;
    this.#changed();
  }

  debit(amount) {
    this.balance -= amount;
    this.#changed();
  }

  credit(amount) {
    this.balance += amount;
    this.#changed();
  }

  resetBalance() {
    this.balance = START_BALANCE;
    this.#changed();
  }

  #changed() {
    try {
      globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify({
        balance: this.balance,
        betIndex: this.betIndex,
        turbo: this.turbo,
      }));
    } catch {
      // Kalıcılık isteğe bağlıdır; depolama kapalı olsa da oyun çalışır.
    }
    this.emit('change', this);
  }
}
