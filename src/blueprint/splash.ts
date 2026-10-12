/**
 * Сплеш взрывчатки (SPEC §9.4): взрыв бьёт по всем элементам в радиусе с падением урона по
 * расстоянию до ближайшей точки элемента. Ракеты, C4, разрывные патроны и сачели — у каждой свои
 * урон, радиусы и цена в сере. Модель приближённая, константы в одном месте, подлежат замеру.
 */
import { KINDS, cellVertices, wallHeight } from './catalog.ts';
import type { DeployableKind, Grade, Resolved, ResolvedDeployable, ResolvedElement } from './types.ts';
import { cheapestFrom, frontier, reachableSpaces, spacesValue, stepCost } from './raid.ts';
import type { RaidAlternative, RaidStep, SpaceGraph } from './raid.ts';
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
  'tool-cupboard': 0,
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
    area: true, fullRadius: 0.1, maxRadius: 0.5, sulfur: 25,
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

export interface SplashPlan {
  /** false — какая-то цель осталась целой: до неё с места рейдера не достать. */
  complete: boolean;
  shots: SplashShot[];
  /** Единиц каждой взрывчатки. */
  units: Partial<Record<Explosive, number>>;
  sulfur: number;
  /** Сера «по штукам» лучшей одиночной взрывчаткой на каждый элемент. */
  sulfurPerItem: number;
  damageTaken: Record<string, number>;
}

const DEG = Math.PI / 180;
/** Стены и двери чуть короче плит по высоте: их верх и низ не лежат на плоскости пола,
 * поэтому взрыв на крыше до стены под плитой не достаёт. */
