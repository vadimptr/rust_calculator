/**
 * Рейд по чертежу (SPEC §9.3): стоимость пути и поиск самого дешёвого пути
 * по графу ячеек. Путь ищется в пределах одного уровня.
 */
import { EXPLOSIVE_COSTS, RAID_RULES } from '../data/raidData.ts';
import type { ExplosiveType, RaidCostRule, RaidMethod } from '../types/index.ts';
import { KINDS, apothem, edgeAngle, edgeCount, wallHeight } from './catalog.ts';
import type { DeployableKind, Grade, Resolved, ResolvedDeployable, ResolvedElement } from './types.ts';

export const OUTSIDE = '__outside__';

/** Рейд дверей и вставок в окна (обновление 2026-09). optimal — минимум серы. */
export const DOOR_RAID_RULES: Record<Exclude<DeployableKind, 'tool-cupboard'>, RaidCostRule> = {
  'wooden-door':             { blockId: 'wooden-door', blockName: 'Деревянная дверь', satchel: 2, rocket: 1, c4: 1, explosiveAmmo: 18, optimal: { explosiveAmmo: 18 } },
  'wooden-double-door':      { blockId: 'wooden-double-door', blockName: 'Двойная деревянная дверь', satchel: 2, rocket: 1, c4: 1, explosiveAmmo: 18, optimal: { explosiveAmmo: 18 } },
  'sheet-metal-door':        { blockId: 'sheet-metal-door', blockName: 'Металлическая дверь', satchel: 4, rocket: 2, c4: 1, explosiveAmmo: 63, optimal: { explosiveAmmo: 63 } },
  'sheet-metal-double-door': { blockId: 'sheet-metal-double-door', blockName: 'Двойная металлическая дверь', satchel: 4, rocket: 2, c4: 1, explosiveAmmo: 63, optimal: { explosiveAmmo: 63 } },
  'garage-door':             { blockId: 'garage-door', blockName: 'Гаражная дверь', satchel: 9, rocket: 3, c4: 2, explosiveAmmo: 150, optimal: { explosiveAmmo: 150 } },
  'armored-door':            { blockId: 'armored-door', blockName: 'Бронированная дверь', satchel: 15, rocket: 5, c4: 3, explosiveAmmo: 250, optimal: { explosiveAmmo: 250 } },
  'armored-double-door':     { blockId: 'armored-double-door', blockName: 'Двойная бронированная дверь', satchel: 15, rocket: 5, c4: 3, explosiveAmmo: 250, optimal: { explosiveAmmo: 250 } },
  'strengthened-glass-window': { blockId: 'strengthened-glass-window', blockName: 'Укреплённое стекло', satchel: 9, rocket: 3, c4: 2, explosiveAmmo: 140, optimal: { explosiveAmmo: 140 } },
  'reinforced-glass-window':   { blockId: 'reinforced-glass-window', blockName: 'Усиленное стекло', satchel: 12, rocket: 4, c4: 2, explosiveAmmo: 200, optimal: { c4: 2 } },
  'metal-window-bars':         { blockId: 'metal-window-bars', blockName: 'Металлическая решётка', satchel: 12, rocket: 4, c4: 2, explosiveAmmo: 200, optimal: { c4: 2 } },
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
  /** Узлы пути от входа до шкафа, без OUTSIDE (виртуальные — с префиксом ^). */
  cells: string[];
  /** Центры пространств пути (для линии в 3D). */
  points: [number, number, number][];
  /** Точка, через которую заходим с улицы. */
  entry?: [number, number, number];
  /** Откуда рейдер атакует каждый ломаемый элемент: середина пространства перед ним (на высоте 1.5 м). */
  eyes?: Record<string, [number, number, number]>;
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

/** Что стоит на ребре и что это стоит сломать. */
interface EdgeBlocker {
  /** Стена-тип на ребре или пол при вертикальном переходе. */
  element: ResolvedElement | null;
  door: ResolvedDeployable | null;
}

/** Что ломать, чтобы пройти; null — проход свободен. */
function blockerStep(b: EdgeBlocker, method: RaidMethod): RaidStep | null {
  if (!b.element) return null;
  const info = KINDS[b.element.kind];
  if (info.category === 'cell') {
    return info.isFrame ? null : stepCost(b.element.id, b.element.kind, b.element.grade, method);
  }
  if (info.opening || b.element.kind === 'window-frame') {
    return b.door ? stepCost(b.door.id, b.door.kind, undefined, method) : null;
  }
  if (b.element.kind === 'low-wall') return null;
  return stepCost(b.element.id, b.element.kind, b.element.grade, method);
}

/** Ключ точки с округлением до 1 см; «+ 0» убирает −0 после cos/sin. */
const r2 = (v: number) => (Math.round(v * 100) / 100 + 0).toFixed(2);
const key2 = (x: number, z: number) => `${r2(x)}|${r2(z)}`;
const key3 = (x: number, y: number, z: number) => `${r2(x)}|${r2(y)}|${r2(z)}`;

/** Пространство над ячейкой целого уровня или виртуальная комната без пола над ней. */
export interface SpaceNode {
  id: string;
  /** Ячейка-основание; у виртуального пространства — ячейка под ним. */
  cell: ResolvedElement;
  virtual: boolean;
  position: [number, number, number];
  level: number;
}

export interface AdjEdge {
  to: string;
  blocker: EdgeBlocker;
  /** Точка перехода: середина ребра или центр пола. */
  mid: [number, number, number];
}

export interface SpaceGraph {
  nodes: Map<string, SpaceNode>;
  adj: Map<string, AdjEdge[]>;
}

function edgeMids(shape: 'square' | 'triangle', pos: [number, number, number], rotation: number): [number, number, number][] {
  const a = apothem(shape);
  return Array.from({ length: edgeCount(shape) }, (_, k) => {
    const ang = ((rotation + edgeAngle(shape, k)) * Math.PI) / 180;
    return [pos[0] + a * Math.cos(ang), pos[1], pos[2] + a * Math.sin(ang)];
  });
}

/** Граф пространств (SPEC §9.3). */
export function buildSpaceGraph(resolved: Resolved): SpaceGraph {
  const cells = resolved.elements.filter(e => KINDS[e.kind].category === 'cell' && Number.isInteger(e.level));
  const walls = resolved.elements.filter(e => KINDS[e.kind].category === 'wallType');
  const doorsIn = new Map<string, ResolvedDeployable>();
  for (const d of resolved.deployables) if (d.kind !== 'tool-cupboard') doorsIn.set(d.parent, d);

  /** Стена-тип на вертикали (x, z), перекрывающая высоту y. */
  const wallsAtXZ = new Map<string, ResolvedElement[]>();
  for (const w of walls) {
    const k = key2(w.position[0], w.position[2]);
    wallsAtXZ.set(k, [...(wallsAtXZ.get(k) ?? []), w]);
  }
  const wallAt = (mid: [number, number, number]): ResolvedElement | null =>
    (wallsAtXZ.get(key2(mid[0], mid[2])) ?? []).find(w => mid[1] >= w.position[1] - 1e-6 && mid[1] < w.position[1] + wallHeight(w.kind) - 1e-6) ?? null;

  const nodes = new Map<string, SpaceNode>();
  const cellAtPos = new Map<string, ResolvedElement>();
  for (const c of cells) {
    nodes.set(c.id, { id: c.id, cell: c, virtual: false, position: c.position, level: c.level });
    cellAtPos.set(key3(...c.position), c);
  }
  // Виртуальные пространства: над ячейкой нет пола, но на её стенах стоят стены следующего уровня
  for (const c of cells) {
    const above: [number, number, number] = [c.position[0], c.position[1] + 3, c.position[2]];
    if (cellAtPos.has(key3(...above))) continue;
    const shape = KINDS[c.kind].shape!;
    const hasWalls = edgeMids(shape, above, c.rotation).some(m => wallAt(m));
    if (hasWalls) nodes.set(`^${c.id}`, { id: `^${c.id}`, cell: c, virtual: true, position: above, level: c.level + 1 });
  }

  /** Узлы по середине ребра (для поиска соседа) */
  const nodesAtMid = new Map<string, SpaceNode[]>();
  const midsOf = (n: SpaceNode) => edgeMids(KINDS[n.cell.kind].shape!, n.position, n.cell.rotation);
  for (const n of nodes.values()) for (const m of midsOf(n)) {
    const k = key3(...m);
    nodesAtMid.set(k, [...(nodesAtMid.get(k) ?? []), n]);
  }
  const nodeAtPos = new Map<string, SpaceNode>();
  for (const n of nodes.values()) nodeAtPos.set(key3(...n.position), n);

  const adj = new Map<string, AdjEdge[]>();
  for (const n of nodes.values()) {
    const list: AdjEdge[] = [];
    for (const m of midsOf(n)) {
      const wall = wallAt(m);
      const blocker: EdgeBlocker = { element: wall, door: wall ? doorsIn.get(wall.id) ?? null : null };
      const neighbour = (nodesAtMid.get(key3(...m)) ?? []).find(x => x.id !== n.id);
      list.push({ to: neighbour ? neighbour.id : OUTSIDE, blocker, mid: m });
    }
    // Вверх: через пол пространства над нами, бесплатно в виртуальную комнату, на улицу — если ничего нет
    const abovePos: [number, number, number] = [n.position[0], n.position[1] + 3, n.position[2]];
    const above = nodeAtPos.get(key3(...abovePos));
    if (above) {
      list.push({ to: above.id, blocker: { element: above.virtual ? null : above.cell, door: null }, mid: abovePos });
    } else {
      list.push({ to: OUTSIDE, blocker: { element: null, door: null }, mid: abovePos });
    }
    adj.set(n.id, list);
  }
  // Вниз: симметрично вертикальным рёбрам
  for (const [from, list] of [...adj.entries()]) {
    for (const e of list) {
      if (e.to === OUTSIDE || e.mid[1] <= nodes.get(from)!.position[1] + 1e-6) continue;
      const back = adj.get(e.to)!;
      if (!back.some(b => b.to === from)) back.push({ to: from, blocker: e.blocker, mid: e.mid });
    }
  }
  return { nodes, adj };
}

interface Hop { to: string; step: RaidStep | null; mid: [number, number, number] }

interface PathResult {
  hops: Hop[];
  sulfur: number;
}

/** Дейкстра от start до target с исключёнными узлами и рёбрами (для алгоритма Йена). */
function dijkstra(
  graph: SpaceGraph, target: string, method: RaidMethod,
  bannedNodes: Set<string>, bannedEdges: Set<string>, start = OUTSIDE,
): PathResult | null {
  const entries: AdjEdge[] = [];
  for (const [id, list] of graph.adj) for (const e of list) if (e.to === OUTSIDE) entries.push({ to: id, blocker: e.blocker, mid: e.mid });
  const edgesOf = (id: string) => (id === OUTSIDE ? entries : graph.adj.get(id) ?? []);

  const dist = new Map<string, number>([[start, 0]]);
  const prev = new Map<string, Hop & { from: string }>();
  const done = new Set<string>();
  for (;;) {
    let cur: string | null = null;
    for (const [id, d] of dist) if (!done.has(id) && (cur === null || d < dist.get(cur)!)) cur = id;
    if (cur === null || cur === target) break;
    done.add(cur);
    for (const e of edgesOf(cur)) {
      if (e.to === OUTSIDE || done.has(e.to) || bannedNodes.has(e.to) || bannedEdges.has(`${cur}>${e.to}`)) continue;
      const step = blockerStep(e.blocker, method);
      const nd = dist.get(cur)! + (step?.sulfur ?? 0);
      if (nd < (dist.get(e.to) ?? Infinity)) { dist.set(e.to, nd); prev.set(e.to, { from: cur, to: e.to, step, mid: e.mid }); }
    }
  }
  if (!dist.has(target)) return null;
  const hops: Hop[] = [];
  for (let at = target; at !== start; ) {
    const p = prev.get(at)!;
    hops.unshift({ to: p.to, step: p.step, mid: p.mid });
    at = p.from;
  }
  return { hops, sulfur: dist.get(target)! };
}

/** Несколько самых дешёвых по штукам путей (алгоритм Йена). */
export function cheapestRaidPaths(resolved: Resolved, targetCell: string, method: RaidMethod, k = 6, prebuilt?: SpaceGraph): RaidPath[] {
  const graph = prebuilt ?? buildSpaceGraph(resolved);
  if (!graph.nodes.has(targetCell)) return [];
  const toRaidPath = (r: PathResult): RaidPath => {
    const steps = r.hops.flatMap(h => (h.step ? [h.step] : []));
    const nodes = r.hops.map(h => h.to);
    const eyes: Record<string, [number, number, number]> = {};
    let from: string = OUTSIDE;
    for (const h of r.hops) {
      if (h.step) {
        const toPos = graph.nodes.get(h.to)!.position;
        const fromPos = from === OUTSIDE
          ? ([h.mid[0] * 2 - toPos[0], toPos[1], h.mid[2] * 2 - toPos[2]] as [number, number, number])
          : graph.nodes.get(from)!.position;
        eyes[h.step.id] = [fromPos[0], fromPos[1] + 1.5, fromPos[2]];
      }
      from = h.to;
    }
    return {
      steps, sulfur: r.sulfur, ids: steps.map(s => s.id), cells: nodes,
      points: nodes.map(id => graph.nodes.get(id)!.position), entry: r.hops[0]?.mid, eyes,
    };
  };
  const first = dijkstra(graph, targetCell, method, new Set(), new Set());
  if (!first) return [];
  const A: PathResult[] = [first];
  const B: PathResult[] = [];
  const sig = (r: PathResult) => r.hops.map(h => h.to).join('>');
  for (let i = 1; i < k; i++) {
    const last = A[i - 1];
    const full = [OUTSIDE, ...last.hops.map(h => h.to)];
    for (let j = 0; j < full.length - 1; j++) {
      const spur = full[j];
      const rootKey = full.slice(0, j + 1).join('>');
      const bannedEdges = new Set<string>();
      for (const p of A) {
        const pf = [OUTSIDE, ...p.hops.map(h => h.to)];
        if (pf.slice(0, j + 1).join('>') === rootKey && pf.length > j + 1) bannedEdges.add(`${pf[j]}>${pf[j + 1]}`);
      }
      const bannedNodes = new Set(full.slice(0, j).filter(n => n !== OUTSIDE));
      const spurPath = dijkstra(graph, targetCell, method, bannedNodes, bannedEdges, spur);
      if (!spurPath) continue;
      const rootHops = last.hops.slice(0, j);
      const total: PathResult = {
        hops: [...rootHops, ...spurPath.hops],
        sulfur: rootHops.reduce((a, h) => a + (h.step?.sulfur ?? 0), 0) + spurPath.sulfur,
      };
      if (!A.some(p => sig(p) === sig(total)) && !B.some(p => sig(p) === sig(total))) B.push(total);
    }
    if (B.length === 0) break;
    B.sort((a, b) => a.sulfur - b.sulfur || a.hops.length - b.hops.length);
    A.push(B.shift()!);
  }
  return A.map(toRaidPath);
}

/** Самый дешёвый путь по штукам. */
export function cheapestRaidPath(resolved: Resolved, targetCell: string, method: RaidMethod): RaidPath | null {
  return cheapestRaidPaths(resolved, targetCell, method, 1)[0] ?? null;
}

const LINE_Y = 1.3;

/** Точки линии пути для 3D: с улицы, через пространства пути, к шкафу. */
export function raidPolyline(_resolved: Resolved, path: RaidPath, target: [number, number, number]): [number, number, number][] {
  const pts: [number, number, number][] = [];
  if (path.points.length > 0 && path.entry) {
    const first = path.points[0];
    const [ex, ey, ez] = path.entry;
    const dy = ey - first[1];
    pts.push([first[0] + (ex - first[0]) * 2.4, first[1] + LINE_Y + (dy > 1 ? 1.2 : 0), first[2] + (ez - first[2]) * 2.4]);
  }
  for (const p of path.points) pts.push([p[0], p[1] + LINE_Y, p[2]]);
  pts.push([target[0], target[1] + 0.8, target[2]]);
  return pts;
}

/** Выбор пути: для ракет — с наименьшим числом ракет со сплешем среди k лучших по штукам; иначе первый. */
export function chooseRaidPath(
  resolved: Resolved, targetCell: string, method: RaidMethod,
  planSplash: (ids: string[]) => { rockets: number } | null,
): { path: RaidPath; candidates: number } | null {
  const paths = cheapestRaidPaths(resolved, targetCell, method, method === 'rocket' ? 8 : 1);
  if (paths.length === 0) return null;
  if (method !== 'rocket') return { path: paths[0], candidates: paths.length };
  let best = paths[0];
  let bestRockets = planSplash(best.ids)?.rockets ?? Infinity;
  for (const p of paths.slice(1)) {
    const r = planSplash(p.ids)?.rockets ?? Infinity;
    if (r < bestRockets || (r === bestRockets && p.sulfur < best.sulfur)) { best = p; bestRockets = r; }
  }
  return { path: best, candidates: paths.length };
}

/**
 * Ценность пространства: комната со шкафом — 3, транзитные (запрыг с полом на половинной
 * высоте, комната без пола, аирлок из двух дверей без другого содержимого) — 0.25, остальные — 1.
 */
export function spaceValue(graph: SpaceGraph, node: SpaceNode, resolved: Resolved): number {
  const tc = resolved.deployables.find(d => d.kind === 'tool-cupboard');
  if (tc && tc.parent === node.cell.id && !node.virtual) return 3;
  if (node.virtual) return 0.25;
  // запрыг: над ячейкой пол на половинной высоте
  const hasHalfFloor = resolved.elements.some(e => KINDS[e.kind].category === 'cell' && !Number.isInteger(e.level)
    && Math.abs(e.position[0] - node.position[0]) < 1.6 && Math.abs(e.position[2] - node.position[2]) < 1.6
    && e.position[1] > node.position[1] && e.position[1] < node.position[1] + 3);
  if (hasHalfFloor) return 0.25;
  // аирлок: ровно две двери на рёбрах и никаких других проходов
  const edges = graph.adj.get(node.id) ?? [];
  const doors = edges.filter(e => e.blocker.door).length;
  const openPasses = edges.filter(e => e.to !== OUTSIDE && blockerStep(e.blocker, 'c4') === null && e.mid[1] <= node.position[1] + 1e-6).length;
  if (doors >= 2 && openPasses === 0) return 0.5;
  return 1;
}

export function spacesValue(graph: SpaceGraph, ids: Iterable<string>, resolved: Resolved): number {
  let v = 0;
  for (const id of ids) { const n = graph.nodes.get(id); if (n) v += spaceValue(graph, n, resolved); }
  return Math.round(v * 100) / 100;
}

/** Пространства, достижимые с улицы без разрушений, если элементы из broken уже сломаны. */
export function reachableSpaces(graph: SpaceGraph, broken: Set<string>): Set<string> {
  const entries: AdjEdge[] = [];
  for (const [id, list] of graph.adj) for (const e of list) if (e.to === OUTSIDE) entries.push({ to: id, blocker: e.blocker, mid: e.mid });
  const passable = (b: EdgeBlocker) => {
    const step = blockerStep(b, 'c4');
    return step === null || broken.has(step.id);
  };
  const seen = new Set<string>();
  const queue: string[] = [];
  for (const e of entries) if (passable(e.blocker) && !seen.has(e.to)) { seen.add(e.to); queue.push(e.to); }
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const e of graph.adj.get(cur) ?? []) {
      if (e.to === OUTSIDE || seen.has(e.to) || !passable(e.blocker)) continue;
      seen.add(e.to);
      queue.push(e.to);
    }
  }
  return seen;
}

