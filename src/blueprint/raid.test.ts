import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveBlueprint } from './geometry.ts';
import { buildSpaceGraph, cheapestRaidPath, cheapestRaidPaths, reachableSpaces, spacesValue, stepCost } from './raid.ts';
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

test('2x1 airlock: cheapest with C4 ties between a wall, the ceiling and the two doors; optimal goes through the doors', () => {
  const { resolved } = load('starter-2x1');
  const cheapest = cheapestRaidPath(resolved, 'f1', 'c4')!;
  assert.equal(cheapest.sulfur, 4400);
  assert.equal(cheapest.cells.at(-1), 'f1');

  const optimal = cheapestRaidPath(resolved, 'f1', 'optimal')!;
  assert.deepEqual(optimal.ids, ['door_outer', 'door_inner']);
  assert.equal(optimal.sulfur, 3150);
  assert.deepEqual(optimal.cells, ['f2', 'f1']);

  // среди нескольких путей есть заход через потолок c1
  const paths = cheapestRaidPaths(resolved, 'f1', 'optimal', 6);
  assert.ok(paths.some(p => p.ids.length === 1 && p.ids[0] === 'c1' && p.cells.includes('c1')));
});

test('2x2 with roof entry: space graph has a virtual room over the jump-up cell reached through the roof door', () => {
  const { resolved } = load('house-2x2');
  const g = buildSpaceGraph(resolved);
  assert.ok(g.nodes.has('^f4'));
  const paths = cheapestRaidPaths(resolved, 'f1', 'optimal', 8);
  const viaRoof = paths.find(p => p.cells.includes('^f4'));
  assert.ok(viaRoof, 'path through the vestibule expected');
  assert.ok(viaRoof!.ids.includes('door_roof'));
  const cheapest = cheapestRaidPath(resolved, 'f1', 'optimal')!;
  assert.equal(cheapest.sulfur, 4400); // стена или потолок в ячейку шкафа
  assert.equal(cheapest.steps.length, 1);
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
  assert.equal(p.cells.at(-1), 'f1'); // без потолка ячейка открыта сверху — заход бесплатный
  // c потолком над обеими ячейками путь идёт через низкую стену и открытый проём
  const roofed: Blueprint = { ...bp, elements: [...bp.elements,
    { id: 'c1', kind: 'square-floor', attach: { to: 'w1', socket: 'top', selfSocket: 'edge:1' } },
    { id: 'c2', kind: 'square-floor', attach: { to: 'c1', socket: 'edge:0', selfSocket: 'edge:2' } },
  ] };
  const q = cheapestRaidPath(resolveBlueprint(roofed).resolved, 'f1', 'c4')!;
  assert.equal(q.sulfur, 0);
  assert.deepEqual(q.cells, ['f2', 'f1']);
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

test('opened spaces: doors open the airlock and the TC room, a wall opens only the TC room', () => {
  const { resolved } = load('starter-2x1');
  const g = buildSpaceGraph(resolved);
  const initially = reachableSpaces(g, new Set());
  assert.ok(initially.has('c1') && initially.has('c2')); // крыша доступна
  assert.ok(!initially.has('f1') && !initially.has('f2'));
  const opened = (ids: string[]) => [...reachableSpaces(g, new Set(ids))].filter(id => !initially.has(id)).sort();
  assert.deepEqual(opened(['door_outer', 'door_inner']), ['f1', 'f2']);
  assert.deepEqual(opened(['w1']), ['f1']);
  assert.equal(spacesValue(g, opened(['door_outer', 'door_inner']), resolved), 3.5); // шкаф 3 + аирлок 0.5
});

test('opened spaces: 2x2 roof door + inner wall opens the vestibule, the jump-up cell and the TC room', () => {
  const { resolved } = load('house-2x2');
  const g = buildSpaceGraph(resolved);
  const initially = reachableSpaces(g, new Set());
  const opened = [...reachableSpaces(g, new Set(['door_roof', 'w3']))].filter(id => !initially.has(id)).sort();
  assert.deepEqual(opened, ['^f4', 'f1', 'f4']);
  assert.equal(spacesValue(g, opened, resolved), 3.5); // шкаф 3, комната без пола 0.25, запрыг 0.25
});

test('roof bunker: the roof seals the vestibule from above and its low edge seals the TC cell edge', () => {
  const { resolved } = load('roof-bunker');
  const g = buildSpaceGraph(resolved);
  const edges = g.adj.get('f2')!;
  const up = edges.find(e => e.mid[1] > 1)!;
  assert.equal(up.blocker.element?.id, 'rb');
  const toTc = edges.find(e => e.to === 'f1')!;
  assert.equal(toTc.blocker.element?.id, 'rb');
  assert.deepEqual([...reachableSpaces(g, new Set())].sort(), ['c1']);
  assert.deepEqual([...reachableSpaces(g, new Set(['d1']))].sort(), ['c1', 'f2']);
  assert.deepEqual([...reachableSpaces(g, new Set(['rb']))].sort(), ['c1', 'f1', 'f2']);
  // крыша — ступень пути как стена своего материала
  const path = cheapestRaidPath(resolved, 'f1', 'c4')!;
  assert.equal(path.sulfur, 4400);
});
