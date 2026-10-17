import test from 'node:test';
import assert from 'node:assert/strict';
import { blockCost, costOf, upkeepRate } from './cost.ts';
import { resolveBlueprint } from './geometry.ts';
import { addElement, newBlueprint } from './editor.ts';

test('block cost = grade base cost × form multiplier (game data)', () => {
  assert.deepEqual(blockCost('wall', 'stone'), { wood: 0, stone: 300, metal: 0, hqm: 0 });
  assert.equal(blockCost('doorway', 'stone').stone, 210);
  assert.equal(blockCost('triangle-floor', 'metal').metal, 50);
  assert.equal(blockCost('low-wall', 'armored').hqm, 13);
  assert.equal(blockCost('square-foundation', 'twig').wood, 50);
});

test('upkeep brackets: 10 % up to 15 blocks, then 15 %, 20 %, 33.3 %', () => {
  assert.equal(upkeepRate(10), 0.1);
  assert.ok(Math.abs(upkeepRate(65) - (15 * 0.1 + 50 * 0.15) / 65) < 1e-12);
  assert.ok(Math.abs(upkeepRate(200) - (15 * 0.1 + 50 * 0.15 + 125 * 0.2 + 10 * 0.333) / 200) < 1e-12);
});

test('cost summary of a small stone base: build and per-day upkeep', () => {
  let bp = newBlueprint();
  bp.defaults = { grade: 'stone' };
  bp.elements[0].grade = 'stone';
  for (const k of [0, 1, 2, 3]) bp = addElement(bp, 'wall', { to: 'f1', socket: `edge:${k}` as 'edge:0' }, 'stone');
  const s = costOf(resolveBlueprint(bp).resolved);
  assert.equal(s.build.stone, 1500);
  assert.equal(s.count, 5);
  assert.equal(s.upkeep.stone, 150);
});
