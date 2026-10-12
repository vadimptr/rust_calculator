import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveBlueprint } from './geometry.ts';
import { ROCKET, falloff, planRocketSplash, segmentBlocked, splashTargets } from './splash.ts';
import type { Blueprint } from './types.ts';

function load(name: string) {
  const bp = JSON.parse(readFileSync(new URL(`../../docs/blueprint/examples/${name}.json`, import.meta.url), 'utf8')) as Blueprint;
  return { bp, resolved: resolveBlueprint(bp).resolved };
}

test('falloff: full inside fullRadius, zero beyond maxRadius, linear between', () => {
  assert.equal(falloff(0), 1);
  assert.equal(falloff(ROCKET.fullRadius), 1);
  assert.equal(falloff(ROCKET.maxRadius), 0);
  const mid = (ROCKET.fullRadius + ROCKET.maxRadius) / 2;
  assert.ok(Math.abs(falloff(mid) - 0.5) < 1e-9);
});

test('single stone wall: 4 rockets, same as per-item', () => {
  const { resolved } = load('sealed-triangle-tc');
  const plan = planRocketSplash(resolved, ['w1']);
  assert.equal(plan.rockets, 4);
  assert.equal(plan.rocketsPerItem, 4);
  assert.equal(plan.sulfur, 4 * 1400);
  assert.ok(plan.damageTaken.w1 >= 500);
});

test('two adjacent stone walls sharing a corner: splash needs fewer rockets than 8', () => {
  const bp: Blueprint = {
    formatVersion: '1.0', meta: { name: 'x' }, defaults: { grade: 'stone' },
    elements: [
      { id: 'f1', kind: 'square-foundation', root: true },
      { id: 'a', kind: 'wall', attach: { to: 'f1', socket: 'edge:0' } },
      { id: 'b', kind: 'wall', attach: { to: 'f1', socket: 'edge:1' } },
    ],
  };
  const { resolved } = resolveBlueprint(bp);
  const plan = planRocketSplash(resolved, ['a', 'b']);
  assert.equal(plan.rocketsPerItem, 8);
  assert.ok(plan.rockets < 8, `rockets=${plan.rockets}`);
  assert.ok(plan.damageTaken.a >= 500 && plan.damageTaken.b >= 500);
  assert.ok(plan.shots.some(s => s.count > 1));
});

test('door targets use door damage: sheet metal door dies in 2 rockets', () => {
  const { bp, resolved } = load('starter-2x1');
  const [outer] = splashTargets(resolved, ['door_outer']);
  assert.equal(outer.hp, 250);
  assert.equal(outer.hitDamage, ROCKET.doorDamage);
  const plan = planRocketSplash(resolved, bp.raidPath!);
  assert.ok(plan.rockets <= plan.rocketsPerItem);
  assert.equal(plan.rocketsPerItem, 4);
});

test('targets ignore unknown ids and tool cupboard', () => {
  const { resolved } = load('house-2x2');
  assert.equal(splashTargets(resolved, ['nope', 'tc1']).length, 0);
});

test('segmentBlocked: wall plane and floor polygon', () => {
  const wall = { id: 'w', kind: 'wall' as const, origin: [0, 0, 0] as [number, number, number], rotation: 0, height: 3 };
  assert.equal(segmentBlocked([-1, 1.5, 0], [1, 1.5, 0], wall), true);
  assert.equal(segmentBlocked([-1, 1.5, 0], [-1, 1.5, 5], wall), false);
  assert.equal(segmentBlocked([-1, 1.5, 2], [1, 1.5, 2], wall), false); // мимо края
  assert.equal(segmentBlocked([-1, 4, 0], [1, 4, 0], wall), false);     // выше стены
  const floor = { id: 'c', kind: 'cell' as const, origin: [0, 3, 0] as [number, number, number], rotation: 0,
    polygon: [[1.5, 1.5], [-1.5, 1.5], [-1.5, -1.5], [1.5, -1.5]] as [number, number][] };
  assert.equal(segmentBlocked([0, 4, 0], [0, 2, 0], floor), true);
  assert.equal(segmentBlocked([0, 3, 0], [0, 1, 0], floor), true);      // взрыв на поверхности пола
  assert.equal(segmentBlocked([0, 4, 0], [5, 4, 0], floor), false);
  assert.equal(segmentBlocked([3, 4, 0], [3, 2, 0], floor), false);     // мимо плиты
});

test('2x2 roof entry: floors block splash to the ground-floor doors', () => {
  const { bp, resolved } = load('house-2x2');
  const plan = planRocketSplash(resolved, bp.raidPath!);
  // 4 металлические двойные двери по 2 ракеты: сплеш с крыши вниз не проходит через пол
  assert.ok(plan.rockets >= 6, `rockets=${plan.rockets}`);
  assert.equal(plan.rocketsPerItem, 8);
});
