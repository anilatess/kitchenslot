import { Application } from 'pixi.js';
import { playRound } from '../game/engine.js';
import { RULES } from '../game/config.js';
import { createRng } from '../game/rng.js';
import { Animator } from '../animation/Animator.js';
import { RoundPlayer } from '../presenter/RoundPlayer.js';
import { GridView } from '../view/GridView.js';
import { Hud } from '../view/Hud.js';
import { COLORS } from './constants.js';
import { GameState } from './GameState.js';
import { Autoplay } from './Autoplay.js';
import { ResponsiveRoot } from './ResponsiveRoot.js';
import { AudioManager } from '../audio/AudioManager.js';

// Kuralları ve sunumu bağlar; resmi ödeme, animasyonun dönüş değerine bağlı değildir.
export class Game {
  #host;
  #photographicBackdrop;
  #state = new GameState();
  #rng = createRng();
  #player;
  #hud;
  #animator;
  #autoplay;
  #audio;
  #app;
  #keyHandler;
  #notice = null;

  constructor(host, { photographicBackdrop = false } = {}) {
    this.#host = host;
    this.#photographicBackdrop = photographicBackdrop;
  }

  async start() {
    const app = this.#app = new Application();
    try {
      await app.init({
        resizeTo: this.#host,
        background: COLORS.background,
        backgroundAlpha: this.#photographicBackdrop ? 0 : 1,
        antialias: true,
        autoDensity: true,
        resolution: Math.min(window.devicePixelRatio || 1, 2),
      });
      this.#host.appendChild(app.canvas);

      const animator = new Animator(app.ticker);
      const root = new ResponsiveRoot(app, { photographicBackdrop: this.#photographicBackdrop });
      const grid = root.add(new GridView(animator));
      const hud = root.add(new Hud(animator));
      app.stage.addChild(root);

      this.#audio = new AudioManager();
      this.#player = new RoundPlayer({ grid, hud, animator, audio: this.#audio });
      this.#hud = hud;
      this.#animator = animator;
      hud.setAudioEnabled(this.#audio.enabled);
      this.#autoplay = new Autoplay({
        play: () => this.#playRound(false),
        canSpin: () => this.#state.canSpin && !hud.hasModal && !this.#notice,
        onChange: (value) => { hud.setAutoplay(value); this.#syncHud(); },
      });

      this.#bindInput();
      this.#state.on('change', () => this.#syncHud());
      this.#syncHud();
      root.resize();
      grid.showPreview();
      app.ticker.add((tick) => hud.update(tick.deltaMS));
      if (this.#state.pendingRound) {
        this.#state.setBusy(true);
        // Açılış yükleme ekranı kalkar; kayıtlı tur aynı bahisle ve ikinci kesinti olmadan devam eder.
        void this.#resumePending();
      }
    } catch (error) {
      this.destroy();
      throw error;
    }
  }

  destroy() {
    if (this.#keyHandler) window.removeEventListener('keydown', this.#keyHandler);
    this.#notice?.remove();
    this.#notice = null;
    try { this.#app?.destroy(true, { children: true }); } catch { /* Kısmen açılan renderer da temizlenir. */ }
    this.#app = null;
  }

  #bindInput() {
    const state = this.#state;
    this.#hud.on('spin', () => this.#spin());
    this.#hud.on('betUp', () => state.changeBet(+1));
    this.#hud.on('betDown', () => state.changeBet(-1));
    this.#hud.on('turbo', () => state.toggleTurbo());
    this.#hud.on('resetBalance', () => state.resetBalance());
    this.#hud.on('audioToggle', () => {
      this.#audio.unlock();
      this.#audio.setEnabled(!this.#audio.enabled);
      this.#hud.setAudioEnabled(this.#audio.enabled);
    });
    this.#hud.on('buyBonus', () => this.#buyBonus());
    this.#hud.on('autoplayCount', () => this.#autoplay.selectNext());
    this.#hud.on('autoplayToggle', () => {
      this.#audio.unlock();
      if (this.#autoplay.running) return this.#autoplay.stop();
      if (this.#hud.hasModal || this.#notice) return;
      return this.#autoplay.start().catch(() => this.#roundStartFailed());
    });
    this.#keyHandler = (event) => {
      if (event.code === 'Escape') { this.#hud.dismissModal?.(); return; }
      if (event.code !== 'Space' || event.repeat || this.#notice || this.#hud.hasModal) return;
      event.preventDefault();
      void this.#spin();
    };
    window.addEventListener('keydown', this.#keyHandler);
  }

  #syncHud() {
    const state = this.#state;
    this.#hud.setBalance(state.balance);
    this.#hud.setBankrupt(state.isBankrupt);
    this.#hud.setBet(state.bet);
    this.#hud.setTurbo(state.turbo);
    this.#hud.setAudioEnabled(this.#audio?.enabled ?? true);
    this.#hud.setControls({
      canSpin: state.canSpin && !this.#autoplay?.active,
      canChangeBet: !state.busy && !state.pendingRound && !this.#autoplay?.active,
      canBuyBonus: state.canBuyBonus && !this.#autoplay?.active,
      canAutoplay: state.canSpin && !this.#autoplay?.active,
      autoplayRunning: this.#autoplay?.running,
    });
    this.#animator.setTurbo(state.turbo);
  }

