import { entityMatrix } from './meshes.ts';
import type { ElementKind, Issue, Resolved, ResolvedDeployable, ResolvedElement } from './types.ts';

export const PRIVILEGE_RADIUS = 16;
const TOUCH = 0.3;
const DEG = Math.PI / 180;

type Vec3 = [number, number, number];

interface PrefabBounds { center: Vec3; extents: Vec3 }

const FOUNDATION: PrefabBounds = { center: [0, -1.4, 0], extents: [1.4, 1.4, 1.4] };
const WALL: PrefabBounds = { center: [0, 1.5, 0], extents: [0.1, 1.5, 1.5] };
const STAIRS: PrefabBounds = { center: [0, 1.5, 0], extents: [1.4, 1.4, 1.4] };

export const BLOCK_BOUNDS: Record<ElementKind, PrefabBounds> = {
  'square-foundation': FOUNDATION,
  'triangle-foundation': { center: [0, -1.4, 1.3], extents: [1.4, 1.4, 1.2] },
  'foundation-steps': { center: [1.5, 0, 0], extents: [1.4, 1.4, 1.4] },
  'ramp': { center: [1.5, 0, 0], extents: [1.4, 1.4, 1.4] },
  'square-floor': { center: [0, 0, 0], extents: [1.5, 0.1, 1.5] },
  'floor-frame': { center: [0, 0, 0], extents: [1.5, 0.1, 1.5] },
  'triangle-floor': { center: [0, -0.05, 1.3], extents: [1.5, 0.1, 1.3] },
  'triangle-floor-frame': { center: [0, -0.05, 1.3], extents: [1.5, 0.1, 1.3] },
  'wall': WALL,
  'doorway': WALL,
  'window-frame': WALL,
  'wall-frame': WALL,
  'half-wall': { center: [0, 0.75, 0], extents: [0.1, 0.75, 1.5] },
  'low-wall': { center: [0, 0.5, 0], extents: [0.1, 0.5, 1.5] },
  'stairs-l-shape': STAIRS,
  'u-shaped-stairs': STAIRS,
  'spiral-stairs': { center: [0, 0.75, 0], extents: [1.4, 0.75, 1.4] },
  'roof': { center: [0, 1.5, 0], extents: [4.4, 1.4, 1.4] },
  'roof-triangle': { center: [0, 1.5, -0.433], extents: [4.4, 1.4, 1.4] },
};

export const CUPBOARD_BOUNDS: PrefabBounds = { center: [0.0008, 0.9543, 0.0113], extents: [0.5717, 0.9558, 0.4443] };

export interface Box { center: Vec3; u: [number, number]; half: Vec3 }

function boxFrom(m: number[], b: PrefabBounds): Box {
  const [cx, cy, cz] = b.center;
  const center: Vec3 = [m[0] * cx + m[4] * cy + m[8] * cz + m[12], m[1] * cx + m[5] * cy + m[9] * cz + m[13], m[2] * cx + m[6] * cy + m[10] * cz + m[14]];
  const len = Math.hypot(m[0], m[2]) || 1;
  return { center, u: [m[0] / len, m[2] / len], half: b.extents };
}

function yawMatrix(position: Vec3, yawDeg: number): number[] {
  const a = yawDeg * DEG, c = Math.cos(a), s = Math.sin(a);
  return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, position[0], position[1], position[2], 1];
}

export function elementBox(el: ResolvedElement): Box {
  const m = entityMatrix(el.inverted ? { ...el, inverted: false } : el) ?? yawMatrix(el.position, -el.rotation);
  return boxFrom(m, BLOCK_BOUNDS[el.kind]);
}

export function cupboardBox(t: { position: Vec3; rotation: number }): Box {
  return boxFrom(yawMatrix(t.position, 90 - t.rotation), CUPBOARD_BOUNDS);
}

function corners(b: Box): [number, number][] {
  const [ux, uz] = b.u, vx = -uz, vz = ux;
  const [hx, , hz] = b.half;
  return [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([i, j]) => [b.center[0] + ux * hx * i + vx * hz * j, b.center[2] + uz * hx * i + vz * hz * j]);
}

function separated(a: [number, number][], b: [number, number][]): boolean {
  for (const poly of [a, b]) {
    for (let i = 0; i < 4; i++) {
      const [x1, z1] = poly[i], [x2, z2] = poly[(i + 1) % 4];
      const nx = z2 - z1, nz = x1 - x2;
      const pa = a.map(([x, z]) => x * nx + z * nz), pb = b.map(([x, z]) => x * nx + z * nz);
      if (Math.max(...pa) < Math.min(...pb) || Math.max(...pb) < Math.min(...pa)) return true;
    }
  }
  return false;
}

function pointSegment(px: number, pz: number, [x1, z1]: [number, number], [x2, z2]: [number, number]): number {
  const dx = x2 - x1, dz = z2 - z1;
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (pz - z1) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(px - x1 - t * dx, pz - z1 - t * dz);
}

function planDistance(a: Box, b: Box): number {
  const ca = corners(a), cb = corners(b);
  if (!separated(ca, cb)) return 0;
  let best = Infinity;
  for (const [p, q] of [[ca, cb], [cb, ca]]) {
    for (const [px, pz] of p) for (let i = 0; i < 4; i++) best = Math.min(best, pointSegment(px, pz, q[i], q[(i + 1) % 4]));
  }
  return best;
}

