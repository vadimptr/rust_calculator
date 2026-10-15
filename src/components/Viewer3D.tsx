import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { animateDoors, buildDeployable, buildElement, collectDoors, setDoorOpen } from '../blueprint/meshes.ts';
import { KINDS } from '../blueprint/catalog.ts';
import type { Attach, Blueprint, Deployable, DeployableKind, ElementKind, Grade, Resolved, ResolvedDeployable, ResolvedElement } from '../blueprint/types.ts';
import { MOVE_KEYS, applyFlight } from '../blueprint/flight.ts';
import { RaidOverlay } from '../blueprint/raidOverlay.ts';
import type { RaidView } from '../blueprint/raidOverlay.ts';
import { deployPlacement, placementsNear } from '../blueprint/editor.ts';
import type { Placement } from '../blueprint/editor.ts';

export type CameraMode = 'orbit' | 'fly';

export type EditorTool = 'build' | 'deploy' | 'hammer';

/** Режим стройки: что в руках и куда сообщать о действиях. Документ — проверенный чертёж. */
export interface EditorState {
  tool: EditorTool;
  kind: ElementKind;
  deployKind: DeployableKind;
  grade: Grade;
  blueprint: Blueprint;
  onPlace: (kind: ElementKind, attach: Attach) => void;
  onDeploy: (d: Omit<Deployable, 'id'>) => void;
  onUpgrade: (id: string) => void;
  onRemove: (id: string, deployable: boolean) => void;
}

interface Viewer3DProps {
  resolved: Resolved | null;
  mode: CameraMode;
  /** Открыть все двери (поверх собственного open у каждой двери). */
  doorsOpen: boolean;
  /** Подсветка пути рейда; null — выключена. */
  raid: RaidView | null;
  /** Счётчик запусков воспроизведения рейда: изменение на >0 запускает, 0 — сбрасывает. */
  raidPlay: number;
  /** Ключ чертежа: камера наводится заново только при его смене, а не при каждом пересчёте сцены. */
  frameKey: string;
  /** Режим стройки; null — только просмотр. */
  editor: EditorState | null;
}

interface Hit {
  id: string;
  deployable: boolean;
  point: THREE.Vector3;
}

type Pending =
  | { type: 'element'; kind: ElementKind; attach: Attach }
  | { type: 'deploy'; d: Omit<Deployable, 'id'> }
  | { type: 'hammer'; id: string; deployable: boolean }
  | null;

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
  ghost: THREE.Group;
  raycaster: THREE.Raycaster;
  /** Последняя позиция курсора в NDC (орбита); в полёте — центр экрана. */
  pointer: THREE.Vector2 | null;
  hoverDirty: boolean;
  pending: Pending;
  /** Индекс альтернативного размещения (клавиша R) для текущего хозяина и типа. */
  alt: number;
  altKey: string;
  candCache: Map<string, Placement[]>;
}

const GHOST_MAT = new THREE.MeshStandardMaterial({ color: 0x3b9dff, emissive: 0x16589e, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide });
const HAMMER_MAT = new THREE.MeshStandardMaterial({ color: 0xffc34d, emissive: 0x9c6a12, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide });
const GHOST_EDGE = new THREE.LineBasicMaterial({ color: 0xbfe0ff, transparent: true, opacity: 0.9 });

/** Перекрасить построенный объект в призрак: материалы меша и рёбер заменяются, тени выключаются. */
function ghostify(o: THREE.Object3D, mat: THREE.Material): THREE.Object3D {
  o.traverse(n => {
    if ((n as THREE.Mesh).isMesh) { (n as THREE.Mesh).material = mat; n.castShadow = false; n.receiveShadow = false; n.renderOrder = 20; }
    else if ((n as THREE.LineSegments).isLineSegments) { (n as THREE.LineSegments).material = GHOST_EDGE; n.renderOrder = 21; }
  });
  return o;
}

/** Цель каждой двери: общий переключатель либо собственное open из документа. */
function applyDoorsOpen(s: SceneRefs, doorsOpen: boolean) {
  for (const door of s.doors) {
    let owner: THREE.Object3D | null = door;
    while (owner && owner.userData.open === undefined) owner = owner.parent;
    setDoorOpen(door, doorsOpen || owner?.userData.open === true);
  }
}

/** Точка в локальных осях элемента (x по нормали, y вверх, z вдоль). */
function toLocal(el: ResolvedElement, p: THREE.Vector3): [number, number, number] {
  const a = (-el.rotation * Math.PI) / 180;
  const dx = p.x - el.position[0], dy = p.y - el.position[1], dz = p.z - el.position[2];
  return [dx * Math.cos(a) - dz * Math.sin(a), dy, dx * Math.sin(a) + dz * Math.cos(a)];
}

