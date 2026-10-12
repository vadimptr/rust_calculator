import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveBlueprint } from './geometry.ts';
import { EXPLOSIVES, allSplashTargets, bestSimulation, falloff, segmentBlocked, simulateRaid, splashTargets, unitDamage } from './splash.ts';
import { buildSpaceGraph } from './raid.ts';
import type { Blueprint, Grade } from './types.ts';

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

test('C4 is a contact explosive: a stage with C4 breaks at most the block it is placed on', () => {
  const { resolved } = load('house-2x2');
  const g = buildSpaceGraph(resolved);
  for (const st of ['value', 'progress'] as const) {
    const sim = simulateRaid(resolved, g, 'f1', ['c4'], st);
    assert.ok(sim.reached);
    for (const stage of sim.stages) assert.ok(stage.broken.length <= 1, stage.broken.join(','));
  }
});

test('unitDamage: explosive ammo reaches only touching blocks', () => {
  const { resolved } = load('sealed-triangle-tc');
  const [w] = splashTargets(resolved, ['w1']);
  assert.ok(unitDamage('explosiveAmmo', [w.center[0] + 0.05, w.center[1], w.center[2]], w) > 2);
  assert.equal(unitDamage('explosiveAmmo', [w.center[0] + 1, w.center[1], w.center[2]], w), 0);
});

test('simulation: explosive ammo into the 2x2 roof corner removes three ceilings and the vestibule wall together', () => {
  const { resolved } = load('house-2x2');
  const g = buildSpaceGraph(resolved);
  const sim = bestSimulation(resolved, g, 'f1', ['explosiveAmmo'])!;
  assert.equal(sim.stages.length, 1);
  assert.ok(['c1', 'c2', 'c3', 'u3'].every(id => sim.stages[0].broken.includes(id)), sim.stages[0].broken.join(','));
  assert.equal(sim.units.explosiveAmmo, 185);
});

test('simulation: 2x1 optimal goes through the two doors in two stages, each door removed when it dies', () => {
  const { resolved } = load('starter-2x1');
  const g = buildSpaceGraph(resolved);
  const sim = bestSimulation(resolved, g, 'f1', ['rocket', 'c4', 'explosiveAmmo'])!;
  assert.ok(sim.reached);
  assert.equal(sim.sulfur, 3150);
  assert.deepEqual(sim.stages.map(s => s.broken), [['door_outer'], ['door_inner']]);
});

test('simulation: rockets into the 2x2 roof corner remove three ceilings in one stage', () => {
  const { resolved } = load('house-2x2');
  const g = buildSpaceGraph(resolved);
  const sim = bestSimulation(resolved, g, 'f1', ['rocket'])!;
  assert.ok(sim.reached);
  assert.equal(sim.stages.length, 1);
  assert.ok(['c1', 'c2', 'c3'].every(id => sim.stages[0].broken.includes(id)));
  assert.equal(sim.units.rocket, 4);
  assert.ok(!sim.broken.some(id => ['door_tc', 'door_hall', 'door_jump'].includes(id)));
  // стены первого этажа под плитами крыши с крыши не достать
  assert.ok(!sim.broken.some(id => ['w1', 'w2', 'w3', 'w4', 'w5', 'w6', 'w7', 'w8', 'hw1'].includes(id)), `ground walls broken: ${sim.broken.join(',')}`);
});

test('simulation: damage accumulates across stages (C4 then explosive ammo on the same wall)', () => {
  const { resolved } = load('sealed-triangle-tc');
  const g = buildSpaceGraph(resolved);
  const sim = bestSimulation(resolved, g, 'f1', ['rocket', 'c4', 'explosiveAmmo'])!;
  assert.ok(sim.reached);
  assert.ok(sim.sulfur < 4400, `sulfur=${sim.sulfur}`);
  assert.ok(sim.stages.length >= 2);
  assert.deepEqual(sim.stages[0].broken, []); // первый C4 ничего не ломает, урон копится
  assert.ok(sim.broken.every(id => id.startsWith('w')), `expected a wall, got ${sim.broken.join(',')}`); // стена, не потолок
});

test('bunker: rockets and explosive ammo break the same set of structures at the corridor column', () => {
  const { resolved } = load('bunker-30-rockets');
  const g = buildSpaceGraph(resolved);
  const rockets = bestSimulation(resolved, g, 'f0', ['rocket'])!;
  const ammo = bestSimulation(resolved, g, 'f0', ['explosiveAmmo'])!;
  const norm = (ids: string[]) => ids.map(id => id.replace(/\d+$/, '')).sort().join(',');
  assert.equal(norm(rockets.stages[0].broken), norm(ammo.stages[0].broken));
  assert.ok(rockets.stages[0].broken.some(id => id.startsWith('ck')), 'corridor roof expected');
  assert.ok(!rockets.stages[0].broken.includes('d1') && !ammo.stages[0].broken.includes('d1'));
});


test('two adjacent stone walls sharing a corner: a corner shot deals full damage to both', () => {
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
  const corner: [number, number, number] = [1.6, 1.5, 1.6];
  assert.equal(unitDamage('rocket', corner, a), EXPLOSIVES.rocket.block.stone);
  assert.equal(unitDamage('rocket', corner, b), EXPLOSIVES.rocket.block.stone);
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

test('bunker: an outside corner shot never breaks the doorway hidden behind the corridor wall', () => {
  const { resolved } = load('bunker-30-rockets');
  const g = buildSpaceGraph(resolved);
  const sim = bestSimulation(resolved, g, 'f0', ['rocket'])!;
  assert.ok(sim.reached);
  assert.equal(sim.units.rocket, 30);
  assert.ok(!sim.stages[0].broken.includes('d1'), sim.stages[0].broken.join(','));
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
  assert.equal(optimal.sulfur, 10600);
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
  // четыре двери по 18 разрывных, затем ракета и 7 C4 в стену куба (дешевле 8 C4 на 800 серы)
  assert.equal(sim.sulfur, 18600);
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
  assert.equal(optimal.sulfur, 4300);
  assert.ok(!optimal.broken.includes('tf'));
});
