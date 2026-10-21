import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveBlueprint } from './geometry.ts';
import { addDeployable, addElement, addElementAt, freePlacement, candidatePlacements, deployPlacement, newBlueprint, placementsNear, removeElement, rotateElement, settle, upgradeElement } from './editor.ts';
import type { Blueprint } from './types.ts';

function load(name: string) {
  const bp = JSON.parse(readFileSync(new URL(`../../docs/blueprint/examples/${name}.json`, import.meta.url), 'utf8')) as Blueprint;
  return { bp, resolved: resolveBlueprint(bp).resolved };
}

test('new blueprint: one twig foundation; walls snap to its four edges, nearest to the cursor first', () => {
  const bp = newBlueprint();
  const resolved = resolveBlueprint(bp).resolved;
  const walls = candidatePlacements(bp, resolved, 'wall', 'f1');
  assert.equal(walls.length, 8); // 4 ребра × две стороны (rotationDegrees 180 у wall-male)
  const near = placementsNear(bp, resolved, 'wall', 'f1', [1.4, 1, 0.2]);
  assert.deepEqual(near[0].attach, { to: 'f1', socket: 'edge:0' });
  // соседний фундамент — тоже четыре варианта, съезд — четыре, лестница на top — четыре поворота
  assert.equal(candidatePlacements(bp, resolved, 'triangle-foundation', 'f1').length, 12); // 4 ребра × 3 высоты
  assert.equal(candidatePlacements(bp, resolved, 'ramp', 'f1').length, 12); // 4 ребра + сверху 4 поворота × 2 высоты (Block и Misc)
  assert.equal(candidatePlacements(bp, resolved, 'stairs-l-shape', 'f1').length, 4);
  // пол на фундамент ребром к ребру нельзя (фундамент к фундаменту, пол к полу)
  assert.equal(candidatePlacements(bp, resolved, 'square-floor', 'f1').length, 0);
});

test('placing a wall occupies the edge: the next wall has three edges, two sides each; floors on a wall top come on both sides', () => {
  let bp = newBlueprint();
  let resolved = resolveBlueprint(bp).resolved;
  const w = placementsNear(bp, resolved, 'wall', 'f1', [1.5, 1, 0])[0];
  bp = addElement(bp, 'wall', w.attach, 'stone');
  resolved = resolveBlueprint(bp).resolved;
  assert.equal(candidatePlacements(bp, resolved, 'wall', 'f1').length, 6); // 3 свободных ребра × две стороны
  assert.equal(bp.elements[1].id, 'w1');
  assert.equal(bp.elements[1].grade, 'stone');
  const floors = candidatePlacements(bp, resolved, 'square-floor', 'w1');
  assert.equal(floors.length, 2);
  const xs = floors.map(f => f.transform.position[0]).sort((a, b) => a - b);
  assert.ok(xs[0] < 0.1 && xs[1] > 2.9, xs.join(','));
  assert.ok(floors.every(f => f.transform.position[1] === 3));
});

test('removing a wall keeps the floor that still rests on other walls; removing the last support drops the floor too', () => {
  const { bp } = load('sealed-triangle-tc');
  const after = settle(removeElement(bp, 'w1')).blueprint;
  assert.ok(after.elements.find(e => e.id === 'c1'), 'ceiling kept');
  const pos = resolveBlueprint(after).resolved.elements.find(e => e.id === 'c1')!.position;
  assert.deepEqual(pos, [0, 3, 0]);
  // сносим и остальные стены — потолок без опоры обрушивается (по стабильности)
  const bare = settle(removeElement(removeElement(after, 'w2'), 'w3')).blueprint;
  assert.ok(!bare.elements.some(e => e.id === 'c1'));
  assert.deepEqual(resolveBlueprint(bare).issues.filter(i => i.level === 'error'), []);
  assert.equal(settle(removeElement(bp, 'f1')).blueprint.elements.length, 0);
});

test('removing a doorway removes its door; upgrade sets the grade', () => {
  const { bp } = load('starter-2x1');
  const doorway = bp.deployables!.find(d => d.id === 'door_outer')!.attach.to;
  const after = removeElement(bp, doorway);
  assert.ok(!after.deployables!.some(d => d.id === 'door_outer'));
  assert.deepEqual(resolveBlueprint(after).issues.filter(i => i.level === 'error'), []);
  const up = upgradeElement(bp, 'w1', 'armored');
  assert.equal(up.elements.find(e => e.id === 'w1')!.grade, 'armored');
});

