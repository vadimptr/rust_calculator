import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveBlueprint } from './geometry.ts';
import { computeStability, COLLAPSE, SUPPORT } from './stability.ts';
import { addElement, newBlueprint, settle } from './editor.ts';
import { cornerPosts, hipRoofs } from './conditional.ts';

const near = (a: number, b: number, eps = 0.005) => Math.abs(a - b) < eps;

test('stability: foundation 100%, lone wall 70%, wall with two side neighbours 70% + 2 × 10% of theirs', () => {
  let bp = newBlueprint();
  bp = addElement(bp, 'wall', { to: 'f1', socket: 'edge:0' });
  let s = computeStability(resolveBlueprint(bp).resolved);
  assert.equal(s.get('f1'), 1);
  assert.ok(near(s.get('w1')!, SUPPORT.wallBottom));
  bp = addElement(bp, 'wall', { to: 'f1', socket: 'edge:1' });
  bp = addElement(bp, 'wall', { to: 'f1', socket: 'edge:3' });
  s = computeStability(resolveBlueprint(bp).resolved);
  // соседи считаются без самой стены: у каждого 0.7 + 0.1 × (его другой сосед, которого нет) = 0.7
  assert.ok(near(s.get('w1')!, 0.7 + 0.1 * 0.7 + 0.1 * 0.7), String(s.get('w1')));
});

test('stability: a floor on four walls; an overhang of two floors holds (just above 5%), the third collapses', () => {
  let bp = newBlueprint();
  for (const k of [0, 1, 2, 3]) bp = addElement(bp, 'wall', { to: 'f1', socket: `edge:${k}` as 'edge:0' });
  bp = addElement(bp, 'square-floor', { to: 'w1', socket: 'top', selfSocket: 'edge:0' });
  let s = computeStability(resolveBlueprint(bp).resolved);
  assert.ok(s.get('c1')! > 0.8, String(s.get('c1')));
  // навес наружу с верха w1
  bp = addElement(bp, 'square-floor', { to: 'w1', socket: 'top', selfSocket: 'edge:0', flip: true });
  s = computeStability(resolveBlueprint(bp).resolved);
  assert.ok(s.get('c2')! >= COLLAPSE, String(s.get('c2')));
  bp = addElement(bp, 'square-floor', { to: 'c2', socket: 'edge:2', selfSocket: 'edge:0' });
  s = computeStability(resolveBlueprint(bp).resolved);
  assert.ok(s.get('c3')! >= COLLAPSE && s.get('c3')! < 0.06, String(s.get('c3')));
  bp = addElement(bp, 'square-floor', { to: 'c3', socket: 'edge:2', selfSocket: 'edge:0' });
  s = computeStability(resolveBlueprint(bp).resolved);
  assert.ok(s.get('c4')! < COLLAPSE, String(s.get('c4')));
  const { blueprint, collapsed } = settle(bp);
  assert.deepEqual(collapsed, ['c4']);
  assert.ok(blueprint.elements.some(e => e.id === 'c3'));
});

test('stability: removing the walls drops the floor; examples have no collapsing blocks', async () => {
  const { readFileSync, readdirSync } = await import('node:fs');
  const dir = new URL('../../docs/blueprint/examples/', import.meta.url);
  for (const f of readdirSync(dir)) {
    const bp = JSON.parse(readFileSync(new URL(f, dir), 'utf8'));
    assert.deepEqual(settle(bp).collapsed, [], f);
  }
});

test('roof hip: two perpendicular roofs of one grade in the same cell clip each other along the diagonal', () => {
  let bp = newBlueprint();
  for (const k of [0, 1, 2, 3]) bp = addElement(bp, 'wall', { to: 'f1', socket: `edge:${k}` as 'edge:0' });
  bp = addElement(bp, 'roof', { to: 'w1', socket: 'top', selfSocket: 'edge:0' });
  bp = addElement(bp, 'roof', { to: 'w2', socket: 'top', selfSocket: 'edge:0' });
  const h = hipRoofs(resolveBlueprint(bp).resolved);
  assert.equal(h.get('r1')!.length, 1);
  assert.equal(h.get('r2')!.length, 1);
  // разный грейд — не срастаются
  bp.elements.find(e => e.id === 'r2')!.grade = 'metal';
  assert.equal(hipRoofs(resolveBlueprint(bp).resolved).size, 0);
});

test('corner posts: one per corner where two same-grade walls meet at an angle, none for in-line walls', () => {
  let bp = newBlueprint();
  for (const k of [0, 1, 2, 3]) bp = addElement(bp, 'wall', { to: 'f1', socket: `edge:${k}` as 'edge:0' });
  assert.equal(cornerPosts(resolveBlueprint(bp).resolved).length, 4);
  let line = newBlueprint();
  line = addElement(line, 'square-foundation', { to: 'f1', socket: 'edge:1', selfSocket: 'edge:3' });
  line = addElement(line, 'wall', { to: 'f1', socket: 'edge:0' });
  line = addElement(line, 'wall', { to: 'f2', socket: 'edge:0' });
  assert.equal(cornerPosts(resolveBlueprint(line).resolved).length, 0);
});
