/**
 * Построение three.js-мешей для элементов и объектов в их локальной системе (SPEC §4.1, §4.3).
 * Локальный +x стены — её внешняя нормаль; ячейка центрирована в начале координат.
 */
import * as THREE from 'three';
import { FLOOR_T, KINDS, ROOF_RISE, TRI_CIRCUM, WINDOW_INSERTS, cellVertices, wallHeight } from './catalog.ts';
import type { Shape } from './catalog.ts';
import type { DeployableKind, Grade, ResolvedDeployable, ResolvedElement } from './types.ts';

export const GRADE_COLORS: Record<Grade, number> = {
  twig: 0xc9a86a,
  wood: 0x8b5a2b,
  stone: 0x8e8e8e,
  metal: 0x5d6670,
  armored: 0x3b3f46,
};

const DOOR_COLORS: Record<DeployableKind, number> = {
  'tool-cupboard': 0x7a4a1e,
  'wooden-door': 0x9b6a3a,
  'sheet-metal-door': 0x6e7f8e,
  'armored-door': 0x2f333a,
  'garage-door': 0x5a6a78,
  'wooden-double-door': 0x9b6a3a,
  'sheet-metal-double-door': 0x6e7f8e,
  'armored-double-door': 0x2f333a,
  'strengthened-glass-window': 0x9fd3e6,
  'reinforced-glass-window': 0x7fb6cc,
  'metal-window-bars': 0x3a3f45,
};

const GLASS = new THREE.MeshStandardMaterial({ color: 0x9fd3e6, transparent: true, opacity: 0.35, roughness: 0.15, metalness: 0.1, side: THREE.DoubleSide });
const GLASS_REINFORCED = new THREE.MeshStandardMaterial({ color: 0x7fb6cc, transparent: true, opacity: 0.5, roughness: 0.2, metalness: 0.2, side: THREE.DoubleSide });

/** Вставка в оконный проём: стекло с рамкой или решётка. */
function buildWindowInsert(d: ResolvedDeployable): THREE.Group {
  const g = new THREE.Group();
  const y = WINDOW_SILL + WINDOW_H / 2;
  if (d.kind === 'metal-window-bars') {
    const color = DOOR_COLORS[d.kind];
    const n = 5;
    for (let i = 0; i < n; i++) {
      const z = -WINDOW_W / 2 + (WINDOW_W / (n + 1)) * (i + 1);
      g.add(withEdges(box(0.08, WINDOW_H, 0.08, 0, y, z), color));
    }
    g.add(withEdges(box(0.08, 0.08, WINDOW_W, 0, y, 0), color));
    return g;
  }
  const pane = new THREE.Mesh(box(0.04, WINDOW_H - 0.1, WINDOW_W - 0.1, 0, y, 0), d.kind === 'reinforced-glass-window' ? GLASS_REINFORCED : GLASS);
  g.add(pane);
  const frame = 0x4a4f55;
  g.add(withEdges(box(0.07, 0.06, WINDOW_W, 0, WINDOW_SILL + 0.03, 0), frame));
  g.add(withEdges(box(0.07, 0.06, WINDOW_W, 0, WINDOW_SILL + WINDOW_H - 0.03, 0), frame));
  g.add(withEdges(box(0.07, WINDOW_H, 0.06, 0, y, -WINDOW_W / 2 + 0.03), frame));
  g.add(withEdges(box(0.07, WINDOW_H, 0.06, 0, y, WINDOW_W / 2 - 0.03), frame));
  return g;
}

const EDGE_COLOR = 0x0e0c0a;
const WALL_T = 0.25;
const FOUNDATION_D = 0.6;
/** Проём в doorway: ширина × высота; дверь заполняет его целиком. */
const DOORWAY_W = 1.3;
const DOORWAY_H = 2.2;
/** Проём в wall-frame: тонкая рамка, проём почти во всю стену; гаражная дверь заполняет его целиком. */
const FRAME_W = 2.7;
const FRAME_H = 2.85;
/** Двойная дверь: створки ниже проёма, сверху неподвижная часть. */
const DOUBLE_LEAF_H = 2.3;
/** Окно в window-frame: ширина × высота проёма и высота подоконника (≈, по пропорциям модели). */
const WINDOW_W = 2.2;
const WINDOW_H = 1.3;
const WINDOW_SILL = 0.95;
const DOOR_T = 0.1;
/** Шкаф: ширина вдоль стены, глубина, высота (≈ по пропорциям модели). */
export const TC_W = 1.1;
export const TC_D = 0.6;
export const TC_H = 1.9;

