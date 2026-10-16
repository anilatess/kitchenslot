// Kullanım: node sim/simulate.js [turSayısı] [seed]
import { createRng } from '../src/game/rng.js';
import { playRound } from '../src/game/engine.js';
import { RULES } from '../src/game/config.js';

const N = Number(process.argv[2] ?? 2_000_000);
const seed = Number(process.argv[3] ?? 12345);
const rng = createRng(seed);

const buckets = [
  ['0x', 0, 0], ['0-1x', 0, 0], ['1-2x', 0, 0], ['2-5x', 0, 0],
  ['5-20x', 0, 0], ['20-100x', 0, 0], ['100-500x', 0, 0], ['500-1000x', 0, 0], ['1000x (tavan)', 0, 0],
];
function bucketOf(w, capped) {
  if (capped) return 8;
  if (w === 0) return 0;
  if (w < 1) return 1; if (w < 2) return 2; if (w < 5) return 3;
  if (w < 20) return 4; if (w < 100) return 5; if (w < 500) return 6; return 7;
}

let sum = 0, sumSq = 0, baseSum = 0, freeSum = 0;
let hits = 0, triggers = 0, caps = 0, maxWin = 0, freeSpinsTotal = 0;
const t0 = Date.now();
for (let i = 0; i < N; i++) {
  const r = playRound(rng);
  sum += r.total; sumSq += r.total * r.total;
  baseSum += r.baseWin; freeSum += r.freeWin;
  if (r.baseWin > 0) hits++;
  if (r.freeTriggered) { triggers++; freeSpinsTotal += r.freeCount; }
  if (r.capped) caps++;
  if (r.total > maxWin) maxWin = r.total;
  const b = buckets[bucketOf(r.total, r.capped)]; b[1]++; b[2] += r.total;
}
const mean = sum / N;
const sd = Math.sqrt(sumSq / N - mean * mean);

console.log(`\n=== ${N.toLocaleString()} tur, seed ${seed}, ${((Date.now() - t0) / 1000).toFixed(1)} sn ===`);
console.log(`Toplam RTP:            %${(mean * 100).toFixed(2)}`);
console.log(`  ana oyun payı:       %${((baseSum / N) * 100).toFixed(2)}`);
console.log(`  bedava dönüş payı:   %${((freeSum / N) * 100).toFixed(2)}`);
console.log(`Kazanç sıklığı (ana):  %${((hits / N) * 100).toFixed(1)}  (1/${(N / hits).toFixed(2)})`);
console.log(`Bonus tetikleme:       1/${triggers ? (N / triggers).toFixed(0) : '-'}`);
console.log(`Bonus ort. kazanç:     ${triggers ? (freeSum / triggers).toFixed(1) : '-'}x  | ort. dönüş sayısı: ${triggers ? (freeSpinsTotal / triggers).toFixed(1) : '-'}`);
console.log(`Standart sapma:        ${sd.toFixed(2)}  (volatilite göstergesi)`);
console.log(`En büyük kazanç:       ${maxWin.toFixed(1)}x | tavana vuran tur: ${caps}`);
console.log('\nKazanç dağılımı (tur başına):');
for (const [name, n, s] of buckets)
  console.log(`  ${name.padEnd(14)} %${((n / N) * 100).toFixed(3).padStart(7)}   RTP katkısı %${((s / N) * 100).toFixed(2)}`);

// Bonus satın alma
const NB = Math.max(20000, Math.floor(N / 20));
let bs = 0, bcaps = 0, bmax = 0, bmin = Infinity;
for (let i = 0; i < NB; i++) {
  const r = playRound(rng, { buy: true });
  bs += r.total; if (r.capped) bcaps++;
  if (r.total > bmax) bmax = r.total; if (r.total < bmin) bmin = r.total;
}
console.log(`\nBonus satın alma (${NB.toLocaleString()} adet, ${RULES.buyCost}x maliyet):`);
console.log(`  ort. kazanç ${(bs / NB).toFixed(1)}x  ->  RTP %${((bs / NB / RULES.buyCost) * 100).toFixed(2)}`);
console.log(`  min ${bmin.toFixed(1)}x | max ${bmax.toFixed(1)}x | tavan ${bcaps}`);
