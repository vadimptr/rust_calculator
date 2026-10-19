import type { Grade, Resolved, ResolvedElement } from './types.ts';

export type Vec3 = [number, number, number];

export interface SocketDef {
  name: string;
  cls: 'ConstructionSocket' | 'NeighbourSocket' | 'StabilitySocket' | 'CornerSocket';
  pos: Vec3;
  rot: number[];
  size: Vec3;
  center: Vec3;
  male: boolean;
  female: boolean;
  type?: number;
}

export interface PieceTest {
  type: string;
  angle?: number;
  shape?: number;
  ref?: string;
  right?: Vec3;
  VariantSeed?: number;
  VariantIndex?: number;
  VariantCount?: number;
}

export interface PieceDef {
  name: string;
  matrix: number[];
  tests: PieceTest[];
  model: Partial<Record<Grade, string>>;
}

export interface KindDef {
  prefix: string;
  token: string;
  sockets: SocketDef[];
  base: Partial<Record<Grade, boolean>>;
  pieces: PieceDef[];
}

export type PieceManifest = Record<string, KindDef>;

export interface Entity {
  el: ResolvedElement;
  def: KindDef;
  matrix: number[];
}

interface WorldSocket { def: SocketDef; full: string; pos: Vec3; axes: [Vec3, Vec3, Vec3]; fwd: Vec3; center: Vec3; half: Vec3 }

interface Link { name: string; owner: Entity }

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);
const neg = (a: Vec3): Vec3 => [-a[0], -a[1], -a[2]];

export function angle(a: Vec3, b: Vec3): number {
  const d = len(a) * len(b);
  if (d < 1e-9) return 0;
  return (Math.acos(Math.max(-1, Math.min(1, dot(a, b) / d))) * 180) / Math.PI;
}

export function signedAngle(a: Vec3, b: Vec3, axis: Vec3): number {
  const s = Math.sign(dot(axis, cross(a, b)));
  return angle(a, b) * (s === 0 ? 1 : s);
}

function point(m: number[], p: Vec3): Vec3 {
  return [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];
}

function vector(m: number[], v: Vec3): Vec3 {
  return [m[0] * v[0] + m[4] * v[1] + m[8] * v[2], m[1] * v[0] + m[5] * v[1] + m[9] * v[2], m[2] * v[0] + m[6] * v[1] + m[10] * v[2]];
}

function worldSockets(e: Entity): WorldSocket[] {
  return e.def.sockets.map(s => {
    const local: [Vec3, Vec3, Vec3] = [[s.rot[0], s.rot[1], s.rot[2]], [s.rot[3], s.rot[4], s.rot[5]], [s.rot[6], s.rot[7], s.rot[8]]];
    const axes = local.map(a => vector(e.matrix, a)) as [Vec3, Vec3, Vec3];
    const pos = point(e.matrix, s.pos);
    const c: Vec3 = [
      pos[0] + axes[0][0] * s.center[0] + axes[1][0] * s.center[1] + axes[2][0] * s.center[2],
      pos[1] + axes[0][1] * s.center[0] + axes[1][1] * s.center[1] + axes[2][1] * s.center[2],
      pos[2] + axes[0][2] * s.center[0] + axes[1][2] * s.center[1] + axes[2][2] * s.center[2],
    ];
    return { def: s, full: `${e.def.prefix}/${s.name}`, pos, axes, fwd: axes[2], center: c, half: [s.size[0] / 2, s.size[1] / 2, s.size[2] / 2] };
  });
}

function obbIntersects(a: WorldSocket, b: WorldSocket): boolean {
  const t = sub(b.center, a.center);
  const axes: Vec3[] = [...a.axes, ...b.axes];
  for (const x of a.axes) for (const y of b.axes) {
    const c = cross(x, y);
    if (len(c) > 1e-6) axes.push(c);
  }
  const project = (s: WorldSocket, ax: Vec3) => s.half[0] * Math.abs(dot(s.axes[0], ax)) + s.half[1] * Math.abs(dot(s.axes[1], ax)) + s.half[2] * Math.abs(dot(s.axes[2], ax));
  for (const ax of axes) {
    const l = len(ax);
    if (l < 1e-9) continue;
    const n: Vec3 = [ax[0] / l, ax[1] / l, ax[2] / l];
    if (Math.abs(dot(t, n)) > project(a, n) + project(b, n) + 1e-4) return false;
  }
  return true;
}

