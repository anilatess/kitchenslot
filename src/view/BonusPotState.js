/** Presentation state only. Payouts and multiplier arithmetic stay in the engine. */
export class BonusPotState {
  phase = 'idle';
  total = 0;

  resetRound() { this.phase = 'idle'; this.total = 0; }
  startBonus() { this.phase = 'free'; this.total = 0; }
  setTotal(value) {
    if (this.phase !== 'free' || !Number.isFinite(value) || value < 0) return false;
    const increased = value > this.total;
    this.total = value;
    return increased;
  }
  finishBonus() { if (this.phase === 'free') this.phase = 'complete'; }
  get active() { return this.phase === 'free'; }
  get heat() { return Math.min(1, Math.log1p(this.total) / Math.log1p(250)); }
}
