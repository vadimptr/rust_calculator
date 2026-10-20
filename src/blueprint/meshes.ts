/**
 * Построение three.js-мешей для элементов и объектов в их локальной системе (SPEC §4.1, §4.3).
 * Локальный +x стены — её внешняя нормаль; ячейка центрирована в начале координат.
 */
import * as THREE from 'three';
import { FLOOR_T, KINDS, RAMP_MALE_H, ROOF_RISE, SPIRAL_H, TRI_CIRCUM, WINDOW_INSERTS, cellVertices, wallHeight } from './catalog.ts';
import type { Shape } from './catalog.ts';
import type { CornerPost, GableShape } from './conditional.ts';
import type { DeployableKind, ElementKind, Grade, ResolvedDeployable, ResolvedElement } from './types.ts';
import { gameModel, pieceManifest } from './models.ts';

/** Цвета по материалу: солома, дерево, камень серый, металл ржавый, МВК почти чёрный. */
export const GRADE_COLORS: Record<Grade, number> = {
  twig: 0xd9b96a,
  wood: 0x8b5a2b,
  stone: 0x8e8e8e,
  metal: 0x9a4f2a,
  armored: 0x2a2c2e,
};

/** Двери: деревянная светло-коричневая, металлическая ржавая, МВК тёмно-серая; дроп-бокс синий. */
const DOOR_COLORS: Record<DeployableKind, number> = {
  'tool-cupboard': 0x7a4a1e,
  'drop-box': 0x2f6fd6,
  'wooden-door': 0xb98a5a,
  'sheet-metal-door': 0xa85a2e,
  'armored-door': 0x3a3d42,
  'garage-door': 0xa85a2e,
  'wooden-double-door': 0xb98a5a,
  'sheet-metal-double-door': 0xa85a2e,
  'armored-double-door': 0x3a3d42,
  'strengthened-glass-window': 0x9fd3e6,
  'reinforced-glass-window': 0x7fb6cc,
  'metal-window-bars': 0x3a3f45,
  'metal-embrasure': 0x5a4a3e,
};

const TEX_DIR = '/textures/game/';
const TILE = 3;
type GradeFace = 'side' | 'top' | 'roof';
type ObjectTextured = 'wooden-door' | 'sheet-metal-door' | 'armored-door' | 'wooden-double-door' | 'sheet-metal-double-door'
  | 'armored-double-door' | 'garage-door' | 'tool-cupboard' | 'drop-box';
type ObjectFace = 'front' | 'back' | 'edge' | 'side' | 'top';
const DOOR_GRADE: Partial<Record<DeployableKind, Grade>> = {
  'wooden-double-door': 'wood', 'sheet-metal-double-door': 'metal', 'armored-double-door': 'armored',
};
const textureCache = new Map<string, THREE.Texture>();
function texture(name: string, color = true, mirror = false): THREE.Texture | null {
  if (typeof document === 'undefined') return null;
  const key = `${name}|${mirror}`;
  let t = textureCache.get(key);
  if (!t) {
    t = new THREE.TextureLoader().load(`${TEX_DIR}${name}.webp`);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (color) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    if (mirror) { t.repeat.x = -1; t.offset.x = 1; }
    textureCache.set(key, t);
  }
  return t;
}

interface Placement { yaw: number; offset?: [number, number, number] }
const DEG = Math.PI / 180;
const SQUARE: Placement = { yaw: 0 };
const TRIANGLE: Placement = { yaw: -90 * DEG, offset: [TRI_CIRCUM / 2, 0, 0] };
const WALL: Placement = { yaw: 0 };
const BLOCK_MODELS: Partial<Record<ElementKind, Placement>> = {
  'square-foundation': SQUARE, 'square-floor': SQUARE, 'floor-frame': SQUARE,
  'triangle-foundation': TRIANGLE, 'triangle-floor': TRIANGLE, 'triangle-floor-frame': TRIANGLE,
  'wall': WALL, 'half-wall': WALL, 'low-wall': WALL, 'doorway': WALL, 'window-frame': WALL, 'wall-frame': WALL,
  'stairs-l-shape': { yaw: 0 }, 'u-shaped-stairs': { yaw: 0 }, 'spiral-stairs': { yaw: 0 },
  'roof': { yaw: 90 * DEG }, 'roof-triangle': { yaw: 90 * DEG },
  'ramp': { yaw: 0, offset: [-1.5, -RAMP_MALE_H.ramp!, 0] }, 'foundation-steps': { yaw: 0, offset: [-1.5, -RAMP_MALE_H['foundation-steps']!, 0] },
};
const OBJECT_YAW: Partial<Record<DeployableKind, number>> = {
  'tool-cupboard': 90 * DEG, 'drop-box': 90 * DEG,
};

