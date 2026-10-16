import { Assets, Container, Graphics, Sprite, Text } from 'pixi.js';
import { SYM, SYMBOL_VIEW } from '../game/config.js';
import { isMul, mulValue } from '../game/engine.js';
import { CELL, COLORS } from '../core/constants.js';

// ============================================================
//  SEMBOL GÖRSELLERİ - tek değişim noktası
//  Şimdilik emoji + çizilmiş karo. Sprite atlas'a geçerken
//  yalnızca createSymbolSkin() içini değiştirmek yeterli:
//  Sprite.from('domates.png') döndürün, gerisi aynı kalır.
// ============================================================

const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
const TILE_SIZE = CELL - 10;

const ATLAS_KEYS = {
  0: 'tomato', 1: 'garlic', 2: 'pepper', 3: 'carrot', 4: 'dumpling',
  5: 'sushi', 6: 'steak', 7: 'onion', 8: 'mushroom', 20: 'chef', 21: 'pot',
  multiplier: 'multiplier',
};
let atlasTextures = null;
let pngTextures = {};

const PNG_FILES = {
  tomato: 'tomato.png', garlic: 'garlic.png', pepper: 'pepper.png', carrot: 'carrot.png',
  dumpling: 'dumpling.png', sushi: 'sushi.png', steak: 'steak.png', onion: 'onion.png',
  mushroom: 'mushroom.png', chef: 'chef.png', pot: 'pot.png', multiplier: 'multiplier.png',
};

/** Bağımsız PNG'leri yükler; eksik bir sembol atlas/emoji yedeğine düşer. */
export async function loadSymbolImages(baseUrl) {
  const entries = Object.entries(PNG_FILES);
  const results = await Promise.allSettled(entries.map(([, file]) => Assets.load(baseUrl + file)));
  pngTextures = {};
  results.forEach((result, index) => {
    if (result.status === 'fulfilled' && result.value) pngTextures[entries[index][0]] = result.value;
  });
  return Object.keys(pngTextures).length;
}

function pngSkin(cell, texture) {
  const skin = new Container();
  const shadow = new Graphics().roundRect(-32, 37, 64, 9, 5).fill({ color: 0x100905, alpha: 0.12 })
    .roundRect(-24, 38, 48, 6, 3).fill({ color: 0x100905, alpha: 0.10 });
  const sprite = new Sprite(texture);
  sprite.anchor.set(0.5);
  sprite.width = CELL - 4;
  sprite.height = CELL - 4;
  sprite.y = -3;
  skin.addChild(shadow, sprite);

  if (isMul(cell)) {
    const label = new Text({ text: 'x' + mulValue(cell), style: {
      fontFamily: 'system-ui, sans-serif', fontSize: 35, fontWeight: '900',
      fill: 0xffe087, stroke: { color: 0x6b2008, width: 5 },
    } });
    label.anchor.set(0.5);
    label.y = 9;
    skin.addChild(label);
  } else if (cell === SYM.WLD || cell === SYM.SCT) {
    sprite.y = -8;
    const badge = new Graphics().roundRect(-34, 33, 68, 18, 8)
      .fill({ color: cell === SYM.WLD ? 0x224a30 : 0x603016, alpha: 0.96 })
      .stroke({ width: 1, color: COLORS.gold, alpha: 0.75 });
    const label = new Text({ text: cell === SYM.WLD ? 'WILD' : 'BONUS', style: {
      fontFamily: 'system-ui, sans-serif', fontSize: 12, fontWeight: '900', fill: COLORS.cream, letterSpacing: 1.5,
    } });
    label.anchor.set(0.5); label.y = 42;
    skin.addChild(badge, label);
  }
  return skin;
}

const TILE_STYLES = {
  low:     { fill: 0xf8e8bd, edge: 0xbd7542 },
  high:    { fill: 0xf1c66f, edge: 0xb6462e },
  wild:    { fill: 0x315b3a, edge: 0xa7d187 },
  scatter: { fill: 0x70351f, edge: COLORS.gold },
  mult:    { fill: 0x9f3928, edge: 0xf2b968 },
};

function tierOf(cell) {
  if (isMul(cell)) return 'mult';
  if (cell === SYM.WLD) return 'wild';
  if (cell === SYM.SCT) return 'scatter';
  return cell === SYM.DUM || cell === SYM.SUS || cell === SYM.STK ? 'high' : 'low';
}

