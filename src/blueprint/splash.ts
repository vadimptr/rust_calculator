/**
 * Сплеш взрывчатки по правилам игры (docs/research/rust-damage-mechanics.md §2, числа — rustDamage.ts):
 * - у каждой цели коробка (bounds префаба); расстояние от центра взрыва — до ближайшей точки коробки,
 *   урон × (1 − clamp01((d − rmin)/(r − rmin)));
 * - цель задета, если виден хотя бы один из двух лучей — к центру коробки или к ближайшей точке:
 *   луч не должен упереться в чужой коллайдер раньше, чем войдёт в коробку цели (IsVisible);
 * - каждая цель получает урон от взрыва один раз; заслоняют и те, кто гибнет от этого же взрыва;
 * - посаженные C4 и сачель (onlyDamageParent) бьют только блок, на котором висят, полным уроном;
 * - центр взрыва ракеты — центр её коробки: 0.39 м перед поверхностью по линии полёта; разрывной
 *   патрон — 0.1 м перед поверхностью, радиус 1.5 м, блок под пулей получает и прямой урон пули.
 * Коллайдеры — выпуклые тела по геометрии движка: стены и двери — коробки, проёмы — их рамы,
 * полы, фундаменты и крыши — призмы своих контуров.
 */
import { FLOOR_T, KINDS, ROOF_RISE, TRI_CIRCUM, cellVertices, wallHeight } from './catalog.ts';
import type { Resolved, ResolvedDeployable, ResolvedElement } from './types.ts';
import { OUTSIDE, cheapestFrom, frontier, reachableSpaces, spacesValue } from './raid.ts';
import type { SpaceGraph } from './raid.ts';
import { EXPLOSIVE_DATA, blockProfile, deployableProfile, falloffK, unitHits } from './rustDamage.ts';
import type { DamageProfile, Explosive } from './rustDamage.ts';

export type { Explosive } from './rustDamage.ts';
export { EXPLOSIVE_DATA } from './rustDamage.ts';

/** Наборы для методов рейда: «оптимально» — ракеты, C4 и разрывные вперемешку. */
export const METHOD_EXPLOSIVES: Record<'optimal' | Explosive, Explosive[]> = {
  optimal: ['rocket', 'c4', 'explosiveAmmo'],
  rocket: ['rocket'],
  c4: ['c4'],
  explosiveAmmo: ['explosiveAmmo'],
  satchel: ['satchel'],
};

export type Vec3 = [number, number, number];

/** Локальная система: начало, поворот в плане и, у крыши, наклон вокруг локальной z. */
export interface Frame { origin: Vec3; rotation: number; pitch?: number }

/** Ориентированная коробка в мире: центр, три единичные оси, полуразмеры. */
export interface OBB { c: Vec3; u: [Vec3, Vec3, Vec3]; e: Vec3 }

/** Выпуклое тело как набор полупространств n·p ≤ d (мир). */
interface Convex { planes: { n: Vec3; d: number }[] }

export interface Collider extends Convex { id: string }

export interface SplashTarget {
  id: string;
  kind: string;
  hp: number;
  profile: DamageProfile;
  /** Урон одной единицы при k = 1: по блоку, в который попали (hit), и по соседям (splash). */
  hit: Record<Explosive, number>;
  splash: Record<Explosive, number>;
  /** Элемент-носитель: для стены — она сама, для двери и вставки — её проём. */
  carrierId: string;
  origin: Vec3;
  rotation: number;
  pitch?: number;
  /** Ось нормали поверхности: x у стен и дверей, y у полов и крыш. */
  axis: 'x' | 'y';
  /** Полутолщина: точка удара лежит на грани, обращённой к рейдеру. */
  face: number;
  center: Vec3;
  /** Коробка цели (bounds префаба) — от неё считаются расстояния и видимость. */
  obb: OBB;
  /** Поверхность для подбора точек удара в локальной системе. */
  surface: { kind: 'rect'; w: number; h: number; y0: number } | { kind: 'poly'; polygon: [number, number][] };
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

function toWorld(f: Frame, local: Vec3): Vec3 {
  const a = f.rotation * DEG;
  let [lx, ly, lz] = local;
  if (f.pitch) {
    const b = f.pitch * DEG;
    [lx, ly] = [lx * Math.cos(b) - ly * Math.sin(b), lx * Math.sin(b) + ly * Math.cos(b)];
  }
  return [f.origin[0] + lx * Math.cos(a) - lz * Math.sin(a), f.origin[1] + ly, f.origin[2] + lx * Math.sin(a) + lz * Math.cos(a)];
}

function toLocal(f: Frame, p: Vec3): Vec3 {
  const a = -f.rotation * DEG;
  const dx = p[0] - f.origin[0], dy = p[1] - f.origin[1], dz = p[2] - f.origin[2];
  let lx = dx * Math.cos(a) - dz * Math.sin(a), ly = dy;
  const lz = dx * Math.sin(a) + dz * Math.cos(a);
  if (f.pitch) {
    const b = -f.pitch * DEG;
    [lx, ly] = [lx * Math.cos(b) - ly * Math.sin(b), lx * Math.sin(b) + ly * Math.cos(b)];
  }
  return [lx, ly, lz];
}

/** Направление локальной оси в мире. */
function axisWorld(f: Frame, v: Vec3): Vec3 {
  const o = toWorld({ ...f, origin: [0, 0, 0] }, v);
  return o;
}

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);
function dist(a: Vec3, b: Vec3): number { return len(sub(a, b)); }
function clamp(v: number, lo: number, hi: number): number { return Math.min(hi, Math.max(lo, v)); }