export function entityMatrix(el: ResolvedElement): number[] | null {
  const p = BLOCK_MODELS[el.kind];
  if (!p || el.inverted) return null;
  const m = new THREE.Matrix4().compose(new THREE.Vector3(...el.position), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -el.rotation * DEG), new THREE.Vector3(1, 1, 1));
  m.multiply(new THREE.Matrix4().makeTranslation(...(p.offset ?? [0, 0, 0])));
  m.multiply(new THREE.Matrix4().makeRotationY(p.yaw));
  return Array.from(m.elements);
}

function piecesModel(el: ResolvedElement, active: string[]): THREE.Group | null {
  const def = pieceManifest()?.[el.kind];
  if (!def) return null;
  const parts: THREE.Object3D[] = [];
  let missing = false;
  if (def.base[el.grade]) {
    const m = gameModel(`${el.kind}.${el.grade}`);
    if (m) parts.push(m); else missing = true;
  }
  for (const name of active) {
    const piece = def.pieces.find(p => p.name === name);
    const stem = piece?.model[el.grade];
    if (!piece || !stem) continue;
    const m = gameModel(stem);
    if (!m) { missing = true; continue; }
    const holder = new THREE.Group();
    holder.matrixAutoUpdate = false;
    holder.matrix.fromArray(piece.matrix);
    holder.add(m);
    parts.push(holder);
  }
  if (missing) return null;
  const g = new THREE.Group();
  for (const p of parts) g.add(p);
  return g;
}

function hideProxy(root: THREE.Object3D): void {
  root.traverse(n => { if ((n as THREE.Mesh).isMesh || (n as THREE.LineSegments).isLineSegments) n.visible = false; });
}

function placeModel(model: THREE.Object3D, p: Placement): THREE.Group {
  const g = new THREE.Group();
  g.rotation.y = p.yaw;
  if (p.offset) g.position.set(...p.offset);
  g.add(model);
  return g;
}

function fitModel(model: THREE.Object3D, yaw: number, box: THREE.Box3, mirror = false): THREE.Group {
  const inner = new THREE.Group();
  inner.rotation.y = yaw;
  if (mirror) inner.scale.z = -1;
  inner.add(model);
  inner.updateMatrixWorld(true);
  const mb = new THREE.Box3().setFromObject(inner);
  const ms = mb.getSize(new THREE.Vector3()), ts = box.getSize(new THREE.Vector3());
  const outer = new THREE.Group();
  outer.scale.set(ts.x / ms.x, ts.y / ms.y, ts.z / ms.z);
  outer.position.set(box.min.x - mb.min.x * outer.scale.x, box.min.y - mb.min.y * outer.scale.y, box.min.z - mb.min.z * outer.scale.z);
  outer.add(inner);
  return outer;
}

function withModel(proxy: THREE.Group, name: string, yaw: number, mirror = false): THREE.Group {
  const model = gameModel(name);
  if (!model) return proxy;
  const box = new THREE.Box3().setFromObject(proxy);
  hideProxy(proxy);
  const g = new THREE.Group();
  g.add(proxy);
  g.add(fitModel(model, yaw, box, mirror));
  return g;
}

const gradeMaterials = new Map<string, THREE.MeshStandardMaterial>();
function gradeMaterial(grade: Grade, face: GradeFace): THREE.MeshStandardMaterial {
  const key = `${grade}|${face}`;
  let m = gradeMaterials.get(key);
  if (!m) {
    const map = texture(`${grade}-${face}`);
    const metallic = grade === 'metal' || grade === 'armored';
    m = new THREE.MeshStandardMaterial({
      color: map ? 0xffffff : GRADE_COLORS[grade], map: map ?? undefined, normalMap: texture(`${grade}-${face}-n`, false) ?? undefined,
      roughness: metallic ? 0.75 : 0.9, metalness: metallic ? 0.2 : 0.02, side: THREE.DoubleSide,
      alphaTest: grade === 'twig' && face === 'side' ? 0.5 : 0,
    });
    gradeMaterials.set(key, m);
  }
  return m;
}

