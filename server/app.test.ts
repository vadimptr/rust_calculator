import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp } from './app.ts';
import { openDb, seed } from './db.ts';

async function start() {
  const db = openDb(':memory:');
  seed(db, new URL('../docs/blueprint/examples/', import.meta.url));
  const server = createServer(createApp(db));
  await new Promise<void>(r => server.listen(0, r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const call = async (method: string, path: string, body?: unknown) => {
    const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: res.status, body: await res.json() };
  };
  return { call, close: () => new Promise(r => server.close(r)) };
}

test('the examples are seeded once, god rock first', async () => {
  const { call, close } = await start();
  const list = await call('GET', '/api/schemes');
  assert.equal(list.status, 200);
  assert.equal(list.body.length, 10);
  assert.deepEqual(list.body[0], { ...list.body[0], id: 'god-rock', name: 'God Rock', terrain: true, elements: 0 });
  const one = await call('GET', '/api/schemes/house-2x2');
  assert.equal(one.body.doc.meta.name, 'Дом 2×2 с запрыгом');
  await close();
});

test('a new scheme is created, saved with its version and refused on a stale version', async () => {
  const { call, close } = await start();
  const doc = { formatVersion: '2.0', meta: { name: 'x' }, elements: [] };
  const made = await call('POST', '/api/schemes', { name: 'Моя база', doc });
  assert.equal(made.status, 201);
  assert.equal(made.body.doc.meta.name, 'Моя база');
  const built = { ...doc, elements: [{ id: 'f1', kind: 'square-foundation', position: [0, 0, 0], rotation: 0 }] };
  const saved = await call('PUT', `/api/schemes/${made.body.id}`, { name: 'Моя база', doc: built, version: 1 });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.version, 2);
  assert.equal(saved.body.elements, 1);
  const stale = await call('PUT', `/api/schemes/${made.body.id}`, { name: 'Моя база', doc: built, version: 1 });
  assert.equal(stale.status, 409);
  assert.equal(stale.body.version, 2);
  const list = await call('GET', '/api/schemes');
  assert.equal(list.body.at(-1).id, made.body.id);
  await close();
});

test('invalid documents and names are rejected', async () => {
  const { call, close } = await start();
  assert.equal((await call('POST', '/api/schemes', { name: '', doc: {} })).status, 400);
  const bad = await call('POST', '/api/schemes', { name: 'a', doc: { formatVersion: '2.0', meta: { name: 'a' }, elements: [{ id: 'f1', kind: 'square-foundation', position: [0, 9, 0], rotation: 0 }] } });
  assert.equal(bad.status, 422);
  assert.ok(bad.body.issues.some((i: { code: string }) => i.code === 'V12'));
  assert.equal((await call('GET', '/api/schemes/nope')).status, 404);
  await close();
});