const WALL_GAP = 0.05;

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
      surface: { kind: 'rect', w: 3, h: h - 2 * WALL_GAP, y0: WALL_GAP },
      center: [el.position[0], el.position[1] + h / 2, el.position[2]],
      candidates: rectPoints(3, h - 2 * WALL_GAP, WALL_GAP).map(p => toWorld(el.position, el.rotation, p)),
    };
  }
  if (info.category === 'cell') {
    const r = info.shape === 'square' ? 1.5 : 0.866;
    // центр, середины рёбер и вершины: удар в угол, где сходятся несколько плит, задевает их все
    const local: Vec3[] = [[0, 0, 0], [r, 0, 0], [-r, 0, 0], [0, 0, r], [0, 0, -r],
      ...cellVertices(info.shape!).map(([x, z]) => [x, 0, z] as Vec3)];
    return {
      id: el.id, kind: el.kind, hp, hit: hitByGrade(el.grade), carrierId: el.id, origin: el.position, rotation: el.rotation, axis: 'y', center: el.position,
      surface: { kind: 'poly', polygon: cellVertices(info.shape!) },
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

/** Все ломаемые элементы и объекты чертежа как цели сплеша. */
export function allSplashTargets(resolved: Resolved): SplashTarget[] {
  const ids = [
    ...resolved.elements.filter(e => KINDS[e.kind].category === 'wallType' || KINDS[e.kind].category === 'cell').map(e => e.id),
    ...resolved.deployables.filter(d => d.kind !== 'tool-cupboard').map(d => d.id),
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
  const poly = t.surface.polygon;
  if (insidePolygon(l[0], l[2], poly)) return toWorld(t.origin, t.rotation, [l[0], 0, l[2]]);
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
  return toWorld(t.origin, t.rotation, [best[0], 0, best[1]]);
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
    return y >= MARGIN && y <= (o.height ?? 3) - MARGIN && Math.abs(z) <= 1.5 - MARGIN;
  }
  if ((la[1] > 1e-6 && lb[1] > 1e-6) || (la[1] < -1e-6 && lb[1] < -1e-6)) return false;
  if (Math.abs(lb[1] - la[1]) < 1e-9) return false;
  const t = la[1] / (la[1] - lb[1]);
  if (endExempt && t > 1 - END_EPS) return false;
  const x = la[0] + (lb[0] - la[0]) * t;
  const z = la[2] + (lb[2] - la[2]) * t;
  return insidePolygon(x, z, o.polygon!.map(([px, pz]) => [px * (1 - MARGIN / 1.5), pz * (1 - MARGIN / 1.5)] as [number, number]));
}

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
  const clear = (p: Vec3) => !occ.some(o => o.id !== owner.carrierId && segmentBlocked(eye, p, o));
  const full = nudgeTowards(c, eye, owner.center);
  if (clear(full)) return full;
  const plain = nudgeTowards(c, eye);
  return clear(plain) ? plain : null;
}

/** Урон единицы ex в точке p по всем целям с учётом преград; owner — цель, на поверхности которой точка. */
function damageMap(ex: Explosive, p: Vec3, owner: SplashTarget, targets: SplashTarget[], occ: Occluder[]): Record<string, number> {
  const damage: Record<string, number> = {};
  if (!EXPLOSIVES[ex].area) {
    // контактная взрывчатка: только блок, на который поставлена
    if (targets.includes(owner)) damage[owner.id] = owner.hit[ex];
    return damage;
  }
  for (const t of targets) {
    let dmg = unitDamage(ex, p, t);
    if (dmg > 0 && t.id !== owner.id) {
      const q = nearestPoint(p, t);
      if (occ.some(o => o.id !== t.carrierId && segmentBlocked(p, q, o))) dmg = 0;
    }
    if (dmg > 0) damage[t.id] = dmg;
  }
  return damage;
}

function liveOccluders(resolved: Resolved, broken: Set<string>, byId: Map<string, SplashTarget>): Occluder[] {
  const liveDoorCarriers = new Set(resolved.deployables.filter(d => d.kind !== 'tool-cupboard' && !broken.has(d.id)).map(d => d.parent));
  const brokenCarriers = new Set([...broken].map(id => byId.get(id)?.carrierId ?? id));
  return occluders(resolved, liveDoorCarriers).filter(o => !broken.has(o.id) && (!brokenCarriers.has(o.id) || liveDoorCarriers.has(o.id)));
}

/** Сера «по штукам»: каждый элемент лучшей одиночной взрывчаткой из разрешённых. */
export function perItemSulfur(targets: SplashTarget[], allowed: Explosive[]): number {
  return targets.reduce((acc, t) => acc + Math.min(...allowed.map(ex => Math.ceil(t.hp / t.hit[ex] - 1e-9) * EXPLOSIVES[ex].sulfur)), 0);
}

/**
 * План по пути: цели — элементы пути по порядку. Пока есть живые цели, выбираем пару
 * (точка на фронте, взрывчатка) с наибольшим полезным уроном на единицу серы; одинаковые
 * пары объединяются. Правило фронта: стрелять можно только по первой живой цели и целям до неё.
 */
export function planSplash(resolved: Resolved, ids: string[], allowed: Explosive[], eyes?: Record<string, Vec3>): SplashPlan {
  const targets = splashTargets(resolved, ids);
  const byId = new Map(allSplashTargets(resolved).map(t => [t.id, t]));
  const hpLeft = new Map(targets.map(t => [t.id, t.hp]));
  const isAlive = (t: SplashTarget) => (hpLeft.get(t.id) ?? 0) > 1e-6;
  const shots = new Map<string, SplashShot>();
  const units: Partial<Record<Explosive, number>> = {};
  let sulfur = 0;

  const raiderEye = (i: number): Vec3 => {
    const t = targets[i];
    if (eyes?.[t.id]) return eyes[t.id];
    if (i > 0) return targets[i - 1].center;
    const next = targets[i + 1]?.center;
    const local = next ? toLocal(t.origin, t.rotation, next) : ([1, 1.5, 0] as Vec3);
    if (t.axis === 'x') local[0] = next ? -local[0] : 2; else local[1] = next ? -local[1] : 2;
    return toWorld(t.origin, t.rotation, local);
  };

  let guard = 0;
  while (targets.some(isAlive) && guard++ < 5000) {
    const broken = new Set(targets.filter(t => !isAlive(t)).map(t => t.id));
    const occ = liveOccluders(resolved, broken, byId);
    const frontierIdx = targets.findIndex(isAlive);
    type Best = { point: Vec3; ex: Explosive; score: number; damage: Record<string, number> };
    let b: Best | null = null;
    for (let i = 0; i <= frontierIdx; i++) {
      const owner = targets[i];
      const eye = raiderEye(i);
      for (const c of owner.candidates) {
        const point = visibleImpact(c, eye, owner, occ);
        if (!point) continue;
        for (const ex of allowed) {
          const damage = damageMap(ex, point, owner, targets, occ);
          let useful = 0;
          for (const t of targets) useful += Math.min(hpLeft.get(t.id) ?? 0, damage[t.id] ?? 0);
          const score = useful / EXPLOSIVES[ex].sulfur;
          if (!b || score > b.score + 1e-12) b = { point, ex, score, damage };
        }
      }
    }
    if (!b || b.score <= 1e-12) break;
    for (const t of targets) hpLeft.set(t.id, Math.max(0, (hpLeft.get(t.id) ?? 0) - (b.damage[t.id] ?? 0)));
    const key = `${b.ex}|${b.point.map((v: number) => v.toFixed(2)).join('|')}`;
    const shot = shots.get(key) ?? { point: b.point, explosive: b.ex, count: 0, damage: b.damage };
    shot.count++;
    shots.set(key, shot);
    units[b.ex] = (units[b.ex] ?? 0) + 1;
    sulfur += EXPLOSIVES[b.ex].sulfur;
  }
  const damageTaken: Record<string, number> = {};
  for (const t of targets) damageTaken[t.id] = Math.round((t.hp - (hpLeft.get(t.id) ?? 0)) * 10) / 10;
  const complete = !targets.some(isAlive);
  return { complete, shots: [...shots.values()], units, sulfur: complete ? sulfur : Infinity, sulfurPerItem: perItemSulfur(targets, allowed), damageTaken };
}

export interface Volley {
  shot: SplashShot;
  broken: string[];
  sulfur: number;
}

/**
 * Залпы одной взрывчаткой в одну точку на границе доступной области: для точки, взрывчатки и
 * числа единиц n — какие элементы погибнут (ceil(HP / урон) ≤ n). Одинаковые наборы не повторяются.
 */
export function splashVolleys(resolved: Resolved, front: { id: string; from: Vec3 }[], allowed: Explosive[], maxUnits = 12): Volley[] {
  const targets = allSplashTargets(resolved);
  const byId = new Map(targets.map(t => [t.id, t]));
  const occ = liveOccluders(resolved, new Set(), byId);
  const out: Volley[] = [];
  const seen = new Set<string>();
  for (const f of front) {
    const owner = byId.get(f.id);
    if (!owner) continue;
    for (const c of owner.candidates) {
      const point = visibleImpact(c, f.from, owner, occ);
      if (!point) continue;
      for (const ex of allowed) {
        const damage = damageMap(ex, point, owner, targets, occ);
        const needed = Object.entries(damage).map(([id, dmg]) => ({ id, n: Math.ceil(byId.get(id)!.hp / dmg - 1e-9) })).sort((a, b) => a.n - b.n);
        const limit = ex === 'explosiveAmmo' ? maxUnits * 70 : maxUnits;
        for (const n of [...new Set(needed.map(x => x.n))]) {
          if (n > limit) break;
          const broken = needed.filter(x => x.n <= n).map(x => x.id).sort();
          const key = `${ex}|${broken.join('|')}`;
          if (seen.has(key)) continue;
          seen.add(key);
          out.push({ shot: { point, explosive: ex, count: n, damage }, broken, sulfur: n * EXPLOSIVES[ex].sulfur });
        }
      }
    }
  }
  return out;
}

/**
 * Сплеш-варианты рейда: залп на границе доступной области плюс самый дешёвый остаток пути до
 * шкафа из открывшихся пространств. Только залпы, открывающие хотя бы одно новое пространство.
 */
export function volleyAlternatives(resolved: Resolved, graph: SpaceGraph, initially: Set<string>, targetCell: string, allowed: Explosive[]): RaidAlternative[] {
  const front = frontier(graph, initially);
  const volleys = splashVolleys(resolved, front.map(f => ({ id: f.id, from: f.from })), allowed);
  const out: RaidAlternative[] = [];
  for (const v of volleys) {
    const broken = new Set(v.broken);
    const after = reachableSpaces(graph, broken);
    if (![...after].some(id => !initially.has(id))) continue;
    const rest = cheapestFrom(graph, after, broken, targetCell, 'optimal');
    if (!rest) continue;
    const restPlan = rest.ids.length ? planSplash(resolved, rest.ids, allowed, rest.eyes) : null;
    if (restPlan && !restPlan.complete) continue;
    const allBroken = new Set([...broken, ...rest.ids]);
    const openedIds = [...reachableSpaces(graph, allBroken)].filter(id => !initially.has(id));
    const volleySteps: RaidStep[] = v.broken.map(id => {
      const el = resolved.elements.find(e => e.id === id);
      if (el) return stepCost(el.id, el.kind, el.grade, 'optimal');
      const d = resolved.deployables.find(x => x.id === id)!;
      return stepCost(d.id, d.kind, undefined, 'optimal');
    });
    const sulfur = v.sulfur + (restPlan?.sulfur ?? 0);
    const units: Partial<Record<Explosive, number>> = { ...(restPlan?.units ?? {}) };
    units[v.shot.explosive] = (units[v.shot.explosive] ?? 0) + v.shot.count;
    out.push({
      path: {
        steps: [...volleySteps, ...rest.steps], sulfur, ids: [...v.broken, ...rest.ids], cells: rest.cells,
        points: [v.shot.point, ...rest.points], entry: v.shot.point,
      },
      sulfur,
      units,
      shots: [v.shot, ...(restPlan?.shots ?? [])],
      opened: openedIds.length,
      openedIds,
      value: spacesValue(graph, openedIds, resolved),
      volley: { point: v.shot.point, count: v.shot.count, explosive: v.shot.explosive, broken: v.broken },
    });
  }
  return out;
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

export type Strategy = 'value' | 'progress';

/**
 * Симуляция рейда (SPEC §9.4): на каждом этапе выбирается залп «точка на границе доступной
 * области, взрывчатка, n единиц» — одна единица или столько, чтобы погиб первый элемент с учётом
 * накопленного урона. Погибшие убираются все сразу, доступная область пересчитывается, и так до
 * пространства шкафа. Стратегия value: ценность открытого на серу, затем приближение к шкафу;
 * progress: приближение к шкафу (снижение остаточной цены с учётом накопленного урона) на серу,
 * затем ценность. Итог выбирается по ценности открытого на серу среди стратегий.
 */
export function simulateRaid(resolved: Resolved, graph: SpaceGraph, targetCell: string, allowed: Explosive[], strategy: Strategy = 'value', maxStages = 24): RaidSimulation {
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
    r.has(targetCell) ? 0 : cheapestFrom(graph, r, b, targetCell, 'optimal', step => itemCost(step.id, hp))?.sulfur ?? Infinity;
  let remaining = remainingCost(reachable, broken, hpLeft);

  while (!reachable.has(targetCell) && stages.length < maxStages) {
    const occ = liveOccluders(resolved, broken, byId);
    const front = frontier(graph, reachable).filter(f => !broken.has(f.id));
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
      const key = (x: Cand) => strategy === 'value'
        ? [x.valueGain / x.sulfur, x.progress / x.sulfur, -x.sulfur, x.brokenNow.length]
        : [x.progress / x.sulfur, x.valueGain / x.sulfur, -x.sulfur, x.brokenNow.length];
      const better = (a: Cand, b: Cand) => { const ka = key(a), kb = key(b); for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return ka[i] > kb[i]; return false; };
      if (!bestRef.c || better(cand, bestRef.c)) bestRef.c = cand;
    };
    for (const f of front) {
      const owner = byId.get(f.id);
      if (!owner || broken.has(owner.id)) continue;
      for (const c of owner.candidates) {
        const point = visibleImpact(c, f.from, owner, occ);
        if (!point) continue;
        for (const ex of allowed) {
          const damage = damageMap(ex, point, owner, live, occ);
          let nKill = Infinity;
          for (const [id, dmg] of Object.entries(damage)) nKill = Math.min(nKill, Math.ceil((hpLeft.get(id) ?? 0) / dmg - 1e-9));
          if (!Number.isFinite(nKill) || nKill <= 0) continue;
          consider({ point, explosive: ex, count: nKill, damage });
          if (nKill > 1) consider({ point, explosive: ex, count: 1, damage });
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
    stages.push({ shot: b.shot, broken: b.brokenNow, opened: b.opened, sulfur: b.sulfur });
  }
  const openedIds = [...reachable].filter(id => !initially.has(id));
  return { stages, reached: reachable.has(targetCell), sulfur, units, broken: stages.flatMap(s => s.broken), openedIds };
}

/** Лучшая симуляция среди стратегий: ценность открытого на серу, при равенстве дешевле. */
export function bestSimulation(resolved: Resolved, graph: SpaceGraph, targetCell: string, allowed: Explosive[]): RaidSimulation | null {
  const runs = (['value', 'progress'] as Strategy[]).map(st => simulateRaid(resolved, graph, targetCell, allowed, st)).filter(r => r.reached);
  if (runs.length === 0) return null;
  const score = (r: RaidSimulation) => (r.sulfur <= 0 ? Infinity : spacesValue(graph, r.openedIds, resolved) / r.sulfur);
  return runs.sort((a, b) => score(b) - score(a) || a.sulfur - b.sulfur)[0];
}
