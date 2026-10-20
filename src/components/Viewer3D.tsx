import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { animateDoors, buildCornerPost, buildDeployable, buildElement, collectDoors, entityMatrix, setDoorOpen } from '../blueprint/meshes.ts';
import type { DoorAnim } from '../blueprint/meshes.ts';
import { onModelLoaded, pieceManifest } from '../blueprint/models.ts';
import { activePieces, aimBox, rayBox } from '../blueprint/pieces.ts';
import type { AimBox } from '../blueprint/pieces.ts';
import { KINDS } from '../blueprint/catalog.ts';
import type { Attach, Blueprint, Deployable, DeployableKind, ElementKind, Resolved, ResolvedDeployable, ResolvedElement } from '../blueprint/types.ts';
import { MOVE_KEYS, applyFlight } from '../blueprint/flight.ts';
import { RaidOverlay } from '../blueprint/raidOverlay.ts';
import type { RaidView } from '../blueprint/raidOverlay.ts';
import { aimDistance, deployPlacement, placementAnchor, placementsNear, rotatable } from '../blueprint/editor.ts';
import { cornerPosts, gableWalls, hipRoofs, triangleRoofFillers } from '../blueprint/conditional.ts';
import { COLLAPSE, computeStability } from '../blueprint/stability.ts';
import type { Placement } from '../blueprint/editor.ts';
import RadialMenu, { radialOuter } from './RadialMenu';
import type { RadialMenuItem } from './RadialMenu';

export type CameraMode = 'orbit' | 'fly';

export type EditorTool = 'build' | 'deploy' | 'hammer' | 'view';

/** Пункт радиального меню. */
export type RadialItem = RadialMenuItem;

/** Режим стройки: что в руках и куда сообщать о действиях. blueprint = null — пустой участок. */
export interface EditorState {
  tool: EditorTool;
  kind: ElementKind;
  deployKind: DeployableKind;
  blueprint: Blueprint | null;
  /** Пункты радиального меню (правая кнопка) для каждого инструмента. */
  radial: Record<EditorTool, RadialItem[]>;
  onPlace: (kind: ElementKind, attach: Attach) => void;
  /** Первый фундамент на пустом участке. */
  onPlaceRoot: (kind: ElementKind) => void;
  onDeploy: (d: Omit<Deployable, 'id'>) => void;
  onRemove: (id: string, deployable: boolean) => void;
  /** Выбор в радиальном меню: блок плана, объект или (киянка) грейд / снос для блока под курсором. */
  onRadial: (tool: EditorTool, itemId: string, targetId: string | null, targetDeployable: boolean) => void;
}

interface RadialState { x: number; y: number; items: RadialItem[]; sel: number; tool: EditorTool; targetId: string | null; targetDeployable: boolean }

interface Viewer3DProps {
  resolved: Resolved | null;
  mode: CameraMode;
  /** Открыть все двери (поверх собственного open у каждой двери). */
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
  | { type: 'root'; kind: ElementKind }
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
  doorState: Map<string, boolean>;
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
  /** Стабильность блоков текущей сцены (0..1). */
  stability: Map<string, number>;
  pieces: Map<string, string[]>;
  ghostStab: number;
  /** Подпись в углу сцены: стабильность наведённого блока или призрака. */
  label: HTMLDivElement;
  /** Ключ крепления, показанного в прошлый раз: сокет меняется только на заметно более близкий. */
  lastAttach: string;
}

// Призраки: только лицевые грани и без записи глубины — полупрозрачные грани одной коробки не
// спорят друг с другом за порядок отрисовки, иначе при движении камеры они мерцают
const GHOST_MAT = new THREE.MeshStandardMaterial({ color: 0x3b9dff, emissive: 0x16589e, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.FrontSide });
const HAMMER_MAT = new THREE.MeshStandardMaterial({ color: 0xffc34d, emissive: 0x9c6a12, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.FrontSide });
const FALL_MAT = new THREE.MeshStandardMaterial({ color: 0xff8a3d, emissive: 0x8a3a10, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.FrontSide });
const GHOST_EDGE = new THREE.LineBasicMaterial({ color: 0xbfe0ff, transparent: true, opacity: 0.9 });
const GROUND_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

