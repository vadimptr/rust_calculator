import { KINDS, apothem, cellVertices, edgeAngle, edgeCount } from './catalog.ts';
import { deployableCost } from './cost.ts';
import type { Blueprint, DeployableKind, ElementKind, Resolved, ResolvedDeployable, ResolvedElement } from './types.ts';

export const BOAT_TAG = 'boat';

export function isBoatScheme(bp: Pick<Blueprint, 'meta'> | null | undefined): boolean {
  return !!bp?.meta.tags?.includes(BOAT_TAG);
}

export const BOAT_PLAN: { group: string; kinds: ElementKind[] }[] = [
  { group: 'Корпус', kinds: ['boat-hull', 'boat-hull-triangle'] },
  { group: 'Полы', kinds: ['boat-floor', 'boat-floor-triangle', 'boat-floor-frame', 'boat-floor-frame-triangle'] },
  { group: 'Стены', kinds: ['boat-wall', 'boat-doorway', 'boat-window', 'boat-low-wall', 'boat-low-wall-barrier', 'boat-low-wall-cannon'] },
  { group: 'Лестницы', kinds: ['boat-stairs'] },
];

export type BoatResKey = 'wood' | 'stone' | 'lgf' | 'metal' | 'hqm' | 'scrap' | 'cloth' | 'tarp' | 'gears' | 'rope' | 'techparts' | 'sewingkit' | 'bpbasic' | 'bpadvanced';
export type BoatRes = Record<BoatResKey, number>;
export const BOAT_RES_KEYS: BoatResKey[] = ['wood', 'stone', 'lgf', 'metal', 'hqm', 'scrap', 'cloth', 'tarp', 'gears', 'rope', 'techparts', 'sewingkit', 'bpbasic', 'bpadvanced'];
const zero = (): BoatRes => Object.fromEntries(BOAT_RES_KEYS.map(k => [k, 0])) as BoatRes;

export interface DeckObject {
  label: string;
  short: string;
  icon: string;
  cost: Partial<BoatRes>;
  box: { x: [number, number]; z: number; h: number };
  desc?: string;
}

