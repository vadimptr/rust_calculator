/**
 * Сплеш взрывчатки (SPEC §9.4): взрыв бьёт по всем элементам в радиусе с падением урона по
 * расстоянию до ближайшей точки элемента. Ракеты, C4, разрывные патроны и сачели — у каждой свои
 * урон, радиусы и цена в сере. Модель приближённая, константы в одном месте, подлежат замеру.
 */
import { KINDS, cellVertices, wallHeight } from './catalog.ts';
import type { DeployableKind, Grade, Resolved, ResolvedDeployable, ResolvedElement } from './types.ts';
import { OUTSIDE, cheapestFrom, frontier, reachableSpaces, spacesValue } from './raid.ts';
import type { SpaceGraph } from './raid.ts';
import type { ExplosiveType } from '../types/index.ts';

export type Explosive = ExplosiveType;

export interface ExplosiveSpec {
  label: string;
  /** Урон по строительному блоку по материалу при прямом попадании. */
  block: Record<Grade, number>;
  /** Урон по дверям по виду и по вставкам в окна. */
  door: Record<DeployableKind, number>;
  /** Бьёт ли по области: ракета и разрывной — да, C4 и сачель — только по блоку, на который поставлены. */
  area: boolean;
  /** Полный урон в этом радиусе (до ближайшей точки элемента), дальше линейное падение до maxRadius. */
  fullRadius: number;
  maxRadius: number;
  sulfur: number;
}

const doorTable = (wood: number, sheet: number, garage: number, armored: number, glass: number, bars: number): Record<DeployableKind, number> => ({
  'tool-cupboard': 0, 'drop-box': 0,
  'wooden-door': wood, 'wooden-double-door': wood,
  'sheet-metal-door': sheet, 'sheet-metal-double-door': sheet,
  'garage-door': garage,
  'armored-door': armored, 'armored-double-door': armored,
  'strengthened-glass-window': glass, 'reinforced-glass-window': bars, 'metal-window-bars': bars,
});

/** Константы подобраны так, чтобы число единиц на блок совпадало с таблицей рейда 2026-09. */
export const EXPLOSIVES: Record<Explosive, ExplosiveSpec> = {
  rocket: {
    label: 'Ракета',
    block: { twig: 10, wood: 137.7, stone: 137.7, metal: 137.7, armored: 137.7 },
    door: doorTable(210, 210, 210, 210, 137.7, 137.7),
    area: true, fullRadius: 1.0, maxRadius: 3.8, sulfur: 1400,
  },
  c4: {
    label: 'C4',
    block: { twig: 10, wood: 275, stone: 275, metal: 275, armored: 275 },
    door: doorTable(350, 350, 350, 350, 275, 275),
    area: false, fullRadius: 0, maxRadius: 0, sulfur: 2200,
  },
  explosiveAmmo: {
    label: 'Разрывной патрон',
    block: { twig: 10, wood: 5.11, stone: 2.703, metal: 2.5, armored: 2.504 },
    door: doorTable(11.12, 3.97, 4, 4, 2.5, 2.5),
    area: true, fullRadius: 0.3, maxRadius: 0.6, sulfur: 25,
  },
  satchel: {
    label: 'Сачель',
    block: { twig: 10, wood: 83.4, stone: 50, metal: 43.5, armored: 43.5 },
    door: doorTable(100, 62.5, 66.7, 66.7, 40, 43.5),
    area: false, fullRadius: 0, maxRadius: 0, sulfur: 480,
  },
};

/** Наборы для методов рейда: «оптимально» — ракеты, C4 и разрывные вперемешку. */
export const METHOD_EXPLOSIVES: Record<'optimal' | Explosive, Explosive[]> = {
  optimal: ['rocket', 'c4', 'explosiveAmmo'],
  rocket: ['rocket'],
  c4: ['c4'],
  explosiveAmmo: ['explosiveAmmo'],
  satchel: ['satchel'],
};

export const BLOCK_HP: Record<Grade, number> = { twig: 10, wood: 250, stone: 500, metal: 1000, armored: 2000 };

export const DEPLOYABLE_HP: Partial<Record<DeployableKind, number>> = {
  'wooden-door': 200, 'wooden-double-door': 200,
  'sheet-metal-door': 250, 'sheet-metal-double-door': 250,
  'garage-door': 600,
  'armored-door': 1000, 'armored-double-door': 1000,
  'strengthened-glass-window': 350, 'reinforced-glass-window': 500, 'metal-window-bars': 500,
};

export type Vec3 = [number, number, number];

export interface SplashTarget {
  id: string;
  kind: string;
  hp: number;
  /** Урон при прямом попадании по типу взрывчатки. */
  hit: Record<Explosive, number>;
  /** Элемент-носитель: для стены — она сама, для двери и вставки — её проём. */
  carrierId: string;
  origin: Vec3;
  rotation: number;
  /** Ось нормали носителя: x у стен и дверей, y у полов. */
  axis: 'x' | 'y';
  center: Vec3;
  /** Поверхность в локальной системе носителя. */
  surface: { kind: 'rect'; w: number; h: number; y0: number } | { kind: 'poly'; polygon: [number, number][] };
  /** Точки-кандидаты для удара на поверхности: центр, края, углы. */
  candidates: Vec3[];
}

