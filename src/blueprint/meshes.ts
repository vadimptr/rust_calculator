/**
 * Построение three.js-мешей для элементов и объектов в их локальной системе (SPEC §4.1, §4.3).
 * Локальный +x стены — её внешняя нормаль; ячейка центрирована в начале координат.
 */
import * as THREE from 'three';
import { FLOOR_T, KINDS, ROOF_RISE, TRI_CIRCUM, cellVertices, wallHeight } from './catalog.ts';
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
};

const EDGE_COLOR = 0x0e0c0a;
const WALL_T = 0.25;
const FOUNDATION_D = 0.6;

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
    case 'doorway':
      return [
        box(WALL_T, h, 1.0, 0, h / 2, -1.0),
        box(WALL_T, h, 1.0, 0, h / 2, 1.0),
        box(WALL_T, 0.8, 1.0, 0, h - 0.4, 0),
      ];
    case 'window-frame':
      return [
        box(WALL_T, 1.0, 3, 0, 0.5, 0),
        box(WALL_T, 1.0, 3, 0, 2.5, 0),
        box(WALL_T, 1.0, 1.0, 0, 1.5, -1.0),
        box(WALL_T, 1.0, 1.0, 0, 1.5, 1.0),
      ];
    case 'wall-frame':
      return [
        box(WALL_T, h, 0.3, 0, h / 2, -1.35),
        box(WALL_T, h, 0.3, 0, h / 2, 1.35),
        box(WALL_T, 0.3, 3, 0, h - 0.15, 0),
      ];
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

function deployableParts(d: ResolvedDeployable): THREE.BufferGeometry[] {
  switch (d.kind) {
    case 'tool-cupboard':
      return [box(0.5, 1.2, 1.0, 0, 0.6, 0)];
    case 'garage-door':
      return [box(0.1, 2.6, 2.4, 0, 1.3, 0)];
    case 'wooden-double-door':
    case 'sheet-metal-double-door':
    case 'armored-double-door':
      return [box(0.1, 2.6, 1.15, 0, 1.3, -0.625), box(0.1, 2.6, 1.15, 0, 1.3, 0.625)];
    default: {
      const z = d.hinge === 'right' ? 0.02 : -0.02;
      return [box(0.1, 2.0, 0.96, 0, 1.0, z)];
    }
  }
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
  const g = new THREE.Group();
  for (const part of deployableParts(d)) g.add(withEdges(part, DOOR_COLORS[d.kind]));
  g.userData = { id: d.id, kind: d.kind };
  return place(g, d.position, d.rotation);
}