/** Перекрасить построенный объект в призрак: материалы меша и рёбер заменяются, тени выключаются. */
function ghostify(o: THREE.Object3D, mat: THREE.Material): THREE.Object3D {
  o.traverse(n => {
    if ((n as THREE.Mesh).isMesh && n.userData.keepMaterial) { n.renderOrder = 22; return; }
    if ((n as THREE.Mesh).isMesh) { (n as THREE.Mesh).material = mat; n.castShadow = false; n.receiveShadow = false; n.renderOrder = 20; }
    else if ((n as THREE.LineSegments).isLineSegments) { (n as THREE.LineSegments).material = GHOST_EDGE; n.renderOrder = 21; }
  });
  return o;
}

function piecesWith(resolved: Resolved, extra: ResolvedElement): string[] | undefined {
  const m = pieceManifest();
  if (!m) return undefined;
  return activePieces(m, { elements: [...resolved.elements.filter(e => e.id !== extra.id), extra], deployables: [] }, entityMatrix).get(extra.id);
}

const EMPTY: Resolved = { elements: [], deployables: [] };

function doorOwner(door: THREE.Object3D): THREE.Object3D | null {
  let owner: THREE.Object3D | null = door;
  while (owner && owner.userData.id === undefined) owner = owner.parent;
  return owner;
}

function applyDoorsOpen(s: SceneRefs) {
  for (const door of s.doors) {
    const owner = doorOwner(door);
    const id = owner?.userData.id as string | undefined;
    const own = id !== undefined ? s.doorState.get(id) : undefined;
    setDoorOpen(door, own ?? owner?.userData.open === true);
  }
}

function toggleDoorsOf(s: SceneRefs, id: string): boolean {
  const doors = s.doors.filter(d => doorOwner(d)?.userData.id === id);
  if (!doors.length) return false;
  const open = !(doors[0].userData.door as DoorAnim).target;
  s.doorState.set(id, open);
  for (const d of doors) setDoorOpen(d, open);
  return true;
}

/** Точка в локальных осях элемента (x по нормали, y вверх, z вдоль). */
function toLocal(el: ResolvedElement, p: THREE.Vector3): [number, number, number] {
  const a = (-el.rotation * Math.PI) / 180;
  const dx = p.x - el.position[0], dy = p.y - el.position[1], dz = p.z - el.position[2];
  return [dx * Math.cos(a) - dz * Math.sin(a), dy, dx * Math.sin(a) + dz * Math.cos(a)];
}