export const DECK: Partial<Record<DeployableKind, DeckObject>> = {
  'sail': { label: 'Парус', short: 'Парус', icon: 'sail', cost: { wood: 150, tarp: 1 }, box: { x: [-0.65, 0.65], z: 1.7, h: 6.25 } },
  'small-engine': { label: 'Лодочный мотор', short: 'Мотор', icon: 'smallengine', cost: { hqm: 5, gears: 2, lgf: 50 }, box: { x: [-0.69, 0.69], z: 0.42, h: 1.73 } },
  'steering-wheel': { label: 'Штурвал', short: 'Штурвал', icon: 'steeringwheel.boat', cost: { wood: 100 }, box: { x: [-0.36, 0.36], z: 0.56, h: 1.44 } },
  'anchor': { label: 'Якорь', short: 'Якорь', icon: 'anchor', cost: { wood: 250 }, box: { x: [-1.1, 1.5], z: 0.9, h: 1.77 } },
  'cannon': { label: 'Пушка', short: 'Пушка', icon: 'cannon', cost: { wood: 100, metal: 200 }, box: { x: [-0.78, 1.32], z: 0.63, h: 1.26 } },
  'plank': { label: 'Доска', short: 'Доска', icon: 'plank', cost: { wood: 100 }, box: { x: [-0.23, 2.82], z: 0.53, h: 0.44 } },
  'small-ramp': { label: 'Трап', short: 'Трап', icon: 'small_ramp', cost: { wood: 250, rope: 2 }, box: { x: [-1.17, 7.9], z: 1.49, h: 2.86 } },
  'workbench1': { label: 'Верстак 1 уровня', short: 'Верстак 1', icon: 'workbench1', cost: { wood: 500, metal: 100 }, box: { x: [-0.49, 0.45], z: 0.82, h: 2.24 } },
  'workbench2': { label: 'Верстак 2 уровня', short: 'Верстак 2', icon: 'workbench2', cost: { metal: 500, hqm: 20, bpbasic: 5 }, box: { x: [-0.43, 0.53], z: 0.89, h: 2.05 } },
  'workbench3': { label: 'Верстак 3 уровня', short: 'Верстак 3', icon: 'workbench3', cost: { metal: 1000, hqm: 100, bpadvanced: 5 }, box: { x: [-0.47, 0.55], z: 1.13, h: 2.04 } },
  'repair-bench': { label: 'Ремонтный верстак', short: 'Ремонт', icon: 'box.repair.bench', cost: { metal: 125 }, box: { x: [-0.54, 0.61], z: 1.06, h: 1.27 } },
  'research-table': { label: 'Стол исследований', short: 'Исследования', icon: 'research.table', cost: { metal: 200, scrap: 20 }, box: { x: [-0.49, 0.52], z: 0.96, h: 1.79 } },
  'mixing-table': { label: 'Смесительный стол', short: 'Смеситель', icon: 'mixingtable', cost: { metal: 200, stone: 100 }, box: { x: [-0.47, 0.47], z: 1.39, h: 1.78 } },
  'large-wood-box': { label: 'Большой деревянный ящик', short: 'Ящик', icon: 'box.wooden.large', cost: { wood: 250, metal: 50 }, box: { x: [-0.53, 0.53], z: 0.94, h: 0.79 } },
  'small-wood-box': { label: 'Маленький деревянный ящик', short: 'Мал. ящик', icon: 'box.wooden', cost: { wood: 100 }, box: { x: [-0.37, 0.37], z: 0.48, h: 0.56 } },
  'storage-barrel-vertical': { label: 'Бочка для хранения', short: 'Бочка', icon: 'storage_barrel_b', cost: { wood: 300, metal: 75 }, box: { x: [-0.52, 0.49], z: 0.53, h: 1.35 } },
  'storage-barrel-horizontal': { label: 'Лежачая бочка для хранения', short: 'Леж. бочка', icon: 'storage_barrel_c', cost: { wood: 300, metal: 75 }, box: { x: [-0.49, 0.55], z: 0.67, h: 1.02 } },
  'shelves': { label: 'Полки', short: 'Полки', icon: 'shelves', cost: { metal: 50 }, box: { x: [-0.68, 0.68], z: 1.38, h: 2.8 } },
  'locker': { label: 'Шкафчик', short: 'Шкафчик', icon: 'locker', cost: { metal: 100, wood: 50 }, box: { x: [-0.36, 0.36], z: 0.9, h: 2.24 } },
  'fridge': { label: 'Холодильник', short: 'Холодильник', icon: 'fridge', cost: { metal: 150 }, box: { x: [-0.48, 0.58], z: 0.49, h: 2 } },
  'water-barrel': { label: 'Бочка для воды', short: 'Вода', icon: 'water.barrel', cost: { wood: 250, tarp: 1 }, box: { x: [-0.66, 0.63], z: 0.89, h: 2.12 } },
  'furnace': { label: 'Печь', short: 'Печь', icon: 'furnace', cost: { stone: 200, wood: 100, lgf: 50 }, box: { x: [-0.5, 0.53], z: 0.51, h: 1.6 } },
  'small-oil-refinery': { label: 'Малый нефтеперегонный завод', short: 'Перегонка', icon: 'small.oil.refinery', cost: { wood: 200, metal: 500, lgf: 250 }, box: { x: [-1.29, 1.29], z: 1.29, h: 2.56 } },
  'bbq': { label: 'Барбекю', short: 'Барбекю', icon: 'bbq', cost: { metal: 40, wood: 100 }, box: { x: [-0.52, 0.58], z: 0.48, h: 1.49 } },
  'small-generator': { label: 'Малый генератор', short: 'Генератор', icon: 'electric.fuelgenerator.small', cost: { hqm: 5, gears: 2 }, box: { x: [-0.53, 0.41], z: 0.42, h: 0.7 } },
  'small-battery': { label: 'Малый аккумулятор', short: 'Мал. аккум.', icon: 'electric.battery.rechargable.small', cost: { hqm: 5 }, box: { x: [-0.22, 0.22], z: 0.17, h: 0.34 } },
  'medium-battery': { label: 'Средний аккумулятор', short: 'Ср. аккум.', icon: 'electric.battery.rechargable.medium', cost: { hqm: 5, techparts: 1 }, box: { x: [-0.37, 0.37], z: 0.63, h: 1.46 } },
  'large-solar-panel': { label: 'Большая солнечная панель', short: 'Солн. панель', icon: 'electric.solarpanel.large', cost: { hqm: 5, techparts: 1 }, box: { x: [-1.01, 1], z: 0.47, h: 0.59 } },
  'lantern': { label: 'Фонарь', short: 'Фонарь', icon: 'lantern', cost: { metal: 25, lgf: 15 }, box: { x: [-0.14, 0.14], z: 0.14, h: 0.48 } },
  'sleeping-bag': { label: 'Спальный мешок', short: 'Спальник', icon: 'sleepingbag', cost: { cloth: 30 }, box: { x: [-0.75, 1.07], z: 0.53, h: 0.32 } },
  'bed': { label: 'Кровать', short: 'Кровать', icon: 'bed', cost: { cloth: 60, metal: 100, sewingkit: 2 }, box: { x: [-0.74, 0.74], z: 1.19, h: 0.89 } },
};

