import { PAY_SYMBOLS, getSymbolPays, WEIGHTS, SYMBOL_VIEW, MULTS } from '../src/game/config.js';

for (const mode of ['base', 'free']) {
  const weights = WEIGHTS[mode];
  const total = Object.values(weights).reduce((sum, value) => sum + value, 0);
  console.log(`\n${mode === 'base' ? 'ANA OYUN' : 'BEDAVA DÖNÜŞ'} — her yol için doğrudan bahsin katı`);
  console.log('Sembol          Ağırlık  Hücre%   3 makara  4 makara  5 makara');
  const symbols = [...PAY_SYMBOLS].sort((a, b) => getSymbolPays(a, mode)[0] - getSymbolPays(b, mode)[0]);
  for (const id of symbols) {
    const view = SYMBOL_VIEW[id];
    const pays = getSymbolPays(id, mode);
    console.log(`${view.emoji} ${view.name.padEnd(10)}  ${String(weights[id]).padStart(5)}   ${((weights[id] / total) * 100).toFixed(1).padStart(5)}   ${pays.map((pay) => pay.toFixed(2).padStart(8)).join('  ')}`);
  }
  console.log(`👨‍🍳 Wild ağırlık ${weights[20]} (sadece 2-4. makara) | 🍲 Scatter ${weights[21]} | 🔥 Çarpan ${weights.mul} (toplam ağırlık ${total.toFixed(1)})`);
}
console.log('\nÇarpan değerleri (normal / bedava dönüş ağırlığı):');
console.log(MULTS.map((multiplier) => `x${multiplier.v}: ${multiplier.base}/${multiplier.free}`).join('  '));

