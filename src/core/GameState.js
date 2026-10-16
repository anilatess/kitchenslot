import { Emitter } from './Emitter.js';
import { BETS, START_BALANCE } from './constants.js';
import { COLS, ROWS, MULTS, RULES, SYM } from '../game/config.js';

const STORAGE_KEY = 'mutfak-slot.state.v1';
const HISTORY_LIMIT = 20;
const copy = (value) => JSON.parse(JSON.stringify(value));
const recordId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
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
    && Number.isInteger(pending.nextSpin) && pending.nextSpin >= 0 && pending.nextSpin <= pending.round.spins.length
    && (pending.id === undefined || validId(pending.id))
    && (pending.time === undefined || validTime(pending.time))
    && (pending.buy === undefined || typeof pending.buy === 'boolean')
    && (pending.cost === undefined || pending.cost === pending.bet * (pending.buy ? RULES.buyCost : 1));
}

const validId = (value) => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value);
const validTime = (value) => Number.isSafeInteger(value) && value >= 0 && value <= 8640000000000000;
const historyAmount = (value) => amount(value) && value <= Number.MAX_SAFE_INTEGER;
function validHistory(entry) {
  return entry && validId(entry.id) && validTime(entry.time) && BETS.includes(entry.bet)
    && typeof entry.buy === 'boolean' && entry.cost === entry.bet * (entry.buy ? RULES.buyCost : 1)
    && amount(entry.payout) && entry.payout <= entry.bet * RULES.maxWin
    && Number.isFinite(entry.net) && Math.abs(entry.net - (entry.payout - entry.cost)) < 1e-7
    && typeof entry.capped === 'boolean' && Number.isInteger(entry.freeCount)
    && entry.freeCount >= 0 && entry.freeCount <= RULES.maxFreeSpins && historyAmount(entry.freeMult)
    && Array.isArray(entry.breakdown) && entry.breakdown.length > 0 && entry.breakdown.length <= RULES.maxFreeSpins + 1
    && entry.breakdown.every((spin) => spin && ['base', 'free'].includes(spin.mode)
      && historyAmount(spin.raw) && historyAmount(spin.multiplier) && amount(spin.payout) && spin.payout <= entry.payout + 1e-7)
    && Math.abs(entry.breakdown.reduce((total, spin) => total + spin.payout, 0) - entry.payout) < 1e-7;
}

function historyEntry(pending) {
  const { round, bet } = pending;
  const payout = round.total * bet;
  // Eski sürüm maliyeti saklamıyordu. Motor, satın almada ana dönüşü tamamen atlar.
  const buy = pending.buy ?? round.spins[0].mode === 'free';
  const cost = pending.cost ?? bet * (buy ? RULES.buyCost : 1);
  let remaining = payout;
  const breakdown = round.spins.map((spin) => {
    const paid = Math.min(remaining, spin.win * bet);
    remaining = Math.max(0, remaining - paid);
    return { mode: spin.mode, raw: spin.raw * bet, multiplier: spin.appliedMult, payout: paid };
  });
  return {
    id: pending.id ?? recordId(), time: pending.time ?? Date.now(), bet, cost, payout,
    net: payout - cost, buy,
    freeCount: round.spins.filter((spin) => spin.mode === 'free').length,
    freeMult: round.spins.filter((spin) => spin.mode === 'free').at(-1)?.freeMult ?? 0,
    capped: round.capped, breakdown,
  };
}

// Bakiye ve bekleyen turun aynı localStorage kaydında bulunması, yenilemede ikinci bahis kesilmesini önler.
export class GameState extends Emitter {
  balance = START_BALANCE;
  betIndex = 1;
  turbo = false;
  busy = false;
  #pendingRound = null;
  #history = [];
  #canWrite;
  #serialized = null;
  #revision = 0;

  constructor({ canWrite = () => true } = {}) {
    super();
    this.#canWrite = canWrite;
    this.refreshFromStorage();
  }

