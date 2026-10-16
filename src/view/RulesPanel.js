import { Container, Graphics, Text } from 'pixi.js';
import { COLS, ROWS, SYM, SYMBOL_VIEW, getSymbolPays, PAY_SYMBOLS, WILD_REELS, MULTS, RULES } from '../game/config.js';
import { COLORS } from '../core/constants.js';
import { Button } from './Button.js';
import { createSymbolSkin } from './skins.js';

const multiplierText = (value) => `${value.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}x`;

/** Ödeme tablosunu ve kuralları doğrudan game/config.js değerlerinden üretir. */
export function getPaytableRows(mode = 'base') {
  return PAY_SYMBOLS.map((symbol) => ({
    symbol,
    name: SYMBOL_VIEW[symbol].name,
    pays: [...getSymbolPays(symbol, mode)],
  }));
}

export function getRulesLines() {
  const wildReels = WILD_REELS.map((reel) => reel + 1).join(', ');
  const multipliers = MULTS.map(({ v }) => `x${v}`).join(', ');
  return [
    `Ways: ${COLS}×${ROWS}; soldan ${RULES.minWayLength}+ ardışık makara. Ödeme = bahis × tablodaki oran × yol sayısı.`,
    `Wild (şef): ${wildReels}. makaralarda normal sembollerin yerine geçer.`,
    `${RULES.scatterTrigger}+ tencere: ${RULES.freeSpins} bedava dönüş; bonus içinde +${RULES.retriggerSpins}. Tumble sırasında yeni tencere gelmez.`,
    `Çarpanlar (${multipliers}) toplanır; patlama kazançlarına uygulanır. Bonusta sonraki dönüşlere taşınır.`,
    `Tavan ${RULES.maxWin}x bahis; bonus alımı ${RULES.buyCost}x bahis. Ateşteki çarpan tek başına ödeme vermez.`,
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
  #heading = makeText('TEK YOL İÇİN BAHİS KATI', 17, COLORS.textDim);
  #example = makeText('0,01x = 100 bahiste 1 ödeme · her yol için', 15, 0xa7b4a8);
  #baseButton = new Button({ label: 'ANA OYUN', width: 220, height: 38, fontSize: 16 });
  #freeButton = new Button({ label: 'BEDAVA DÖNÜŞ', width: 220, height: 38, fontSize: 16 });
  #mode = 'base';
  #orientation = 'landscape';
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
      const symbol = createSymbolSkin(row.symbol);
      symbol.label = row.name;
      const values = makeText('', 14, COLORS.text, { lineHeight: 19, align: 'center' });
      card.addChild(bg, symbol, values);
      card.row = row;
      card.bg = bg;
      card.symbolView = symbol;
      card.valuesText = values;
      this.#cards.push(card);
    }
    this.addChild(this.#shade, this.#panel, this.#title, this.#heading, this.#example,
      this.#baseButton, this.#freeButton, ...this.#cards, this.#rules, this.#close);
    this.#close.on('press', () => this.hide());
    this.#baseButton.on('press', () => this.setMode('base'));
    this.#freeButton.on('press', () => this.setMode('free'));
  }

  layout(orientation) {
    this.#orientation = orientation;
    const portrait = orientation === 'portrait';
    const design = portrait ? { width: 720, height: 1280 } : { width: 1280, height: 720 };
    const panelWidth = portrait ? 660 : 1160;
    const panelHeight = portrait ? 1120 : 660;
    const cardWidth = portrait ? 200 : 360;
    const cardHeight = portrait ? 160 : 86;
    const gapX = portrait ? 12 : 16;
    const gapY = portrait ? 12 : 10;
    const top = portrait ? -258 : -136;
    const centerX = design.width / 2;
    const centerY = design.height / 2;

    this.position.set(0, 0);
    this.#shade.clear().rect(0, 0, design.width, design.height).fill({ color: 0x000000, alpha: 0.84 });
    this.#panel.clear().roundRect(centerX - panelWidth / 2, centerY - panelHeight / 2, panelWidth, panelHeight, 28)
      .fill({ color: 0x101b17 }).stroke({ width: 1.5, color: 0xbda675, alpha: 0.65 });
    this.#title.position.set(centerX, centerY - panelHeight / 2 + (portrait ? 38 : 32));
    this.#heading.position.set(centerX, portrait ? 158 : 96);
    this.#example.position.set(centerX, portrait ? 278 : 169);
    this.#baseButton.position.set(centerX - (portrait ? 140 : 118), portrait ? 215 : 137);
    this.#freeButton.position.set(centerX + (portrait ? 140 : 118), portrait ? 215 : 137);
    [this.#baseButton, this.#freeButton].forEach(button => {
      button.setSize(portrait ? 260 : 220, portrait ? 84 : 38);
      button.setFontSize(portrait ? 24 : 16);
    });
    this.#baseButton.setSelected(this.#mode === 'base');
    this.#freeButton.setSelected(this.#mode === 'free');
    this.#rules.position.set(centerX - panelWidth / 2 + 32, portrait ? 824 : 474);
    this.#title.style ??= {};
    this.#heading.style ??= {};
    this.#title.style.fontSize = portrait ? 32 : 28;
    this.#heading.style.fontSize = portrait ? 20 : 17;
    this.#example.style ??= {};
    this.#example.style.fontSize = portrait ? 20 : 15;
    this.#rules.style ??= {};
    this.#rules.style.wordWrapWidth = panelWidth - 64;
    this.#rules.style.fontSize = portrait ? 19 : 17;
    this.#rules.style.lineHeight = portrait ? 24 : 23;
    this.#close.position.set(centerX, portrait ? 1150 : 646);
    this.#close.setSize(portrait ? 240 : 170, portrait ? 84 : 48);
    this.#close.setFontSize(portrait ? 25 : 18);

    const columns = 3;
    this.#cards.forEach((card, index) => {
      card.row.pays = [...getSymbolPays(card.row.symbol, this.#mode)];
      const col = index % columns;
      const row = Math.floor(index / columns);
      const x = centerX + (col - 1) * (cardWidth + gapX);
      const y = centerY + top + row * (cardHeight + gapY);
      card.position.set(x, y);
      card.valuesText.style ??= {};
      card.valuesText.style.fontSize = portrait ? 19 : 17;
      card.valuesText.style.lineHeight = portrait ? 24 : 23;
      card.bg.clear().roundRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 14)
        .fill({ color: 0x1c2824 }).stroke({ width: 1, color: 0xbda675, alpha: 0.25 });
      card.symbolView.scale.set(portrait ? 0.68 : 0.72);
      card.symbolView.position.set(portrait ? 0 : -126, portrait ? -40 : 0);
      card.valuesText.text = card.row.pays.map((value, payIndex) =>
        `${payIndex + 3} makara: ${multiplierText(value)}`).join('\n');
      card.valuesText.position.set(portrait ? 0 : 42, portrait ? 34 : 0);
    });
  }

  setMode(mode) {
    if (mode !== 'base' && mode !== 'free') return;
    this.#mode = mode;
    this.layout(this.#orientation);
  }

  show() { this.visible = true; }
  hide() { this.visible = false; }
  toggle() { this.visible = !this.visible; }
}
