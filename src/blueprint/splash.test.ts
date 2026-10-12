import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveBlueprint } from './geometry.ts';
import { EXPLOSIVES, falloff, planSplash, segmentBlocked, splashTargets, unitDamage, volleyAlternatives } from './splash.ts';
import { buildSpaceGraph, bestRaid, raidAlternatives, reachableSpaces } from './raid.ts';
import type { Blueprint } from './types.ts';

function load(name: string) {
  const bp = JSON.parse(readFileSync(new URL(`../../docs/blueprint/examples/${name}.json`, import.meta.url), 'utf8')) as Blueprint;
  return { bp, resolved: resolveBlueprint(bp).resolved };
}

test('falloff per explosive: full inside fullRadius, zero beyond maxRadius, linear between', () => {
  const r = EXPLOSIVES.rocket;
  assert.equal(falloff('rocket', 0), 1);
  assert.equal(falloff('rocket', r.fullRadius), 1);
  assert.equal(falloff('rocket', r.maxRadius), 0);
  assert.ok(Math.abs(falloff('rocket', (r.fullRadius + r.maxRadius) / 2) - 0.5) < 1e-9);
  assert.equal(falloff('c4', 2), 0);
});

test('unit counts reproduce the raid table: stone wall and sheet metal door', () => {
  const { resolved } = load('sealed-triangle-tc');
  const [w] = splashTargets(resolved, ['w1']);
  const need = (ex: keyof typeof EXPLOSIVES) => Math.ceil(w.hp / w.hit[ex] - 1e-9);
  assert.deepEqual([need('rocket'), need('c4'), need('explosiveAmmo'), need('satchel')], [4, 2, 185, 10]);
  const { resolved: r2 } = load('starter-2x1');
  const [door] = splashTargets(r2, ['door_outer']);
  const needD = (ex: keyof typeof EXPLOSIVES) => Math.ceil(door.hp / door.hit[ex] - 1e-9);
  assert.deepEqual([needD('rocket'), needD('c4'), needD('explosiveAmmo'), needD('satchel')], [2, 1, 63, 4]);
});

test('single stone wall, rockets only: 4 rockets; optimal mixes C4 and explosive ammo and is cheaper than 2 C4', () => {
  const { resolved } = load('sealed-triangle-tc');
  const rockets = planSplash(resolved, ['w1'], ['rocket']);
  assert.equal(rockets.units.rocket, 4);
  assert.equal(rockets.sulfur, 5600);
  const optimal = planSplash(resolved, ['w1'], ['rocket', 'c4', 'explosiveAmmo']);
  assert.ok(optimal.sulfur < 4400, `sulfur=${optimal.sulfur}`);
  assert.ok(optimal.damageTaken.w1 >= 500);
});

test('two adjacent stone walls sharing a corner: full damage to both, 4 rockets instead of 8', () => {
  const bp: Blueprint = {
    formatVersion: '1.0', meta: { name: 'x' }, defaults: { grade: 'stone' },
    elements: [
      { id: 'f1', kind: 'square-foundation', root: true },
      { id: 'a', kind: 'wall', attach: { to: 'f1', socket: 'edge:0' } },
      { id: 'b', kind: 'wall', attach: { to: 'f1', socket: 'edge:1' } },
    ],
  };
  const { resolved } = resolveBlueprint(bp);
  const plan = planSplash(resolved, ['a', 'b'], ['rocket']);
  assert.equal(plan.sulfurPerItem, 8 * 1400);
  assert.equal(plan.units.rocket, 4);
  assert.ok(plan.damageTaken.a >= 500 && plan.damageTaken.b >= 500);
});

test('airlock doors: a closed door blocks splash, so two doors cost 2 + 2 rockets', () => {
  const { resolved } = load('starter-2x1');
  const plan = planSplash(resolved, ['door_outer', 'door_inner'], ['rocket']);
  assert.equal(plan.units.rocket, 4);
});

test('segmentBlocked: wall plane and floor polygon, end of the segment is not blocked', () => {
  const wall = { id: 'w', kind: 'wall' as const, origin: [0, 0, 0] as [number, number, number], rotation: 0, height: 3 };
  assert.equal(segmentBlocked([-1, 1.5, 0], [1, 1.5, 0], wall), true);
  assert.equal(segmentBlocked([-1, 1.5, 0], [-1, 1.5, 5], wall), false);
  assert.equal(segmentBlocked([-1, 1.5, 2], [1, 1.5, 2], wall), false);
  assert.equal(segmentBlocked([-1, 4, 0], [1, 4, 0], wall), false);
  assert.equal(segmentBlocked([-1, 1.5, 0], [0, 1.5, 0], wall), false); // конец отрезка на стене
  const floor = { id: 'c', kind: 'cell' as const, origin: [0, 3, 0] as [number, number, number], rotation: 0,
    polygon: [[1.5, 1.5], [-1.5, 1.5], [-1.5, -1.5], [1.5, -1.5]] as [number, number][] };
  assert.equal(segmentBlocked([0, 4, 0], [0, 2, 0], floor), true);
  assert.equal(segmentBlocked([0, 4, 0], [5, 4, 0], floor), false);
  assert.equal(segmentBlocked([3, 4, 0], [3, 2, 0], floor), false);
});

test('roof corner volley: full damage to every adjoining roof block, 4 rockets open three ceilings', () => {
  const { resolved } = load('house-2x2');
  const g = buildSpaceGraph(resolved);
  const volleys = volleyAlternatives(resolved, g, reachableSpaces(g, new Set()), 'f1', ['rocket']);
  const corner = volleys.find(v => ['c1', 'c2', 'c3'].every(id => v.volley!.broken.includes(id)) && v.volley!.count === 4);
  assert.ok(corner, 'expected a 4-rocket corner volley breaking c1, c2 and c3');
  for (const v of volleys) {
    if (v.volley!.point[1] > 2.9) assert.ok(!v.volley!.broken.includes('door_tc') && !v.volley!.broken.includes('door_hall'), `roof volley broke ground doors: ${v.volley!.broken.join(',')}`);
  }
});

test('best raid for 2x2 (optimal): a corner volley opening every space, cheaper than a single wall by per-item cost', () => {
  const { resolved } = load('house-2x2');
  const allowed = ['rocket', 'c4', 'explosiveAmmo'] as const;
  const alts = raidAlternatives(resolved, 'f1', 'optimal', ids => planSplash(resolved, ids, [...allowed]),
    (g, i, t) => volleyAlternatives(resolved, g, i, t, [...allowed]));
  const best = bestRaid(alts)!;
  assert.ok(best.volley, 'expected a volley');
  assert.equal(best.opened, 5);
  assert.ok(best.sulfur <= 4400, `sulfur=${best.sulfur}`);
  assert.ok(alts.every(a => a.value >= 3));
});

test('unitDamage: explosive ammo reaches only touching blocks', () => {
  const { resolved } = load('sealed-triangle-tc');
  const [w] = splashTargets(resolved, ['w1']);
  assert.ok(unitDamage('explosiveAmmo', [w.center[0] + 0.05, w.center[1], w.center[2]], w) > 2);
  assert.equal(unitDamage('explosiveAmmo', [w.center[0] + 1, w.center[1], w.center[2]], w), 0);
});
