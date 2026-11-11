import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveBlueprint } from './geometry.ts';
import { deployPlacement, newBlueprint } from './editor.ts';
import { cheapestRaidPath } from './raid.ts';
import { deployableCost } from './cost.ts';
import { loadBlueprint } from './validate.ts';
import type { Blueprint, Deployable, Element, ElementKind } from './types.ts';

function withFrame(frame: ElementKind, base: ElementKind = 'square-foundation'): Blueprint {
  const bp = newBlueprint('Люки', base);
  const el: Element = { id: 'ff1', kind: frame, position: [0, 3, 0], rotation: 0 };
  return { ...bp, elements: [...bp.elements, el] };
}

function issuesFor(bp: Blueprint, d: Deployable) {
  return resolveBlueprint({ ...bp, deployables: [d] }).issues.filter(i => i.id === d.id);
}

test('metal and armored hatches go into a floor frame of their shape', () => {
  const square = withFrame('floor-frame');
  for (const kind of ['ladder-hatch', 'armored-ladder-hatch'] as const) {
    assert.deepEqual(issuesFor(square, { id: 'h1', kind, attach: { to: 'ff1', socket: 'opening' } }), []);
  }
  const tri = withFrame('triangle-floor-frame', 'triangle-foundation');
  assert.deepEqual(issuesFor(tri, { id: 'h1', kind: 'armored-triangle-ladder-hatch', attach: { to: 'ff1', socket: 'opening' } }), []);
  assert.equal(issuesFor(tri, { id: 'h1', kind: 'ladder-hatch', attach: { to: 'ff1', socket: 'opening' } })[0]?.code, 'V11');
});

test('hatch is rejected on a solid floor and only one fits a frame', () => {
  const floor = withFrame('square-floor');
  assert.equal(issuesFor(floor, { id: 'h1', kind: 'ladder-hatch', attach: { to: 'ff1', socket: 'opening' } })[0]?.code, 'V04');
  const bp = withFrame('floor-frame');
  const r = resolveBlueprint({ ...bp, deployables: [
    { id: 'h1', kind: 'ladder-hatch', attach: { to: 'ff1', socket: 'opening' } },
    { id: 'h2', kind: 'armored-ladder-hatch', attach: { to: 'ff1', socket: 'opening' } },
  ] });
  assert.equal(r.issues.find(i => i.id === 'h2')?.code, 'V11');
});

test('on a boat only metal hatches are allowed', () => {
  const boat = withFrame('boat-floor-frame', 'boat-hull');
  assert.deepEqual(issuesFor(boat, { id: 'h1', kind: 'ladder-hatch', attach: { to: 'ff1', socket: 'opening' } }), []);
  const bad = issuesFor(boat, { id: 'h1', kind: 'armored-ladder-hatch', attach: { to: 'ff1', socket: 'opening' } })[0];
  assert.equal(bad?.code, 'V11');
  assert.match(bad!.message, /корабль/);
});

test('editor places a hatch into the frame with rotation snapped to the frame', () => {
  const bp = withFrame('triangle-floor-frame', 'triangle-foundation');
  const res = resolveBlueprint(bp).resolved;
  const p = deployPlacement(bp, res, 'triangle-ladder-hatch', 'ff1', [0, 0, 0], 130);
  assert.ok(p);
  assert.deepEqual(p.deployable.attach, { to: 'ff1', socket: 'opening' });
  assert.equal(p.deployable.rotation, 120);
  assert.equal(p.transform.rotation, 120);
  assert.equal(deployPlacement(bp, res, 'ladder-hatch', 'ff1', [0, 0, 0]), null);
  const boat = withFrame('boat-floor-frame', 'boat-hull');
  assert.equal(deployPlacement(boat, resolveBlueprint(boat).resolved, 'armored-ladder-hatch', 'ff1', [0, 0, 0]), null);
});

test('schema accepts a rotated hatch', () => {
  const bp: Blueprint = { ...withFrame('floor-frame'), deployables: [{ id: 'h1', kind: 'ladder-hatch', attach: { to: 'ff1', socket: 'opening' }, rotation: 90 }] };
  assert.deepEqual(loadBlueprint(bp).issues.filter(i => i.code === 'SCHEMA'), []);
});

test('raid down through a floor frame costs the hatch, an empty frame is free', () => {
  const walls = [0, 90, 180, 270].map((rot, i): Element => {
    const a = (rot * Math.PI) / 180;
    return { id: `w${i}`, kind: 'wall', position: [Math.round(1.5 * Math.cos(a) * 1000) / 1000 + 0, 1, Math.round(1.5 * Math.sin(a) * 1000) / 1000 + 0], rotation: rot, grade: 'armored' };
  });
  const bp: Blueprint = {
    ...newBlueprint('Люк'),
    elements: [
      { id: 'f1', kind: 'square-foundation', position: [0, 1, 0], rotation: 0, grade: 'armored' },
      { id: 'ff1', kind: 'floor-frame', position: [0, 4, 0], rotation: 0, grade: 'armored' },
      ...walls,
    ],
  };
  const open = cheapestRaidPath(resolveBlueprint(bp).resolved, 'f1', 'rocket');
  const closed = cheapestRaidPath(resolveBlueprint({ ...bp, deployables: [{ id: 'h1', kind: 'armored-ladder-hatch', attach: { to: 'ff1', socket: 'opening' } }] }).resolved, 'f1', 'rocket');
  assert.equal(open?.sulfur, 0);
  assert.deepEqual(closed?.steps.map(st => st.kind), ['armored-ladder-hatch']);
  assert.equal(closed?.sulfur, 7000);
});

test('hatch costs come from the game recipes', () => {
  assert.deepEqual(deployableCost('ladder-hatch'), { metal: 300 });
  assert.deepEqual(deployableCost('armored-triangle-ladder-hatch'), { hqm: 35 });
});
