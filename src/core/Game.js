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

// Uygulamanın birleştirici sınıfı: parçaları kurar, birbirine bağlar.
// Kural içermez (game/), çizim detayı içermez (view/).
export class Game {
  #host;
  #state = new GameState();
  #rng = createRng();
  #player;
  #hud;
  #animator;
  #autoplay;
  #audio;

  constructor(host) {
    this.#host = host;
  }

  async start() {
    const app = new Application();
    await app.init({
      resizeTo: this.#host,
      background: COLORS.background,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
    });
    this.#host.appendChild(app.canvas);

    const animator = new Animator(app.ticker);
    const root = new ResponsiveRoot(app);
    const grid = root.add(new GridView(animator));
    const hud = root.add(new Hud(animator));
    app.stage.addChild(root);

    this.#audio = new AudioManager();
    this.#player = new RoundPlayer({ grid, hud, animator, audio: this.#audio });
    this.#hud = hud;
    this.#animator = animator;
    this.#hud.setAudioEnabled(this.#audio.enabled);
    this.#autoplay = new Autoplay({
      play: () => this.#playRound(false),
      canSpin: () => this.#state.canSpin,
      onChange: (value) => {
        this.#hud.setAutoplay(value);
        this.#syncHud();
      },
    });

    this.#bindInput();
    this.#state.on('change', () => this.#syncHud());
    this.#syncHud();
    root.resize();
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
      return this.#autoplay.running ? this.#autoplay.stop() : this.#autoplay.start();
    });
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        this.#spin();
      }
    });
  }

  #syncHud() {
    const s = this.#state;
    this.#hud.setBalance(s.balance);
    this.#hud.setBankrupt(s.isBankrupt);
    this.#hud.setBet(s.bet);
    this.#hud.setTurbo(s.turbo);
    this.#hud.setAudioEnabled(this.#audio?.enabled ?? true);
    this.#hud.setControls({
      canSpin: s.canSpin && !this.#autoplay?.active,
      canChangeBet: !s.busy && !this.#autoplay?.active,
      canBuyBonus: s.canBuyBonus && !this.#autoplay?.active,
      canAutoplay: s.canSpin && !this.#autoplay?.active,
      autoplayRunning: this.#autoplay?.running,
    });
    this.#animator.setTurbo(s.turbo);
  }

  async #spin() {
    const state = this.#state;
    this.#audio.unlock();
    if (!state.canSpin || this.#autoplay?.active) return;

    state.setBusy(true);
    await this.#playRound(false);
  }

  async #buyBonus() {
    const state = this.#state;
    this.#audio.unlock();
    if (!state.canBuyBonus || this.#autoplay?.active) return;

    state.setBusy(true);
    try {
      const cost = state.bet * RULES.buyCost;
      if (await this.#hud.confirmBonusPurchase(cost) && state.balance >= cost) {
        await this.#playRound(true);
      }
    } finally {
      if (state.busy) state.setBusy(false);
    }
  }

  async #playRound(buy) {
    const state = this.#state;
    state.debit(state.bet * (buy ? RULES.buyCost : 1));
    this.#hud.setWin(0);
    this.#hud.setMultiplier(0);
    try {
      const round = playRound(this.#rng, { record: true, buy });
      const payout = await this.#player.play(round, state.bet);
      state.credit(payout);
      return round;
    } finally {
      state.setBusy(false);
    }
  }
}
