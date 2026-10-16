/**
 * Построение three.js-мешей для элементов и объектов в их локальной системе (SPEC §4.1, §4.3).
 * Локальный +x стены — её внешняя нормаль; ячейка центрирована в начале координат.
 */
import * as THREE from 'three';
import { FLOOR_T, KINDS, ROOF_RISE, TRI_CIRCUM, WINDOW_INSERTS, cellVertices, wallHeight } from './catalog.ts';
import type { Shape } from './catalog.ts';
import type { CornerPost, GableShape } from './conditional.ts';
import type { DeployableKind, Grade, ResolvedDeployable, ResolvedElement } from './types.ts';

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
};

/** Текстуры материалов (public/textures, CC0 с ambientCG): по одной карте цвета на материал. */
export type TextureId = Grade;
/** Оттенок поверх текстуры: белый — как есть; солома теплее серой соломенной крыши. */
const GRADE_TINT: Record<Grade, number> = { twig: 0xf2d48c, wood: 0xffffff, stone: 0xffffff, metal: 0xffffff, armored: 0xffffff };
const DOOR_TEX: Partial<Record<DeployableKind, TextureId>> = {
  'tool-cupboard': 'wood', 'wooden-door': 'wood', 'wooden-double-door': 'wood',
  'sheet-metal-door': 'metal', 'sheet-metal-double-door': 'metal', 'garage-door': 'metal',
  'armored-door': 'armored', 'armored-double-door': 'armored', 'metal-window-bars': 'armored',
};
const DOOR_TINT: Partial<Record<DeployableKind, number>> = {
  'tool-cupboard': 0xd8c0a8, 'sheet-metal-door': 0xe0c8b8, 'sheet-metal-double-door': 0xe0c8b8, 'garage-door': 0xb0b0b0,
};
/** Ширина карты к высоте: камень 2:1, остальные квадратные. */
const TEX_ASPECT: Record<TextureId, number> = { twig: 1, wood: 1, stone: 2, metal: 1, armored: 1 };
/** Размер плитки текстуры в метрах: стена 3 м — две плитки. */
const TILE = 1.5;
const textureCache = new Map<TextureId, THREE.Texture>();
function texture(id: TextureId): THREE.Texture | null {
  if (typeof document === 'undefined') return null; // node: без текстур
  let t = textureCache.get(id);
  if (!t) {
    t = new THREE.TextureLoader().load(`/textures/${id}.jpg`);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    t.repeat.set(1 / TEX_ASPECT[id], 1);
    textureCache.set(id, t);
  }
  return t;
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
      g.add(withEdges(box(0.08, WINDOW_H, 0.08, 0, y, z), color, 'armored'));
    }
    g.add(withEdges(box(0.08, 0.08, WINDOW_W, 0, y, 0), color, 'armored'));
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

const materialCache = new Map<string, THREE.MeshStandardMaterial>();
function material(color: number, tex?: TextureId): THREE.MeshStandardMaterial {
  const key = `${tex ?? ''}|${color}`;
  let m = materialCache.get(key);
  if (!m) {
    const map = tex ? texture(tex) : null;
    const metallic = tex === 'metal' || tex === 'armored';
    m = new THREE.MeshStandardMaterial({
      color, map: map ?? undefined, roughness: map ? (metallic ? 0.7 : 0.9) : 0.85, metalness: map && metallic ? 0.25 : 0.05, side: THREE.DoubleSide,
    });
    materialCache.set(key, m);
  }
  return m;
}

const edgeMaterial = new THREE.LineBasicMaterial({ color: EDGE_COLOR, transparent: true, opacity: 0.6 });

function withEdges(geometry: THREE.BufferGeometry, color: number, tex?: TextureId): THREE.Group {
  const g = new THREE.Group();
  if (tex) boxUV(geometry);
  const mesh = new THREE.Mesh(geometry, material(color, tex));
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
  g.add(withEdges(box(WALL_T, h, WALL_T, 0, h / 2, 0), GRADE_TINT[p.grade], p.grade));
  return place(g, p.position, p.rotation);
}