const materialCache = new Map<number, THREE.MeshStandardMaterial>();
function material(color: number): THREE.MeshStandardMaterial {
  let m = materialCache.get(color);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05, side: THREE.DoubleSide });
    materialCache.set(color, m);
  }
  return m;
}

const edgeMaterial = new THREE.LineBasicMaterial({ color: EDGE_COLOR, transparent: true, opacity: 0.6 });

function withEdges(geometry: THREE.BufferGeometry, color: number): THREE.Group {
  const g = new THREE.Group();
  const mesh = new THREE.Mesh(geometry, material(color));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  g.add(mesh);
  g.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 20), edgeMaterial));
  return g;
}

function box(w: number, h: number, d: number, x: number, y: number, z: number): THREE.BufferGeometry {
  return new THREE.BoxGeometry(w, h, d).translate(x, y, z);
}


/** Полигон ячейки в плоскости XZ, выдавленный вниз на depth (верх на y = 0). */
function cellSlab(shape: Shape, depth: number, inset = 0): THREE.BufferGeometry {
  const verts = cellVertices(shape);
  const s = new THREE.Shape(verts.map(([x, z]) => new THREE.Vector2(x, z)));
  if (inset > 0) {
    const hole = new THREE.Path(verts.map(([x, z]) => new THREE.Vector2(x * inset, z * inset)));
    s.holes.push(hole);
  }
  const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
  geo.rotateX(Math.PI / 2); // (x, y) формы → (x, z) мира; выдавливание уходит в −y
  return geo;
}

function wallParts(kind: ResolvedElement['kind']): THREE.BufferGeometry[] {
  const h = wallHeight(kind);
  switch (kind) {
    case 'doorway': {
      const side = (3 - DOORWAY_W) / 2;
      const lintel = h - DOORWAY_H;
      return [
        box(WALL_T, h, side, 0, h / 2, -(DOORWAY_W / 2 + side / 2)),
        box(WALL_T, h, side, 0, h / 2, DOORWAY_W / 2 + side / 2),
        box(WALL_T, lintel, DOORWAY_W, 0, h - lintel / 2, 0),
      ];
    }
    case 'window-frame': {
      const side = (3 - WINDOW_W) / 2;
      const top = h - (WINDOW_SILL + WINDOW_H);
      return [
        box(WALL_T, WINDOW_SILL, 3, 0, WINDOW_SILL / 2, 0),
        box(WALL_T, top, 3, 0, h - top / 2, 0),
        box(WALL_T, WINDOW_H, side, 0, WINDOW_SILL + WINDOW_H / 2, -(WINDOW_W / 2 + side / 2)),
        box(WALL_T, WINDOW_H, side, 0, WINDOW_SILL + WINDOW_H / 2, WINDOW_W / 2 + side / 2),
      ];
    }
    case 'wall-frame': {
      const side = (3 - FRAME_W) / 2;
      const lintel = h - FRAME_H;
      return [
        box(WALL_T, h, side, 0, h / 2, -(FRAME_W / 2 + side / 2)),
        box(WALL_T, h, side, 0, h / 2, FRAME_W / 2 + side / 2),
        box(WALL_T, lintel, FRAME_W, 0, h - lintel / 2, 0),
      ];
    }
    default:
      return [box(WALL_T, h, 3, 0, h / 2, 0)];
  }
}

function stairsParts(kind: ResolvedElement['kind']): THREE.BufferGeometry[] {
  const steps = 8;
  const parts: THREE.BufferGeometry[] = [];
  if (kind === 'u-shaped-stairs') {
    // два марша: первый по +z половине вверх до 1.5, второй по −z половине обратно до 3
    for (let i = 0; i < steps / 2; i++) {
      const rise = (i + 1) * (3 / steps);
      parts.push(box(3 / (steps / 2), rise, 1.4, -1.5 + (i + 0.5) * (3 / (steps / 2)), rise / 2, 0.75));
    }
    for (let i = 0; i < steps / 2; i++) {
      const rise = 1.5 + (i + 1) * (3 / steps);
      parts.push(box(3 / (steps / 2), rise, 1.4, 1.5 - (i + 0.5) * (3 / (steps / 2)), rise / 2, -0.75));
    }
    return parts;
  }
  for (let i = 0; i < steps; i++) {
    const rise = (i + 1) * (3 / steps);
    parts.push(box(3 / steps, rise, 1.4, -1.5 + (i + 0.5) * (3 / steps), rise / 2, 0.8));
  }
  return parts;
}

