const money = (value) => Number(value || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const number = (value) => Number(value || 0).toLocaleString('tr-TR', { maximumFractionDigits: 2 });
let panelId = 0;

const STYLES = `
.kitchen-player-panels{position:fixed;inset:0;z-index:40;display:grid;place-items:center;padding:20px;box-sizing:border-box;background:rgba(4,10,7,.78);backdrop-filter:blur(8px);color:#eeeadd;font:14px/1.5 system-ui,sans-serif;touch-action:auto}
.kitchen-player-panels[hidden]{display:none}
.kitchen-player-panels *{box-sizing:border-box}
.kitchen-player-panels .kp-panel{width:min(620px,100%);max-height:calc(100dvh - 40px);display:flex;flex-direction:column;overflow:hidden;background:linear-gradient(145deg,#202e27,#121e18);border:1px solid #a68e5866;border-radius:22px;box-shadow:0 24px 90px #0009;outline:none}
.kitchen-player-panels .kp-header{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:22px 24px 16px;border-bottom:1px solid #a68e582b}
.kitchen-player-panels .kp-eyebrow{margin:0 0 3px;color:#b7a477;font-size:10px;font-weight:750;letter-spacing:2px}
.kitchen-player-panels h2{margin:0;font-size:24px;line-height:1.2;font-weight:650;letter-spacing:-.4px}
.kitchen-player-panels .kp-close{min-height:44px;min-width:44px;padding:0 12px;color:#e5d4aa;background:#ffffff09;border:1px solid #b9a16d55;border-radius:12px;font:22px system-ui,sans-serif;cursor:pointer}
.kitchen-player-panels .kp-scroll{min-height:0;padding:22px 24px;overflow:auto;overscroll-behavior:contain;scrollbar-color:#89764a #17231c}
.kitchen-player-panels button:focus-visible,.kitchen-player-panels summary:focus-visible,.kitchen-player-panels input:focus-visible{outline:3px solid #f4d58b;outline-offset:3px}
.kitchen-player-panels .kp-audio-row{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-bottom:24px}
.kitchen-player-panels h3{margin:0 0 5px;font-size:16px;font-weight:650}
.kitchen-player-panels p{margin:0;color:#aebaae}
.kitchen-player-panels .kp-toggle{flex-shrink:0;min-height:44px;min-width:116px;border:1px solid #b69e6555;border-radius:11px;background:#354137;color:#e5d4aa;padding:10px 15px;font:700 12px system-ui,sans-serif;cursor:pointer}
.kitchen-player-panels .kp-toggle[aria-pressed=true]{background:#d9c08a;color:#17231c}
.kitchen-player-panels .kp-volume-label{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;font-weight:650}
.kitchen-player-panels output{font-size:22px;color:#e5d4aa;font-variant-numeric:tabular-nums}
.kitchen-player-panels input[type=range]{display:block;width:100%;height:44px;margin:0;accent-color:#dfc58a;cursor:pointer}
.kitchen-player-panels .kp-note{font-size:12px;margin-top:8px}
.kitchen-player-panels .kp-shortcuts{margin-top:28px;padding-top:22px;border-top:1px solid #a68e582b}
.kitchen-player-panels .kp-shortcut{display:flex;justify-content:space-between;gap:20px;margin:12px 0;color:#cbd4ca}
.kitchen-player-panels kbd{flex-shrink:0;min-width:74px;text-align:center;padding:3px 8px;border:1px solid #b9a16d44;border-bottom-width:2px;border-radius:6px;color:#ebd6a6;font:600 12px system-ui,sans-serif;background:#ffffff06}
.kitchen-player-panels .kp-intro{margin-bottom:18px;font-size:13px}
.kitchen-player-panels .kp-empty{padding:32px 10px;text-align:center}
.kitchen-player-panels .kp-empty h3{color:#e5d4aa;margin-bottom:10px}
.kitchen-player-panels .kp-entry{margin-bottom:12px;border:1px solid #b9a16d33;border-radius:13px;background:#0b15122e;overflow:hidden}
.kitchen-player-panels .kp-entry summary{list-style:none;cursor:pointer;padding:16px;position:relative}
.kitchen-player-panels .kp-entry summary::-webkit-details-marker{display:none}
.kitchen-player-panels .kp-entry-head{display:flex;align-items:center;justify-content:space-between;gap:12px}
.kitchen-player-panels .kp-entry-kind{display:flex;align-items:center;gap:8px;font-size:11px;font-weight:750;letter-spacing:.6px;color:#d5bd85}
.kitchen-player-panels time{display:block;margin-top:3px;color:#9eafa2;font-size:11px}
.kitchen-player-panels .kp-payout{text-align:right;color:#e9dfc8;font-size:24px;font-weight:650;line-height:1.1;font-variant-numeric:tabular-nums}
.kitchen-player-panels .kp-payout small{display:block;font-size:10px;font-weight:600;color:#9eafa2;letter-spacing:1px;margin-top:5px}
.kitchen-player-panels .kp-metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:17px;padding-top:12px;border-top:1px solid #b9a16d22;font-size:13px}
.kitchen-player-panels .kp-metric span{display:block;color:#9eafa2;font-size:10px;letter-spacing:.5px;margin-bottom:2px}
.kitchen-player-panels .kp-net-positive{color:#bbd5a2}
.kitchen-player-panels .kp-net-negative{color:#dcaa91}
.kitchen-player-panels .kp-expand{display:flex;align-items:center;justify-content:space-between;margin-top:13px;font-size:10px;letter-spacing:.8px;color:#b9aa84}
.kitchen-player-panels .kp-chevron{font-size:15px;line-height:1;transition:transform .15s}
.kitchen-player-panels .kp-entry[open] .kp-chevron{transform:rotate(180deg)}
.kitchen-player-panels .kp-breakdown{border-top:1px solid #b9a16d33;padding:14px 16px 16px}
.kitchen-player-panels .kp-bonus-meta{margin-bottom:12px;color:#d5bd85;font-size:12px}
.kitchen-player-panels .kp-table{width:100%;border-collapse:collapse;font-size:11px;font-variant-numeric:tabular-nums}
.kitchen-player-panels .kp-table th{font-size:10px;color:#9eafa2;font-weight:600;letter-spacing:.2px;padding:0 0 10px;text-align:right}
.kitchen-player-panels .kp-table td{padding:8px 0;text-align:right;border-top:1px solid #a68e5818}
.kitchen-player-panels .kp-table th:first-child,.kitchen-player-panels .kp-table td:first-child{text-align:left}
.kitchen-player-panels .kp-cap{margin-top:12px;color:#d7bd82;font-size:11px}
@media(max-width:520px){.kitchen-player-panels{padding:12px}.kitchen-player-panels .kp-panel{max-height:calc(100dvh - 24px);border-radius:18px}.kitchen-player-panels .kp-header{padding:18px 18px 14px}.kitchen-player-panels .kp-scroll{padding:18px}.kitchen-player-panels h2{font-size:22px}.kitchen-player-panels .kp-shortcut{gap:12px;font-size:12px}.kitchen-player-panels .kp-entry summary{padding:14px}.kitchen-player-panels .kp-breakdown{padding:14px}.kitchen-player-panels .kp-payout{font-size:22px}.kitchen-player-panels .kp-table{font-size:10px}}
@media(prefers-reduced-motion:reduce){.kitchen-player-panels .kp-chevron{transition:none}}
`;

/** Settings and locally saved round history, displayed above the canvas. */
export class PlayerPanels {
  #root;
  #dialog;
  #title;
  #body;
  #close;
  #previousFocus = null;
  #onVolume;
  #onAudioToggle;
  #onOpen;
  #onClose;
  #visible = false;
  #uid = `kitchen-player-${++panelId}`;

  constructor(host, { onVolume = () => {}, onAudioToggle = () => {}, onOpen = () => {}, onClose = () => {} } = {}) {
    this.#onVolume = onVolume;
    this.#onAudioToggle = onAudioToggle;
    this.#onOpen = onOpen;
    this.#onClose = onClose;
    this.#root = this.#element('div', 'kitchen-player-panels');
    this.#root.hidden = true;
    const style = this.#element('style');
    style.textContent = STYLES;
    this.#dialog = this.#element('section', 'kp-panel');
    this.#dialog.tabIndex = -1;
    this.#dialog.setAttribute('role', 'dialog');
    this.#dialog.setAttribute('aria-modal', 'true');
    this.#dialog.setAttribute('aria-labelledby', `${this.#uid}-title`);
    const header = this.#element('header', 'kp-header');
    const heading = this.#element('div');
    heading.appendChild(this.#element('p', 'kp-eyebrow', 'MUTFAK SLOT'));
    this.#title = this.#element('h2');
    this.#title.id = `${this.#uid}-title`;
    heading.appendChild(this.#title);
    this.#close = this.#element('button', 'kp-close', '×');
    this.#close.type = 'button';
    this.#close.setAttribute('aria-label', 'Pencereyi kapat');
    this.#close.addEventListener('click', () => this.close());
    header.append(heading, this.#close);
    this.#body = this.#element('div', 'kp-scroll');
    this.#dialog.append(header, this.#body);
    this.#root.append(style, this.#dialog);
    host.appendChild(this.#root);
    this.#root.addEventListener('click', (event) => { if (event.target === this.#root) this.close(); });
    this.#root.addEventListener('keydown', (event) => this.#keyDown(event));
    this.#root.addEventListener('keyup', (event) => event.stopPropagation());
  }

  get visible() { return this.#visible; }

  openSettings({ enabled = true, volume = 1 } = {}) {
    if (!this.#root) return;
    this.#body.replaceChildren();
    let audioEnabled = !!enabled;
    let audioVolume = Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 1;
    const row = this.#element('div', 'kp-audio-row');
    const description = this.#element('div');
    description.appendChild(this.#element('h3', '', 'Oyun sesleri'));
    const status = this.#element('p');
    description.appendChild(status);
    const toggle = this.#element('button', 'kp-toggle');
    toggle.type = 'button';
    toggle.setAttribute('aria-label', 'Oyun seslerini aç veya kapat');
    const update = () => {
      toggle.textContent = audioEnabled ? 'SES AÇIK' : 'SES KAPALI';
      toggle.setAttribute('aria-pressed', String(audioEnabled));
      status.textContent = !audioEnabled ? 'Ses kapalı. Düzeyin korunuyor.' : audioVolume === 0 ? 'Ses düzeyi sıfır.' : 'Mutfaktaki her anı duy.';
    };
    toggle.addEventListener('click', () => { audioEnabled = !audioEnabled; update(); this.#onAudioToggle(audioEnabled); });
    row.append(description, toggle);
    const label = this.#element('label', 'kp-volume-label');
    label.htmlFor = `${this.#uid}-volume`;
    label.appendChild(this.#element('span', '', 'Ses düzeyi'));
    const output = this.#element('output', '', `%${Math.round(audioVolume * 100)}`);
    label.appendChild(output);
    const range = this.#element('input');
    Object.assign(range, { type: 'range', id: `${this.#uid}-volume`, min: '0', max: '100', step: '1', value: String(Math.round(audioVolume * 100)) });
    range.setAttribute('aria-label', 'Ses düzeyi');
    range.setAttribute('aria-valuetext', `%${Math.round(audioVolume * 100)}`);
    range.addEventListener('input', () => {
      const value = Number(range.value);
      if (!Number.isFinite(value)) return;
      audioVolume = Math.min(1, Math.max(0, value / 100));
      output.textContent = `%${Math.round(audioVolume * 100)}`;
      range.setAttribute('aria-valuetext', output.textContent);
      update();
      this.#onVolume(audioVolume);
    });
    const shortcuts = this.#element('div', 'kp-shortcuts');
    shortcuts.appendChild(this.#element('h3', '', 'Klavye ile oyna'));
    for (const [key, meaning] of [['Boşluk', 'Döndür / animasyonları tamamla'], ['Tab', 'Sonraki düğmeye geç'], ['Enter', 'Odaktaki düğmeyi kullan'], ['Esc', 'Açık pencereyi kapat']]) {
      const item = this.#element('div', 'kp-shortcut');
      item.append(this.#element('kbd', '', key), this.#element('span', '', meaning));
      shortcuts.appendChild(item);
    }
    this.#body.append(row, label, range, this.#element('p', 'kp-note', 'Ses tercihin bu tarayıcıda hatırlanır.'), shortcuts);
    update();
    this.#show('Ayarlar');
  }

  openHistory(history = []) {
    if (!this.#root) return;
    this.#body.replaceChildren();
    const entries = Array.isArray(history) ? [...history].filter((entry) => entry && typeof entry === 'object').sort((a, b) => b.time - a.time).slice(0, 20) : [];
    if (!entries.length) {
      const empty = this.#element('div', 'kp-empty');
      empty.append(this.#element('h3', '', 'İlk servis seni bekliyor'), this.#element('p', '', 'Tamamladığın turların bahis ve kazançları burada görünecek.'));
      this.#body.appendChild(empty);
    } else {
      this.#body.appendChild(this.#element('p', 'kp-intro', 'Bu tarayıcıdaki son 20 tamamlanan tur. Kazancın nasıl oluştuğunu görmek için bir turu aç.'));
      for (const entry of entries) this.#body.appendChild(this.#historyCard(entry));
    }
    this.#show('Tur geçmişi');
  }

  close() {
    if (!this.#visible) return;
    this.#visible = false;
    this.#root.hidden = true;
    this.#onClose();
    if (this.#previousFocus?.isConnected && !this.#previousFocus.disabled) this.#previousFocus.focus({ preventScroll: true });
    this.#previousFocus = null;
  }

  destroy() {
    this.close();
    this.#root?.remove();
    this.#root = null;
  }

  #show(title) {
    const opening = !this.#visible;
    if (opening) this.#previousFocus = document.activeElement;
    this.#title.textContent = title;
    this.#root.hidden = false;
    this.#visible = true;
    if (opening) this.#onOpen();
    this.#body.scrollTop = 0;
    this.#close.focus({ preventScroll: true });
  }

  #historyCard(entry) {
    const card = this.#element('details', 'kp-entry');
    const summary = this.#element('summary');
    const head = this.#element('div', 'kp-entry-head');
    const info = this.#element('div');
    info.appendChild(this.#element('div', 'kp-entry-kind', entry.buy ? 'BONUS SATIN ALIMI' : entry.freeCount ? 'BONUSLU TUR' : 'ANA OYUN'));
    const date = new Date(entry.time);
    const time = this.#element('time', '', Number.isNaN(date.getTime()) ? '' : date.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }));
    if (!Number.isNaN(date.getTime())) time.dateTime = date.toISOString();
    info.appendChild(time);
    const payout = this.#element('div', 'kp-payout', money(entry.payout));
    payout.appendChild(this.#element('small', '', 'KAZANÇ'));
    head.append(info, payout);
    const metrics = this.#element('div', 'kp-metrics');
    for (const [label, value, className] of [
      ['BAHİS', money(entry.bet), ''], ['KATILIM', money(entry.cost), ''],
      ['NET', `${entry.net > 0 ? '+' : ''}${money(entry.net)}`, entry.net > 0 ? 'kp-net-positive' : entry.net < 0 ? 'kp-net-negative' : ''],
    ]) {
      const item = this.#element('div', `kp-metric ${className}`);
      item.append(this.#element('span', '', label), this.#element('strong', '', value));
      metrics.appendChild(item);
    }
    const expand = this.#element('div', 'kp-expand');
    expand.append(this.#element('span', '', 'KAZANÇ HESABI'), this.#element('span', 'kp-chevron', '⌄'));
    summary.append(head, metrics, expand);
    const detail = this.#element('div', 'kp-breakdown');
    if (entry.freeCount) detail.appendChild(this.#element('p', 'kp-bonus-meta', `${entry.freeCount} bedava dönüş · Son bonus çarpanı x${number(entry.freeMult)}`));
    const table = this.#element('table', 'kp-table');
    table.setAttribute('aria-label', 'Turun ödeme hesabı');
    const tableHead = this.#element('thead');
    const headings = this.#element('tr');
    for (const title of ['Dönüş', 'Eşleşme', 'Çarpan', 'Ödeme']) {
      const th = this.#element('th', '', title);
      th.scope = 'col';
      headings.appendChild(th);
    }
    tableHead.appendChild(headings);
    const tbody = this.#element('tbody');
    let freeIndex = 0;
    for (const spin of entry.breakdown ?? []) {
      const tr = this.#element('tr');
      for (const text of [spin.mode === 'free' ? `Bedava ${++freeIndex}` : 'Ana oyun', money(spin.raw), `×${number(spin.multiplier)}`, money(spin.payout)]) tr.appendChild(this.#element('td', '', text));
      tbody.appendChild(tr);
    }
    table.append(tableHead, tbody);
    detail.appendChild(table);
    if (entry.capped) detail.appendChild(this.#element('p', 'kp-cap', 'Kazanç tavanına ulaşıldı. Ödeme satırları tavana göre sınırlandı.'));
    card.append(summary, detail);
    return card;
  }

  #keyDown(event) {
    event.stopPropagation();
    if (event.key === 'Escape') { event.preventDefault(); this.close(); return; }
    if (event.key !== 'Tab') return;
    const items = [...this.#dialog.querySelectorAll('button, input, summary, [tabindex]')].filter((item) => !item.disabled && item.tabIndex >= 0);
    const first = items[0], last = items.at(-1);
    if (!items.length) { event.preventDefault(); this.#dialog.focus({ preventScroll: true }); }
    else if (event.shiftKey && (document.activeElement === first || document.activeElement === this.#dialog)) {
      event.preventDefault(); last.focus({ preventScroll: true });
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first.focus({ preventScroll: true });
    }
  }

  #element(tag, className = '', text = null) {
    const item = document.createElement(tag);
    if (className) item.className = className;
    if (text !== null) item.textContent = text;
    return item;
  }
}
