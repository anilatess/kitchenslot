import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import * as fake from './helpers/fakePixi.js';

mock.module('pixi.js', { namedExports: { Container: fake.Container, Graphics: fake.Graphics, Text: fake.Text } });

const { getPaytableRows, getRulesLines, RulesPanel } = await import('../src/view/RulesPanel.js');
const { PAY, PAY_SCALE, PAY_SYMBOLS, RULES, WILD_REELS, MULTS } = await import('../src/game/config.js');

test('ödeme tablosu sembol ve değerlerini config.js dosyasından üretir', () => {
  const rows = getPaytableRows();
  assert.deepEqual(rows.map((row) => row.symbol), PAY_SYMBOLS);
  for (const row of rows)
    assert.deepEqual(row.pays, PAY[row.symbol].map((value) => value * PAY_SCALE.base));
});

test('kurallar ekranı özel sembol ve oyun ayarlarını config.js üzerinden açıklar', () => {
  const lines = getRulesLines().join('\n');
  assert.ok(lines.includes(`${RULES.freeSpins} bedava dönüş`));
  assert.ok(lines.includes(`+${RULES.retriggerSpins}`));
  assert.ok(lines.includes(`${RULES.maxWin}x bahis`));
  assert.ok(lines.includes(`${RULES.buyCost}x bahis`));
  assert.ok(lines.includes(WILD_REELS.map((reel) => reel + 1).join(', ')));
  assert.ok(lines.includes(MULTS.map(({ v }) => `x${v}`).join(', ')));
});

test('kurallar paneli iki tasarım yönünde de ölçülerini kurar ve aç/kapa çalışır', () => {
  const panel = new RulesPanel();
  panel.layout('landscape');
  assert.equal(panel.visible, false);
  panel.show();
  assert.equal(panel.visible, true);
  panel.layout('portrait');
  panel.toggle();
  assert.equal(panel.visible, false);
});