export const DECK_GROUPS: { group: string; kinds: DeployableKind[] }[] = [
  { group: 'Ход', kinds: ['sail', 'small-engine', 'steering-wheel', 'anchor', 'cannon', 'plank', 'small-ramp'] },
  { group: 'Верстаки', kinds: ['workbench1', 'workbench2', 'workbench3', 'repair-bench', 'research-table', 'mixing-table'] },
  { group: 'Хранение', kinds: ['large-wood-box', 'small-wood-box', 'storage-barrel-vertical', 'storage-barrel-horizontal', 'shelves', 'locker', 'fridge', 'water-barrel'] },
  { group: 'Печи', kinds: ['furnace', 'small-oil-refinery', 'bbq'] },
  { group: 'Электрика', kinds: ['small-generator', 'small-battery', 'medium-battery', 'large-solar-panel', 'lantern'] },
  { group: 'Сон', kinds: ['sleeping-bag', 'bed'] },
  { group: 'Двери', kinds: ['wooden-door', 'sheet-metal-door', 'armored-door'] },
  { group: 'Окна', kinds: ['strengthened-glass-window', 'reinforced-glass-window', 'metal-window-bars', 'metal-embrasure'] },
];

export const BOAT_DEPLOY_PLAN: { group: string; kinds: DeployableKind[] }[] = [DECK_GROUPS[0]];

export const BOAT_OBJECTS: DeployableKind[] = Object.keys(DECK) as DeployableKind[];

export function isBoatObject(kind: DeployableKind): boolean {
  return kind in DECK;
}

export const EDGE_OBJECTS: DeployableKind[] = ['anchor', 'plank', 'small-ramp'];

export const DIRECTED_OBJECTS: DeployableKind[] = ['sail', 'small-engine', 'steering-wheel'];

const PLACE_HALF_MAX = 1.3;

export function objectHalf(kind: DeployableKind): [number, number] {
  if (kind === 'sail') return [0.3, 0.3];
  const b = DECK[kind]!.box;
  return [Math.min(PLACE_HALF_MAX, Math.max(-b.x[0], b.x[1])), Math.min(PLACE_HALF_MAX, b.z)];
}

export const OBJECT_LIMIT: Partial<Record<DeployableKind, number>> = { 'small-engine': 5, 'sail': 10, 'steering-wheel': 1 };

export function boatBow(resolved: Resolved): number {
  const wheel = resolved.deployables.find(d => d.kind === 'steering-wheel');
  if (wheel) return wheel.rotation;
  return resolved.elements.find(e => KINDS[e.kind].boat && KINDS[e.kind].isFoundation)?.rotation ?? 0;
}

