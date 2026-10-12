import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveBlueprint } from './geometry.ts';
import type { Blueprint } from './types.ts';

function near(actual: number[], expected: number[], eps = 0.002) {
  assert.equal(actual.length, expected.length);
  actual.forEach((v, i) => assert.ok(Math.abs(v - expected[i]) < eps, `index ${i}: ${v} vs ${expected[i]}`));
}

function angleEq(a: number, b: number) {
  const d = (((a - b) % 360) + 540) % 360 - 180;
  assert.ok(Math.abs(d) < 0.01, `${a} vs ${b}`);
}

const sealedTriangle: Blueprint = {
  formatVersion: '1.0',
  meta: { name: 'tri' },
  defaults: { grade: 'stone' },
  elements: [
    { id: 'f1', kind: 'triangle-foundation', root: true },
    { id: 'w1', kind: 'wall', attach: { to: 'f1', socket: 'edge:0' } },
    { id: 'w2', kind: 'wall', attach: { to: 'f1', socket: 'edge:1' } },
    { id: 'w3', kind: 'wall', attach: { to: 'f1', socket: 'edge:2' } },
    { id: 'c1', kind: 'triangle-floor', attach: { to: 'w1', socket: 'top', selfSocket: 'edge:0' } },
  ],
  deployables: [
    { id: 'tc1', kind: 'tool-cupboard', attach: { to: 'f1', socket: 'top' }, offset: [0, 0], rotation: 0 },
  ],
};

test('sealed triangle: positions match SPEC §10.1', () => {
  const { resolved, issues } = resolveBlueprint(sealedTriangle);
  assert.deepEqual(issues.filter(i => i.level === 'error'), []);
  const by = Object.fromEntries(resolved.elements.map(e => [e.id, e]));
  near(by.f1.position, [0, 0, 0]);
  near(by.w1.position, [0.866, 0, 0]); angleEq(by.w1.rotation, 0);
  near(by.w2.position, [-0.433, 0, 0.75]); angleEq(by.w2.rotation, 120);
  near(by.w3.position, [-0.433, 0, -0.75]); angleEq(by.w3.rotation, 240);
  near(by.c1.position, [0, 3, 0]); angleEq(by.c1.rotation, 0);
  assert.equal(by.c1.level, 1);
  assert.equal(by.w1.grade, 'stone');
  near(resolved.deployables[0].position, [0, 0, 0]);
});

const starter: Blueprint = {
  formatVersion: '1.0',
  meta: { name: '2x1' },
  defaults: { grade: 'stone' },
  elements: [
    { id: 'f1', kind: 'square-foundation', root: true },
    { id: 'f2', kind: 'square-foundation', attach: { to: 'f1', socket: 'edge:0', selfSocket: 'edge:2' } },
    { id: 'd1', kind: 'doorway', grade: 'metal', attach: { to: 'f1', socket: 'edge:2' } },
    { id: 'w1', kind: 'wall', attach: { to: 'f1', socket: 'edge:1' } },
    { id: 'c1', kind: 'square-floor', attach: { to: 'w1', socket: 'top', selfSocket: 'edge:1' } },
    { id: 'c2', kind: 'square-floor', attach: { to: 'c1', socket: 'edge:0', selfSocket: 'edge:2' } },
    { id: 'cf', kind: 'square-floor', attach: { to: 'w1', socket: 'top', selfSocket: 'edge:1', flip: true } },
    { id: 's1', kind: 'stairs-l-shape', attach: { to: 'f2', socket: 'top', turns: 1 } },
  ],
  deployables: [
    { id: 'door1', kind: 'sheet-metal-door', attach: { to: 'd1', socket: 'opening' }, hinge: 'right' },
    { id: 'tc1', kind: 'tool-cupboard', attach: { to: 'f2', socket: 'top' }, offset: [0.8, 0.8], rotation: 225 },
  ],
};