  // Eski bir sekmenin tercihi, yeni sekmenin bakiyesini veya bekleyen turunu ezemez.
  refreshFromStorage() {
    try {
      const serialized = globalThis.localStorage?.getItem(STORAGE_KEY) ?? null;
      if (serialized === this.#serialized) return false;
      this.#serialized = serialized;
      const saved = JSON.parse(serialized ?? 'null');
      if (saved === null) {
        this.balance = START_BALANCE;
        this.betIndex = 1;
        this.turbo = false;
        this.#pendingRound = null;
        this.#history = [];
        this.#revision = 0;
        return true;
      }
      if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return false;
      this.balance = amount(saved.balance) ? saved.balance : START_BALANCE;
      this.betIndex = Number.isInteger(saved.betIndex) && saved.betIndex >= 0 && saved.betIndex < BETS.length ? saved.betIndex : 1;
      this.turbo = typeof saved.turbo === 'boolean' ? saved.turbo : false;
      this.#pendingRound = amount(saved.balance) && validPending(saved.pendingRound) ? saved.pendingRound : null;
      this.#revision = Number.isSafeInteger(saved.revision) && saved.revision >= 0 ? saved.revision : 0;
      const seen = new Set();
      this.#history = (Array.isArray(saved.history) ? saved.history : []).slice(0, HISTORY_LIMIT).filter((entry) => {
        if (!validHistory(entry) || seen.has(entry.id)) return false;
        seen.add(entry.id);
        return true;
      });
      return true;
    } catch {
      // Gizli gezinme veya bozuk tercihler oyun açılışını engellemesin.
      return false;
    }
  }

  get bet() { return BETS[this.betIndex]; }
  get pendingRound() { return this.#pendingRound; }
  get history() { return copy(this.#history); }
  getHistory() { return this.history; }
  get canWrite() { return !!this.#canWrite(); }
  get canSpin() { return this.canWrite && !this.busy && !this.#pendingRound && this.balance >= this.bet; }
  get canBuyBonus() { return this.canWrite && !this.busy && !this.#pendingRound && this.balance >= this.bet * RULES.buyCost; }
  get isBankrupt() { return !this.#pendingRound && this.balance < BETS[0]; }

  changeBet(direction) {
    if (!this.#prepare(false)) return;
    if (this.busy || this.#pendingRound) return;
    this.betIndex = Math.min(BETS.length - 1, Math.max(0, this.betIndex + direction));
    this.#changed();
  }

  toggleTurbo() { if (!this.#prepare(false)) return; this.turbo = !this.turbo; this.#changed(); }
  // Meşgul durumu yalnızca bu pencereye aittir; depolama kaydını yeniden yazmaz.
  setBusy(busy) { this.busy = !!busy; this.emit('change', this); }

  debit(value) {
    this.#prepare();
    if (this.#pendingRound || !amount(value) || value > this.balance) throw new Error('Geçersiz bakiye işlemi.');
    this.balance -= value;
    this.#changed();
  }

  credit(value) {
    this.#prepare();
    if (this.#pendingRound || !amount(value) || !Number.isFinite(this.balance + value)) throw new Error('Geçersiz bakiye işlemi.');
    this.balance += value;
    this.#changed();
  }

  resetBalance() {
    if (!this.#prepare(false)) return;
    if (this.busy || this.#pendingRound) return;
    this.balance = START_BALANCE;
    this.#changed();
  }

  beginRound(round, { buy = false } = {}) {
    this.#prepare();
    if (this.#pendingRound) throw new Error('Önce bekleyen tur tamamlanmalı.');
    if (!recordedRound(round)) throw new Error('Tur sonucu geçersiz.');
    const cost = this.bet * (buy ? RULES.buyCost : 1);
    if (this.balance < cost) throw new Error('Bakiye yetersiz.');
    const pendingRound = { id: recordId(), time: Date.now(), buy: !!buy, cost, round: copy(round), bet: this.bet, nextSpin: 0 };
    const balance = this.balance - cost;
    this.#persist({ ...this.#snapshot(), balance, pendingRound }, true);
    this.balance = balance;
    this.#pendingRound = pendingRound;
    this.emit('change', this);
    return pendingRound;
  }

  checkpointRound(nextSpin) {
    this.#prepare();
    const pending = this.#pendingRound;
    if (!pending || !Number.isInteger(nextSpin) || nextSpin < pending.nextSpin || nextSpin > pending.round.spins.length)
      throw new Error('Tur ilerlemesi geçersiz.');
    if (nextSpin === pending.nextSpin) return;
    const pendingRound = { ...pending, nextSpin };
    this.#persist({ ...this.#snapshot(), pendingRound }, true);
    this.#pendingRound = pendingRound;
  }

  settleRound() {
    this.#prepare();
    if (!this.#pendingRound) return 0;
    const payout = this.#pendingRound.round.total * this.#pendingRound.bet;
    const balance = this.balance + payout;
    if (!Number.isFinite(balance)) throw new Error('Tur ödemesi geçersiz.');
    const entry = historyEntry(this.#pendingRound);
    const history = [entry, ...this.#history.filter(({ id }) => id !== entry.id)].slice(0, HISTORY_LIMIT);
    this.#persist({ ...this.#snapshot(), balance, pendingRound: null, history }, true);
    this.balance = balance;
    this.#pendingRound = null;
    this.#history = history;
    this.emit('change', this);
    return payout;
  }

  #snapshot() {
    return { balance: this.balance, betIndex: this.betIndex, turbo: this.turbo, pendingRound: this.#pendingRound, history: this.#history, revision: this.#revision };
  }

  #prepare(required = true) {
    if (!this.canWrite) {
      if (required) throw new Error('Oyun başka bir sekmede açık. Bu sekme işlem yapamaz.');
      return false;
    }
    this.refreshFromStorage();
    if (!this.canWrite) {
      if (required) throw new Error('Oyun oturumu başka bir sekmeye geçti.');
      return false;
    }
    return true;
  }

  #persist(snapshot, required = false) {
    try {
      if (!this.canWrite) throw new Error('Oyun oturumu başka bir sekmeye geçti.');
      if (!globalThis.localStorage?.setItem) {
        if (required) throw new Error('Depolama kullanılamıyor.');
        return;
      }
      // İşlem başında okunan kayıt değiştiyse üzerine yazmak yerine güncel kaydı al.
      if ((globalThis.localStorage.getItem(STORAGE_KEY) ?? null) !== this.#serialized) {
        this.refreshFromStorage();
        throw new Error('Oyun kaydı başka bir sekmede değişti.');
      }
      const revision = this.#revision + 1;
      const serialized = JSON.stringify({ ...snapshot, revision });
      if (!this.canWrite) throw new Error('Oyun oturumu başka bir sekmeye geçti.');
      globalThis.localStorage.setItem(STORAGE_KEY, serialized);
      this.#serialized = serialized;
      this.#revision = revision;
    } catch (cause) {
      if (required) throw new Error('Tur güvenle kaydedilemedi.', { cause });
      // Tercihler için kalıcılık isteğe bağlıdır; tur işlemleri ise kayıttan önce uygulanmaz.
    }
  }

  #changed() { this.#persist(this.#snapshot()); this.emit('change', this); }
}
