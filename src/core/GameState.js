import { Emitter } from './Emitter.js';
import { BETS, START_BALANCE } from './constants.js';

// Oyuncunun durumu. Görünüm bunu dinler ('change' olayı), kendisi görünümü bilmez.
export class GameState extends Emitter {
  balance = START_BALANCE;
  betIndex = 1;
  turbo = false;
  busy = false;

  get bet() {
    return BETS[this.betIndex];
  }

  get canSpin() {
    return !this.busy && this.balance >= this.bet;
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

  #changed() {
    this.emit('change', this);
  }
}
