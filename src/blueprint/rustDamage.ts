/**
 * Урон по строениям как в игре (docs/research/rust-damage-mechanics.md). Числа — из ассетов и
 * префабов клиента (2026-09): здоровье и защита грейдов (BuildingGrade, ProtectionProperties),
 * двери и вставки в окна (startHealth, baseProtection), взрывчатка (TimedExplosive.damageTypes,
 * minExplosionRadius, explosionRadius, onlyDamageParent; разрывной патрон — Projectile.damageTypes
 * и ItemModProjectileRadialDamage).
 *
 * Конвейер урона игры: для каждого типа dmg_i × (1 − clamp(protection_i, −1, 1)), затем, если блок
 * с DirectionProperties и попадание не со слабой стороны, × (1 − shell_i) (ассет BuildingShell);
 * суммируется, округления нет. У сплеша множитель k = 1 − clamp01((d − rmin)/(r − rmin)), d — до
 * ближайшей точки коробки (bounds) цели.
 */
import type { DeployableKind, Grade } from './types.ts';
import type { ExplosiveType } from '../types/index.ts';

export type Explosive = ExplosiveType;

/** Типы урона, которые встречаются у взрывчатки и пуль (индексы Rust.DamageType). */
export type DamageKind = 'Bullet' | 'Blunt' | 'Stab' | 'Explosion' | 'Heat';
export type DamageList = Partial<Record<DamageKind, number>>;

/** Защита по типам: доля урона, которую гасит защита (−1 — урон вдвое). */
type Protection = Record<DamageKind, number>;

/** Ассеты защиты грейдов: blocktwig, blockwood, blockstone, blockmetal (у МВК тот же blockmetal). */
const BLOCK_PROTECTION: Record<Grade, Protection> = {
  twig: { Bullet: 0.8, Blunt: 0.8, Stab: 0.8, Explosion: 0, Heat: 0.5 },
  wood: { Bullet: 0.97, Blunt: 0.98, Stab: 0.9, Explosion: 0.1, Heat: 0.9 },
  stone: { Bullet: 0.99, Blunt: 0.98, Stab: 0.95, Explosion: 0.5, Heat: 1 },
  metal: { Bullet: 1, Blunt: 0.99, Stab: 0.98, Explosion: 0.5, Heat: 1 },
  armored: { Bullet: 1, Blunt: 0.99, Stab: 0.98, Explosion: 0.5, Heat: 1 },
};

/** BuildingGrade.baseHealth (healthMultiplier у всех форм = 1). */
export const GRADE_HP: Record<Grade, number> = { twig: 10, wood: 250, stone: 500, metal: 1000, armored: 2000 };

/** BuildingShell — защита «твёрдой стороны» (DirectionProperties.extraProtection) стен, полов, фундаментов, крыш. */
const SHELL: Protection = { Bullet: 0.5, Blunt: 0.9, Stab: 0.9, Explosion: 0, Heat: 0 };

const WOOD_DOOR: Protection = { Bullet: 0.95, Blunt: 0.95, Stab: 0.95, Explosion: -1, Heat: 0.8 };
const METAL_DOOR: Protection = { Bullet: 1, Blunt: 0.95, Stab: 1, Explosion: 0.2, Heat: 1 };

/** Двери и вставки: startHealth и baseProtection префабов. */
export const DEPLOYABLE_STATS: Partial<Record<DeployableKind, { hp: number; protection: Protection }>> = {
  'wooden-door': { hp: 200, protection: WOOD_DOOR },
  'wooden-double-door': { hp: 200, protection: WOOD_DOOR },
  'sheet-metal-door': { hp: 250, protection: METAL_DOOR },
  'sheet-metal-double-door': { hp: 250, protection: METAL_DOOR },
  'garage-door': { hp: 600, protection: METAL_DOOR },
  'armored-door': { hp: 1000, protection: METAL_DOOR },
  'armored-double-door': { hp: 1000, protection: METAL_DOOR },
  // wall.window.glass.reinforced, wall.window.bars.toptier, wall.window.bars.metal — защита blockmetal
  'strengthened-glass-window': { hp: 350, protection: BLOCK_PROTECTION.metal },
  'reinforced-glass-window': { hp: 500, protection: BLOCK_PROTECTION.metal },
  'metal-window-bars': { hp: 500, protection: BLOCK_PROTECTION.metal },
  'metal-embrasure': { hp: 500, protection: { Bullet: 0.99, Blunt: 0.99, Stab: 0.99, Explosion: 0.5, Heat: 0.95 } },
};

