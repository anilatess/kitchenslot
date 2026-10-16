import { RULES, SYM } from '../game/config.js';
import { TIMING } from '../core/constants.js';

// Motor sonucunu değiştirmeden kayıtlı dönüşleri sahnede sırayla sunar.
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

  /** Tamamlanmış dönüşler atlanabilir; onProgress yalnızca dönüş sınırında çağrılır. */
  async play(round, bet, { startSpin = 0, onProgress } = {}) {
    const start = Number.isInteger(startSpin) ? Math.max(0, Math.min(startSpin, round.spins.length)) : 0;
    const limit = round.total;
    this.#hud.beginRound?.();
    let roundWin = 0;
    let freeIndex = 0;
    let freeLeft = 0;
    let freeMult = 0;

    // Yenilemede sayaç ve tencereyi saklanan motor kaydından tekrar kur.
    for (const spin of round.spins.slice(0, start)) {
      roundWin = Math.min(limit, roundWin + spin.win);
      if (spin.mode !== 'free') continue;
      if (freeIndex === 0) freeLeft = RULES.freeSpins;
      freeIndex++;
      freeLeft--;
      freeMult = spin.freeMult;
      if (spin.scatters >= RULES.scatterTrigger) freeLeft += RULES.retriggerSpins;
    }
    if (start > 0) {
      if (this.#hud.setWin) this.#hud.setWin(roundWin * bet);
      else await this.#hud.countWinTo(roundWin * bet, 0);
      const previous = round.spins[start - 1];
      this.#hud.setSpinMode?.(previous.mode);
      this.#hud.setMultiplier(previous.mode === 'free' ? freeMult : previous.multSum);
      if (freeIndex > 0) this.#hud.setFreeSpins({ current: freeIndex, total: freeIndex + freeLeft });
      // Son dönüşün kaydı tamamlanmışsa açılış vitrini yerine gerçek sonuç görünür.
      if (start === round.spins.length && previous.finalGrid) await this.#grid.dropIn?.(previous.finalGrid);
    }

    for (let index = start; index < round.spins.length; index++) {
      const spin = round.spins[index];
      this.#hud.setSpinMode?.(spin.mode);
      if (spin.mode === 'free') {
        if (freeIndex === 0) {
          freeLeft = RULES.freeSpins;
          this.#audio?.play('freeSpin');
          this.#audio?.play('sizzle');
          if (this.#hud.showBonusIntro) await this.#hud.showBonusIntro({ spins: freeLeft, bet });
          else await this.#hud.showBanner(`${freeLeft} BEDAVA DÖNÜŞ`);
        }
        freeIndex++;
        freeLeft--;
        this.#hud.setFreeSpins({ current: freeIndex, total: freeIndex + freeLeft });
      }

      roundWin = await this.#playSpin(spin, bet, roundWin, limit);

      if (spin.mode === 'free') {
        freeMult = spin.freeMult;
        // Tavan turu bitirir; artık oynanmayacak dönüşler vaat edilmez.
        const hasNextSpin = index + 1 < round.spins.length;
        if (spin.scatters >= RULES.scatterTrigger && !(round.capped && !hasNextSpin)) {
          freeLeft += RULES.retriggerSpins;
          this.#audio?.play('freeSpin');
          if (this.#hud.showBonusRetrigger) {
            await this.#hud.showBonusRetrigger({ spins: RULES.retriggerSpins, remaining: freeLeft });
          } else await this.#hud.showBanner(`+${RULES.retriggerSpins} BEDAVA DÖNÜŞ`);
        }
        await this.#animator.wait(TIMING.spinGap);
      }
      await onProgress?.(index + 1);
    }

    // Ara sayaçlar da aynı resmi tavana bağlıdır; son değer asla geri saymaz.
    await this.#hud.countWinTo(limit * bet);
    this.#hud.setFreeSpins(null);
    this.#hud.finishRound?.();

    const tier = limit >= 50 ? 'super' : limit >= 25 ? 'mega' : limit >= 10 ? 'big' : null;
    if (tier || round.capped) {
      if (tier) this.#audio?.play(`${tier}Win`);
      if (this.#hud.showWinCelebration) {
        await this.#hud.showWinCelebration({ win: limit * bet, multiplier: limit, tier, capped: !!round.capped });
      } else {
        if (tier) await this.#hud.showBanner(`${tier.toUpperCase()} KAZANÇ!`);
        if (round.capped) await this.#hud.showBanner('MAKSİMUM KAZANÇ!');
      }
    }
    if (freeIndex > 0 && this.#hud.showBonusSummary) {
      this.#audio?.play('bonusEnd');
      await this.#hud.showBonusSummary({ win: limit * bet, multiplier: freeMult, spins: freeIndex, bet });
    }
    return limit * bet;
  }

  async #playSpin(spin, bet, winBefore, roundLimit) {
    this.#audio?.play('spin');
    this.#audio?.play('drop');
    await this.#grid.dropIn(spin.initialGrid);
    if (spin.scatters >= RULES.scatterTrigger) {
      this.#audio?.play('scatter');
      await this.#grid.pulseWhere((cell) => cell === SYM.SCT);
    }

    let multiplier = spin.mode === 'free' ? spin.freeMult - spin.multSum : 0;
    this.#hud.setMultiplier(multiplier);
    const collect = (value, origin) => {
      multiplier += value;
      this.#hud.setMultiplier(multiplier);
      this.#hud.flyMultiplier?.(value, origin);
      this.#audio?.play('multiplier');
      if (spin.mode === 'free') this.#audio?.play('sizzle');
    };

    let raw = 0;
    const spinTarget = Math.min(roundLimit, winBefore + spin.win);
    let shown = winBefore;
    for (const step of spin.steps) {
      if (step.removed.some((column) => column.some(Boolean))) this.#audio?.play('burst');
      const ways = (step.wins ?? []).reduce((sum, win) => sum + win.ways, 0);
      const stepAmount = Math.min(step.stepWin, Math.max(0, spinTarget - winBefore - raw));
      if (stepAmount > 0) this.#hud.showStepWin?.({ amount: stepAmount * bet, ways });
      this.#audio?.play('drop');
      await this.#grid.playStep(step, collect);
      raw += step.stepWin;
      const target = Math.max(shown, Math.min(spinTarget, winBefore + raw));
      await this.#hud.countWinTo(target * bet, TIMING.countUp * 0.6);
      shown = target;
    }
    await this.#grid.collectCells(spin.endCollected, collect);

    if (spinTarget > shown) {
      this.#audio?.play(spin.appliedMult > 1 ? 'multiplyWin' : 'tumbleWin');
      await this.#hud.countWinTo(spinTarget * bet);
    }
    await this.#animator.wait(TIMING.stepGap);
    return spinTarget;
  }
}
