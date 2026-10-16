import { Container } from 'pixi.js';
import { createSymbolSkin } from './skins.js';

// Izgaradaki tek bir sembol. Merkezi (0,0) olduğu için ölçek animasyonları
// karenin ortasından yapılır. `cell` motorun hücre koduyla aynıdır.
export class SymbolView extends Container {
  constructor(cell) {
    super();
    this.cell = cell;
    this.addChild(createSymbolSkin(cell));
  }
}
