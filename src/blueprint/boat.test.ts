import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveBlueprint } from './geometry.ts';
import { addDeployable, addElement, candidatePlacements, deployPlacement, newBlueprint, placementsNear } from './editor.ts';
import { blockCost, blockedSails, boatStats, coveredHullSides, dragFor, frontalWidth, sailWarning, terminalSpeed } from './boat.ts';
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
  assert.equal(blockCost('boat-doorway').wood, 210);
  assert.equal(blockCost('boat-doorway').lgf, 11);
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
  const bow = boatStats(r).bow!;
  assert.ok(Math.abs(bow.width - 1.5) < 0.05, String(bow.width));
  assert.equal(bow.drag, 0.65);
  assert.equal(boatStats(res({ ...hullLine(), elements: [] })).bow, null);
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
  bp = deploy(bp, 'sail', 'th1', [0, 0, 0]);
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

test('objects turn from the hull grid: a hull laid at 37° keeps the wheel and sails on its axes', () => {
  let bp: Blueprint = { ...newBlueprint('Лодка', 'boat-hull', [0, 0, 0], 37), meta: { name: 'Лодка', tags: ['boat'] }, defaults: { grade: 'wood' } };
  bp = attach(bp, 'boat-hull', 'f1', [-2.4, 0, -1.8]);
  bp = deploy(bp, 'steering-wheel', 'f1', [-0.5, 0, 0], 90);
  const r = res(bp);
  const wheel = r.deployables.find(d => d.kind === 'steering-wheel')!;
  assert.equal(wheel.rotation, 127);
  const sail = deployPlacement(bp, r, 'sail', 'h1', [0, 0, 0], 45)!;
  const host = r.elements.find(e => e.id === 'h1')!;
  assert.equal(((host.rotation + sail.deployable.rotation!) % 360 + 360) % 360, 172);
});

test('deck objects: workbench and boxes on the deck, doors and windows in boat openings', () => {
  let bp = hullLine();
  bp = deploy(bp, 'workbench1', 'f1', [0, 0, 0]);
  bp = deploy(bp, 'small-wood-box', 'h1', [0.8, 0, 0.8]);
  assert.equal(deployPlacement(bp, res(bp), 'workbench2', 'f1', [0.2, 0, 0.2], 0), null);
  bp = attach(bp, 'boat-doorway', 'h1', [-3, 1, 1.5]);
  bp = attach(bp, 'boat-window', 'h1', [-3, 1, -1.5]);
  const door = bp.elements.find(e => e.kind === 'boat-doorway')!.id;
  const win = bp.elements.find(e => e.kind === 'boat-window')!.id;
  bp = deploy(bp, 'sheet-metal-door', door, [0.2, 1, 0.3]);
  bp = deploy(bp, 'metal-window-bars', win, [0.2, 1, 0]);
  const loaded = loadBlueprint(bp);
  assert.deepEqual(loaded.issues.filter(i => i.level === 'error'), []);
  const s = boatStats(loaded.resolved!);
  assert.equal(s.objects, 4);
  assert.equal(s.mass, 1000);
  assert.equal(s.build.wood, 750 + 210 + 210 + 500 + 100);
  assert.equal(s.build.metal, 100 + 150 + 25);
});

test('sail wind block: another sail, a full wall or a roof behind it stops it, a low wall does not', () => {
  const hull = (id: string, x: number, z: number) => ({ id, kind: 'boat-hull' as const, grade: 'wood' as const, position: [x, 0, z] as [number, number, number], rotation: 0, level: 0 });
  const sail = (id: string, x: number, z: number, rotation = 0) => ({ id, kind: 'sail' as const, parent: 'h1', hinge: 'left' as const, opens: 'outward' as const, open: false, position: [x, 0, z] as [number, number, number], rotation, level: 0 });
  const base = { elements: [hull('h1', 0, 0), hull('h2', -3, 0), hull('h3', 3, 0)], deployables: [] as ReturnType<typeof sail>[] };
  assert.equal(blockedSails({ ...base, deployables: [sail('s1', 0, 0), sail('s2', 1.5, 0)] }).get('s2')?.by, 's1');
  assert.equal(blockedSails({ ...base, deployables: [sail('s1', 0, 0), sail('s2', 1.5, 0)] }).has('s1'), false);
  assert.equal(blockedSails({ ...base, deployables: [sail('s1', 0, 0), sail('s2', 0, 3)] }).size, 0);
  assert.equal(blockedSails({ ...base, deployables: [sail('s1', -3, 0), sail('s2', 0, 0)] }).size, 0);
  const wall = (kind: 'boat-wall' | 'boat-low-wall') => ({ id: 'w1', kind, grade: 'wood' as const, position: [-1.5, 0, 0] as [number, number, number], rotation: 0, level: 0 });
  assert.equal(blockedSails({ elements: [...base.elements, wall('boat-wall')], deployables: [sail('s1', 0, 0)] }).get('s1')?.by, 'w1');
  assert.equal(blockedSails({ elements: [...base.elements, wall('boat-low-wall')], deployables: [sail('s1', 0, 0)] }).size, 0);
  const roof = { id: 'c1', kind: 'boat-floor' as const, grade: 'wood' as const, position: [0, 6, 0] as [number, number, number], rotation: 0, level: 2 };
  assert.deepEqual(blockedSails({ elements: [...base.elements, roof], deployables: [sail('s1', 0, 0)] }).get('s1'), { by: 'c1', roof: true });
  const stats = boatStats({ ...base, deployables: [sail('s1', 0, 0), sail('s2', 1.5, 0)] });
  assert.equal(stats.sails!.force, 2500);
  assert.equal(stats.checks.find(c => c.text.startsWith('Заслонено'))?.ok, false);
});

