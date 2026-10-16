---
id: window-bars
title: Решётки, амбразуры и ставни
kind: object
group: Двери и замки
summary: Вставки в оконный проём — решётки и стёкла (SimpleBuildingBlock), амбразуры (StabilityEntity) и ставни (Door); HP от 200 до 500, отдельных классов в коде нет, различия — в префабах.
related: [wall, door, doors, upkeep, decay, protection, construction-placement, data-entity-health, data-protection, data-crafting]
code: [SimpleBuildingBlock.cs, Door.cs, StabilityEntity.cs, SimpleUpgrade.cs, BaseMelee.cs]
---

## Кратко

Деревянные и металлические решётки, укреплённые стёкла, металлические амбразуры и
деревянные ставни ставятся в сокеты оконного проёма `wall.window`. В серверном коде нет классов
с их именами: это префабы общих классов, и всё, что их отличает, лежит в префабах.

У оконного проёма два вида «мам»: `Window` (×2) — решётки и стёкла, `Shutters` (×2) — ставни
и амбразуры. Поэтому в один проём можно поставить одновременно решётку и ставни.

## Характеристики

Из префабов (`startHealth`, `baseProtection`, `BuildingGradeDecay.decayGrade`) и рецептов
([[data-crafting]]):

| Вставка | Префаб | Класс | Сокет | HP | Защита | Рецепт | Распад как грейд |
|---|---|---|---|---|---|---|---|
| Деревянные решётки | `wall.window.bars.wood` | `SimpleBuildingBlock` | `Window` | 250 | `BlockWood` | 50 Wood | Wood |
| Металлические решётки | `wall.window.bars.metal` | `SimpleBuildingBlock` | `Window` | 500 | `BlockMetal` | 25 Metal Fragments | Metal |
| Укреплённое стекло (Strengthened Glass Window) | `wall.window.glass.reinforced` | `SimpleBuildingBlock` | `Window` | 350 | `BlockMetal` | 50 Metal Fragments | TopTier |
| Бронестекло (Reinforced Glass Window) | `wall.window.bars.toptier` | `SimpleBuildingBlock` | `Window` | 500 | `BlockMetal` | 4 HQM | TopTier |
| Амбразура горизонтальная | `shutter.metal.embrasure.a` | `StabilityEntity` | `Shutters` | 500 | `DeployableMetal` | 100 Metal Fragments | Metal |
| Амбразура вертикальная | `shutter.metal.embrasure.b` | `StabilityEntity` | `Shutters` | 500 | `DeployableMetal` | 100 Metal Fragments | Metal |
| Деревянные ставни | `shutter.wood.a` | `Door` | `Shutters` | 200 | `DeployableWood` | 200 Wood | Wood |

Проценты защиты — [[data-protection]]. У всех семи есть атрибут `Upkeep` (множитель 1):
содержание считается по рецепту, только ресурсы ([[upkeep]]). Например, укреплённое стекло
в базе до 15 блоков стоит 50 × 0,1 = 5 фрагментов в сутки — это совпадает с данными калькулятора.

## Поведение

- **Решётки и стёкла** — `SimpleBuildingBlock`. На каждой висит `DirectionProperties` с
  `BuildingShell`, как на стене ([[wall]]). Список `UpgradeItems` у всех четырёх пуст: апгрейда нет.
  Повернуть после постановки нельзя (`canRotateAfterPlacement = 0`).
- **Ставни** — `Door`: открываются и закрываются, флаг `Open`, анимация 1,33 / 1,3 с. Слота замка
  нет (`canTakeLock = 0`), окошка и молотка тоже. На левой створке два сокета под контроллер
  двери (`doorcontroller01/02`). Подбор требует права строить и молотка в руках. Всё остальное —
  как в [[doors]].
- **Амбразуры** — простой `StabilityEntity` без собственной логики: стоят, держат урон, гниют
  и платят содержание. Ставни и амбразуры можно развернуть на 180° (`rotationAmount` в префабе).
- **Содержание.** Любая вещь, привязанная к зданию, платит содержание по рецепту:
  только ингредиенты категории «Ресурсы», умноженные на ставку здания ([[upkeep]]).

## Нюансы

- **Ближний бой.** Решётки, стёкла и ставни (`SimpleBuildingBlock` и `Door`) оружие ближнего
  боя бьёт обычным профилем урона, а не `deployableDamageOverrides` (`BaseMelee.GetAttackStats`).
  Амбразура — `StabilityEntity`, то есть `DecayEntity` вне этих исключений: по ней оружие
  ближнего боя бьёт профилем `deployableDamageOverrides`, если он у оружия задан.
- **Укреплённое стекло гниёт как МВК** (`decayGrade` = TopTier, 12 ч), хотя сделано из фрагментов.
- **Перекраска.** У `SimpleBuildingBlock` смену скина блокируют посторонние объекты в объёме
  вставки (`CanBeRedirectSwapped`).

## Где в коде

- `SimpleBuildingBlock`, `SimpleUpgrade` — решётки и стёкла.
- `Door` — ставни.
- `StabilityEntity` — амбразуры.
- `BaseMelee.GetAttackStats` — какие сущности бьются профилем «по деплойаблам».