function makeOBB(f: Frame, center: Vec3, ext: Vec3): OBB {
  return { c: toWorld(f, center), u: [axisWorld(f, [1, 0, 0]), axisWorld(f, [0, 1, 0]), axisWorld(f, [0, 0, 1])], e: ext };
}

/** Ближайшая к p точка коробки (p внутри — сама p). */
export function closestOnOBB(o: OBB, p: Vec3): Vec3 {
  const d = sub(p, o.c);
  let q = o.c;
  for (let i = 0; i < 3; i++) q = add(q, mul(o.u[i], clamp(dot(d, o.u[i]), -o.e[i], o.e[i])));
  return q;
}

function obbConvex(o: OBB): Convex {
  const planes: { n: Vec3; d: number }[] = [];
  for (let i = 0; i < 3; i++) {
    planes.push({ n: o.u[i], d: dot(o.u[i], o.c) + o.e[i] });
    planes.push({ n: mul(o.u[i], -1), d: -dot(o.u[i], o.c) + o.e[i] });
  }
  return { planes };
}

/** Призма: выпуклый многоугольник в локальной плоскости xz системы f, по y от y0 до y1. */
function prismConvex(f: Frame, poly: [number, number][], y0: number, y1: number): Convex {
  const planes: { n: Vec3; d: number }[] = [];
  const up = axisWorld(f, [0, 1, 0]);
  const pt = (x: number, y: number, z: number) => toWorld(f, [x, y, z]);
  planes.push({ n: up, d: dot(up, pt(0, y1, 0)) });
  planes.push({ n: mul(up, -1), d: -dot(up, pt(0, y0, 0)) });
  // обход многоугольника: внешняя нормаль ребра — по знаку площади
  let area = 0;
  for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; area += a[0] * b[1] - b[0] * a[1]; }
  const s = area > 0 ? 1 : -1;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    // локальная нормаль ребра в плоскости xz
    const nx = s * (b[1] - a[1]), nz = -s * (b[0] - a[0]);
    const nl = Math.hypot(nx, nz) || 1;
    const n = axisWorld(f, [nx / nl, 0, nz / nl]);
    planes.push({ n, d: dot(n, pt(a[0], 0, a[1])) });
  }
  return { planes };
}

/**
 * Вход луча o + t·dir (|dir| = 1) в выпуклое тело на отрезке [0, tMax]: t входа или null.
 * Если начало внутри тела — null: как у raycast, тело, внутри которого луч начинается, не задевается.
 */
function rayEnter(c: Convex, o: Vec3, dir: Vec3, tMax: number): number | null {
  let t0 = -Infinity, t1 = Infinity;
  for (const { n, d } of c.planes) {
    const dn = dot(n, dir), dist0 = d - dot(n, o);
    if (Math.abs(dn) < 1e-12) { if (dist0 < 0) return null; continue; }
    const t = dist0 / dn;
    if (dn < 0) t0 = Math.max(t0, t); else t1 = Math.min(t1, t);
    if (t0 > t1) return null;
  }
  if (t0 < 0) return null;
  return t0 <= tMax ? t0 : null;
}

