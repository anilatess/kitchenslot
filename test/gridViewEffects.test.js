import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import * as fake from './helpers/fakePixi.js';

mock.module('pixi.js', { namedExports: {
  Assets: fake.Assets, Container: fake.Container, Graphics: fake.Graphics,
  Sprite: fake.Sprite, Text: fake.Text,
} });

const { GridView } = await import('../src/view/GridView.js');
const { SYM, COLS, ROWS } = await import('../src/game/config.js');
const { CELL } = await import('../src/core/constants.js');

function immediateAnimator() {
  return {
    wait: async () => {},
    tween: async (target, to) => {
      for (const [key, value] of Object.entries(to)) {
        if (key === 'scale') target.scale.set(value);
        else target[key] = value;
      }
    },
  };
}

test('çarpan toplama callbacki HUD uçuşu için hücrenin tasarım koordinatını taşır', async () => {
  const grid = new GridView(immediateAnimator());
  grid.layout('landscape');
  const initial = Array.from({ length: COLS }, () => Array(ROWS).fill(SYM.TOM));
  initial[1][0] = SYM.WLD;
  initial[2][0] = SYM.SCT;
  await grid.dropIn(initial);

  const removed = Array.from({ length: COLS }, () => Array(ROWS).fill(false));
  removed[0][0] = true;
  const nextGrid = initial.map((column) => column.slice());
  nextGrid[0] = [SYM.GAR, ...initial[0].slice(1)];
  let collection;
  await grid.playStep({
    removed,
    collected: [{ col: 0, row: 0, value: 4 }],
    nextGrid,
  }, (value, origin) => { collection = { value, origin }; });

  assert.deepEqual(collection, { value: 4, origin: { x: grid.x + CELL / 2, y: grid.y + CELL / 2 } });
});

test('açılış vitrini tek kez dolar ve ilk turda gerçek ızgarayla değiştirilir', async () => {
  const grid = new GridView(immediateAnimator());
  grid.showPreview();
  grid.showPreview();
  const layer = grid.children[1];
  assert.equal(layer.children.length, COLS * ROWS);
  assert.ok(layer.children.every((view) => Number.isInteger(view.cell) && view.cell >= 0 && view.cell <= 8));
  const initial = Array.from({ length: COLS }, () => Array(ROWS).fill(SYM.GAR));
  await grid.dropIn(initial);
  assert.equal(layer.children.length, COLS * ROWS);
  assert.ok(layer.children.every((view) => view.cell === SYM.GAR && view.scale.x === 1 && view.scale.y === 1));
});

test('kazanç vurgusunda diğer hücreler kısılır; vurgu bitince tümü geri gelir', async () => {
  let hold = false;
  let release;
  const animator = immediateAnimator();
  const tween = animator.tween;
  animator.tween = async (target, to) => {
    await tween(target, to);
    if (hold && to.scale > 1) await new Promise(resolve => { release = resolve; });
  };
  const grid = new GridView(animator);
  const initial = Array.from({ length: COLS }, () => Array(ROWS).fill(SYM.TOM));
  initial[2][1] = SYM.SCT;
  await grid.dropIn(initial);
  hold = true;
  const playing = grid.pulseWhere(cell => cell === SYM.SCT);
  await Promise.resolve();
  const layer = grid.children[1];
  const selected = layer.children.find(view => view.cell === SYM.SCT);
  assert.equal(selected.alpha, 1);
  assert.ok(layer.children.filter(view => view !== selected).every(view => view.alpha === 0.48));
  assert.equal(grid.children[2].children.length, 1, 'kazanan hücre etrafında tek çerçeve');
  release();
  await playing;
  assert.ok(layer.children.every(view => view.alpha === 1 && view.scale.x === 1));
  assert.equal(grid.children[2].children.length, 0, 'geçici çerçeve temizlenir');
});

test('hareket azaltma tercihi düşme ve esneme yerine sabit hücreler kullanır', async () => {
  const previous = globalThis.matchMedia;
  globalThis.matchMedia = () => ({ matches: true });
  try {
    const operations = [];
    const animator = immediateAnimator();
    const tween = animator.tween;
    animator.tween = async (target, to, duration) => {
      operations.push({ to, duration });
      await tween(target, to);
    };
    const grid = new GridView(animator);
    const initial = Array.from({ length: COLS }, () => Array(ROWS).fill(SYM.TOM));
    await grid.dropIn(initial);
    await grid.pulseWhere(() => true);
    await grid.dropIn(initial);
    assert.ok(!operations.some(({ to }) => 'y' in to || 'scale' in to));
    assert.ok(grid.children[1].children.every(view => view.alpha === 1 && view.scale.x === 1));
  } finally {
    if (previous === undefined) delete globalThis.matchMedia;
    else globalThis.matchMedia = previous;
  }
});
