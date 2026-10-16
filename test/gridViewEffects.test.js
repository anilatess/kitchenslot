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

  assert.deepEqual(collection, { value: 4, origin: { x: 360 + CELL / 2, y: 105 + CELL / 2 } });
});