export function boatGrid(resolved: Resolved): number {
  return resolved.elements.find(e => KINDS[e.kind].boat && KINDS[e.kind].isFoundation)?.rotation ?? 0;
}

interface BlockInfo {
  mass: number;
  health: number;
  costMultiplier: number;
}

export const BOAT_BLOCKS: Partial<Record<ElementKind, BlockInfo>> = {
  'boat-hull': { mass: 100, health: 75, costMultiplier: 1 },
  'boat-hull-triangle': { mass: 50, health: 25, costMultiplier: 0.5 },
  'boat-floor': { mass: 100, health: 50, costMultiplier: 0.5 },
  'boat-floor-triangle': { mass: 50, health: 25, costMultiplier: 0.25 },
  'boat-floor-frame': { mass: 100, health: 50, costMultiplier: 0.5 },
  'boat-floor-frame-triangle': { mass: 50, health: 25, costMultiplier: 0.25 },
  'boat-wall': { mass: 100, health: 50, costMultiplier: 1 },
  'boat-doorway': { mass: 100, health: 50, costMultiplier: 0.7 },
  'boat-window': { mass: 100, health: 50, costMultiplier: 0.7 },
  'boat-low-wall': { mass: 50, health: 25, costMultiplier: 0.5 },
  'boat-low-wall-barrier': { mass: 50, health: 25, costMultiplier: 0.5 },
  'boat-low-wall-cannon': { mass: 50, health: 25, costMultiplier: 0.5 },
  'boat-stairs': { mass: 50, health: 50, costMultiplier: 1 },
};

const BLOCK_BASE: Partial<BoatRes> = { wood: 300, lgf: 15 };

export function objectCost(kind: DeployableKind): Partial<BoatRes> {
  const deck = DECK[kind]?.cost;
  if (deck) return deck;
  const c = deployableCost(kind);
  return { wood: c.wood ?? 0, stone: c.stone ?? 0, metal: c.metal ?? 0, hqm: c.hqm ?? 0 };
}

export const STATION_COST: Partial<BoatRes> = { wood: 200, tarp: 1 };

export const SAIL_THRUST = 2500;
export const ENGINE_THRUST = 10000;
export const ENGINE_REVERSE = 0.5;
export const ENGINE_FUEL_PER_SEC = 0.4;
export const MIN_MASS = 1000;
export const MAX_ACCEL = 13;
export const VELOCITY_MAX = 15;
export const SHALLOW_FACTOR = 0.3;
export const MAX_BLOCKS = 180;
export const MAX_DEPLOYABLES = 120;
export const IDLE_DRAG = 1.5;
const DRAG = { min: 0.65, max: 2.2, minContrib: 5, maxContrib: 50, exponent: 0.4 };
export const DECAY_START_HOURS = 24;
export const DECAY_HOURS = 12;

export function blockCost(kind: ElementKind): BoatRes {
  const r = zero();
  const mul = BOAT_BLOCKS[kind]?.costMultiplier ?? 0;
  for (const k of BOAT_RES_KEYS) r[k] = Math.ceil((BLOCK_BASE[k] ?? 0) * mul);
  return r;
}

type V2 = [number, number];
const DEG = Math.PI / 180;
const dir = (a: number): V2 => [Math.cos(a * DEG), Math.sin(a * DEG)];

function outline(e: ResolvedElement): V2[] {
  const a = e.rotation * DEG;
  return cellVertices(KINDS[e.kind].shape ?? 'square').map(([x, z]) => [e.position[0] + x * Math.cos(a) - z * Math.sin(a), e.position[2] + x * Math.sin(a) + z * Math.cos(a)]);
}

