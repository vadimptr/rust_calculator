import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveBlueprint } from './geometry.ts';
import { computeStability, COLLAPSE, SUPPORT } from './stability.ts';
import { addElement, newBlueprint, placementsNear, removeElement, settle } from './editor.ts';
import { cornerPosts, hipRoofs } from './conditional.ts';
import type { Blueprint, ElementKind } from './types.ts';

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

test('shelf at half height: placed off a temporary twig shelf behind a full wall, it stays on the wall once the twig is removed', () => {
  const res = (b: Blueprint) => resolveBlueprint(b).resolved;
  const put = (b: Blueprint, kind: ElementKind, host: string, at: [number, number, number], y: number) => {
    const p = placementsNear(b, res(b), kind, host, at).find(c => Math.abs(c.transform.position[1] - y) < 0.05 && Math.hypot(c.transform.position[0] - at[0], c.transform.position[2] - at[2]) < 0.8);
    assert.ok(p, `${kind} on ${host}`);
    return addElement(b, kind, p.attach, 'twig');
  };
  let bp = newBlueprint('Полка', 'square-foundation');
  bp = put(bp, 'square-foundation', 'f1', [3, 0, 0], 0);
  const f2 = bp.elements.at(-1)!.id;
  bp = put(bp, 'wall', 'f1', [1.5, 1.5, 0], 0);
  const wall = bp.elements.at(-1)!.id;
  bp = put(bp, 'half-wall', f2, [4.5, 0.75, 0], 0);
  const half = bp.elements.at(-1)!.id;
  bp = put(bp, 'square-floor', half, [3, 1.5, 0], 1.5);
  const twig = bp.elements.at(-1)!.id;
  bp = put(bp, 'square-floor', twig, [0, 1.5, 0], 1.5);
  const shelf = bp.elements.at(-1)!.id;
  bp = removeElement(removeElement(bp, twig), half);
  const { blueprint, collapsed } = settle(bp);
  assert.deepEqual(collapsed, []);
  const st = computeStability(res(blueprint));
  assert.ok(near(st.get(shelf)!, SUPPORT.floorEdgeSquare * st.get(wall)!), `${st.get(shelf)} ${st.get(wall)}`);
});

test('shelf at half height: a full wall holds it, a doorway does not (its mid sockets carry no stability)', () => {
  const held = (kind: ElementKind) => {
    const r = resolveBlueprint(addElement(newBlueprint('Проём', 'square-foundation'), kind, { to: 'f1', socket: 'edge:0' })).resolved;
    const w = r.elements.find(e => e.kind === kind)!;
    const f = r.elements.find(e => e.id === 'f1')!;
    const shelf = { id: 'g', kind: 'square-floor', grade: 'twig', position: [f.position[0], f.position[1] + 1.5, f.position[2]], rotation: f.rotation, level: 0 } as never;
    return [computeStability({ ...r, elements: [...r.elements, shelf] }).get('g')!, computeStability(r).get(w.id)!];
  };
  const [onWall, wall] = held('wall');
  assert.ok(near(onWall, SUPPORT.floorEdgeSquare * wall), `${onWall} ${wall}`);
  assert.equal(held('doorway')[0], 0);
});

test('wall stands on a cell edge whose midpoint lies on a rounding boundary', () => {
  const bp = newBlueprint('Граница', 'triangle-foundation', [0.008, 0, 0]);
  const r = resolveBlueprint(bp).resolved;
  const p = placementsNear(bp, r, 'window-frame', 'f1', [-0.425, 1, 0.75]).find(c => Math.abs(c.transform.position[0] + 0.425) < 0.002);
  assert.ok(p);
  const next = addElement(bp, 'window-frame', p.attach);
  const id = next.elements.at(-1)!.id;
  const st = computeStability(resolveBlueprint(next).resolved);
  assert.ok(Math.abs(st.get(id)! - SUPPORT.wallBottom) < 1e-6, String(st.get(id)));
});
