import { KINDS, apothem, cellVertices, edgeAngle, edgeCount } from './catalog.ts';
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

export const BOAT_DEPLOY_PLAN: { group: string; kinds: DeployableKind[] }[] = [
  { group: 'Ход', kinds: ['sail', 'small-engine', 'steering-wheel', 'anchor'] },
  { group: 'Прочее', kinds: ['cannon', 'plank', 'small-ramp'] },
];

export const BOAT_OBJECTS: DeployableKind[] = BOAT_DEPLOY_PLAN.flatMap(g => g.kinds);

export function isBoatObject(kind: DeployableKind): boolean {
  return BOAT_OBJECTS.includes(kind);
}

export const EDGE_OBJECTS: DeployableKind[] = ['anchor', 'plank', 'small-ramp'];

export const OBJECT_HALF: Partial<Record<DeployableKind, [number, number]>> = {
  'sail': [0.3, 0.3], 'small-engine': [0.69, 0.42], 'steering-wheel': [0.36, 0.56], 'cannon': [0.78, 0.63],
};

export const OBJECT_LIMIT: Partial<Record<DeployableKind, number>> = { 'small-engine': 5, 'sail': 10, 'steering-wheel': 1 };

export type BoatResKey = 'wood' | 'lgf' | 'metal' | 'hqm' | 'tarp' | 'gears' | 'rope';
export type BoatRes = Record<BoatResKey, number>;
export const BOAT_RES_KEYS: BoatResKey[] = ['wood', 'lgf', 'metal', 'hqm', 'tarp', 'gears', 'rope'];
const zero = (): BoatRes => ({ wood: 0, lgf: 0, metal: 0, hqm: 0, tarp: 0, gears: 0, rope: 0 });

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

export const OBJECT_COST: Partial<Record<DeployableKind, Partial<BoatRes>>> = {
  'sail': { wood: 150, tarp: 1 },
  'small-engine': { hqm: 5, gears: 2, lgf: 50 },
  'steering-wheel': { wood: 100 },
  'anchor': { wood: 250 },
  'cannon': { wood: 100, metal: 200 },
  'plank': { wood: 100 },
  'small-ramp': { wood: 250, rope: 2 },
};

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

const add = (a: BoatRes, b: Partial<BoatRes>) => { for (const k of BOAT_RES_KEYS) a[k] += b[k] ?? 0; };

export function boatStats(resolved: Resolved): BoatStats {
  const blocks = resolved.elements.filter(e => KINDS[e.kind].boat);
  const hulls = blocks.filter(e => KINDS[e.kind].isFoundation);
  const objects = resolved.deployables.filter(d => isBoatObject(d.kind));
  const count: Partial<Record<DeployableKind, number>> = {};
  for (const d of objects) count[d.kind] = (count[d.kind] ?? 0) + 1;
  const massBlocks = blocks.reduce((t, e) => t + (BOAT_BLOCKS[e.kind]?.mass ?? 0), 0);
  const mass = Math.max(massBlocks, MIN_MASS);
  const health = blocks.reduce((t, e) => t + (BOAT_BLOCKS[e.kind]?.health ?? 0), 0);
  const wheel = objects.find(d => d.kind === 'steering-wheel');
  const forward = wheel?.rotation ?? 0;
  const sail = (d: ResolvedDeployable) => (d.kind === 'sail' ? SAIL_THRUST : 0);
  const engine = (d: ResolvedDeployable) => (d.kind === 'small-engine' ? ENGINE_THRUST : 0);
  const build = zero();
  for (const e of blocks) add(build, blockCost(e.kind));
  for (const d of objects) add(build, OBJECT_COST[d.kind] ?? {});
  const engines = count['small-engine'] ?? 0, sails = count['sail'] ?? 0, wheels = count['steering-wheel'] ?? 0;
  const checks: Check[] = [
    { ok: hulls.length > 0, text: 'Есть хотя бы один корпус' },
    { ok: blocks.length <= MAX_BLOCKS, text: `Блоков ${blocks.length} из ${MAX_BLOCKS}` },
    { ok: objects.length <= MAX_DEPLOYABLES, text: `Объектов ${objects.length} из ${MAX_DEPLOYABLES}` },
    { ok: connected(blocks), text: 'Все блоки соединены в одно целое' },
    { ok: wheels === 1, text: wheels > 1 ? `Штурвалов ${wheels}, нужен ровно один` : 'Штурвал стоит: он задаёт нос корабля' },
    { ok: sails + engines > 0, text: 'Есть парус или мотор' },
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
    build, checks,
  };
}
