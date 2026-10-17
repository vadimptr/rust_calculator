/**
 * Стабильность как в игре (docs/research/rust-building-mechanics.md §4), коэффициенты — поля
 * `support` сокетов из префабов игры. Фундамент стоит на земле: 100%. У остальных блоков
 * стабильность = сумма по опорным (male) сокетам: коэффициент сокета × стабильность опоры, не
 * больше 1. На каждом сокете в зачёт идёт один сосед — ближайший к земле по числу блоков. Опора
 * считается так, как будто проверяемого блока нет (две стены не держат друг друга по кругу).
 * Ниже 5% блок обрушивается.
 *
 * Сокеты игры здесь заменены геометрией движка: опора стены — то, на чём стоит её низ (ячейка
 * ребром, стена снизу, конёк крыши), и стены, сходящиеся с её торцами; опоры пола — по одной на
 * каждое ребро (верх стены, соседний пол, конёк крыши); крыши — её низкое ребро; лестницы — ячейка
 * под ней.
 */
import { KINDS, apothem, edgeAngle, edgeCount, wallHeight } from './catalog.ts';
import type { Resolved, ResolvedElement } from './types.ts';

/** Коэффициенты `support` из префабов игры (2026-09). */
export const SUPPORT = {
  wallBottom: 0.7,
  lowWallBottom: 0.9,
  wallSide: 0.1,
  floorEdgeSquare: 0.25,
  floorEdgeTriangle: 0.33,
  roofLowEdge: 0.3,
  stairs: 0.7,
} as const;

/** Порог обрушения (`stability.collapse`) и точность пересчёта (`stability.accuracy`). */
export const COLLAPSE = 0.05;
const ACCURACY = 0.001;

const DEG = Math.PI / 180;
const key = (p: [number, number, number]) => p.map(v => (Math.round(v * 20) / 20 + 0).toFixed(2)).join('|');

function edgeMid(el: ResolvedElement, k: number): [number, number, number] {
  const shape = KINDS[el.kind].shape ?? 'square';
  const a = (el.rotation + edgeAngle(shape, k)) * DEG;
  return [el.position[0] + apothem(shape) * Math.cos(a), el.position[1], el.position[2] + apothem(shape) * Math.sin(a)];
}

/** Торцы стены: точки на её оси по краям, на высоте низа. */
function wallEnds(w: ResolvedElement): [number, number, number][] {
  const a = w.rotation * DEG;
  // ось стены — локальная z: (−sin, cos) в плане
  const dx = -Math.sin(a) * 1.5, dz = Math.cos(a) * 1.5;
  return [[w.position[0] + dx, w.position[1], w.position[2] + dz], [w.position[0] - dx, w.position[1], w.position[2] - dz]];
}

interface Support { factor: number; candidates: string[] }

