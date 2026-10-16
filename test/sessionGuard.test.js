import test from 'node:test';
import assert from 'node:assert/strict';
import { SessionGuard } from '../src/core/SessionGuard.js';
import { GameState } from '../src/core/GameState.js';
import { playRound } from '../src/game/engine.js';
import { createRng } from '../src/game/rng.js';

const tick = () => new Promise((resolve) => setImmediate(resolve));
function locks() {
  let held = false;
  return {
    async request(_name, _options, callback) {
      if (held) return callback(null);
      held = true;
      try { return await callback({ name: 'test' }); } finally { held = false; }
    },
  };
}
function fixture() {
  const values = new Map();
  const timers = new Set();
  const target = new EventTarget();
  let now = 1000;
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  return {
    storage, target, values, timers,
    advance: (ms) => { now += ms; }, heartbeat: () => [...timers].forEach((fn) => fn()),
    options: { locks: null, storage, target, clock: () => now, delay: async () => {},
      setInterval: (fn) => { timers.add(fn); return fn; }, clearInterval: (fn) => timers.delete(fn),
      leaseDuration: 1000, heartbeatMs: 200, settleMs: 0 },
  };
}

test('Web Locks açık sekmenin sahipliğini süre dolmadan korur ve ikinci sekmeyi reddeder', async () => {
  const manager = locks();
  const first = new SessionGuard({ locks: manager, target: new EventTarget() });
  const second = new SessionGuard({ locks: manager, target: new EventTarget() });
  try {
    assert.equal(await first.acquire(), true);
    assert.equal(first.owned, true);
    assert.equal(await second.acquire(), false);
    assert.equal(second.owned, false);
    assert.equal(await first.acquire(), true, 'aynı koruyucu idempotenttir');
    first.release();
    await tick();
    assert.equal(await second.acquire(), true);
    assert.equal(second.owned, true);
  } finally { first.destroy(); second.destroy(); await tick(); }
});

test('kira yedeği yalnızca bir sahibin yazmasına izin verir; sayfa kapanışı kirayı temizler', async () => {
  const f = fixture();
  const first = new SessionGuard(f.options);
  const second = new SessionGuard({ ...f.options, target: new EventTarget() });
  try {
    assert.equal(await first.acquire(), true);
    assert.equal(await second.acquire(), false);
    f.advance(600);
    f.heartbeat();
    f.advance(600);
    assert.equal(first.owned, true, 'kalp atışı kirayı uzatır');
    assert.equal(await second.acquire(), false);
    f.target.dispatchEvent(new Event('pagehide'));
    assert.equal(first.owned, false);
    assert.equal(await second.acquire(), true);
    assert.equal(f.timers.size, 1);
  } finally { first.destroy(); second.destroy(); }
  assert.equal(f.timers.size, 0);
  assert.equal(f.values.has('mutfak-slot.session.v1'), false);
});

test('kira el değiştirirse eski sekme sonraki yazıda durur; kaydedilmiş sonuç yeni sekmede bir kez ödenir', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const f = fixture();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: f.storage });
  let losses = 0;
  const first = new SessionGuard({ ...f.options, onLost: () => losses++ });
  const second = new SessionGuard({ ...f.options, target: new EventTarget() });
  try {
    assert.equal(await first.acquire(), true);
    const stale = new GameState({ canWrite: () => first.owned });
    const round = playRound(createRng(77), { record: true, buy: true });
    stale.beginRound(round, { buy: true });
    const recorded = f.storage.getItem('mutfak-slot.state.v1');
    f.advance(1200);
    assert.equal(await second.acquire(), true);
    stale.toggleTurbo();
    assert.equal(first.owned, false);
    assert.throws(() => stale.settleRound(), /başka bir sekmede/);
    assert.equal(f.storage.getItem('mutfak-slot.state.v1'), recorded);
    await tick();
    assert.equal(losses, 1);
    const current = new GameState({ canWrite: () => second.owned });
    const balance = current.balance;
    const payout = current.settleRound();
    assert.equal(current.balance, balance + payout);
    assert.equal(current.history.length, 1);
    assert.equal(current.settleRound(), 0);
    assert.equal(new GameState().history.length, 1);
  } finally {
    first.destroy(); second.destroy();
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else delete globalThis.localStorage;
  }
});

test('eşzamanlı kira talebinde yerleşme kontrolünü kaybeden sekme sahip olamaz', async () => {
  const f = fixture();
  const releases = [];
  const delay = () => new Promise((resolve) => releases.push(resolve));
  const first = new SessionGuard({ ...f.options, delay });
  const second = new SessionGuard({ ...f.options, delay });
  try {
    const attempt = first.acquire();
    assert.equal(await second.acquire(), false, 'henüz yerleşen ama geçerli kira da engeller');
    const raw = JSON.parse(f.storage.getItem('mutfak-slot.session.v1'));
    f.storage.setItem('mutfak-slot.session.v1', JSON.stringify({ owner: 'other', expires: raw.expires }));
    releases.shift()();
    assert.equal(await attempt, false, 'son sahiplik okunmadan oyuna izin verilmez');
    assert.equal(first.owned, false);
  } finally { first.destroy(); second.destroy(); }
});

test('API kapalıysa kira yedeğine geçilir; ikisi de kapalıysa güvenli biçimde reddedilir', async () => {
  const f = fixture();
  const guard = new SessionGuard({ ...f.options, locks: { request: () => Promise.reject(new Error('kapalı')) } });
  const blocked = new SessionGuard({ ...f.options, storage: { getItem: () => null, setItem: () => { throw new Error('kapalı'); } } });
  try {
    assert.equal(await guard.acquire(), true);
    assert.equal(await blocked.acquire(), false);
  } finally { guard.destroy(); blocked.destroy(); }
});

test('kilit alımı sürerken yok edilen koruyucu sonradan oyunu açamaz', async () => {
  let callback;
  const guard = new SessionGuard({ locks: { request: (_name, _options, fn) => { callback = fn; return Promise.resolve(); } } });
  const acquire = guard.acquire();
  guard.destroy();
  await callback({ name: 'late' });
  assert.equal(await acquire, false);
  assert.equal(guard.owned, false);
});