export interface SplashShot {
  point: Vec3;
  explosive: Explosive;
  count: number;
  /** Урон одной единицы в этой точке по каждой цели. */
  damage: Record<string, number>;
}

const DEG = Math.PI / 180;
/** Стены и двери как цели на WALL_GAP короче по высоте и по ширине: их рёбра и торцы не
 * лежат на плоскостях соседних плит и стен, поэтому взрыв снаружи не достаёт до стены под
 * плитой и до проёма за угловой колонной. */
const WALL_GAP = 0.05;
/** Плиты не выступают за стены: кромка на FLOOR_INSET внутрь от плоскости стены, а расчётная
 * поверхность — в середине толщины плиты, так что снаружи кромку закрывает стена. */
const FLOOR_INSET = 0.05;
const FLOOR_MID = 0.1;

function toWorld(origin: Vec3, rotation: number, local: Vec3): Vec3 {
  const a = rotation * DEG;
  const [lx, ly, lz] = local;
  return [origin[0] + lx * Math.cos(a) - lz * Math.sin(a), origin[1] + ly, origin[2] + lx * Math.sin(a) + lz * Math.cos(a)];
}

function toLocal(origin: Vec3, rotation: number, p: Vec3): Vec3 {
  const a = -rotation * DEG;
  const dx = p[0] - origin[0], dy = p[1] - origin[1], dz = p[2] - origin[2];
  return [dx * Math.cos(a) - dz * Math.sin(a), dy, dx * Math.sin(a) + dz * Math.cos(a)];
}

function dist(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function clamp(v: number, lo: number, hi: number): number { return Math.min(hi, Math.max(lo, v)); }

/** Доля урона по расстоянию для данной взрывчатки. */
export function falloff(ex: Explosive, d: number): number {
  const { fullRadius, maxRadius } = EXPLOSIVES[ex];
  if (d <= fullRadius) return 1;
  if (d >= maxRadius) return 0;
  return 1 - (d - fullRadius) / (maxRadius - fullRadius);
}

function rectPoints(w: number, h: number, y0 = 0): Vec3[] {
  const hw = w / 2;
  return [
    [0, y0 + h / 2, 0],
    [0, y0 + h / 2, -hw], [0, y0 + h / 2, hw],
    [0, y0, 0], [0, y0 + h, 0],
    [0, y0, -hw], [0, y0, hw], [0, y0 + h, -hw], [0, y0 + h, hw],
  ];
}

function hitByGrade(grade: Grade): Record<Explosive, number> {
  return { rocket: EXPLOSIVES.rocket.block[grade], c4: EXPLOSIVES.c4.block[grade], explosiveAmmo: EXPLOSIVES.explosiveAmmo.block[grade], satchel: EXPLOSIVES.satchel.block[grade] };
}

function hitByDoor(kind: DeployableKind): Record<Explosive, number> {
  return { rocket: EXPLOSIVES.rocket.door[kind], c4: EXPLOSIVES.c4.door[kind], explosiveAmmo: EXPLOSIVES.explosiveAmmo.door[kind], satchel: EXPLOSIVES.satchel.door[kind] };
}

function elementTarget(el: ResolvedElement): SplashTarget | null {
  const info = KINDS[el.kind];
  const hp = BLOCK_HP[el.grade];
  if (info.category === 'wallType') {
    const h = wallHeight(el.kind);
    return {
      id: el.id, kind: el.kind, hp, hit: hitByGrade(el.grade), carrierId: el.id, origin: el.position, rotation: el.rotation, axis: 'x',
      // стена-цель на WALL_GAP короче и по ширине: её торец не выходит на угловую колонну
      surface: { kind: 'rect', w: 3 - 2 * WALL_GAP, h: h - 2 * WALL_GAP, y0: WALL_GAP },
      center: [el.position[0], el.position[1] + h / 2, el.position[2]],
      candidates: rectPoints(3 - 2 * WALL_GAP, h - 2 * WALL_GAP, WALL_GAP).map(p => toWorld(el.position, el.rotation, p)),
    };
  }
  if (info.category === 'cell') {
    const r = info.shape === 'square' ? 1.5 : 0.866;
    const k = 1 - FLOOR_INSET / r;
    const poly = cellVertices(info.shape!).map(([x, z]) => [x * k, z * k] as [number, number]);
    // центр, середины рёбер и вершины: удар в угол, где сходятся несколько плит, задевает их все
    const local: Vec3[] = [[0, 0, 0], [r * k, 0, 0], [-r * k, 0, 0], [0, 0, r * k], [0, 0, -r * k],
      ...poly.map(([x, z]) => [x, 0, z] as Vec3)];
    const origin: Vec3 = [el.position[0], el.position[1] - FLOOR_MID, el.position[2]];
    return {
      id: el.id, kind: el.kind, hp, hit: hitByGrade(el.grade), carrierId: el.id, origin, rotation: el.rotation, axis: 'y', center: el.position,
      surface: { kind: 'poly', polygon: poly },
      candidates: local.map(p => toWorld(el.position, el.rotation, p)),
    };
  }
  return null;
}

function deployableTarget(d: ResolvedDeployable, resolved: Resolved): SplashTarget | null {
  const hp = DEPLOYABLE_HP[d.kind];
  if (!hp) return null;
  const parent = resolved.elements.find(e => e.id === d.parent);
  const h = parent ? wallHeight(parent.kind) : 3;
  const isWindow = parent?.kind === 'window-frame';
  const y0 = isWindow ? 0.95 : 0;
  const hh = isWindow ? 1.3 : d.kind.includes('double') || d.kind === 'garage-door' ? 2.6 : 2.2;
  const w = d.kind.includes('double') || d.kind === 'garage-door' ? 2.7 : isWindow ? 2.2 : 1.3;
  const dh = Math.min(hh, h) - 2 * WALL_GAP;
  return {
    id: d.id, kind: d.kind, hp, hit: hitByDoor(d.kind), carrierId: d.parent, origin: d.position, rotation: d.rotation, axis: 'x',
    surface: { kind: 'rect', w, h: dh, y0: y0 + WALL_GAP },
    center: [d.position[0], d.position[1] + y0 + Math.min(hh, h) / 2, d.position[2]],
    candidates: rectPoints(w, dh, y0 + WALL_GAP).map(p => toWorld(d.position, d.rotation, p)),
  };
}

export function splashTargets(resolved: Resolved, ids: string[]): SplashTarget[] {
  const out: SplashTarget[] = [];
  for (const id of ids) {
    const el = resolved.elements.find(e => e.id === id);
    if (el) { const t = elementTarget(el); if (t) out.push(t); continue; }
    const d = resolved.deployables.find(x => x.id === id);
    if (d) { const t = deployableTarget(d, resolved); if (t) out.push(t); }
  }
  return out;
}

/** Сетка точек на поверхности цели (мир): центр, рёбра, углы и промежуточные точки. */
export function surfacePoints(t: SplashTarget, steps = 3): Vec3[] {
  const out: Vec3[] = [];
  if (t.surface.kind === 'rect') {
    const { w, h, y0 } = t.surface;
    for (let i = 0; i <= steps; i++) for (let j = 0; j <= steps; j++) {
      out.push(toWorld(t.origin, t.rotation, [0, y0 + (h * i) / steps, -w / 2 + (w * j) / steps]));
    }
    return out;
  }
  const poly = t.surface.polygon;
  const n = poly.length;
  out.push(toWorld(t.origin, t.rotation, [0, 0, 0]));
  for (let i = 0; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n];
    for (let k = 0; k < steps; k++) {
      const f = k / steps;
      const x = a[0] + (b[0] - a[0]) * f, z = a[1] + (b[1] - a[1]) * f;
      out.push(toWorld(t.origin, t.rotation, [x, 0, z]));
      out.push(toWorld(t.origin, t.rotation, [x * 0.5, 0, z * 0.5]));
    }
  }
  return out;
}