function roofGeometry(shape: Shape): THREE.BufferGeometry {
  if (shape === 'square') {
    // сечение в плоскости (x, y): низкое ребро на x = +1.5, высокое на x = −1.5
    const s = new THREE.Shape([
      new THREE.Vector2(1.5, 0), new THREE.Vector2(-1.5, ROOF_RISE),
      new THREE.Vector2(-1.5, ROOF_RISE + FLOOR_T), new THREE.Vector2(1.5, FLOOR_T),
    ]);
    return new THREE.ExtrudeGeometry(s, { depth: 3, bevelEnabled: false }).translate(0, 0, -1.5);
  }
  const a = TRI_CIRCUM / 2; // апофема треугольника
  const geo = new THREE.BufferGeometry();
  const low1 = [a, 0, -1.5], low2 = [a, 0, 1.5], apex = [-TRI_CIRCUM, ROOF_RISE, 0];
  const t = FLOOR_T;
  const up = (v: number[]) => [v[0], v[1] + t, v[2]];
  const tri = (p: number[], q: number[], r: number[]) => [...p, ...q, ...r];
  const verts = [
    ...tri(low1, low2, apex), ...tri(up(low2), up(low1), up(apex)),
    ...tri(low1, up(low1), low2), ...tri(low2, up(low1), up(low2)),
    ...tri(low2, up(low2), apex), ...tri(apex, up(low2), up(apex)),
    ...tri(apex, up(apex), low1), ...tri(low1, up(apex), up(low1)),
  ];
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.computeVertexNormals();
  return geo;
}

function elementParts(el: ResolvedElement): THREE.BufferGeometry[] {
  const info = KINDS[el.kind];
  switch (info.category) {
    case 'cell':
      if (info.isFoundation) return [cellSlab(info.shape!, FOUNDATION_D)];
      if (info.isFrame) return [cellSlab(info.shape!, FLOOR_T, 0.72)];
      return [cellSlab(info.shape!, FLOOR_T)];
    case 'wallType':
      return wallParts(el.kind);
    case 'stairs':
      return stairsParts(el.kind);
    case 'roof':
      return [roofGeometry(info.shape!)];
  }
}

/** Анимируемая дверь: створка на петле (поворот вокруг Y) или подъёмная (сдвиг по Y). */
export interface DoorAnim {
  type: 'leaf' | 'lift';
  /** Значение rotation.y (leaf) или position.y (lift) в открытом состоянии; закрытое — closed. */
  open: number;
  closed: number;
  target: boolean;
}

/** Угловая скорость створки, рад/с, и скорость подъёма, м/с. */
const DOOR_SPEED = 3.2;

/**
 * Дверное полотно на петле. hingeZ — локальная z петли (нормаль проёма = +x, «left» = +z при
 * взгляде снаружи по нормали). Полотно тянется от петли к центру проёма. Открытая дверь
 * повёрнута на 90° вокруг петли: outward — в сторону +x, inward — в сторону −x.
 */
function doorLeaf(width: number, height: number, hingeZ: number, opens: 'outward' | 'inward', color: number): THREE.Group {
  const pivot = new THREE.Group();
  pivot.position.set(0, 0, hingeZ);
  const toCenter = hingeZ > 0 ? -1 : 1;
  pivot.add(withEdges(box(DOOR_T, height, width, 0, height / 2, toCenter * width / 2), color));
  pivot.add(withEdges(box(0.18, height, 0.14, 0, height / 2, 0), 0x1a1a1a));
  const sign = hingeZ > 0 ? -1 : 1; // полотно вдоль −z → +x при −90°, вдоль +z → +x при +90°
  const anim: DoorAnim = { type: 'leaf', closed: 0, open: (opens === 'outward' ? sign : -sign) * (Math.PI / 2), target: false };
  pivot.userData.door = anim;
  return pivot;
}