test('deployables: a single door into a doorway with hinge by cursor side, nothing into a taken opening, TC onto a cell at the cursor', () => {
  let bp = newBlueprint();
  let resolved = resolveBlueprint(bp).resolved;
  bp = addElement(bp, 'doorway', { to: 'f1', socket: 'edge:0' });
  resolved = resolveBlueprint(bp).resolved;
  const left = deployPlacement(bp, resolved, 'wooden-door', 'dw1', [0.1, 1, 0.5])!;
  assert.equal(left.deployable.hinge, 'left');
  assert.equal(deployPlacement(bp, resolved, 'wooden-door', 'dw1', [0.1, 1, -0.5])!.deployable.hinge, 'right');
  assert.equal(deployPlacement(bp, resolved, 'garage-door', 'dw1', [0, 1, 0]), null);
  bp = addDeployable(bp, left.deployable);
  resolved = resolveBlueprint(bp).resolved;
  assert.equal(bp.deployables![0].id, 'd1');
  assert.equal(deployPlacement(bp, resolved, 'wooden-door', 'dw1', [0.1, 1, 0.5]), null);
  const tc = deployPlacement(bp, resolved, 'tool-cupboard', 'f1', [-0.9, 0, 0.9])!;
  assert.deepEqual(tc.deployable.offset, [-0.9, 0.82]);
  assert.deepEqual(resolveBlueprint(addDeployable(bp, tc.deployable)).issues.filter(i => i.level === 'error'), []);
});

test('new kinds resolve: ramp and foundation steps on a foundation edge, spiral stairs on a cell', () => {
  let bp = newBlueprint();
  bp = addElement(bp, 'ramp', { to: 'f1', socket: 'edge:0', selfSocket: 'edge:0' });
  bp = addElement(bp, 'foundation-steps', { to: 'f1', socket: 'edge:2', selfSocket: 'edge:0' });
  bp = addElement(bp, 'spiral-stairs', { to: 'f1', socket: 'top' });
  const r = resolveBlueprint(bp);
  assert.deepEqual(r.issues.filter(i => i.level === 'error'), []);
  const ramp = r.resolved.elements.find(e => e.kind === 'ramp')!;
  assert.deepEqual(ramp.position, [3, 0, 0]);
  // съезд занимает место соседа: фундамент туда уже не поставить
  assert.equal(candidatePlacements(bp, r.resolved, 'square-foundation', 'f1').length, 6); // 2 ребра × 3 высоты
});

test('removing a foundation keeps a doorway on the shared edge: it rests on the other cell, door and floor stay in place', () => {
  let bp = newBlueprint();
  bp = addElement(bp, 'square-foundation', { to: 'f1', socket: 'edge:0', selfSocket: 'edge:2' });
  bp = addElement(bp, 'doorway', { to: 'f2', socket: 'edge:2' });
  bp = addElement(bp, 'wall', { to: 'f2', socket: 'edge:1' });
  bp = addElement(bp, 'square-floor', { to: 'dw1', socket: 'top', selfSocket: 'edge:0' });
  bp = addElement(bp, 'wall', { to: 'dw1', socket: 'top' });
  bp = addDeployable(bp, { kind: 'wooden-door', attach: { to: 'dw1', socket: 'opening' }, hinge: 'left', opens: 'outward' });
  bp = addDeployable(bp, { kind: 'drop-box', attach: { to: 'w2', socket: 'face' }, offset: [0.8, 1.3], direction: 'out' });
  const before = resolveBlueprint(bp).resolved;
  const after = settle(removeElement(bp, 'f2')).blueprint;
  const r = resolveBlueprint(after);
  assert.deepEqual(r.issues.filter(i => i.level === 'error'), []);
  // w1 стояла на f2, но держится боком на проёме (0.1 × 0.7 = 7% > 5%) — как в игре; остальное на месте
  assert.deepEqual(after.elements.map(e => e.id).sort(), ['c1', 'dw1', 'f1', 'w1', 'w2']);
  for (const id of ['dw1', 'c1', 'w2']) {
    const a = before.elements.find(e => e.id === id)!, b = r.resolved.elements.find(e => e.id === id)!;
    assert.deepEqual(b.position, a.position, id);
  }
  assert.equal(r.resolved.elements.find(e => e.id === 'c1')!.rotation, before.elements.find(e => e.id === 'c1')!.rotation);
  assert.equal(((r.resolved.elements.find(e => e.id === 'dw1')!.rotation % 360) + 360) % 360, ((before.elements.find(e => e.id === 'dw1')!.rotation % 360) + 360) % 360);
  const door = after.deployables!.find(d => d.id === 'd1')!;
  assert.equal(door.hinge, 'left');
  assert.equal(door.opens, 'outward');
  const box = after.deployables!.find(d => d.id === 'box1')!;
  assert.equal(box.direction, 'out');
  assert.deepEqual(box.offset, [0.8, 1.3]);
  assert.deepEqual(r.resolved.deployables.find(d => d.id === 'box1')!.position, before.deployables.find(d => d.id === 'box1')!.position);
});

