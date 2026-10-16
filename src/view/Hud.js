import { Container, Graphics, Text } from 'pixi.js';
import { COLORS, TIMING } from '../core/constants.js';
import { easeOutBack, easeOutQuad } from '../animation/easing.js';
import { Button } from './Button.js';
import { Readout } from './Readout.js';

const fmt = (n) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Konumlar tasarım koordinatlarındadır (bkz. constants.DESIGN).
const POSITIONS = {
  landscape: {
    title: [640, 40], free: [640, 82], mult: [190, 329], banner: [640, 329],
    win: [640, 606], balance: [150, 668], bet: [640, 672],
    betMinus: [510, 672], betPlus: [770, 672], spin: [1130, 560], turbo: [1130, 440], bonus: [1130, 330],
    autoplayCount: [1040, 250], autoplayToggle: [1190, 250], autoplayStatus: [1115, 200],
  },
  portrait: {
    title: [360, 60], free: [360, 130], mult: [360, 205], banner: [360, 474],
    win: [360, 775], balance: [160, 1230], bet: [360, 850],
    betMinus: [200, 850], betPlus: [520, 850], spin: [360, 1120], turbo: [610, 1120], bonus: [360, 1020],
    autoplayCount: [200, 950], autoplayToggle: [520, 950], autoplayStatus: [360, 900],
  },
};

const text = (value, size, fill) =>
  new Text({ text: value, style: { fontFamily: 'system-ui, sans-serif', fontSize: size, fontWeight: '800', fill } });

// Ekrandaki tüm arayüz: yazılar, düğmeler, banner. Durumu kendisi tutmaz;
// Game'den gelen değerleri gösterir, kullanıcı eylemlerini olay olarak yayar:
// 'spin', 'betUp', 'betDown', 'turbo'
export class Hud extends Container {
  #animator;
  #winShown = 0;

  #title = text('MUTFAK SLOT', 34, COLORS.gold);
  #free = text('', 26, 0x7dffd0);
  #mult = text('', 34, 0xff8a5c);
  #banner = text('', 56, COLORS.gold);
  #bannerShade = new Graphics();

  #balance = new Readout('BAKİYE');
  #bet = new Readout('BAHİS', { valueSize: 30 });
  #win = new Readout('KAZANÇ', { valueSize: 44, valueColor: COLORS.gold });

  #betMinus = new Button({ label: '−', width: 64, height: 64, fontSize: 36 });
  #betPlus = new Button({ label: '+', width: 64, height: 64, fontSize: 36 });
  #spin = new Button({ label: 'SPIN', width: 150, height: 150, fill: COLORS.spin, fontSize: 32 });
  #turbo = new Button({ label: 'TURBO', width: 130, height: 52, fontSize: 20 });
  #bonus = new Button({ label: 'BONUS AL (100x)', width: 210, height: 52, fontSize: 16 });
  #autoplayCount = new Button({ label: 'OTO ×10', width: 140, height: 52, fontSize: 18 });
  #autoplayToggle = new Button({ label: 'OTO BAŞLAT', width: 160, height: 52, fontSize: 17 });
  #autoplayStatus = text('', 18, COLORS.textDim);

  #purchaseDialog = new Container();
  #purchaseShade = new Graphics();
  #purchasePanel = new Graphics();
  #purchaseTitle = text('BONUS SATIN AL', 30, COLORS.gold);
  #purchaseCost = text('', 24, COLORS.text);
  #purchaseYes = new Button({ label: 'EVET', width: 170, height: 60, fill: COLORS.spin, fontSize: 22 });
  #purchaseCancel = new Button({ label: 'VAZGEÇ', width: 170, height: 60, fontSize: 20 });
  #resolvePurchase = null;

