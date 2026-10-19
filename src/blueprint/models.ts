import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const DIR = '/models/';
const loaded = new Map<string, THREE.Object3D>();
const requested = new Set<string>();
const listeners = new Set<() => void>();
let loader: GLTFLoader | null = null;
let notifyScheduled = false;

function noRaycast(root: THREE.Object3D): void {
  root.traverse(n => { if ((n as THREE.Mesh).isMesh) n.raycast = () => {}; });
}

function notify(): void {
  if (notifyScheduled) return;
  notifyScheduled = true;
  requestAnimationFrame(() => {
    notifyScheduled = false;
    for (const fn of listeners) fn();
  });
}

function request(name: string): void {
  if (requested.has(name) || typeof document === 'undefined') return;
  requested.add(name);
  loader ??= new GLTFLoader();
  loader.load(`${DIR}${name}.glb`, gltf => {
    gltf.scene.traverse(n => {
      const mesh = n as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      for (const m of [mesh.material].flat() as THREE.MeshStandardMaterial[]) {
        if (m.map) m.map.anisotropy = 4;
      }
    });
    loaded.set(name, gltf.scene);
    notify();
  }, undefined, () => {});
}

export function onModelLoaded(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function gameModel(name: string): THREE.Object3D | null {
  const model = loaded.get(name);
  if (!model) {
    request(name);
    return null;
  }
  const copy = model.clone();
  noRaycast(copy);
  return copy;
}