test('nothing can be placed on top of an existing block: a second floor over the same cell, a foundation back onto the root, a wall onto a wall edge from the other cell', () => {
  let bp = newBlueprint();
  bp = addElement(bp, 'square-foundation', { to: 'f1', socket: 'edge:0', selfSocket: 'edge:2' });
  bp = addElement(bp, 'wall', { to: 'f1', socket: 'edge:1' });
  bp = addElement(bp, 'wall', { to: 'f1', socket: 'edge:2' });
  bp = addElement(bp, 'square-floor', { to: 'w1', socket: 'top', selfSocket: 'edge:0' });
  let resolved = resolveBlueprint(bp).resolved;
  // пол над f1 уже есть: с верха w2 можно поставить только наружу
  const floors = candidatePlacements(bp, resolved, 'square-floor', 'w2');
  assert.equal(floors.length, 1);
  assert.ok(Math.hypot(floors[0].transform.position[0], floors[0].transform.position[2]) > 1);
  assert.equal(candidatePlacements(bp, resolved, 'triangle-floor-frame', 'w2').length, 1);
  // с f2 нельзя поставить фундамент на место f1 ни одним ребром
  assert.ok(candidatePlacements(bp, resolved, 'square-foundation', 'f2').every(p => Math.hypot(...p.transform.position) > 1));
  // стена на общем ребре f1/f2 со стороны f2 — одна позиция, затем занята
  bp = addElement(bp, 'doorway', { to: 'f1', socket: 'edge:0' });
  resolved = resolveBlueprint(bp).resolved;
  assert.ok(candidatePlacements(bp, resolved, 'wall', 'f2').every(p => Math.abs(p.transform.position[0] - 1.5) > 0.1));
});

test('foundations are ground-level only: none can be placed on a wall top, floors still can', () => {
  let bp = newBlueprint();
  bp = addElement(bp, 'wall', { to: 'f1', socket: 'edge:0' });
  const resolved = resolveBlueprint(bp).resolved;
  assert.equal(candidatePlacements(bp, resolved, 'square-foundation', 'w1').length, 0);
  assert.equal(candidatePlacements(bp, resolved, 'triangle-foundation', 'w1').length, 0);
  assert.equal(candidatePlacements(bp, resolved, 'square-floor', 'w1').length, 2);
});

test('roof needs support under its low edge: both sides of a wall top are fine, a roof beside another roof past the corner is not', () => {
  let bp = newBlueprint();
  bp = addElement(bp, 'wall', { to: 'f1', socket: 'edge:0' });
  let resolved = resolveBlueprint(bp).resolved;
  const onWall = candidatePlacements(bp, resolved, 'roof', 'w1');
  assert.equal(onWall.length, 2);
  bp = addElement(bp, 'roof', onWall[0].attach);
  resolved = resolveBlueprint(bp).resolved;
  // сбоку от крыши стены нет — крыша висела бы в воздухе
  assert.equal(candidatePlacements(bp, resolved, 'roof', 'r1').filter(p => p.attach.socket !== 'edge:2').length, 0);
  // появился соседний фундамент со стеной на той же линии — боковая крыша получает опору
  bp = addElement(bp, 'square-foundation', { to: 'f1', socket: 'edge:1', selfSocket: 'edge:3' });
  bp = addElement(bp, 'wall', { to: 'f2', socket: 'edge:0' });
  resolved = resolveBlueprint(bp).resolved;
  const beside = candidatePlacements(bp, resolved, 'roof', 'r1').filter(p => p.attach.socket !== 'edge:2');
  assert.equal(beside.length, 1);
  // крыша низким ребром на ребро фундамента (съезд-крыша) опирается на само ребро; над соседним
  // фундаментом тоже можно — крыша лежит выше плоскости уровня и с плитой не спорит
  assert.equal(candidatePlacements(bp, resolved, 'roof', 'f2').length, 8); // 4 ребра × наружу и внутрь
});

test('roofs do not collide with each other: a crossing roof at the same position is allowed, an exact duplicate is not', () => {
  let bp = newBlueprint();
  bp = addElement(bp, 'wall', { to: 'f1', socket: 'edge:0' });
  bp = addElement(bp, 'wall', { to: 'f1', socket: 'edge:1' });
  bp = addElement(bp, 'roof', { to: 'w1', socket: 'top', selfSocket: 'edge:0' });
  const resolved = resolveBlueprint(bp).resolved;
  // с соседней стены крыша внутрь ложится на ту же ячейку под другим углом — можно
  const fromW2 = candidatePlacements(bp, resolved, 'roof', 'w2');
  assert.ok(fromW2.some(p => !p.attach.flip), fromW2.map(p => JSON.stringify(p.attach)).join(' '));
  // с той же стены внутрь — точный дубль, занято
  assert.ok(candidatePlacements(bp, resolved, 'roof', 'w1').every(p => p.attach.flip));
});

