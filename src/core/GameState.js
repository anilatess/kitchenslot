import { Emitter } from './Emitter.js';
import { BETS, START_BALANCE } from './constants.js';
import { COLS, ROWS, MULTS, RULES, SYM } from '../game/config.js';

const STORAGE_KEY = 'mutfak-slot.state.v1';
const cells = new Set([...Object.values(SYM), ...MULTS.map(({ v }) => 100 + v)]);
const multipliers = new Set(MULTS.map(({ v }) => v));
const amount = (value) => Number.isFinite(value) && value >= 0;
const matrix = (value, valid) => Array.isArray(value) && value.length === COLS
  && value.every((column) => Array.isArray(column) && column.length === ROWS && column.every(valid));
const grid = (value) => matrix(value, (cell) => cells.has(cell));
const collected = (value) => Array.isArray(value) && value.length <= COLS * ROWS
  && value.every((item) => item && Number.isInteger(item.col) && item.col >= 0 && item.col < COLS
    && Number.isInteger(item.row) && item.row >= 0 && item.row < ROWS && multipliers.has(item.value));

// Kayıt, motorun tekrar oynatılabilir sonucudur. Bozuk kayıt animasyona veya ödemeye giremez.
function recordedRound(round) {
  if (!round || !amount(round.total) || round.total > RULES.maxWin
    || typeof round.capped !== 'boolean' || typeof round.freeTriggered !== 'boolean'
    || !Array.isArray(round.spins) || round.spins.length < 1 || round.spins.length > RULES.maxFreeSpins + 1) return false;
  let total = 0;
  for (const [index, spin] of round.spins.entries()) {
    if (!spin || !['base', 'free'].includes(spin.mode) || (spin.mode === 'base' && index !== 0)
      || !['win', 'raw', 'multSum', 'appliedMult', 'freeMult'].every((key) => amount(spin[key]))
      || !Number.isInteger(spin.scatters) || spin.scatters < 0 || spin.scatters > COLS * ROWS
      || !grid(spin.initialGrid) || !grid(spin.finalGrid) || !collected(spin.endCollected)
      || !Array.isArray(spin.steps) || spin.steps.length > RULES.maxTumbles) return false;
    for (const step of spin.steps) {
      if (!step || !grid(step.grid) || !grid(step.nextGrid) || !matrix(step.removed, (value) => typeof value === 'boolean')
        || !collected(step.collected) || !amount(step.stepWin) || !Array.isArray(step.wins)
        || !step.wins.every((win) => win && cells.has(win.symbol) && amount(win.pay)
          && Number.isInteger(win.length) && win.length >= RULES.minWayLength && win.length <= COLS
          && Number.isInteger(win.ways) && win.ways > 0)) return false;
    }
    total += spin.win;
  }
  return Number.isFinite(total) && Math.abs(Math.min(total, RULES.maxWin) - round.total) < 1e-7;
}

function validPending(pending) {
  return pending && BETS.includes(pending.bet) && recordedRound(pending.round)
    && Number.isInteger(pending.nextSpin) && pending.nextSpin >= 0 && pending.nextSpin <= pending.round.spins.length;
}

// Bakiye ve bekleyen turun aynı localStorage kaydında bulunması, yenilemede ikinci bahis kesilmesini önler.
export class GameState extends Emitter {
  balance = START_BALANCE;
  betIndex = 1;
  turbo = false;
  busy = false;
  #pendingRound = null;

  constructor() {
    super();
    try {
      const saved = JSON.parse(globalThis.localStorage?.getItem(STORAGE_KEY) ?? 'null');
      if (!saved || typeof saved !== 'object') return;
      if (amount(saved.balance)) this.balance = saved.balance;
      if (Number.isInteger(saved.betIndex) && saved.betIndex >= 0 && saved.betIndex < BETS.length)
        this.betIndex = saved.betIndex;
      if (typeof saved.turbo === 'boolean') this.turbo = saved.turbo;
      if (amount(saved.balance) && validPending(saved.pendingRound)) this.#pendingRound = saved.pendingRound;
    } catch {
      // Gizli gezinme veya bozuk tercihler oyun açılışını engellemesin.
    }
  }

