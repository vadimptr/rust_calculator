/**
 * Свободный полёт камеры: WASD — вдоль взгляда и вбок, Space/C — вверх/вниз, Shift — быстрее.
 */
import * as THREE from 'three';

/** Скорость полёта, м/с; с Shift — втрое быстрее. */
export const FLY_SPEED = 6;

export const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'ShiftRight', 'KeyC', 'ControlLeft']);

export function applyFlight(camera: THREE.Camera, keys: Set<string>, dt: number): void {
  const dir = camera.getWorldDirection(new THREE.Vector3());
  const right = new THREE.Vector3().crossVectors(dir, camera.up).normalize();
  const move = new THREE.Vector3();
  if (keys.has('KeyW')) move.add(dir);
  if (keys.has('KeyS')) move.sub(dir);
  if (keys.has('KeyD')) move.add(right);
  if (keys.has('KeyA')) move.sub(right);
  if (keys.has('Space')) move.y += 1;
  if (keys.has('KeyC') || keys.has('ControlLeft')) move.y -= 1;
  if (move.lengthSq() === 0) return;
  const boost = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 3 : 1;
  camera.position.addScaledVector(move.normalize(), FLY_SPEED * boost * dt);
  if (camera.position.y < 0.2) camera.position.y = 0.2;
}
