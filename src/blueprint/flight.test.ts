import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { FLY_SPEED, applyFlight } from './flight.ts';

function cam(lookAt: [number, number, number]) {
  const c = new THREE.PerspectiveCamera();
  c.position.set(0, 5, 0);
  c.lookAt(...lookAt);
  c.updateMatrixWorld();
  return c;
}

test('W moves along the view direction, S backwards', () => {
  const c = cam([10, 5, 0]);
  applyFlight(c, new Set(['KeyW']), 1);
  assert.ok(Math.abs(c.position.x - FLY_SPEED) < 1e-6 && Math.abs(c.position.y - 5) < 1e-6);
  applyFlight(c, new Set(['KeyS']), 0.5);
  assert.ok(Math.abs(c.position.x - FLY_SPEED / 2) < 1e-6);
});

test('D strafes to the right of the view, A to the left', () => {
  const c = cam([0, 5, -10]); // смотрит в −z → право = +x
  applyFlight(c, new Set(['KeyD']), 1);
  assert.ok(Math.abs(c.position.x - FLY_SPEED) < 1e-6, `x=${c.position.x}`);
  applyFlight(c, new Set(['KeyA']), 2);
  assert.ok(Math.abs(c.position.x + FLY_SPEED) < 1e-6, `x=${c.position.x}`);
});

test('Space / C move vertically, Shift triples speed, floor clamps', () => {
  const c = cam([10, 5, 0]);
  applyFlight(c, new Set(['Space', 'ShiftLeft']), 1);
  assert.ok(Math.abs(c.position.y - (5 + 3 * FLY_SPEED)) < 1e-6);
  applyFlight(c, new Set(['KeyC']), 100);
  assert.equal(c.position.y, 0.2);
});

test('no keys: camera stays put', () => {
  const c = cam([10, 5, 0]);
  applyFlight(c, new Set(), 1);
  assert.deepEqual(c.position.toArray(), [0, 5, 0]);
});