  get bet() { return BETS[this.betIndex]; }
  get pendingRound() { return this.#pendingRound; }
  get canSpin() { return !this.busy && !this.#pendingRound && this.balance >= this.bet; }
  get canBuyBonus() { return !this.busy && !this.#pendingRound && this.balance >= this.bet * RULES.buyCost; }
  get isBankrupt() { return !this.#pendingRound && this.balance < BETS[0]; }

  changeBet(direction) {
    if (this.busy || this.#pendingRound) return;
    this.betIndex = Math.min(BETS.length - 1, Math.max(0, this.betIndex + direction));
    this.#changed();
  }

  toggleTurbo() { this.turbo = !this.turbo; this.#changed(); }
  setBusy(busy) { this.busy = busy; this.#changed(); }

  debit(value) {
    if (this.#pendingRound || !amount(value) || value > this.balance) throw new Error('Geçersiz bakiye işlemi.');
    this.balance -= value;
    this.#changed();
  }

  credit(value) {
    if (this.#pendingRound || !amount(value) || !Number.isFinite(this.balance + value)) throw new Error('Geçersiz bakiye işlemi.');
    this.balance += value;
    this.#changed();
  }

  resetBalance() {
    if (this.busy || this.#pendingRound) return;
    this.balance = START_BALANCE;
    this.#changed();
  }

  beginRound(round, { buy = false } = {}) {
    if (this.#pendingRound) throw new Error('Önce bekleyen tur tamamlanmalı.');
    if (!recordedRound(round)) throw new Error('Tur sonucu geçersiz.');
    const cost = this.bet * (buy ? RULES.buyCost : 1);
    if (this.balance < cost) throw new Error('Bakiye yetersiz.');
    const pendingRound = { round: JSON.parse(JSON.stringify(round)), bet: this.bet, nextSpin: 0 };
    const balance = this.balance - cost;
    this.#persist({ ...this.#snapshot(), balance, pendingRound }, true);
    this.balance = balance;
    this.#pendingRound = pendingRound;
    this.emit('change', this);
    return pendingRound;
  }

  checkpointRound(nextSpin) {
    const pending = this.#pendingRound;
    if (!pending || !Number.isInteger(nextSpin) || nextSpin < pending.nextSpin || nextSpin > pending.round.spins.length)
      throw new Error('Tur ilerlemesi geçersiz.');
    if (nextSpin === pending.nextSpin) return;
    const pendingRound = { ...pending, nextSpin };
    this.#persist({ ...this.#snapshot(), pendingRound }, true);
    this.#pendingRound = pendingRound;
  }

  settleRound() {
    if (!this.#pendingRound) return 0;
    const payout = this.#pendingRound.round.total * this.#pendingRound.bet;
    const balance = this.balance + payout;
    if (!Number.isFinite(balance)) throw new Error('Tur ödemesi geçersiz.');
    this.#persist({ ...this.#snapshot(), balance, pendingRound: null }, true);
    this.balance = balance;
    this.#pendingRound = null;
    this.emit('change', this);
    return payout;
  }

  #snapshot() {
    return { balance: this.balance, betIndex: this.betIndex, turbo: this.turbo, pendingRound: this.#pendingRound };
  }

  #persist(snapshot, required = false) {
    try {
      if (!globalThis.localStorage?.setItem) {
        if (required) throw new Error('Depolama kullanılamıyor.');
        return;
      }
      globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch (cause) {
      if (required) throw new Error('Tur güvenle kaydedilemedi.', { cause });
      // Tercihler için kalıcılık isteğe bağlıdır; tur işlemleri ise kayıttan önce uygulanmaz.
    }
  }

  #changed() { this.#persist(this.#snapshot()); this.emit('change', this); }
}
