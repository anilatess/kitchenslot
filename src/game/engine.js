// ============================================================
//  Oyun mantığı: görselden bağımsız, saf JavaScript.
//  Hem oyun (Pixi) hem simülasyon aynı dosyayı kullanır.
//  Tüm kazançlar "bahsın katı" cinsindendir (bet = 1).
// ============================================================
import { COLS, ROWS, SYM, PAY, PAY_SCALE, PAY_SYMBOLS, WEIGHTS, WILD_REELS, MULTS, RULES } from './config.js';

export const isMul = (c) => c >= 100;
export const mulValue = (c) => c - 100;
export const mulCell = (v) => 100 + v;

// ---------- Rastgele sembol seçimi ----------
const tables = {};
function buildTable(mode, refill, reel) {
  const w = WEIGHTS[mode];
  const items = [];
  for (const s of Object.keys(w).filter((k) => k !== 'mul').map(Number)) {
    let wt = w[s];
    if (s === SYM.WLD && !WILD_REELS.includes(reel)) wt = 0;
    if (s === SYM.SCT && refill) wt = 0; // tumble sırasında scatter düşmez
    if (wt > 0) items.push({ cell: s, w: wt });
  }
  const mulTotal = MULTS.reduce((a, m) => a + m[mode], 0);
  for (const m of MULTS) items.push({ cell: mulCell(m.v), w: (w.mul * m[mode]) / mulTotal });
  let total = 0;
  const cum = items.map((i) => (total += i.w));
  return { cells: items.map((i) => i.cell), cum, total };
}
function getTable(mode, refill, reel) {
  const k = `${mode}|${refill ? 1 : 0}|${reel}`;
  return (tables[k] ||= buildTable(mode, refill, reel));
}
function pick(rng, t) {
  const r = rng() * t.total;
  for (let i = 0; i < t.cum.length; i++) if (r < t.cum[i]) return t.cells[i];
  return t.cells[t.cells.length - 1];
}

// grid[kolon][satır], satır 0 = en üst
function randomGrid(rng, mode) {
  const g = [];
  for (let c = 0; c < COLS; c++) {
    const col = [];
    const t = getTable(mode, false, c);
    for (let r = 0; r < ROWS; r++) col.push(pick(rng, t));
    g.push(col);
  }
  return g;
}

// ---------- Ways-to-win değerlendirmesi ----------
function evalWays(grid, mode) {
  const wins = [];
  const remove = grid.map((col) => col.map(() => false));
  let pay = 0;
  for (const s of PAY_SYMBOLS) {
    const counts = [];
    for (let c = 0; c < COLS; c++) {
      let n = 0;
      for (let r = 0; r < ROWS; r++) {
        const v = grid[c][r];
        if (v === s || v === SYM.WLD) n++;
      }
      if (n === 0) break;
      counts.push(n);
    }
    const len = counts.length;
    if (len < RULES.minWayLength) continue;
    const ways = counts.reduce((a, b) => a * b, 1);
    const p = PAY[s][len - RULES.minWayLength] * ways * PAY_SCALE[mode];
    pay += p;
    wins.push({ symbol: s, length: len, ways, pay: p });
    for (let c = 0; c < len; c++)
      for (let r = 0; r < ROWS; r++) {
        const v = grid[c][r];
        if (v === s || v === SYM.WLD) remove[c][r] = true;
      }
  }
  return { wins, remove, pay };
}

// ---------- Yerçekimi + yeni semboller ----------
function dropAndRefill(rng, grid, remove, mode) {
  const out = [];
  for (let c = 0; c < COLS; c++) {
    const kept = [];
    for (let r = 0; r < ROWS; r++) if (!remove[c][r]) kept.push(grid[c][r]);
    const t = getTable(mode, true, c);
    const fresh = [];
    for (let i = kept.length; i < ROWS; i++) fresh.push(pick(rng, t));
    out.push([...fresh, ...kept]); // yeniler üstte, kalanlar altta
  }
  return out;
}

function countScatters(grid) {
  let n = 0;
  for (const col of grid) for (const v of col) if (v === SYM.SCT) n++;
  return n;
}