/** Стена-фронтон: треугольник от низа до ската крыши, вершина на стороне peak (локальная z). */
function gableGeometry(peak: 1 | -1): THREE.BufferGeometry {
  const top = ROOF_RISE - 0.02;
  const s = new THREE.Shape([new THREE.Vector2(-1.5, 0), new THREE.Vector2(1.5, 0), new THREE.Vector2(1.5 * peak, top)]);
  // форма в (z, y), толщина по x: после поворота на −90° вокруг Y ось формы x уходит в z, глубина — в −x
  return new THREE.ExtrudeGeometry(s, { depth: WALL_T, bevelEnabled: false }).rotateY(-Math.PI / 2).translate(WALL_T / 2, 0, 0);
}

function stairsParts(kind: ResolvedElement['kind']): THREE.BufferGeometry[] {
  const steps = 8;
  const parts: THREE.BufferGeometry[] = [];
  if (kind === 'spiral-stairs') return spiralParts();
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
  const parts: THREE.BufferGeometry[] = [new THREE.CylinderGeometry(0.18, 0.18, 3, 12).translate(0, 1.5, 0)];
  const steps = 12;
  for (let i = 0; i < steps; i++) {
    const a0 = (i / steps) * Math.PI * 2, a1 = ((i + 1) / steps) * Math.PI * 2;
    const y = ((i + 1) / steps) * 3;
    const shape = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(1.3 * Math.cos(a0), 1.3 * Math.sin(a0)), new THREE.Vector2(1.3 * Math.cos(a1), 1.3 * Math.sin(a1))]);
    parts.push(new THREE.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: false }).rotateX(Math.PI / 2).translate(0, y, 0));
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
      // фундамент на высоте полустены или стены доходит до земли
      if (info.isFoundation) return [cellSlab(info.shape!, FOUNDATION_D + Math.max(0, el.position[1]))];
      if (info.isFrame) return [cellSlab(info.shape!, FLOOR_T, 0.72)];
      return [cellSlab(info.shape!, FLOOR_T)];
    case 'wallType':
      return wallParts(el.kind);
    case 'stairs':
      return stairsParts(el.kind);
    case 'roof':
      return [roofGeometry(info.shape!)];
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
function doorLeaf(width: number, height: number, hingeZ: number, opens: 'outward' | 'inward', color: number, tex?: TextureId): THREE.Group {
  const pivot = new THREE.Group();
  pivot.position.set(0, 0, hingeZ);
  const toCenter = hingeZ > 0 ? -1 : 1;
  pivot.add(withEdges(box(DOOR_T, height, width, 0, height / 2, toCenter * width / 2), color, tex));
  pivot.add(withEdges(box(0.18, height, 0.14, 0, height / 2, 0), 0x1a1a1a));
  const sign = hingeZ > 0 ? -1 : 1; // полотно вдоль −z → +x при −90°, вдоль +z → +x при +90°
  const anim: DoorAnim = { type: 'leaf', closed: 0, open: (opens === 'outward' ? sign : -sign) * (Math.PI / 2), target: false };
  pivot.userData.door = anim;
  return pivot;
}

