/**
 * Стоимость постройки и содержание (upkeep) как в игре — docs/research/rust-building-mechanics.md §9.
 * Цена блока = baseCost грейда × costMultiplier формы (ассеты BuildingGrade и префабы клиента
 * 2026-09). Ветки стоят дерево. Содержание за сутки = Σ цена × ставка, где ставка — средняя по
 * «брекетам» от числа блоков здания: первые 15 по 10 %, следующие 50 по 15 %, следующие 125 по 20 %,
 * остальные по 33.3 % (для одного игрока; групповой множитель не учитывается). Двери и вставки
 * считаются как блоки по своей цене крафта (только ресурсы, без шестерёнок); шкаф и дроп-бокс — нет.
 */
import type { DeployableKind, ElementKind, Grade, Resolved } from './types.ts';

export type ResourceKey = 'wood' | 'stone' | 'metal' | 'hqm';
export type Res = Record<ResourceKey, number>;

export const RESOURCE_KEYS: ResourceKey[] = ['wood', 'stone', 'metal', 'hqm'];

/** BuildingGrade.baseCost: ресурс и количество за полный блок. */
const GRADE_COST: Record<Grade, [ResourceKey, number]> = {
  twig: ['wood', 50], wood: ['wood', 200], stone: ['stone', 300], metal: ['metal', 200], armored: ['hqm', 25],
};

/** Construction.costMultiplier форм. */
export const COST_MULTIPLIER: Record<ElementKind, number> = {
  'square-foundation': 1, 'triangle-foundation': 0.5, 'foundation-steps': 0.5, 'ramp': 0.5,
  'wall': 1, 'half-wall': 1, 'low-wall': 0.5, 'doorway': 0.7, 'window-frame': 0.7, 'wall-frame': 0.5,
  'square-floor': 0.5, 'triangle-floor': 0.25, 'floor-frame': 0.5, 'triangle-floor-frame': 0.25,
  'stairs-l-shape': 1, 'u-shaped-stairs': 1, 'spiral-stairs': 1, 'spiral-stairs-triangle': 1,
  'roof': 0.5, 'roof-triangle': 0.5,
};

/** Цена крафта объектов (только ресурсы). */
const DEPLOYABLE_COST: Partial<Record<DeployableKind, Partial<Res>>> = {
  'wooden-door': { wood: 300 }, 'wooden-double-door': { wood: 350 },
  'sheet-metal-door': { metal: 150 }, 'sheet-metal-double-door': { metal: 200 },
  'garage-door': { metal: 300 },
  'armored-door': { hqm: 20 }, 'armored-double-door': { hqm: 30 },
  'strengthened-glass-window': { metal: 50 }, 'reinforced-glass-window': { hqm: 4 }, 'metal-window-bars': { metal: 25 }, 'metal-embrasure': { metal: 100 },
};
/** Объекты вне содержания, но со стоимостью постройки. */
const BUILD_ONLY: Partial<Record<DeployableKind, Partial<Res>>> = {
  'tool-cupboard': { wood: 1000 }, 'drop-box': { metal: 100 },
};

export const zeroRes = (): Res => ({ wood: 0, stone: 0, metal: 0, hqm: 0 });

export function blockCost(kind: ElementKind, grade: Grade): Res {
  const r = zeroRes();
  const [res, amount] = GRADE_COST[grade];
  r[res] = Math.round(amount * COST_MULTIPLIER[kind]);
  return r;
}

/** Ставка содержания по числу блоков: средневзвешенная по брекетам. */
export function upkeepRate(n: number): number {
  if (n <= 0) return 0.1;
  const brackets: [number, number][] = [[15, 0.1], [50, 0.15], [125, 0.2], [Infinity, 0.333]];
  let left = n, sum = 0;
  for (const [size, rate] of brackets) {
    const take = Math.min(left, size);
    sum += take * rate;
    left -= take;
    if (left <= 0) break;
  }
  return sum / n;
}

export interface CostSummary {
  build: Res;
  /** Содержание за сутки. */
  upkeep: Res;
  /** Сколько сущностей платит содержание и средняя ставка. */
  count: number;
  rate: number;
}

const add = (a: Res, b: Partial<Res>, k = 1) => { for (const key of RESOURCE_KEYS) a[key] += (b[key] ?? 0) * k; };

export function costOf(resolved: Resolved): CostSummary {
  const build = zeroRes();
  const taxed = zeroRes();
  let count = 0;
  for (const e of resolved.elements) {
    const c = blockCost(e.kind, e.grade);
    add(build, c); add(taxed, c); count++;
  }
  for (const d of resolved.deployables) {
    const c = DEPLOYABLE_COST[d.kind];
    if (c) { add(build, c); add(taxed, c); count++; continue; }
    const b = BUILD_ONLY[d.kind];
    if (b) add(build, b);
  }
  const rate = upkeepRate(count);
  const upkeep = zeroRes();
  add(upkeep, taxed, rate);
  return { build, upkeep, count, rate };
}