function buildDoor(d: ResolvedDeployable): THREE.Group {
  const g = new THREE.Group();
  const color = DOOR_COLORS[d.kind];
  switch (d.kind) {
    case 'garage-door': {
      // Гаражная дверь поднимается вверх, открытая — вровень с притолокой
      const lift = new THREE.Group();
      lift.add(withEdges(box(DOOR_T, FRAME_H, FRAME_W, 0, FRAME_H / 2, 0), color));
      const anim: DoorAnim = { type: 'lift', closed: 0, open: FRAME_H - 0.3, target: false };
      lift.userData.door = anim;
      g.add(lift);
      return g;
    }
    case 'wooden-double-door':
    case 'sheet-metal-double-door':
    case 'armored-double-door':
      g.add(doorLeaf(FRAME_W / 2, DOUBLE_LEAF_H, FRAME_W / 2, d.opens, color));
      g.add(doorLeaf(FRAME_W / 2, DOUBLE_LEAF_H, -FRAME_W / 2, d.opens, color));
      // неподвижная верхняя часть над створками
      g.add(withEdges(box(DOOR_T, FRAME_H - DOUBLE_LEAF_H, FRAME_W, 0, DOUBLE_LEAF_H + (FRAME_H - DOUBLE_LEAF_H) / 2, 0), color));
      return g;
    default:
      g.add(doorLeaf(DOORWAY_W, DOORWAY_H, d.hinge === 'left' ? DOORWAY_W / 2 : -DOORWAY_W / 2, d.opens, color));
      return g;
  }
}

/** Все анимируемые двери в поддереве. */
export function collectDoors(root: THREE.Object3D): THREE.Object3D[] {
  const out: THREE.Object3D[] = [];
  root.traverse(o => { if (o.userData.door) out.push(o); });
  return out;
}

/** Задать цель; snap = true ставит дверь в конечное положение сразу. */
export function setDoorOpen(door: THREE.Object3D, open: boolean, snap = false): void {
  const a = door.userData.door as DoorAnim;
  a.target = open;
  if (snap) {
    if (a.type === 'leaf') door.rotation.y = open ? a.open : a.closed;
    else door.position.y = open ? a.open : a.closed;
  }
}

/** Шаг анимации; возвращает true, если хоть одна дверь ещё движется. */
export function animateDoors(doors: THREE.Object3D[], dt: number): boolean {
  let moving = false;
  for (const door of doors) {
    const a = door.userData.door as DoorAnim;
    const goal = a.target ? a.open : a.closed;
    const cur = a.type === 'leaf' ? door.rotation.y : door.position.y;
    if (Math.abs(goal - cur) < 1e-4) continue;
    const step = DOOR_SPEED * dt;
    const next = Math.abs(goal - cur) <= step ? goal : cur + Math.sign(goal - cur) * step;
    if (a.type === 'leaf') door.rotation.y = next; else door.position.y = next;
    moving = true;
  }
  return moving;
}

function place(group: THREE.Group, position: [number, number, number], rotation: number): THREE.Group {
  group.position.set(position[0], position[1], position[2]);
  group.rotation.y = -rotation * (Math.PI / 180); // §4.1: three.js — правая система
  return group;
}

export function buildElement(el: ResolvedElement): THREE.Object3D {
  const g = new THREE.Group();
  const color = GRADE_COLORS[el.grade];
  for (const part of elementParts(el)) g.add(withEdges(part, color));
  g.userData = { id: el.id, kind: el.kind };
  return place(g, el.position, el.rotation);
}

export function buildDeployable(d: ResolvedDeployable): THREE.Object3D {
  let g: THREE.Group;
  if (d.kind === 'tool-cupboard') {
    g = new THREE.Group();
    // Шкаф: TC_W вдоль стены, TC_D в глубину, TC_H высотой; спинка — локальный −x
    g.add(withEdges(box(TC_D, TC_H, TC_W, 0, TC_H / 2, 0), DOOR_COLORS[d.kind]));
    g.add(withEdges(box(0.04, TC_H - 0.3, TC_W - 0.2, TC_D / 2 + 0.01, TC_H / 2 + 0.05, 0), 0x5b3716));
    g.add(withEdges(box(0.05, 0.08, TC_W - 0.2, TC_D / 2 + 0.03, TC_H * 0.55, 0), 0x3a2410));
  } else if (WINDOW_INSERTS.includes(d.kind)) {
    g = buildWindowInsert(d);
  } else {
    g = buildDoor(d);
    for (const door of collectDoors(g)) setDoorOpen(door, d.open, true);
  }
  g.userData = { ...g.userData, id: d.id, kind: d.kind, open: d.open };
  return place(g, d.position, d.rotation);
}