test('foundation heights: a neighbour foundation can sit at ground, half-wall or wall height (0 / 1.5 / 3 m); R cycles them on the same edge', async () => {
  const { placementAnchor } = await import('./editor.ts');
  const bp = newBlueprint();
  const resolved = resolveBlueprint(bp).resolved;
  const cands = candidatePlacements(bp, resolved, 'square-foundation', 'f1');
  assert.equal(cands.length, 12);
  const east = cands.filter(c => Math.abs(c.transform.position[0] - 3) < 0.01);
  assert.deepEqual(east.map(c => c.transform.position[1]).sort(), [0, 1.5, 3]);
  assert.equal(new Set(east.map(c => placementAnchor('square-foundation', c))).size, 1);
  // от поднятого фундамента — те же три абсолютные высоты, ниже земли нельзя
  const raised = addElement(bp, 'square-foundation', east.find(c => c.transform.position[1] === 3)!.attach);
  const r2 = resolveBlueprint(raised);
  assert.deepEqual(r2.issues.filter(i => i.level === 'error'), []);
  assert.equal(r2.resolved.elements.find(e => e.id === 'f2')!.level, 1);
  const fromRaised = candidatePlacements(raised, r2.resolved, 'square-foundation', 'f2').map(c => c.transform.position[1]);
  assert.ok(fromRaised.every(y => [0, 1.5, 3].includes(y)), fromRaised.join(','));
  // на месте поднятого фундамента нельзя поставить ещё один ни на какой высоте
  assert.ok(candidatePlacements(raised, r2.resolved, 'square-foundation', 'f1').every(c => Math.abs(c.transform.position[0] - 3) > 0.01));
  // недопустимая высота — ошибка
  assert.ok(resolveBlueprint(addElement(bp, 'square-foundation', { to: 'f1', socket: 'edge:0', selfSocket: 'edge:2', rise: -1.5 })).issues.some(i => i.code === 'V12'));
});

test('raid graph: a wall-height foundation is a space at level 1, its walls and floor work as usual', async () => {
  const { buildSpaceGraph, reachableSpaces } = await import('./raid.ts');
  let bp = newBlueprint();
  bp = addElement(bp, 'square-foundation', { to: 'f1', socket: 'edge:0', selfSocket: 'edge:2', rise: 1.5 });
  for (const k of [0, 1, 3]) bp = addElement(bp, 'wall', { to: 'f2', socket: `edge:${k}` as 'edge:0' });
  const r = resolveBlueprint(bp);
  assert.deepEqual(r.issues.filter(i => i.level === 'error'), []);
  const g = buildSpaceGraph(r.resolved);
  assert.ok(g.nodes.has('f2'));
  assert.ok(reachableSpaces(g, new Set()).has('f2'), 'open edge toward f1 and open top');
});

test('roof on a foundation edge: both outward and inward (R toggles), never into a foundation', async () => {
  const { placementAnchor } = await import('./editor.ts');
  let bp = newBlueprint();
  let resolved = resolveBlueprint(bp).resolved;
  const roofs = candidatePlacements(bp, resolved, 'roof', 'f1');
  // 4 ребра × (наружу, внутрь)
  assert.equal(roofs.length, 8);
  const edge0 = roofs.filter(p => p.attach.socket === 'edge:0');
  assert.equal(edge0.length, 2);
  assert.equal(new Set(edge0.map(p => placementAnchor('roof', p))).size, 1);
  const inward = edge0.find(p => p.attach.flip)!;
  assert.deepEqual(inward.transform.position, [0, 0, 0]);
  // низкое ребро внутренней крыши — на ребре фундамента (x = 1.5)
  const r = resolveBlueprint(addElement(bp, 'roof', inward.attach));
  assert.deepEqual(r.issues.filter(i => i.level === 'error'), []);
  // поднятый сосед: крыша наружу в его сторону ушла бы в фундамент — не предлагается
  bp = addElement(bp, 'square-foundation', { to: 'f1', socket: 'edge:0', selfSocket: 'edge:2', rise: 1.5 });
  resolved = resolveBlueprint(bp).resolved;
  const after = candidatePlacements(bp, resolved, 'roof', 'f1').filter(p => p.attach.socket === 'edge:0');
  assert.ok(after.every(p => p.attach.flip), after.map(p => JSON.stringify(p.attach)).join(' '));
  // и наоборот: под стоящую крышу наружу нельзя поднять фундамент
  let bp2 = addElement(newBlueprint(), 'roof', { to: 'f1', socket: 'edge:0', selfSocket: 'edge:0' });
  const r2 = resolveBlueprint(bp2).resolved;
  const f = candidatePlacements(bp2, r2, 'square-foundation', 'f1').filter(p => Math.abs(p.transform.position[0] - 3) < 0.01);
  assert.deepEqual(f.map(p => p.transform.position[1]), [0]);
});