/** Виден ли луч от p к q для цели t: не упирается в чужой коллайдер до входа в её коробку. */
function rayVisible(p: Vec3, q: Vec3, t: SplashTarget, colliders: Collider[]): boolean {
  const v = sub(q, p);
  const L = len(v);
  if (L < 1e-6) return true;
  const dir = mul(v, 1 / L);
  // начало сдвигается к цели на 0.01, длина — до цели + 0.2
  const o = add(p, mul(dir, Math.min(L, 0.01)));
  const tMax = Math.max(0, L - 0.01) + 0.2;
  const enter = rayEnter(obbConvex(t.obb), o, dir, tMax);
  // луч, начавшийся внутри коробки цели, в неё уже «вошёл»
  const inside = obbConvex(t.obb).planes.every(({ n, d }) => dot(n, o) <= d + 1e-9);
  const tEnter = inside ? 0 : enter;
  if (tEnter === null) return false;
  for (const c of colliders) {
    if (c.id === t.id) continue;
    const hit = rayEnter(c, o, dir, tEnter);
    if (hit !== null && hit <= tEnter) return false;
  }
  return true;
}

/** IsVisible: хотя бы один из двух лучей — к центру коробки или к ближайшей её точке. */
export function visibleFrom(p: Vec3, t: SplashTarget, colliders: Collider[]): boolean {
  return rayVisible(p, t.obb.c, t, colliders) || rayVisible(p, closestOnOBB(t.obb, p), t, colliders);
}

// --- Размеры проёмов (как в meshes.ts)
const DOORWAY_W = 1.3, DOORWAY_H = 2.2;
const FRAME_W = 2.7, FRAME_H = 2.85;
const WINDOW_W = 2.2, WINDOW_H = 1.3, WINDOW_SILL = 0.95;
const WALL_HALF = 0.1;

function hitsFor(p: DamageProfile): { hit: Record<Explosive, number>; splash: Record<Explosive, number> } {
  const hit = {} as Record<Explosive, number>, splash = {} as Record<Explosive, number>;
  for (const ex of Object.keys(EXPLOSIVE_DATA) as Explosive[]) { const u = unitHits(ex, p); hit[ex] = u.hit; splash[ex] = u.splash; }
  return { hit, splash };
}

function rectPoints(w: number, h: number, y0 = 0): Vec3[] {
  const hw = w / 2;
  return [
    [0, y0 + h / 2, 0], [0, y0 + h / 2, -hw], [0, y0 + h / 2, hw], [0, y0, 0], [0, y0 + h, 0],
    [0, y0, -hw], [0, y0, hw], [0, y0 + h, -hw], [0, y0 + h, hw],
  ];
}

/** Коробка ячейки в локальной системе движка (bounds префабов floor/foundation, треугольные — от основания). */
function cellBox(el: ResolvedElement): { center: Vec3; ext: Vec3 } {
  const info = KINDS[el.kind];
  const tri = info.shape === 'triangle';
  const apo = TRI_CIRCUM / 2;
  if (info.isFoundation) return tri ? { center: [apo - 1.3, -1.4, 0], ext: [1.2, 1.4, 1.4] } : { center: [0, -1.4, 0], ext: [1.4, 1.4, 1.4] };
  return tri ? { center: [apo - 1.3, -0.05, 0], ext: [1.3, 0.1, 1.5] } : { center: [0, 0, 0], ext: [1.5, 0.1, 1.5] };
}

/** Система крыши как наклонной плиты: x — вниз по скату, y — нормаль; полигон ската в (x, z). */
function roofFrame(el: ResolvedElement): Frame & { polygon: [number, number][] } {
  const square = KINDS[el.kind].shape === 'square';
  const run = square ? 3 : TRI_CIRCUM * 1.5;
  const length = Math.hypot(run, ROOF_RISE);
  // перевёрнутая треугольная крыша поднимается к ребру edge:0
  const pitch = (el.inverted ? 1 : -1) * Math.atan2(ROOF_RISE, run) / DEG;
  const midX = square ? 0 : -TRI_CIRCUM / 4;
  const origin = toWorld({ origin: el.position, rotation: el.rotation }, [midX, ROOF_RISE / 2 + FLOOR_T / 2, 0]);
  const h = length / 2;
  const polygon: [number, number][] = square ? [[h, -1.5], [h, 1.5], [-h, 1.5], [-h, -1.5]] : [[h, -1.5], [h, 1.5], [-h, 0]];
  return { origin, rotation: el.rotation, pitch, polygon };
}

