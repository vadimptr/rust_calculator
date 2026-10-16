import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveBlueprint } from './geometry.ts';
import { addDeployable, addElement, candidatePlacements, deployPlacement, newBlueprint, placementsNear, removeElement, upgradeElement } from './editor.ts';
import type { Blueprint } from './types.ts';

function load(name: string) {
  const bp = JSON.parse(readFileSync(new URL(`../../docs/blueprint/examples/${name}.json`, import.meta.url), 'utf8')) as Blueprint;
  return { bp, resolved: resolveBlueprint(bp).resolved };
}

test('new blueprint: one twig foundation; walls snap to its four edges, nearest to the cursor first', () => {
  const bp = newBlueprint();
  const resolved = resolveBlueprint(bp).resolved;
  const walls = candidatePlacements(bp, resolved, 'wall', 'f1');
  assert.equal(walls.length, 4);
  const near = placementsNear(bp, resolved, 'wall', 'f1', [1.4, 1, 0.2]);
  assert.deepEqual(near[0].attach, { to: 'f1', socket: 'edge:0' });
  // соседний фундамент — тоже четыре варианта, съезд — четыре, лестница на top — четыре поворота
  assert.equal(candidatePlacements(bp, resolved, 'triangle-foundation', 'f1').length, 4);
  assert.equal(candidatePlacements(bp, resolved, 'ramp', 'f1').length, 4);
  assert.equal(candidatePlacements(bp, resolved, 'stairs-l-shape', 'f1').length, 4);
  // пол на фундамент ребром к ребру нельзя (фундамент к фундаменту, пол к полу)
  assert.equal(candidatePlacements(bp, resolved, 'square-floor', 'f1').length, 0);
});

test('placing a wall occupies the edge: the next wall has three options; floors on a wall top come on both sides', () => {
  let bp = newBlueprint();
  let resolved = resolveBlueprint(bp).resolved;
  const w = placementsNear(bp, resolved, 'wall', 'f1', [1.5, 1, 0])[0];
  bp = addElement(bp, 'wall', w.attach, 'stone');
  resolved = resolveBlueprint(bp).resolved;
  assert.equal(candidatePlacements(bp, resolved, 'wall', 'f1').length, 3);
  assert.equal(bp.elements[1].id, 'w1');
  assert.equal(bp.elements[1].grade, 'stone');
  const floors = candidatePlacements(bp, resolved, 'square-floor', 'w1');
  assert.equal(floors.length, 2);
  const xs = floors.map(f => f.transform.position[0]).sort((a, b) => a - b);
  assert.ok(xs[0] < 0.1 && xs[1] > 2.9, xs.join(','));
  assert.ok(floors.every(f => f.transform.position[1] === 3));
});

test('removing a wall re-attaches the floor to another wall under it; removing the last support drops the floor too', () => {
  const { bp } = load('sealed-triangle-tc');
  // c1 висит на w1; после сноса w1 он должен перецепиться к w2 или w3 и остаться на месте
  const after = removeElement(bp, 'w1');
  const c1 = after.elements.find(e => e.id === 'c1')!;
  assert.ok(c1, 'ceiling kept');
  assert.ok(['w2', 'w3'].includes(c1.attach!.to), c1.attach!.to);
  const pos = resolveBlueprint(after).resolved.elements.find(e => e.id === 'c1')!.position;
  assert.deepEqual(pos, [0, 3, 0]);
  // сносим и остальные стены — потолок падает
  const bare = removeElement(removeElement(after, 'w2'), 'w3');
  assert.ok(!bare.elements.some(e => e.id === 'c1'));
  assert.deepEqual(resolveBlueprint(bare).issues.filter(i => i.level === 'error'), []);
  // корень снести нельзя
  assert.equal(removeElement(bp, 'f1'), bp);
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
  assert.deepEqual(tc.deployable.offset, [-0.9, 0.9]);
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
  assert.equal(candidatePlacements(bp, r.resolved, 'square-foundation', 'f1').length, 2);
});

test('removing a foundation keeps a doorway on the shared edge: it re-attaches to the other cell, door and floor stay in place', () => {
  let bp = newBlueprint();
  bp = addElement(bp, 'square-foundation', { to: 'f1', socket: 'edge:0', selfSocket: 'edge:2' });
  bp = addElement(bp, 'doorway', { to: 'f2', socket: 'edge:2' });
  bp = addElement(bp, 'wall', { to: 'f2', socket: 'edge:1' });
  bp = addElement(bp, 'square-floor', { to: 'dw1', socket: 'top', selfSocket: 'edge:0' });
  bp = addElement(bp, 'wall', { to: 'dw1', socket: 'top' });
  bp = addDeployable(bp, { kind: 'wooden-door', attach: { to: 'dw1', socket: 'opening' }, hinge: 'left', opens: 'outward' });
  bp = addDeployable(bp, { kind: 'drop-box', attach: { to: 'w2', socket: 'face' }, offset: [0.8, 1.3], direction: 'out' });
  const before = resolveBlueprint(bp).resolved;
  const after = removeElement(bp, 'f2');
  const r = resolveBlueprint(after);
  assert.deepEqual(r.issues.filter(i => i.level === 'error'), []);
  // w1 стояла только на f2 — падает; проём, пол над ним и стена над проёмом остаются
  assert.deepEqual(after.elements.map(e => e.id).sort(), ['c1', 'dw1', 'f1', 'w2']);
  assert.equal(after.elements.find(e => e.id === 'dw1')!.attach!.to, 'f1');
  for (const id of ['dw1', 'c1', 'w2']) {
    const a = before.elements.find(e => e.id === id)!, b = r.resolved.elements.find(e => e.id === id)!;
    assert.deepEqual(b.position, a.position, id);
  }
  // пол: та же плита, тот же поворот; проём и стена над ним развёрнуты на 180°
  assert.equal(r.resolved.elements.find(e => e.id === 'c1')!.rotation, before.elements.find(e => e.id === 'c1')!.rotation);
  assert.equal((r.resolved.elements.find(e => e.id === 'dw1')!.rotation + 180) % 360, before.elements.find(e => e.id === 'dw1')!.rotation);
  // дверь на месте, петли и открывание компенсированы (в мире открывается в ту же сторону)
  const door = after.deployables!.find(d => d.id === 'd1')!;
  assert.equal(door.hinge, 'right');
  assert.equal(door.opens, 'inward');
  const box = after.deployables!.find(d => d.id === 'box1')!;
  assert.equal(box.direction, 'in');
  assert.deepEqual(box.offset, [-0.8, 1.3]);
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
  assert.ok(resolveBlueprint(addElement(bp, 'square-foundation', { to: 'w1', socket: 'top', selfSocket: 'edge:0' })).issues.some(i => i.code === 'V04'));
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
  assert.equal(candidatePlacements(bp, resolved, 'roof', 'r1').length, 0);
  // появился соседний фундамент со стеной на той же линии — боковая крыша получает опору
  bp = addElement(bp, 'square-foundation', { to: 'f1', socket: 'edge:1', selfSocket: 'edge:3' });
  bp = addElement(bp, 'wall', { to: 'f2', socket: 'edge:0' });
  resolved = resolveBlueprint(bp).resolved;
  const beside = candidatePlacements(bp, resolved, 'roof', 'r1');
  assert.equal(beside.length, 1);
  // крыша низким ребром на ребро фундамента (съезд-крыша) опирается на само ребро
  assert.equal(candidatePlacements(bp, resolved, 'roof', 'f2').length, 3);
});