test('deck objects may hang over an open deck edge by their support points, but keep their full box off a wall', () => {
  let bp = { ...newBlueprint('Лодка', 'boat-hull'), meta: { name: 'Лодка', tags: ['boat'] }, defaults: { grade: 'wood' as const } };
  const open = deployPlacement(bp, res(bp), 'furnace', 'f1', [1.5, 0, 0], 0)!;
  assert.ok(open.deployable.offset![0] > 1.1, `offset ${open.deployable.offset}`);
  bp = attach(bp, 'boat-wall', 'f1', [1.5, 0, 0]);
  const walled = deployPlacement(bp, res(bp), 'furnace', 'f1', [1.5, 0, 0], 0)!;
  assert.ok(walled.deployable.offset![0] < 0.9, `offset ${walled.deployable.offset}`);
});

test('the anchor stands on the deck edge facing out and its winch is on the deck', () => {
  const bp = deploy(hullLine(), 'anchor', 'h1', [0, 0, 1.4]);
  const a = bp.deployables!.find(d => d.kind === 'anchor')!;
  assert.equal(a.rotation, 90);
  assert.deepEqual(a.offset, [0, 1.5]);
});

test('a sail whose sheet overlaps another sail is reported as too close', () => {
  const hull = (id: string, x: number, z: number) => ({ id, kind: 'boat-hull' as const, position: [x, 0, z] as [number, number, number], rotation: 0, level: 0 });
  const sail = (id: string, x: number, z: number) => ({ id, kind: 'sail' as const, parent: 'h1', hinge: 'left' as const, opens: 'outward' as const, open: false, position: [x, 0, z] as [number, number, number], rotation: 0, level: 0 });
  const elements = [hull('h1', 0, 0), hull('h2', 0, 3)];
  const before = { elements, deployables: [sail('s1', 0, 0)] };
  const near = sailWarning(before, { elements, deployables: [sail('s1', 0, 0), sail('g', 0, 1.2)] }, 'g');
  assert.match(near ?? '', /Слишком близко к парусу «s1»/);
  assert.equal(sailWarning(before, { elements, deployables: [sail('s1', 0, 0), sail('g', 0, 3)] }, 'g'), null);
});

test('house: furniture goes on a foundation, boat-only objects do not, and raid does not take furniture for a door', () => {
  let bp = newBlueprint('Дом', 'square-foundation');
  assert.equal(deployPlacement(bp, res(bp), 'sail', 'f1', [0, 0, 0], 0), null);
  bp = deploy(bp, 'furnace', 'f1', [0.5, 0, 0]);
  bp = deploy(bp, 'large-wood-box', 'f1', [-0.8, 0, 0]);
  const loaded = loadBlueprint(bp);
  assert.deepEqual(loaded.issues.filter(i => i.level === 'error'), []);
  assert.equal(loaded.resolved!.deployables.length, 2);
});

test('io objects: wall items hang on either face of a wall, ceiling lights hang under a floor, planters stand on a foundation', () => {
  let bp = newBlueprint('Ферма', 'square-foundation');
  bp = attach(bp, 'wall', 'f1', [1.5, 1, 0]);
  const wall = bp.elements.find(e => e.kind === 'wall')!.id;
  bp = attach(bp, 'square-floor', wall, [0, 3, 0]);
  const floor = bp.elements.find(e => e.kind === 'square-floor')!.id;
  assert.equal(deployPlacement(bp, res(bp), 'splitter', 'f1', [0, 0, 0], 0), null);
  assert.equal(deployPlacement(bp, res(bp), 'ceiling-light', 'f1', [0, 0, 0], 0), null);
  bp = deploy(bp, 'splitter', wall, [-0.2, 1.4, 0.5]);
  bp = deploy(bp, 'switch', wall, [0.2, 1.4, 0.5]);
  assert.equal(deployPlacement(bp, res(bp), 'splitter', wall, [-0.2, 1.4, 0.5], 0), null);
  bp = deploy(bp, 'ceiling-light', floor, [0, -0.2, 0]);
  bp = deploy(bp, 'large-planter', 'f1', [0, 0, 0]);
  const loaded = loadBlueprint(bp);
  assert.deepEqual(loaded.issues.filter(i => i.level === 'error'), []);
  const r = loaded.resolved!;
  const w = r.elements.find(e => e.id === wall)!;
  const inner = r.deployables.find(d => d.kind === 'splitter')!, outer = r.deployables.find(d => d.kind === 'switch')!;
  assert.ok(inner.position[0] < w.position[0] && outer.position[0] > w.position[0], `${inner.position} ${outer.position}`);
  const light = r.deployables.find(d => d.kind === 'ceiling-light')!;
  assert.ok(Math.abs(light.position[1] - (r.elements.find(e => e.id === floor)!.position[1] - 0.2)) < 1e-6);
});