test('aim picks the support edge: on a foundation the inward roof follows the edge the cursor is near', async () => {
  const { aimDistance } = await import('./editor.ts');
  let bp = newBlueprint();
  bp = addElement(bp, 'square-foundation', { to: 'f1', socket: 'edge:0', selfSocket: 'edge:2', rise: 3 });
  const resolved = resolveBlueprint(bp).resolved;
  const cands = candidatePlacements(bp, resolved, 'roof', 'f1');
  const best = (aim: [number, number, number]) => [...cands].sort((a, b) => aimDistance('roof', a, aim) - aimDistance('roof', b, aim))[0];
  // курсор на верху фундамента у каждого из рёбер → внутренняя крыша на этом ребре
  for (const [aim, edge] of [[[1.2, 0, 0], 'edge:0'], [[0, 0, 1.2], 'edge:1'], [[-1.2, 0, 0], 'edge:2'], [[0, 0, -1.2], 'edge:3']] as [[number, number, number], string][]) {
    const p = best(aim);
    assert.equal(p.attach.socket, edge, JSON.stringify(aim));
    if (edge !== 'edge:0') assert.equal(p.attach.flip, true);
  }
  // курсор на земле снаружи у ребра → крыша наружу
  const out = best([0, 0, 2.2]);
  assert.equal(out.attach.socket, 'edge:1');
  assert.ok(!out.attach.flip);
});

test('triangle roofs in a row merge automatically (roof.straight.right): a coplanar inverted filler closes each gap', async () => {
  const { triangleRoofFillers } = await import('./conditional.ts');
  let bp = newBlueprint();
  bp = addElement(bp, 'square-foundation', { to: 'f1', socket: 'edge:1', selfSocket: 'edge:3' });
  bp = addElement(bp, 'square-foundation', { to: 'f2', socket: 'edge:1', selfSocket: 'edge:3' });
  for (const f of ['f1', 'f2', 'f3']) bp = addElement(bp, 'roof-triangle', { to: f, socket: 'edge:0', selfSocket: 'edge:0' });
  const resolved = resolveBlueprint(bp).resolved;
  const fills = triangleRoofFillers(resolved);
  assert.equal(fills.length, 2);
  // вершины вставки: две вершины соседних крыш на высоте 3 и их общий угол основания на высоте 0
  const a = 0.866, C = 1.732;
  const corners = (e: { position: [number, number, number]; rotation: number; inverted?: boolean }) => {
    const ang = e.rotation * Math.PI / 180, base = e.inverted ? 3 : 0, top = e.inverted ? 0 : 3;
    return ([[a, base, -1.5], [a, base, 1.5], [-C, top, 0]] as [number, number, number][]).map(([x, y, z]) =>
      [e.position[0] + x * Math.cos(ang) - z * Math.sin(ang), e.position[1] + y, e.position[2] + x * Math.sin(ang) + z * Math.cos(ang)].map(v => Math.round(v * 100) / 100).join(','));
  };
  const all = new Set(resolved.elements.filter(e => e.kind === 'roof-triangle').flatMap(e => corners(e)));
  for (const f of fills) for (const c of corners(f.el)) assert.ok(all.has(c), `filler vertex ${c} not shared`);
  // разный грейд — не срастаются
  bp.elements.find(e => e.id === 'tr2')!.grade = 'metal';
  assert.equal(triangleRoofFillers(resolveBlueprint(bp).resolved).length, 0);
});
test('removing a middle foundation keeps everything else in place, only unsupported blocks fall', () => {
  let bp = newBlueprint();
  bp = addElement(bp, 'square-foundation', { to: 'f1', socket: 'edge:1', selfSocket: 'edge:3' });
  bp = addElement(bp, 'square-foundation', { to: 'f2', socket: 'edge:1', selfSocket: 'edge:3' });
  bp = addElement(bp, 'wall', { to: 'f3', socket: 'edge:0' });
  bp = addElement(bp, 'wall', { to: 'f2', socket: 'edge:0' });
  const before = resolveBlueprint(bp).resolved;
  const { blueprint, collapsed } = settle(removeElement(bp, 'f2'));
  // f3 и стена на нём стоят; стена на снесённом f2 держится боком на соседней (7%) — ничего не удалено
  assert.deepEqual(blueprint.elements.map(e => e.id).sort(), ['f1', 'f3', 'w1', 'w2']);
  assert.deepEqual(collapsed, []);
  // одиночная стена на снесённом фундаменте падает
  let lone = newBlueprint();
  lone = addElement(lone, 'square-foundation', { to: 'f1', socket: 'edge:1', selfSocket: 'edge:3' });
  lone = addElement(lone, 'wall', { to: 'f2', socket: 'edge:1' });
  assert.deepEqual(settle(removeElement(lone, 'f2')).collapsed, ['w1']);
  const r = resolveBlueprint(blueprint);
  assert.deepEqual(r.issues.filter(i => i.level === 'error'), []);
  for (const id of ['f3', 'w1']) assert.deepEqual(r.resolved.elements.find(e => e.id === id)!.position, before.elements.find(e => e.id === id)!.position);
  // к оставшемуся фундаменту можно строить дальше
  assert.ok(candidatePlacements(blueprint, r.resolved, 'wall', 'f3').length > 0);
});