/** Опоры каждого блока; фундаменты и съезды стоят на земле (null). */
export function buildSupports(resolved: Resolved): Map<string, Support[] | null> {
  const els = resolved.elements;
  // индексы точек: середины рёбер ячеек, верх стен, коньки и низы крыш, центры ячеек
  const cellEdge = new Map<string, string[]>();
  const wallTop = new Map<string, string[]>();
  const roofHigh = new Map<string, string[]>();
  const cellAt = new Map<string, string[]>();
  const push = (m: Map<string, string[]>, p: [number, number, number], id: string) => { const k = key(p); m.set(k, [...(m.get(k) ?? []), id]); };
  for (const e of els) {
    const info = KINDS[e.kind];
    if (info.category === 'cell') {
      for (let k = 0; k < edgeCount(info.shape!); k++) push(cellEdge, edgeMid(e, k), e.id);
      push(cellAt, e.position, e.id);
    } else if (info.category === 'wallType') {
      push(wallTop, [e.position[0], e.position[1] + wallHeight(e.kind), e.position[2]], e.id);
    } else if (info.category === 'roof' && info.shape === 'square') {
      const h = edgeMid(e, 2);
      push(roofHigh, [h[0], h[1] + 3, h[2]], e.id);
    }
  }
  const walls = els.filter(e => KINDS[e.kind].category === 'wallType');
  const out = new Map<string, Support[] | null>();
  for (const e of els) {
    const info = KINDS[e.kind];
    if (info.isFoundation || info.category === 'ramp') { out.set(e.id, null); continue; }
    const not = (ids: string[] | undefined) => (ids ?? []).filter(id => id !== e.id);
    const s: Support[] = [];
    if (info.category === 'wallType') {
      const p = key(e.position);
      s.push({ factor: e.kind === 'low-wall' ? SUPPORT.lowWallBottom : SUPPORT.wallBottom, candidates: [...not(cellEdge.get(p)), ...not(wallTop.get(p)), ...not(roofHigh.get(p))] });
      const h = wallHeight(e.kind);
      for (const end of wallEnds(e)) {
        const near = walls.filter(w => w.id !== e.id
          && wallEnds(w).some(q => Math.hypot(q[0] - end[0], q[2] - end[2]) < 0.05)
          && Math.min(e.position[1] + h, w.position[1] + wallHeight(w.kind)) - Math.max(e.position[1], w.position[1]) > 0.05);
        s.push({ factor: SUPPORT.wallSide, candidates: near.map(w => w.id) });
      }
    } else if (info.category === 'cell') {
      const factor = info.shape === 'square' ? SUPPORT.floorEdgeSquare : SUPPORT.floorEdgeTriangle;
      for (let k = 0; k < edgeCount(info.shape!); k++) {
        const p = key(edgeMid(e, k));
        // соседний пол того же уровня (не фундамент: фундамент полу не опора), верх стены, конёк крыши
        const floors = not(cellEdge.get(p)).filter(id => !KINDS[els.find(x => x.id === id)!.kind].isFoundation);
        s.push({ factor, candidates: [...not(wallTop.get(p)), ...floors, ...not(roofHigh.get(p))] });
      }
    } else if (info.category === 'roof' && e.inverted) {
      // перевёрнутый треугольник держится на соседних скатах по бокам
      for (const k of [1, 2]) {
        const m = edgeMid(e, k);
        const near = els.filter(o => o.id !== e.id && o.kind === 'roof-triangle' && Math.abs(o.position[1] - e.position[1]) < 0.05
          && [1, 2].some(j => { const q = edgeMid(o, j); return Math.hypot(q[0] - m[0], q[2] - m[2]) < 0.05; }));
        s.push({ factor: SUPPORT.roofLowEdge, candidates: near.map(o => o.id) });
      }
    } else if (info.category === 'roof') {
      const p = key(edgeMid(e, 0));
      s.push({ factor: SUPPORT.roofLowEdge, candidates: [...not(wallTop.get(p)), ...not(cellEdge.get(p))] });
    } else if (info.category === 'stairs') {
      s.push({ factor: SUPPORT.stairs, candidates: not(cellAt.get(key(e.position))) });
    }
    out.set(e.id, s);
  }
  return out;
}

/** Стабильность каждого блока (0..1). */
export function computeStability(resolved: Resolved): Map<string, number> {
  const supports = buildSupports(resolved);
  const ids = [...supports.keys()];
  // число блоков до земли: по нему на каждом сокете выбирается опора
  const dist = new Map<string, number>(ids.map(id => [id, supports.get(id) === null ? 1 : Infinity]));
  for (let changed = true, guard = 0; changed && guard < 1000; guard++) {
    changed = false;
    for (const id of ids) {
      const sup = supports.get(id);
      if (!sup) continue;
      let d = Infinity;
      for (const s of sup) for (const c of s.candidates) d = Math.min(d, dist.get(c)! + 1);
      if (d < dist.get(id)!) { dist.set(id, d); changed = true; }
    }
  }
  const pick = (s: Support, ignore: string, self: string) => {
    let best: string | null = null;
    for (const c of s.candidates) {
      if (c === ignore || c === self) continue;
      if (best === null || dist.get(c)! < dist.get(best)!) best = c;
    }
    return best;
  };
  const stab = new Map<string, number>(ids.map(id => [id, supports.get(id) === null ? 1 : 0]));
  // значение опоры x для блока ignore: пересчёт по кэшу без учёта ignore
  const supportValue = (x: string, ignore: string) => {
    const sup = supports.get(x);
    if (!sup) return 1;
    let v = 0;
    for (const s of sup) { const c = pick(s, ignore, x); if (c) v += stab.get(c)! * s.factor; }
    return Math.min(1, v);
  };
  for (let iter = 0; iter < 500; iter++) {
    let delta = 0;
    for (const id of ids) {
      const sup = supports.get(id);
      if (!sup) continue;
      let v = 0;
      for (const s of sup) { const c = pick(s, id, id); if (c) v += supportValue(c, id) * s.factor; }
      v = Math.min(1, v);
      delta = Math.max(delta, Math.abs(v - stab.get(id)!));
      stab.set(id, v);
    }
    if (delta < ACCURACY) break;
  }
  return stab;
}

/** Блоки, которые обрушатся: стабильность ниже порога. */
export function unstable(resolved: Resolved): string[] {
  return [...computeStability(resolved)].filter(([, v]) => v < COLLAPSE).map(([id]) => id);
}