  constructor(animator) {
    super();
    this.#animator = animator;

    [this.#title, this.#free, this.#mult, this.#banner, this.#autoplayStatus].forEach((t) => t.anchor.set(0.5));
    this.#banner.alpha = 0;
    this.#bannerShade.alpha = 0;
    this.#purchaseDialog.visible = false;
    this.#purchaseDialog.eventMode = 'static';
    this.#purchaseShade.eventMode = 'static';
    [this.#purchaseTitle, this.#purchaseCost].forEach((t) => t.anchor.set(0.5));
    this.#purchaseDialog.addChild(
      this.#purchaseShade, this.#purchasePanel, this.#purchaseTitle, this.#purchaseCost,
      this.#purchaseYes, this.#purchaseCancel,
    );
    this.addChild(
      this.#title, this.#free, this.#mult, this.#balance, this.#bet, this.#win,
      this.#betMinus, this.#betPlus, this.#spin, this.#turbo, this.#bonus,
      this.#autoplayCount, this.#autoplayToggle, this.#autoplayStatus, this.#bannerShade, this.#banner,
      this.#purchaseDialog,
    );

    this.#spin.on('press', () => this.emit('spin'));
    this.#betMinus.on('press', () => this.emit('betDown'));
    this.#betPlus.on('press', () => this.emit('betUp'));
    this.#turbo.on('press', () => this.emit('turbo'));
    this.#bonus.on('press', () => this.emit('buyBonus'));
    this.#autoplayCount.on('press', () => this.emit('autoplayCount'));
    this.#autoplayToggle.on('press', () => this.emit('autoplayToggle'));
    this.#purchaseYes.on('press', () => this.#finishPurchase(true));
    this.#purchaseCancel.on('press', () => this.#finishPurchase(false));
    this.setWin(0);
  }

  layout(orientation) {
    const p = POSITIONS[orientation];
    const place = (view, key) => view.position.set(...p[key]);
    place(this.#title, 'title');
    place(this.#free, 'free');
    place(this.#mult, 'mult');
    place(this.#banner, 'banner');
    place(this.#win, 'win');
    place(this.#balance, 'balance');
    place(this.#bet, 'bet');
    place(this.#betMinus, 'betMinus');
    place(this.#betPlus, 'betPlus');
    place(this.#spin, 'spin');
    place(this.#turbo, 'turbo');
    place(this.#bonus, 'bonus');
    place(this.#autoplayCount, 'autoplayCount');
    place(this.#autoplayToggle, 'autoplayToggle');
    place(this.#autoplayStatus, 'autoplayStatus');
    this.#bannerShade.position.set(...p.banner);
    this.#bannerShade.clear().rect(-380, -70, 760, 140).fill({ color: 0x000000 });

    const design = orientation === 'landscape' ? { width: 1280, height: 720 } : { width: 720, height: 1280 };
    const dialogWidth = orientation === 'landscape' ? 680 : 620;
    this.#purchaseDialog.position.set(design.width / 2, design.height / 2);
    this.#purchaseShade.clear().rect(-design.width / 2, -design.height / 2, design.width, design.height).fill({ color: 0x000000, alpha: 0.72 });
    this.#purchasePanel.clear().roundRect(-dialogWidth / 2, -160, dialogWidth, 320, 24)
      .fill({ color: COLORS.panel }).stroke({ width: 4, color: COLORS.panelEdge });
    this.#purchaseTitle.position.set(0, -92);
    this.#purchaseCost.position.set(0, -35);
    this.#purchaseYes.position.set(-105, 82);
    this.#purchaseCancel.position.set(105, 82);
  }

  // ---------- Değer göstergeleri ----------

  setBalance(value) {
    this.#balance.text = fmt(value);
  }

  setBet(value) {
    this.#bet.text = fmt(value);
  }

  setWin(value) {
    this.#winShown = value;
    this.#win.text = fmt(value);
  }

  /** Kazanç sayacını mevcut değerden hedefe doğru sayarak götürür. */
  async countWinTo(target, duration = TIMING.countUp) {
    if (Math.abs(target - this.#winShown) < 0.005) return;
    const counter = { value: this.#winShown };
    await this.#animator.tween(counter, { value: target }, duration, easeOutQuad, () => this.setWin(counter.value));
    this.setWin(target);
  }

  /** 0 verilirse gizler. */
  setMultiplier(value) {
    this.#mult.text = value > 0 ? `ÇARPAN x${value}` : '';
    if (value > 0) {
      this.#mult.scale.set(1.35);
      this.#animator.tween(this.#mult, { scale: 1 }, 260, (t) => easeOutBack(t, 1.5));
    }
  }

  /** { current, total } ya da null (gizle). */
  setFreeSpins(info) {
    this.#free.text = info ? `BEDAVA DÖNÜŞ  ${info.current} / ${info.total}` : '';
  }

  /** Oyuncudan bonus satın alma onayı alır; iptal edilirse false döner. */
  confirmBonusPurchase(cost) {
    if (this.#resolvePurchase) return Promise.resolve(false);
    this.#purchaseCost.text = `Bedel: ${fmt(cost)}`;
    this.#purchaseDialog.visible = true;
    return new Promise((resolve) => { this.#resolvePurchase = resolve; });
  }

  #finishPurchase(confirmed) {
    const resolve = this.#resolvePurchase;
    if (!resolve) return;
    this.#resolvePurchase = null;
    this.#purchaseDialog.visible = false;
    resolve(confirmed);
  }

  setAutoplay({ selected, remaining, running }) {
    this.#autoplayCount.setLabel(`OTO ×${selected}`);
    this.#autoplayToggle.setLabel(running ? 'DURDUR' : 'OTO BAŞLAT');
    this.#autoplayStatus.text = running ? `KALAN ${remaining} TUR` : '';
  }

  async showBanner(message, hold = TIMING.banner) {
    this.#banner.text = message;
    this.#banner.scale.set(0.6);
    await Promise.all([
      this.#animator.tween(this.#bannerShade, { alpha: 0.65 }, 200),
      this.#animator.tween(this.#banner, { alpha: 1, scale: 1 }, 320, (t) => easeOutBack(t, 1.6)),
    ]);
    await this.#animator.wait(hold);
    await Promise.all([
      this.#animator.tween(this.#bannerShade, { alpha: 0 }, 220),
      this.#animator.tween(this.#banner, { alpha: 0 }, 220),
    ]);
  }

  // ---------- Kontrol durumları ----------

  setTurbo(on) {
    this.#turbo.setFill(on ? 0x2e9d6b : COLORS.button);
  }

  setControls({ canSpin, canChangeBet, canBuyBonus = false, canAutoplay = false, autoplayRunning = false }) {
    this.#spin.setEnabled(canSpin);
    this.#betMinus.setEnabled(canChangeBet);
    this.#betPlus.setEnabled(canChangeBet);
    this.#bonus.setEnabled(canBuyBonus);
    this.#autoplayCount.setEnabled(canAutoplay);
    this.#autoplayToggle.setEnabled(canAutoplay || autoplayRunning);
  }
}