export function frontalWidth(hulls: ResolvedElement[], forward: number, heading: number): number {
  if (!hulls.length) return 0;
  const polys = hulls.map(outline);
  const [fx, fz] = dir(forward), [rx, rz] = [-fz, fx];
  const pts = polys.flat();
  const along = pts.map(([x, z]) => x * fx + z * fz), across = pts.map(([x, z]) => x * rx + z * rz);
  const box = [Math.min(...along), Math.max(...along), Math.min(...across), Math.max(...across)];
  const corners: V2[] = [];
  for (const a of [box[0], box[1]]) for (const c of [box[2], box[3]]) corners.push([a * fx + c * rx, a * fz + c * rz]);
  const [dx, dz] = dir(heading), [px, pz] = [-dz, dx];
  const side = corners.map(([x, z]) => x * px + z * pz);
  const lo = Math.min(...side), hi = Math.max(...side);
  const step = (hi - lo) / 16;
  if (step <= 0) return 0;
  let sum = 0;
  for (let i = 0; i < 16; i++) {
    const s = lo + (i + 0.5) * step;
    let best = -Infinity, contrib = 0;
    for (const poly of polys) {
      const cx = poly.reduce((t, p) => t + p[0], 0) / poly.length, cz = poly.reduce((t, p) => t + p[1], 0) / poly.length;
      for (let k = 0; k < poly.length; k++) {
        const [ax, az] = poly[k], [bx, bz] = poly[(k + 1) % poly.length];
        const sa = ax * px + az * pz, sb = bx * px + bz * pz;
        if ((s < Math.min(sa, sb)) || (s > Math.max(sa, sb)) || Math.abs(sb - sa) < 1e-9) continue;
        const u = (s - sa) / (sb - sa);
        const t = (ax + (bx - ax) * u) * dx + (az + (bz - az) * u) * dz;
        if (t <= best) continue;
        let nx = bz - az, nz = -(bx - ax);
        const len = Math.hypot(nx, nz);
        nx /= len; nz /= len;
        if ((ax + bx) / 2 * nx + (az + bz) / 2 * nz < cx * nx + cz * nz) { nx = -nx; nz = -nz; }
        best = t;
        contrib = Math.max(0, nx * dx + nz * dz) * step;
      }
    }
    sum += contrib;
  }
  return sum;
}

export function dragFor(width: number): number {
  const t = Math.min(1, Math.max(0, (width - DRAG.minContrib) / (DRAG.maxContrib - DRAG.minContrib)));
  return DRAG.min + (DRAG.max - DRAG.min) * Math.pow(t, DRAG.exponent);
}

export function terminalSpeed(force: number, mass: number, drag: number): number {
  if (force <= 0 || mass <= 0) return 0;
  return Math.min(Math.min(force / mass, MAX_ACCEL) / drag, VELOCITY_MAX);
}

export interface Run {
  force: number;
  heading: number;
  offBow: number;
  accel: number;
  drag: number;
  width: number;
  speed: number;
}

export interface Check {
  ok: boolean;
  text: string;
}

export interface BoatStats {
  blocks: number;
  hulls: number;
  objects: number;
  count: Partial<Record<DeployableKind, number>>;
  massBlocks: number;
  mass: number;
  health: number;
  forward: number;
  hasWheel: boolean;
  sails: Run | null;
  engines: Run | null;
  full: Run | null;
  reverse: Run | null;
  fuelPerMinute: number;
  build: BoatRes;
  checks: Check[];
  blocked: Map<string, SailBlock>;
}

function run(objects: ResolvedDeployable[], thrust: (d: ResolvedDeployable) => number, hulls: ResolvedElement[], forward: number, mass: number): Run | null {
  let fx = 0, fz = 0;
  for (const d of objects) {
    const f = thrust(d);
    if (!f) continue;
    const [x, z] = dir(d.rotation);
    fx += f * x; fz += f * z;
  }
  const force = Math.hypot(fx, fz);
  if (force < 1e-6) return null;
  const heading = Math.atan2(fz, fx) / DEG;
  const off = ((heading - forward) % 360 + 360) % 360;
  const width = frontalWidth(hulls, forward, heading);
  const drag = dragFor(width);
  return { force, heading, offBow: Math.min(off, 360 - off), accel: Math.min(force / mass, MAX_ACCEL), drag, width, speed: terminalSpeed(force, mass, drag) };
}