function emojiText(char, size) {
  const text = new Text({ text: char, style: { fontFamily: EMOJI_FONT, fontSize: size } });
  text.anchor.set(0.5);
  return text;
}

/** Pixi spritesheet'ini yükler; dosya yoksa emoji yedeği kullanılır. */
export async function loadSymbolAtlas(url) {
  try {
    const atlas = await Assets.load(url);
    const textures = atlas?.textures ?? atlas;
    if (!textures || typeof textures !== 'object') throw new Error('Geçersiz sembol atlası');
    atlasTextures = textures;
    return true;
  } catch {
    atlasTextures = null;
    return false;
  }
}

function atlasTexture(cell) {
  const key = isMul(cell) ? ATLAS_KEYS.multiplier : ATLAS_KEYS[cell];
  return atlasTextures?.[key] ?? atlasTextures?.[`${key}.png`] ?? null;
}

function spriteFromAtlas(texture) {
  const sprite = new Sprite(texture);
  sprite.anchor.set(0.5);
  sprite.width = TILE_SIZE;
  sprite.height = TILE_SIZE;
  return sprite;
}

/** Hücre koduna göre merkezi (0,0) olan bir görsel üretir. */
export function createSymbolSkin(cell) {
  const key = isMul(cell) ? ATLAS_KEYS.multiplier : ATLAS_KEYS[cell];
  if (pngTextures[key]) return pngSkin(cell, pngTextures[key]);
  const texture = atlasTexture(cell);
  if (texture && !isMul(cell)) return spriteFromAtlas(texture);

  if (texture && isMul(cell)) {
    const skin = new Container();
    skin.addChild(spriteFromAtlas(texture));
    const label = new Text({
      text: `x${mulValue(cell)}`,
      style: { fontFamily: 'system-ui, sans-serif', fontSize: 30, fontWeight: '800', fill: COLORS.gold },
    });
    label.anchor.set(0.5);
    label.y = 24;
    skin.addChild(label);
    return skin;
  }

  const tier = tierOf(cell);
  const style = TILE_STYLES[tier];
  const skin = new Container();

  const tile = new Graphics()
    .roundRect(-TILE_SIZE / 2 + 2, -TILE_SIZE / 2 + 5, TILE_SIZE - 4, TILE_SIZE - 2, 19)
    .fill({ color: COLORS.wood, alpha: 0.28 })
    .roundRect(-TILE_SIZE / 2, -TILE_SIZE / 2, TILE_SIZE, TILE_SIZE, 18)
    .fill({ color: style.fill })
    .stroke({ width: 2, color: style.edge })
    .roundRect(-TILE_SIZE / 2 + 5, -TILE_SIZE / 2 + 5, TILE_SIZE - 10, TILE_SIZE - 10, 14)
    .stroke({ width: 1, color: 0xffffff, alpha: 0.4 })
    .circle(0, -4, 37).fill({ color: 0xffffff, alpha: tier === 'low' ? 0.2 : 0.07 })
    .roundRect(-TILE_SIZE / 2 + 8, -TILE_SIZE / 2 + 7, TILE_SIZE - 16, 15, 7)
    .fill({ color: 0xffffff, alpha: 0.13 });
  skin.addChild(tile);

  if (isMul(cell)) {
    const flame = emojiText(SYMBOL_VIEW.mul.emoji, 40);
    flame.y = -16;
    const label = new Text({
      text: `x${mulValue(cell)}`,
      style: { fontFamily: 'system-ui, sans-serif', fontSize: 30, fontWeight: '800', fill: COLORS.gold },
    });
    label.anchor.set(0.5);
    label.y = 26;
    skin.addChild(flame, label);
  } else {
    const emoji = emojiText(SYMBOL_VIEW[cell].emoji, tier === 'low' ? 64 : 67);
    if (tier === 'wild' || tier === 'scatter') {
      emoji.y = -10;
      const badge = new Text({ text: tier === 'wild' ? 'WILD' : 'BONUS',
        style: { fontFamily: 'system-ui, sans-serif', fontSize: 13, fontWeight: '900', fill: COLORS.cream, letterSpacing: 2 } });
      badge.anchor.set(0.5);
      badge.y = 34;
      skin.addChild(emoji, badge);
    } else skin.addChild(emoji);
  }
  return skin;
}