/**
 * Самый дешёвый по штукам путь до target из любого пространства starts, где элементы из free уже
 * сломаны (проход через них бесплатный и шага не даёт). null — недостижимо.
 */
export function cheapestFrom(
  graph: SpaceGraph, starts: Set<string>, free: Set<string>, target: string, method: RaidMethod,
  stepSulfur: (step: RaidStep) => number = step => step.sulfur,
): RaidPath | null {
  if (starts.has(target)) return { steps: [], sulfur: 0, ids: [], cells: [target], points: [graph.nodes.get(target)!.position] };
  // с улицы можно зайти через любое уличное ребро
  const entries: AdjEdge[] = [];
  for (const [id, list] of graph.adj) for (const e of list) if (e.to === OUTSIDE) entries.push({ to: id, blocker: e.blocker, mid: e.mid });
  const edgesOf = (id: string) => (id === OUTSIDE ? entries : graph.adj.get(id) ?? []);
  const dist = new Map<string, number>();
  const prev = new Map<string, Hop & { from: string }>();
  for (const s of starts) dist.set(s, 0);
  const done = new Set<string>();
  for (;;) {
    let cur: string | null = null;
    for (const [id, d] of dist) if (!done.has(id) && (cur === null || d < dist.get(cur)!)) cur = id;
    if (cur === null || cur === target) break;
    done.add(cur);
    for (const e of edgesOf(cur)) {
      if (e.to === OUTSIDE || done.has(e.to)) continue;
      const raw = blockerStep(e.blocker, method);
      const step = raw && !free.has(raw.id) ? raw : null;
      const nd = dist.get(cur)! + (step ? stepSulfur(step) : 0);
      if (nd < (dist.get(e.to) ?? Infinity)) { dist.set(e.to, nd); prev.set(e.to, { from: cur, to: e.to, step, mid: e.mid }); }
    }
  }
  if (!dist.has(target)) return null;
  const hops: Hop[] = [];
  for (let at = target; !starts.has(at); ) {
    const p = prev.get(at)!;
    hops.unshift({ to: p.to, step: p.step, mid: p.mid });
    at = p.from;
  }
  const steps = hops.flatMap(h => (h.step ? [h.step] : []));
  const nodes = hops.map(h => h.to);
  const eyes: Record<string, [number, number, number]> = {};
  let from: string = hops.length ? [...starts].find(s => s !== OUTSIDE && (graph.adj.get(s) ?? []).some(e => e.to === hops[0].to)) ?? OUTSIDE : OUTSIDE;
  for (const h of hops) {
    if (h.step) {
      const toPos = graph.nodes.get(h.to)!.position;
      const fromPos = from === OUTSIDE || !graph.nodes.has(from)
        ? ([h.mid[0] * 2 - toPos[0], toPos[1], h.mid[2] * 2 - toPos[2]] as [number, number, number])
        : graph.nodes.get(from)!.position;
      eyes[h.step.id] = [fromPos[0], fromPos[1] + 1.5, fromPos[2]];
    }
    from = h.to;
  }
  return { steps, sulfur: dist.get(target)!, ids: steps.map(s => s.id), cells: nodes, points: nodes.map(id => graph.nodes.get(id)!.position), entry: hops[0]?.mid, eyes };
}