/** Сдвиг точки вдоль поверхности цели (в её локальных осях) на (du, dv). */
export function moveOnSurface(t: SplashTarget, p: Vec3, du: number, dv: number): Vec3 {
  const l = toLocal(t.origin, t.rotation, p);
  // точка проецируется обратно на поверхность: нормальная составляющая обнуляется
  if (t.surface.kind === 'rect') {
    const { w, h, y0 } = t.surface;
    return toWorld(t.origin, t.rotation, [0, clamp(l[1] + dv, y0, y0 + h), clamp(l[2] + du, -w / 2, w / 2)]);
  }
  const poly = t.surface.polygon;
  const nx = l[0] + du, nz = l[2] + dv;
  // не выходим за полигон: при выходе остаёмся на месте
  return insidePolygon(nx, nz, poly) ? toWorld(t.origin, t.rotation, [nx, 0, nz]) : toWorld(t.origin, t.rotation, [l[0], 0, l[2]]);
}

/** Все ломаемые элементы и объекты чертежа как цели сплеша. */
export function allSplashTargets(resolved: Resolved): SplashTarget[] {
  const ids = [
    ...resolved.elements.filter(e => KINDS[e.kind].category === 'wallType' || KINDS[e.kind].category === 'cell').map(e => e.id),
    ...resolved.deployables.filter(d => d.kind !== 'tool-cupboard' && d.kind !== 'drop-box').map(d => d.id),
  ];
  return splashTargets(resolved, ids);
}