const objectMaterials = new Map<string, THREE.MeshStandardMaterial>();
function objectMaterial(kind: ObjectTextured, face: ObjectFace, mirror = false): THREE.MeshStandardMaterial {
  const key = `${kind}|${face}|${mirror}`;
  let m = objectMaterials.get(key);
  if (!m) {
    const map = texture(`${kind}-${face}`, true, mirror);
    const metallic = !kind.startsWith('wooden') && kind !== 'tool-cupboard';
    m = new THREE.MeshStandardMaterial({
      color: map ? 0xffffff : DOOR_COLORS[kind], map: map ?? undefined,
      roughness: metallic ? 0.7 : 0.9, metalness: metallic ? 0.25 : 0.02, side: THREE.DoubleSide,
    });
    objectMaterials.set(key, m);
  }
  return m;
}

/**
 * Кубическая проекция UV: для каждой вершины по доминирующей оси нормали берутся две другие
 * координаты в метрах, делённые на TILE. Текстура тянется непрерывно по всем граням и частям блока,
 * без растяжения на коробках разного размера.
 */
function boxUV(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  if (!geo.attributes.normal) geo.computeVertexNormals();
  const pos = geo.attributes.position, nor = geo.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i)), nz = Math.abs(nor.getZ(i));
    let u: number, v: number;
    if (nx >= ny && nx >= nz) { u = z; v = y; } else if (ny >= nz) { u = x; v = z; } else { u = x; v = y; }
    uv[i * 2] = u / TILE;
    uv[i * 2 + 1] = v / TILE;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

function splitTopFaces(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const flat = geo.index ? geo.toNonIndexed() : geo;
  if (!flat.attributes.normal) flat.computeVertexNormals();
  const names = Object.keys(flat.attributes);
  const count = flat.attributes.position.count / 3;
  const side: number[] = [], top: number[] = [];
  const nor = flat.attributes.normal;
  for (let t = 0; t < count; t++) {
    let ny = 0, len = 0;
    for (let k = 0; k < 3; k++) {
      const i = t * 3 + k;
      ny += nor.getY(i);
      len += Math.hypot(nor.getX(i), nor.getY(i), nor.getZ(i));
    }
    (Math.abs(ny) > 0.7 * len ? top : side).push(t);
  }
  const out = new THREE.BufferGeometry();
  for (const name of names) {
    const src = flat.attributes[name] as THREE.BufferAttribute;
    const size = src.itemSize;
    const arr = new Float32Array(src.count * size);
    let o = 0;
    for (const t of [...side, ...top]) {
      for (let k = 0; k < 3 * size; k++) arr[o++] = src.array[t * 3 * size + k];
    }
    out.setAttribute(name, new THREE.BufferAttribute(arr, size));
  }
  out.addGroup(0, side.length * 3, 0);
  out.addGroup(side.length * 3, top.length * 3, 1);
  return out;
}

function gradeMesh(geometry: THREE.BufferGeometry, grade: Grade, topFace: GradeFace = 'top'): THREE.Group {
  const g = new THREE.Group();
  const geo = splitTopFaces(boxUV(geometry));
  const mesh = new THREE.Mesh(geo, [gradeMaterial(grade, 'side'), gradeMaterial(grade, topFace)]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  g.add(mesh);
  g.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 20), edgeMaterial));
  return g;
}

function faceBox(w: number, h: number, d: number, x: number, y: number, z: number, faces: THREE.Material[]): THREE.Group {
  const g = new THREE.Group();
  const geometry = box(w, h, d, x, y, z);
  const mesh = new THREE.Mesh(geometry, faces);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  g.add(mesh);
  g.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 20), edgeMaterial));
  return g;
}

function doorFaces(kind: ObjectTextured, mirror = false): THREE.Material[] {
  const edge = objectMaterial(kind, 'edge');
  return [objectMaterial(kind, 'front', mirror), objectMaterial(kind, 'back', mirror), edge, edge, edge, edge];
}

const GLASS = new THREE.MeshStandardMaterial({ color: 0x9fd3e6, transparent: true, opacity: 0.35, roughness: 0.15, metalness: 0.1, side: THREE.DoubleSide });
const GLASS_REINFORCED = new THREE.MeshStandardMaterial({ color: 0x7fb6cc, transparent: true, opacity: 0.5, roughness: 0.2, metalness: 0.2, side: THREE.DoubleSide });

