import { Assets, Container, Graphics, Sprite, Text } from 'pixi.js';
import { BonusPotState } from './BonusPotState.js';

let animationFrames = [];
let flameTexture = null;

export async function loadChefScene(baseUrl) {
  const [sheet, flame] = await Promise.allSettled([
    Assets.load(baseUrl + 'chef/chef-stirring.json'),
    Assets.load(baseUrl + 'symbols/multiplier.png'),
  ]);
  const textures = sheet.status === 'fulfilled' ? sheet.value?.textures : null;
  animationFrames = Array.from({ length: 8 }, (_, i) => textures?.['stir-' + i]).filter(Boolean);
  flameTexture = flame.status === 'fulfilled' ? flame.value : null;
  return animationFrames.length === 8;
}

function label(value, size, fill) {
  const item = new Text({ text: value, style: {
    fontFamily: 'system-ui, sans-serif', fontSize: size, fontWeight: '700', fill,
    stroke: { color: 0x101b17, width: size > 30 ? 4 : 2 },
  } });
  item.anchor.set(0.5);
  return item;
}

/** Reads the official bonus total. Decoration never calculates an award. */
export class ChefBonusView extends Container {
  #state = new BonusPotState();
  #shadow = new Graphics();
  #glow = new Graphics();
  #fire = new Container();
  #flames = [];
  #art = new Container();
  #poses = [];
  #fallback = null;
  #steam = [];
  #embers = [];
  #ripples = [];
  #caption = label('BONUS ÇARPANI', 12, 0xdfc58a);
  #number = label('x0', 44, 0xf4f0e5);
  #status = label('BONUS BEKLENİYOR', 11, 0xc4c9bc);
  #time = 0;
  #frame = 0;
  #heat = 0;
  #impact = 0;
  #reactionAge = 10;
  #celebration = 0;
  #portrait = false;
  #pose = null;
  #reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;

