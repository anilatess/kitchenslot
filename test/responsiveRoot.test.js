import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import * as fake from './helpers/fakePixi.js';

mock.module('pixi.js', { namedExports: { Container: fake.Container, Graphics: fake.Graphics } });

const { ResponsiveRoot } = await import('../src/core/ResponsiveRoot.js');

test('arka plan yatay/dikey boyuta göre yenilenir ve yavaşça hareket eder', () => {
  let tick;
  const app = {
    screen: { width: 1280, height: 720 },
    renderer: { on: () => {} },
    ticker: { add: (fn) => { tick = fn; } },
  };
  const root = new ResponsiveRoot(app);
  root.resize();
  assert.equal(root.orientation, 'landscape');
  const ambient = root.children[1];
  const before = { x: ambient.x, y: ambient.y };
  tick({ deltaMS: 16 });
  assert.notDeepEqual({ x: ambient.x, y: ambient.y }, before);

  app.screen.width = 390;
  app.screen.height = 844;
  root.resize();
  assert.equal(root.orientation, 'portrait');
});