function insidePolygon(x: number, z: number, poly: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

/** Ближайшая к p точка поверхности цели (в мире). */
export function nearestPoint(p: Vec3, t: SplashTarget): Vec3 {
  const l = toLocal(t.origin, t.rotation, p);
  if (t.surface.kind === 'rect') {
    const { w, h, y0 } = t.surface;
    return toWorld(t.origin, t.rotation, [0, clamp(l[1], y0, y0 + h), clamp(l[2], -w / 2, w / 2)]);
  }
  // у плиты — грань, обращённая к взрыву: верх, если взрыв над срединной плоскостью, иначе низ
  const face = l[1] >= 0 ? FLOOR_MID : -FLOOR_MID;
  const poly = t.surface.polygon;
  if (insidePolygon(l[0], l[2], poly)) return toWorld(t.origin, t.rotation, [l[0], face, l[2]]);
  let best: [number, number] = poly[0];
  let bestD = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const len2 = dx * dx + dz * dz || 1;
    const tt = clamp(((l[0] - a[0]) * dx + (l[2] - a[1]) * dz) / len2, 0, 1);
    const q: [number, number] = [a[0] + dx * tt, a[1] + dz * tt];
    const d = Math.hypot(l[0] - q[0], l[2] - q[1]);
    if (d < bestD) { bestD = d; best = q; }
  }
  return toWorld(t.origin, t.rotation, [best[0], face, best[1]]);
}

/** Расстояние от взрыва до ближайшей точки цели: удар в угол плиты даёт по ней полный урон. */
export function distanceTo(p: Vec3, t: SplashTarget): number {
  return dist(p, nearestPoint(p, t));
}

/** Урон одной единицы взрывчатки ex в точке p по цели t (без преград). */
export function unitDamage(ex: Explosive, p: Vec3, t: SplashTarget): number {
  return t.hit[ex] * falloff(ex, distanceTo(p, t));
}

/** Преграда для сплеша: вертикальный прямоугольник стены-типа или горизонтальный полигон ячейки. */
export interface Occluder {
  id: string;
  kind: 'wall' | 'cell';
  origin: Vec3;
  rotation: number;
  height?: number;
  polygon?: [number, number][];
}

/**
 * Границы преграды включающие; самый конец отрезка (поверхность цели) соседней преградой не
 * считается — так плиты и стены в общем углу открыты друг другу. Стена под плитой при этом закрыта:
 * её верх на WALL_GAP ниже плоскости пола, и отрезок пересекает плиту раньше конца.
 */
const MARGIN = -1e-6;
const END_EPS = 1e-3;

export function segmentBlocked(a: Vec3, b: Vec3, o: Occluder, endExempt = true): boolean {
  const la = toLocal(o.origin, o.rotation, a);
  const lb = toLocal(o.origin, o.rotation, b);
  if (o.kind === 'wall') {
    if ((la[0] > 1e-6 && lb[0] > 1e-6) || (la[0] < -1e-6 && lb[0] < -1e-6)) return false;
    if (Math.abs(lb[0] - la[0]) < 1e-9) return false;
    const t = la[0] / (la[0] - lb[0]);
    if (endExempt && t > 1 - END_EPS) return false;
    const y = la[1] + (lb[1] - la[1]) * t;
    const z = la[2] + (lb[2] - la[2]) * t;
    // стена-преграда: низ с допуском GRAZE (стена, стоящая на крыше, не закрывает плиты вокруг своего
    // низа), верх — полный, чтобы снаружи вдоль стены не достать до кромки потолка
    // низ стены почти без допуска: иначе луч снаружи проскальзывал под стеной второго этажа к плитам
    // пола за ней; верх — с допуском GRAZE для лучей из-под уровня крыши
    return y >= GRAZE_BOTTOM && y <= (o.height ?? 3) - GRAZE && Math.abs(z) <= 1.5 - MARGIN;
  }
  if ((la[1] > 1e-6 && lb[1] > 1e-6) || (la[1] < -1e-6 && lb[1] < -1e-6)) return false;
  if (Math.abs(lb[1] - la[1]) < 1e-9) return false;
  const t = la[1] / (la[1] - lb[1]);
  if (endExempt && t > 1 - END_EPS) return false;
  const x = la[0] + (lb[0] - la[0]) * t;
  const z = la[2] + (lb[2] - la[2]) * t;
  // Вниз сквозь плоскость плиты (с крыши внутрь) плита закрывает с запасом SEAM — швы между плитами
  // закрыты; вверх (из-под уровня крыши к стене над ней) плита не цепляет луч своей кромкой.
  const grow = la[1] > lb[1] ? SEAM : -GRAZE;
  const r = Math.hypot(o.polygon![0][0], o.polygon![0][1]) || 1;
  const k = 1 + grow / (r * 0.7071);
  return insidePolygon(x, z, o.polygon!.map(([px, pz]) => [px * k, pz * k] as [number, number]));
}

/** Запас плиты для лучей вниз (закрывает швы) и допуск кромки для лучей вверх. */
const SEAM = 0.05;
const GRAZE = 0.02;
const GRAZE_BOTTOM = -1e-6; // низ стены включительно: пологий луч снаружи не проскальзывает под стеной второго этажа

