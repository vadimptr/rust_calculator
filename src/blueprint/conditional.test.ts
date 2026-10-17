import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveBlueprint } from './geometry.ts';
import { gableWalls } from './conditional.ts';
import { addElement, newBlueprint } from './editor.ts';

function house() {
  let bp = newBlueprint();
  for (const k of [0, 1, 2, 3]) bp = addElement(bp, 'wall', { to: 'f1', socket: `edge:${k}` as 'edge:0' });
  // крыша внутрь с верха w1 (ребро edge:0): низ над w1, конёк над w3, торцы над w2 и w4
  bp = addElement(bp, 'roof', { to: 'w1', socket: 'top', selfSocket: 'edge:0' });
  return bp;
}

test('gable: a wall on a wall at the roof side becomes a triangle under the slope, peak at the high edge', () => {
  let bp = addElement(house(), 'wall', { to: 'w2', socket: 'top' });
  const r = resolveBlueprint(bp);
  assert.deepEqual(r.issues.filter(i => i.level === 'error'), []);
  const g = gableWalls(r.resolved);
  assert.ok(g.has('w5'), [...g.keys()].join(','));
  assert.equal(g.size, 1);
  // вершина треугольника — со стороны конька (над w3, x = −1.5)
  const w5 = r.resolved.elements.find(e => e.id === 'w5')!;
  const a = (-w5.rotation * Math.PI) / 180;
  const zHigh = (-1.5 - w5.position[0]) * Math.sin(a) + (0 - w5.position[2]) * Math.cos(a);
  assert.equal(g.get('w5')!.peak, zHigh >= 0 ? 1 : -1);
  // на фронтоне что-то стоит — снова полная стена
  bp = addElement(bp, 'wall', { to: 'w5', socket: 'top' });
  assert.equal(gableWalls(resolveBlueprint(bp).resolved).has('w5'), false);
});

test('gable: walls under the low and high edges of the roof and walls without a roof stay full', () => {
  let bp = addElement(house(), 'wall', { to: 'w3', socket: 'top' });
  assert.equal(gableWalls(resolveBlueprint(bp).resolved).size, 0);
  bp = addElement(newBlueprint(), 'wall', { to: 'f1', socket: 'edge:0' });
  bp = addElement(bp, 'wall', { to: 'w1', socket: 'top' });
  assert.equal(gableWalls(resolveBlueprint(bp).resolved).size, 0);
});
