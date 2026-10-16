import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import * as fake from './helpers/fakePixi.js';

mock.module('pixi.js', { namedExports: { Container: fake.Container, Graphics: fake.Graphics, Text: fake.Text, Sprite: fake.Sprite, Assets: fake.Assets } });

const { getPaytableRows, getRulesLines, RulesPanel } = await import('../src/view/RulesPanel.js');
const { getSymbolPays, PAY_SYMBOLS, RULES, WILD_REELS, MULTS } = await import('../src/game/config.js');

test('ödeme tablosu sembol ve değerlerini config.js dosyasından üretir', () => {
  for (const mode of ['base', 'free']) {
    const rows = getPaytableRows(mode);
    assert.deepEqual(rows.map((row) => row.symbol), PAY_SYMBOLS);
    for (const row of rows) assert.deepEqual(row.pays, getSymbolPays(row.symbol, mode));
  }
});

test('ana oyun ve bedava dönüş sekmeleri motorun gerçek oranlarını gösterir', () => {
  const panel = new RulesPanel();
  panel.layout('landscape');
  const card = panel.children.find(child => child.row?.symbol === PAY_SYMBOLS[0]);
  const free = panel.children.find(child => child.children?.some(item => item.text === 'BEDAVA DÖNÜŞ'));
  free.emit('pointertap');
  assert.deepEqual(card.row.pays, getSymbolPays(PAY_SYMBOLS[0], 'free'));
  panel.layout('portrait');
  assert.deepEqual(card.row.pays, getSymbolPays(PAY_SYMBOLS[0], 'free'), 'yön değişikliği seçili modu korur');
  panel.setMode('base');
  assert.deepEqual(card.row.pays, getSymbolPays(PAY_SYMBOLS[0], 'base'));
  assert.match(card.valuesText.text, /3 makara: \d+,\d{2}x/);
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