function connected(elements: ResolvedElement[]): boolean {
  if (elements.length <= 1) return true;
  const key = (x: number, y: number, z: number) => `${Math.round(x * 20)}|${Math.round(y * 20)}|${Math.round(z * 20)}`;
  const points = elements.map(e => {
    const [x, y, z] = e.position;
    const info = KINDS[e.kind];
    const out = [key(x, y, z)];
    if (info.category === 'cell') {
      const shape = info.shape ?? 'square';
      for (let k = 0; k < edgeCount(shape); k++) {
        const [cx, cz] = dir(e.rotation + edgeAngle(shape, k));
        out.push(key(x + apothem(shape) * cx, y, z + apothem(shape) * cz));
      }
    } else if (info.category === 'wallType') {
      out.push(key(x, y + (info.height ?? 3), z));
    }
    return out;
  });
  const owners = new Map<string, number[]>();
  points.forEach((ps, i) => ps.forEach(p => owners.set(p, [...(owners.get(p) ?? []), i])));
  const seen = new Set([0]);
  const stack = [0];
  while (stack.length) {
    const i = stack.pop()!;
    for (const p of points[i]) for (const j of owners.get(p) ?? []) if (!seen.has(j)) { seen.add(j); stack.push(j); }
  }
  return seen.size === elements.length;
}

export function coveredHullSides(resolved: Resolved): Map<string, number[]> {
  const hulls = resolved.elements.filter(e => KINDS[e.kind].boat && KINDS[e.kind].isFoundation);
  const mids = new Map(hulls.map(e => {
    const shape = KINDS[e.kind].shape ?? 'square';
    return [e.id, Array.from({ length: edgeCount(shape) }, (_, k): V2 => {
      const [cx, cz] = dir(e.rotation + edgeAngle(shape, k));
      return [e.position[0] + apothem(shape) * cx, e.position[2] + apothem(shape) * cz];
    })];
  }));
  const out = new Map<string, number[]>();
  for (const e of hulls) {
    const covered = mids.get(e.id)!.flatMap((m, k) => (hulls.some(o => o.id !== e.id && Math.abs(o.position[1] - e.position[1]) < 0.05
      && mids.get(o.id)!.some(q => Math.hypot(q[0] - m[0], q[1] - m[1]) < 0.05)) ? [k] : []));
    if (covered.length) out.set(e.id, covered);
  }
  return out;
}

type V3 = [number, number, number];

interface Solid {
  id: string;
  c: V3;
  yaw: number;
  half: V3;
  poly?: V2[];
}

const SAIL_BOXES: { c: V3; half: V3 }[] = [
  { c: [0.007, 3.09, 0], half: [0.095, 3.1, 0.1] },
  { c: [0.1, 3.93, 0], half: [0.105, 1.5, 1.5] },
  { c: [0.06, 4.87, 0], half: [0.105, 0.5, 1.5] },
  { c: [0.16, 5.56, 0], half: [0.095, 0.13, 1.7] },
];
export const SAIL_CHECK_HEIGHTS = [3.39, 4.67];
export const SAIL_CHECK_RADIUS = 0.5;
export const SAIL_CHECK_DISTANCE = 2;
const SAIL_CENTER_Y = 3.1;

function localToWorld(pos: V3, yaw: number, l: V3): V3 {
  const [cx, cz] = dir(yaw);
  return [pos[0] + l[0] * cx - l[2] * cz, pos[1] + l[1], pos[2] + l[0] * cz + l[2] * cx];
}