function elementTarget(el: ResolvedElement): SplashTarget | null {
  const info = KINDS[el.kind];
  const profile = blockProfile(el.grade);
  const base = { id: el.id, kind: el.kind, hp: profile.hp, profile, ...hitsFor(profile), carrierId: el.id };
  const f: Frame = { origin: el.position, rotation: el.rotation };
  if (info.category === 'wallType') {
    const h = wallHeight(el.kind);
    return {
      ...base, origin: el.position, rotation: el.rotation, axis: 'x', face: WALL_HALF,
      surface: { kind: 'rect', w: 3, h, y0: 0 },
      center: toWorld(f, [0, h / 2, 0]),
      obb: makeOBB(f, [0, h / 2, 0], [0.1, h / 2, 1.5]),
      candidates: rectPoints(3, h, 0).map(p => toWorld(f, p)),
    };
  }
  if (info.category === 'cell') {
    const poly = cellVertices(info.shape!);
    const r = info.shape === 'square' ? 1.5 : 0.866;
    const local: Vec3[] = [[0, 0, 0], [r, 0, 0], [-r, 0, 0], [0, 0, r], [0, 0, -r], ...poly.map(([x, z]) => [x, 0, z] as Vec3)];
    const box = cellBox(el);
    return {
      ...base, origin: el.position, rotation: el.rotation, axis: 'y', face: info.isFoundation ? 0 : 0.1,
      surface: { kind: 'poly', polygon: poly }, center: el.position,
      obb: makeOBB(f, box.center, box.ext),
      candidates: local.map(p => toWorld(f, p)),
    };
  }
  if (info.category === 'roof') {
    const rf = roofFrame(el);
    const poly = rf.polygon;
    const local: Vec3[] = [[0, 0, 0], ...poly.map(([x, z]) => [x, 0, z] as Vec3)];
    for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; local.push([(a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2]); }
    const apo = TRI_CIRCUM / 2;
    // bounds крыши: вдоль ската ±1.4, по высоте 0.1..2.9, вдоль конька ±4.4 (в префабе так)
    const box = KINDS[el.kind].shape === 'square' ? { center: [0, 1.5, 0] as Vec3, ext: [1.4, 1.4, 4.4] as Vec3 } : { center: [apo - 1.3, 1.5, 0] as Vec3, ext: [1.4, 1.4, 4.4] as Vec3 };
    return {
      ...base, origin: rf.origin, rotation: rf.rotation, pitch: rf.pitch, axis: 'y', face: 0.1, center: rf.origin,
      surface: { kind: 'poly', polygon: poly },
      obb: makeOBB(f, box.center, box.ext),
      candidates: local.map(p => toWorld(rf, p)),
    };
  }
  return null;
}

/** Размеры двери или вставки: ширина, высота, низ, полутолщина. */
function deployableBox(d: ResolvedDeployable, resolved: Resolved): { w: number; h: number; y0: number; half: number } {
  const parent = resolved.elements.find(e => e.id === d.parent);
  if (parent?.kind === 'window-frame') return { w: 2.22, h: 1.26, y0: WINDOW_SILL, half: 0.05 };
  const wide = d.kind.includes('double') || d.kind === 'garage-door';
  return wide ? { w: 2.7, h: 2.86, y0: 0, half: 0.1 } : { w: 1.2, h: 2.2, y0: 0, half: 0.1 };
}

