import { Container, Graphics, Text } from 'pixi.js';
import { COLS, ROWS, SYM, SYMBOL_VIEW, PAY, PAY_SCALE, PAY_SYMBOLS, WILD_REELS, MULTS, RULES } from '../game/config.js';
import { COLORS } from '../core/constants.js';
import { Button } from './Button.js';

const multiplierText = (value) => `${value.toLocaleString('tr-TR', { maximumFractionDigits: 4 })}x`;

/** Ödeme tablosunu ve kuralları doğrudan game/config.js değerlerinden üretir. */
export function getPaytableRows() {
  return PAY_SYMBOLS.map((symbol) => ({
    symbol,
    name: SYMBOL_VIEW[symbol].name,
    pays: PAY[symbol].map((value) => value * PAY_SCALE.base),
  }));
}

export function getRulesLines() {
  const wildReels = WILD_REELS.map((reel) => reel + 1).join(', ');
  const multipliers = MULTS.map(({ v }) => `x${v}`).join(', ');
  return [
    `Ways: ${COLS}×${ROWS}; soldan başlayan ${RULES.minWayLength}+ ardışık makara. Ödeme, tablo değeri × ways sayısıdır.`,
    `Wild (${SYMBOL_VIEW[SYM.WLD].name}): normal sembollerin yerine geçer; ${wildReels}. makaralarda çıkar.`,
    `Scatter (${SYMBOL_VIEW[SYM.SCT].name}): ${RULES.scatterTrigger}+ görünürse ${RULES.freeSpins} bedava dönüş; bedava oyunda her ${RULES.scatterTrigger}+ için +${RULES.retriggerSpins}. Tumble yenilemesinde çıkmaz.`,
    `Çarpan: ${multipliers}; tumble zinciri bitince kazancı çarpar, bedava dönüşlerde birikir.`,
    `Ölçek: ana oyun ${PAY_SCALE.base}x, bedava dönüş ${PAY_SCALE.free}x. Tavan ${RULES.maxWin}x bahis; bonus alımı ${RULES.buyCost}x bahis.`,
  ];
}

const makeText = (value, size, fill, extra = {}) => {
  const item = new Text({
    text: value,
    style: { fontFamily: 'system-ui, sans-serif', fontSize: size, fontWeight: '700', fill, ...extra },
  });
  item.anchor.set(0.5);
  return item;
};

export class RulesPanel extends Container {
  #shade = new Graphics();
  #panel = new Graphics();
  #title = makeText('ÖDEME TABLOSU & KURALLAR', 28, COLORS.gold);
  #heading = makeText(`HER WAYS İÇİN BAHİS KATI  ·  3 / 4 / 5 MAKARA`, 17, COLORS.textDim);
  #cards = [];
  #rules;
  #close = new Button({ label: 'KAPAT', width: 170, height: 48, fontSize: 18 });

  constructor() {
    super();
    this.visible = false;
    this.eventMode = 'static';
    this.#shade.eventMode = 'static';
    this.#rules = makeText(getRulesLines().join('\n'), 17, COLORS.text, {
      align: 'left', lineHeight: 23, wordWrap: true,
    });
    this.#rules.anchor.set(0);
    for (const row of getPaytableRows()) {
      const card = new Container();
      const bg = new Graphics();
      const name = makeText(row.name, 17, COLORS.gold);
      const values = makeText('', 14, COLORS.text, { lineHeight: 19, align: 'center' });
      card.addChild(bg, name, values);
      card.row = row;
      card.bg = bg;
      card.nameText = name;
      card.valuesText = values;
      this.#cards.push(card);
    }
    this.addChild(this.#shade, this.#panel, this.#title, this.#heading, ...this.#cards, this.#rules, this.#close);
    this.#close.on('press', () => this.hide());
  }

  layout(orientation) {
    const portrait = orientation === 'portrait';
    const design = portrait ? { width: 720, height: 1280 } : { width: 1280, height: 720 };
    const panelWidth = portrait ? 660 : 1160;
    const panelHeight = portrait ? 1120 : 660;
    const cardWidth = portrait ? 200 : 360;
    const cardHeight = portrait ? 104 : 84;
    const gapX = portrait ? 12 : 16;
    const gapY = portrait ? 8 : 10;
    const top = portrait ? -390 : -188;
    const centerX = design.width / 2;
    const centerY = design.height / 2;

    this.position.set(0, 0);
    this.#shade.clear().rect(0, 0, design.width, design.height).fill({ color: 0x000000, alpha: 0.84 });
    this.#panel.clear().roundRect(centerX - panelWidth / 2, centerY - panelHeight / 2, panelWidth, panelHeight, 28)
      .fill({ color: COLORS.panel }).stroke({ width: 4, color: COLORS.panelEdge });
    this.#title.position.set(centerX, centerY - panelHeight / 2 + 38);
    this.#heading.position.set(centerX, centerY - panelHeight / 2 + (portrait ? 80 : 78));
    this.#rules.position.set(centerX - panelWidth / 2 + 32, centerY + (portrait ? 14 : 112));
    this.#title.style ??= {};
    this.#heading.style ??= {};
    this.#title.style.fontSize = portrait ? 32 : 28;
    this.#heading.style.fontSize = portrait ? 20 : 17;
    this.#rules.style ??= {};
    this.#rules.style.wordWrapWidth = panelWidth - 64;
    this.#rules.style.fontSize = portrait ? 20 : 17;
    this.#rules.style.lineHeight = portrait ? 27 : 23;
    this.#close.position.set(centerX, centerY + panelHeight / 2 - 44);

    const columns = 3;
    const rows = Math.ceil(this.#cards.length / columns);
    this.#cards.forEach((card, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      const x = centerX + (col - 1) * (cardWidth + gapX);
      const y = centerY + top + row * (cardHeight + gapY);
      card.position.set(x, y);
      card.nameText.style ??= {};
      card.valuesText.style ??= {};
      card.nameText.style.fontSize = portrait ? 21 : 17;
      card.valuesText.style.fontSize = portrait ? 17 : 14;
      card.valuesText.style.lineHeight = portrait ? 22 : 19;
      card.bg.clear().roundRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 14)
        .fill({ color: 0x25294f }).stroke({ width: 2, color: 0x4a5199 });
      card.nameText.position.set(0, -cardHeight * 0.29);
      card.valuesText.text = card.row.pays.map((value, payIndex) =>
        `${payIndex + 3} makara: ${multiplierText(value)}`).join('\n');
      card.valuesText.position.set(0, cardHeight * 0.12);
    });
  }

  show() { this.visible = true; }
  hide() { this.visible = false; }
  toggle() { this.visible = !this.visible; }
}