/** Преграды из геометрии: стены-типы и ячейки. Проёмы без живой двери и низкие стены не преграда. */
export function occluders(resolved: Resolved, liveDoorCarriers: Set<string>): Occluder[] {
  const out: Occluder[] = [];
  for (const el of resolved.elements) {
    const info = KINDS[el.kind];
    if (info.category === 'wallType') {
      if (info.opening && !liveDoorCarriers.has(el.id)) continue;
      if (el.kind === 'low-wall') continue;
      out.push({ id: el.id, kind: 'wall', origin: el.position, rotation: el.rotation, height: wallHeight(el.kind) });
    } else if (info.category === 'cell') {
      if (info.isFrame) continue;
      out.push({ id: el.id, kind: 'cell', origin: el.position, rotation: el.rotation, polygon: cellVertices(info.shape!) });
    }
  }
  return out;
}

const NUDGE = 0.12;

/** Точка удара: кандидат, сдвинутый к точке обзора рейдера и, у края или угла, наружу вдоль поверхности. */
export function nudgeTowards(c: Vec3, eye: Vec3, center?: Vec3): Vec3 {
  const d: Vec3 = [eye[0] - c[0], eye[1] - c[1], eye[2] - c[2]];
  const len = Math.hypot(...d) || 1;
  const out: Vec3 = [c[0] + (d[0] / len) * NUDGE, c[1] + (d[1] / len) * NUDGE, c[2] + (d[2] / len) * NUDGE];
  if (center) {
    const v: Vec3 = [c[0] - center[0], 0, c[2] - center[2]];
    const vl = Math.hypot(...v);
    if (vl > 1e-6) { out[0] += (v[0] / vl) * NUDGE; out[2] += (v[2] / vl) * NUDGE; }
  }
  return out;
}

/**
 * Точка удара, видимая с места рейдера: кандидат со сдвигом; если сдвиг наружу увёл точку за
 * преграду (например, внутрь закрытой комнаты за стеной), берётся сдвиг только к рейдеру; если и
 * он за преградой — точки нет.
 */
function visibleImpact(c: Vec3, eye: Vec3, owner: SplashTarget, occ: Occluder[]): Vec3 | null {
  // точка должна быть с той же стороны элемента, что и рейдер
  const side = (p: Vec3) => { const l = toLocal(owner.origin, owner.rotation, p); return Math.sign(owner.axis === 'x' ? l[0] : l[1]); };
  const eyeSide = side(eye);
  // для видимости конец отрезка не исключается: точка за самой стеной невидима
  const clear = (p: Vec3) => (eyeSide === 0 || side(p) === eyeSide) && !occ.some(o => o.id !== owner.carrierId && segmentBlocked(eye, p, o, false));
  const full = nudgeTowards(c, eye, owner.center);
  if (clear(full)) return full;
  const plain = nudgeTowards(c, eye);
  return clear(plain) ? plain : null;
}

/** Радиус контакта: элемент, чья ближайшая точка не дальше этого от точки на поверхности, касается взрыва. */
const CONTACT = 0.15;

/** Сторона точки относительно плоскости цели: +1 по нормали (x) или сверху (y), −1 иначе. */
function sideOf(t: SplashTarget, p: Vec3): number {
  const l = toLocal(t.origin, t.rotation, p);
  return Math.sign(t.axis === 'x' ? l[0] : l[1]);
}

/**
 * Урон единицы ex в точке p по всем целям; owner — цель, на поверхности которой точка (raw — точка
 * до сдвига). Цель задета, если (1) отрезок от взрыва до её ближайшей точки не пересекает целую
 * преграду, либо (2) правило контакта: цель касается точки удара (ближайшая точка не дальше CONTACT
 * от raw), открыта рейдеру (есть в exposure) и взрыв с той стороны, с которой к ней есть доступ.
 * Так удар в угловую колонну задевает все открытые конструкции, сходящиеся в ней, но не скрытые за
 * стеной проёмы и не потолки, к которым рейдер стоит снизу.
 */
/** Досягаемость из точки p: расстояние до каждой цели, до которой взрыв доходит (один раз на точку). */
function reachMap(
  p: Vec3, owner: SplashTarget, targets: SplashTarget[], occ: Occluder[], maxRadius: number,
  contact?: { raw: Vec3; exposure: Map<string, Vec3> },
): Map<string, number> {
  const reach = new Map<string, number>();
  for (const t of targets) {
    const d = distanceTo(p, t);
    if (d >= maxRadius) continue;
    if (t.id !== owner.id) {
      const q = nearestPoint(p, t);
      // плиты одной плоскости друг друга не закрывают: взрыв над ними достаёт все плиты угла
      const coplanarSlab = (o: Occluder) => o.kind === 'cell' && t.axis === 'y' && Math.abs(o.origin[1] - (t.origin[1] + FLOOR_MID)) < 1e-6;
      const blocked = occ.some(o => o.id !== t.carrierId && !coplanarSlab(o) && segmentBlocked(p, q, o));
      if (blocked) {
        const eye = contact?.exposure.get(t.id);
        const touching = contact && eye && dist(contact.raw, nearestPoint(contact.raw, t)) <= CONTACT
          && sideOf(t, p) !== 0 && sideOf(t, p) === sideOf(t, eye);
        if (!touching) continue;
      }
    }
    reach.set(t.id, d);
  }
  return reach;
}

