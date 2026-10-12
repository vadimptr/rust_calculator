/**
 * Сплеш ракет (SPEC §9.4): один взрыв бьёт по всем элементам в радиусе с падением урона.
 * Модель приближённая, константы в одном месте, подлежат замеру в игре.
 */
import { KINDS, cellVertices, wallHeight } from './catalog.ts';
import type { DeployableKind, Grade, Resolved, ResolvedDeployable, ResolvedElement } from './types.ts';

export const ROCKET = {
  /** Урон по строительному блоку при прямом попадании (≈137.7 даёт 4 ракеты на каменную стену). */
  blockDamage: 137.7,
  /** Урон по двери и вставке в окно: двери ломаются быстрее (1 ракета на деревянную, 2 на металлическую). */
  doorDamage: 210,
  /** Полный урон в этом радиусе от центра взрыва до центра элемента. */
  fullRadius: 1.0,
  /** Дальше этого радиуса урона нет; между радиусами — линейное падение. */
  maxRadius: 3.8,
  sulfur: 1400,
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
  /** Элемент-носитель: для стены — она сама, для двери и вставки — её проём. */
  carrierId: string;
  /** Положение и поворот носителя (нормаль = локальный +x). */
  origin: Vec3;
  rotation: number;
  /** Центр элемента в мире. */
  center: Vec3;
  /** Урон от прямого попадания. */
  hitDamage: number;
  /** Точки-кандидаты для удара (на поверхности элемента: центр, края, углы). */
  candidates: Vec3[];
}

export interface SplashShot {
  point: Vec3;
  count: number;
  /** Урон одной ракеты в этой точке по каждой цели. */
  damage: Record<string, number>;
}

export interface SplashPlan {
  shots: SplashShot[];
  rockets: number;
  sulfur: number;
  /** Сколько ракет ушло бы «по штукам» на те же цели. */
  rocketsPerItem: number;
  /** Итоговый урон по каждой цели. */
  damageTaken: Record<string, number>;
}

const DEG = Math.PI / 180;

/** Локальная точка (x по нормали, y вверх, z вдоль) → мир. */
function toWorld(origin: Vec3, rotation: number, local: Vec3): Vec3 {
  const a = rotation * DEG;
  const [lx, ly, lz] = local;
  return [
    origin[0] + lx * Math.cos(a) - lz * Math.sin(a),
    origin[1] + ly,
    origin[2] + lx * Math.sin(a) + lz * Math.cos(a),
  ];
}

