import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { animateDoors, buildDeployable, buildElement, collectDoors, setDoorOpen } from '../blueprint/meshes.ts';
import type { Resolved } from '../blueprint/types.ts';
import { MOVE_KEYS, applyFlight } from '../blueprint/flight.ts';
import { RaidOverlay } from '../blueprint/raidOverlay.ts';
import type { RaidView } from '../blueprint/raidOverlay.ts';

export type CameraMode = 'orbit' | 'fly';

interface Viewer3DProps {
  resolved: Resolved | null;
  mode: CameraMode;
  /** Открыть все двери (поверх собственного open у каждой двери). */
  doorsOpen: boolean;
  /** Подсветка пути рейда; null — выключена. */
  raid: RaidView | null;
  /** Счётчик запусков воспроизведения рейда: изменение на >0 запускает, 0 — сбрасывает. */
  raidPlay: number;
}

interface SceneRefs {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  fly: PointerLockControls;
  keys: Set<string>;
  clock: THREE.Clock;
  content: THREE.Group;
  doors: THREE.Object3D[];
  raid: RaidOverlay;
  frame: number;
}

/** Цель каждой двери: общий переключатель либо собственное open из документа. */
function applyDoorsOpen(s: SceneRefs, doorsOpen: boolean) {
  for (const door of s.doors) {
    let owner: THREE.Object3D | null = door;
    while (owner && owner.userData.open === undefined) owner = owner.parent;
    setDoorOpen(door, doorsOpen || owner?.userData.open === true);
  }
}

const Viewer3D: React.FC<Viewer3DProps> = ({ resolved, mode, doorsOpen, raid, raidPlay }) => {
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

    const fly = new PointerLockControls(camera, renderer.domElement);
    const keys = new Set<string>();
    const onKeyDown = (e: KeyboardEvent) => {
      if (!fly.isLocked || !MOVE_KEYS.has(e.code)) return;
      keys.add(e.code);
      e.preventDefault();
    };
    const onKeyUp = (e: KeyboardEvent) => keys.delete(e.code);
    const onUnlock = () => keys.clear();
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    fly.addEventListener('unlock', onUnlock);

    const state: SceneRefs = {
      renderer, scene, camera, controls, fly, keys, clock: new THREE.Clock(), content, doors: [],
      raid: new RaidOverlay(content, scene), frame: 0,
    };
    refs.current = state;

    const tick = () => {
      const dt = Math.min(state.clock.getDelta(), 0.1);
      if (fly.isLocked) applyFlight(camera, keys, dt);
      else if (controls.enabled) controls.update();
      animateDoors(state.doors, dt);
      state.raid.tick(performance.now());
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
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      fly.removeEventListener('unlock', onUnlock);
      if (fly.isLocked) fly.unlock();
      fly.dispose();
      controls.dispose();
      renderer.dispose();
      host.removeChild(renderer.domElement);
      refs.current = null;
    };
  }, []);

  // Переключение режима камеры: орбита ↔ полёт (захват мыши по клику на сцену)
  useEffect(() => {
    const s = refs.current;
    if (!s) return;
    if (mode === 'fly') {
      s.controls.enabled = false;
      const lock = () => { if (!s.fly.isLocked) s.fly.lock(); };
      s.renderer.domElement.addEventListener('click', lock);
      return () => {
        s.renderer.domElement.removeEventListener('click', lock);
        if (s.fly.isLocked) s.fly.unlock();
      };
    }
    // Возврат к орбите: цель — точка в 10 м по направлению взгляда
    const dir = s.camera.getWorldDirection(new THREE.Vector3());
    s.controls.target.copy(s.camera.position).addScaledVector(dir, 10);
    s.controls.enabled = true;
    s.controls.update();
    return undefined;
  }, [mode]);

  useEffect(() => {
    const s = refs.current;
    if (!s) return;
    s.raid.clear();
    s.content.clear();
    if (!resolved) return;

    for (const el of resolved.elements) s.content.add(buildElement(el));
    for (const d of resolved.deployables) s.content.add(buildDeployable(d));
    s.doors = collectDoors(s.content);
    applyDoorsOpen(s, doorsOpen);
    s.raid.apply(raid);

    const bounds = new THREE.Box3().setFromObject(s.content);
    if (bounds.isEmpty()) return;
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3()).length();
    s.controls.target.copy(center);
    const dist = Math.max(8, size * 1.1);
    // Камера смотрит со стороны первой двери (3/4-ракурс), иначе — с фиксированного угла
    const door = resolved.deployables.find(d => d.kind !== 'tool-cupboard');
    const az = ((door ? door.rotation + 35 : 135) * Math.PI) / 180;
    s.camera.position.set(
      center.x + dist * 0.8 * Math.cos(az),
      center.y + dist * 0.6,
      center.z + dist * 0.8 * Math.sin(az),
    );
    s.controls.update();
  }, [resolved]);

  // Подсветка рейда: материалы и оверлей, без перестройки сцены и камеры
  useEffect(() => {
    const s = refs.current;
    if (s) s.raid.apply(raid);
  }, [raid]);

  useEffect(() => {
    const s = refs.current;
    if (!s) return;
    if (raidPlay > 0) s.raid.start(performance.now());
    else s.raid.stop();
  }, [raidPlay]);

  // Переключатель дверей: только цель анимации, сцена и камера не трогаются
  useEffect(() => {
    const s = refs.current;
    if (s) applyDoorsOpen(s, doorsOpen);
  }, [doorsOpen]);

  return <div className="viewer3d" ref={hostRef} />;
};

export default Viewer3D;
