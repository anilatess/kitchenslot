const LOCK_NAME = 'mutfak-slot.active-session.v1';
const LEASE_KEY = 'mutfak-slot.session.v1';
const safeStorage = () => { try { return globalThis.localStorage; } catch { return undefined; } };
const sessionId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

// Web Locks kilidi sekme yaşadığı sürece tutulur; arka planda kalması kilidi düşürmez.
// Desteklemeyen tarayıcılarda kısa kira ve her yazıdan önce sahiplik doğrulaması kullanılır.
export class SessionGuard {
  #id = sessionId();
  #owned = false;
  #mode = null;
  #locks;
  #storage;
  #target;
  #onLost;
  #clock;
  #delay;
  #setInterval;
  #clearInterval;
  #leaseDuration;
  #heartbeatMs;
  #settleMs;
  #timer = null;
  #unlock = null;
  #acquiring = null;
  #generation = 0;
  #destroyed = false;
  #listeners = false;
  #storageHandler;
  #pageHideHandler;
  #pageShowHandler;

  constructor({
    onLost = () => {}, locks = globalThis.navigator?.locks, storage = safeStorage(),
    target = globalThis.window, clock = () => Date.now(),
    delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    setInterval: schedule = globalThis.setInterval, clearInterval: cancel = globalThis.clearInterval,
    leaseDuration = 15000, heartbeatMs = 3000, settleMs = 100,
  } = {}) {
    this.#onLost = onLost;
    this.#locks = locks;
    this.#storage = storage;
    this.#target = target;
    this.#clock = clock;
    this.#delay = delay;
    this.#setInterval = schedule;
    this.#clearInterval = cancel;
    this.#leaseDuration = leaseDuration;
    this.#heartbeatMs = heartbeatMs;
    this.#settleMs = settleMs;
    this.#storageHandler = (event) => {
      if (this.#mode === 'lease' && (event.key === LEASE_KEY || event.key === null)) void this.owned;
    };
    this.#pageHideHandler = () => this.release();
    this.#pageShowHandler = (event) => {
      if (event.persisted && !this.#owned && !this.#destroyed) this.#notifyLost();
    };
  }

  get owned() {
    if (!this.#owned) return false;
    if (this.#mode === 'lease') {
      const lease = this.#readLease();
      if (!lease || lease.owner !== this.#id || lease.expires <= this.#clock()) {
        this.#lose();
        return false;
      }
    }
    return true;
  }

  acquire() {
    if (this.#destroyed) return Promise.resolve(false);
    if (this.owned) return Promise.resolve(true);
    if (this.#acquiring) return this.#acquiring;
    const generation = ++this.#generation;
    this.#acquiring = this.#acquire(generation).finally(() => { this.#acquiring = null; });
    return this.#acquiring;
  }

  async #acquire(generation) {
    if (this.#locks?.request) {
      try {
        return await new Promise((resolve, reject) => {
          Promise.resolve(this.#locks.request(LOCK_NAME, { mode: 'exclusive', ifAvailable: true }, async (lock) => {
            if (!lock || this.#destroyed || generation !== this.#generation) { resolve(false); return; }
            this.#mode = 'locks';
            this.#owned = true;
            this.#listen();
            const held = new Promise((release) => { this.#unlock = release; });
            resolve(true);
            await held;
          })).catch(reject);
        });
      } catch {
        if (this.#destroyed || generation !== this.#generation) return false;
        // Bazı gömülü tarayıcılarda API görünür olsa da kullanıma kapalı olabilir.
      }
    }
    if (!this.#storage?.setItem || this.#destroyed || generation !== this.#generation) return false;
    const existing = this.#readLease();
    if (existing && existing.expires > this.#clock()) return false;
    try {
      this.#writeLease();
      // Eşzamanlı açılan sekmelerin son kirayı görmesi için kısa bir yerleşme aralığı.
      await this.#delay(this.#settleMs);
      if (this.#destroyed || generation !== this.#generation) {
        this.#removeLease();
        return false;
      }
      const lease = this.#readLease();
      if (!lease || lease.owner !== this.#id || lease.expires <= this.#clock()) return false;
      this.#mode = 'lease';
      this.#owned = true;
      this.#listen();
      this.#timer = this.#setInterval(() => {
        if (!this.owned) return;
        try { this.#writeLease(); } catch { this.#lose(); }
      }, this.#heartbeatMs);
      return true;
    } catch {
      this.#removeLease();
      return false;
    }
  }

  release() {
    ++this.#generation;
    if (this.#timer !== null) this.#clearInterval(this.#timer);
    this.#timer = null;
    if (this.#mode === 'lease') this.#removeLease();
    this.#owned = false;
    this.#mode = null;
    this.#unlock?.();
    this.#unlock = null;
  }

  destroy() {
    this.#destroyed = true;
    this.release();
    if (!this.#listeners) return;
    this.#target?.removeEventListener('storage', this.#storageHandler);
    this.#target?.removeEventListener('pagehide', this.#pageHideHandler);
    this.#target?.removeEventListener('pageshow', this.#pageShowHandler);
    this.#listeners = false;
  }

  #listen() {
    if (this.#listeners || !this.#target?.addEventListener) return;
    this.#target.addEventListener('storage', this.#storageHandler);
    this.#target.addEventListener('pagehide', this.#pageHideHandler);
    this.#target.addEventListener('pageshow', this.#pageShowHandler);
    this.#listeners = true;
  }

  #readLease() {
    try {
      const lease = JSON.parse(this.#storage?.getItem(LEASE_KEY) ?? 'null');
      return lease && typeof lease.owner === 'string' && lease.owner.length <= 100
        && Number.isFinite(lease.expires) ? lease : null;
    } catch { return null; }
  }

  #writeLease() {
    this.#storage.setItem(LEASE_KEY, JSON.stringify({ owner: this.#id, expires: this.#clock() + this.#leaseDuration }));
  }

  #removeLease() {
    try { if (this.#readLease()?.owner === this.#id) this.#storage?.removeItem(LEASE_KEY); } catch { /* Kapanış oyunu engellemez. */ }
  }

  #lose() {
    if (!this.#owned) return;
    if (this.#timer !== null) this.#clearInterval(this.#timer);
    this.#timer = null;
    this.#owned = false;
    this.#notifyLost();
  }

  #notifyLost() { queueMicrotask(() => { if (!this.#destroyed) this.#onLost(); }); }
}