// ---------- Tek dönüş (tumble zinciri dahil) ----------
// mode: 'base' | 'free'. freeMult: bedava dönüşte biriken çarpan toplamı.
export function playSpin(rng, mode, freeMult = 0, record = false) {
  let grid = randomGrid(rng, mode);
  const initialGrid = record ? grid.map((c) => c.slice()) : null;
  const scatters = countScatters(grid);
  const steps = [];
  let raw = 0;
  let multSum = 0;

  for (let i = 0; i < RULES.maxTumbles; i++) {
    const ev = evalWays(grid, mode);
    if (ev.pay === 0) break;
    // Gridde görünen çarpanları topla ve patlat
    const collected = [];
    for (let c = 0; c < COLS; c++)
      for (let r = 0; r < ROWS; r++)
        if (isMul(grid[c][r])) {
          multSum += mulValue(grid[c][r]);
          ev.remove[c][r] = true;
          if (record) collected.push({ col: c, row: r, value: mulValue(grid[c][r]) });
        }
    raw += ev.pay;
    const next = dropAndRefill(rng, grid, ev.remove, mode);
    if (record)
      steps.push({
        grid: grid.map((c) => c.slice()),
        wins: ev.wins,
        removed: ev.remove.map((c) => c.slice()),
        collected,
        stepWin: ev.pay,
        nextGrid: next.map((c) => c.slice()),
      });
    grid = next;
  }

  // Zincir bittiğinde kalan çarpanları da topla (sadece kazanç varsa)
  const endCollected = [];
  if (raw > 0) {
    for (let c = 0; c < COLS; c++)
      for (let r = 0; r < ROWS; r++)
        if (isMul(grid[c][r])) {
          multSum += mulValue(grid[c][r]);
          if (record) endCollected.push({ col: c, row: r, value: mulValue(grid[c][r]) });
        }
  }

  let win = raw;
  let newFreeMult = freeMult;
  let appliedMult = 1;
  if (raw > 0) {
    if (mode === 'free') {
      newFreeMult = freeMult + multSum;      // birikimli
      appliedMult = Math.max(1, newFreeMult);
    } else {
      appliedMult = Math.max(1, multSum);    // sadece bu dönüş
    }
    win = raw * appliedMult;
  }
  return {
    mode, win, raw, multSum, appliedMult, scatters,
    freeMult: newFreeMult,
    initialGrid, steps, endCollected,
    finalGrid: record ? grid : null,
  };
}

// ---------- Tam tur: ana dönüş + bedava dönüşler ----------
// opts.buy = true -> bonus satın alma (ana dönüş atlanır)
export function playRound(rng, opts = {}) {
  const record = !!opts.record;
  const spins = [];
  let total = 0;
  let capped = false;
  let freeTriggered = false;

  let remaining = 0;
  if (opts.buy) {
    freeTriggered = true;
    remaining = RULES.freeSpins;
  } else {
    const s = playSpin(rng, 'base', 0, record);
    total += s.win;
    if (record) spins.push(s);
    if (s.scatters >= RULES.scatterTrigger) {
      freeTriggered = true;
      remaining = RULES.freeSpins;
    }
  }

  let baseWin = total;
  let freeWin = 0;
  let freeCount = 0;
  let freeMult = 0;
  if (total >= RULES.maxWin) { total = RULES.maxWin; capped = true; remaining = 0; }

  while (remaining > 0 && freeCount < RULES.maxFreeSpins) {
    remaining--;
    freeCount++;
    const s = playSpin(rng, 'free', freeMult, record);
    freeMult = s.freeMult;
    freeWin += s.win;
    total += s.win;
    if (record) spins.push(s);
    if (total >= RULES.maxWin) { total = RULES.maxWin; capped = true; break; }
    if (s.scatters >= RULES.scatterTrigger) remaining += RULES.retriggerSpins;
  }

  return { total, baseWin, freeWin, freeTriggered, freeCount, freeMult, capped, spins };
}

// Test ve hata ayıklama için: hazır bir gridi değerlendirir.
export function playSpinFromGrid(grid, mode = 'base') {
  return evalWays(grid, mode);
}