  async #spin() {
    this.#audio.unlock();
    if (!this.#state.canSpin || this.#autoplay?.active || this.#hud.hasModal || this.#notice) return;
    try { await this.#playRound(false); } catch { this.#roundStartFailed(); }
  }

  async #buyBonus() {
    const state = this.#state;
    this.#audio.unlock();
    if (!state.canBuyBonus || this.#autoplay?.active || this.#hud.hasModal || this.#notice) return;
    state.setBusy(true);
    try {
      const cost = state.bet * RULES.buyCost;
      if (await this.#hud.confirmBonusPurchase(cost) && state.balance >= cost) await this.#playRound(true);
    } catch {
      this.#roundStartFailed();
    } finally {
      state.setBusy(!!state.pendingRound);
    }
  }

  async #playRound(buy) {
    const state = this.#state;
    state.setBusy(true);
    try {
      const round = playRound(this.#rng, { record: true, buy });
      state.beginRound(round, { buy });
      this.#hud.setWin(0);
      this.#hud.setMultiplier(0);
      return await this.#presentPending();
    } finally {
      state.setBusy(!!state.pendingRound);
    }
  }

  async #resumePending() {
    try { await this.#hud.showBanner('TURUNA DEVAM EDİLİYOR', 900); } catch { /* Ödeme görsel bildirime bağlı değil. */ }
    await this.#presentPending();
  }

  async #presentPending() {
    const pending = this.#state.pendingRound;
    if (!pending) return;
    let presentationFailed = false;
    try {
      await this.#player.play(pending.round, pending.bet, {
        startSpin: pending.nextSpin,
        onProgress: (nextSpin) => this.#state.checkpointRound(nextSpin),
      });
    } catch {
      presentationFailed = true;
      this.#autoplay?.stop();
    }
    this.#settlePending(presentationFailed);
    return pending.round;
  }

  #settlePending(presentationFailed) {
    try {
      const payout = this.#state.settleRound();
      this.#state.setBusy(false);
      try {
        this.#hud.setWin(payout);
        this.#hud.setFreeSpins(null);
        this.#hud.finishRound?.();
      } catch { presentationFailed = true; }
      this.#notice?.remove();
      this.#notice = null;
      if (presentationFailed) {
        this.#showNotice('TUR TAMAMLANDI', 'Görsel akış kesildi. Turun resmi kazancı bakiyene eklendi; yeniden bahis kesilmedi.',
          'OYUNA DÖN', () => { this.#notice?.remove(); this.#notice = null; });
      }
    } catch {
      this.#autoplay?.stop();
      this.#state.setBusy(true);
      this.#showNotice('TUR SONUCUN KORUNUYOR', 'Sonuç kaydedildi ancak ödeme kaydı şu an güncellenemiyor. Aynı sonucu yeniden deneyeceğiz; ikinci kez bahis kesilmez.',
        'TEKRAR DENE', () => this.#settlePending(presentationFailed));
    }
  }

  #roundStartFailed() {
    this.#autoplay?.stop();
    if (this.#state.pendingRound) { this.#settlePending(true); return; }
    this.#showNotice('TUR BAŞLATILAMADI', 'Tur güvenle kaydedilemediği için bakiyenden bahis kesilmedi. Tarayıcı depolaması kullanılabilir olduğunda tekrar deneyebilirsin.',
      'TAMAM', () => { this.#notice?.remove(); this.#notice = null; });
  }

  #showNotice(title, message, label, action) {
    this.#notice?.remove();
    const overlay = document.createElement('div');
    overlay.setAttribute('role', 'alertdialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', title);
    Object.assign(overlay.style, { position: 'fixed', inset: '0', zIndex: '30', display: 'grid', placeItems: 'center', padding: '24px', background: '#090f0bd9', backdropFilter: 'blur(8px)', color: '#f5eedc', fontFamily: 'system-ui, sans-serif' });
    const card = document.createElement('div');
    Object.assign(card.style, { maxWidth: '400px', textAlign: 'center' });
    const heading = document.createElement('h2');
    heading.textContent = title;
    Object.assign(heading.style, { color: '#eed39a', fontSize: '22px' });
    const detail = document.createElement('p');
    detail.textContent = message;
    Object.assign(detail.style, { lineHeight: '1.6', fontSize: '16px' });
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    Object.assign(button.style, { minHeight: '48px', padding: '12px 28px', marginTop: '12px', border: '0', borderRadius: '12px', background: '#eed39a', color: '#17271f', font: '700 16px system-ui, sans-serif', cursor: 'pointer' });
    button.addEventListener('click', action);
    card.append(heading, detail, button);
    overlay.appendChild(card);
    this.#host.appendChild(overlay);
    this.#notice = overlay;
    button.focus();
  }
}
