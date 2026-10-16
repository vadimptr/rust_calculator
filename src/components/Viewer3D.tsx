import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { animateDoors, buildDeployable, buildElement, collectDoors, setDoorOpen } from '../blueprint/meshes.ts';
import { KINDS, wallHeight } from '../blueprint/catalog.ts';
import type { Attach, Blueprint, Deployable, DeployableKind, ElementKind, Grade, Resolved, ResolvedDeployable, ResolvedElement } from '../blueprint/types.ts';
import { MOVE_KEYS, applyFlight } from '../blueprint/flight.ts';
import { RaidOverlay } from '../blueprint/raidOverlay.ts';
import type { RaidView } from '../blueprint/raidOverlay.ts';
import { deployPlacement, placementAnchor, placementsNear } from '../blueprint/editor.ts';
import { gableWalls } from '../blueprint/conditional.ts';
import type { Placement } from '../blueprint/editor.ts';

export type CameraMode = 'orbit' | 'fly';

export type EditorTool = 'build' | 'deploy' | 'hammer';

/** Режим стройки: что в руках и куда сообщать о действиях. Документ — проверенный чертёж. */
export interface EditorState {
  tool: EditorTool;
  /** Киянка в режиме сноса: ЛКМ (тап на тачпаде) сносит вместо апгрейда. */
  demolish: boolean;
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
  /** Ключ текущего призрака: пока размещение то же, меш не пересобирается. */
  ghostKey: string;
  /** Ключ крепления, показанного в прошлый раз: сокет меняется только на заметно более близкий. */
  lastAttach: string;
}

