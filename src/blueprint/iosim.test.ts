import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveWires } from './io.ts';
import { simulate, windOutput } from './iosim.ts';
import type { DeployableKind, Resolved, ResolvedDeployable, Wire } from './types.ts';

const dev = (id: string, kind: DeployableKind, x = 0, y = 0, z = 0): ResolvedDeployable => ({ id, kind, parent: 'f1', hinge: 'left', opens: 'outward', open: false, position: [x, y, z], rotation: 0, level: 0 });
let n = 0;
const wire = (kind: 'power' | 'fluid', from: string, fs: number, to: string, ts: number): Wire => ({ id: `w${++n}`, kind, from: { id: from, slot: fs }, to: { id: to, slot: ts } });
function scene(deployables: ResolvedDeployable[], wires: Wire[]): Resolved {
  const issues: { level: string; message: string }[] = [];
  const r = resolveWires(wires, deployables, issues as never);
  assert.deepEqual(issues, []);
  return { elements: [], deployables, wires: r };
}

test('power: a splitter shares 40 as 14/13/13, lights take their need, the generator reports what is used', () => {
  const s = simulate(scene(
    [dev('g', 'small-generator'), dev('sp', 'splitter', 1), dev('l1', 'ceiling-light', 2), dev('l2', 'ceiling-light', 3), dev('l3', 'simple-light', 4)],
    [wire('power', 'g', 0, 'sp', 0), wire('power', 'sp', 0, 'l1', 0), wire('power', 'sp', 1, 'l2', 0), wire('power', 'sp', 2, 'l3', 0)],
  ));
  assert.deepEqual(s.devices.get('sp')!.outputs, [14, 13, 13]);
  assert.equal(s.devices.get('l1')!.powered, true);
  assert.deepEqual(s.sources.map(x => [x.id, x.max, x.used]), [['g', 40, 5]]);
});

test('power: a branch sends 2 to the branch and the rest on; a light passes input minus its need; too little power leaves it off', () => {
  const s = simulate(scene(
    [dev('p', 'large-solar-panel'), dev('b', 'branch', 1), dev('l1', 'ceiling-light', 2), dev('t', 'auto-turret', 3)],
    [wire('power', 'p', 0, 'b', 0), wire('power', 'b', 1, 'l1', 0), wire('power', 'b', 0, 't', 0)],
  ));
  assert.deepEqual(s.devices.get('b')!.outputs, [18, 2]);
  assert.equal(s.devices.get('l1')!.powered, true);
  assert.equal(s.devices.get('t')!.powered, true);
  const weak = simulate(scene([dev('p', 'large-solar-panel'), dev('s', 'sam-site', 1)], [wire('power', 'p', 0, 's', 0)]));
  assert.equal(weak.devices.get('s')!.powered, false);
});

test('power: a battery charges at 80 % of up to 4× its output and lasts capacity / (drain − charge)', () => {
  const s = simulate(scene(
    [dev('g', 'small-generator'), dev('b', 'small-battery', 1), dev('h', 'electric-heater', 2)],
    [wire('power', 'g', 0, 'b', 0), wire('power', 'b', 0, 'h', 0)],
  ));
  const b = s.batteries[0];
  assert.equal(b.charge, 32);
  assert.equal(b.drain, 3);
  assert.ok(Math.abs(b.hours! - (400 * 60) / 29 / 3600) < 1e-9);
  assert.deepEqual(s.sources.map(x => x.used), [40]);
});

test('water: a powered pump feeds sprinklers, an unpowered one does not; water will not climb more than 1 m without a pump', () => {
  const s = simulate(scene(
    [dev('g', 'small-generator'), dev('pump', 'water-pump', 1), dev('sp', 'fluid-splitter', 2), dev('s1', 'sprinkler', 3), dev('s2', 'sprinkler', 4), dev('pl', 'large-planter', 3, 0, 2)],
    [wire('power', 'g', 0, 'pump', 0), wire('fluid', 'pump', 0, 'sp', 0), wire('fluid', 'sp', 0, 's1', 0), wire('fluid', 'sp', 1, 's2', 0)],
  ));
  assert.equal(s.devices.get('s1')!.powered, true);
  assert.deepEqual(s.water.map(w => [w.kind, w.perSec, w.drain]), [['water-pump', 8.5, 4]]);
  assert.deepEqual(s.planters[0].water.sort(), ['s1', 's2']);
  const dry = simulate(scene([dev('pump', 'water-pump'), dev('s1', 'sprinkler', 1)], [wire('fluid', 'pump', 0, 's1', 0)]));
  assert.equal(dry.devices.get('s1')!.powered, false);
  const up = simulate(scene([dev('bar', 'water-barrel'), dev('s1', 'sprinkler', 1, 3)], [wire('fluid', 'bar', 0, 's1', 0)]));
  assert.equal(up.devices.get('s1')!.powered, false);
  assert.equal(up.gravity.length, 1);
  assert.ok(up.water[0].hours === null);
});

test('water: a sprinkler hanging under the ceiling waters the planter below, one standing on the floor above does not', () => {
  const hung = { ...dev('s1', 'sprinkler', 0, 2.8), hanging: true };
  const s = simulate(scene([dev('bar', 'water-barrel', 0, 3), dev('bar2', 'water-barrel', 2, 3), hung, dev('s2', 'sprinkler', 1, 3), dev('pl', 'large-planter', 0, 0, 1)], [wire('fluid', 'bar', 0, 's1', 0), wire('fluid', 'bar2', 0, 's2', 0)]));
  assert.equal(s.devices.get('s1')!.powered, true);
  assert.equal(s.devices.get('s2')!.powered, true);
  assert.deepEqual(s.planters[0].water, ['s1']);
});

test('wind turbine: 75 on the ground, 150 at 50 m and higher', () => {
  assert.equal(windOutput(0), 75);
  assert.equal(windOutput(25), 112);
  assert.equal(windOutput(80), 150);
});