test('game sockets: ramp on a floor, ramps chain down, spiral stairs stack, nothing on a low wall, frames take no stairs', () => {
  let bp = newBlueprint();
  bp = addElement(bp, 'wall', { to: 'f1', socket: 'edge:0' });
  bp = addElement(bp, 'square-floor', { to: bp.elements[1].id, socket: 'top', selfSocket: 'edge:0' });
  const floorId = bp.elements[2].id;
  let resolved = resolveBlueprint(bp).resolved;
  const onFloor = candidatePlacements(bp, resolved, 'ramp', floorId).filter(p => p.attach.socket === 'top');
  assert.equal(onFloor.length, 8);
  const floorY = resolved.elements.find(e => e.id === floorId)!.position[1];
  const heights = [...new Set(onFloor.map(p => Math.round((p.transform.position[1] - floorY) * 100) / 100))].sort();
  assert.deepEqual(heights, [0.75, 1.5]);

  bp = addElement(bp, 'ramp', { to: 'f1', socket: 'edge:2', selfSocket: 'edge:0' });
  const rampId = bp.elements[3].id;
  resolved = resolveBlueprint(bp).resolved;
  const chain = candidatePlacements(bp, resolved, 'ramp', rampId);
  assert.equal(chain.length, 1);
  assert.equal(chain[0].attach.socket, 'edge:2');

  bp = addElement(bp, 'spiral-stairs', { to: 'f1', socket: 'top' });
  const spiralId = bp.elements[4].id;
  resolved = resolveBlueprint(bp).resolved;
  const up = candidatePlacements(bp, resolved, 'spiral-stairs', spiralId);
  assert.ok(up.length > 0 && up.every(p => p.attach.socket === 'top'));

  let low = newBlueprint();
  low = addElement(low, 'low-wall', { to: 'f1', socket: 'edge:0' });
  const lowRes = resolveBlueprint(low).resolved;
  for (const k of ['wall', 'square-floor', 'roof'] as const) assert.equal(candidatePlacements(low, lowRes, k, low.elements[1].id).length, 0);

  let frame = newBlueprint();
  frame = addElement(frame, 'wall', { to: 'f1', socket: 'edge:0' });
  frame = addElement(frame, 'floor-frame', { to: frame.elements[1].id, socket: 'top', selfSocket: 'edge:0' });
  const frameRes = resolveBlueprint(frame).resolved;
  assert.equal(candidatePlacements(frame, frameRes, 'stairs-l-shape', frame.elements[2].id).length, 0);
  assert.equal(candidatePlacements(frame, frameRes, 'ramp', frame.elements[2].id).length, 0);
});

test('game sockets: the high edge of a roof takes a wall, a floor and another roof', () => {
  let bp = newBlueprint();
  bp = addElement(bp, 'wall', { to: 'f1', socket: 'edge:0' });
  bp = addElement(bp, 'roof', { to: bp.elements[1].id, socket: 'top', selfSocket: 'edge:0' });
  const roofId = bp.elements[2].id;
  const resolved = resolveBlueprint(bp).resolved;
  const roof = resolved.elements.find(e => e.id === roofId)!;
  for (const k of ['wall', 'square-floor', 'roof'] as const) {
    const c = candidatePlacements(bp, resolved, k, roofId).filter(p => p.attach.socket === 'edge:2');
    assert.ok(c.length > 0, k);
    assert.ok(c.every(p => Math.abs(p.transform.position[1] - (roof.position[1] + 3)) < 1e-6), k);
  }
});