const Viewer3D: React.FC<Viewer3DProps> = ({ resolved, mode, raid, raidPlay, frameKey, editor }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const refs = useRef<SceneRefs | null>(null);
  const framedKey = useRef<string | null>(null);
  const editorRef = useRef<EditorState | null>(editor);
  const [radial, setRadial] = useState<RadialState | null>(null);
  const radialRef = useRef<RadialState | null>(null);
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
    // правая кнопка — радиальное меню стройки; сдвиг камеры — средней кнопкой
    controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.PAN, RIGHT: null as unknown as THREE.MOUSE };

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

    const world = new THREE.Group();
    world.scale.z = -1;
    scene.add(world);
    const content = new THREE.Group();
    world.add(content);
    const ghost = new THREE.Group();
    world.add(ghost);
    const label = document.createElement('div');
    label.className = 'viewer3d__label';
    host.appendChild(label);

    const fly = new PointerLockControls(camera, renderer.domElement);
    const keys = new Set<string>();

    const state: SceneRefs = {
      renderer, scene, camera, controls, fly, keys, clock: new THREE.Clock(), content, doors: [], doorState: new Map(),
      raid: new RaidOverlay(content, world), frame: 0, ghost, raycaster: new THREE.Raycaster(), pointer: null,
      hoverDirty: false, pending: null, alt: 0, altKey: '', candCache: new Map(), ghostKey: '', lastAttach: '', stability: new Map(), pieces: new Map(), ghostStab: 1, label,
    };
    refs.current = state;

    // --- режим стройки: рейкаст по сцене, призрак, действия
    const pick = (): Hit | null => {
      const ndc = fly.isLocked ? new THREE.Vector2(0, 0) : state.pointer;
      if (!ndc) return null;
      // сцена могла быть только что перестроена: мировые матрицы новых мешей ещё не посчитаны
      world.updateMatrixWorld(true);
      state.raycaster.setFromCamera(ndc, camera);
      const hits = state.raycaster.intersectObjects(content.children, true);
      for (const h of hits) {
        // только поверхности: контурные линии ловят луч в радиусе метра, и прицел прилипал к рёбрам
        if (!(h.object as THREE.Mesh).isMesh) continue;
        let o: THREE.Object3D | null = h.object;
        while (o && o.userData.id === undefined) o = o.parent;
        if (!o || !(o as THREE.Mesh).visible) continue;
        const deployable = o.userData.open !== undefined || !(o.userData.kind in KINDS);
        return { id: o.userData.id as string, deployable, point: world.worldToLocal(h.point.clone()) };
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
      return state.raycaster.ray.intersectPlane(GROUND_PLANE, p) ? world.worldToLocal(p) : null;
    };

    const boxes = new WeakMap<Placement, AimBox | null>();
    const boxOf = (kind: ElementKind, c: Placement, res: Resolved): AimBox | null => {
      if (boxes.has(c)) return boxes.get(c)!;
      const manifest = pieceManifest();
      const hostEl = res.elements.find(e => e.id === c.attach.to);
      const child: ResolvedElement = { id: '__aim__', kind, grade: 'twig', ...c.transform };
      const hm = hostEl && entityMatrix(hostEl), cm = entityMatrix(child);
      const box = manifest && hostEl && hm && cm && manifest[hostEl.kind] && manifest[kind]
        ? aimBox({ el: hostEl, def: manifest[hostEl.kind], matrix: hm }, { el: child, def: manifest[kind], matrix: cm }) : null;
      if (manifest) boxes.set(c, box);
      return box;
    };
    const aimRay = (): { origin: [number, number, number]; dir: [number, number, number] } => {
      const o = world.worldToLocal(state.raycaster.ray.origin.clone());
      const d = state.raycaster.ray.direction;
      return { origin: [o.x, o.y, o.z], dir: [d.x, d.y, -d.z] };
    };

    /** Выбрать размещение по прицелу, как в игре: луч против зон выбора сокетов, иначе ближайшее к точке (с гистерезисом и перебором по R). */
    const showPlacement = (ed: EditorState, cands: Placement[], pt: [number, number, number] | null, reach: number) => {
      if (cands.length === 0) return false;
      const res = resolvedRef.current;
      const ray = aimRay();
      const tOf = (c: Placement) => {
        const box = res ? boxOf(ed.kind, c, res) : null;
        const t = box ? rayBox(ray.origin, ray.dir, box) : null;
        return t !== null && t <= reach ? t : Infinity;
      };
      const byRay = cands.map(c => ({ c, t: tOf(c) })).filter(x => x.t < Infinity);
      const tMin = Math.min(...byRay.map(x => x.t));
      const aim = pt ?? (byRay.length ? ray.origin.map((v, i) => v + ray.dir[i] * tMin) as [number, number, number] : null);
      if (!aim) return false;
      const along = Math.hypot(ray.dir[0], ray.dir[2]) || 1;
      const uphill = (p: Placement) => KINDS[ed.kind].category === 'ramp' && p.attach.socket === 'top'
        ? (Math.cos((p.transform.rotation * Math.PI) / 180) * ray.dir[0] + Math.sin((p.transform.rotation * Math.PI) / 180) * ray.dir[2]) / along : 0;
      const dist = (p: Placement) => aimDistance(ed.kind, p, aim) - uphill(p);
      byRay.sort((a, b) => (Math.abs(a.t - b.t) < 0.05 ? dist(a.c) - dist(b.c) : a.t - b.t));
      const sorted = byRay.length ? [...byRay.map(x => x.c), ...cands.filter(c => tOf(c) === Infinity)] : [...cands].sort((a, b) => dist(a) - dist(b));
      if (!byRay.length && !pt) return false;
      let p = sorted[0];
      const prev = sorted.find(c => JSON.stringify(c.attach) === state.lastAttach);
      if (prev) {
        const tp = tOf(prev), t0 = tOf(p);
        const keep = byRay.length ? tp < Infinity && (Math.abs(tp - t0) < 0.05 ? dist(prev) <= dist(p) + 0.4 : tp <= t0 + 0.3) : dist(prev) <= dist(p) + 0.4;
        if (keep) p = prev;
      }
      // R перебирает варианты с тем же якорем (ребром опоры): крыша над зданием или наружу, пол по ту или
      // другую сторону стены, поворот лестницы — а не другие рёбра. Смена якоря сбрасывает перебор.
      const anchor = placementAnchor(ed.kind, p);
      if (state.altKey !== anchor) { state.altKey = anchor; state.alt = 0; }
      const group = sorted.filter(c => placementAnchor(ed.kind, c) === anchor).sort((a, b) => (a.attach.rise ?? 0) - (b.attach.rise ?? 0));
      if (state.alt > 0 && group.length > 1) p = group[state.alt % group.length];
      const attachKey = JSON.stringify(p.attach);
      state.lastAttach = attachKey;
      const el: ResolvedElement = { id: '__ghost__', kind: ed.kind, grade: 'twig', ...p.transform };
      const cur = resolvedRef.current;
      const withGhost = cur ? { ...cur, elements: [...cur.elements, el] } : null;
      const gable = ed.kind === 'wall' && withGhost ? gableWalls(withGhost).get(el.id) : undefined;
      // стабильность призрака: если ниже 5%, блок обрушится сразу после постановки
      const key = `build|${ed.kind}|${attachKey}`;
      if (state.ghostKey !== key && withGhost && ed.blueprint) state.ghostStab = computeStability(withGhost).get(el.id) ?? 1;
      const st = state.ghostStab;
      label.textContent = st < COLLAPSE ? `Обрушится: стабильность ${Math.round(st * 100)}%` : `Стабильность ${Math.round(st * 100)}%`;
      if (st < COLLAPSE) label.className = 'viewer3d__label viewer3d__label--bad';
      if (KINDS[ed.kind].category === 'ramp' && p.attach.socket === 'top') label.textContent += p.attach.rise ? ' · высокий съезд, R — низкий' : ' · низкий съезд, R — высокий';
      else if (KINDS[ed.kind].isFoundation && group.length > 1) label.textContent += ` · высота ${p.transform.position[1]} м, R — сменить`;
      showGhost(key, { type: 'element', kind: ed.kind, attach: p.attach }, () => ghostify(buildElement(el, gable, undefined, piecesWith(cur ?? EMPTY, el)), st < COLLAPSE ? FALL_MAT : GHOST_MAT));
      return true;
    };

    const candidatesOf = (ed: EditorState, res: Resolved, hostId: string, pt: [number, number, number] | null) => {
      const key = `${hostId}|${ed.kind}`;
      let cands = state.candCache.get(key);
      if (!cands) { cands = ed.blueprint ? placementsNear(ed.blueprint, res, ed.kind, hostId, pt ?? res.elements.find(e => e.id === hostId)!.position) : []; state.candCache.set(key, cands); }
      return cands;
    };

    /** Кандидаты от всех блоков рядом с точкой прицела, без дублей по положению: один и тот же сокет
     *  (ребро пола и верх стены под ним) принадлежит нескольким блокам. */
    const candidatesAround = (ed: EditorState, res: Resolved, hostIds: string[], pt: [number, number, number] | null) => {
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
      label.textContent = '';
      label.className = 'viewer3d__label';
      if (!ed || !res || ed.tool === 'view') return none();
      // пустой участок: первый фундамент — корень постройки в начале координат
      if (res.elements.length === 0) {
        if (ed.tool !== 'build' || !KINDS[ed.kind].isFoundation) return none();
        const el: ResolvedElement = { id: '__ghost__', kind: ed.kind, grade: 'twig', position: [0, 0, 0], rotation: 0, level: 0 };
        host.dataset.hover = 'ground';
        return showGhost(`root|${ed.kind}`, { type: 'root', kind: ed.kind }, () => ghostify(buildElement(el, undefined, undefined, piecesWith(EMPTY, el)), GHOST_MAT));
      }
      const hit = pick();
      // Фундаменты, съезды и ступени ставятся как в игре — прицелом в землю рядом с постройкой: хозяином
      // становится любой фундамент поблизости, а не только тот, в который попал луч
      const ramp = KINDS[ed.kind].category === 'ramp';
      const groundKind = ed.tool === 'build' && (KINDS[ed.kind].isFoundation || ramp);
      if (groundKind) {
        const g = hit && !hit.deployable ? hit.point : groundPoint();
        if (!g) return none();
        const pt: [number, number, number] = [g.x, ramp && hit && !hit.deployable ? g.y : 0, g.z];
        const hosts = res.elements.filter(e => {
          const info = KINDS[e.kind];
          if (!(info.isFoundation || (ramp && (info.category === 'cell' || info.category === 'ramp') && !info.isFrame))) return false;
          return Math.hypot(e.position[0] - pt[0], e.position[2] - pt[2]) < 6 && (!ramp || Math.abs(e.position[1] - pt[1]) < 3.6);
        }).map(e => e.id);
        host.dataset.hover = hit?.id ?? 'ground';
        return showPlacement(ed, candidatesAround(ed, res, hosts, pt), pt, Infinity) ? undefined : none();
      }
      if (!hit && ed.tool === 'build') {
        const ray = aimRay();
        const hosts = res.elements.filter(e => {
          const v = e.position.map((x, i) => x - ray.origin[i]);
          const t = v[0] * ray.dir[0] + v[1] * ray.dir[1] + v[2] * ray.dir[2];
          const d = Math.hypot(v[0] - ray.dir[0] * t, v[1] - ray.dir[1] * t, v[2] - ray.dir[2] * t);
          return t > 0 && d < 4 && KINDS[e.kind].category !== 'stairs';
        }).map(e => e.id);
        return showPlacement(ed, candidatesAround(ed, res, hosts, null), null, 80) ? undefined : none();
      }
      if (!hit) return none();
      // что под курсором и что будет сделано по клику: для тестов и отладки
      host.dataset.hover = hit.id;
      if (ed.tool === 'hammer') {
        const src = content.children.find(c => c.userData.id === hit.id);
        if (!src) return none();
        const st = state.stability.get(hit.id);
        if (st !== undefined) label.textContent = `${hit.id}: стабильность ${Math.round(st * 100)}%`;
        const mat = HAMMER_MAT;
        return showGhost(`hammer|${hit.id}`, { type: 'hammer', id: hit.id, deployable: hit.deployable }, () => ghostify(
          hit.deployable ? buildDeployable(res.deployables.find(d => d.id === hit.id)!) : buildElement(res.elements.find(e => e.id === hit.id)!, gableWalls(res).get(hit.id), undefined, state.pieces.get(hit.id)), mat));
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
        const hitT = state.raycaster.ray.origin.distanceTo(world.localToWorld(hit.point.clone()));
        return showPlacement(ed, candidatesAround(ed, res, hosts, pt), pt, hitT + 1.5) ? undefined : none();
      }
      // объект
      const local = toLocal(hostEl, hit.point);
      // шкаф: R поворачивает на 90° (прямо / боком)
      const turn = ed.deployKind === 'tool-cupboard' ? (state.alt % 4) * 90 : 0;
      const dp = ed.blueprint ? deployPlacement(ed.blueprint, res, ed.deployKind, hit.id, local, turn) : null;
      if (!dp) return none();
      const d = { ...dp.deployable };
      // дроп-бокс: R меняет направление передачи
      if (d.kind === 'drop-box' && state.alt % 2 === 1) d.direction = d.direction === 'in' ? 'out' : 'in';
      const rd: ResolvedDeployable = {
        id: '__ghost__', kind: d.kind, parent: hit.id, hinge: d.hinge ?? 'left', opens: d.opens ?? 'outward', open: false,
        direction: d.direction, ...dp.transform,
      };
      // шкаф и дроп-бокс едут за курсором: ключ без смещения, позиция обновляется на месте
      const posKey = d.kind === 'tool-cupboard' ? '' : d.kind === 'drop-box' ? `dir:${d.direction}` : JSON.stringify(d);
      showGhost(`deploy|${hit.id}|${d.kind}|${posKey}`, { type: 'deploy', d }, () => ghostify(buildDeployable(rd), GHOST_MAT));
      if (!posKey || posKey.startsWith('dir:')) {
        const g = ghost.children[0];
        if (g) { g.position.set(rd.position[0], rd.position[1], rd.position[2]); g.rotation.y = (-rd.rotation * Math.PI) / 180; }
      }
    };

    const act = (button: number) => {
      const ed = editorRef.current;
      if (!ed || button !== 0) return;
      const hit = pick();
      const p = state.pending;
      if (hit && (hit.deployable || !p) && toggleDoorsOf(state, hit.id)) return;
      if (!p) return;
      if (p.type === 'element') ed.onPlace(p.kind, p.attach);
      else if (p.type === 'root') ed.onPlaceRoot(p.kind);
      else if (p.type === 'deploy') ed.onDeploy(p.d);
      state.candCache.clear();
      state.hoverDirty = true;
    };

    const down = { x: 0, y: 0, button: -1 };
    // Радиальное меню: правая кнопка зажата — меню вокруг курсора, выбор по направлению, отпускание — применить
    const openRadial = (x: number, y: number) => {
      const ed = editorRef.current;
      if (!ed) return;
      if (ed.tool === 'view') return;
      if (ed.tool === 'hammer') { refreshGhost(); if (state.pending?.type !== 'hammer') return; }
      const p = state.pending;
      const target = p?.type === 'hammer' && !p.deployable ? ed.blueprint?.elements.find(e => e.id === p.id) : undefined;
      const items = ed.radial[ed.tool].filter(it => it.id !== 'rotate' || (target && rotatable(target.kind)));
      const r: RadialState = { x, y, items, sel: -1, tool: ed.tool, targetId: p?.type === 'hammer' ? p.id : null, targetDeployable: p?.type === 'hammer' ? p.deployable : false };
      radialRef.current = r; setRadial(r);
      fly.pointerSpeed = 0;
    };
    const moveRadial = (dx: number, dy: number) => {
      const r = radialRef.current;
      if (!r) return;
      const d = Math.hypot(dx, dy);
      let sel = -1;
      if (d > 24) {
        const n = r.items.length;
        const a = (Math.atan2(dx, -dy) + 2 * Math.PI) % (2 * Math.PI); // 0 — вверх, по часовой
        sel = Math.round(a / ((2 * Math.PI) / n)) % n;
      }
      if (sel !== r.sel) { const next = { ...r, sel }; radialRef.current = next; setRadial(next); }
    };
    const radialDelta = { x: 0, y: 0 };
    const RADIAL_REACH = 90;
    const radialMove = (mx: number, my: number) => {
      radialDelta.x += mx; radialDelta.y += my;
      const d = Math.hypot(radialDelta.x, radialDelta.y);
      if (d > RADIAL_REACH) { radialDelta.x *= RADIAL_REACH / d; radialDelta.y *= RADIAL_REACH / d; }
      moveRadial(radialDelta.x, radialDelta.y);
    };
    let radialPointer = -1;
    const closeRadial = () => {
      const r = radialRef.current;
      radialRef.current = null; setRadial(null);
      fly.pointerSpeed = 1;
      if (radialPointer >= 0 && renderer.domElement.hasPointerCapture(radialPointer)) renderer.domElement.releasePointerCapture(radialPointer);
      radialPointer = -1;
      renderer.domElement.style.cursor = editorRef.current ? 'crosshair' : '';
      const ed = editorRef.current;
      if (r && ed && r.sel >= 0) ed.onRadial(r.tool, r.items[r.sel].id, r.targetId, r.targetDeployable);
      state.candCache.clear();
      state.hoverDirty = true;
    };
    const onLockedMove = (e: MouseEvent) => {
      if (!fly.isLocked || !radialRef.current) return;
      radialMove(e.movementX, e.movementY);
    };
    document.addEventListener('mousemove', onLockedMove);
    const onPointerMove = (e: PointerEvent) => {
      if (fly.isLocked) return;
      if (radialRef.current) { radialMove(e.movementX, e.movementY); return; }
      const r = renderer.domElement.getBoundingClientRect();
      state.pointer = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      state.hoverDirty = true;
    };
    const onPointerDown = (e: PointerEvent) => {
      down.x = e.clientX; down.y = e.clientY; down.button = e.button;
      if (e.button === 2 && editorRef.current) {
        const r = host.getBoundingClientRect();
        radialDelta.x = 0; radialDelta.y = 0;
        if (fly.isLocked) openRadial(r.width / 2, r.height / 2);
        else openRadial(e.clientX - r.left, e.clientY - r.top);
        if (radialRef.current && !fly.isLocked) {
          renderer.domElement.setPointerCapture(e.pointerId);
          radialPointer = e.pointerId;
          renderer.domElement.style.cursor = 'none';
        }
        return;
      }
      // в полёте курсор захвачен: действие сразу, прицел в центре
      if (fly.isLocked && editorRef.current) { refreshGhost(); act(e.button); }
    };
    const onPointerUp = (e: PointerEvent) => {
      if (e.button === 2 && radialRef.current) { closeRadial(); return; }
      if (fly.isLocked || !editorRef.current || e.button !== down.button) return;
      // клик без перетаскивания: орбита крутится перетаскиванием, клик — действие
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
      act(e.button);
    };
    const dropRadial = () => { if (radialRef.current) { const r = radialRef.current; radialRef.current = { ...r, sel: -1 }; closeRadial(); } };
    const onWindowUp = (e: MouseEvent) => { if (e.button === 2 && radialRef.current) closeRadial(); };
    window.addEventListener('blur', dropRadial);
    window.addEventListener('mouseup', onWindowUp, true);
    renderer.domElement.addEventListener('pointercancel', dropRadial);
    renderer.domElement.addEventListener('lostpointercapture', () => { if (radialPointer >= 0) closeRadial(); });
    fly.addEventListener('unlock', dropRadial);
    const onContextMenu = (e: Event) => { if (editorRef.current) e.preventDefault(); };
    const onLeave = () => { if (!fly.isLocked) { state.pointer = null; state.hoverDirty = true; } };
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointerleave', onLeave);
    renderer.domElement.addEventListener('contextmenu', onContextMenu);

    const onKeyDown = (e: KeyboardEvent) => {
      if (editorRef.current && !(e.target instanceof HTMLInputElement)) {
        // киянка: R — снести блок под прицелом; в остальных инструментах R — другой вариант
        if (e.code === 'KeyR' && editorRef.current.tool === 'hammer') {
          const p = state.pending;
          if (p && p.type === 'hammer') { editorRef.current.onRemove(p.id, p.deployable); state.candCache.clear(); state.hoverDirty = true; }
          e.preventDefault();
          return;
        }
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
        host.dataset.pending = p ? `${p.type}:${p.type === 'hammer' ? p.id : p.type === 'element' ? JSON.stringify(p.attach) : p.type === 'root' ? p.kind : p.d.kind + (p.d.offset ? JSON.stringify(p.d.offset) : '') + (p.d.rotation ? `@${p.d.rotation}` : '')}` : '';
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
      document.removeEventListener('mousemove', onLockedMove);
      window.removeEventListener('blur', dropRadial);
      window.removeEventListener('mouseup', onWindowUp, true);
      fly.removeEventListener('unlock', dropRadial);
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

  const [modelsVersion, setModelsVersion] = useState(0);
  useEffect(() => onModelLoaded(() => setModelsVersion(v => v + 1)), []);

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

    if (framedKey.current !== frameKey) s.doorState.clear();
    s.stability = computeStability(resolved);
    const gables = gableWalls(resolved);
    const hips = hipRoofs(resolved);
    const manifest = pieceManifest();
    s.pieces = manifest ? activePieces(manifest, resolved, entityMatrix) : new Map();
    for (const el of resolved.elements) s.content.add(buildElement(el, gables.get(el.id), hips.get(el.id), s.pieces.get(el.id)));
    // угловые стойки стен: без id, клик проходит сквозь них к стенам
    if (!manifest) for (const post of cornerPosts(resolved)) { const o = buildCornerPost(post); o.traverse(n => { n.raycast = () => {}; }); s.content.add(o); }
    // вставки между треугольными крышами в ряд — часть крыши-владельца (киянка бьёт по ней)
    for (const f of triangleRoofFillers(resolved)) { const o = buildElement(f.el); o.userData.id = f.owner; s.content.add(o); }
    for (const d of resolved.deployables) s.content.add(buildDeployable(d));
    s.doors = collectDoors(s.content);
    applyDoorsOpen(s);
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
      center.z - dist * 0.8 * Math.sin(az),
    );
    s.controls.update();
  }, [resolved, modelsVersion]);

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

  const outer = radialOuter(radial?.items.length ?? 0);
  // меню целиком внутри сцены: центр сдвигается от краёв
  const hostW = hostRef.current?.clientWidth ?? 0, hostH = hostRef.current?.clientHeight ?? 0;
  const pad = outer + 8;
  const rx = radial ? Math.min(Math.max(radial.x, pad), Math.max(pad, hostW - pad)) : 0;
  const ry = radial ? Math.min(Math.max(radial.y, pad), Math.max(pad, hostH - pad)) : 0;
  return (
    <>
      <div className={`viewer3d${editor && mode === 'fly' ? ' viewer3d--aim' : ''}`} ref={hostRef} />
      {radial && <RadialMenu x={rx} y={ry} items={radial.items} sel={radial.sel} outer={outer} title={radial.tool === 'hammer' ? 'Выбери действие' : 'Выбери'} />}
    </>
  );
};

export default Viewer3D;
