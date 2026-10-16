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
import { SessionGuard } from './SessionGuard.js';
import { ButtonAccessibility } from '../view/ButtonAccessibility.js';
import { PlayerPanels } from '../view/PlayerPanels.js';

// Kuralları ve sunumu bağlar; resmi ödeme, animasyonun dönüş değerine bağlı değildir.
export class Game {
  #host;
  #photographicBackdrop;
  #state;
  #rng = createRng();
  #player;
  #hud;
  #animator;
  #autoplay;
  #audio;
  #app;
  #keyHandler;
  #notice = null;
  #guard;
  #panels;
  #accessibility;
  #visibilityHandler;
  #destroyed = false;
  #lost = false;

  constructor(host, { photographicBackdrop = false } = {}) {
    this.#host = host;
    this.#photographicBackdrop = photographicBackdrop;
  }

  async start() {
    try {
      this.#guard = new SessionGuard({ onLost: () => this.#sessionLost() });
      if (!await this.#guard.acquire()) {
        this.#sessionLost();
        return;
      }
      if (this.#destroyed) return;
      this.#state = new GameState({ canWrite: () => this.#ownsSession });
      const app = this.#app = new Application();
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
        canSpin: () => this.#state.canSpin && !hud.hasModal && !this.#blocked,
        onChange: (value) => { hud.setAutoplay(value); this.#syncHud(); },
      });
      this.#panels = new PlayerPanels(this.#host, {
        onVolume: (value) => { this.#audio.unlock(); this.#audio.setVolume(value); },
        onAudioToggle: (value) => { this.#audio.unlock(); this.#audio.setEnabled(value); this.#syncHud(); },
        onOpen: () => { this.#autoplay.stop(); this.#updateActivity(); },
        onClose: () => this.#updateActivity(),
      });
      this.#accessibility = new ButtonAccessibility(app.stage, app.canvas, {
        getRoot: () => this.#blocked ? null : hud.accessibilityRoot,
        getScreenSize: () => app.screen,
      });

      this.#bindInput();
      this.#state.on('change', () => this.#syncHud());
      this.#syncHud();
      root.resize();
      grid.showPreview();
      app.ticker.add((tick) => { hud.update(tick.deltaMS); this.#accessibility.update(); });
      this.#visibilityHandler = () => {
        if (document.hidden) this.#autoplay.stop();
        this.#updateActivity();
      };
      document.addEventListener?.('visibilitychange', this.#visibilityHandler);
      this.#updateActivity();
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
    this.#destroyed = true;
    this.#autoplay?.stop();
    if (this.#keyHandler) window.removeEventListener('keydown', this.#keyHandler);
    if (this.#visibilityHandler) document.removeEventListener?.('visibilitychange', this.#visibilityHandler);
    this.#panels?.destroy();
    this.#accessibility?.destroy();
    this.#audio?.setSuspended?.(true);
    this.#guard?.destroy();
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
      if (this.#blocked) return;
      this.#audio.unlock();
      this.#audio.setEnabled(!this.#audio.enabled);
      this.#hud.setAudioEnabled(this.#audio.enabled);
    });
    this.#hud.on('settings', () => {
      if (this.#blocked || this.#hud.hasModal) return;
      this.#panels.openSettings({ enabled: this.#audio.enabled, volume: this.#audio.volume });
    });
    this.#hud.on('history', () => {
      if (this.#blocked || this.#hud.hasModal) return;
      this.#panels.openHistory(this.#state.history);
    });
    this.#hud.on('menuChange', (open) => {
      if (open) this.#autoplay?.stop();
      this.#accessibility?.update();
    });
    this.#hud.on('buyBonus', () => this.#buyBonus());
    this.#hud.on('autoplayCount', () => this.#autoplay.selectNext());
    this.#hud.on('autoplayToggle', () => {
      this.#audio.unlock();
      if (this.#autoplay.running) return this.#autoplay.stop();
      if (this.#hud.hasModal || this.#blocked) return;
      return this.#autoplay.start().catch(() => this.#roundStartFailed());
    });
    this.#keyHandler = (event) => {
      if (this.#blocked) return;
      if (event.code === 'Escape') { this.#hud.dismissModal?.(); this.#accessibility?.update(); return; }
      const target = event.target;
      if (target?.isContentEditable || ['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'A'].includes(target?.tagName)) return;
      if (event.code !== 'Space' || event.repeat || this.#hud.hasModal) return;
      event.preventDefault();
      void this.#spin();
    };
    window.addEventListener('keydown', this.#keyHandler);
  }

  #syncHud() {
    if (this.#destroyed || !this.#hud || !this.#state) return;
    const state = this.#state;
    const available = !this.#blocked;
    this.#hud.setBalance(state.balance);
    this.#hud.setBankrupt(state.isBankrupt);
    this.#hud.setBet(state.bet);
    this.#hud.setTurbo(state.turbo);
    this.#hud.setAudioEnabled(this.#audio?.enabled ?? true);
    this.#hud.setControls({
      canSpin: available && state.canSpin && !this.#autoplay?.active,
      canFinishSpin: available && !!this.#player?.canSkip && !this.#hud.hasModal,
      canChangeBet: available && !state.busy && !state.pendingRound && !this.#autoplay?.active,
      canBuyBonus: available && state.canBuyBonus && !this.#autoplay?.active,
      canAutoplay: available && state.canSpin && !this.#autoplay?.active,
      autoplayRunning: available && this.#autoplay?.running,
    });
    this.#animator.setTurbo(state.turbo);
  }

  async #spin() {
    if (this.#blocked || this.#hud.hasModal) return;
    this.#audio.unlock();
    if (this.#state.busy && this.#player.canSkip) {
      this.#player.skipCurrentSpin();
      this.#syncHud();
      return;
    }
    if (!this.#state.canSpin || this.#autoplay?.active) return;
    try { await this.#playRound(false); } catch { this.#roundStartFailed(); }
  }

  async #buyBonus() {
    const state = this.#state;
    this.#audio.unlock();
    if (!state.canBuyBonus || this.#autoplay?.active || this.#hud.hasModal || this.#blocked) return;
    state.setBusy(true);
    try {
      const cost = state.bet * RULES.buyCost;
      if (await this.#hud.confirmBonusPurchase(cost) && this.#ownsSession && state.balance >= cost) await this.#playRound(true);
    } catch {
      this.#roundStartFailed();
    } finally {
      state.setBusy(!!state.pendingRound);
    }
  }

  async #playRound(buy) {
    if (!this.#ownsSession || this.#blocked) return;
    const state = this.#state;
    state.setBusy(true);
    try {
      const round = playRound(this.#rng, { record: true, buy });
      state.beginRound(round, { buy });
      if (round.freeTriggered) this.#autoplay?.stop();
      this.#hud.setWin(0);
      this.#hud.setMultiplier(0);
      return await this.#presentPending();
    } finally {
      state.setBusy(!!state.pendingRound);
    }
  }

  async #resumePending() {
    try { await this.#hud.showBanner('TURUNA DEVAM EDİLİYOR', 900); } catch { /* Ödeme görsel bildirime bağlı değil. */ }
    if (this.#ownsSession) await this.#presentPending();
  }

  async #presentPending() {
    if (!this.#ownsSession) { this.#sessionLost(); return; }
    const pending = this.#state.pendingRound;
    if (!pending) return;
    let presentationFailed = false;
    try {
      await this.#player.play(pending.round, pending.bet, {
        startSpin: pending.nextSpin,
        onProgress: (nextSpin) => this.#state.checkpointRound(nextSpin),
        onSkippableChange: () => this.#syncHud(),
      });
    } catch {
      presentationFailed = true;
      this.#autoplay?.stop();
    }
    if (!this.#ownsSession) { this.#sessionLost(); return; }
    this.#settlePending(presentationFailed);
    return pending.round;
  }

  #settlePending(presentationFailed) {
    if (!this.#ownsSession) { this.#sessionLost(); return; }
    try {
      const payout = this.#state.settleRound();
      this.#state.setBusy(false);
      try {
        this.#hud.setWin(payout);
        this.#hud.setFreeSpins(null);
        this.#hud.finishRound?.();
      } catch { presentationFailed = true; }
      this.#clearNotice();
      if (presentationFailed) {
        this.#showNotice('TUR TAMAMLANDI', 'Görsel akış kesildi. Turun resmi kazancı bakiyene eklendi; yeniden bahis kesilmedi.',
          'OYUNA DÖN', () => this.#clearNotice());
      }
    } catch {
      if (!this.#ownsSession) { this.#sessionLost(); return; }
      this.#autoplay?.stop();
      this.#state.setBusy(true);
      this.#showNotice('TUR SONUCUN KORUNUYOR', 'Sonuç kaydedildi ancak ödeme kaydı şu an güncellenemiyor. Aynı sonucu yeniden deneyeceğiz; ikinci kez bahis kesilmez.',
        'TEKRAR DENE', () => this.#settlePending(presentationFailed));
    }
  }

  #roundStartFailed() {
    if (!this.#ownsSession) { this.#sessionLost(); return; }
    this.#autoplay?.stop();
    if (this.#state.pendingRound) { this.#settlePending(true); return; }
    this.#showNotice('TUR BAŞLATILAMADI', 'Tur güvenle kaydedilemediği için bakiyenden bahis kesilmedi. Tarayıcı depolaması kullanılabilir olduğunda tekrar deneyebilirsin.',
      'TAMAM', () => this.#clearNotice());
  }

  get #ownsSession() { return !this.#destroyed && !!this.#guard?.owned; }
  get #blocked() { return !this.#ownsSession || !!this.#notice || !!this.#panels?.visible || !!document.hidden; }

  #updateActivity() {
    const paused = this.#blocked;
    if (paused) this.#app?.ticker.stop?.();
    else this.#app?.ticker.start?.();
    this.#audio?.setSuspended?.(paused);
    this.#syncHud();
    this.#accessibility?.update();
  }

  #sessionLost() {
    if (this.#destroyed || this.#lost) return;
    this.#lost = true;
    this.#autoplay?.stop();
    this.#panels?.close();
    this.#showNotice('OYUN OTURUMU DURAKLATILDI',
      'Oyun başka bir sekmede açık olabilir veya bu sekmenin oturumu sona ermiş olabilir. Diğer oyun sekmesini kapatıp sayfayı yenile. Kayıtlı turun kaldığı yerden devam eder.',
      'SAYFAYI YENİLE', () => window.location.reload());
  }

  #clearNotice() {
    this.#notice?.remove();
    this.#notice = null;
    this.#updateActivity();
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
    overlay.addEventListener('keydown', (event) => {
      event.stopPropagation();
      if (event.key === 'Tab') { event.preventDefault(); button.focus(); }
    });
    card.append(heading, detail, button);
    overlay.appendChild(card);
    this.#host.appendChild(overlay);
    this.#notice = overlay;
    this.#updateActivity();
    button.focus();
  }
}
