import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveBlueprint } from './geometry.ts';
import { addElement, newBlueprint } from './editor.ts';
import { activePieces, type PieceManifest } from './pieces.ts';
import { entityMatrix } from './meshes.ts';

const MANIFEST: PieceManifest = JSON.parse(readFileSync(new URL('../../public/models/conditionals.json', import.meta.url), 'utf8'));

function pieces(bp: ReturnType<typeof newBlueprint>) {
  return activePieces(MANIFEST, resolveBlueprint(bp).resolved, entityMatrix);
}

test('a lone roof shows the full slab with all its edge lines', () => {
  let bp = newBlueprint();
  bp = addElement(bp, 'wall', { to: 'f1', socket: 'edge:0' });
  bp = addElement(bp, 'roof', { to: 'w1', socket: 'top', selfSocket: 'edge:0' });
  const p = pieces(bp).get('r1')!;
  for (const n of ['roof.full', 'roof.top.line', 'roof.bottom.line', 'roof.left.line', 'roof.right.line']) assert.ok(p.includes(n), n);
});

test('two roofs on neighbouring foundation edges merge into a concave 90° corner', () => {
  let bp = newBlueprint();
  bp = addElement(bp, 'roof', { to: 'f1', socket: 'edge:0', selfSocket: 'edge:0' });
  bp = addElement(bp, 'roof', { to: 'f1', socket: 'edge:1', selfSocket: 'edge:0' });
  const p = pieces(bp);
  assert.ok(p.get('r1')!.includes('roof.90.left.concave.square'));
  assert.ok(p.get('r2')!.includes('roof.90.right.concave.square'));
  assert.ok(!p.get('r1')!.includes('roof.left.line'));
  assert.ok(!p.get('r2')!.includes('roof.right.line'));
});

test('a wall beside a roof slope at roof level turns into a gable triangle; walls with something on top stay full', () => {
  let bp = newBlueprint();
  bp = addElement(bp, 'wall', { to: 'f1', socket: 'edge:0' });
  bp = addElement(bp, 'wall', { to: 'f1', socket: 'edge:3' });
  bp = addElement(bp, 'roof', { to: 'w1', socket: 'top', selfSocket: 'edge:0' });
  bp = addElement(bp, 'wall', { to: 'w2', socket: 'top' });
  const p = pieces(bp);
  assert.deepEqual(p.get('w1')!.filter(n => n === 'full' || n === 'left' || n === 'right'), ['full']);
  const gable = p.get('w3')!;
  assert.ok(gable.includes('left') || gable.includes('right'), gable.join(','));
  assert.ok(!gable.includes('full'));
});
