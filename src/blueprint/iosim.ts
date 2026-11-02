import { IO, slotWorld } from './io.ts';
import { DECK } from './boat.ts';
import type { DeployableKind, Resolved, ResolvedDeployable, ResolvedWire } from './types.ts';

export const GENERATION: Partial<Record<DeployableKind, number>> = { 'small-generator': 40, 'large-solar-panel': 20 };
export const WIND_MAX = 150;
export const NEED: Partial<Record<DeployableKind, number>> = {
  'ceiling-light': 2, 'electric-heater': 3, 'simple-light': 1, 'flasher-light': 1, 'siren-light': 1, 'auto-turret': 10, 'sam-site': 25,
  'tesla-coil': 25, 'igniter': 2, 'electric-furnace': 3, 'water-pump': 5, 'powered-water-purifier': 5, 'hbhf-sensor': 1,
};
export const BATTERY: Partial<Record<DeployableKind, { out: number; rwm: number }>> = {
  'small-battery': { out: 15, rwm: 400 }, 'medium-battery': { out: 50, rwm: 9000 }, 'large-battery': { out: 100, rwm: 24000 },
};
const BATTERY_EFFICIENCY = 0.8;
export const FLUID_SOURCE: Partial<Record<DeployableKind, { flow: number; perSec: number; capacity: number }>> = {
  'water-pump': { flow: 12, perSec: 8.5, capacity: 2000 },
  'water-barrel': { flow: 12, perSec: 0, capacity: 20000 },
  'small-water-catcher': { flow: 6, perSec: 3 / 60, capacity: 10000 },
  'large-water-catcher': { flow: 12, perSec: 8 / 60, capacity: 50000 },
  'water-purifier': { flow: 12, perSec: 250 / 60, capacity: 2000 },
  'powered-water-purifier': { flow: 12, perSec: 2000 / 60, capacity: 5000 },
};
export const SPRINKLER_DRAIN = 2;
export const SPRINKLER_RADIUS = 3;
export const SPRINKLER_REACH = { up: [-0.5, 2], down: [-3.2, 0.5] } as const;
export const GROW_LIGHT_RADIUS = 3;
export const HEATER_RADIUS = 4;
const GRAVITY_THRESHOLD = 1;
const PLANTERS: DeployableKind[] = ['small-planter', 'large-planter', 'triangle-planter'];

/** Ветряк: 150 · (h/50 · 0.5 + шум), шум взят средним 0.5. h — высота основания над землёй (y = 0). */
export function windOutput(height: number): number {
  return Math.floor(WIND_MAX * Math.min(1, Math.max(0, (Math.min(Math.max(height, 0), 50) / 50) * 0.5 + 0.5)));
}

interface Out {
  amount: number;
  pumped: boolean;
  originY: number;
}

export interface DeviceSim {
  id: string;
  kind: DeployableKind;
  inputs: number[];
  outputs: number[];
  need?: number;
  powered?: boolean;
}

export interface SourceSim {
  id: string;
  kind: DeployableKind;
  max: number;
  used: number;
}

export interface BatterySim {
  id: string;
  kind: DeployableKind;
  input: number;
  charge: number;
  drain: number;
  capacity: number;
  /** Часов до разряда от полного (drain > charge) или до полного заряда с нуля (charge > drain). */
  hours: number | null;
}

export interface WaterSim {
  id: string;
  kind: DeployableKind;
  perSec: number;
  drain: number;
  capacity: number;
  /** Часов до опустошения от полного, если расход больше прихода. */
  hours: number | null;
}

export interface PlanterSim {
  id: string;
  kind: DeployableKind;
  water: string[];
  light: string[];
  heat: string[];
}

export interface GravityIssue {
  wire: string;
  rise: number;
}

export interface IOSimulation {
  devices: Map<string, DeviceSim>;
  wires: Map<string, number>;
  sources: SourceSim[];
  consumers: DeviceSim[];
  batteries: BatterySim[];
  water: WaterSim[];
  sprinklers: DeviceSim[];
  planters: PlanterSim[];
  gravity: GravityIssue[];
}