function dist(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/** Доля урона по расстоянию от взрыва до центра цели. */
export function falloff(d: number): number {
  if (d <= ROCKET.fullRadius) return 1;
  if (d >= ROCKET.maxRadius) return 0;
  return 1 - (d - ROCKET.fullRadius) / (ROCKET.maxRadius - ROCKET.fullRadius);
}

/** Точки на вертикальном прямоугольнике шириной w и высотой h в локальной системе элемента. */
function rectPoints(w: number, h: number, y0 = 0): Vec3[] {
  const hw = w / 2;
  return [
    [0, y0 + h / 2, 0],
    [0, y0 + h / 2, -hw], [0, y0 + h / 2, hw],
    [0, y0, 0], [0, y0 + h, 0],
    [0, y0, -hw], [0, y0, hw], [0, y0 + h, -hw], [0, y0 + h, hw],
  ];
}

function elementTarget(el: ResolvedElement): SplashTarget | null {
  const info = KINDS[el.kind];
  const hp = BLOCK_HP[el.grade];
  if (info.category === 'wallType') {
    const h = wallHeight(el.kind);
    return {
      id: el.id, kind: el.kind, hp, hitDamage: ROCKET.blockDamage, carrierId: el.id, origin: el.position, rotation: el.rotation,
      center: [el.position[0], el.position[1] + h / 2, el.position[2]],
      candidates: rectPoints(3, h).map(p => toWorld(el.position, el.rotation, p)),
    };
  }
  if (info.category === 'cell') {
    const r = info.shape === 'square' ? 1.5 : 0.866;
    const local: Vec3[] = [[0, 0, 0], [r, 0, 0], [-r, 0, 0], [0, 0, r], [0, 0, -r]];
    return {
      id: el.id, kind: el.kind, hp, hitDamage: ROCKET.blockDamage, carrierId: el.id, origin: el.position, rotation: el.rotation, center: el.position,
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
  return {
    id: d.id, kind: d.kind, hp, hitDamage: ROCKET.doorDamage, carrierId: d.parent, origin: d.position, rotation: d.rotation,
    center: [d.position[0], d.position[1] + y0 + Math.min(hh, h) / 2, d.position[2]],
    candidates: rectPoints(w, hh, y0).map(p => toWorld(d.position, d.rotation, p)),
  };
}

/** Цели сплеша для списка id (элементы и объекты пути). */
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

/** Урон одной ракеты в точке p по цели t. */
export function rocketDamage(p: Vec3, t: SplashTarget): number {
  return t.hitDamage * falloff(dist(p, t.center));
}

/** Преграда для сплеша: вертикальный прямоугольник стены-типа или горизонтальный полигон ячейки. */
export interface Occluder {
  id: string;
  kind: 'wall' | 'cell';
  origin: Vec3;
  rotation: number;
  /** Стена: высота; ячейка: вершины полигона в локальных [x, z]. */
  height?: number;
  polygon?: [number, number][];
}

function toLocal(origin: Vec3, rotation: number, p: Vec3): Vec3 {
  const a = -rotation * DEG;
  const dx = p[0] - origin[0], dy = p[1] - origin[1], dz = p[2] - origin[2];
  return [dx * Math.cos(a) - dz * Math.sin(a), dy, dx * Math.sin(a) + dz * Math.cos(a)];
}

function insidePolygon(x: number, z: number, poly: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

/** Пересекает ли отрезок a→b преграду (включая концы). */
export function segmentBlocked(a: Vec3, b: Vec3, o: Occluder): boolean {
  const la = toLocal(o.origin, o.rotation, a);
  const lb = toLocal(o.origin, o.rotation, b);
  if (o.kind === 'wall') {
    if ((la[0] > 1e-6 && lb[0] > 1e-6) || (la[0] < -1e-6 && lb[0] < -1e-6)) return false; // по одну сторону плоскости
    if (Math.abs(lb[0] - la[0]) < 1e-9) return false; // в плоскости стены — не преграда
    const t = la[0] / (la[0] - lb[0]);
    const y = la[1] + (lb[1] - la[1]) * t;
    const z = la[2] + (lb[2] - la[2]) * t;
    return y >= -1e-6 && y <= (o.height ?? 3) + 1e-6 && Math.abs(z) <= 1.5 + 1e-6;
  }
  if ((la[1] > 1e-6 && lb[1] > 1e-6) || (la[1] < -1e-6 && lb[1] < -1e-6)) return false;
  if (Math.abs(lb[1] - la[1]) < 1e-9) return false;
  const t = la[1] / (la[1] - lb[1]);
  const x = la[0] + (lb[0] - la[0]) * t;
  const z = la[2] + (lb[2] - la[2]) * t;
  return insidePolygon(x, z, o.polygon!);
}

/** Преграды из геометрии: все стены-типы и ячейки. Проёмы без живой двери не преграда. */
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

const NUDGE = 0.1;

/**
 * Жадный план: пока есть живые цели, стреляем в точку с наибольшим полезным уроном
 * (суммой min(остаток HP, урон) по целям). Одинаковые точки объединяются в count.
 * Правило фронта: рейдер идёт по пути по порядку, поэтому точки удара берутся только
 * на поверхности первой ещё живой цели и целей до неё (внутрь базы снаружи не достать).
 */
export function planRocketSplash(resolved: Resolved, ids: string[]): SplashPlan {
  const targets = splashTargets(resolved, ids);
  const hpLeft = new Map(targets.map(t => [t.id, t.hp]));
  const shots = new Map<string, SplashShot>();
  let rockets = 0;
  const alive = () => targets.some(t => (hpLeft.get(t.id) ?? 0) > 1e-6);
  const isAlive = (t: SplashTarget) => (hpLeft.get(t.id) ?? 0) > 1e-6;

  /** Сторона рейдера у цели i: к предыдущей цели, иначе прочь от следующей, иначе +нормаль. */
  const raiderSide = (i: number): 1 | -1 => {
    const t = targets[i];
    const ref = i > 0 ? targets[i - 1].center : targets[i + 1]?.center;
    if (!ref) return 1;
    const local = toLocal(t.origin, t.rotation, ref);
    const towards = i > 0 ? 1 : -1;
    return (local[0] >= 0 ? 1 : -1) * towards as 1 | -1;
  };

  while (alive() && rockets < 500) {
    const frontier = targets.findIndex(isAlive);
    // Преграды: целые элементы, кроме уже разрушенных целей (и их проёмов)
    const destroyedCarriers = new Set(targets.filter(t => !isAlive(t)).map(t => t.carrierId));
    const liveDoorCarriers = new Set(resolved.deployables.filter(d => d.kind !== 'tool-cupboard' && !targets.some(t => t.id === d.id && !isAlive(t))).map(d => d.parent));
    const occ = occluders(resolved, liveDoorCarriers).filter(o => !destroyedCarriers.has(o.id));

    const candidates: { point: Vec3; owner: SplashTarget }[] = [];
    const seen = new Set<string>();
    targets.slice(0, frontier + 1).forEach((t, i) => {
      const side = raiderSide(i);
      for (const c of t.candidates) {
        const point = toWorld(c, t.rotation, [side * NUDGE, 0, 0]);
        const key = point.map(v => v.toFixed(2)).join('|');
        if (!seen.has(key)) { seen.add(key); candidates.push({ point, owner: t }); }
      }
    });

    let best: { point: Vec3; useful: number; damage: Record<string, number> } | null = null;
    for (const { point: p, owner } of candidates) {
      let useful = 0;
      const damage: Record<string, number> = {};
      for (const t of targets) {
        let dmg = rocketDamage(p, t);
        if (dmg > 0 && t.id !== owner.id) {
          const blocked = occ.some(o => o.id !== owner.carrierId && o.id !== t.carrierId && segmentBlocked(p, t.center, o));
          if (blocked) dmg = 0;
        }
        damage[t.id] = dmg;
        useful += Math.min(hpLeft.get(t.id) ?? 0, dmg);
      }
      if (!best || useful > best.useful + 1e-9) best = { point: p, useful, damage };
    }
    if (!best || best.useful <= 1e-9) break;
    for (const t of targets) hpLeft.set(t.id, Math.max(0, (hpLeft.get(t.id) ?? 0) - best.damage[t.id]));
    rockets++;
    const key = best.point.map(v => v.toFixed(2)).join('|');
    const shot = shots.get(key) ?? { point: best.point, count: 0, damage: best.damage };
    shot.count++;
    shots.set(key, shot);
  }
  const damageTaken: Record<string, number> = {};
  for (const t of targets) damageTaken[t.id] = Math.round((t.hp - (hpLeft.get(t.id) ?? 0)) * 10) / 10;
  const rocketsPerItem = targets.reduce((a, t) => a + Math.ceil(t.hp / t.hitDamage), 0);
  return { shots: [...shots.values()], rockets, sulfur: rockets * ROCKET.sulfur, rocketsPerItem, damageTaken };
}