function solidsOf(resolved: Resolved): Solid[] {
  const out: Solid[] = [];
  for (const e of resolved.elements) {
    if (!KINDS[e.kind].boat) continue;
    const info = KINDS[e.kind];
    if (info.category === 'cell') {
      const top = e.position[1] + 0.1, bottom = info.isFoundation ? e.position[1] - 3 : e.position[1] - 0.05;
      out.push({ id: e.id, c: [e.position[0], (top + bottom) / 2, e.position[2]], yaw: 0, half: [0, (top - bottom) / 2, 0], poly: outline(e) });
    } else if (info.category === 'wallType') {
      const h = e.kind === 'boat-low-wall-barrier' ? 1.2 : info.height ?? 3;
      out.push({ id: e.id, c: localToWorld(e.position, e.rotation, [0, h / 2, 0]), yaw: e.rotation, half: [0.07, h / 2, 1.5] });
    } else {
      out.push({ id: e.id, c: localToWorld(e.position, e.rotation, [0, 1.5, 0]), yaw: e.rotation, half: [1.5, 1.5, 0.76] });
    }
  }
  for (const d of resolved.deployables) {
    if (d.kind === 'sail') {
      for (const b of SAIL_BOXES) out.push({ id: d.id, c: localToWorld(d.position, d.rotation, b.c), yaw: d.rotation, half: b.half });
      continue;
    }
    const b = DECK[d.kind]?.box;
    if (!b) continue;
    out.push({ id: d.id, c: localToWorld(d.position, d.rotation, [(b.x[0] + b.x[1]) / 2, b.h / 2, 0]), yaw: d.rotation, half: [(b.x[1] - b.x[0]) / 2, b.h / 2, b.z] });
  }
  return out;
}

function polyDistance(poly: V2[], x: number, z: number): number {
  let inside = false, best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
    const ex = xj - xi, ez = zj - zi;
    const t = Math.max(0, Math.min(1, ((x - xi) * ex + (z - zi) * ez) / (ex * ex + ez * ez)));
    best = Math.min(best, Math.hypot(x - xi - t * ex, z - zi - t * ez));
  }
  return inside ? 0 : best;
}

function distanceTo(s: Solid, p: V3): number {
  const dy = Math.max(0, Math.abs(p[1] - s.c[1]) - s.half[1]);
  if (s.poly) return Math.hypot(polyDistance(s.poly, p[0], p[2]), dy);
  const [cx, cz] = dir(s.yaw);
  const vx = p[0] - s.c[0], vz = p[2] - s.c[2];
  const lx = vx * cx + vz * cz, lz = -vx * cz + vz * cx;
  return Math.hypot(Math.max(0, Math.abs(lx) - s.half[0]), dy, Math.max(0, Math.abs(lz) - s.half[2]));
}

export interface SailBlock {
  by: string | null;
  roof: boolean;
}

function sailBlock(sail: ResolvedDeployable, solids: Solid[]): SailBlock | null {
  const others = solids.filter(s => s.id !== sail.id && Math.hypot(s.c[0] - sail.position[0], s.c[2] - sail.position[2]) < 7);
  const center: V3 = [sail.position[0], sail.position[1] + SAIL_CENTER_Y, sail.position[2]];
  const roof = others.find(s => s.poly && s.c[1] - s.half[1] > center[1] && polyDistance(s.poly, center[0], center[2]) === 0)
    ?? others.find(s => !s.poly && s.c[1] - s.half[1] > center[1] && distanceTo(s, [center[0], s.c[1], center[2]]) === 0);
  if (roof) return { by: roof.id, roof: true };
  const [bx, bz] = dir(sail.rotation + 180);
  for (const h of SAIL_CHECK_HEIGHTS) {
    for (let t = 0; t <= SAIL_CHECK_DISTANCE + 1e-9; t += 0.05) {
      const p: V3 = [sail.position[0] + bx * t, sail.position[1] + h, sail.position[2] + bz * t];
      const hit = others.find(s => distanceTo(s, p) <= SAIL_CHECK_RADIUS);
      if (hit) return { by: hit.id, roof: false };
    }
  }
  return null;
}

export function blockedSails(resolved: Resolved): Map<string, SailBlock> {
  const solids = solidsOf(resolved);
  const out = new Map<string, SailBlock>();
  for (const d of resolved.deployables) {
    if (d.kind !== 'sail') continue;
    const b = sailBlock(d, solids);
    if (b) out.set(d.id, b);
  }
  return out;
}

const named = (id: string | null) => (id === '__ghost__' ? 'новый объект' : `«${id}»`);

export function describeBlock(b: SailBlock): string {
  return b.roof ? `под крышей или полом ${named(b.by)}` : `сзади ближе ${SAIL_CHECK_DISTANCE} м стоит ${named(b.by)}`;
}

