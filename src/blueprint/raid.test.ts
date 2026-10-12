import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveBlueprint } from './geometry.ts';
import { authoredRaidPath, cheapestRaidPath, stepCost } from './raid.ts';
import type { Blueprint } from './types.ts';

function load(name: string) {
  const bp = JSON.parse(readFileSync(new URL(`../../docs/blueprint/examples/${name}.json`, import.meta.url), 'utf8')) as Blueprint;
  const { resolved, issues } = resolveBlueprint(bp);
  assert.deepEqual(issues.filter(i => i.level === 'error'), []);
  return { bp, resolved };
}

test('stepCost: stone wall, sheet metal door, twig', () => {
  const wall = stepCost('w', 'wall', 'stone', 'c4');
  assert.deepEqual(wall.breakdown, [{ explosive: 'c4', count: 2 }]);
  assert.equal(wall.sulfur, 4400);
  const door = stepCost('d', 'sheet-metal-door', undefined, 'optimal');
  assert.deepEqual(door.breakdown, [{ explosive: 'explosiveAmmo', count: 63 }]);
  assert.equal(door.sulfur, 1575);
  const twig = stepCost('t', 'wall', 'twig', 'rocket');
  assert.equal(twig.sulfur, 0);
  assert.equal(twig.free, false);
});

test('2x1 airlock: authored path = two doors; cheapest with C4 ties with a single stone wall', () => {
  const { bp, resolved } = load('starter-2x1');
  const authored = authoredRaidPath(resolved, bp.raidPath!, 'c4');
  assert.deepEqual(authored.ids, ['door_outer', 'door_inner']);
  assert.equal(authored.sulfur, 4400); // 2 × 1 C4

  const cheapest = cheapestRaidPath(resolved, 'f1', 'c4')!;
  assert.equal(cheapest.sulfur, 4400); // стена в ячейку шкафа: 2 C4 — столько же
  assert.equal(cheapest.cells.at(-1), 'f1');

  const optimal = cheapestRaidPath(resolved, 'f1', 'optimal')!;
  assert.deepEqual(optimal.ids, ['door_outer', 'door_inner']); // 2 × 1575 < 4400
  assert.equal(optimal.sulfur, 3150);
  assert.deepEqual(optimal.cells, ['f2', 'f1']);
});

test('2x2 with roof entry: sealed ground floor, cheapest is one stone wall; authored path is four doors', () => {
  const { bp, resolved } = load('house-2x2');
  const p = cheapestRaidPath(resolved, 'f1', 'optimal')!;
  assert.equal(p.steps.length, 1);
  assert.equal(p.steps[0].kind, 'wall');
  assert.equal(p.sulfur, 4400);
  const authored = authoredRaidPath(resolved, bp.raidPath!, 'optimal');
  assert.deepEqual(authored.ids, ['door_roof', 'door_jump', 'door_hall', 'door_tc']);
  assert.equal(authored.sulfur, 4 * 63 * 25);
});

test('sealed triangle: any wall, 2 C4', () => {
  const { resolved } = load('sealed-triangle-tc');
  const p = cheapestRaidPath(resolved, 'f1', 'c4')!;
  assert.equal(p.steps.length, 1);
  assert.equal(p.sulfur, 4400);
});

test('open doorway and low wall are free; window frame without insert is passable', () => {
  const bp: Blueprint = {
    formatVersion: '1.0', meta: { name: 'x' }, defaults: { grade: 'metal' },
    elements: [
      { id: 'f1', kind: 'square-foundation', root: true },
      { id: 'f2', kind: 'square-foundation', attach: { to: 'f1', socket: 'edge:0', selfSocket: 'edge:2' } },
      { id: 'w1', kind: 'wall', attach: { to: 'f1', socket: 'edge:1' } },
      { id: 'w2', kind: 'wall', attach: { to: 'f1', socket: 'edge:2' } },
      { id: 'w3', kind: 'wall', attach: { to: 'f1', socket: 'edge:3' } },
      { id: 'd', kind: 'doorway', attach: { to: 'f1', socket: 'edge:0' } },
      { id: 'lw', kind: 'low-wall', attach: { to: 'f2', socket: 'edge:0' } },
      { id: 'wf', kind: 'window-frame', attach: { to: 'f2', socket: 'edge:1' } },
      { id: 'w4', kind: 'wall', attach: { to: 'f2', socket: 'edge:3' } },
    ],
  };
  const { resolved } = resolveBlueprint(bp);
  const p = cheapestRaidPath(resolved, 'f1', 'c4')!;
  assert.equal(p.sulfur, 0);
  assert.deepEqual(p.ids, []);
  assert.deepEqual(p.cells, ['f2', 'f1']);
});

test('triangle with glass: cheapest optimal path breaks the glass (cheaper than a stone wall)', () => {
  const { resolved } = load('triangle-tc-window');
  const p = cheapestRaidPath(resolved, 'f1', 'optimal')!;
  assert.deepEqual(p.ids, ['glass']);
  assert.equal(p.sulfur, 140 * 25);
  assert.equal(cheapestRaidPath(resolved, 'f1', 'c4')!.sulfur, 4400);
});

test('unknown target cell returns null', () => {
  const { resolved } = load('house-2x2');
  assert.equal(cheapestRaidPath(resolved, 'nope', 'c4'), null);
});