/** Вставка в оконный проём: стекло с рамкой или решётка. */
function buildWindowInsert(d: ResolvedDeployable): THREE.Group {
  const g = new THREE.Group();
  const y = WINDOW_SILL + WINDOW_H / 2;
  if (d.kind === 'metal-embrasure') {
    const slit = 0.18;
    const part = (WINDOW_H - slit) / 2;
    g.add(gradeMesh(box(0.06, part, WINDOW_W, 0, WINDOW_SILL + part / 2, 0), 'metal'));
    g.add(gradeMesh(box(0.06, part, WINDOW_W, 0, WINDOW_SILL + WINDOW_H - part / 2, 0), 'metal'));
    return g;
  }
  if (d.kind === 'metal-window-bars') {
    const n = 5;
    for (let i = 0; i < n; i++) {
      const z = -WINDOW_W / 2 + (WINDOW_W / (n + 1)) * (i + 1);
      g.add(gradeMesh(box(0.08, WINDOW_H, 0.08, 0, y, z), 'armored'));
    }
    g.add(gradeMesh(box(0.08, 0.08, WINDOW_W, 0, y, 0), 'armored'));
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

/** Стены в сцене чуть ниже низа плиты над ними: верх стены не входит в плиту, и нет z-файтинга. */
const WALL_TOP_GAP = FLOOR_T + 0.01;

function wallParts(kind: ResolvedElement['kind']): THREE.BufferGeometry[] {
  const h = wallHeight(kind) - WALL_TOP_GAP;
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

/** Обрезать выпуклый многоугольник полуплоскостью a·x + b·z ≥ 0 (Сазерленд — Ходжман). */
function clipPoly(poly: [number, number][], a: number, b: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    const fp = a * p[0] + b * p[1], fq = a * q[0] + b * q[1];
    if (fp >= 0) out.push(p);
    if ((fp >= 0) !== (fq >= 0)) { const t = fp / (fp - fq); out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
  }
  return out;
}

/**
 * Скат крыши, обрезанный по вальмам: в плане — квадрат 3×3, обрезанный диагоналями x ≥ s·z со
 * сторон соседних скатов; верх — плоскость ската y = 1.5 − x (низ на x = +1.5), толщина FLOOR_T.
 */
function hipRoofGeometry(sides: (1 | -1)[]): THREE.BufferGeometry {
  let poly: [number, number][] = [[1.5, -1.5], [1.5, 1.5], [-1.5, 1.5], [-1.5, -1.5]];
  for (const s of sides) poly = clipPoly(poly, 1, -s);
  const y = (x: number) => (ROOF_RISE / 3) * (1.5 - x);
  const verts: number[] = [];
  const tri = (a: number[], b: number[], c: number[]) => verts.push(...a, ...b, ...c);
  const top = poly.map(([x, z]) => [x, y(x) + FLOOR_T, z]);
  const bot = poly.map(([x, z]) => [x, y(x), z]);
  for (let i = 1; i + 1 < poly.length; i++) { tri(top[0], top[i + 1], top[i]); tri(bot[0], bot[i], bot[i + 1]); }
  for (let i = 0; i < poly.length; i++) {
    const j = (i + 1) % poly.length;
    tri(bot[i], top[i], top[j]); tri(bot[i], top[j], bot[j]);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.computeVertexNormals();
  return geo;
}

/** Угловая стойка стен: квадратный столб толщиной в стену на стыке торцов. */
export function buildCornerPost(p: CornerPost): THREE.Object3D {
  const h = p.height - WALL_TOP_GAP;
  const g = new THREE.Group();
  g.add(gradeMesh(box(WALL_T, h, WALL_T, 0, h / 2, 0), p.grade));
  return place(g, p.position, p.rotation);
}

/** Стена-фронтон: треугольник от низа до ската крыши, вершина на стороне peak (локальная z). */
function gableGeometry(peak: 1 | -1): THREE.BufferGeometry {
  const top = ROOF_RISE - 0.02;
  const s = new THREE.Shape([new THREE.Vector2(-1.5, 0), new THREE.Vector2(1.5, 0), new THREE.Vector2(1.5 * peak, top)]);
  // форма в (z, y), толщина по x: после поворота на −90° вокруг Y ось формы x уходит в z, глубина — в −x
  return new THREE.ExtrudeGeometry(s, { depth: WALL_T, bevelEnabled: false }).rotateY(-Math.PI / 2).translate(WALL_T / 2, 0, 0);
}

/**
 * Марш лестницы, полый снизу: наклонная плита толщиной 0.1 и ступени на ней. Ширина — по оси across
 * (a0..a1), подъём — вдоль оси along от s0 (высота y0) до s1 (высота y1); along = 'z' или 'x'.
 */
function flight(along: 'x' | 'z', a0: number, a1: number, s0: number, s1: number, y0: number, y1: number, steps = 7): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = [];
  const w = Math.abs(a1 - a0), ac = (a0 + a1) / 2;
  const run = s1 - s0, rise = y1 - y0;
  const len = Math.hypot(run, rise);
  // наклонная плита под ступенями
  const plate = new THREE.BoxGeometry(along === 'z' ? w : len, 0.1, along === 'z' ? len : w);
  const tilt = Math.atan2(rise, Math.abs(run));
  if (along === 'z') plate.rotateX(run > 0 ? -tilt : tilt); else plate.rotateZ(run > 0 ? tilt : -tilt);
  const sm = (s0 + s1) / 2, ym = (y0 + y1) / 2 - 0.08;
  plate.translate(along === 'z' ? ac : sm, ym, along === 'z' ? sm : ac);
  parts.push(plate);
  // ступени: проступь и подступенок, без заливки до пола
  for (let i = 0; i < steps; i++) {
    const t0 = i / steps, t1 = (i + 1) / steps;
    const sa = s0 + run * t0, sb = s0 + run * t1;
    const top = y0 + rise * t1;
    const d = Math.abs(sb - sa), h = rise / steps + 0.06;
    const c = (sa + sb) / 2;
    parts.push(along === 'z' ? box(w, h, d, ac, top - h / 2, c) : box(d, h, w, c, top - h / 2, ac));
  }
  return parts;
}

/** Площадка лестницы: плита толщиной 0.15 на высоте y. */
function landing(x0: number, x1: number, z0: number, z1: number, y: number): THREE.BufferGeometry {
  return box(x1 - x0, 0.15, z1 - z0, (x0 + x1) / 2, y - 0.075, (z0 + z1) / 2);
}

/**
 * Лестницы как в игре — полые марши с площадкой на 1.43 м (раскладка по DeployVolumeOBB префабов):
 * L — марш по одной половине клетки к площадке в углу, поворот на 90° и второй марш вдоль задней стороны;
 * U — два марша по разным половинам и площадка во всю ширину.
 */
function stairsParts(kind: ResolvedElement['kind']): THREE.BufferGeometry[] {
  if (kind === 'spiral-stairs') return spiralParts();
  const L = 1.43;
  if (kind === 'u-shaped-stairs') {
    return [
      ...flight('z', 0.1, 1.3, 1.45, 0.13, 0, L),
      landing(-1.3, 1.3, -1.3, 0.13, L),
      ...flight('z', -1.3, -0.1, 0.13, 1.45, L, 3),
    ];
  }
  return [
    ...flight('z', 0.06, 1.26, 1.45, 0.0, 0, L),
    landing(0.06, 1.3, -1.3, 0.0, L),
    ...flight('x', -1.28, -0.08, 0.06, -1.45, L, 3),
  ];
}

/** Съезд: плита от верха фундамента (x = +1.5, ближнее ребро) вниз к земле (x = −1.5). */
function rampGeometry(): THREE.BufferGeometry {
  const s = new THREE.Shape([
    new THREE.Vector2(1.5, 0), new THREE.Vector2(1.5, -FLOOR_T), new THREE.Vector2(-1.5, -FOUNDATION_D - FLOOR_T), new THREE.Vector2(-1.5, -FOUNDATION_D),
  ]);
  return new THREE.ExtrudeGeometry(s, { depth: 3, bevelEnabled: false }).translate(0, 0, -1.5);
}

/** Ступени фундамента: четыре ступени от верха фундамента к земле. */
function stepsParts(): THREE.BufferGeometry[] {
  const n = 4;
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < n; i++) {
    const top = -(i * FOUNDATION_D) / n;
    const h = FOUNDATION_D - (i * FOUNDATION_D) / n + 0.1;
    parts.push(box(3 / n, h, 3, 1.5 - (i + 0.5) * (3 / n), top - h / 2, 0));
  }
  return parts;
}

/** Винтовая лестница: столб и клиновидные ступени по кругу на высоту этажа. */
function spiralParts(): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = [new THREE.CylinderGeometry(0.18, 0.18, SPIRAL_H, 12).translate(0, SPIRAL_H / 2, 0)];
  const steps = 9;
  for (let i = 0; i < steps; i++) {
    const a0 = (i / steps) * Math.PI * 1.5, a1 = ((i + 1) / steps) * Math.PI * 1.5;
    const y = ((i + 1) / steps) * SPIRAL_H;
    const shape = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(1.3 * Math.cos(a0), 1.3 * Math.sin(a0)), new THREE.Vector2(1.3 * Math.cos(a1), 1.3 * Math.sin(a1))]);
    parts.push(new THREE.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: false }).rotateX(Math.PI / 2).translate(0, y, 0));
  }
  return parts;
}