const zeroOut = (y: number): Out => ({ amount: 0, pumped: false, originY: y });

export function simulate(resolved: Resolved): IOSimulation {
  const wires: ResolvedWire[] = resolved.wires ?? [];
  const devs = resolved.deployables.filter(d => IO[d.kind]);
  const byId = new Map(devs.map(d => [d.id, d]));
  const outWires = new Map<string, ResolvedWire[]>();
  for (const w of wires) outWires.set(w.from.id, [...(outWires.get(w.from.id) ?? []), w]);
  const connected = (d: ResolvedDeployable, slot: number) => (outWires.get(d.id) ?? []).some(w => w.from.slot === slot);
  const outY = (d: ResolvedDeployable, slot: number) => slotWorld(d, IO[d.kind]!.outputs[slot])[1];
  const outs = new Map<string, Out[]>(devs.map(d => [d.id, IO[d.kind]!.outputs.map((_, i) => zeroOut(outY(d, i)))]));
  const ins = new Map<string, Out[]>();
  const gravity = new Map<string, number>();

  const compute = (d: ResolvedDeployable, inp: Out[]): Out[] => {
    const io = IO[d.kind]!;
    const a = (i: number) => inp[i]?.amount ?? 0;
    const n = io.outputs.length;
    const res: Out[] = io.outputs.map((_, i) => zeroOut(outY(d, i)));
    const set = (i: number, amount: number, from?: Out) => { if (i < n) res[i] = { amount: Math.max(0, amount), pumped: from?.pumped ?? false, originY: from?.originY ?? res[i].originY }; };
    const conn = io.outputs.map((_, i) => connected(d, i));
    const spread = (total: number, from?: Out) => {
      const idx = conn.map((c, i) => (c ? i : -1)).filter(i => i >= 0);
      if (!idx.length) return;
      const base = Math.floor(total / idx.length), rest = total - base * idx.length;
      idx.forEach((i, k) => set(i, base + (k < rest ? 1 : 0), from));
    };
    const passthrough = (need: number) => {
      const left = Math.max(0, a(0) - need);
      const idx = conn.map((c, i) => (c ? i : -1)).filter(i => i >= 0);
      for (const i of idx) set(i, Math.floor(left / idx.length), inp[0]);
    };
    switch (d.kind) {
      case 'small-generator': case 'large-solar-panel': set(0, GENERATION[d.kind]!); break;
      case 'wind-turbine': set(0, windOutput(d.position[1])); break;
      case 'small-battery': case 'medium-battery': case 'large-battery': set(0, BATTERY[d.kind]!.out); break;
      case 'splitter': case 'fluid-splitter': spread(a(0), inp[0]); break;
      case 'root-combiner': set(0, a(0) + a(1)); break;
      case 'fluid-combiner': set(0, a(0) + a(1) + a(2), [inp[0], inp[1], inp[2]].find(x => x && x.amount > 0)); break;
      case 'branch': set(0, a(0) - Math.min(a(0), 2)); set(1, Math.min(a(0), 2)); break;
      case 'blocker': set(0, a(1) > 0 ? 0 : a(0)); break;
      case 'and-switch': set(0, a(0) > 0 && a(1) > 0 ? Math.max(a(0), a(1)) : 0); break;
      case 'or-switch': set(0, Math.max(a(0), a(1))); break;
      case 'xor-switch': set(0, (a(0) > 0) !== (a(1) > 0) ? Math.max(a(0), a(1)) : 0); break;
      case 'switch': case 'smart-switch': case 'timer': case 'counter': case 'random-switch': set(0, a(0), inp[0]); break;
      case 'memory-cell': set(1, a(0)); break;
      case 'button': case 'pressure-pad': case 'hbhf-sensor': break;
      case 'sam-site': set(3, a(0) - 25); break;
      case 'water-pump': set(0, a(0) >= NEED['water-pump']! ? FLUID_SOURCE['water-pump']!.flow : 0, { amount: 0, pumped: true, originY: outY(d, 0) }); break;
      case 'water-barrel': case 'small-water-catcher': case 'large-water-catcher': set(0, FLUID_SOURCE[d.kind]!.flow); break;
      case 'water-purifier': set(0, a(0) > 0 ? FLUID_SOURCE[d.kind]!.flow : 0); break;
      case 'powered-water-purifier': set(0, a(0) > 0 && a(1) >= NEED[d.kind]! ? FLUID_SOURCE[d.kind]!.flow : 0); break;
      case 'sprinkler': passthrough(SPRINKLER_DRAIN); break;
      case 'fluid-switch': set(0, a(0), a(2) > 0 ? { ...inp[0], amount: a(0), pumped: true } : inp[0]); break;
      default: if (NEED[d.kind] !== undefined) passthrough(NEED[d.kind]!);
    }
    return res;
  };

  for (let iter = 0; iter < 64; iter++) {
    ins.clear();
    gravity.clear();
    for (const w of wires) {
      const from = byId.get(w.from.id), to = byId.get(w.to.id);
      if (!from || !to) continue;
      let o = outs.get(from.id)![w.from.slot] ?? zeroOut(0);
      if (w.kind === 'fluid' && !o.pumped && o.amount > 0) {
        const rise = w.path[w.path.length - 1][1] - o.originY;
        if (rise > GRAVITY_THRESHOLD) { gravity.set(w.id, rise); o = { ...o, amount: 0 }; }
      }
      const list = ins.get(to.id) ?? IO[to.kind]!.inputs.map(() => zeroOut(0));
      list[w.to.slot] = o;
      ins.set(to.id, list);
    }
    let changed = false;
    for (const d of devs) {
      const next = compute(d, ins.get(d.id) ?? IO[d.kind]!.inputs.map(() => zeroOut(0)));
      const prev = outs.get(d.id)!;
      if (next.some((o, i) => o.amount !== prev[i]?.amount || o.pumped !== prev[i]?.pumped)) changed = true;
      outs.set(d.id, next);
    }
    if (!changed) break;
  }

  const devices = new Map<string, DeviceSim>();
  for (const d of devs) {
    const inputs = (ins.get(d.id) ?? []).map(o => o.amount);
    const need = NEED[d.kind];
    const main = d.kind === 'powered-water-purifier' ? inputs[1] ?? 0 : inputs[0] ?? 0;
    devices.set(d.id, { id: d.id, kind: d.kind, inputs, outputs: outs.get(d.id)!.map(o => o.amount), need, powered: need !== undefined ? main >= need && main > 0 : undefined });
  }
  const wireAmount = new Map<string, number>();
  for (const w of wires) wireAmount.set(w.id, gravity.has(w.id) ? 0 : outs.get(w.from.id)?.[w.from.slot]?.amount ?? 0);

  const isRoot = (k: DeployableKind) => GENERATION[k] !== undefined || k === 'wind-turbine' || BATTERY[k] !== undefined;
  const demand = (id: string, seen: Set<string>): number => {
    if (seen.has(id)) return 0;
    seen.add(id);
    let sum = 0;
    for (const w of outWires.get(id) ?? []) {
      if (w.kind !== 'power' || !(wireAmount.get(w.id)! > 0)) continue;
      const to = devices.get(w.to.id)!;
      const b = BATTERY[to.kind];
      if (b) { sum += Math.min(wireAmount.get(w.id)!, 4 * b.out); continue; }
      if (isRoot(to.kind)) continue;
      if (to.powered && (to.kind === 'powered-water-purifier' ? w.to.slot === 1 : w.to.slot === 0)) sum += to.need ?? 0;
      sum += demand(w.to.id, seen);
    }
    return sum;
  };

  const sources: SourceSim[] = [];
  const batteries: BatterySim[] = [];
  for (const d of devs) {
    const dev = devices.get(d.id)!;
    const b = BATTERY[d.kind];
    if (b) {
      const input = dev.inputs[0] ?? 0;
      const charge = Math.min(input, 4 * b.out) * BATTERY_EFFICIENCY;
      const drain = Math.min(b.out, demand(d.id, new Set()));
      const net = charge - drain, capacity = b.rwm * 60;
      batteries.push({ id: d.id, kind: d.kind, input, charge, drain, capacity: b.rwm, hours: net === 0 ? null : capacity / Math.abs(net) / 3600 });
      continue;
    }
    if (isRoot(d.kind)) {
      const max = dev.outputs[0] ?? 0;
      sources.push({ id: d.id, kind: d.kind, max, used: Math.min(max, demand(d.id, new Set())) });
    }
  }

  const sprinklers = [...devices.values()].filter(d => d.kind === 'sprinkler').map(d => ({ ...d, powered: (d.inputs[0] ?? 0) >= SPRINKLER_DRAIN }));
  for (const s of sprinklers) devices.set(s.id, s);
  const fluidDemand = (id: string, seen: Set<string>): number => {
    if (seen.has(id)) return 0;
    seen.add(id);
    let sum = 0;
    for (const w of outWires.get(id) ?? []) {
      if (w.kind !== 'fluid' || !(wireAmount.get(w.id)! > 0)) continue;
      const to = devices.get(w.to.id)!;
      if (FLUID_SOURCE[to.kind] && to.kind !== 'water-purifier' && to.kind !== 'powered-water-purifier') continue;
      if (to.kind === 'sprinkler' && to.powered) sum += SPRINKLER_DRAIN;
      sum += fluidDemand(w.to.id, seen);
    }
    return sum;
  };
  const water: WaterSim[] = [];
  for (const d of devs) {
    const src = FLUID_SOURCE[d.kind];
    if (!src) continue;
    const dev = devices.get(d.id)!;
    const working = d.kind === 'water-pump' ? (dev.inputs[0] ?? 0) >= NEED['water-pump']! : d.kind === 'powered-water-purifier' ? dev.powered && (dev.inputs[0] ?? 0) > 0 : d.kind === 'water-purifier' ? (dev.inputs[0] ?? 0) > 0 : true;
    const perSec = working ? src.perSec : 0;
    const drain = Math.min(src.flow, fluidDemand(d.id, new Set()));
    water.push({ id: d.id, kind: d.kind, perSec, drain, capacity: src.capacity, hours: drain > perSec ? src.capacity / (drain - perSec) / 3600 : null });
  }

  const planters: PlanterSim[] = resolved.deployables.filter(d => PLANTERS.includes(d.kind)).map(p => {
    const b = DECK[p.kind]!.box;
    const near = (o: ResolvedDeployable, r: number, vertical: boolean) => {
      const a = (-p.rotation * Math.PI) / 180;
      const dx = o.position[0] - p.position[0], dz = o.position[2] - p.position[2];
      const lx = dx * Math.cos(a) - dz * Math.sin(a), lz = dx * Math.sin(a) + dz * Math.cos(a);
      const ex = Math.max(0, Math.max(b.x[0] - lx, lx - b.x[1])), ez = Math.max(0, Math.abs(lz) - b.z);
      const [lo, hi] = SPRINKLER_REACH[o.hanging ? 'down' : 'up'];
      const dy = p.position[1] - o.position[1];
      const ey = vertical ? Math.max(0, Math.abs(dy) - 0.5) : dy < lo || dy > hi ? Infinity : 0;
      return Math.hypot(ex, ey, ez) <= r;
    };
    const on = (kind: DeployableKind, r: number, vertical: boolean) => resolved.deployables.filter(o => o.kind === kind && devices.get(o.id)?.powered && near(o, r, vertical)).map(o => o.id);
    return { id: p.id, kind: p.kind, water: on('sprinkler', SPRINKLER_RADIUS, false), light: on('ceiling-light', GROW_LIGHT_RADIUS, true), heat: on('electric-heater', HEATER_RADIUS, true) };
  });

  return {
    devices, wires: wireAmount, sources, batteries, water, sprinklers, planters,
    consumers: [...devices.values()].filter(d => d.need !== undefined),
    gravity: [...gravity.entries()].map(([wire, rise]) => ({ wire, rise })),
  };
}

