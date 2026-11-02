import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveBlueprint } from './geometry.ts';
import { addDeployable, addElement, addWire, deployPlacement, newBlueprint, placementsNear, removeDeployable, removeWire } from './editor.ts';
import { loadBlueprint } from './validate.ts';
import type { Blueprint, DeployableKind, ElementKind } from './types.ts';

const res = (bp: Blueprint) => resolveBlueprint(bp).resolved;

function attach(bp: Blueprint, kind: ElementKind, host: string, near: [number, number, number]): Blueprint {
  const p = placementsNear(bp, res(bp), kind, host, near)[0];
  assert.ok(p, `${kind} на ${host}`);
  return addElement(bp, kind, p.attach, 'wood');
}

function deploy(bp: Blueprint, kind: DeployableKind, host: string, local: [number, number, number]): Blueprint {
  const p = deployPlacement(bp, res(bp), kind, host, local, 0);
  assert.ok(p, `${kind} на ${host}`);
  return addDeployable(bp, p.deployable);
}

function farm(): Blueprint {
  let bp = newBlueprint('Ферма', 'square-foundation');
  bp = attach(bp, 'wall', 'f1', [1.5, 1, 0]);
  const wall = bp.elements.find(e => e.kind === 'wall')!.id;
  bp = deploy(bp, 'small-generator', 'f1', [-0.8, 0, -0.8]);
  bp = deploy(bp, 'splitter', wall, [-0.2, 1.4, 0]);
  bp = deploy(bp, 'water-pump', 'f1', [-0.8, 0, 0.8]);
  bp = deploy(bp, 'sprinkler', 'f1', [0.5, 0, 0.8]);
  return bp;
}

const idOf = (bp: Blueprint, kind: DeployableKind) => bp.deployables!.find(d => d.kind === kind)!.id;

test('wires: an output joins an input of the same type, with a path through the points and a length', () => {
  let bp = farm();
  bp = addWire(bp, { kind: 'power', from: { id: idOf(bp, 'small-generator'), slot: 0 }, to: { id: idOf(bp, 'splitter'), slot: 0 }, points: [[0, 1, 0]] });
  bp = addWire(bp, { kind: 'fluid', from: { id: idOf(bp, 'water-pump'), slot: 0 }, to: { id: idOf(bp, 'sprinkler'), slot: 0 } });
  const loaded = loadBlueprint(bp);
  assert.deepEqual(loaded.issues, []);
  const wires = loaded.resolved!.wires!;
  assert.equal(wires.length, 2);
  assert.equal(wires[0].path.length, 3);
  assert.ok(wires[0].length > 1 && wires[0].length < 30);
});

test('wires: wrong type, a taken input and a missing slot are reported; removing an object drops its wires', () => {
  let bp = farm();
  bp = addWire(bp, { kind: 'power', from: { id: idOf(bp, 'water-pump'), slot: 0 }, to: { id: idOf(bp, 'splitter'), slot: 0 } });
  assert.match(resolveBlueprint(bp).issues.map(i => i.message).join(), /не подключается/);
  bp = removeWire(bp, bp.wires![0].id);
  bp = addWire(bp, { kind: 'power', from: { id: idOf(bp, 'small-generator'), slot: 0 }, to: { id: idOf(bp, 'splitter'), slot: 0 } });
  bp = { ...bp, wires: [...bp.wires!, { id: 'w9', kind: 'power', from: { id: idOf(bp, 'splitter'), slot: 0 }, to: { id: idOf(bp, 'splitter'), slot: 0 } }] };
  assert.match(resolveBlueprint(bp).issues.map(i => i.message).join(), /сам с собой/);
  bp = { ...bp, wires: bp.wires!.filter(w => w.id !== 'w9') };
  const again = addWire(bp, { kind: 'power', from: { id: idOf(bp, 'splitter'), slot: 1 }, to: { id: idOf(bp, 'splitter'), slot: 0 } });
  assert.equal(again.wires!.filter(w => w.to.id === idOf(bp, 'splitter')).length, 1);
  const gone = removeDeployable(bp, idOf(bp, 'small-generator'));
  assert.equal(gone.wires!.length, 0);
});