  constructor() {
    super();
    this.eventMode = 'none';
    this.#art.label = 'chef-art';
    this.#fire.label = 'chef-fire';
    this.#shadow.roundRect(-85, -3, 170, 12, 6).fill({ color: 0x100f0b, alpha: 0.3 });
    for (let i = 5; i >= 1; i--) this.#glow.circle(0, 0, i * 17)
      .fill({ color: i > 2 ? 0xf56d16 : 0xffbe35, alpha: 0.035 });
    for (let i = 0; i < 7; i++) {
      const flame = flameTexture ? new Sprite(flameTexture)
        : new Graphics().circle(0, -15, 11).fill({ color: 0xffaa39 });
      if (flame.anchor) flame.anchor.set(0.5, 1);
      this.#flames.push(flame);
      this.#fire.addChild(flame);
    }
    if (animationFrames.length === 8) {
      // The second atlas row sits eight source pixels higher. Registration keeps
      // the pot planted while the hand circles. Show one crisp pose at a time.
      for (let i = 0; i < 2; i++) {
        const pose = new Sprite(animationFrames[0]);
        pose.anchor.set(0.5);
        if (i === 1) { pose.alpha = 0; pose.visible = false; }
        this.#poses.push(pose);
        this.#art.addChild(pose);
      }
    } else {
      this.#fallback = new Container();
      const chef = label('👨‍🍳', 155, 0xffffff);
      const pot = label('🍲', 130, 0xffffff);
      chef.y = -60; pot.y = 80;
      this.#fallback.addChild(chef, pot);
      this.#art.addChild(this.#fallback);
    }
    this.addChild(this.#shadow, this.#glow, this.#fire, this.#art);
    for (let i = 0; i < 2; i++) {
      const ripple = new Graphics().circle(0, 0, 28).stroke({ color: 0xffe5a7, width: 1.6 });
      ripple.label = 'soup-ripple';
      this.#ripples.push(ripple); this.addChild(ripple);
    }
    for (let i = 0; i < 8; i++) {
      const steam = new Graphics().circle(0, 0, 5 + i % 3)
        .circle(-3, -3, 4).circle(3, -6, 3).fill({ color: 0xf4f0e5 });
      this.#steam.push(steam); this.addChild(steam);
    }
    for (let i = 0; i < 10; i++) {
      const ember = new Graphics().circle(0, 0, i % 2 ? 1.4 : 1).fill({ color: 0xffce75 });
      this.#embers.push(ember); this.addChild(ember);
    }
    this.addChild(this.#caption, this.#number, this.#status);
    this.layout('landscape');
  }

  get total() { return this.#state.total; }
  get heat() { return this.#state.heat; }
  get active() { return this.#state.active; }
  get collectionTarget() { return { x: this.#pose.x, y: this.#pose.soup }; }

  layout(orientation) {
    this.#portrait = orientation === 'portrait';
    this.#pose = this.#portrait
      ? { x: 190, y: 1084, w: 240, h: 320, floor: 1260, soup: 1146, size: 0.89 }
      : { x: 160, y: 330, w: 270, h: 360, floor: 529, soup: 400, size: 1 };
    const p = this.#pose;
    this.#art.position.set(p.x, p.y);
    for (const pose of this.#poses) { pose.width = p.w; pose.height = p.h; }
    if (this.#fallback) this.#fallback.scale.set(p.size);
    this.#shadow.position.set(p.x, p.floor + 2); this.#shadow.scale.set(p.size);
    this.#glow.position.set(p.x, p.floor - 10);
    this.#caption.position.set(this.#portrait ? 530 : 160, this.#portrait ? 1204 : 552);
    this.#number.position.set(this.#portrait ? 530 : 160, this.#portrait ? 1240 : 584);
    this.#status.position.set(160, 619);
    this.#status.visible = !this.#portrait;
    this.#caption.style ??= {}; this.#number.style ??= {};
    this.#caption.style.fontSize = this.#portrait ? 20 : 12;
    this.#number.style.fontSize = this.#portrait ? 48 : 44;
    this.#status.style ??= {};
    this.#status.style.fontSize = 11;
    this.update(0);
  }

  resetRound() {
    this.#state.resetRound(); this.#heat = 0; this.#impact = 0;
    this.#reactionAge = 10; this.#celebration = 0; this.#syncText();
    this.layout(this.#portrait ? 'portrait' : 'landscape');
  }
  startBonus() {
    this.#state.startBonus(); this.celebrate('bonus'); this.#syncText();
    this.layout(this.#portrait ? 'portrait' : 'landscape');
  }
  setTotal(value) {
    if (this.#state.setTotal(value)) this.#impact = Math.max(this.#impact, 0.45);
    this.#syncText();
  }
  finishBonus() {
    this.#state.finishBonus(); this.#syncText();
    this.layout(this.#portrait ? 'portrait' : 'landscape');
  }
  collectPulse() {
    if (this.#state.phase === 'idle') return;
    this.#impact = 1;
    this.#reactionAge = 0;
  }
  celebrate(tier = 'big') {
    this.#celebration = tier === 'super' || tier === 'mega' ? 2.1 : 1.4;
    this.#impact = 1;
    this.#reactionAge = 0;
  }

  #syncText() {
    this.#number.text = 'x' + this.#state.total.toLocaleString('tr-TR');
    this.#number.alpha = this.#state.phase === 'idle' ? 0.55 : 1;
    this.#status.text = this.#state.phase === 'idle' ? 'BONUS BEKLENİYOR'
      : this.#state.phase === 'complete' ? 'BONUS TAMAMLANDI'
      : this.#state.total >= 50 ? 'HARLI ATEŞ'
      : this.#state.total >= 10 ? 'ATEŞ YÜKSELİYOR' : 'KISIK ATEŞ';
  }

  update(deltaMS) {
    const dt = Math.min(50, Math.max(0, deltaMS)) / 1000;
    this.#time += dt;
    this.#reactionAge += dt;
    this.#celebration = Math.max(0, this.#celebration - dt);
    const targetHeat = this.#state.heat * (this.#state.active ? 1 : this.#state.phase === 'complete' ? 0.55 : 0);
    this.#heat += (targetHeat - this.#heat) * (1 - Math.exp(-4 * dt));
    this.#impact *= Math.exp(-4 * dt);
    const p = this.#pose;
    const active = this.#state.phase !== 'idle';
    const heat = this.#heat;
    const motion = this.#reducedMotion ? 0 : 1;
    this.#frame += dt * (this.#state.active ? 5 + heat * 3 : 3.4) * motion;
    if (this.#poses.length) {
      const frame = Math.floor(this.#frame) % 8;
      this.#poses[0].texture = animationFrames[frame];
      this.#poses[0].y = frame >= 4 ? 8 * p.h / 512 : 0;
    }
    const recoil = Math.sin(this.#reactionAge * 14) * Math.exp(-this.#reactionAge * 4) * motion;
    const cheer = this.#celebration > 0 ? Math.sin(this.#time * 8) * 0.6 * motion : 0;
    this.#art.y = p.y + (Math.sin(this.#time * 1.7) * 0.7 * motion - recoil * 3 - Math.abs(cheer)) * p.size;
    this.#art.rotation = (-recoil * 0.013 + cheer * 0.006) * motion;
    this.#art.scale.set(1 + recoil * 0.006 * motion);
    this.#glow.scale.set(p.size * (0.6 + heat * 0.55 + this.#impact * 0.12), p.size * 0.38);
    this.#glow.alpha = active ? 0.25 + heat * 0.75 : 0;
    this.#number.scale.set(1 + this.#impact * 0.07 * motion);
    this.#flames.forEach((flame, i) => {
      const centre = 1 - Math.abs(i - 3) / 4;
      const flicker = (Math.sin(this.#time * (7 + i * 0.8) + i * 1.7) * 0.08
        + Math.sin(this.#time * 13 + i * 3.4) * 0.025) * motion;
      // A compact bed underneath the pot; the art occludes the flame tips.
      flame.position.set(p.x + (i - 3) * (13 + heat * 3) * p.size, p.floor - Math.abs(i - 3) * 0.8 * p.size);
      if (flame.anchor) {
        flame.width = (22 + heat * 13) * p.size * (1 + flicker);
        flame.height = (24 + heat * 37 * centre + this.#impact * 9) * p.size * (1 + flicker);
      } else flame.scale.set(p.size * (0.65 + heat * 0.7), p.size * (0.8 + heat * centre));
      flame.rotation = Math.sin(this.#time * 3 + i * 2) * 0.035 * motion;
      flame.alpha = active ? 0.65 + heat * 0.35 : 0;
    });
    this.#ripples.forEach((ripple, i) => {
      const age = this.#reactionAge - i * 0.13;
      const progress = Math.max(0, Math.min(1, age / 0.7));
      ripple.position.set(p.x, p.soup + 2 * p.size);
      ripple.scale.set((0.25 + progress * 1.3) * p.size, (0.06 + progress * 0.3) * p.size);
      ripple.alpha = active && motion && age > 0 ? (1 - progress) * 0.7 : 0;
    });
    this.#steam.forEach((steam, i) => {
      const t = (this.#time * (0.19 + heat * 0.14) * motion + i / 8) % 1;
      steam.position.set(p.x + (Math.sin(i * 2.4 + t * 3) * (12 + t * 12)) * p.size,
        p.soup - (8 + t * 80) * p.size);
      steam.scale.set((0.35 + t * 1.1) * p.size);
      steam.alpha = active && motion ? Math.sin(t * Math.PI) * (0.07 + heat * 0.11 + this.#impact * 0.08) : 0;
    });
    this.#embers.forEach((ember, i) => {
      const t = (this.#time * (0.3 + heat * 0.35) * motion + i / 10) % 1;
      ember.position.set(p.x + Math.sin(i * 5 + t * 2) * (30 + heat * 16) * p.size,
        p.floor - t * (25 + heat * 42) * p.size);
      ember.alpha = active && motion ? Math.sin(t * Math.PI) * heat * 0.7 : 0;
      ember.scale.set(p.size);
    });
  }
}