export function sailWarning(before: Resolved, after: Resolved, ghostId: string): string | null {
  const was = blockedSails(before), now = blockedSails(after);
  const own = now.get(ghostId);
  if (own) return `Парус не будет тянуть: ${describeBlock(own)}`;
  const newly = [...now.keys()].filter(id => !was.has(id));
  if (newly.length) return `Заслонит ${newly.length === 1 ? 'парус' : 'паруса'} ${newly.map(named).join(', ')}: они перестанут тянуть`;
  return null;
}

const add = (a: BoatRes, b: Partial<BoatRes>) => { for (const k of BOAT_RES_KEYS) a[k] += b[k] ?? 0; };

export function boatStats(resolved: Resolved): BoatStats {
  const blocks = resolved.elements.filter(e => KINDS[e.kind].boat);
  const hulls = blocks.filter(e => KINDS[e.kind].isFoundation);
  const objects = resolved.deployables;
  const count: Partial<Record<DeployableKind, number>> = {};
  for (const d of objects) count[d.kind] = (count[d.kind] ?? 0) + 1;
  const massBlocks = blocks.reduce((t, e) => t + (BOAT_BLOCKS[e.kind]?.mass ?? 0), 0);
  const mass = Math.max(massBlocks, MIN_MASS);
  const health = blocks.reduce((t, e) => t + (BOAT_BLOCKS[e.kind]?.health ?? 0), 0);
  const wheel = objects.find(d => d.kind === 'steering-wheel');
  const forward = wheel?.rotation ?? 0;
  const blocked = blockedSails(resolved);
  const sail = (d: ResolvedDeployable) => (d.kind === 'sail' && !blocked.has(d.id) ? SAIL_THRUST : 0);
  const engine = (d: ResolvedDeployable) => (d.kind === 'small-engine' ? ENGINE_THRUST : 0);
  const build = zero();
  for (const e of blocks) add(build, blockCost(e.kind));
  for (const d of objects) add(build, objectCost(d.kind));
  const engines = count['small-engine'] ?? 0, sails = count['sail'] ?? 0, wheels = count['steering-wheel'] ?? 0;
  const checks: Check[] = [
    { ok: hulls.length > 0, text: 'Есть хотя бы один корпус' },
    { ok: blocks.length <= MAX_BLOCKS, text: `Блоков ${blocks.length} из ${MAX_BLOCKS}` },
    { ok: objects.length <= MAX_DEPLOYABLES, text: `Объектов ${objects.length} из ${MAX_DEPLOYABLES}` },
    { ok: connected(blocks), text: 'Все блоки соединены в одно целое' },
    { ok: wheels === 1, text: wheels > 1 ? `Штурвалов ${wheels}, нужен ровно один` : 'Штурвал стоит: он задаёт нос корабля' },
    { ok: sails + engines > 0, text: 'Есть парус или мотор' },
    { ok: blocked.size === 0, text: blocked.size ? `Заслонено парусов: ${blocked.size} из ${sails}, они не тянут` : 'Ни один парус не заслонён' },
    { ok: engines <= OBJECT_LIMIT['small-engine']!, text: `Моторов ${engines} из ${OBJECT_LIMIT['small-engine']}` },
    { ok: sails <= OBJECT_LIMIT['sail']!, text: `Парусов ${sails} из ${OBJECT_LIMIT['sail']}` },
  ];
  return {
    blocks: blocks.length, hulls: hulls.length, objects: objects.length, count, massBlocks, mass, health, forward, hasWheel: !!wheel,
    sails: run(objects, sail, hulls, forward, mass),
    engines: run(objects, engine, hulls, forward, mass),
    full: run(objects, d => sail(d) + engine(d), hulls, forward, mass),
    reverse: run(objects, d => -ENGINE_REVERSE * engine(d), hulls, forward, mass),
    fuelPerMinute: engines * ENGINE_FUEL_PER_SEC * 60,
    build, checks, blocked,
  };
}