const Viewer3D: React.FC<Viewer3DProps> = ({ resolved, mode, doorsOpen, raid, raidPlay, frameKey, editor }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const refs = useRef<SceneRefs | null>(null);
  const framedKey = useRef<string | null>(null);
  const editorRef = useRef<EditorState | null>(editor);
  const resolvedRef = useRef<Resolved | null>(resolved);
  editorRef.current = editor;
  resolvedRef.current = resolved;

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
    const ghost = new THREE.Group();
    scene.add(ghost);

    const fly = new PointerLockControls(camera, renderer.domElement);
    const keys = new Set<string>();

    const state: SceneRefs = {
      renderer, scene, camera, controls, fly, keys, clock: new THREE.Clock(), content, doors: [],
      raid: new RaidOverlay(content, scene), frame: 0, ghost, raycaster: new THREE.Raycaster(), pointer: null,
      hoverDirty: false, pending: null, alt: 0, altKey: '', candCache: new Map(),
    };
    refs.current = state;

    // --- режим стройки: рейкаст по сцене, призрак, действия
    const pick = (): Hit | null => {
      const ndc = fly.isLocked ? new THREE.Vector2(0, 0) : state.pointer;
      if (!ndc) return null;
      // сцена могла быть только что перестроена: мировые матрицы новых мешей ещё не посчитаны
      content.updateMatrixWorld(true);
      state.raycaster.setFromCamera(ndc, camera);
      const hits = state.raycaster.intersectObjects(content.children, true);
      for (const h of hits) {
        let o: THREE.Object3D | null = h.object;
        while (o && o.userData.id === undefined) o = o.parent;
        if (!o || !(o as THREE.Mesh).visible) continue;
        const deployable = o.userData.open !== undefined || !(o.userData.kind in KINDS);
        return { id: o.userData.id as string, deployable, point: h.point };
      }
      return null;
    };

    const refreshGhost = () => {
      state.hoverDirty = false;
      ghost.clear();
      state.pending = null;
      host.dataset.hover = '';
      host.dataset.pending = '';
      const ed = editorRef.current;
      const res = resolvedRef.current;
      if (!ed || !res) return;
      const hit = pick();
      if (!hit) return;
      // что под курсором и что будет сделано по клику: для тестов и отладки
      host.dataset.hover = hit.id;
      if (ed.tool === 'hammer') {
        const src = content.children.find(c => c.userData.id === hit.id);
        if (!src) return;
        const copy = hit.deployable
          ? buildDeployable(res.deployables.find(d => d.id === hit.id)!)
          : buildElement(res.elements.find(e => e.id === hit.id)!);
        ghost.add(ghostify(copy, HAMMER_MAT));
        state.pending = { type: 'hammer', id: hit.id, deployable: hit.deployable };
        return;
      }
      if (hit.deployable) return;
      const hostEl = res.elements.find(e => e.id === hit.id);
      if (!hostEl) return;
      if (ed.tool === 'build') {
        const key = `${hit.id}|${ed.kind}`;
        const pt: [number, number, number] = [hit.point.x, hit.point.y, hit.point.z];
        let cands = state.candCache.get(key);
        if (!cands) { cands = placementsNear(ed.blueprint, res, ed.kind, hit.id, pt); state.candCache.set(key, cands); }
        if (cands.length === 0) return;
        if (state.altKey !== key) { state.altKey = key; state.alt = 0; }
        const p = cands[state.alt % cands.length];
        const el: ResolvedElement = { id: '__ghost__', kind: ed.kind, grade: ed.grade, ...p.transform };
        ghost.add(ghostify(buildElement(el), GHOST_MAT));
        state.pending = { type: 'element', kind: ed.kind, attach: p.attach };
        return;
      }
      // объект
      const local = toLocal(hostEl, hit.point);
      const dp = deployPlacement(ed.blueprint, res, ed.deployKind, hit.id, local);
      if (!dp) return;
      const d = dp.deployable;
      const rd: ResolvedDeployable = {
        id: '__ghost__', kind: d.kind, parent: hit.id, hinge: d.hinge ?? 'left', opens: d.opens ?? 'outward', open: false,
        direction: d.direction, ...dp.transform,
      };
      ghost.add(ghostify(buildDeployable(rd), GHOST_MAT));
      state.pending = { type: 'deploy', d };
    };

    const act = (button: number) => {
      const ed = editorRef.current;
      const p = state.pending;
      if (!ed || !p) return;
      if (p.type === 'element' && button === 0) ed.onPlace(p.kind, p.attach);
      else if (p.type === 'deploy' && button === 0) ed.onDeploy(p.d);
      else if (p.type === 'hammer') {
        if (button === 0 && !p.deployable) ed.onUpgrade(p.id);
        if (button === 2) ed.onRemove(p.id, p.deployable);
      }
      state.candCache.clear();
      state.hoverDirty = true;
    };

    const down = { x: 0, y: 0, button: -1 };
    const onPointerMove = (e: PointerEvent) => {
      if (fly.isLocked) return;
      const r = renderer.domElement.getBoundingClientRect();
      state.pointer = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      state.hoverDirty = true;
    };
    const onPointerDown = (e: PointerEvent) => {
      down.x = e.clientX; down.y = e.clientY; down.button = e.button;
      // в полёте курсор захвачен: действие сразу, прицел в центре
      if (fly.isLocked && editorRef.current) { refreshGhost(); act(e.button); }
    };
    const onPointerUp = (e: PointerEvent) => {
      if (fly.isLocked || !editorRef.current || e.button !== down.button) return;
      // клик без перетаскивания: орбита крутится перетаскиванием, клик — действие
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
      act(e.button);
    };
    const onContextMenu = (e: Event) => { if (editorRef.current) e.preventDefault(); };
    const onLeave = () => { if (!fly.isLocked) { state.pointer = null; state.hoverDirty = true; } };
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointerleave', onLeave);
    renderer.domElement.addEventListener('contextmenu', onContextMenu);

    const onKeyDown = (e: KeyboardEvent) => {
      if (editorRef.current && !(e.target instanceof HTMLInputElement)) {
        if (e.code === 'KeyR') { state.alt++; state.hoverDirty = true; e.preventDefault(); return; }
        if (e.code === 'Delete' || e.code === 'Backspace') {
          const p = state.pending;
          if (p && p.type === 'hammer') { editorRef.current.onRemove(p.id, p.deployable); state.candCache.clear(); state.hoverDirty = true; }
          e.preventDefault();
          return;
        }
      }
      if (!fly.isLocked || !MOVE_KEYS.has(e.code)) return;
      keys.add(e.code);
      e.preventDefault();
    };
    const onKeyUp = (e: KeyboardEvent) => keys.delete(e.code);
    const onUnlock = () => keys.clear();
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    fly.addEventListener('unlock', onUnlock);

    let lastCam = new THREE.Vector3();
    let lastQuat = new THREE.Quaternion();
    const tick = () => {
      const dt = Math.min(state.clock.getDelta(), 0.1);
      if (fly.isLocked) applyFlight(camera, keys, dt);
      else if (controls.enabled) controls.update();
      animateDoors(state.doors, dt);
      state.raid.tick(performance.now());
      // в полёте прицел в центре: призрак обновляется, когда камера сдвинулась
      if (editorRef.current && fly.isLocked && (!camera.position.equals(lastCam) || !camera.quaternion.equals(lastQuat))) {
        lastCam = camera.position.clone(); lastQuat = camera.quaternion.clone(); state.hoverDirty = true;
      }
      if (state.hoverDirty) {
        refreshGhost();
        const p = state.pending;
        host.dataset.pending = p ? `${p.type}:${p.type === 'hammer' ? p.id : p.type === 'element' ? p.attach.to + '/' + p.attach.socket : p.d.kind}` : '';
      }
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
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointerleave', onLeave);
      renderer.domElement.removeEventListener('contextmenu', onContextMenu);
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
    s.ghost.clear();
    s.candCache.clear();
    s.hoverDirty = true;
    if (!resolved) return;

    for (const el of resolved.elements) s.content.add(buildElement(el));
    for (const d of resolved.deployables) s.content.add(buildDeployable(d));
    s.doors = collectDoors(s.content);
    applyDoorsOpen(s, doorsOpen);
    s.raid.apply(raid);

    // Смена материала или дверей перестраивает меши, но камеру не трогает
    if (framedKey.current === frameKey) return;
    framedKey.current = frameKey;
    const bounds = new THREE.Box3().setFromObject(s.content);
    if (bounds.isEmpty()) return;
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3()).length();
    s.controls.target.copy(center);
    const dist = Math.max(8, size * 1.1);
    // Камера смотрит со стороны первой двери, иначе первого проёма или окна (3/4-ракурс), иначе — с фиксированного угла
    const door = resolved.deployables.find(d => d.kind !== 'tool-cupboard');
    const opening = resolved.elements.find(e => KINDS[e.kind].opening || e.kind === 'window-frame');
    const facing = door?.rotation ?? opening?.rotation;
    const az = ((facing !== undefined ? facing + 35 : 135) * Math.PI) / 180;
    s.camera.position.set(
      center.x + dist * 0.8 * Math.cos(az),
      center.y + dist * 0.6,
      center.z + dist * 0.8 * Math.sin(az),
    );
    s.controls.update();
  }, [resolved]);

  // Смена инструмента или типа — призрак пересчитывается
  useEffect(() => {
    const s = refs.current;
    if (!s) return;
    s.candCache.clear();
    s.alt = 0;
    s.hoverDirty = true;
    if (!editor) { s.ghost.clear(); s.pending = null; }
    s.renderer.domElement.style.cursor = editor ? 'crosshair' : '';
  }, [editor]);

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

  return (
    <div className={`viewer3d${editor && mode === 'fly' ? ' viewer3d--aim' : ''}`} ref={hostRef} />
  );
};

export default Viewer3D;
