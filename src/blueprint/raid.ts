/**
 * Рейд по чертежу (SPEC §9.3): стоимость пути и поиск самого дешёвого пути
 * по графу ячеек. Путь ищется в пределах одного уровня.
 */
import { EXPLOSIVE_COSTS, RAID_RULES } from '../data/raidData.ts';
import type { ExplosiveType, RaidCostRule, RaidMethod } from '../types/index.ts';
import { KINDS, apothem, edgeAngle, edgeCount } from './catalog.ts';
import type { DeployableKind, Grade, Resolved, ResolvedDeployable, ResolvedElement } from './types.ts';

export const OUTSIDE = '__outside__';

/** Рейд дверей (обновление 2026-09). optimal — минимум серы. */
export const DOOR_RAID_RULES: Record<Exclude<DeployableKind, 'tool-cupboard'>, RaidCostRule> = {
  'wooden-door':             { blockId: 'wooden-door', blockName: 'Деревянная дверь', satchel: 2, rocket: 1, c4: 1, explosiveAmmo: 18, optimal: { explosiveAmmo: 18 } },
  'wooden-double-door':      { blockId: 'wooden-double-door', blockName: 'Двойная деревянная дверь', satchel: 2, rocket: 1, c4: 1, explosiveAmmo: 18, optimal: { explosiveAmmo: 18 } },
  'sheet-metal-door':        { blockId: 'sheet-metal-door', blockName: 'Металлическая дверь', satchel: 4, rocket: 2, c4: 1, explosiveAmmo: 63, optimal: { explosiveAmmo: 63 } },
  'sheet-metal-double-door': { blockId: 'sheet-metal-double-door', blockName: 'Двойная металлическая дверь', satchel: 4, rocket: 2, c4: 1, explosiveAmmo: 63, optimal: { explosiveAmmo: 63 } },
  'garage-door':             { blockId: 'garage-door', blockName: 'Гаражная дверь', satchel: 9, rocket: 3, c4: 2, explosiveAmmo: 150, optimal: { explosiveAmmo: 150 } },
  'armored-door':            { blockId: 'armored-door', blockName: 'Бронированная дверь', satchel: 15, rocket: 5, c4: 3, explosiveAmmo: 250, optimal: { explosiveAmmo: 250 } },
  'armored-double-door':     { blockId: 'armored-double-door', blockName: 'Двойная бронированная дверь', satchel: 15, rocket: 5, c4: 3, explosiveAmmo: 250, optimal: { explosiveAmmo: 250 } },
};

/** Ветки ломаются инструментом: взрывчатки 0. */
const TWIG_RULE: RaidCostRule = { blockId: 'twig', blockName: 'Ветки', satchel: 0, rocket: 0, c4: 0, explosiveAmmo: 0, optimal: {} };

export interface RaidStep {
  id: string;
  /** Что ломаем: тип элемента или двери. */
  kind: string;
  grade?: Grade;
  /** Раскладка взрывчатки. */
  breakdown: { explosive: ExplosiveType; count: number }[];
  sulfur: number;
  /** Для рамы/проёма без двери и низкой стены: проход свободен. */
  free: boolean;
}

export interface RaidPath {
  steps: RaidStep[];
  sulfur: number;
  /** Ломаемые элементы в порядке прохода. */
  ids: string[];
  /** Ячейки пути от входа до шкафа (для линии в 3D), без OUTSIDE. */
  cells: string[];
  /** Середина ребра, через которое заходим с улицы (если известна). */
  entry?: [number, number, number];
}

function ruleFor(kind: string, grade?: Grade): RaidCostRule | null {
  if (kind in DOOR_RAID_RULES) return DOOR_RAID_RULES[kind as keyof typeof DOOR_RAID_RULES];
  if (!grade) return null;
  if (grade === 'twig') return TWIG_RULE;
  return RAID_RULES[grade];
}

function sulfurOf(breakdown: { explosive: ExplosiveType; count: number }[]): number {
  return breakdown.reduce((acc, b) => acc + (EXPLOSIVE_COSTS[b.explosive].sulfur ?? 0) * b.count, 0);
}