function damageMap(
  ex: Explosive, p: Vec3, owner: SplashTarget, targets: SplashTarget[], occ: Occluder[],
  contact?: { raw: Vec3; exposure: Map<string, Vec3> }, reach?: Map<string, number>,
): Record<string, number> {
  const damage: Record<string, number> = {};
  if (!EXPLOSIVES[ex].area) {
    // контактная взрывчатка: только блок, на который поставлена
    if (targets.includes(owner)) damage[owner.id] = owner.hit[ex];
    return damage;
  }
  const byId = new Map(targets.map(t => [t.id, t]));
  const r = reach ?? reachMap(p, owner, targets, occ, EXPLOSIVES[ex].maxRadius, contact);
  for (const [id, d] of r) {
    const t = byId.get(id)!;
    const dmg = t.hit[ex] * falloff(ex, d);
    if (dmg > 0) damage[id] = dmg;
  }
  return damage;
}

function liveOccluders(resolved: Resolved, broken: Set<string>, byId: Map<string, SplashTarget>): Occluder[] {
  const liveDoorCarriers = new Set(resolved.deployables.filter(d => d.kind !== 'tool-cupboard' && d.kind !== 'drop-box' && !broken.has(d.id)).map(d => d.parent));
  const brokenCarriers = new Set([...broken].map(id => byId.get(id)?.carrierId ?? id));
  return occluders(resolved, liveDoorCarriers).filter(o => !broken.has(o.id) && (!brokenCarriers.has(o.id) || liveDoorCarriers.has(o.id)));
}

/** Этап симуляции: залп в одну точку и всё, что после него погибло. */
export interface RaidStage {
  shot: SplashShot;
  broken: string[];
  /** Пространства, открывшиеся после этапа. */
  opened: string[];
  sulfur: number;
}

export interface RaidSimulation {
  stages: RaidStage[];
  reached: boolean;
  sulfur: number;
  units: Partial<Record<Explosive, number>>;
  /** Все разрушенные элементы в порядке этапов. */
  broken: string[];
  openedIds: string[];
}

export type Strategy = 'value' | 'progress' | 'destruction';

/**
 * Симуляция рейда (SPEC §9.4): на каждом этапе выбирается залп «точка на границе доступной
 * области, взрывчатка, n единиц» — одна единица или столько, чтобы погиб первый элемент с учётом
 * накопленного урона. Погибшие убираются все сразу, доступная область пересчитывается, и так до
 * пространства шкафа. Стратегия value: ценность открытого на серу, затем приближение к шкафу;
 * progress: приближение к шкафу (снижение остаточной цены с учётом накопленного урона) на серу,
 * затем ценность. Итог выбирается по ценности открытого на серу среди стратегий.
 */
