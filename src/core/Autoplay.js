export const AUTOPLAY_COUNTS = [10, 25, 50, 100];

/** Sırayla otomatik dönüş yapar ve bonus/büyük kazanç/bakiye koşullarında durur. */
export class Autoplay {
  #play;
  #canSpin;
  #onChange;
  #task = null;
  #running = false;
  #selectedIndex = 0;
  #remaining = 0;

  constructor({ play, canSpin, onChange = () => {} }) {
    this.#play = play;
    this.#canSpin = canSpin;
    this.#onChange = onChange;
  }

  get selected() { return AUTOPLAY_COUNTS[this.#selectedIndex]; }
  get remaining() { return this.#remaining; }
  get running() { return this.#running; }
  get active() { return this.#task !== null; }

  selectNext() {
    if (this.active) return;
    this.#selectedIndex = (this.#selectedIndex + 1) % AUTOPLAY_COUNTS.length;
    this.#notify();
  }

  start() {
    if (this.active || !this.#canSpin()) return this.#task ?? Promise.resolve();
    this.#remaining = this.selected;
    this.#running = true;
    this.#notify();
    this.#task = this.#run();
    return this.#task;
  }

  stop() {
    if (!this.#running) return;
    this.#running = false;
    this.#notify();
  }

  async #run() {
    try {
      while (this.#running && this.#remaining > 0) {
        if (!this.#canSpin()) break;
        const round = await this.#play();
        this.#remaining--;
        this.#notify();
        if (round.freeTriggered || round.total >= 50 || !this.#canSpin()) break;
      }
    } finally {
      this.#running = false;
      this.#task = null;
      this.#notify();
    }
  }

  #notify() {
    this.#onChange({ selected: this.selected, remaining: this.#remaining, running: this.#running });
  }
}
