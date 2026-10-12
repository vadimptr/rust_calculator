import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { buildDeployable, buildElement } from '../blueprint/meshes.ts';
import type { Resolved } from '../blueprint/types.ts';

interface Viewer3DProps {
  resolved: Resolved | null;
}

interface SceneRefs {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  content: THREE.Group;
  frame: number;
}

/** 3D-сцена постройки: вращение мышью, зум колесом, панорамирование правой кнопкой. */
const Viewer3D: React.FC<Viewer3DProps> = ({ resolved }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const refs = useRef<SceneRefs | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.shadowMap.enabled = true;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x161412);
    scene.fog = new THREE.Fog(0x161412, 80, 160);

    const camera = new THREE.PerspectiveCamera(50, host.clientWidth / host.clientHeight, 0.1, 500);
    camera.position.set(12, 10, 12);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 2;
    controls.maxDistance = 90;
    controls.maxPolarAngle = Math.PI / 2 - 0.02;

    scene.add(new THREE.HemisphereLight(0xfff4e0, 0x3a3024, 1.6));
    scene.add(new THREE.AmbientLight(0xffffff, 0.35));
    const sun = new THREE.DirectionalLight(0xfff1d6, 2.4);
    sun.position.set(-14, 24, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0008;
    sun.shadow.normalBias = 0.04;
    sun.shadow.camera.left = sun.shadow.camera.bottom = -30;
    sun.shadow.camera.right = sun.shadow.camera.top = 30;
    scene.add(sun);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 200),
      new THREE.MeshStandardMaterial({ color: 0x3a4a2e, roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.6;
    ground.receiveShadow = true;
    scene.add(ground);

    const grid = new THREE.GridHelper(60, 20, 0x4a4036, 0x2a241e);
    grid.position.y = -0.59;
    scene.add(grid);

    const content = new THREE.Group();
    scene.add(content);

    const state: SceneRefs = { renderer, scene, camera, controls, content, frame: 0 };
    refs.current = state;

    const tick = () => {
      controls.update();
      renderer.render(scene, camera);
      state.frame = requestAnimationFrame(tick);
    };
    tick();

    const ro = new ResizeObserver(() => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    });
    ro.observe(host);

    return () => {
      ro.disconnect();
      cancelAnimationFrame(state.frame);
      controls.dispose();
      renderer.dispose();
      host.removeChild(renderer.domElement);
      refs.current = null;
    };
  }, []);

  useEffect(() => {
    const s = refs.current;
    if (!s) return;
    s.content.clear();
    if (!resolved) return;

    for (const el of resolved.elements) s.content.add(buildElement(el));
    for (const d of resolved.deployables) s.content.add(buildDeployable(d));

    const bounds = new THREE.Box3().setFromObject(s.content);
    if (bounds.isEmpty()) return;
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3()).length();
    s.controls.target.copy(center);
    const dist = Math.max(8, size * 1.1);
    s.camera.position.set(center.x - dist * 0.75, center.y + dist * 0.6, center.z + dist * 0.75);
    s.controls.update();
  }, [resolved]);

  return <div className="viewer3d" ref={hostRef} />;
};

export default Viewer3D;