function buildDoor(d: ResolvedDeployable): THREE.Group {
  const g = new THREE.Group();
  const tex = DOOR_TEX[d.kind];
  const color = (tex ? DOOR_TINT[d.kind] : undefined) ?? (tex ? 0xffffff : DOOR_COLORS[d.kind]);
  switch (d.kind) {
    case 'garage-door': {
      // Гаражная дверь поднимается вверх, открытая — вровень с притолокой
      const lift = new THREE.Group();
      lift.add(withEdges(box(DOOR_T, FRAME_H, FRAME_W, 0, FRAME_H / 2, 0), color, tex));
      const anim: DoorAnim = { type: 'lift', closed: 0, open: FRAME_H - 0.3, target: false };
      lift.userData.door = anim;
      g.add(lift);
      return g;
    }
    case 'wooden-double-door':
    case 'sheet-metal-double-door':
    case 'armored-double-door':
      g.add(doorLeaf(FRAME_W / 2, DOUBLE_LEAF_H, FRAME_W / 2, d.opens, color, tex));
      g.add(doorLeaf(FRAME_W / 2, DOUBLE_LEAF_H, -FRAME_W / 2, d.opens, color, tex));
      // неподвижная верхняя часть над створками
      g.add(withEdges(box(DOOR_T, FRAME_H - DOUBLE_LEAF_H, FRAME_W, 0, DOUBLE_LEAF_H + (FRAME_H - DOUBLE_LEAF_H) / 2, 0), color, tex));
      return g;
    default:
      g.add(doorLeaf(DOORWAY_W, DOORWAY_H, d.hinge === 'left' ? DOORWAY_W / 2 : -DOORWAY_W / 2, d.opens, color, tex));
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
export function buildElement(el: ResolvedElement, gable?: GableShape, hips?: (1 | -1)[]): THREE.Object3D {
  const g = new THREE.Group();
  const geos = gable && el.kind === 'wall' ? [gableGeometry(gable.peak)]
    : hips?.length && el.kind === 'roof' ? [hipRoofGeometry(hips)] : elementParts(el);
  const parts = geos.map(part => withEdges(part, GRADE_TINT[el.grade], el.grade));
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

/** Дроп-бокс на стене: синий ящик на стороне загрузки и стрелка направления передачи сквозь стену. */
/** Дроп-бокс: сквозь стену, выступает с обеих сторон. Размеры: вдоль стены × высота × глубина. */
const DROP_W = 0.8;
const DROP_H = 0.6;
const DROP_D = WALL_T + 2 * 0.3;

/** Дроп-бокс: синий ящик сквозь стену и короткая стрелка направления передачи, начинающаяся внутри ящика. */
function buildDropBox(d: ResolvedDeployable): THREE.Group {
  const g = new THREE.Group();
  g.add(withEdges(box(DROP_D, DROP_H, DROP_W, 0, 0, 0), DOOR_COLORS['drop-box']));
  // out: из −x (внутри) в +x (снаружи); in — наоборот. Стрелка от середины ящика чуть за его грань
  const toward = d.direction === 'in' ? -1 : 1;
  const arrowLen = DROP_D / 2 + 0.12;
  const arrowMat = new THREE.MeshBasicMaterial({ color: 0x8fc2ff, depthTest: false, transparent: true, opacity: 0.95 });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, arrowLen, 10), arrowMat);
  shaft.rotation.z = Math.PI / 2;
  shaft.position.set(toward * arrowLen / 2, 0, 0);
  shaft.renderOrder = 12;
  shaft.userData.keepMaterial = true; // у призрака стрелка остаётся своей, видно направление
  g.add(shaft);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.26, 12), arrowMat);
  tip.rotation.z = toward === 1 ? -Math.PI / 2 : Math.PI / 2;
  tip.position.set(toward * (arrowLen + 0.1), 0, 0);
  tip.renderOrder = 12;
  tip.userData.keepMaterial = true;
  g.add(tip);
  return g;
}

export function buildDeployable(d: ResolvedDeployable): THREE.Object3D {
  let g: THREE.Group;
  if (d.kind === 'drop-box') {
    g = buildDropBox(d);
  } else if (d.kind === 'tool-cupboard') {
    g = new THREE.Group();
    // Шкаф: TC_W вдоль стены, TC_D в глубину, TC_H высотой; спинка — локальный −x
    g.add(withEdges(box(TC_D, TC_H, TC_W, 0, TC_H / 2, 0), DOOR_TINT['tool-cupboard']!, 'wood'));
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