test('starter 2x1: edge-to-edge, wall top, flip, stairs, deployables', () => {
  const { resolved, issues } = resolveBlueprint(starter);
  assert.deepEqual(issues.filter(i => i.level === 'error'), []);
  const by = Object.fromEntries(resolved.elements.map(e => [e.id, e]));
  near(by.f2.position, [3, 0, 0]); angleEq(by.f2.rotation, 0);
  near(by.d1.position, [-1.5, 0, 0]); angleEq(by.d1.rotation, 180);
  assert.equal(by.d1.grade, 'metal');
  near(by.w1.position, [0, 0, 1.5]); angleEq(by.w1.rotation, 90);
  near(by.c1.position, [0, 3, 0]); angleEq(by.c1.rotation, 0);
  near(by.c2.position, [3, 3, 0]);
  near(by.cf.position, [0, 3, 3]); angleEq(by.cf.rotation, 180);
  near(by.s1.position, [3, 0, 0]); angleEq(by.s1.rotation, 90);

  const dep = Object.fromEntries(resolved.deployables.map(d => [d.id, d]));
  near(dep.door1.position, [-1.5, 0, 0]); angleEq(dep.door1.rotation, 180);
  assert.equal(dep.door1.hinge, 'right');
  near(dep.tc1.position, [3.8, 0, 0.8]); angleEq(dep.tc1.rotation, 225);
});

test('rotated chain: wall on a foundation attached at a rotated edge', () => {
  const bp: Blueprint = {
    formatVersion: '1.0', meta: { name: 'rot' },
    elements: [
      { id: 'f1', kind: 'square-foundation', root: true },
      { id: 'f2', kind: 'square-foundation', attach: { to: 'f1', socket: 'edge:1', selfSocket: 'edge:0' } },
      { id: 'w', kind: 'wall', attach: { to: 'f2', socket: 'edge:0' } },
    ],
  };
  const { resolved } = resolveBlueprint(bp);
  const by = Object.fromEntries(resolved.elements.map(e => [e.id, e]));
  near(by.f2.position, [0, 0, 3]); angleEq(by.f2.rotation, 270);
  // f2.edge:0 points along rot 270 → towards -z, i.e. back towards f1
  near(by.w.position, [0, 0, 1.5]); angleEq(by.w.rotation, 270);
  assert.equal(by.w.grade, 'twig');
});

test('structural errors: duplicate id, missing root, bad socket, incompatible, cycle', () => {
  const codes = (bp: Blueprint) => resolveBlueprint(bp).issues.map(i => i.code);

  assert.ok(codes({ formatVersion: '1.0', meta: { name: 'x' }, elements: [
    { id: 'f1', kind: 'square-foundation', root: true },
    { id: 'f1', kind: 'wall', attach: { to: 'f1', socket: 'edge:0' } },
  ] }).includes('V01'));

  assert.ok(codes({ formatVersion: '1.0', meta: { name: 'x' }, elements: [
    { id: 'w', kind: 'wall', attach: { to: 'w', socket: 'top' } },
  ] }).includes('V02'));

  assert.ok(codes({ formatVersion: '1.0', meta: { name: 'x' }, elements: [
    { id: 'f1', kind: 'square-foundation', root: true },
    { id: 'w', kind: 'wall', attach: { to: 'f1', socket: 'opening' } },
  ] }).includes('V03'));

  assert.ok(codes({ formatVersion: '1.0', meta: { name: 'x' }, elements: [
    { id: 'f1', kind: 'square-foundation', root: true },
    { id: 's', kind: 'stairs-l-shape', attach: { to: 'f1', socket: 'edge:0' } },
  ] }).includes('V04'));

  assert.ok(codes({ formatVersion: '1.0', meta: { name: 'x' }, elements: [
    { id: 'f1', kind: 'square-foundation', root: true },
    { id: 'w1', kind: 'wall', attach: { to: 'f1', socket: 'edge:0' } },
    { id: 'w2', kind: 'wall', attach: { to: 'f1', socket: 'edge:0' } },
  ] }).includes('V05'));

  assert.ok(codes({ formatVersion: '1.0', meta: { name: 'x' }, elements: [
    { id: 'f1', kind: 'square-foundation', root: true },
    { id: 'a', kind: 'square-floor', attach: { to: 'b', socket: 'edge:0', selfSocket: 'edge:2' } },
    { id: 'b', kind: 'square-floor', attach: { to: 'a', socket: 'edge:0', selfSocket: 'edge:2' } },
  ] }).includes('V02'));
});

