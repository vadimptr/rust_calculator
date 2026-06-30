import type {
  ExplosiveCost,
  ExplosiveType,
  RaidMethod,
  RaidRow,
  RaidSelection,
  Tier,
} from '../types/index.ts';
import {
  EXPLOSIVE_COSTS,
  RAID_METHOD_LABELS,
  RAID_METHOD_ORDER,
  RAID_RULES,
} from '../data/raidData.ts';

/** Все ресурсные поля ExplosiveCost в порядке отображения. */
export const RESOURCE_KEYS: (keyof ExplosiveCost)[] = [
  'sulfur',
  'charcoal',
  'metalFragments',
  'cloth',
  'pipes',
  'rope',
  'techTrash',
  'lowGradeFuel',
  'explosives',
];

function emptyResources(): ExplosiveCost {
  return {
    sulfur: 0,
    charcoal: 0,
    metalFragments: 0,
    cloth: 0,
    pipes: 0,
    rope: 0,
    techTrash: 0,
    lowGradeFuel: 0,
    explosives: 0,
  };
}

/** Прибавить к acc стоимость `count` единиц взрывчатки `explosive`. */
function addExplosiveCost(acc: ExplosiveCost, explosive: ExplosiveType, count: number): void {
  const cost = EXPLOSIVE_COSTS[explosive];
  for (const key of RESOURCE_KEYS) {
    acc[key] = (acc[key] ?? 0) + (cost[key] ?? 0) * count;
  }
}

/** Свернуть выбор в количество блоков по тирам. */
function aggregateByTier(selections: RaidSelection[]): Map<Tier, number> {
  const byTier = new Map<Tier, number>();
  for (const sel of selections) {
    if (sel.quantity > 0) {
      byTier.set(sel.tier, (byTier.get(sel.tier) ?? 0) + sel.quantity);
    }
  }
  return byTier;
}

/** Строка для простого метода (один тип взрывчатки). */
function buildSimpleRow(method: ExplosiveType, byTier: Map<Tier, number>): RaidRow {
  const resources = emptyResources();
  let totalCount = 0;
  let supported = true;

  for (const [tier, qty] of byTier) {
    const per = RAID_RULES[tier][method];
    if (per == null) {
      supported = false;
      break;
    }
    const count = per * qty;
    totalCount += count;
    addExplosiveCost(resources, method, count);
  }

  return {
    method,
    label: RAID_METHOD_LABELS[method],
    supported,
    breakdown: supported ? [{ explosive: method, count: totalCount }] : [],
    resources: supported ? resources : emptyResources(),
  };
}

/** Строка оптимального рейда (комбинация из конфига, возможно mixed). */
function buildOptimalRow(byTier: Map<Tier, number>): RaidRow {
  const resources = emptyResources();
  const counts = new Map<ExplosiveType, number>();
  let supported = true;

  for (const [tier, qty] of byTier) {
    const optimal = RAID_RULES[tier].optimal;
    if (!optimal) {
      supported = false;
      break;
    }
    for (const explosive of Object.keys(optimal) as ExplosiveType[]) {
      const per = optimal[explosive];
      if (per == null) continue;
      const count = per * qty;
      counts.set(explosive, (counts.get(explosive) ?? 0) + count);
      addExplosiveCost(resources, explosive, count);
    }
  }

  return {
    method: 'optimal',
    label: RAID_METHOD_LABELS.optimal,
    supported,
    breakdown: supported
      ? [...counts.entries()].map(([explosive, count]) => ({ explosive, count }))
      : [],
    resources: supported ? resources : emptyResources(),
  };
}

/**
 * Рассчитать стоимость рейда по выбранным блокам.
 * Возвращает массив строк (по одной на каждый RaidMethod) либо [] если нет блоков.
 */
export function calculateRaidCost(selections: RaidSelection[]): RaidRow[] {
  const byTier = aggregateByTier(selections);

  let totalBlocks = 0;
  for (const qty of byTier.values()) totalBlocks += qty;
  if (totalBlocks === 0) return [];

  return RAID_METHOD_ORDER.map((method: RaidMethod) =>
    method === 'optimal' ? buildOptimalRow(byTier) : buildSimpleRow(method, byTier),
  );
}
