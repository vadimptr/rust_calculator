import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveBlueprint } from './geometry.ts';
import { loadBlueprint } from './validate.ts';
import { buildings, connectsCupboards, cupboardBlocker, privilegeZones } from './privilege.ts';
import type { Blueprint, ResolvedElement } from './types.ts';

function doc(xs: number[], tcs: string[]): Blueprint {
  return {
    formatVersion: '2.0', meta: { name: 't' },
    elements: xs.map((x, i) => ({ id: `f${i}`, kind: 'square-foundation' as const, position: [x, 0, 0] as [number, number, number], rotation: 0 })),
    deployables: tcs.map((to, i) => ({ id: `tc${i}`, kind: 'tool-cupboard' as const, attach: { to, socket: 'top' as const } })),
  };
}

test('adjacent foundations are one building, a gap of 1.5 m splits them', () => {
  assert.equal(new Set(buildings(resolveBlueprint(doc([0, 3, 6], [])).resolved).of.values()).size, 1);
  assert.equal(new Set(buildings(resolveBlueprint(doc([0, 4.5], [])).resolved).of.values()).size, 2);
});

test('a second cupboard in the same building is blocked', () => {
  const r = resolveBlueprint(doc([0, 3], ['f0'])).resolved;
  assert.equal(cupboardBlocker(r, { position: [3, 0, 0], rotation: 0 })?.cupboard, 'tc0');
});

test('a cupboard of another building must stand farther than 16 m from the blocks of a building with a cupboard', () => {
  const near = resolveBlueprint(doc([0, 15], ['f0'])).resolved;
  assert.ok(cupboardBlocker(near, { position: [15, 0, 0], rotation: 0 }));
  const far = resolveBlueprint(doc([0, 21], ['f0'])).resolved;
  assert.equal(cupboardBlocker(far, { position: [21, 0, 0], rotation: 0 }), null);
  const issues = loadBlueprint(doc([0, 15], ['f0', 'f1'])).issues;
  assert.ok(issues.some(i => i.code === 'V14' && i.id === 'tc1'));
  assert.ok(!loadBlueprint(doc([0, 21], ['f0', 'f1'])).issues.some(i => i.code === 'V14'));
});

test('a block that would join two buildings with cupboards is refused', () => {
  const r = resolveBlueprint(doc([0, 6], ['f0', 'f1'])).resolved;
  const bridge: ResolvedElement = { id: 'b', kind: 'square-foundation', grade: 'twig', position: [3, 0, 0], rotation: 0, level: 0 };
  assert.deepEqual(connectsCupboards(r, bridge), ['tc0', 'tc1']);
  const lone = resolveBlueprint(doc([0, 6], ['f0'])).resolved;
  assert.equal(connectsCupboards(lone, bridge), null);
});

test('two cupboards in one building are reported, the zone covers 16 m around the blocks', () => {
  assert.ok(loadBlueprint(doc([0, 3], ['f0', 'f1'])).issues.some(i => i.code === 'V13'));
  const [z] = privilegeZones(resolveBlueprint(doc([0], ['f0'])).resolved);
  const inside = (x: number, zz: number) => z.inside[Math.floor((zz - z.z0) / z.cell) * z.nx + Math.floor((x - z.x0) / z.cell)] === 1;
  assert.ok(inside(16, 0));
  assert.ok(!inside(18, 0));
});

test('the privilege shell runs 16 m from the nearest block of the building, closed around it', async () => {
  const { privilegeShells, boxDistance } = await import('./privilege.ts');
  const r = resolveBlueprint(doc([0, 3], ['f0'])).resolved;
  const [sh] = privilegeShells(r);
  assert.ok(sh.indices.length > 1000);
  const boxes = [...buildings(r).boxes.values()];
  let worst = 0;
  for (let i = 0; i < sh.positions.length; i += 3 * 11) {
    const p = { center: [sh.positions[i], sh.positions[i + 1], sh.positions[i + 2]] as [number, number, number], u: [1, 0] as [number, number], half: [0, 0, 0] as [number, number, number] };
    worst = Math.max(worst, Math.abs(Math.min(...boxes.map(b => boxDistance(p, b, 100))) - 16));
  }
  assert.ok(worst < 0.5, `max error ${worst}`);
  assert.deepEqual(privilegeShells(resolveBlueprint(doc([0], [])).resolved), []);
});
