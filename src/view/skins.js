import { Container, Graphics, Text } from 'pixi.js';
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

const TILE_STYLES = {
  low:     { fill: 0x25294f, edge: 0x4a5199 },
  high:    { fill: 0x3d2358, edge: 0x9a4fd0 },
  wild:    { fill: 0x15473f, edge: 0x2ee6a6 },
  scatter: { fill: 0x5a3a12, edge: COLORS.gold },
  mult:    { fill: 0x5a1a1a, edge: 0xff6a3d },
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

/** Hücre koduna göre merkezi (0,0) olan bir görsel üretir. */
export function createSymbolSkin(cell) {
  const style = TILE_STYLES[tierOf(cell)];
  const skin = new Container();

  const tile = new Graphics()
    .roundRect(-TILE_SIZE / 2, -TILE_SIZE / 2, TILE_SIZE, TILE_SIZE, 18)
    .fill({ color: style.fill })
    .stroke({ width: 3, color: style.edge });
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
    skin.addChild(emojiText(SYMBOL_VIEW[cell].emoji, 62));
  }
  return skin;
}