export interface ExplosiveData {
  label: string;
  sulfur: number;
  /** Урон заряда (TimedExplosive.damageTypes). */
  damage: DamageList;
  /** Полный урон до rmin, линейное падение до r. */
  rmin: number;
  r: number;
  /** Посаженный вплотную заряд (onlyDamageParent): весь урон блоку, на котором он висит, без сплеша по строениям. */
  contact: boolean;
  /** Разрывной патрон: прямой урон пули по блоку, в который она попала (вдобавок к радиальному). */
  direct?: DamageList;
  /** Центр взрыва ракеты — центр её коробки: на 0.1 м перед поверхностью плюс 0.29 м до центра. */
  standoff: number;
  /** Видимость целей проверяется из точки, отнесённой от центра к стрелку (у разрывного патрона 0.1 м). */
  visOffset: number;
}

/** Числа префабов rocket_basic, explosive.timed.deployed, explosive.satchel.deployed, ammo_rifle_explosive. */
export const EXPLOSIVE_DATA: Record<Explosive, ExplosiveData> = {
  rocket: { label: 'Ракета', sulfur: 1400, damage: { Explosion: 275, Blunt: 75 }, rmin: 1, r: 3.8, contact: false, standoff: 0.39, visOffset: 0 },
  c4: { label: 'C4', sulfur: 2200, damage: { Explosion: 550 }, rmin: 0, r: 4, contact: true, standoff: 0, visOffset: 0 },
  satchel: { label: 'Сачель', sulfur: 480, damage: { Explosion: 75, Blunt: 200, Stab: 200 }, rmin: 0, r: 4, contact: true, standoff: 0, visOffset: 0 },
  // ItemModProjectileRadialDamage: Explosion 5, радиус 1.5, падение 1 − d/r от точки попадания,
  // задетый пулей блок не исключается; видимость — из точки на 0.1 м ближе к стрелку
  explosiveAmmo: { label: 'Разрывной патрон', sulfur: 25, damage: { Explosion: 5 }, rmin: 0, r: 1.5, contact: false, direct: { Bullet: 50, Explosion: 0.01 }, standoff: 0, visOffset: 0.1 },
};

/** Цель урона: здоровье, защита и есть ли у неё «твёрдая сторона». */
export interface DamageProfile { hp: number; protection: Protection; shell: boolean }

export function blockProfile(grade: Grade): DamageProfile {
  return { hp: GRADE_HP[grade], protection: BLOCK_PROTECTION[grade], shell: true };
}

export function deployableProfile(kind: DeployableKind): DamageProfile | null {
  const s = DEPLOYABLE_STATS[kind];
  return s ? { hp: s.hp, protection: s.protection, shell: false } : null;
}

/** Урон списка по цели после защиты (и твёрдой стороны, если shell). */
export function applyProtection(list: DamageList, p: DamageProfile, shell: boolean): number {
  let total = 0;
  for (const [k, amount] of Object.entries(list) as [DamageKind, number][]) {
    let dmg = amount * (1 - Math.max(-1, Math.min(1, p.protection[k] ?? 0)));
    if (shell && p.shell) dmg *= 1 - SHELL[k];
    total += dmg;
  }
  return total;
}

/**
 * Урон одной единицы взрывчатки по цели при k = 1: hit — по блоку, в который попали (посадили),
 * splash — по остальным в радиусе (у посаженного заряда сплеша по строениям нет).
 */
export function unitHits(ex: Explosive, p: DamageProfile): { hit: number; splash: number } {
  const d = EXPLOSIVE_DATA[ex];
  if (d.contact) return { hit: applyProtection(d.damage, p, false), splash: 0 };
  const splash = applyProtection(d.damage, p, true);
  return { hit: splash + (d.direct ? applyProtection(d.direct, p, true) : 0), splash };
}

/** Множитель сплеша по расстоянию до ближайшей точки коробки. */
export function falloffK(ex: Explosive, d: number): number {
  const { rmin, r } = EXPLOSIVE_DATA[ex];
  if (r <= rmin) return d <= r ? 1 : 0;
  return 1 - Math.max(0, Math.min(1, (d - rmin) / (r - rmin)));
}

/** Сколько единиц нужно на цель при прямом попадании. */
export function unitsToKill(ex: Explosive, p: DamageProfile): number {
  const h = unitHits(ex, p).hit;
  return h > 0 ? Math.ceil(p.hp / h - 1e-9) : Infinity;
}