function roofGeometry(shape: Shape, inverted = false): THREE.BufferGeometry {
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
  // перевёрнутый треугольник: ребро edge:0 у конька, вершина у края — в той же плоскости, что соседи
  const base = inverted ? ROOF_RISE : 0, top = inverted ? 0 : ROOF_RISE;
  const low1 = [a, base, -1.5], low2 = [a, base, 1.5], apex = [-TRI_CIRCUM, top, 0];
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
      // фундамент на высоте полустены или стены доходит до земли
      if (info.isFoundation) return [cellSlab(info.shape!, FOUNDATION_D + Math.max(0, el.position[1]))];
      if (info.isFrame) return [cellSlab(info.shape!, FLOOR_T, 0.72)];
      return [cellSlab(info.shape!, FLOOR_T)];
    case 'wallType':
      return wallParts(el.kind);
    case 'stairs':
      return stairsParts(el.kind);
    case 'roof':
      return [roofGeometry(info.shape!, el.inverted)];
    case 'ramp':
      return el.kind === 'ramp' ? [rampGeometry()] : stepsParts();
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
function doorLeaf(width: number, height: number, hingeZ: number, opens: 'outward' | 'inward', faces: THREE.Material[], model?: string, mirror = false): THREE.Group {
  const pivot = new THREE.Group();
  pivot.position.set(0, 0, hingeZ);
  const toCenter = hingeZ > 0 ? -1 : 1;
  const leaf = faceBox(DOOR_T, height, width, 0, height / 2, toCenter * width / 2, faces);
  const fitted = model ? withModel(leaf, model, 0, mirror) : leaf;
  pivot.add(fitted);
  if (fitted === leaf) pivot.add(withEdges(box(0.18, height, 0.14, 0, height / 2, 0), 0x1a1a1a));
  const sign = hingeZ > 0 ? -1 : 1; // полотно вдоль −z → +x при −90°, вдоль +z → +x при +90°
  const anim: DoorAnim = { type: 'leaf', closed: 0, open: (opens === 'outward' ? sign : -sign) * (Math.PI / 2), target: false };
  pivot.userData.door = anim;
  return pivot;
}

function buildDoor(d: ResolvedDeployable): THREE.Group {
  const g = new THREE.Group();
  const kind = d.kind as ObjectTextured;
  switch (d.kind) {
    case 'garage-door': {
      const lift = new THREE.Group();
      lift.add(withModel(faceBox(DOOR_T, FRAME_H, FRAME_W, 0, FRAME_H / 2, 0, doorFaces(kind)), kind, 0));
      const anim: DoorAnim = { type: 'lift', closed: 0, open: FRAME_H - 0.3, target: false };
      lift.userData.door = anim;
      g.add(lift);
      return g;
    }
    case 'wooden-double-door':
    case 'sheet-metal-double-door':
    case 'armored-double-door':
      g.add(doorLeaf(FRAME_W / 2, DOUBLE_LEAF_H, FRAME_W / 2, d.opens, doorFaces(kind), kind));
      g.add(doorLeaf(FRAME_W / 2, DOUBLE_LEAF_H, -FRAME_W / 2, d.opens, doorFaces(kind, true), kind, true));
      g.add(gradeMesh(box(DOOR_T, FRAME_H - DOUBLE_LEAF_H, FRAME_W, 0, DOUBLE_LEAF_H + (FRAME_H - DOUBLE_LEAF_H) / 2, 0), DOOR_GRADE[d.kind]!));
      return g;
    default:
      g.add(doorLeaf(DOORWAY_W, DOORWAY_H, d.hinge === 'left' ? DOORWAY_W / 2 : -DOORWAY_W / 2, d.opens, doorFaces(kind, d.hinge === 'left'), kind, d.hinge === 'left'));
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

/** Построить блок; gable — фронтон для полной стены, hips — вальмы крыши (conditional.ts). */
export function buildElement(el: ResolvedElement, gable?: GableShape, hips?: (1 | -1)[], pieces?: string[]): THREE.Object3D {
  const g = new THREE.Group();
  const geos = gable && el.kind === 'wall' ? [gableGeometry(gable.peak)]
    : hips?.length && el.kind === 'roof' ? [hipRoofGeometry(hips)] : elementParts(el);
  const topFace = KINDS[el.kind].category === 'roof' ? 'roof' : 'top';
  const parts: THREE.Object3D[] = geos.map(part => gradeMesh(part, el.grade, topFace));
  const manifest = pieceManifest();
  if (manifest && el.inverted) {
    for (const p of parts) hideProxy(p);
  } else if (manifest?.[el.kind] && pieces) {
    const model = piecesModel(el, pieces);
    if (model) {
      for (const p of parts) hideProxy(p);
      parts.push(placeModel(model, BLOCK_MODELS[el.kind]!));
    }
  }
  if (el.bunker) {
    // крыша-затвор: по переключателю «Открыть двери» проваливается под землю, как будто хозяин убрал опору
    const drop = new THREE.Group();
    for (const p of parts) drop.add(p);
    const anim: DoorAnim = { type: 'lift', closed: 0, open: -(ROOF_RISE + FLOOR_T + 1), target: false };
    drop.userData.door = anim;
    g.add(drop);
  } else {
    for (const p of parts) g.add(p);
  }
  g.userData = { id: el.id, kind: el.kind };
  return place(g, el.position, el.rotation);
}

/** Дроп-бокс: сквозь стену, выступает с обеих сторон. Размеры: вдоль стены × высота × глубина. */
const DROP_W = 0.8;
const DROP_H = 0.6;
const DROP_D = WALL_T + 2 * 0.3;

/** Дроп-бокс: ящик сквозь стену, щелью к стороне загрузки. */
function buildDropBox(d: ResolvedDeployable): THREE.Group {
  const g = new THREE.Group();
  const front = objectMaterial('drop-box', 'front'), back = objectMaterial('drop-box', 'back');
  const side = objectMaterial('drop-box', 'side'), top = objectMaterial('drop-box', 'top');
  const loadOutside = d.direction === 'in';
  const proxy = faceBox(DROP_D, DROP_H, DROP_W, 0, 0, 0, [loadOutside ? front : back, loadOutside ? back : front, top, top, side, side]);
  const model = gameModel('drop-box');
  if (model) {
    hideProxy(proxy);
    g.add(placeModel(model, { yaw: (loadOutside ? 1 : -1) * OBJECT_YAW['drop-box']! }));
  }
  g.add(proxy);
  return g;
}

export function buildDeployable(d: ResolvedDeployable): THREE.Object3D {
  let g: THREE.Group;
  if (d.kind === 'drop-box') {
    g = buildDropBox(d);
  } else if (d.kind === 'tool-cupboard') {
    g = new THREE.Group();
    // Шкаф: TC_W вдоль стены, TC_D в глубину, TC_H высотой; спинка — локальный −x
    const side = objectMaterial('tool-cupboard', 'side'), top = objectMaterial('tool-cupboard', 'top');
    const proxy = faceBox(TC_D, TC_H, TC_W, 0, TC_H / 2, 0, [objectMaterial('tool-cupboard', 'front'), objectMaterial('tool-cupboard', 'back'), top, top, side, side]);
    const model = gameModel('tool-cupboard');
    if (model) {
      hideProxy(proxy);
      g.add(placeModel(model, { yaw: OBJECT_YAW['tool-cupboard']! }));
    }
    g.add(proxy);
  } else if (WINDOW_INSERTS.includes(d.kind)) {
    g = buildWindowInsert(d);
    g = withModel(g, d.kind, 0);
  } else {
    g = buildDoor(d);
    for (const door of collectDoors(g)) setDoorOpen(door, d.open, true);
  }
  g.userData = { ...g.userData, id: d.id, kind: d.kind, open: d.open };
  return place(g, d.position, d.rotation);
}

