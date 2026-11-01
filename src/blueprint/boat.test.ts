import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveBlueprint } from './geometry.ts';
import { addDeployable, addElement, candidatePlacements, deployPlacement, newBlueprint, placementsNear } from './editor.ts';
import { blockCost, boatStats, coveredHullSides, dragFor, frontalWidth, terminalSpeed } from './boat.ts';
import { loadBlueprint } from './validate.ts';
import { emptyScheme } from './schemesApi.ts';
import type { Blueprint, DeployableKind, ElementKind } from './types.ts';

const res = (bp: Blueprint) => resolveBlueprint(bp).resolved;

function attach(bp: Blueprint, kind: ElementKind, host: string, near: [number, number, number]): Blueprint {
  const p = placementsNear(bp, res(bp), kind, host, near)[0];
  assert.ok(p, `${kind} на ${host}`);
  return addElement(bp, kind, p.attach, 'wood');
}

function deploy(bp: Blueprint, kind: DeployableKind, host: string, local: [number, number, number], turn = 0): Blueprint {
  const p = deployPlacement(bp, res(bp), kind, host, local, turn);
  assert.ok(p, `${kind} на ${host}`);
  return addDeployable(bp, p.deployable);
}

function hullLine(): Blueprint {
  let bp = { ...newBlueprint('Лодка', 'boat-hull'), meta: { name: 'Лодка', tags: ['boat'] }, defaults: { grade: 'wood' as const } };
  bp = attach(bp, 'boat-hull', 'f1', [-3, 0, 0]);
  bp = attach(bp, 'boat-hull-triangle', 'f1', [1.6, 0, 0]);
  return bp;
}

test('hulls join only hulls at water level; house blocks do not attach to a boat', () => {
  const bp = { ...newBlueprint('Лодка', 'boat-hull') };
  const r = res(bp);
  const hulls = candidatePlacements(bp, r, 'boat-hull', 'f1');
  assert.equal(hulls.length, 4);
  assert.ok(hulls.every(h => h.transform.position[1] === 0));
  assert.equal(candidatePlacements(bp, r, 'square-foundation', 'f1').length, 0);
  assert.equal(candidatePlacements(bp, r, 'wall', 'f1').length, 0);
  assert.equal(candidatePlacements(bp, r, 'boat-wall', 'f1').length, 8);
  assert.equal(candidatePlacements(bp, r, 'boat-floor', 'f1').length, 0);
  assert.equal(candidatePlacements(bp, r, 'boat-stairs', 'f1').length, 4);
});

test('boat floors go on top of boat walls, low walls carry nothing', () => {
  let bp = { ...newBlueprint('Лодка', 'boat-hull') };
  bp = attach(bp, 'boat-wall', 'f1', [1.5, 1, 0]);
  bp = attach(bp, 'boat-low-wall-cannon', 'f1', [-1.5, 0.5, 0]);
  const wall = bp.elements.find(e => e.kind === 'boat-wall')!.id;
  const low = bp.elements.find(e => e.kind === 'boat-low-wall-cannon')!.id;
  assert.equal(candidatePlacements(bp, res(bp), 'boat-floor', wall).length, 2);
  assert.equal(candidatePlacements(bp, res(bp), 'boat-floor', low).length, 0);
});

test('mass, health and cost of a small hull', () => {
  const s = boatStats(res(hullLine()));
  assert.equal(s.massBlocks, 250);
  assert.equal(s.mass, 1000);
  assert.equal(s.health, 175);
  assert.equal(s.build.wood, 750);
  assert.equal(s.build.lgf, 38);
  assert.deepEqual(blockCost('boat-doorway'), { wood: 210, lgf: 11, metal: 0, hqm: 0, tarp: 0, gears: 0, rope: 0 });
});

test('neighbouring hulls hide the side between them', () => {
  const covered = coveredHullSides(res(hullLine()));
  assert.deepEqual(covered.get('f1')?.sort(), [0, 2]);
  assert.deepEqual(covered.get('h1'), [0]);
});

