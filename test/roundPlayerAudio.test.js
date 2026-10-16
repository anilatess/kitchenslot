import test from 'node:test';
import assert from 'node:assert/strict';
import { RoundPlayer } from '../src/presenter/RoundPlayer.js';

function setup(round) {
  const sounds = [];
  const banners = [];
  const audio = { play: (name) => sounds.push(name) };
  const hud = {
    showBanner: async (message) => banners.push(message), setFreeSpins: () => {}, setMultiplier: () => {},
    countWinTo: async () => {},
  };
  const grid = {
    dropIn: async () => {}, pulseWhere: async () => {},
    playStep: async (_step, collect) => collect(3), collectCells: async (_cells, collect) => collect(2),
  };
  const animator = { wait: async () => {} };
  return { player: new RoundPlayer({ grid, hud, animator, audio }), sounds, banners, round };
}

test('tur akışı spin, düşüş, patlama, çarpan, scatter ve bonus seslerini çağırır', async () => {
  const { player, sounds, round } = setup({
    total: 10, capped: false,
    spins: [
      {
        mode: 'base', initialGrid: [], scatters: 3, freeMult: 0, multSum: 5,
        steps: [{ removed: [[true]], stepWin: 1 }], endCollected: [{ value: 2 }],
        raw: 1, appliedMult: 5, win: 5,
      },
      {
        mode: 'free', initialGrid: [], scatters: 3, freeMult: 0, multSum: 0,
        steps: [], endCollected: [], raw: 0, appliedMult: 1, win: 0,
      },
    ],
  });
  await player.play(round, 1);

  for (const sound of ['spin', 'drop', 'burst', 'multiplier', 'scatter', 'freeSpin', 'bigWin'])
    assert.ok(sounds.includes(sound), `${sound} sesi çağrılmalı`);
  assert.equal(sounds.filter((sound) => sound === 'freeSpin').length, 2, 'bedava dönüş ve tekrar tetikleme sesi');
});

test('bahisten küçük kazançta büyük kazanç kutlama sesi çalmaz', async () => {
  const { player, sounds, banners, round } = setup({ total: 0.5, capped: false, spins: [] });
  await player.play(round, 1);
  assert.equal(sounds.includes('bigWin'), false);
  assert.deepEqual(banners, []);
});

test('BIG, MEGA ve SUPER kutlamaları yalnızca kendi bahis eşiklerinde görünür', async (t) => {
  for (const [win, message, sound] of [
    [10, 'BIG KAZANÇ!', 'bigWin'],
    [25, 'MEGA KAZANÇ!', 'megaWin'],
    [50, 'SUPER KAZANÇ!', 'superWin'],
  ]) {
    await t.test(`${win}x`, async () => {
      const { player, sounds, banners, round } = setup({ total: win, capped: false, spins: [] });
      await player.play(round, 1);
      assert.deepEqual(banners, [message]);
      assert.deepEqual(sounds, [sound]);
    });
  }
});
