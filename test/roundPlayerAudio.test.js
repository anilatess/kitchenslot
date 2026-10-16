import test from 'node:test';
import assert from 'node:assert/strict';
import { RoundPlayer } from '../src/presenter/RoundPlayer.js';

function setup(round) {
  const sounds = [];
  const audio = { play: (name) => sounds.push(name) };
  const hud = {
    showBanner: async () => {}, setFreeSpins: () => {}, setMultiplier: () => {},
    countWinTo: async () => {},
  };
  const grid = {
    dropIn: async () => {}, pulseWhere: async () => {},
    playStep: async (_step, collect) => collect(3), collectCells: async (_cells, collect) => collect(2),
  };
  const animator = { wait: async () => {} };
  return { player: new RoundPlayer({ grid, hud, animator, audio }), sounds, round };
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
  const { player, sounds, round } = setup({ total: 0.5, capped: false, spins: [] });
  await player.play(round, 1);
  assert.equal(sounds.includes('bigWin'), false);
});