test('any block can be removed, the first foundation too: what stood only on it falls', () => {
  const single = removeElement(newBlueprint(), 'f1');
  assert.equal(single.elements.length, 0);
  assert.equal(single.deployables!.length, 0);
  let bp = newBlueprint();
  bp = addElement(bp, 'wall', { to: 'f1', socket: 'edge:0' });
  assert.equal(settle(removeElement(bp, 'f1')).blueprint.elements.length, 0);
});

test('removing the first foundation of a house leaves every other block where it was', () => {
  const { bp } = load('house-2x2');
  const before = resolveBlueprint(bp).resolved;
  const after = removeElement(bp, 'f1');
  const r = resolveBlueprint(after);
  assert.deepEqual(r.issues.filter(i => i.level === 'error'), []);
  assert.ok(!after.elements.some(e => e.id === 'f1'));
  for (const e of r.resolved.elements) {
    const was = before.elements.find(b => b.id === e.id)!;
    assert.ok(was.position.every((v, i) => Math.abs(v - e.position[i]) < 1e-3), e.id);
  }
});

test('a spiral stair stacked on a spiral stair continues the spiral: the first offer is turned by half a turn', () => {
  let bp = newBlueprint();
  bp = addElement(bp, 'spiral-stairs', { to: 'f1', socket: 'top' });
  const resolved = resolveBlueprint(bp).resolved;
  const up = candidatePlacements(bp, resolved, 'spiral-stairs', 'ss1');
  assert.equal(up[0].attach.turns, 2);
  assert.equal(up.length, 4);
});

test('hammer rotate: a wall turns by 180 degrees in place, stairs by 90, a foundation does not turn', () => {
  let bp = newBlueprint();
  bp = addElement(bp, 'wall', { to: 'f1', socket: 'edge:0' });
  bp = addElement(bp, 'u-shaped-stairs', { to: 'f1', socket: 'top' });
  const before = resolveBlueprint(bp).resolved;
  const turned = rotateElement(bp, 'w1');
  const after = resolveBlueprint(turned);
  assert.deepEqual(after.issues.filter(i => i.level === 'error'), []);
  const w0 = before.elements.find(e => e.id === 'w1')!;
  const w1 = after.resolved.elements.find(e => e.id === 'w1')!;
  assert.ok(w0.position.every((v, i) => Math.abs(v - w1.position[i]) < 1e-6));
  assert.equal((((w1.rotation - w0.rotation) % 360) + 360) % 360, 180);
  const s0 = before.elements.find(e => e.id === 'us1')!;
  const s1 = resolveBlueprint(rotateElement(bp, 'us1')).resolved.elements.find(e => e.id === 'us1')!;
  assert.equal((((s1.rotation - s0.rotation) % 360) + 360) % 360 % 180, 90);
  assert.equal(rotateElement(bp, 'f1'), bp);
});

test('a tool cupboard stays clear of the cell edges and the wall thickness: aimed at a corner it slides inward, on stairs it does not go', () => {
  let bp = newBlueprint('t', 'triangle-foundation');
  let resolved = resolveBlueprint(bp).resolved;
  const p = deployPlacement(bp, resolved, 'tool-cupboard', 'f1', [1.7, 0, 0])!;
  assert.ok(p, 'fits into a triangle');
  const [x, z] = p.deployable.offset!;
  assert.ok(Math.hypot(x, z) < 0.5, `${x},${z}`);
  bp = newBlueprint();
  resolved = resolveBlueprint(bp).resolved;
  const q = deployPlacement(bp, resolved, 'tool-cupboard', 'f1', [1.5, 0, 1.5])!;
  assert.ok(q.deployable.offset![0] <= 1.5 - 0.3 - 0.13 + 1e-6 && q.deployable.offset![1] <= 1.5 - 0.55 - 0.13 + 1e-6, q.deployable.offset!.join(','));
  bp = addElement(bp, 'u-shaped-stairs', { to: 'f1', socket: 'top' });
  assert.equal(deployPlacement(bp, resolveBlueprint(bp).resolved, 'tool-cupboard', 'f1', [0, 0, 0]), null);
});

test('a ramp on an upper floor: low and high variants share one anchor, so R switches the height in place', async () => {
  const { placementAnchor } = await import('./editor.ts');
  let bp = newBlueprint();
  bp = addElement(bp, 'wall', { to: 'f1', socket: 'edge:0' });
  bp = addElement(bp, 'square-floor', { to: 'w1', socket: 'top', selfSocket: 'edge:0' });
  const resolved = resolveBlueprint(bp).resolved;
  const onTop = candidatePlacements(bp, resolved, 'ramp', 'c1').filter(p => p.attach.socket === 'top');
  assert.equal(onTop.length, 8);
  const anchors = new Map<string, number[]>();
  for (const p of onTop) anchors.set(placementAnchor('ramp', p), [...(anchors.get(placementAnchor('ramp', p)) ?? []), p.attach.rise ?? 0]);
  assert.equal(anchors.size, 4);
  for (const rises of anchors.values()) assert.deepEqual(rises.sort(), [0, 0.75]);
});