export function boxDistance(a: Box, b: Box, limit = 2 * PRIVILEGE_RADIUS): number {
  const dy = Math.max(0, Math.abs(a.center[1] - b.center[1]) - a.half[1] - b.half[1]);
  const reach = Math.hypot(a.half[0], a.half[2]) + Math.hypot(b.half[0], b.half[2]);
  const far = Math.hypot(a.center[0] - b.center[0], a.center[2] - b.center[2]) - reach;
  if (far > limit || dy > limit) return Math.hypot(Math.max(far, 0), dy);
  return Math.hypot(planDistance(a, b), dy);
}

export interface Buildings {
  of: Map<string, number>;
  boxes: Map<string, Box>;
  cupboards: Map<number, string[]>;
}

export function buildings(resolved: Resolved): Buildings {
  const els = resolved.elements;
  const boxes = new Map(els.map(e => [e.id, elementBox(e)]));
  const parent = els.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < els.length; i++) {
    for (let j = i + 1; j < els.length; j++) {
      if (find(i) === find(j)) continue;
      if (boxDistance(boxes.get(els[i].id)!, boxes.get(els[j].id)!, TOUCH) <= TOUCH) parent[find(i)] = find(j);
    }
  }
  const of = new Map(els.map((e, i) => [e.id, find(i)]));
  const cupboards = new Map<number, string[]>();
  for (const d of resolved.deployables) {
    if (d.kind !== 'tool-cupboard') continue;
    const b = of.get(d.parent);
    if (b === undefined) continue;
    cupboards.set(b, [...(cupboards.get(b) ?? []), d.id]);
  }
  return { of, boxes, cupboards };
}

export interface PrivilegeHit { cupboard: string; distance: number }

export function cupboardBlocker(resolved: Resolved, t: { position: Vec3; rotation: number }, exclude?: string): PrivilegeHit | null {
  const info = buildings(resolved);
  const box = cupboardBox(t);
  let best: PrivilegeHit | null = null;
  for (const [b, tcs] of info.cupboards) {
    const others = tcs.filter(id => id !== exclude);
    if (!others.length) continue;
    let d = Infinity;
    for (const [id, bb] of info.of) if (bb === b) d = Math.min(d, boxDistance(box, info.boxes.get(id)!, PRIVILEGE_RADIUS));
    if (d <= PRIVILEGE_RADIUS && (!best || d < best.distance)) best = { cupboard: others[0], distance: d };
  }
  return best;
}

export function connectsCupboards(resolved: Resolved, el: ResolvedElement): string[] | null {
  const info = buildings({ ...resolved, elements: [...resolved.elements.filter(e => e.id !== el.id), el] });
  const tcs = info.cupboards.get(info.of.get(el.id)!) ?? [];
  return tcs.length > 1 ? tcs : null;
}

export function privilegeIssues(resolved: Resolved): Issue[] {
  const issues: Issue[] = [];
  const info = buildings(resolved);
  for (const tcs of info.cupboards.values()) {
    if (tcs.length > 1) issues.push({ code: 'V13', level: 'warning', id: tcs[1], message: `Два шкафа в одном здании (${tcs.join(', ')}): в игре второй шкаф не ставится` });
  }
  const placed = resolved.deployables.filter((d): d is ResolvedDeployable => d.kind === 'tool-cupboard');
  for (const d of placed) {
    const own = info.of.get(d.parent);
    if ((info.cupboards.get(own!)?.length ?? 0) > 1) continue;
    const box = cupboardBox(d);
    for (const [b, tcs] of info.cupboards) {
      if (b === own) continue;
      let dist = Infinity;
      for (const [id, bb] of info.of) if (bb === b) dist = Math.min(dist, boxDistance(box, info.boxes.get(id)!, PRIVILEGE_RADIUS));
      if (dist <= PRIVILEGE_RADIUS) {
        issues.push({ code: 'V14', level: 'warning', id: d.id, message: `Шкаф в ${dist.toFixed(1)} м от здания со шкафом «${tcs[0]}»: в игре шкафы ставятся дальше ${PRIVILEGE_RADIUS} м от блоков чужого здания со шкафом` });
        break;
      }
    }
  }
  return issues;
}

export interface PrivilegeZone { x0: number; z0: number; cell: number; nx: number; nz: number; inside: Uint8Array }

export function privilegeZones(resolved: Resolved, cell = 1): PrivilegeZone[] {
  const info = buildings(resolved);
  const zones: PrivilegeZone[] = [];
  for (const b of info.cupboards.keys()) {
    const boxes = [...info.of].filter(([, bb]) => bb === b).map(([id]) => info.boxes.get(id)!);
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const bx of boxes) {
      const r = Math.hypot(bx.half[0], bx.half[2]);
      x0 = Math.min(x0, bx.center[0] - r); x1 = Math.max(x1, bx.center[0] + r);
      z0 = Math.min(z0, bx.center[2] - r); z1 = Math.max(z1, bx.center[2] + r);
    }
    x0 = Math.floor(x0 - PRIVILEGE_RADIUS - cell); z0 = Math.floor(z0 - PRIVILEGE_RADIUS - cell);
    const nx = Math.ceil((x1 + PRIVILEGE_RADIUS + cell - x0) / cell), nz = Math.ceil((z1 + PRIVILEGE_RADIUS + cell - z0) / cell);
    const inside = new Uint8Array(nx * nz);
    for (let k = 0; k < nz; k++) {
      for (let i = 0; i < nx; i++) {
        const p: Box = { center: [x0 + (i + 0.5) * cell, 0, z0 + (k + 0.5) * cell], u: [1, 0], half: [0, 0, 0] };
        for (const bx of boxes) {
          if (boxDistance(p, bx, PRIVILEGE_RADIUS) <= PRIVILEGE_RADIUS) { inside[k * nx + i] = 1; break; }
        }
      }
    }
    zones.push({ x0, z0, cell, nx, nz, inside });
  }
  return zones;
}