export function simulateRaid(
  resolved: Resolved, graph: SpaceGraph, targetCell: string, allowed: Explosive[], strategy: Strategy = 'value', maxStages = 80,
  onCandidate?: (stage: number, c: { shot: SplashShot; sulfur: number; valueGain: number; progress: number; brokenNow: string[] }) => void,
  onPre?: (stage: number, shot: SplashShot, pre: number[], ownerId: string) => void,
): RaidSimulation {
  const targets = allSplashTargets(resolved);
  const byId = new Map(targets.map(t => [t.id, t]));
  const hpLeft = new Map(targets.map(t => [t.id, t.hp]));
  const broken = new Set<string>();
  const initially = reachableSpaces(graph, new Set());
  let reachable = initially;
  const stages: RaidStage[] = [];
  const units: Partial<Record<Explosive, number>> = {};
  let sulfur = 0;
  /** Остаточная цена элемента по штукам с учётом накопленного урона, лучшей из разрешённых взрывчаток. */
  const itemCost = (id: string, hp: Map<string, number>) => {
    const t = byId.get(id);
    if (!t) return 0;
    const left = hp.get(id) ?? t.hp;
    if (left <= 1e-6) return 0;
    return Math.min(...allowed.map(ex => Math.ceil(left / t.hit[ex] - 1e-9) * EXPLOSIVES[ex].sulfur));
  };
  const remainingCost = (r: Set<string>, b: Set<string>, hp: Map<string, number>) =>
    r.has(targetCell) ? 0 : cheapestFrom(graph, new Set([...r, OUTSIDE]), b, targetCell, 'optimal', step => itemCost(step.id, hp))?.sulfur ?? Infinity;
  let remaining = remainingCost(reachable, broken, hpLeft);

  while (!reachable.has(targetCell) && stages.length < maxStages) {
    const occ = liveOccluders(resolved, broken, byId);
    const front = frontier(graph, reachable).filter(f => !broken.has(f.id));
    const exposure = new Map(front.map(f => [f.id, f.from]));
    type Cand = { shot: SplashShot; brokenNow: string[]; opened: string[]; sulfur: number; valueGain: number; progress: number };
    const bestRef: { c: Cand | null } = { c: null };
    const live = targets.filter(t => !broken.has(t.id));
    const consider = (shot: SplashShot) => {
      const hp2 = new Map(hpLeft);
      for (const [id, dmg] of Object.entries(shot.damage)) hp2.set(id, Math.max(0, (hp2.get(id) ?? 0) - dmg * shot.count));
      const brokenNow = Object.keys(shot.damage).filter(id => (hp2.get(id) ?? 0) <= 1e-6).sort();
      const b2 = new Set([...broken, ...brokenNow]);
      const r2 = brokenNow.length ? reachableSpaces(graph, b2) : reachable;
      const opened = [...r2].filter(id => !reachable.has(id));
      const cost = shot.count * EXPLOSIVES[shot.explosive].sulfur;
      const valueGain = spacesValue(graph, opened, resolved);
      const rem = remainingCost(r2, b2, hp2);
      const progress = Number.isFinite(rem) ? remaining - rem : -Infinity;
      const cand: Cand = { shot, brokenNow, opened, sulfur: cost, valueGain, progress };
      onCandidate?.(stages.length, cand);
      // этап должен либо приближать к шкафу, либо открывать полноценную комнату (ценность ≥ 1):
      // дешёвые двери транзитных ячеек ради половины очка ценности — лишние
      if (!(progress > 1e-6 || valueGain >= 1)) return;
      // Число разрушаемых конструкций — всегда второй критерий после главного отношения стратегии:
      // на каждом этапе ищем точку, которая ломает больше. Затем удар ниже: с земли удобнее, чем с крыши.
      const key = (x: Cand) => strategy === 'value'
        ? [x.valueGain / x.sulfur, x.brokenNow.length, x.progress / x.sulfur, -x.sulfur, -x.shot.point[1]]
        : strategy === 'progress'
          ? [x.progress / x.sulfur, x.brokenNow.length, x.valueGain / x.sulfur, -x.sulfur, -x.shot.point[1]]
          : [x.brokenNow.length / x.sulfur, x.progress / x.sulfur, x.valueGain / x.sulfur, -x.sulfur, -x.shot.point[1]];
      const better = (a: Cand, b: Cand) => { const ka = key(a), kb = key(b); for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return ka[i] > kb[i]; return false; };
      if (!bestRef.c || better(cand, bestRef.c)) bestRef.c = cand;
    };
    // Кандидаты: сетка точек на поверхности каждого элемента фронта. Дорогая оценка (остаточная цена
    // через Дейкстру) делается только для лучших по дешёвому ключу: полезный урон на серу и число
    // задетых элементов.
    type Pre = { shot: SplashShot; owner: SplashTarget; eye: Vec3; pre: number[] };
    const pres: Pre[] = [];
    // дешёвый ключ: ценность открываемого (BFS по графу, с кэшем по набору разрушений) и полезный урон на серу
    const gainCache = new Map<string, number>();
    const preKey = (shot: SplashShot): number[] => {
      let useful = 0, touched = 0;
      const dead: string[] = [];
      for (const [id, dmg] of Object.entries(shot.damage)) {
        useful += Math.min(hpLeft.get(id) ?? 0, dmg * shot.count);
        touched++;
        if ((hpLeft.get(id) ?? 0) - dmg * shot.count <= 1e-6) dead.push(id);
      }
      const cost = shot.count * EXPLOSIVES[shot.explosive].sulfur;
      let gain = 0;
      if (dead.length) {
        const key = dead.sort().join('|');
        if (gainCache.has(key)) gain = gainCache.get(key)!;
        else {
          const r2 = reachableSpaces(graph, new Set([...broken, ...dead]));
          gain = spacesValue(graph, [...r2].filter(id => !reachable.has(id)), resolved);
          gainCache.set(key, gain);
        }
      }
      return strategy === 'value' ? [gain / cost, useful / cost, touched] : [useful / cost, gain / cost, touched];
    };
    const cmp = (a: number[], b: number[]) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return b[i] - a[i]; return 0; };
    const makeShots = (owner: SplashTarget, c0: Vec3, eye: Vec3): SplashShot[] => {
      // у плиты расчётная поверхность — середина толщины; точка удара лежит на грани, обращённой к рейдеру
      const c: Vec3 = owner.axis === 'y'
        ? [c0[0], owner.origin[1] + (eye[1] >= owner.origin[1] ? FLOOR_MID : -FLOOR_MID), c0[2]]
        : c0;
      const point = visibleImpact(c, eye, owner, occ);
      if (!point) return [];
      const shots: SplashShot[] = [];
      const maxR = Math.max(...allowed.map(ex => EXPLOSIVES[ex].maxRadius));
      const reach = allowed.some(ex => EXPLOSIVES[ex].area) ? reachMap(point, owner, live, occ, maxR, { raw: c, exposure }) : undefined;
      for (const ex of allowed) {
        const damage = damageMap(ex, point, owner, live, occ, { raw: c, exposure }, reach);
        // варианты залпа: одна единица и каждый порог, на котором гибнет очередной задетый элемент
        const needs = Object.entries(damage).map(([id, dmg]) => Math.ceil((hpLeft.get(id) ?? 0) / dmg - 1e-9)).filter(n => n > 0);
        if (needs.length === 0) continue;
        const cap = ex === 'explosiveAmmo' ? 2000 : 40;
        const counts = new Set([1, ...needs.filter(n => n <= cap)]);
        for (const n of counts) shots.push({ point, explosive: ex, count: n, damage });
      }
      return shots;
    };
    for (const f of front) {
      const owner = byId.get(f.id);
      if (!owner || broken.has(owner.id)) continue;
      const seenPts = new Set<string>();
      for (const c of [...owner.candidates, ...surfacePoints(owner)]) {
        const k = c.map(v => v.toFixed(2)).join('|');
        if (seenPts.has(k)) continue;
        seenPts.add(k);
        for (const shot of makeShots(owner, c, f.from)) { const pre = preKey(shot); onPre?.(stages.length, shot, pre, owner.id); pres.push({ shot, owner, eye: f.from, pre }); }
      }
    }
    // отбор по группам «взрывчатка × класс залпа», чтобы дорогую оценку получили все классы
    pres.sort((a, b) => cmp(a.pre, b.pre));
    const PER_GROUP = 16;
    const taken = new Map<string, number>();
    for (const pr of pres) {
      const cls = pr.shot.count === 1 ? 'one' : 'n';
      const key = `${pr.shot.explosive}|${cls}`;
      const n = taken.get(key) ?? 0;
      if (n >= PER_GROUP) continue;
      taken.set(key, n + 1);
      consider(pr.shot);
    }
    // Локальное дожимание лучшей точки: сдвиги вдоль поверхности, пока ключ улучшается
    if (bestRef.c) {
      const start = pres.find(pr => pr.shot === bestRef.c!.shot) ?? pres[0];
      if (start) {
        let cur = bestRef.c.shot.point;
        for (const step of [0.2, 0.07]) {
          let improved = true;
          let guardMoves = 0;
          while (improved && guardMoves++ < 8) {
            improved = false;
            for (const [du, dv] of [[step, 0], [-step, 0], [0, step], [0, -step], [step, step], [-step, -step], [step, -step], [-step, step]]) {
              const moved = moveOnSurface(start.owner, cur, du, dv);
              const before: Cand | null = bestRef.c;
              const ex = before?.shot.explosive;
              for (const shot of makeShots(start.owner, moved, start.eye)) if (shot.explosive === ex) consider(shot);
              if (bestRef.c !== before) { cur = bestRef.c!.shot.point; improved = true; }
            }
          }
        }
      }
    }
    const b = bestRef.c;
    if (!b || (!Number.isFinite(b.progress) && b.valueGain <= 0)) break;
    for (const [id, dmg] of Object.entries(b.shot.damage)) hpLeft.set(id, Math.max(0, (hpLeft.get(id) ?? 0) - (dmg as number) * b.shot.count));
    for (const id of b.brokenNow) broken.add(id);
    reachable = reachableSpaces(graph, broken);
    remaining = remainingCost(reachable, broken, hpLeft);
    units[b.shot.explosive] = (units[b.shot.explosive] ?? 0) + b.shot.count;
    sulfur += b.sulfur;
    const last = stages[stages.length - 1];
    const samePoint = last && last.shot.explosive === b.shot.explosive && last.broken.length === 0
      && last.shot.point.every((v, i) => Math.abs(v - b.shot.point[i]) < 1e-6);
    if (samePoint) {
      // продолжаем стрелять в ту же точку: один этап
      last.shot = { ...last.shot, count: last.shot.count + b.shot.count };
      last.broken = b.brokenNow; last.opened = b.opened; last.sulfur += b.sulfur;
    } else {
      stages.push({ shot: b.shot, broken: b.brokenNow, opened: b.opened, sulfur: b.sulfur });
    }
  }
  const openedIds = [...reachable].filter(id => !initially.has(id));
  return { stages, reached: reachable.has(targetCell), sulfur, units, broken: stages.flatMap(s => s.broken), openedIds };
}

/** Лучшая симуляция среди стратегий: ценность открытого на серу, при равенстве дешевле. */
export function bestSimulation(resolved: Resolved, graph: SpaceGraph, targetCell: string, allowed: Explosive[]): RaidSimulation | null {
  const runs = (['value', 'progress', 'destruction'] as Strategy[]).map(st => simulateRaid(resolved, graph, targetCell, allowed, st)).filter(r => r.reached);
  if (runs.length === 0) return null;
  const score = (r: RaidSimulation) => (r.sulfur <= 0 ? Infinity : spacesValue(graph, r.openedIds, resolved) / r.sulfur);
  const height = (r: RaidSimulation) => Math.max(0, ...r.stages.map(st => st.shot.point[1]));
  // при равной выгоде — прогон, который ломает больше, затем тот, где удары ниже
  return runs.sort((a, b) => score(b) - score(a) || a.sulfur - b.sulfur || b.broken.length - a.broken.length || height(a) - height(b))[0];
}
