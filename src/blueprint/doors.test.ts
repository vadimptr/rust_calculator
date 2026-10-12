import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { animateDoors, collectDoors, setDoorOpen } from './meshes.ts';
import type { DoorAnim } from './meshes.ts';

function leaf(open = Math.PI / 2): THREE.Object3D {
  const o = new THREE.Group();
  const anim: DoorAnim = { type: 'leaf', closed: 0, open, target: false };
  o.userData.door = anim;
  return o;
}

test('collectDoors finds nested door pivots only', () => {
  const root = new THREE.Group();
  const wrapper = new THREE.Group();
  wrapper.add(leaf());
  root.add(wrapper, new THREE.Group());
  assert.equal(collectDoors(root).length, 1);
});

test('door animates towards the target and stops exactly at it', () => {
  const d = leaf();
  setDoorOpen(d, true);
  assert.equal(animateDoors([d], 0.1), true);
  assert.ok(d.rotation.y > 0 && d.rotation.y < Math.PI / 2);
  for (let i = 0; i < 50; i++) animateDoors([d], 0.1);
  assert.equal(d.rotation.y, Math.PI / 2);
  assert.equal(animateDoors([d], 0.1), false);
  setDoorOpen(d, false);
  for (let i = 0; i < 50; i++) animateDoors([d], 0.1);
  assert.equal(d.rotation.y, 0);
});

test('snap puts the door in its final pose immediately; lift doors move on Y', () => {
  const d = leaf(-Math.PI / 2);
  setDoorOpen(d, true, true);
  assert.equal(d.rotation.y, -Math.PI / 2);
  const lift = new THREE.Group();
  const anim: DoorAnim = { type: 'lift', closed: 0, open: 2.4, target: false };
  lift.userData.door = anim;
  setDoorOpen(lift, true);
  for (let i = 0; i < 50; i++) animateDoors([lift], 0.1);
  assert.equal(lift.position.y, 2.4);
});
