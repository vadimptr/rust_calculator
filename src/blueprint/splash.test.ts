import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveBlueprint } from './geometry.ts';
import { allSplashTargets, bestSimulation, closestOnOBB, colliders, simulateRaid, splashTargets, unitDamage, visibleFrom } from './splash.ts';
import { blockProfile, deployableProfile, falloffK, unitsToKill } from './rustDamage.ts';
import { buildSpaceGraph } from './raid.ts';
import type { Blueprint, Grade } from './types.ts';

function load(name: string) {
  const bp = JSON.parse(readFileSync(new URL(`../../docs/blueprint/examples/${name}.json`, import.meta.url), 'utf8')) as Blueprint;
  return { bp, resolved: resolveBlueprint(bp).resolved };
}

test('game data: units to kill reproduce the raid table from prefab damage and grade protection', () => {
  const stone = blockProfile('stone'), metal = blockProfile('metal'), armored = blockProfile('armored'), wood = blockProfile('wood');
  assert.deepEqual(['rocket', 'c4', 'satchel', 'explosiveAmmo'].map(ex => unitsToKill(ex as 'rocket', stone)), [4, 2, 10, 182]);
  assert.deepEqual(['rocket', 'c4', 'satchel', 'explosiveAmmo'].map(ex => unitsToKill(ex as 'rocket', metal)), [8, 4, 23, 400]);
  assert.deepEqual(['rocket', 'c4', 'explosiveAmmo'].map(ex => unitsToKill(ex as 'rocket', armored)), [15, 8, 799]);
  assert.deepEqual(['rocket', 'c4'].map(ex => unitsToKill(ex as 'rocket', wood)), [2, 1]);
  const door = (k: Parameters<typeof deployableProfile>[0]) => deployableProfile(k)!;
  assert.deepEqual(['rocket', 'c4', 'satchel', 'explosiveAmmo'].map(ex => unitsToKill(ex as 'rocket', door('sheet-metal-door'))), [2, 1, 4, 63]);
  assert.deepEqual(['rocket', 'c4', 'explosiveAmmo'].map(ex => unitsToKill(ex as 'rocket', door('armored-door'))), [5, 3, 250]);
  assert.deepEqual(['rocket', 'c4', 'explosiveAmmo'].map(ex => unitsToKill(ex as 'rocket', door('garage-door'))), [3, 2, 150]);
  assert.deepEqual(['rocket', 'c4'].map(ex => unitsToKill(ex as 'rocket', door('wooden-door'))), [1, 1]);
});

test('falloff: full damage up to rmin, linear to r (rocket 1 → 3.8 m, explosive ammo 0 → 1.5 m)', () => {
  assert.equal(falloffK('rocket', 0.9), 1);
  assert.ok(Math.abs(falloffK('rocket', 2.4) - 0.5) < 1e-9);
  assert.equal(falloffK('rocket', 3.8), 0);
  assert.ok(Math.abs(falloffK('explosiveAmmo', 0.75) - 0.5) < 1e-9);
});

test('distance is to the closest point of the prefab bounds box; a wall box is 0.2 m thick and full 3 × 3', () => {
  let bp: Blueprint = { formatVersion: '1.0', meta: { name: 'x' }, defaults: { grade: 'stone' }, elements: [{ id: 'f1', kind: 'square-foundation', root: true }, { id: 'w', kind: 'wall', attach: { to: 'f1', socket: 'edge:0' } }] };
  const { resolved } = resolveBlueprint(bp);
  const [w] = splashTargets(resolved, ['w']);
  assert.deepEqual(closestOnOBB(w.obb, [3, 1.5, 0]).map(v => Math.round(v * 100) / 100), [1.6, 1.5, 0]);
  assert.deepEqual(closestOnOBB(w.obb, [1.5, 5, 5]).map(v => Math.round(v * 100) / 100), [1.5, 3, 1.5]);
  void bp;
});

test('C4 is placed: a stage with C4 breaks at most the block it is placed on', () => {
  const { resolved } = load('starter-2x1');
  const g = buildSpaceGraph(resolved);
  const sim = bestSimulation(resolved, g, 'f1', ['c4'])!;
  for (const st of sim.stages) assert.ok(st.broken.length <= 1, st.broken.join(','));
});

