import { RULES, SYM } from '../game/config.js';
import { TIMING } from '../core/constants.js';

// Motorun ürettiği turu (playRound çıktısı, record: true) sahnede sırayla oynatır.
// Oyun kuralı bilmez; sadece "hangi animasyon, hangi sırayla" sorusunu yanıtlar.
export class RoundPlayer {
  #grid;
  #hud;
  #animator;
  #audio;

  constructor({ grid, hud, animator, audio = null }) {
    this.#grid = grid;
    this.#hud = hud;
    this.#animator = animator;
    this.#audio = audio;
  }

  /** Turu oynatır ve oyuncuya ödenecek tutarı (para birimi) döndürür. */
  async play(round, bet) {
    let roundWin = 0;       // tur boyunca biriken kazanç (bahis katı)
    let freeIndex = 0;
    let freeLeft = 0;

    for (const spin of round.spins) {
      if (spin.mode === 'free') {
        if (freeIndex === 0) {
          freeLeft = RULES.freeSpins;
          this.#audio?.play('freeSpin');
          await this.#hud.showBanner(`${freeLeft} BEDAVA DÖNÜŞ`);
        }
        freeIndex++;
        freeLeft--;
        this.#hud.setFreeSpins({ current: freeIndex, total: freeIndex + freeLeft });
      }

      roundWin = await this.#playSpin(spin, bet, roundWin);

      if (spin.mode === 'free') {
        if (spin.scatters >= RULES.scatterTrigger) {
          freeLeft += RULES.retriggerSpins;
          this.#audio?.play('freeSpin');
          await this.#hud.showBanner(`+${RULES.retriggerSpins} BEDAVA DÖNÜŞ`);
        }
        await this.#animator.wait(TIMING.spinGap);
      }
    }

    // Motor kazancı tavanla sınırlamış olabilir: gösterilen son değer resmi toplamdır.
    if (round.total >= 50) {
      this.#audio?.play('superWin');
      await this.#hud.showBanner('SUPER KAZANÇ!');
    } else if (round.total >= 25) {
      this.#audio?.play('megaWin');
      await this.#hud.showBanner('MEGA KAZANÇ!');
    } else if (round.total >= 10) {
      this.#audio?.play('bigWin');
      await this.#hud.showBanner('BIG KAZANÇ!');
    }
    if (round.capped) await this.#hud.showBanner('MAKSİMUM KAZANÇ!');
    await this.#hud.countWinTo(round.total * bet);
    this.#hud.setFreeSpins(null);
    return round.total * bet;
  }

  async #playSpin(spin, bet, winBefore) {
    this.#audio?.play('spin');
    this.#audio?.play('drop');
    await this.#grid.dropIn(spin.initialGrid);
    if (spin.scatters >= RULES.scatterTrigger) {
      this.#audio?.play('scatter');
      await this.#grid.pulseWhere((cell) => cell === SYM.SCT);
    }

    // Bedava dönüşte çarpan birikimlidir: önceki dönüşlerden gelen değerle başla.
    let multiplier = spin.mode === 'free' ? spin.freeMult - spin.multSum : 0;
    this.#hud.setMultiplier(multiplier);
    const collect = (value, origin) => {
      multiplier += value;
      this.#hud.setMultiplier(multiplier);
      this.#hud.flyMultiplier?.(value, origin);
      this.#audio?.play('multiplier');
    };

    let raw = 0;
    for (const step of spin.steps) {
      if (step.removed.some((column) => column.some(Boolean))) this.#audio?.play('burst');
      this.#audio?.play('drop');
      await this.#grid.playStep(step, collect);
      raw += step.stepWin;
      await this.#hud.countWinTo((winBefore + raw) * bet, TIMING.countUp * 0.6);
    }
    await this.#grid.collectCells(spin.endCollected, collect);

    // Çarpan, zincirin toplam kazancına en sonda uygulanır.
    if (spin.raw > 0 && spin.appliedMult > 1) await this.#hud.countWinTo((winBefore + spin.win) * bet);
    await this.#animator.wait(TIMING.stepGap);
    return winBefore + spin.win;
  }
}