function canConnect(a: WorldSocket, b: WorldSocket): boolean {
  if (a.def.cls !== b.def.cls) return false;
  if (!a.def.male && !b.def.male) return false;
  if (!a.def.female && !b.def.female) return false;
  if (a.def.cls === 'ConstructionSocket') {
    if (!a.def.type || a.def.type !== b.def.type) return false;
    if (len(sub(a.pos, b.pos)) > 0.03) return false;
    let n = angle(a.fwd, b.fwd);
    if (a.def.male && a.def.female) n = Math.min(n, angle(neg(a.fwd), b.fwd));
    if (b.def.male && b.def.female) n = Math.min(n, angle(a.fwd, neg(b.fwd)));
    return n <= 2.5;
  }
  if (a.def.cls === 'CornerSocket' && angle(a.fwd, b.fwd) > 2.5) return false;
  return obbIntersects(a, b);
}

export class PieceWorld {
  private links = new Map<string, Map<string, Link[]>>();
  readonly entities: Entity[];

  constructor(entities: Entity[]) {
    this.entities = entities;
    const sockets = entities.map(worldSockets);
    entities.forEach(e => this.links.set(e.el.id, new Map(sockets[entities.indexOf(e)].map(s => [s.full, []]))));
    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const a = entities[i], b = entities[j];
        if (len(sub(a.el.position, b.el.position)) > 9) continue;
        for (const sa of sockets[i]) for (const sb of sockets[j]) {
          if (!canConnect(sa, sb)) continue;
          this.links.get(a.el.id)!.get(sa.full)!.push({ name: sb.full, owner: b });
          this.links.get(b.el.id)!.get(sb.full)!.push({ name: sa.full, owner: a });
        }
      }
    }
  }

  findLink(e: Entity, names: string | string[]): Link[] | null {
    const m = this.links.get(e.el.id)!;
    for (const n of [names].flat()) {
      const l = m.get(n);
      if (l) return l;
    }
    return null;
  }

  active(e: Entity): string[] {
    const cache = new Map<string, boolean>();
    const run = (p: PieceDef): boolean => {
      if (cache.has(p.name)) return cache.get(p.name)!;
      cache.set(p.name, false);
      const ok = p.tests.every(t => this.test(e, t, run));
      cache.set(p.name, ok);
      return ok;
    };
    return e.def.pieces.filter(p => p.model[e.el.grade] && run(p)).map(p => p.name);
  }

  private test(e: Entity, t: PieceTest, run: (p: PieceDef) => boolean): boolean {
    const forward = (x: Entity) => vector(x.matrix, [0, 0, 1]);
    const ref = () => e.def.pieces.find(p => p.name === t.ref);
    switch (t.type) {
      case 'True': { const r = ref(); return r ? run(r) : false; }
      case 'False': { const r = ref(); return r ? !run(r) : true; }
      case 'RoofLeft':
      case 'RoofRight': {
        const left = t.type === 'RoofLeft';
        const mine = left ? 'neighbour/4' : 'neighbour/3';
        const theirs = left ? 'sockets/neighbour/3' : 'sockets/neighbour/4';
        const link = this.findLink(e, [`roof/sockets/${mine}`, `roof.triangle/sockets/${mine}`]);
        if (!link) return false;
        const a = t.angle ?? -1;
        if (a === -1) return !link.some(c => c.name.endsWith(theirs));
        if (!link.length) return false;
        let result = false;
        for (const c of link) {
          if (!c.name.endsWith(theirs)) continue;
          if (t.shape === 0 && !c.name.startsWith('roof/')) continue;
          if (t.shape === 1 && !c.name.startsWith('roof.triangle/')) continue;
          if (c.owner.el.grade !== e.el.grade) continue;
          const s = signedAngle(forward(e), forward(c.owner), [0, 1, 0]) * (left ? 1 : -1);
          if (s < a - 10 || s > a + 10) { if (a > 10) return false; } else result = true;
        }
        return result;
      }
      case 'RoofTop':
      case 'RoofBottom': {
        const top = t.type === 'RoofTop';
        const r = this.findLink(e, top ? ['roof/sockets/neighbour/5', 'roof.triangle/sockets/neighbour/5'] : ['roof/sockets/neighbour/3', 'roof.triangle/sockets/neighbour/3']);
        if (!r) return false;
        const l = this.findLink(e, top ? ['roof/sockets/neighbour/6', 'roof.triangle/sockets/neighbour/6'] : ['roof/sockets/neighbour/4', 'roof.triangle/sockets/neighbour/4']);
        if (!l) return false;
        const fr = r.some(c => c.name.endsWith(top ? 'sockets/neighbour/3' : 'sockets/neighbour/5'));
        const fl = l.some(c => c.name.endsWith(top ? 'sockets/neighbour/4' : 'sockets/neighbour/6'));
        return !(fr && fl);
      }
      case 'RoofTriangle': {
        const l = this.findLink(e, 'roof/sockets/wall-female');
        return !l || l.length === 0;
      }
      case 'Wall':
        return !this.wallTriangle(e, true) && !this.wallTriangle(e, false);
      case 'WallTriangleLeft':
        return this.wallTriangle(e, true);
      case 'WallTriangleRight':
        return this.wallTriangle(e, false);
      case 'WallCornerLeft':
      case 'WallCornerRight': {
        const left = t.type === 'WallCornerLeft';
        const k = left ? 2 : 1;
        const link = this.findLink(e, ['wall', 'wall.half', 'wall.low', 'wall.doorway', 'wall.window'].map(p => `${p}/sockets/stability/${k}`));
        if (!link) return false;
        let result = false;
        for (const c of link) {
          const n = signedAngle(forward(e), forward(c.owner), [0, 1, 0]);
          if (c.name.endsWith(`sockets/stability/${k}`)) {
            if (left ? n > -10 || n < -100 : n < 10 || n > 100) return false;
            continue;
          }
          if (n < 10 && n > -10) return false;
          if (left ? n < -10 : n > 10) return false;
          if (c.owner.el.grade === e.el.grade) result = true;
        }
        return result;
      }
      case 'FoundationSide': {
        const link = this.findLink(e, this.sideSocket(e, t.right!, 'foundation-top/', ''));
        if (!link) return false;
        return !link.some(c => c.owner.def.token !== 'foundation_steps' && (c.owner.el.grade === 'armored' || c.owner.el.grade === 'metal' || c.owner.el.grade === 'stone'));
      }
      case 'FoundationCornerLeft':
      case 'FoundationCornerRight': {
        const link = this.findLink(e, this.sideSocket(e, t.right!, 'corner/', t.type === 'FoundationCornerLeft' ? '-l' : '-r'));
        if (!link) return false;
        return !link.some(c => c.owner.def.token === 'foundation' || c.owner.def.token === 'foundation_triangle');
      }
      case 'SpiralStairs': {
        const link = this.findLink(e, ['block.stair.spiral/sockets/stairs-female/1', 'block.stair.spiral.triangle/sockets/stairs-female/1']);
        if (!link) return false;
        if (link.some(c => c.owner.el.grade === e.el.grade)) return false;
        const floor = this.findLink(e, ['block.stair.spiral/sockets/floor-female/1', 'block.stair.spiral.triangle/sockets/floor-female/1']);
        return !floor || floor.length === 0;
      }
      case 'RampHigh':
      case 'RampLow': {
        const link = this.findLink(e, 'ramp/sockets/block-male/1');
        if (!link) return false;
        return t.type === 'RampHigh' ? link.length === 0 : link.length > 0;
      }
      case 'Variant': {
        let h = 2166136261;
        for (const ch of e.el.id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
        return (h + (t.VariantSeed ?? 0)) % (t.VariantCount ?? 3) === (t.VariantIndex ?? 0);
      }
      case 'Outside':
        return true;
      case 'Inside':
        return false;
      default:
        return false;
    }
  }

  private sideSocket(e: Entity, right: Vec3, kind: string, suffix: string): string {
    if (e.def.prefix === 'foundation.triangle') {
      let n = '';
      if (right[2] < -0.9) n = '1';
      if (right[0] < -0.1) n = '2';
      if (right[0] > 0.1) n = '3';
      return `foundation.triangle/sockets/${kind}${n}${suffix}`;
    }
    let n = '';
    if (right[2] < -0.9) n = '1';
    if (right[2] > 0.9) n = '3';
    if (right[0] < -0.9) n = '2';
    if (right[0] > 0.9) n = '4';
    return `foundation/sockets/${kind}${n}${suffix}`;
  }

  private wallTriangle(e: Entity, left: boolean): boolean {
    const occupied = (s: string) => { const l = this.findLink(e, s); return !!l && l.length > 0; };
    for (const s of ['wall-female', 'floor-female/1', 'floor-female/2', 'floor-female/3', 'floor-female/4', `stability/${left ? 1 : 2}`]) {
      if (occupied(`wall/sockets/${s}`)) return false;
    }
    const link = this.findLink(e, 'wall/sockets/neighbour/1');
    if (!link) return false;
    const fwd = vector(e.matrix, [0, 0, 1]);
    for (const c of link) {
      const other = vector(c.owner.matrix, [0, 0, 1]);
      const dir = left ? other : neg(other);
      if (c.owner.def.token === 'roof' && angle(fwd, dir) < 10) return true;
      if (c.owner.def.token === 'roof_triangle' && angle(fwd, dir) < 40) return true;
    }
    return false;
  }
}

export function activePieces(manifest: PieceManifest, resolved: Resolved, matrixOf: (el: ResolvedElement) => number[] | null): Map<string, string[]> {
  const entities: Entity[] = [];
  for (const el of resolved.elements) {
    const def = manifest[el.kind];
    const m = def ? matrixOf(el) : null;
    if (def && m) entities.push({ el, def, matrix: m });
  }
  const world = new PieceWorld(entities);
  return new Map(entities.map(e => [e.el.id, world.active(e)]));
}