/** Стоимость одного разрушаемого элемента выбранным методом. */
export function stepCost(id: string, kind: string, grade: Grade | undefined, method: RaidMethod): RaidStep {
  const rule = ruleFor(kind, grade);
  if (!rule) return { id, kind, grade, breakdown: [], sulfur: 0, free: true };
  let breakdown: RaidStep['breakdown'];
  if (method === 'optimal') {
    breakdown = Object.entries(rule.optimal ?? {})
      .filter(([, n]) => (n ?? 0) > 0)
      .map(([explosive, count]) => ({ explosive: explosive as ExplosiveType, count: count as number }));
  } else {
    const n = rule[method] ?? 0;
    breakdown = n > 0 ? [{ explosive: method, count: n }] : [];
  }
  return { id, kind, grade, breakdown, sulfur: sulfurOf(breakdown), free: false };
}

/** Что стоит на ребре ячейки и что это стоит сломать. */
interface EdgeBlocker {
  element: ResolvedElement | null;   // стена-тип
  door: ResolvedDeployable | null;   // дверь в проёме
}

/** Проходимо ли ребро без разрушения и что ломать иначе. Возвращает null, если ломать нечего. */
function blockerStep(b: EdgeBlocker, method: RaidMethod): RaidStep | null {
  if (!b.element) return null;
  const info = KINDS[b.element.kind];
  if (info.opening || b.element.kind === 'window-frame') {
    return b.door ? stepCost(b.door.id, b.door.kind, undefined, method) : null;
  }
  if (b.element.kind === 'low-wall') return null;
  return stepCost(b.element.id, b.element.kind, b.element.grade, method);
}

/** Ключ точки с округлением до 1 см; «+ 0» убирает −0 после cos/sin. */
const r2 = (v: number) => (Math.round(v * 100) / 100 + 0).toFixed(2);
const key = (x: number, y: number, z: number) => `${r2(x)}|${r2(y)}|${r2(z)}`;

interface CellEdge {
  cell: ResolvedElement;
  k: number;
  mid: [number, number, number];
}

interface AdjEdge { to: string; blocker: EdgeBlocker; mid: [number, number, number] }

/** Граф ячеек одного уровня: ребро → соседняя ячейка или OUTSIDE, с тем, что это ребро перегораживает. */
export function buildCellGraph(resolved: Resolved) {
  const cells = resolved.elements.filter(e => KINDS[e.kind].category === 'cell');
  const wallsAt = new Map<string, ResolvedElement>();
  for (const e of resolved.elements) {
    if (KINDS[e.kind].category === 'wallType') wallsAt.set(key(...e.position), e);
  }
  const doorsIn = new Map<string, ResolvedDeployable>();
  for (const d of resolved.deployables) if (d.kind !== 'tool-cupboard') doorsIn.set(d.parent, d);

  const edgesOf = (c: ResolvedElement): CellEdge[] => {
    const shape = KINDS[c.kind].shape!;
    const a = apothem(shape);
    return Array.from({ length: edgeCount(shape) }, (_, k) => {
      const ang = ((c.rotation + edgeAngle(shape, k)) * Math.PI) / 180;
      return { cell: c, k, mid: [c.position[0] + a * Math.cos(ang), c.position[1], c.position[2] + a * Math.sin(ang)] };
    });
  };
  const cellAt = new Map<string, ResolvedElement[]>();
  for (const c of cells) {
    for (const e of edgesOf(c)) {
      const kk = key(...e.mid);
      cellAt.set(kk, [...(cellAt.get(kk) ?? []), c]);
    }
  }

  /** Соседи: к кому, чем перегорожено, через какую точку */
  const adj = new Map<string, AdjEdge[]>();
  for (const c of cells) {
    const list: AdjEdge[] = [];
    for (const e of edgesOf(c)) {
      const kk = key(...e.mid);
      const wall = wallsAt.get(kk) ?? null;
      const blocker: EdgeBlocker = { element: wall, door: wall ? doorsIn.get(wall.id) ?? null : null };
      const neighbour = (cellAt.get(kk) ?? []).find(n => n.id !== c.id);
      list.push({ to: neighbour ? neighbour.id : OUTSIDE, blocker, mid: e.mid });
    }
    adj.set(c.id, list);
  }
  return { cells, adj };
}

