import { PAY, PAY_SCALE, WEIGHTS, SYMBOL_VIEW, MULTS } from '../src/game/config.js';
const w = WEIGHTS.base;
const mulTotal = w.mul;
const total = Object.entries(w).reduce((a, [, v]) => a + v, 0) - 0;
console.log('Sembol          Ağırlık  Hücre%   3 makara  4 makara  5 makara  (her yol için, bahsın katı)');
for (const id of Object.keys(PAY).sort((a, b) => PAY[a][0] - PAY[b][0])) {
  const v = SYMBOL_VIEW[id], p = PAY[id].map((x) => x * PAY_SCALE.base);
  console.log(`${v.emoji} ${v.name.padEnd(10)}  ${String(w[id]).padStart(5)}   ${((w[id] / total) * 100).toFixed(1).padStart(5)}   ${p.map((x) => x.toFixed(4).padStart(8)).join('  ')}`);
}
console.log(`\n👨‍🍳 Wild ağırlık ${w[20]} (sadece 2-4. makara) | 🍲 Scatter ${w[21]} | 🔥 Çarpan ${w.mul} (toplam ağırlık ${total.toFixed(1)})`);
console.log('Çarpan değerleri (normal / bedava dönüş ağırlığı):');
console.log(MULTS.map((m) => `x${m.v}: ${m.base}/${m.free}`).join('  '));
