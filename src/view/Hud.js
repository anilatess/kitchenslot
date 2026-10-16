import { Container, Graphics, Text } from 'pixi.js';
import { COLORS, TIMING } from '../core/constants.js';
import { easeOutBack, easeOutQuad } from '../animation/easing.js';
import { Button } from './Button.js';
import { Readout } from './Readout.js';
import { RulesPanel } from './RulesPanel.js';
import { ChefBonusView } from './ChefBonusView.js';
import { FeatureOverlay } from './FeatureOverlay.js';

const UI = { surface: 0x101b17, edge: 0xbda675, text: 0xf4f0e5, muted: 0x9aaa9e, gold: 0xdfc58a };
const fmt = (n) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const POSITIONS = {
  landscape: {
    title: [620, 46], free: [620, 92], mult: [1095, 523], banner: [620, 352],
    win: [833, 656], balance: [405, 656], bet: [620, 656],
    betMinus: [535, 656], betPlus: [705, 656], spin: [1095, 438],
    turbo: [1095, 347], bonus: [1095, 244], resetBalance: [405, 656],
    autoplayCount: [1024, 299], autoplayToggle: [1142, 299], autoplayStatus: [1095, 372],
    audio: [1027, 192], history: [1096, 192], settings: [1144, 192], rules: [1196, 192], hint: [1095, 523],
  },
  portrait: {
    title: [360, 60], free: [360, 137], mult: [522, 1101], banner: [360, 430],
    win: [515, 754], balance: [205, 754], bet: [360, 817],
    betMinus: [228, 817], betPlus: [492, 817], spin: [548, 1046],
    turbo: [548, 914], bonus: [236, 1002], resetBalance: [205, 754],
    autoplayCount: [140, 1092], autoplayToggle: [308, 1092], autoplayStatus: [360, 1154],
    audio: [176, 914], history: [166, 914], settings: [350, 914], rules: [624, 60], hint: [548, 1146],
  },
};
const text = (value, size, fill, extra = {}) => new Text({ text: value, style: {
  fontFamily: 'system-ui, sans-serif', fontSize: size, fontWeight: '600', fill, ...extra,
} });

export class Hud extends Container {
  #animator;
  #winShown = 0;
  #spinMode = 'base';
  #chef = new ChefBonusView();
  #portrait = false;
  #feature;
  #stepLabel = text('', 18, UI.gold);
  #breakdownLabel = text('', 17, UI.gold);
  #stepToken = 0;
  #title = text('MUTFAK SLOT', 38, UI.text, { fontFamily: 'Georgia, serif', fontWeight: '700', letterSpacing: 3 });
  #subtitle = text('TAZE SEMBOLLER · SICAK KAZANÇLAR', 12, UI.gold, { letterSpacing: 2 });
  #free = text('', 21, UI.gold);
  #mult = text('', 18, UI.gold);
  #hint = text('BOŞLUK İLE DÖNDÜR', 10, UI.muted, { letterSpacing: 1.3 });
  #banner = text('', 50, UI.gold);
  #bannerShade = new Graphics();
  #titleSign = new Graphics();
  #controlPanel = new Graphics();
  #statsPanel = new Graphics();

  #balance = new Readout('BAKİYE', { valueSize: 26, width: 145 });
  #bet = new Readout('TOPLAM BAHİS', { valueSize: 24, width: 100 });
  #win = new Readout('KAZANÇ', { valueSize: 28, valueColor: UI.gold, width: 140 });
  #betMinus = new Button({ label: '−', width: 34, height: 34, radius: 9, fontSize: 24 });
  #betPlus = new Button({ label: '+', width: 34, height: 34, radius: 9, fontSize: 24 });
  #spin = new Button({ label: 'SPIN', width: 112, height: 112, variant: 'spin', fontSize: 13, color: 0x17231e });
  #turbo = new Button({ label: 'TURBO', width: 220, height: 32, fontSize: 14 });
  #bonus = new Button({ label: 'BONUS AL (100x)', width: 220, height: 44, fill: 0xc9b17b, color: 0x17231e, fontSize: 17 });
  #autoplayCount = new Button({ label: 'OTO ×10', width: 82, height: 36, fontSize: 15 });
  #autoplayToggle = new Button({ label: 'OTO BAŞLAT', width: 126, height: 36, fontSize: 14 });
  #autoplayStatus = text('', 12, UI.muted);
  #resetBalance = new Button({ label: 'BAKİYEYİ SIFIRLA', width: 150, height: 34, fontSize: 10 });
  #audio = new Button({ label: 'SES AÇIK', width: 132, height: 32, fontSize: 12 });
  #historyButton = new Button({ label: 'GEÇMİŞ', width: 36, height: 32, fontSize: 18, accessibleLabel: 'Tur geçmişi' });
  #settingsButton = new Button({ label: 'AYARLAR', width: 36, height: 32, fontSize: 18, accessibleLabel: 'Ses ve oyun ayarları' });
  #rulesButton = new Button({ label: '?', width: 32, height: 32, fontSize: 20 });
  #rulesPanel = new RulesPanel();

