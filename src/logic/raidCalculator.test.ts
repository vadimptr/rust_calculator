import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateRaidCost } from './raidCalculator.ts';
import type { RaidMethod, RaidRow } from '../types/index.ts';

function row(rows: RaidRow[], method: RaidMethod): RaidRow {
  const r = rows.find((x) => x.method === method);
  assert.ok(r, `row "${method}" not found`);
  return r;
}

test('1 stone wall: satchel / c4 / optimal counts and resources', () => {
  const rows = calculateRaidCost([{ tier: 'stone', quantity: 1 }]);

  const satchel = row(rows, 'satchel');
  assert.equal(satchel.breakdown[0].count, 10);
  assert.equal(satchel.resources.sulfur, 4800); // 10 * 480
  assert.equal(satchel.resources.charcoal, 7200); // 10 * 720
  assert.equal(satchel.resources.metalFragments, 800); // 10 * 80
  assert.equal(satchel.resources.cloth, 100); // 10 * 10
  assert.equal(satchel.resources.rope, 10); // 10 * 1

  const c4 = row(rows, 'c4');
  assert.equal(c4.breakdown[0].count, 2);
  assert.equal(c4.resources.sulfur, 4400); // 2 * 2200
  assert.equal(c4.resources.techTrash, 4); // 2 * 2

  const optimal = row(rows, 'optimal');
  assert.deepEqual(optimal.breakdown, [{ explosive: 'c4', count: 2 }]);
  assert.equal(optimal.resources.sulfur, 4400);
});

test('8 stone walls: counts and sulfur scale x8', () => {
  const rows = calculateRaidCost([{ tier: 'stone', quantity: 8 }]);

  assert.equal(row(rows, 'satchel').breakdown[0].count, 80); // 10 * 8
  assert.equal(row(rows, 'satchel').resources.sulfur, 38400); // 80 * 480

  const c4 = row(rows, 'c4');
  assert.equal(c4.breakdown[0].count, 16); // 2 * 8
  assert.equal(c4.resources.sulfur, 35200); // 16 * 2200

  assert.deepEqual(row(rows, 'optimal').breakdown, [{ explosive: 'c4', count: 16 }]);
});

test('1 sheet metal wall: uses metal tier rule', () => {
  const rows = calculateRaidCost([{ tier: 'metal', quantity: 1 }]);

  assert.equal(row(rows, 'satchel').breakdown[0].count, 23);
  assert.equal(row(rows, 'satchel').resources.sulfur, 11040); // 23 * 480

  const c4 = row(rows, 'c4');
  assert.equal(c4.breakdown[0].count, 4);
  assert.equal(c4.resources.sulfur, 8800); // 4 * 2200

  assert.deepEqual(row(rows, 'optimal').breakdown, [{ explosive: 'c4', count: 4 }]);
});

test('mixed tiers: quantities aggregate across tiers', () => {
  const rows = calculateRaidCost([
    { tier: 'stone', quantity: 1 },
    { tier: 'metal', quantity: 1 },
  ]);

  // satchel: stone 10 + metal 23 = 33
  assert.equal(row(rows, 'satchel').breakdown[0].count, 33);
  assert.equal(row(rows, 'satchel').resources.sulfur, 15840); // 33 * 480

  // c4: stone 2 + metal 4 = 6
  assert.equal(row(rows, 'c4').breakdown[0].count, 6);

  // optimal: both tiers optimize to c4 -> c4 2 + c4 4 = 6
  assert.deepEqual(row(rows, 'optimal').breakdown, [{ explosive: 'c4', count: 6 }]);
});

test('optimal route: wood tier optimizes to explosive ammo', () => {
  const rows = calculateRaidCost([{ tier: 'wood', quantity: 1 }]);

  const optimal = row(rows, 'optimal');
  assert.deepEqual(optimal.breakdown, [{ explosive: 'explosiveAmmo', count: 49 }]);
  assert.equal(optimal.resources.sulfur, 1225); // 49 * 25
  assert.equal(optimal.resources.charcoal, 1470); // 49 * 30
  assert.equal(optimal.resources.metalFragments, 490); // 49 * 10

  // optimal должен отличаться от чистого c4 (1 c4 на wall у wood)
  const c4 = row(rows, 'c4');
  assert.equal(c4.breakdown[0].count, 1);
  assert.notEqual(optimal.resources.sulfur, c4.resources.sulfur);
});

test('empty selection returns no rows', () => {
  assert.deepEqual(calculateRaidCost([]), []);
  assert.deepEqual(calculateRaidCost([{ tier: 'stone', quantity: 0 }]), []);
});
