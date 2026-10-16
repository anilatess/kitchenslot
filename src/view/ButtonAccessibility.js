/** Real DOM buttons provide keyboard and screen-reader access to canvas controls.
 * Coordinates come from Pixi's public bounds API; pointer input stays on the canvas.
 */
export class ButtonAccessibility {
  #stage;
  #canvas;
  #getRoot;
  #getScreenSize;
  #layer;
  #entries = new Map();
  #root;
  #focusByRoot = new Map();
  #active = new Set();
  #clearPointerFocus;
  #modalAvailable = false;

  constructor(stage, canvas, { getRoot = () => stage,
    getScreenSize = () => ({ width: canvas.clientWidth || canvas.width, height: canvas.clientHeight || canvas.height }) } = {}) {
    this.#stage = stage;
    this.#canvas = canvas;
    this.#getRoot = getRoot;
    this.#getScreenSize = getScreenSize;
    if (!globalThis.document?.createElement) return;
    this.#layer = document.createElement('div');
    this.#layer.setAttribute('role', 'group');
    this.#layer.setAttribute('aria-label', 'Oyun kontrolleri');
    Object.assign(this.#layer.style, { position: 'fixed', pointerEvents: 'none', zIndex: '2' });
    (canvas.parentNode ?? document.body).appendChild(this.#layer);
    this.#clearPointerFocus = () => {
      // A canvas click returns Space to the game's shortcut instead of a previously focused DOM control.
      for (const element of this.#entries.values()) if (element === document.activeElement) element.blur?.();
    };
    canvas.addEventListener?.('pointerdown', this.#clearPointerFocus);
    this.update();
  }

  update() {
    if (!this.#layer) return;
    const root = this.#getRoot();
    const previousRoot = this.#root;
    const changed = root !== this.#root;
    const initialized = this.#root !== undefined;
    if (changed && this.#root) {
      for (const [button, element] of this.#entries) {
        if (element === document.activeElement && this.#active.has(button)) this.#focusByRoot.set(this.#root, button);
      }
    }
    this.#root = root;
    this.#active = new Set(root && this.#isVisible(root) ? this.#collect(root) : []);
    const rect = this.#canvas.getBoundingClientRect();
    const size = this.#getScreenSize();
    Object.assign(this.#layer.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
    for (const button of this.#active) if (!this.#entries.has(button)) this.#create(button);
    for (const [button, element] of this.#entries) {
      if (button.destroyed) {
        element.remove();
        this.#entries.delete(button);
        continue;
      }
      const active = this.#active.has(button);
      element.hidden = !active;
      element.disabled = !active || !button.enabled;
      element.tabIndex = active && button.enabled ? 0 : -1;
      element.setAttribute('aria-label', button.accessibleLabel);
      element.title = button.accessibleLabel;
      if (button.selected == null) element.removeAttribute('aria-pressed');
      else element.setAttribute('aria-pressed', String(button.selected));
      if (!active) {
        button.setKeyboardFocused(false);
        continue;
      }
      const raw = button.getBounds();
      const bounds = raw.rectangle ?? raw;
      const sx = rect.width / size.width;
      const sy = rect.height / size.height;
      const coordinates = [bounds.x * sx, bounds.y * sy, bounds.width * sx, bounds.height * sy];
      if (!coordinates.every(Number.isFinite)) { element.hidden = true; element.tabIndex = -1; continue; }
      Object.assign(element.style, { left: `${coordinates[0]}px`, top: `${coordinates[1]}px`,
        width: `${Math.max(1, coordinates[2])}px`, height: `${Math.max(1, coordinates[3])}px` });
    }
    const enabled = [...this.#active].map((button) => this.#entries.get(button)).filter((element) => !element.disabled && !element.hidden);
    const modalAvailable = !!root?.accessibilityModal && enabled.length > 0;
    // Consecutive feature screens can reuse one modal while fading to zero alpha.
    // Hiding its DOM control drops browser focus even though the root identity stays the same.
    const modalReappeared = !changed && modalAvailable && !this.#modalAvailable && !enabled.includes(document.activeElement);
    this.#modalAvailable = modalAvailable;
    if (modalReappeared || (changed && initialized && root && (previousRoot || this.#focusByRoot.has(root) || root.accessibilityModal))) {
      const previous = this.#entries.get(this.#focusByRoot.get(root));
      const first = enabled[0];
      const focus = previous && !previous.disabled && !previous.hidden ? previous : first;
      focus?.focus({ preventScroll: true });
    }
  }

  destroy() {
    this.#canvas.removeEventListener?.('pointerdown', this.#clearPointerFocus);
    for (const button of this.#entries.keys()) if (!button.destroyed) button.setKeyboardFocused(false);
    this.#layer?.remove();
    this.#layer = null;
    this.#entries.clear();
    this.#active.clear();
    this.#focusByRoot.clear();
  }

  #collect(root) {
    const buttons = [];
    const visit = (node) => {
      if (node.visible === false || node.destroyed || node.alpha === 0) return;
      if (node.isAccessibleButton) buttons.push(node);
      else for (const child of node.children ?? []) visit(child);
    };
    visit(root);
    return buttons;
  }

  #isVisible(node) {
    for (let current = node; current; current = current.parent) {
      if (current.visible === false || current.destroyed || current.alpha === 0) return false;
      if (current === this.#stage) return true;
    }
    return false;
  }

  #create(button) {
    const element = document.createElement('button');
    element.type = 'button';
    Object.assign(element.style, { position: 'absolute', pointerEvents: 'none', padding: '0', margin: '0', border: '0',
      background: 'transparent', color: 'transparent', borderRadius: '12px', outline: 'none' });
    element.addEventListener('focus', () => {
      element.style.outline = '3px solid #f4d58b';
      element.style.outlineOffset = '3px';
      button.setKeyboardFocused(true);
    });
    element.addEventListener('blur', () => {
      element.style.outline = 'none';
      if (!button.destroyed) button.setKeyboardFocused(false);
    });
    element.addEventListener('keydown', (event) => {
      if (event.code === 'Space' || event.code === 'Enter' || event.key === ' ' || event.key === 'Enter') {
        event.stopPropagation();
        if (event.repeat) event.preventDefault();
      }
      if (event.key === 'Tab' && this.#root?.accessibilityModal) {
        const enabled = [...this.#active].map((item) => this.#entries.get(item)).filter((item) => !item.disabled && !item.hidden);
        const target = event.shiftKey && element === enabled[0] ? enabled.at(-1)
          : !event.shiftKey && element === enabled.at(-1) ? enabled[0] : null;
        if (target) { event.preventDefault(); target.focus({ preventScroll: true }); }
      }
    });
    element.addEventListener('keyup', (event) => {
      if (event.code === 'Space' || event.code === 'Enter' || event.key === ' ' || event.key === 'Enter') event.stopPropagation();
    });
    element.addEventListener('click', (event) => {
      event.stopPropagation();
      // The scope can change between frames (for example immediately after opening a modal).
      const root = this.#getRoot();
      if (root && this.#isVisible(root) && this.#collect(root).includes(button) && button.enabled) button.press();
    });
    this.#entries.set(button, element);
    this.#layer.appendChild(element);
  }
}