function deployableTarget(d: ResolvedDeployable, resolved: Resolved): SplashTarget | null {
  const profile = deployableProfile(d.kind);
  if (!profile) return null;
  const b = deployableBox(d, resolved);
  const f: Frame = { origin: d.position, rotation: d.rotation };
  return {
    id: d.id, kind: d.kind, hp: profile.hp, profile, ...hitsFor(profile), carrierId: d.parent,
    origin: d.position, rotation: d.rotation, axis: 'x', face: b.half,
    surface: { kind: 'rect', w: b.w, h: b.h, y0: b.y0 },
    center: toWorld(f, [0, b.y0 + b.h / 2, 0]),
    obb: makeOBB(f, [0, b.y0 + b.h / 2, 0], [b.half, b.h / 2, b.w / 2]),
    candidates: rectPoints(b.w, b.h, b.y0).map(p => toWorld(f, p)),
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
    ...resolved.elements.filter(e => ['wallType', 'cell', 'roof'].includes(KINDS[e.kind].category)).map(e => e.id),
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

/** Сетка точек на поверхности цели (мир): центр, рёбра, углы и промежуточные точки. */
export function surfacePoints(t: SplashTarget, steps = 3): Vec3[] {
  const out: Vec3[] = [];
  if (t.surface.kind === 'rect') {
    const { w, h, y0 } = t.surface;
    for (let i = 0; i <= steps; i++) for (let j = 0; j <= steps; j++) out.push(toWorld(t, [0, y0 + (h * i) / steps, -w / 2 + (w * j) / steps]));
    return out;
  }
  const poly = t.surface.polygon;
  out.push(toWorld(t, [0, 0, 0]));
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    for (let k = 0; k < steps; k++) {
      const f = k / steps;
      const x = a[0] + (b[0] - a[0]) * f, z = a[1] + (b[1] - a[1]) * f;
      out.push(toWorld(t, [x, 0, z]));
      out.push(toWorld(t, [x * 0.5, 0, z * 0.5]));
    }
  }
  return out;
}

/** Сдвиг точки вдоль поверхности цели (в её локальных осях) на (du, dv). */
export function moveOnSurface(t: SplashTarget, p: Vec3, du: number, dv: number): Vec3 {
  const l = toLocal(t, p);
  if (t.surface.kind === 'rect') {
    const { w, h, y0 } = t.surface;
    return toWorld(t, [0, clamp(l[1] + dv, y0, y0 + h), clamp(l[2] + du, -w / 2, w / 2)]);
  }
  const poly = t.surface.polygon;
  const nx = l[0] + du, nz = l[2] + dv;
  return insidePolygon(nx, nz, poly) ? toWorld(t, [nx, 0, nz]) : toWorld(t, [l[0], 0, l[2]]);
}

/** Расстояние от точки до цели — до ближайшей точки её коробки. */
export function distanceTo(p: Vec3, t: SplashTarget): number {
  return dist(p, closestOnOBB(t.obb, p));
}

/** Урон одной единицы взрывчатки ex по цели t с центром взрыва p (без преград, цель — не та, в которую попали). */
export function unitDamage(ex: Explosive, p: Vec3, t: SplashTarget): number {
  return t.splash[ex] * falloffK(ex, distanceTo(p, t));
}

/**
 * Коллайдеры живых элементов: стены — коробки, проёмы — их рамы (полотно — отдельной коробкой
 * двери или вставки, пока она цела), полы и фундаменты — призмы контуров, крыши — наклонные призмы.
 * Рамы полов, низкие стены и лестницы не заслоняют.
 */
export function colliders(resolved: Resolved, broken: Set<string>): Collider[] {
  const out: Collider[] = [];
  const box = (id: string, f: Frame, center: Vec3, ext: Vec3) => out.push({ id, ...obbConvex(makeOBB(f, center, ext)) });
  for (const el of resolved.elements) {
    if (broken.has(el.id)) continue;
    const info = KINDS[el.kind];
    const f: Frame = { origin: el.position, rotation: el.rotation };
    if (info.category === 'wallType') {
      if (el.kind === 'low-wall') continue;
      const h = wallHeight(el.kind);
      if (el.kind === 'doorway' || el.kind === 'wall-frame') {
        const w = el.kind === 'doorway' ? DOORWAY_W : FRAME_W, oh = el.kind === 'doorway' ? DOORWAY_H : FRAME_H;
        const side = (3 - w) / 2;
        box(el.id, f, [0, h / 2, -(w / 2 + side / 2)], [WALL_HALF, h / 2, side / 2]);
        box(el.id, f, [0, h / 2, w / 2 + side / 2], [WALL_HALF, h / 2, side / 2]);
        box(el.id, f, [0, (h + oh) / 2, 0], [WALL_HALF, (h - oh) / 2, w / 2]);
      } else if (el.kind === 'window-frame') {
        const side = (3 - WINDOW_W) / 2, top = WINDOW_SILL + WINDOW_H;
        box(el.id, f, [0, WINDOW_SILL / 2, 0], [WALL_HALF, WINDOW_SILL / 2, 1.5]);
        box(el.id, f, [0, (h + top) / 2, 0], [WALL_HALF, (h - top) / 2, 1.5]);
        box(el.id, f, [0, WINDOW_SILL + WINDOW_H / 2, -(WINDOW_W / 2 + side / 2)], [WALL_HALF, WINDOW_H / 2, side / 2]);
        box(el.id, f, [0, WINDOW_SILL + WINDOW_H / 2, WINDOW_W / 2 + side / 2], [WALL_HALF, WINDOW_H / 2, side / 2]);
      } else {
        box(el.id, f, [0, h / 2, 0], [WALL_HALF, h / 2, 1.5]);
      }
    } else if (info.category === 'cell') {
      if (info.isFrame) continue;
      const poly = cellVertices(info.shape!);
      out.push({ id: el.id, ...(info.isFoundation ? prismConvex(f, poly, -3, 0) : prismConvex(f, poly, -0.1, 0.1)) });
    } else if (info.category === 'roof') {
      const rf = roofFrame(el);
      out.push({ id: el.id, ...prismConvex(rf, rf.polygon, -FLOOR_T / 2, FLOOR_T / 2) });
    }
  }
  for (const d of resolved.deployables) {
    if (broken.has(d.id) || !deployableProfile(d.kind)) continue;
    const b = deployableBox(d, resolved);
    box(d.id, { origin: d.position, rotation: d.rotation }, [0, b.y0 + b.h / 2, 0], [b.half, b.h / 2, b.w / 2]);
  }
  return out;
}

/** Сторона точки относительно поверхности цели: +1 по нормали (x) или сверху (y). */
function sideOf(t: SplashTarget, p: Vec3): number {
  const l = toLocal(t, p);
  return Math.sign(t.axis === 'x' ? l[0] : l[1]);
}

/**
 * Точка удара на грани цели, обращённой к рейдеру: c — точка на средней поверхности. Снаряд летит
 * из глаз рейдера; если на пути чужой коллайдер — точки нет.
 */
function impactOnFace(c: Vec3, eye: Vec3, owner: SplashTarget, cols: Collider[]): Vec3 | null {
  const s = sideOf(owner, eye);
  if (s === 0 && owner.face > 0) return null;
  const l = toLocal(owner, c);
  const local: Vec3 = owner.axis === 'x' ? [s * owner.face, l[1], l[2]] : [l[0], s * owner.face, l[2]];
  const p = toWorld(owner, local);
  const v = sub(p, eye);
  const L = len(v);
  if (L < 1e-6) return p;
  const dir = mul(v, 1 / L);
  for (const col of cols) {
    if (col.id === owner.id) continue;
    const t = rayEnter(col, eye, dir, L - 1e-3);
    if (t !== null) return null;
  }
  return p;
}

/** Центр взрыва: точка удара, отнесённая к рейдеру на standoff взрывчатки. */
function explosionCenter(ex: Explosive, point: Vec3, eye: Vec3): Vec3 {
  const v = sub(eye, point);
  const L = len(v) || 1;
  return add(point, mul(v, EXPLOSIVE_DATA[ex].standoff / L));
}

/**
 * Урон одной единицы ex по целям: посаженный заряд — только блок под ним; иначе сплеш из центра
 * взрыва: цели в радиусе, видимые по правилу двух лучей; блок под ударом — полный урон попадания.
 */
function damageMap(ex: Explosive, point: Vec3, eye: Vec3, owner: SplashTarget, targets: SplashTarget[], cols: Collider[]): Record<string, number> {
  const data = EXPLOSIVE_DATA[ex];
  if (data.contact) return { [owner.id]: owner.hit[ex] };
  const center = explosionCenter(ex, point, eye);
  const toEye = sub(eye, center);
  const visOrigin = data.visOffset > 0 ? add(center, mul(toEye, data.visOffset / (len(toEye) || 1))) : center;
  const damage: Record<string, number> = {};
  for (const t of targets) {
    const d = distanceTo(center, t);
    if (d >= data.r) continue;
    const k = falloffK(ex, d);
    if (t.id === owner.id) {
      damage[t.id] = t.hit[ex] - t.splash[ex] + t.splash[ex] * k;
      continue;
    }
    if (k <= 0 || !visibleFrom(visOrigin, t, cols)) continue;
    damage[t.id] = t.splash[ex] * k;
  }
  return damage;
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

/** kills — как рейдер: только залпы, которые что-то ломают; частичный урон не копится. */
export type Strategy = 'value' | 'progress' | 'destruction' | 'kills';

/**
 * Симуляция рейда (SPEC §9.4): на каждом этапе выбирается залп «точка на границе доступной
 * области, взрывчатка, n единиц» — одна единица или столько, чтобы погиб первый элемент с учётом
 * накопленного урона. Погибшие убираются все сразу, доступная область пересчитывается, и так до
 * пространства шкафа. Стратегия value: ценность открытого на серу, затем приближение к шкафу;
 * progress: приближение к шкафу (снижение остаточной цены с учётом накопленного урона) на серу,
 * затем ценность. Итог среди стратегий — самый дешёвый по сере.
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
    return Math.min(...allowed.map(ex => Math.ceil(left / t.hit[ex] - 1e-9) * EXPLOSIVE_DATA[ex].sulfur));
  };
  const remainingCost = (r: Set<string>, b: Set<string>, hp: Map<string, number>) =>
    r.has(targetCell) ? 0 : cheapestFrom(graph, new Set([...r, OUTSIDE]), b, targetCell, 'optimal', step => itemCost(step.id, hp))?.sulfur ?? Infinity;
  /** Цена серы за единицу прочности цели лучшей из разрешённых взрывчаток. */
  const rateOf = (id: string) => { const t = byId.get(id); return t ? Math.min(...allowed.map(ex => EXPLOSIVE_DATA[ex].sulfur / t.hit[ex])) : 0; };
  let remaining = remainingCost(reachable, broken, hpLeft);

  while (!reachable.has(targetCell) && stages.length < maxStages) {
    const cols = colliders(resolved, broken);
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
      const cost = shot.count * EXPLOSIVE_DATA[shot.explosive].sulfur;
      const valueGain = spacesValue(graph, opened, resolved);
      const rem = remainingCost(r2, b2, hp2);
      const progress = Number.isFinite(rem) ? remaining - rem : -Infinity;
      const cand: Cand = { shot, brokenNow, opened, sulfur: cost, valueGain, progress };
      onCandidate?.(stages.length, cand);
      // этап должен либо приближать к шкафу, либо открывать полноценную комнату (ценность ≥ 1):
      // дешёвые двери транзитных ячеек ради половины очка ценности — лишние
      if (!(progress > 1e-6 || valueGain >= 1)) return;
      if (strategy === 'kills' && brokenNow.length === 0) return;
      // Число разрушаемых конструкций — всегда второй критерий после главного отношения стратегии:
      // на каждом этапе ищем точку, которая ломает больше. Затем удар ниже: с земли удобнее, чем с крыши.
      const key = (x: Cand) => strategy === 'value'
        ? [x.valueGain / x.sulfur, x.brokenNow.length, x.progress / x.sulfur, -x.sulfur, -x.shot.point[1]]
        : strategy === 'progress' || strategy === 'kills'
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
    // Дешёвый ключ: ценность открываемого и приближение к шкафу — по набору погибших (с кэшем по
    // этому набору: наборов намного меньше, чем точек), а для залпов без погибших — полезный урон по
    // элементу, на который поставлен залп, в пересчёте на серу. Без приближения в ключе одна ракета
    // в деревянную дверь проигрывала бы отбор залпам в угол стен с большим, но бесполезным уроном,
    // а первый C4 в стену (ничего не ломает) — дешёвым дверям транзитных ячеек. Урон по соседям
    // в кредит не идёт: иначе залп в угол четырёх стен снова вытеснял бы дверь.
    const deadCache = new Map<string, { gain: number; progress: number }>();
    const preKey = (shot: SplashShot, ownerId: string): number[] => {
      let useful = 0, touched = 0, credit = 0;
      const dead: string[] = [];
      for (const [id, dmg] of Object.entries(shot.damage)) {
        const u = Math.min(hpLeft.get(id) ?? 0, dmg * shot.count);
        useful += u;
        touched++;
        if (id === ownerId) credit = u * rateOf(id);
        if ((hpLeft.get(id) ?? 0) - dmg * shot.count <= 1e-6) dead.push(id);
      }
      const cost = shot.count * EXPLOSIVE_DATA[shot.explosive].sulfur;
      let gain = 0, progress = 0;
      if (dead.length) {
        const key = dead.sort().join('|');
        let est = deadCache.get(key);
        if (!est) {
          const b2 = new Set([...broken, ...dead]);
          const r2 = reachableSpaces(graph, b2);
          const rem = remainingCost(r2, b2, hpLeft);
          est = { gain: spacesValue(graph, [...r2].filter(id => !reachable.has(id)), resolved), progress: Number.isFinite(rem) ? remaining - rem : 0 };
          deadCache.set(key, est);
        }
        gain = est.gain; progress = est.progress;
      }
      // при равенстве — точка ниже, как и в полном ключе: с земли удобнее, чем с крыши
      const est = Math.max(progress, credit);
      return strategy === 'value'
        ? [gain / cost, est / cost, dead.length, useful / cost, touched, -shot.point[1]]
        : strategy === 'kills'
          ? [dead.length > 0 ? 1 : 0, progress / cost, gain / cost, dead.length, useful / cost, -shot.point[1]]
          : strategy === 'progress'
          ? [est / cost, gain / cost, dead.length, useful / cost, touched, -shot.point[1]]
          : [dead.length / cost, est / cost, gain / cost, useful / cost, touched, -shot.point[1]];
    };
    const cmp = (a: number[], b: number[]) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return b[i] - a[i]; return 0; };
    const makeShots = (owner: SplashTarget, c0: Vec3, eye: Vec3): SplashShot[] => {
      // точка удара — на грани цели, обращённой к рейдеру, и снаряд должен до неё долететь
      const point = impactOnFace(c0, eye, owner, cols);
      if (!point) return [];
      const shots: SplashShot[] = [];
      for (const ex of allowed) {
        const damage = damageMap(ex, point, eye, owner, live, cols);
        // варианты залпа: одна единица и каждый порог, на котором гибнет очередной задетый элемент
        const needs = Object.entries(damage).filter(([, dmg]) => dmg > 0).map(([id, dmg]) => Math.ceil((hpLeft.get(id) ?? 0) / dmg - 1e-9)).filter(n => n > 0);
        if (needs.length === 0) continue;
        const cap = ex === 'explosiveAmmo' ? 2000 : 60;
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
        for (const shot of makeShots(owner, c, f.from)) { const pre = preKey(shot, owner.id); onPre?.(stages.length, shot, pre, owner.id); pres.push({ shot, owner, eye: f.from, pre }); }
      }
    }
    // Отбор по группам «взрывчатка × класс залпа», чтобы дорогую оценку получили все классы, плюс
    // лучшая точка каждого элемента границы в каждой группе: дешёвый ключ не знает, какой элемент
    // лежит на пути к шкафу, а так ни одна стена и дверь не остаётся без оценки.
    pres.sort((a, b) => cmp(a.pre, b.pre));
    const PER_GROUP = 16;
    const taken = new Map<string, number>();
    const ownerTaken = new Set<string>();
    for (const pr of pres) {
      const cls = pr.shot.count === 1 ? 'one' : 'n';
      const key = `${pr.shot.explosive}|${cls}`;
      const ownerKey = `${pr.owner.id}|${key}`;
      const n = taken.get(key) ?? 0;
      if (n >= PER_GROUP && ownerTaken.has(ownerKey)) continue;
      if (n < PER_GROUP) taken.set(key, n + 1);
      ownerTaken.add(ownerKey);
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

/**
 * Лучшая симуляция среди стратегий: самая дешёвая по сере до шкафа. При равной цене — та, что
 * открывает больше ценности, затем ломает больше, затем бьёт ниже. Ценность не перевешивает цену:
 * план дороже на серу ради лишних комнат — это уже не рейд до шкафа.
 */
export function bestSimulation(resolved: Resolved, graph: SpaceGraph, targetCell: string, allowed: Explosive[]): RaidSimulation | null {
  const runs = (['value', 'progress', 'destruction', 'kills'] as Strategy[]).map(st => simulateRaid(resolved, graph, targetCell, allowed, st)).filter(r => r.reached);
  if (runs.length === 0) return null;
  const value = (r: RaidSimulation) => spacesValue(graph, r.openedIds, resolved);
  const height = (r: RaidSimulation) => Math.max(0, ...r.stages.map(st => st.shot.point[1]));
  return runs.sort((a, b) => a.sulfur - b.sulfur || value(b) - value(a) || b.broken.length - a.broken.length || height(a) - height(b))[0];
}
