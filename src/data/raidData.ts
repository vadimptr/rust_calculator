import type {
  ExplosiveCost,
  ExplosiveType,
  RaidCostRule,
  RaidMethod,
  Tier,
} from '../types/index.ts';

/**
 * Стоимость крафта одной единицы каждой взрывчатки в сырых ресурсах.
 * Для explosiveAmmo — за 1 патрон.
 */
export const EXPLOSIVE_COSTS: Record<ExplosiveType, ExplosiveCost> = {
  satchel: { sulfur: 480, charcoal: 720, metalFragments: 80, cloth: 10, rope: 1 },
  rocket: { sulfur: 1400, charcoal: 1950, metalFragments: 100, lowGradeFuel: 30, pipes: 2 },
  c4: { sulfur: 2200, charcoal: 3000, metalFragments: 200, cloth: 5, techTrash: 2 },
  explosiveAmmo: { sulfur: 25, charcoal: 30, metalFragments: 10 },
};

/**
 * Правила рейда по тирам. Количество взрывчатки — на ОДИН блок данного тира.
 * Все building-блоки одного тира (фундамент, стена, крыша…) рейдятся одинаково.
 * `optimal` подобран под минимум серы; задаётся здесь, а не в UI.
 */
export const RAID_RULES: Record<Tier, RaidCostRule> = {
  wood: {
    blockId: 'wood',
    blockName: 'Дерево',
    satchel: 3,
    rocket: 2,
    c4: 1,
    explosiveAmmo: 49,
    optimal: { explosiveAmmo: 49 },
  },
  stone: {
    blockId: 'stone',
    blockName: 'Камень',
    satchel: 10,
    rocket: 4,
    c4: 2,
    explosiveAmmo: 185,
    optimal: { c4: 2 },
  },
  metal: {
    blockId: 'metal',
    blockName: 'Металл',
    satchel: 23,
    rocket: 8,
    c4: 4,
    explosiveAmmo: 400,
    optimal: { c4: 4 },
  },
  armored: {
    blockId: 'armored',
    blockName: 'МВК',
    satchel: 46,
    rocket: 15,
    c4: 8,
    explosiveAmmo: 799,
    optimal: { c4: 8 },
  },
};

export const DEFAULT_TIER: Tier = 'stone';

export const TIER_ORDER: Tier[] = ['wood', 'stone', 'metal', 'armored'];

export const TIER_LABELS: Record<Tier, string> = {
  wood: 'Дерево',
  stone: 'Камень',
  metal: 'Металл',
  armored: 'МВК',
};

export const RAID_METHOD_ORDER: RaidMethod[] = [
  'satchel',
  'rocket',
  'c4',
  'explosiveAmmo',
  'optimal',
];

export const RAID_METHOD_LABELS: Record<RaidMethod, string> = {
  satchel: 'Только сачели',
  rocket: 'Только ракеты',
  c4: 'Только C4',
  explosiveAmmo: 'Только explosive ammo',
  optimal: 'Оптимальный рейд',
};

/** Короткие имена взрывчатки для колонки «Чем рейдим». */
export const EXPLOSIVE_SHORT_LABELS: Record<ExplosiveType, string> = {
  satchel: 'Сачель',
  rocket: 'Ракета',
  c4: 'C4',
  explosiveAmmo: 'Ammo',
};