// Призраки: только лицевые грани и без записи глубины — полупрозрачные грани одной коробки не
// спорят друг с другом за порядок отрисовки, иначе при движении камеры они мерцают
const GHOST_MAT = new THREE.MeshStandardMaterial({ color: 0x3b9dff, emissive: 0x16589e, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.FrontSide });
const HAMMER_MAT = new THREE.MeshStandardMaterial({ color: 0xffc34d, emissive: 0x9c6a12, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.FrontSide });
const DEMOLISH_MAT = new THREE.MeshStandardMaterial({ color: 0xff5a4d, emissive: 0x8e1d14, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.FrontSide });
const GHOST_EDGE = new THREE.LineBasicMaterial({ color: 0xbfe0ff, transparent: true, opacity: 0.9 });
const GROUND_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

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
      hoverDirty: false, pending: null, alt: 0, altKey: '', candCache: new Map(), ghostKey: '', lastAttach: '',
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

    /** Показать призрак: меш пересобирается только когда сменился ключ размещения. */
    const showGhost = (key: string, pending: Pending, build: () => THREE.Object3D) => {
      state.pending = pending;
      if (state.ghostKey === key) return;
      ghost.clear();
      ghost.add(build());
      state.ghostKey = key;
    };

    /** Точка прицела на земле (плоскость верха фундаментов), когда луч не попал ни в один блок. */
    const groundPoint = (): THREE.Vector3 | null => {
      const ndc = fly.isLocked ? new THREE.Vector2(0, 0) : state.pointer;
      if (!ndc) return null;
      state.raycaster.setFromCamera(ndc, camera);
      const p = new THREE.Vector3();
      return state.raycaster.ray.intersectPlane(GROUND_PLANE, p) ? p : null;
    };

    /** Выбрать размещение, ближайшее к точке прицела (с гистерезисом и перебором по R), и показать призрак. */
    const showPlacement = (ed: EditorState, cands: Placement[], pt: [number, number, number]) => {
      if (cands.length === 0) return false;
      // ближайший к точке прицела; прежнее место держится, пока новое не станет ближе на заметную величину —
      // точка прицела при движении гуляет, и без гистерезиса призрак прыгал между соседними сокетами
      const h = KINDS[ed.kind].category === 'wallType' ? wallHeight(ed.kind) / 2 : 0;
      const dist = (p: Placement) => Math.hypot(p.transform.position[0] - pt[0], p.transform.position[1] + h - pt[1], p.transform.position[2] - pt[2]);
      const sorted = [...cands].sort((a, b) => dist(a) - dist(b));
      let p = sorted[0];
      const prev = sorted.find(c => JSON.stringify(c.attach) === state.lastAttach);
      if (prev && dist(prev) <= dist(p) + 0.4) p = prev;
      // R перебирает варианты с тем же якорем (ребром опоры): крыша над зданием или наружу, пол по ту или
      // другую сторону стены, поворот лестницы — а не другие рёбра. Смена якоря сбрасывает перебор.
      const anchor = placementAnchor(ed.kind, p);
      if (state.altKey !== anchor) { state.altKey = anchor; state.alt = 0; }
      const group = sorted.filter(c => placementAnchor(ed.kind, c) === anchor);
      if (state.alt > 0 && group.length > 1) p = group[state.alt % group.length];
      const attachKey = JSON.stringify(p.attach);
      state.lastAttach = attachKey;
      const el: ResolvedElement = { id: '__ghost__', kind: ed.kind, grade: ed.grade, ...p.transform };
      const cur = resolvedRef.current;
      const gable = ed.kind === 'wall' && cur ? gableWalls({ ...cur, elements: [...cur.elements, el] }).get(el.id) : undefined;
      showGhost(`build|${ed.kind}|${ed.grade}|${attachKey}`, { type: 'element', kind: ed.kind, attach: p.attach }, () => ghostify(buildElement(el, gable), GHOST_MAT));
      return true;
    };

    const candidatesOf = (ed: EditorState, res: Resolved, hostId: string, pt: [number, number, number]) => {
      const key = `${hostId}|${ed.kind}`;
      let cands = state.candCache.get(key);
      if (!cands) { cands = placementsNear(ed.blueprint, res, ed.kind, hostId, pt); state.candCache.set(key, cands); }
      return cands;
    };

    /** Кандидаты от всех блоков рядом с точкой прицела, без дублей по положению: один и тот же сокет
     *  (ребро пола и верх стены под ним) принадлежит нескольким блокам. */
    const candidatesAround = (ed: EditorState, res: Resolved, hostIds: string[], pt: [number, number, number]) => {
      const seen = new Set<string>();
      const out: Placement[] = [];
      for (const id of hostIds) for (const c of candidatesOf(ed, res, id, pt)) {
        const k = `${c.transform.position.map(v => v.toFixed(2)).join('|')}|${c.transform.rotation.toFixed(0)}|${c.attach.turns ?? 0}`;
        if (!seen.has(k)) { seen.add(k); out.push(c); }
      }
      return out;
    };

    const refreshGhost = () => {
      state.hoverDirty = false;
      const ed = editorRef.current;
      const res = resolvedRef.current;
      const none = () => { ghost.clear(); state.ghostKey = ''; state.pending = null; state.lastAttach = ''; };
      host.dataset.hover = '';
      host.dataset.pending = '';
      if (!ed || !res) return none();
      const hit = pick();
      // Фундаменты, съезды и ступени ставятся как в игре — прицелом в землю рядом с постройкой: хозяином
      // становится любой фундамент поблизости, а не только тот, в который попал луч
      const groundKind = ed.tool === 'build' && (KINDS[ed.kind].isFoundation || KINDS[ed.kind].category === 'ramp');
      if (groundKind) {
        const g = hit && !hit.deployable ? hit.point : groundPoint();
        if (!g) return none();
        const pt: [number, number, number] = [g.x, 0, g.z];
        const hosts = res.elements.filter(e => KINDS[e.kind].isFoundation && Math.hypot(e.position[0] - pt[0], e.position[2] - pt[2]) < 6).map(e => e.id);
        host.dataset.hover = hit?.id ?? 'ground';
        return showPlacement(ed, candidatesAround(ed, res, hosts, pt), pt) ? undefined : none();
      }
      if (!hit) return none();
      // что под курсором и что будет сделано по клику: для тестов и отладки
      host.dataset.hover = hit.id;
      if (ed.tool === 'hammer') {
        const src = content.children.find(c => c.userData.id === hit.id);
        if (!src) return none();
        const mat = ed.demolish ? DEMOLISH_MAT : HAMMER_MAT;
        return showGhost(`hammer|${hit.id}|${ed.demolish}`, { type: 'hammer', id: hit.id, deployable: hit.deployable }, () => ghostify(
          hit.deployable ? buildDeployable(res.deployables.find(d => d.id === hit.id)!) : buildElement(res.elements.find(e => e.id === hit.id)!, gableWalls(res).get(hit.id)), mat));
      }
      if (hit.deployable) return none();
      const hostEl = res.elements.find(e => e.id === hit.id);
      if (!hostEl) return none();
      if (ed.tool === 'build') {
        const pt: [number, number, number] = [hit.point.x, hit.point.y, hit.point.z];
        // хозяева — все блоки рядом с точкой прицела: сокет на ребре пола есть и у стены под ним
        const hosts = res.elements
          .filter(e => KINDS[e.kind].category !== 'stairs' && Math.hypot(e.position[0] - pt[0], e.position[2] - pt[2]) < 3.3 && Math.abs(e.position[1] - pt[1]) < 3.6)
          .map(e => e.id);
        if (!hosts.includes(hit.id)) hosts.unshift(hit.id);
        return showPlacement(ed, candidatesAround(ed, res, hosts, pt), pt) ? undefined : none();
      }
      // объект
      const local = toLocal(hostEl, hit.point);
      const dp = deployPlacement(ed.blueprint, res, ed.deployKind, hit.id, local);
      if (!dp) return none();
      const d = dp.deployable;
      const rd: ResolvedDeployable = {
        id: '__ghost__', kind: d.kind, parent: hit.id, hinge: d.hinge ?? 'left', opens: d.opens ?? 'outward', open: false,
        direction: d.direction, ...dp.transform,
      };
      // шкаф и дроп-бокс едут за курсором: ключ без смещения, позиция обновляется на месте
      const posKey = d.kind === 'tool-cupboard' || d.kind === 'drop-box' ? '' : JSON.stringify(d);
      showGhost(`deploy|${hit.id}|${d.kind}|${posKey}`, { type: 'deploy', d }, () => ghostify(buildDeployable(rd), GHOST_MAT));
      if (!posKey) {
        const g = ghost.children[0];
        if (g) { g.position.set(rd.position[0], rd.position[1], rd.position[2]); g.rotation.y = (-rd.rotation * Math.PI) / 180; }
      }
    };

    const act = (button: number) => {
      const ed = editorRef.current;
      const p = state.pending;
      if (!ed || !p) return;
      if (p.type === 'element' && button === 0) ed.onPlace(p.kind, p.attach);
      else if (p.type === 'deploy' && button === 0) ed.onDeploy(p.d);
      else if (p.type === 'hammer') {
        if (button === 2 || (button === 0 && ed.demolish)) ed.onRemove(p.id, p.deployable);
        else if (button === 0 && !p.deployable) ed.onUpgrade(p.id);
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
        host.dataset.pending = p ? `${p.type}:${p.type === 'hammer' ? p.id : p.type === 'element' ? JSON.stringify(p.attach) : p.d.kind}` : '';
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
    s.ghostKey = '';
    s.candCache.clear();
    s.hoverDirty = true;
    if (!resolved) return;

    const gables = gableWalls(resolved);
    for (const el of resolved.elements) s.content.add(buildElement(el, gables.get(el.id)));
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
    s.ghostKey = '';
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