test('frontal width: flat bow counts full width, a triangle bow half of it', () => {
  const r = res(hullLine());
  const hulls = r.elements;
  assert.ok(Math.abs(frontalWidth(hulls, 0, 0) - 1.5) < 0.05, String(frontalWidth(hulls, 0, 0)));
  assert.ok(Math.abs(frontalWidth(hulls, 0, 180) - 3) < 0.05, String(frontalWidth(hulls, 0, 180)));
  assert.ok(Math.abs(frontalWidth(hulls, 0, 90) - (6 + 1.5 * Math.sqrt(3))) < 0.4, String(frontalWidth(hulls, 0, 90)));
  assert.equal(dragFor(3), 0.65);
  assert.ok(Math.abs(dragFor(6) - (0.65 + 1.55 * Math.pow(1 / 45, 0.4))) < 1e-9);
  assert.equal(dragFor(80), 2.2);
});

test('terminal speed: accel capped at 13, speed at 15', () => {
  assert.equal(terminalSpeed(2500, 1000, 0.65), 2.5 / 0.65);
  assert.equal(terminalSpeed(40000, 1000, 1), 13);
  assert.equal(terminalSpeed(40000, 1000, 0.65), 15);
  assert.equal(terminalSpeed(0, 1000, 1), 0);
});

test('objects: engine only on a hull, one wheel, edge items on a free outer edge; speeds follow the wheel', () => {
  let bp = hullLine();
  bp = attach(bp, 'boat-wall', 'h1', [-4.5, 1, 0]);
  const wall = bp.elements.find(e => e.kind === 'boat-wall')!.id;
  bp = attach(bp, 'boat-floor', wall, [-3, 3, 0]);
  const floor = bp.elements.find(e => e.kind === 'boat-floor')!.id;
  assert.equal(deployPlacement(bp, res(bp), 'small-engine', floor, [0, 0, 0], 0), null);
  bp = deploy(bp, 'small-engine', 'h1', [0, 0, 0]);
  bp = deploy(bp, 'steering-wheel', 'f1', [-0.5, 0, 0]);
  assert.equal(deployPlacement(bp, res(bp), 'steering-wheel', 'f1', [0.8, 0, 0.8], 0), null);
  bp = deploy(bp, 'sail', 'f1', [0.6, 0, 0]);
  assert.equal(deployPlacement(bp, res(bp), 'plank', 'f1', [1.4, 0, 0], 0)?.deployable.rotation, 90);
  bp = deploy(bp, 'anchor', 'h1', [0, 0, 1.4]);
  assert.equal(bp.deployables!.find(d => d.kind === 'anchor')!.rotation, 90);
  const loaded = loadBlueprint(bp);
  assert.deepEqual(loaded.issues.filter(i => i.level === 'error'), []);
  const s = boatStats(loaded.resolved!);
  assert.equal(s.mass, 1000);
  assert.equal(s.checks.filter(c => !c.ok).length, 0, JSON.stringify(s.checks));
  assert.ok(Math.abs(s.sails!.speed - 2.5 / 0.65) < 1e-9);
  assert.equal(s.engines!.speed, 15);
  assert.equal(s.reverse!.offBow, 180);
  assert.ok(Math.abs(s.reverse!.speed - 5 / 0.65) < 1e-9);
  assert.equal(s.fuelPerMinute, 24);
  assert.equal(s.build.hqm, 5);
  assert.equal(s.build.tarp, 1);
});

test('boat checks fail without a wheel and propulsion; empty boat scene passes the schema', () => {
  const s = boatStats(res(hullLine()));
  assert.deepEqual(s.checks.filter(c => !c.ok).map(c => c.text), ['Штурвал стоит: он задаёт нос корабля', 'Есть парус или мотор']);
  const empty = loadBlueprint(emptyScheme('Корабль', 'boat'));
  assert.deepEqual(empty.issues, []);
  assert.deepEqual(empty.blueprint?.meta.tags, ['custom', 'boat']);
});
