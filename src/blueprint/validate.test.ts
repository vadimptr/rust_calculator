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

test('in every example the owner walks in from the ground to the tool cupboard through doors alone', async () => {
  const { buildSpaceGraph, OUTSIDE } = await import('./raid.ts');
  const { KINDS } = await import('./catalog.ts');
  for (const f of readdirSync(dir).filter(n => n.endsWith('.json'))) {
    const r = loadBlueprint(JSON.parse(readFileSync(new URL(f, dir), 'utf8')));
    if (r.blueprint!.meta.tags?.some(t => t.includes('bunker'))) continue;
    const resolved = r.resolved!;
    const tc = resolved.deployables.find(d => d.kind === 'tool-cupboard');
    if (!tc || !resolved.deployables.some(d => KINDS[resolved.elements.find(e => e.id === d.parent)!.kind].opening === 'single' || KINDS[resolved.elements.find(e => e.id === d.parent)!.kind].opening === 'frame')) continue;
    const graph = buildSpaceGraph(resolved);
    const walk = (b: { element: { kind: keyof typeof KINDS } | null }) => !b.element || (!!KINDS[b.element.kind].opening && KINDS[b.element.kind].opening !== 'window');
    const seen = new Set<string>();
    const queue: string[] = [];
    for (const [id, list] of graph.adj) for (const e of list) if (e.to === OUTSIDE && e.mid[1] < 1.5 && walk(e.blocker) && !seen.has(id)) { seen.add(id); queue.push(id); }
    while (queue.length) {
      const cur = queue.shift()!;
      for (const e of graph.adj.get(cur) ?? []) if (e.to !== OUTSIDE && !seen.has(e.to) && walk(e.blocker)) { seen.add(e.to); queue.push(e.to); }
    }
    const tcNode = [...graph.nodes].find(([, n]) => n.cell.id === tc.parent && !n.virtual)?.[0];
    assert.ok(tcNode && seen.has(tcNode), f);
  }
});
