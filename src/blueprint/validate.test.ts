import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { loadBlueprint } from './validate.ts';

const dir = new URL('../../docs/blueprint/examples/', import.meta.url);

test('every example loads in format 2.0 without errors', () => {
  for (const f of readdirSync(dir).filter(n => n.endsWith('.json'))) {
    const r = loadBlueprint(JSON.parse(readFileSync(new URL(f, dir), 'utf8')));
    assert.deepEqual(r.issues.filter(i => i.level === 'error'), [], f);
    assert.equal(r.blueprint!.formatVersion, '2.0', f);
    assert.ok(r.resolved!.elements.length > 0, f);
  }
});

test('a format 1.0 document with an attach tree is upgraded to world poses on load', () => {
  const r = loadBlueprint({
    formatVersion: '1.0', meta: { name: 'old' },
    elements: [
      { id: 'f1', kind: 'square-foundation', root: true },
      { id: 'f2', kind: 'square-foundation', attach: { to: 'f1', socket: 'edge:0', selfSocket: 'edge:2' } },
      { id: 'w1', kind: 'wall', attach: { to: 'f2', socket: 'edge:0' } },
    ],
  });
  assert.deepEqual(r.issues.filter(i => i.level === 'error'), []);
  assert.equal(r.blueprint!.formatVersion, '2.0');
  assert.deepEqual(r.blueprint!.elements.find(e => e.id === 'w1')!.position, [4.5, 0, 0]);
});