test('two adjacent stone walls sharing a corner: a rocket at the corner deals full damage to both', () => {
  const bp: Blueprint = {
    formatVersion: '1.0', meta: { name: 'x' }, defaults: { grade: 'stone' },
    elements: [
      { id: 'f1', kind: 'square-foundation', root: true },
      { id: 'a', kind: 'wall', attach: { to: 'f1', socket: 'edge:0' } },
      { id: 'b', kind: 'wall', attach: { to: 'f1', socket: 'edge:1' } },
    ],
  };
  const { resolved } = resolveBlueprint(bp);
  const [a, b] = splashTargets(resolved, ['a', 'b']);
  // центр взрыва ракеты снаружи угла, в пределах rmin от обеих коробок
  const p: [number, number, number] = [1.9, 1.5, 1.9];
  assert.equal(unitDamage('rocket', p, a), a.splash.rocket);
  assert.equal(unitDamage('rocket', p, b), b.splash.rocket);
  const cols = colliders(resolved, new Set());
  assert.ok(visibleFrom(p, a, cols) && visibleFrom(p, b, cols));
});

test('visibility: a closed door or a wall between the explosion and the target blocks all damage', () => {
  const { resolved } = load('starter-2x1');
  const cols = colliders(resolved, new Set());
  const inner = allSplashTargets(resolved).find(t => t.id === 'door_inner')!;
  // снаружи дома ни один луч к внутренней двери не проходит
  assert.equal(visibleFrom([1.5, 1.2, -4], inner, cols), false);
});

test('simulation: 2x1 optimal goes through the two doors with explosive ammo, 63 each', () => {
  const { resolved } = load('starter-2x1');
  const g = buildSpaceGraph(resolved);
  const sim = bestSimulation(resolved, g, 'f1', ['rocket', 'c4', 'explosiveAmmo'])!;
  assert.ok(sim.reached);
  assert.equal(sim.sulfur, 3150);
  assert.deepEqual(sim.stages.map(s => s.broken), [['door_outer'], ['door_inner']]);
});

test('simulation: rockets into the 2x2 roof corner remove three ceilings in one stage, ground walls untouched', () => {
  const { resolved } = load('house-2x2');
  const g = buildSpaceGraph(resolved);
  const sim = bestSimulation(resolved, g, 'f1', ['rocket'])!;
  assert.ok(sim.reached);
  assert.equal(sim.stages.length, 1);
  assert.ok(['c1', 'c2', 'c3'].every(id => sim.stages[0].broken.includes(id)));
  assert.equal(sim.units.rocket, 4);
  assert.ok(!sim.broken.some(id => ['w1', 'w2', 'w3', 'w4', 'w5', 'w6', 'w7', 'w8', 'hw1'].includes(id)), `ground walls broken: ${sim.broken.join(',')}`);
});

test('simulation: damage accumulates across stages (C4 then explosive ammo on the same wall), cheaper than 2 C4', () => {
  const { resolved } = load('sealed-triangle-tc');
  const g = buildSpaceGraph(resolved);
  const sim = bestSimulation(resolved, g, 'f1', ['rocket', 'c4', 'explosiveAmmo'])!;
  assert.ok(sim.reached);
  assert.equal(sim.sulfur, 4250);
  assert.deepEqual(sim.stages[0].broken, []);
  assert.ok(sim.broken.every(id => id.startsWith('w')), sim.broken.join(','));
});

test('bunker: 30 rockets, the corner shot takes the corridor roof and outer walls but never the hidden doorway', () => {
  const { resolved } = load('bunker-30-rockets');
  const g = buildSpaceGraph(resolved);
  const sim = bestSimulation(resolved, g, 'f0', ['rocket'])!;
  assert.ok(sim.reached);
  assert.equal(sim.units.rocket, 30);
  assert.ok(sim.stages[0].broken.some(id => id.startsWith('ck')), sim.stages[0].broken.join(','));
  assert.ok(!sim.stages[0].broken.includes('d1'), sim.stages[0].broken.join(','));
});

test('simulation, rockets only: 2x1 costs 4 rockets; a seam shot takes both in-line walls, a closed door never splashes the next one', () => {
  const { resolved } = load('starter-2x1');
  const g = buildSpaceGraph(resolved);
  const sim = bestSimulation(resolved, g, 'f1', ['rocket'])!;
  assert.ok(sim.reached);
  assert.equal(sim.units.rocket, 4);
  for (const stage of sim.stages) {
    const doors = stage.broken.filter(id => id.startsWith('door_'));
    assert.ok(doors.length <= 1, `two doors in one stage: ${stage.broken.join(',')}`);
  }
});

