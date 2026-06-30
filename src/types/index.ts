export interface Resources {
  straw: number;
  wood: number;
  stone: number;
  metal: number;
  hqm: number;
}

export interface BuildingBlock {
  id: string;
  name: string;
  category: 'foundation' | 'floor' | 'wall' | 'opening' | 'roof' | 'stairs' | 'window';
  buildCost: Resources;
  upkeepCost: Resources;
}

export type Quantities = Record<string, number>;

/* =========================================================
   Raid cost
   ========================================================= */

export type Tier = 'wood' | 'stone' | 'metal' | 'armored';

export type ExplosiveType = 'satchel' | 'rocket' | 'c4' | 'explosiveAmmo';

export type RaidMethod = ExplosiveType | 'optimal';

/** Стоимость крафта одной единицы взрывчатки (в сырых ресурсах). */
export interface ExplosiveCost {
  sulfur: number;
  charcoal?: number;
  metalFragments?: number;
  lowGradeFuel?: number;
  cloth?: number;
  rope?: number;
  pipes?: number;
  techTrash?: number;
  explosives?: number;
}

/**
 * Правило рейда для одного building tier.
 * Числа — сколько единиц взрывчатки нужно, чтобы уничтожить ОДИН блок этого тира.
 */
export interface RaidCostRule {
  blockId: string;   // = id тира ('wood' | 'stone' | 'metal' | 'armored')
  blockName: string; // отображаемое имя тира
  satchel?: number;
  rocket?: number;
  c4?: number;
  explosiveAmmo?: number;
  /** Оптимальная (по сере) комбинация на один блок; поддерживает mixed. */
  optimal?: Partial<Record<ExplosiveType, number>>;
}

/** Вход для calculateRaidCost: тир и количество блоков этого тира. */
export interface RaidSelection {
  tier: Tier;
  quantity: number;
}

/** Готовая строка таблицы рейда. */
export interface RaidRow {
  method: RaidMethod;
  label: string;
  /** false, если метод не задан хотя бы для одного выбранного тира. */
  supported: boolean;
  /** Раскладка по взрывчатке (для optimal может быть несколько позиций). */
  breakdown: { explosive: ExplosiveType; count: number }[];
  /** Суммарные ресурсы строки. */
  resources: ExplosiveCost;
}