  #purchaseDialog = new Container();
  #purchaseShade = new Graphics();
  #purchasePanel = new Graphics();
  #purchaseTitle = text('BONUS SATIN AL', 28, UI.gold);
  #purchaseCost = text('', 24, UI.text);
  #purchaseYes = new Button({ label: 'EVET', width: 170, height: 54, fill: 0xc9b17b, color: 0x17231e, fontSize: 18 });
  #purchaseCancel = new Button({ label: 'VAZGEÇ', width: 170, height: 54, fontSize: 18 });
  #resolvePurchase = null;

  constructor(animator) {
    super();
    this.#animator = animator;
    this.#feature = new FeatureOverlay(animator);
    [this.#rulesPanel, this.#purchaseDialog, this.#feature]
      .forEach((panel) => { panel.accessibilityModal = true; });
    [this.#title, this.#subtitle, this.#free, this.#mult, this.#hint, this.#banner, this.#autoplayStatus]
      .forEach((item) => item.anchor.set(0.5));
    this.#banner.alpha = 0;
    this.#bannerShade.alpha = 0;
    this.#stepLabel.anchor.set(0.5);
    this.#stepLabel.alpha = 0;
    this.#breakdownLabel.anchor.set(0.5);
    this.#breakdownLabel.visible = false;
    this.#breakdownLabel.label = 'spin-breakdown';
    this.#purchaseDialog.visible = false;
    this.#purchaseDialog.eventMode = 'static';
    this.#purchaseShade.eventMode = 'static';
    [this.#purchaseTitle, this.#purchaseCost].forEach((item) => item.anchor.set(0.5));
    this.#purchaseDialog.addChild(this.#purchaseShade, this.#purchasePanel, this.#purchaseTitle,
      this.#purchaseCost, this.#purchaseYes, this.#purchaseCancel);
    this.addChild(this.#chef, this.#titleSign, this.#controlPanel, this.#statsPanel,
      this.#title, this.#subtitle, this.#free, this.#mult, this.#hint, this.#balance, this.#bet, this.#win,
      this.#betMinus, this.#betPlus, this.#spin, this.#turbo, this.#bonus,
      this.#autoplayCount, this.#autoplayToggle, this.#autoplayStatus, this.#resetBalance,
      this.#audio, this.#historyButton, this.#settingsButton, this.#stepLabel, this.#breakdownLabel,
      this.#bannerShade, this.#banner, this.#rulesButton,
      this.#purchaseDialog, this.#feature, this.#rulesPanel);
    const events = [[this.#spin, 'spin'], [this.#betMinus, 'betDown'], [this.#betPlus, 'betUp'],
      [this.#turbo, 'turbo'], [this.#bonus, 'buyBonus'], [this.#autoplayCount, 'autoplayCount'],
      [this.#autoplayToggle, 'autoplayToggle'], [this.#resetBalance, 'resetBalance'], [this.#audio, 'audioToggle'],
      [this.#historyButton, 'history'], [this.#settingsButton, 'settings']];
    events.forEach(([button, event]) => button.on('press', () => this.emit(event)));
    this.#rulesButton.on('press', () => {
      if (!this.#purchaseDialog.visible && !this.#feature.visible) this.#rulesPanel.toggle();
    });
    this.#purchaseYes.on('press', () => this.#finishPurchase(true));
    this.#purchaseCancel.on('press', () => this.#finishPurchase(false));
    this.setWin(0);
  }

  layout(orientation) {
    const p = POSITIONS[orientation];
    this.#portrait = orientation === 'portrait';
    this.#chef.layout(orientation);
    this.#feature.layout(orientation);
    this.#hint.visible = !this.#portrait && !this.#mult.text && this.#spinMode !== 'free';
    [[this.#bonus, 15, 25], [this.#turbo, 12, 23], [this.#autoplayCount, 12, 21],
      [this.#autoplayToggle, 12, 22], [this.#audio, 11, 22], [this.#spin, 11, 18],
      [this.#betMinus, 22, 36], [this.#betPlus, 22, 36]]
      .forEach(([button, desktop, mobile]) => button.setFontSize(this.#portrait ? mobile : desktop));
    [[this.#bonus, 220, 44, 304, 84], [this.#turbo, 220, 32, 164, 84],
      [this.#audio, 88, 32, 184, 84], [this.#rulesButton, 32, 32, 84, 84],
      [this.#historyButton, 36, 32, 164, 84], [this.#settingsButton, 36, 32, 164, 84],
      [this.#autoplayCount, 82, 36, 112, 84], [this.#autoplayToggle, 126, 36, 200, 84],
      [this.#betMinus, 34, 34, 84, 84], [this.#betPlus, 34, 34, 84, 84],
      [this.#spin, 112, 112, 152, 152], [this.#resetBalance, 150, 34, 220, 84]]
      .forEach(([button, dw, dh, mw, mh]) => button.setSize(this.#portrait ? mw : dw, this.#portrait ? mh : dh));
    this.#rulesButton.setFontSize(this.#portrait ? 32 : 20);
    this.#historyButton.setLabel(this.#portrait ? 'GEÇMİŞ' : '≡');
    this.#settingsButton.setLabel(this.#portrait ? 'AYARLAR' : '⚙');
    this.#historyButton.setFontSize(this.#portrait ? 22 : 22);
    this.#settingsButton.setFontSize(this.#portrait ? 21 : 21);
    this.#audio.visible = !this.#portrait;
    [this.#balance, this.#bet, this.#win].forEach((readout) => readout.setCaptionSize(this.#portrait ? 18 : 12));
    this.#balance.setValueSize(this.#portrait ? 32 : 26);
    this.#bet.setValueSize(this.#portrait ? 32 : 24);
    this.#win.setValueSize(this.#portrait ? 34 : 28);
    this.#stepLabel.position.set(this.#portrait ? 360 : 620, this.#portrait ? 681 : 600);
    this.#stepLabel.style ??= {};
    this.#stepLabel.style.fontSize = this.#portrait ? 25 : 18;
    this.#breakdownLabel.position.set(this.#portrait ? 360 : 620, this.#portrait ? 681 : 600);
    this.#breakdownLabel.style ??= {};
    this.#breakdownLabel.style.fontSize = this.#portrait ? 23 : 17;
    this.#autoplayStatus.style ??= {};
    this.#autoplayStatus.style.fontSize = this.#portrait ? 20 : 12;
    const fields = { title: this.#title, free: this.#free, mult: this.#mult, hint: this.#hint,
      banner: this.#banner, win: this.#win, balance: this.#balance, bet: this.#bet,
      betMinus: this.#betMinus, betPlus: this.#betPlus, spin: this.#spin, turbo: this.#turbo,
      bonus: this.#bonus, autoplayCount: this.#autoplayCount, autoplayToggle: this.#autoplayToggle,
      autoplayStatus: this.#autoplayStatus, resetBalance: this.#resetBalance, audio: this.#audio,
      history: this.#historyButton, settings: this.#settingsButton, rules: this.#rulesButton };
    Object.entries(fields).forEach(([key, view]) => view.position.set(...p[key]));
    this.#subtitle.position.set(p.title[0], orientation === 'portrait' ? 102 : 87);
    this.#rulesPanel.layout(orientation);
    this.#drawSurfaces(orientation, p);
    this.#bannerShade.position.set(...p.banner);
    const portrait = orientation === 'portrait';
    const bannerWidth = portrait ? 640 : 700;
    this.#bannerShade.clear().roundRect(-bannerWidth / 2, -65, bannerWidth, 130, 18)
      .fill({ color: UI.surface, alpha: 0.96 });
    const design = portrait ? { width: 720, height: 1280 } : { width: 1280, height: 720 };
    const dialogWidth = portrait ? 620 : 640;
    this.#purchaseDialog.position.set(design.width / 2, design.height / 2);
    this.#purchaseShade.clear().rect(-design.width / 2, -design.height / 2, design.width, design.height)
      .fill({ color: 0x030907, alpha: 0.8 });
    const dialogHeight = portrait ? 380 : 304;
    this.#purchasePanel.clear().roundRect(-dialogWidth / 2, -dialogHeight / 2, dialogWidth, dialogHeight, 20)
      .fill({ color: UI.surface }).stroke({ width: 1, color: UI.edge, alpha: 0.5 });
    this.#purchaseTitle.position.set(0, portrait ? -110 : -83);
    this.#purchaseCost.position.set(0, portrait ? -35 : -26);
    this.#purchaseYes.position.set(portrait ? -140 : -100, portrait ? 100 : 78);
    this.#purchaseCancel.position.set(portrait ? 140 : 100, portrait ? 100 : 78);
    [this.#purchaseYes, this.#purchaseCancel].forEach(button => {
      button.setSize(portrait ? 240 : 170, portrait ? 84 : 54);
      button.setFontSize(portrait ? 26 : 18);
    });
    this.#purchaseTitle.style ??= {}; this.#purchaseCost.style ??= {};
    this.#purchaseTitle.style.fontSize = portrait ? 32 : 28;
    this.#purchaseCost.style.fontSize = portrait ? 32 : 24;
    this.#syncBonusControls();
  }

  #drawSurfaces(orientation, p) {
    const portrait = orientation === 'portrait';
    this.#titleSign.clear();
    this.#titleSign.rect(p.title[0] - 72, portrait ? 122 : 105, 144, 1)
      .fill({ color: UI.gold, alpha: 0.3 });
    this.#controlPanel.clear(); this.#statsPanel.clear();
    const surface = (graphics, x, y, w, h, radius) => {
      graphics.roundRect(x, y + 7, w, h, radius).fill({ color: 0x030907, alpha: 0.3 })
        .roundRect(x, y, w, h, radius).fill({ color: UI.surface, alpha: 0.82 })
        .stroke({ width: 1, color: UI.edge, alpha: 0.3 })
        .rect(x + 24, y + 1, w - 48, 1).fill({ color: 0xffffff, alpha: 0.055 });
    };
    if (portrait) {
      surface(this.#statsPanel, 56, 706, 608, 152, 16);
      this.#statsPanel.rect(360, 731, 1, 43).fill({ color: UI.edge, alpha: 0.16 })
        .rect(80, 788, 560, 1).fill({ color: UI.edge, alpha: 0.12 });
      surface(this.#controlPanel, 56, 864, 608, this.#chef.active ? 108 : 278, 18);
    } else {
      // The chef and the bonus pot occupy the reserved left area.
      surface(this.#statsPanel, 316, 622, 608, 66, 14);
      this.#statsPanel.rect(490, 638, 1, 34).fill({ color: UI.edge, alpha: 0.18 })
        .rect(748, 638, 1, 34).fill({ color: UI.edge, alpha: 0.18 });
      surface(this.#controlPanel, 965, 164, 260, 382, 18);
      this.#controlPanel.rect(983, 219, 224, 1).fill({ color: UI.edge, alpha: 0.12 });
    }
  }

  update(deltaMS) {
    this.#spin.update(deltaMS);
    this.#chef.update(deltaMS);
    this.#feature.update(deltaMS);
  }

  beginRound() {
    this.#stepToken++;
    this.#stepLabel.alpha = 0;
    this.#spinMode = 'base';
    this.#chef.resetRound();
    this.clearSpinBreakdown();
    this.#syncBonusControls();
    this.#mult.visible = true;
    this.setMultiplier(0);
  }

  setSpinMode(mode) {
    if (mode === 'free' && this.#spinMode !== 'free') this.#chef.startBonus();
    this.#spinMode = mode;
    this.#mult.visible = mode !== 'free';
    if (mode === 'free') { this.#mult.text = ''; this.#hint.visible = false; }
    this.#syncBonusControls();
  }

  finishRound() {
    if (this.#spinMode === 'free') this.#chef.finishBonus();
    this.#syncBonusControls();
  }

  get hasModal() { return this.#rulesPanel.visible || this.#purchaseDialog.visible || this.#feature.visible; }
  get rulesOpen() { return this.#rulesPanel.visible; }
  get purchaseOpen() { return this.#purchaseDialog.visible; }
  get featureOpen() { return this.#feature.visible; }
  get accessibilityRoot() {
    if (this.#rulesPanel.visible) return this.#rulesPanel;
    if (this.#purchaseDialog.visible) return this.#purchaseDialog;
    if (this.#feature.visible) return this.#feature;
    return this;
  }

  dismissModal() {
    if (this.#rulesPanel.visible) { this.#rulesPanel.hide(); return true; }
    if (this.#purchaseDialog.visible) { this.#finishPurchase(false); return true; }
    if (this.#feature.visible) { this.#feature.dismiss(); return true; }
    return false;
  }

  showBonusIntro({ spins }) {
    return this.#feature.show({ eyebrow: 'ŞEF OCAĞI YAKIYOR', title: 'BONUS BAŞLIYOR',
      value: `${spins} DÖNÜŞ`, detail: 'Çarpanları biriktir, ateşi harla.',
      note: 'Çarpan toplamı bonus boyunca korunur.', hold: 2200, button: 'HADİ PİŞİRELİM' });
  }

  showBonusRetrigger({ spins, remaining }) {
    this.#chef.celebrate?.('big');
    return this.#feature.show({ eyebrow: 'OCAK AÇIK KALIYOR', title: 'EK BEDAVA DÖNÜŞ',
      value: `+${spins}`, detail: `${remaining} dönüş daha seni bekliyor.`,
      note: 'Biriken çarpanla devam!', hold: 1500 });
  }

  showBonusSummary({ win, multiplier, spins }) {
    this.#chef.celebrate?.('super');
    return this.#feature.show({ eyebrow: 'SERVİS HAZIR', title: 'BONUS TAMAMLANDI', amount: win,
      detail: `${spins} bedava dönüş  ·  x${multiplier} biriken çarpan`,
      note: 'TOPLAM TUR KAZANCI', hold: null, button: 'HARİKA, DEVAM ET' });
  }

  showWinCelebration({ win, multiplier, tier, capped }) {
    this.#chef.celebrate?.(tier);
    const title = capped ? 'MAKSİMUM KAZANÇ' : { big: 'BÜYÜK KAZANÇ', mega: 'MUHTEŞEM KAZANÇ', super: 'OLAĞANÜSTÜ KAZANÇ' }[tier];
    return this.#feature.show({ eyebrow: 'ŞEFİN İMZASI', title, amount: win,
      detail: `${Number(multiplier.toFixed(2)).toLocaleString('tr-TR')}x bahis`,
      note: capped ? 'Maksimum ödeme tutarına ulaşıldı.' : 'Afiyetle kazandın!', hold: 2100 });
  }

  showStepWin({ amount, ways }) {
    const token = ++this.#stepToken;
    this.#stepLabel.text = `+${fmt(amount)}${ways ? `  ·  ${ways} YOL` : ''}`;
    this.#stepLabel.alpha = 1;
    this.#animator.wait(1500).then(() => {
      if (token === this.#stepToken) return this.#animator.tween(this.#stepLabel, { alpha: 0 }, 200);
    });
  }

  clearSpinBreakdown() {
    this.#stepToken++;
    this.#stepLabel.alpha = 0;
    this.#breakdownLabel.visible = false;
    this.#breakdownLabel.text = '';
  }

  showSpinBreakdown({ raw, multiplier, payout, capped = false }) {
    this.#stepToken++;
    this.#stepLabel.alpha = 0;
    const factor = Number(multiplier).toLocaleString('tr-TR', { maximumFractionDigits: 2 });
    this.#breakdownLabel.text = `${fmt(raw)} × ${factor} = ${fmt(payout)}${capped ? ' · TAVAN' : ''}`;
    this.#breakdownLabel.visible = true;
  }

  // ---------- Değer göstergeleri ----------

  setBalance(value) {
    this.#balance.text = fmt(value);
  }

  setBankrupt(isBankrupt) {
    this.#resetBalance.visible = isBankrupt;
    this.#balance.visible = !isBankrupt;
  }

  setAudioEnabled(enabled) {
    this.#audio.setLabel(enabled ? 'SES AÇIK' : 'SES KAPALI');
    this.#audio.setFill(enabled ? 0x1c2824 : 0x151f1b);
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
    if (this.#spinMode === 'free') { this.#chef.setTotal(value); return; }
    this.#mult.text = value > 0 ? `ÇARPAN x${value}` : '';
    this.#hint.visible = value <= 0 && !this.#portrait;
    if (value > 0) {
      this.#mult.scale.set(1.35);
      this.#animator.tween(this.#mult, { scale: 1 }, 260, (t) => easeOutBack(t, 1.5));
    }
  }

  /** Çarpan sembolünden HUD göstergesine kısa bir parıltı uçurur. */
  flyMultiplier(value, origin) {
    if (!origin) return;
    const inBonus = this.#spinMode === 'free';
    const target = inBonus ? this.#chef.collectionTarget : { x: this.#mult.x, y: this.#mult.y };
    const flyer = text('+' + value, 27, COLORS.gold, { stroke: { color: 0x331609, width: 4 } });
    flyer.anchor.set(0.5);
    flyer.position.set(origin.x, origin.y);
    this.addChild(flyer);
    const progress = { t: 0 };
    const control = { x: (origin.x + target.x) / 2, y: Math.min(origin.y, target.y) - 95 };
    this.#animator.tween(progress, { t: 1 }, TIMING.collect + 120, easeOutQuad, () => {
      const t = progress.t, u = 1 - t;
      flyer.position.set(u * u * origin.x + 2 * u * t * control.x + t * t * target.x,
        u * u * origin.y + 2 * u * t * control.y + t * t * target.y);
      flyer.scale.set(0.8 + Math.sin(t * Math.PI) * 0.3);
      flyer.alpha = t < 0.8 ? 1 : (1 - t) / 0.2;
    }).then(() => {
      if (inBonus) this.#chef.collectPulse();
      flyer.destroy({ children: true });
    });
  }

  /** { current, total } ya da null (gizle). */
  setFreeSpins(info) {
    this.#free.text = info ? `BEDAVA DÖNÜŞ  ${info.current} / ${info.total}` : '';
    this.#subtitle.visible = !info;
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
    this.#autoplayToggle.setSelected(running);
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
    this.#turbo.setSelected(on);
    this.#turbo.setLabel(on ? 'TURBO AÇIK' : 'TURBO');
  }

  setControls({ canSpin, canFinishSpin = false, canChangeBet, canBuyBonus = false, canAutoplay = false, autoplayRunning = false }) {
    this.#spin.setEnabled(canSpin || canFinishSpin);
    this.#spin.setLabel(canFinishSpin ? 'BİTİR' : 'SPIN');
    this.#spin.setAccessibleLabel(canFinishSpin ? 'Bu dönüşün animasyonunu bitir' : 'Döndür');
    this.#betMinus.setEnabled(canChangeBet);
    this.#betPlus.setEnabled(canChangeBet);
    this.#bonus.setEnabled(canBuyBonus);
    this.#autoplayCount.setEnabled(canAutoplay);
    this.#autoplayToggle.setEnabled(canAutoplay || autoplayRunning);
    this.#rulesButton.setEnabled(canChangeBet);
    this.#syncBonusControls();
  }

  #syncBonusControls() {
    const bonus = this.#portrait && this.#chef.active;
    this.#bonus.visible = !bonus;
    this.#autoplayCount.visible = !bonus;
    this.#autoplayToggle.visible = !bonus;
    this.#autoplayStatus.visible = !bonus;
    this.#drawSurfaces(this.#portrait ? 'portrait' : 'landscape', POSITIONS[this.#portrait ? 'portrait' : 'landscape']);
  }
}