/** Элементы на границе доступной области: что рейдер может атаковать прямо сейчас и с какой стороны. */
export interface FrontierItem {
  /** id ломаемого элемента (стена, пол, дверь, вставка). */
  id: string;
  /** Точка обзора рейдера: середина доступного пространства (на высоте 1.5 м) или точка на улице. */
  from: [number, number, number];
  /** Точка перехода (середина ребра или центр пола). */
  mid: [number, number, number];
}

export function frontier(graph: SpaceGraph, reachable: Set<string>): FrontierItem[] {
  const out = new Map<string, FrontierItem>();
  const add = (id: string, from: [number, number, number], mid: [number, number, number]) => { if (!out.has(id)) out.set(id, { id, from, mid }); };
  const eye = (p: [number, number, number]): [number, number, number] => [p[0], p[1] + 1.5, p[2]];
  for (const [nodeId, list] of graph.adj) {
    const node = graph.nodes.get(nodeId)!;
    for (const e of list) {
      const step = blockerStep(e.blocker, 'c4');
      if (!step) continue;
      if (reachable.has(nodeId) && !reachable.has(e.to)) add(step.id, eye(node.position), e.mid);
      if (e.to === OUTSIDE && !reachable.has(nodeId)) {
        // с улицы: точка снаружи — продолжение от узла через середину ребра
        const away: [number, number, number] = [e.mid[0] * 2 - node.position[0], node.position[1], e.mid[2] * 2 - node.position[2]];
        add(step.id, eye(away), e.mid);
      }
    }
  }
  return [...out.values()];
}