/** Самый дешёвый путь снаружи до ячейки targetCell (Дейкстра по сере). */
export function cheapestRaidPath(resolved: Resolved, targetCell: string, method: RaidMethod): RaidPath | null {
  const { cells, adj } = buildCellGraph(resolved);
  if (!cells.some(c => c.id === targetCell)) return null;

  // Обратные рёбра от OUTSIDE: заходим в любую ячейку с «уличным» ребром
  const entries: AdjEdge[] = [];
  for (const [id, list] of adj) for (const e of list) if (e.to === OUTSIDE) entries.push({ to: id, blocker: e.blocker, mid: e.mid });
  adj.set(OUTSIDE, entries);

  const dist = new Map<string, number>([[OUTSIDE, 0]]);
  const prev = new Map<string, { from: string; step: RaidStep | null; mid: [number, number, number] }>();
  const done = new Set<string>();
  while (true) {
    let cur: string | null = null;
    for (const [id, d] of dist) if (!done.has(id) && (cur === null || d < dist.get(cur)!)) cur = id;
    if (cur === null || cur === targetCell) break;
    done.add(cur);
    for (const e of adj.get(cur) ?? []) {
      if (e.to === OUTSIDE || done.has(e.to)) continue;
      const step = blockerStep(e.blocker, method);
      const nd = dist.get(cur)! + (step?.sulfur ?? 0);
      if (nd < (dist.get(e.to) ?? Infinity)) {
        dist.set(e.to, nd);
        prev.set(e.to, { from: cur, step, mid: e.mid });
      }
    }
  }
  if (!dist.has(targetCell)) return null;

  const steps: RaidStep[] = [];
  const cellsOnPath: string[] = [];
  let entry: [number, number, number] | undefined;
  for (let at = targetCell; at !== OUTSIDE; ) {
    const p = prev.get(at)!;
    cellsOnPath.unshift(at);
    if (p.step) steps.unshift(p.step);
    if (p.from === OUTSIDE) entry = p.mid;
    at = p.from;
  }
  return { steps, sulfur: steps.reduce((a, s) => a + s.sulfur, 0), ids: steps.map(s => s.id), cells: cellsOnPath, entry };
}

const LINE_Y = 1.3;

/** Точки линии пути для 3D: с улицы, через ячейки или ломаемые элементы, к шкафу. */
export function raidPolyline(resolved: Resolved, path: RaidPath, target: [number, number, number]): [number, number, number][] {
  const pos = (id: string): [number, number, number] | null => {
    const el = resolved.elements.find(e => e.id === id);
    if (el) return el.position;
    const d = resolved.deployables.find(x => x.id === id);
    return d ? d.position : null;
  };
  const pts: [number, number, number][] = [];
  if (path.cells.length > 0) {
    const first = pos(path.cells[0])!;
    if (path.entry) {
      const [ex, , ez] = path.entry;
      pts.push([first[0] + (ex - first[0]) * 2.4, first[1] + LINE_Y, first[2] + (ez - first[2]) * 2.4]);
    }
    for (const c of path.cells) { const p = pos(c)!; pts.push([p[0], p[1] + LINE_Y, p[2]]); }
  } else if (path.ids.length > 0) {
    const first = resolved.elements.find(e => e.id === path.ids[0])
      ?? resolved.elements.find(e => e.id === resolved.deployables.find(d => d.id === path.ids[0])?.parent);
    if (first) {
      const a = (first.rotation * Math.PI) / 180;
      pts.push([first.position[0] + 2.2 * Math.cos(a), first.position[1] + LINE_Y, first.position[2] + 2.2 * Math.sin(a)]);
    }
    for (const id of path.ids) { const p = pos(id); if (p) pts.push([p[0], p[1] + LINE_Y, p[2]]); }
  }
  pts.push([target[0], target[1] + 0.8, target[2]]);
  return pts;
}

/** Стоимость заданного пути (raidPath из чертежа). */
export function authoredRaidPath(resolved: Resolved, ids: string[], method: RaidMethod): RaidPath {
  const steps: RaidStep[] = [];
  for (const id of ids) {
    const el = resolved.elements.find(e => e.id === id);
    if (el) { steps.push(stepCost(el.id, el.kind, el.grade, method)); continue; }
    const d = resolved.deployables.find(x => x.id === id);
    if (d && d.kind !== 'tool-cupboard') steps.push(stepCost(d.id, d.kind, undefined, method));
  }
  return { steps, sulfur: steps.reduce((a, s) => a + s.sulfur, 0), ids: steps.map(s => s.id), cells: [] };
}