test('a ramp does not hang in the air: on a floor it falls with the floor, by a raised foundation it rests on its edge, at the ground it stands', async () => {
  const { computeStability } = await import('./stability.ts');
  let bp = newBlueprint();
  bp = addElement(bp, 'wall', { to: 'f1', socket: 'edge:0' });
  bp = addElement(bp, 'square-floor', { to: 'w1', socket: 'top', selfSocket: 'edge:0' });
  bp = addElement(bp, 'ramp', { to: 'c1', socket: 'top' });
  const { blueprint, collapsed } = settle(removeElement(bp, 'w1'));
  assert.deepEqual(collapsed.sort(), ['c1', 'rp1']);
  assert.deepEqual(blueprint.elements.map(e => e.id), ['f1']);
  let raised = newBlueprint();
  raised = addElement(raised, 'square-foundation', { to: 'f1', socket: 'edge:0', selfSocket: 'edge:2', rise: 1.5 });
  raised = addElement(raised, 'ramp', { to: 'f2', socket: 'edge:0', selfSocket: 'edge:0' });
  raised = addElement(raised, 'ramp', { to: 'rp1', socket: 'edge:2' });
  const st = computeStability(resolveBlueprint(raised).resolved);
  assert.ok(st.get('rp1')! > 0.05 && st.get('rp1')! < 1, String(st.get('rp1')));
  assert.equal(st.get('rp2'), 1);
});

test('a foundation can stand anywhere on free ground at any angle, but not into another block', () => {
  const bp = newBlueprint();
  const resolved = resolveBlueprint(bp).resolved;
  const free = freePlacement(resolved, 'square-foundation', [7.3, 0, -4.1], 33);
  assert.ok(free);
  const r = resolveBlueprint(addElementAt(bp, 'square-foundation', free!));
  assert.deepEqual(r.issues.filter(i => i.level === 'error'), []);
  assert.deepEqual(r.resolved.elements[1].position, [7.3, 0, -4.1]);
  assert.equal(freePlacement(resolved, 'square-foundation', [1.2, 0, 0.4], 10), null);
  const first = newBlueprint('x', 'triangle-foundation', [-5, 0, 2], 400);
  assert.deepEqual(first.elements[0].position, [-5, 0, 2]);
  assert.equal(first.elements[0].rotation, 40);
});

test('a foundation keeps any top height from 0 to 3 m, and a neighbour snaps 1.5 m up or down from it', () => {
  const bp = newBlueprint('f', 'square-foundation', [0, 0.8, 0], 0);
  assert.deepEqual(resolveBlueprint(bp).issues, []);
  const heights = [...new Set(candidatePlacements(bp, resolveBlueprint(bp).resolved, 'square-foundation', 'f1').map(c => c.transform.position[1]))].sort();
  assert.deepEqual(heights, [0.8, 2.3]);
  assert.ok(resolveBlueprint(newBlueprint('f', 'square-foundation', [0, 3.2, 0], 0)).issues.some(i => i.code === 'V12'));
  assert.deepEqual(resolveBlueprint(newBlueprint('f', 'square-foundation', [0, 2.65, 0], 0)).issues, []);
});

test('triangle spiral stairs go only on a triangle cell, in three turns, and stack on themselves', () => {
  const tri = newBlueprint('t', 'triangle-foundation', [0, 0, 0], 0);
  const r = resolveBlueprint(tri).resolved;
  const on = candidatePlacements(tri, r, 'spiral-stairs-triangle', 'f1');
  assert.deepEqual(on.map(c => c.transform.rotation).sort((a, b) => a - b), [0, 120, 240]);
  const sq = newBlueprint('s', 'square-foundation', [0, 0, 0], 0);
  assert.equal(candidatePlacements(sq, resolveBlueprint(sq).resolved, 'spiral-stairs-triangle', 'f1').length, 0);
  assert.ok(!candidatePlacements(tri, r, 'spiral-stairs', 'f1').length);
  const built = addElement(tri, 'spiral-stairs-triangle', on[0].attach);
  const rb = resolveBlueprint(built);
  assert.deepEqual(rb.issues.filter(i => i.level === 'error'), []);
  const id = built.elements[1].id;
  const up = candidatePlacements(built, rb.resolved, 'spiral-stairs-triangle', id);
  assert.ok(up.some(c => Math.abs(c.transform.position[1] - 1.5) < 1e-6));
});