test('ceiling edge cannot be hit from outside: a ground-level stage never breaks the roof slab', () => {
  const { resolved } = load('sealed-triangle-tc');
  const g = buildSpaceGraph(resolved);
  for (const st of ['value', 'progress'] as const) {
    const sim = simulateRaid(resolved, g, 'f1', ['rocket', 'c4', 'explosiveAmmo'], st);
    for (const stage of sim.stages) if (stage.shot.point[1] < 2.9) assert.ok(!stage.broken.includes('c1'), stage.broken.join(','));
  }
});

/** Переопределение материалов, как в просмотре: все элементы одной прочности, все двери одного типа. */
function override(bp: Blueprint, grade: Grade, door: 'wooden-door') {
  const doc = JSON.parse(JSON.stringify(bp)) as Blueprint;
  doc.defaults = { ...(doc.defaults ?? {}), grade };
  for (const el of doc.elements) if (el.grade) el.grade = grade;
  for (const d of doc.deployables ?? []) if (/^(wooden|sheet-metal|armored)-door$/.test(d.kind)) d.kind = door;
  return resolveBlueprint(doc).resolved;
}

test('bunker, metal walls and wooden doors: the raid goes through the four corridor doors, not the walls', () => {
  const resolved = override(load('bunker-30-rockets').bp, 'metal', 'wooden-door');
  const g = buildSpaceGraph(resolved);
  const optimal = bestSimulation(resolved, g, 'f0', ['rocket', 'c4', 'explosiveAmmo'])!;
  // деревянная дверь: 16 разрывных (прямой урон пули + радиальный, защита двери −1 к взрыву)
  assert.equal(optimal.sulfur, 10400);
  assert.deepEqual(optimal.stages.slice(0, 4).map(s => s.broken), [['door4'], ['door3'], ['door2'], ['door1']]);
  // ракетами тоже: одна ракета в дверь не должна проигрывать отбор залпам в угол стен
  const rockets = bestSimulation(resolved, g, 'f0', ['rocket'])!;
  assert.equal(rockets.sulfur, 16800);
  assert.deepEqual(rockets.stages.slice(0, 4).map(s => s.broken), [['door4'], ['door3'], ['door2'], ['door1']]);
});

test('bunker, armored walls and wooden doors: the cheapest plan wins even if a dearer one opens more rooms', () => {
  const resolved = override(load('bunker-30-rockets').bp, 'armored', 'wooden-door');
  const g = buildSpaceGraph(resolved);
  const sim = bestSimulation(resolved, g, 'f0', ['rocket', 'c4', 'explosiveAmmo'])!;
  // четыре двери по 16 разрывных, затем ракета и 7 C4 в стену куба (дешевле 8 C4 на 800 серы)
  assert.equal(sim.sulfur, 18400);
  assert.deepEqual(sim.stages.map(s => s.broken), [['door4'], ['door3'], ['door2'], ['door1'], [], ['cw0']]);
});

test('roof bunker: the roof is a pitched splash target over the vestibule; the bunker costs as much as a wall', () => {
  const { resolved } = load('roof-bunker');
  const g = buildSpaceGraph(resolved);
  const roof = allSplashTargets(resolved).find(t => t.id === 'rb')!;
  assert.ok(roof.pitch && roof.pitch < 0, 'roof target is pitched');
  // низкое ребро над полустеной (x ≈ 4.5, y ≈ 1.5), высокое над дверью (x ≈ 7.5, y ≈ 4.5): сквозь потолок тамбура
  const xs = roof.candidates.map(c => c[0]);
  assert.ok(Math.min(...xs) < 4.7 && Math.max(...xs) > 7.3, xs.join(','));
  const ys = roof.candidates.map(c => c[1]);
  assert.ok(Math.min(...ys) < 1.8 && Math.max(...ys) > 4.3, ys.join(','));
  // твиговая опора — цель за крышей и полустеной, снаружи до неё не добраться без разрушений
  const c4 = bestSimulation(resolved, g, 'f1', ['c4'])!;
  assert.ok(c4.reached);
  assert.equal(c4.sulfur, 4400);
  const optimal = bestSimulation(resolved, g, 'f1', ['rocket', 'c4', 'explosiveAmmo'])!;
  assert.ok(optimal.reached);
  assert.equal(optimal.sulfur, 4250);
  assert.ok(!optimal.broken.includes('tf'));
});