test('deployable errors: door in wrong opening, second door, tc on wall', () => {
  const base: Blueprint['elements'] = [
    { id: 'f1', kind: 'square-foundation', root: true },
    { id: 'd1', kind: 'doorway', attach: { to: 'f1', socket: 'edge:0' } },
  ];
  const codes = (deps: Blueprint['deployables']) =>
    resolveBlueprint({ formatVersion: '1.0', meta: { name: 'x' }, elements: base, deployables: deps }).issues.map(i => i.code);

  assert.ok(codes([{ id: 'g', kind: 'garage-door', attach: { to: 'd1', socket: 'opening' } }]).includes('V11'));
  assert.ok(codes([
    { id: 'a', kind: 'wooden-door', attach: { to: 'd1', socket: 'opening' } },
    { id: 'b', kind: 'wooden-door', attach: { to: 'd1', socket: 'opening' } },
  ]).includes('V11'));
  assert.ok(codes([{ id: 't', kind: 'tool-cupboard', attach: { to: 'd1', socket: 'top' } }]).includes('V04'));
  assert.ok(codes([{ id: 'g', kind: 'strengthened-glass-window', attach: { to: 'd1', socket: 'opening' } }]).includes('V11'));
});

test('window insert fits a window frame only', () => {
  const bp: Blueprint = { formatVersion: '1.0', meta: { name: 'x' }, elements: [
    { id: 'f1', kind: 'square-foundation', root: true },
    { id: 'win', kind: 'window-frame', attach: { to: 'f1', socket: 'edge:0' } },
  ], deployables: [{ id: 'g', kind: 'metal-window-bars', attach: { to: 'win', socket: 'opening' } }] };
  const { resolved, issues } = resolveBlueprint(bp);
  assert.deepEqual(issues.filter(i => i.level === 'error'), []);
  assert.equal(resolved.deployables[0].parent, 'win');
  const bad = resolveBlueprint({ ...bp, deployables: [{ id: 'd', kind: 'wooden-door', attach: { to: 'win', socket: 'opening' } }] });
  assert.ok(bad.issues.some(i => i.code === 'V11'));
});

test('drop-box: placed on a wall face with along/height offset, direction kept; rejected on openings and low walls', () => {
  const bp: Blueprint = { formatVersion: '1.0', meta: { name: 'x' }, elements: [
    { id: 'f1', kind: 'square-foundation', root: true },
    { id: 'w', kind: 'wall', attach: { to: 'f1', socket: 'edge:1' } },
    { id: 'd', kind: 'doorway', attach: { to: 'f1', socket: 'edge:0' } },
    { id: 'lw', kind: 'low-wall', attach: { to: 'f1', socket: 'edge:2' } },
  ], deployables: [
    { id: 'out', kind: 'drop-box', attach: { to: 'w', socket: 'face' }, offset: [-0.8, 1.3], direction: 'out' },
    { id: 'in', kind: 'drop-box', attach: { to: 'w', socket: 'face' }, offset: [0.8, 1.3], direction: 'in' },
  ] };
  const { resolved, issues } = resolveBlueprint(bp);
  assert.deepEqual(issues.filter(i => i.level === 'error'), []);
  const out = resolved.deployables.find(d => d.id === 'out')!;
  // стена на edge:1: позиция (0,0,1.5), поворот 90, вдоль стены — ось −x
  near(out.position, [0.8, 1.3, 1.5]); angleEq(out.rotation, 90);
  assert.equal(out.direction, 'out');
  const bad1 = resolveBlueprint({ ...bp, deployables: [{ id: 'b', kind: 'drop-box', attach: { to: 'd', socket: 'face' }, direction: 'in' }] });
  assert.ok(bad1.issues.some(i => i.code === 'V04'));
  const bad2 = resolveBlueprint({ ...bp, deployables: [{ id: 'b', kind: 'drop-box', attach: { to: 'lw', socket: 'face' }, direction: 'in' }] });
  assert.ok(bad2.issues.some(i => i.code === 'V04'));
});
