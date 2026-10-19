---
id: workbench
title: Верстак
kind: object
group: Предметы и производство
icon: workbench2
summary: Верстак 1–3 уровня задаёт уровень крафта в своей зоне, открывает дерево технологий и принимает апгрейды (у строимых верстаков 10 слотов — хватает на все 10 видов) — скорость, дальность, бонусные предметы, прочность и скидки.
related: [crafting, research, item-condition, building-privilege, tool-cupboard, temperature-comfort, data-entity-health, data-crafting]
code: [Workbench.cs, TriggerWorkbench.cs, ItemModWorkbenchUpgrade.cs, ItemModWorkbenchAccelerated.cs, ItemModWorkbenchCraftSpeed.cs, ItemModWorkbenchEfficiency.cs, ItemModWorkbenchRecycleBin.cs, ItemModWorkbenchSurplus.cs, ItemModWorkbenchDefensive.cs, ItemModWorkbenchReinforced.cs, ItemModWorkbenchRange.cs, ItemModWorkbenchComfort.cs, ItemModWorkbenchSalvage.cs, ItemModWorkbenchPrototype.cs, ConVar/Workbench.cs]
---

## Кратко

Верстак — контейнер с невидимой зоной `TriggerWorkbench`. Пока игрок стоит в зоне и видит
верстак, его уровень крафта равен уровню верстака (`Workbenchlevel`, 1–3). Это открывает
рецепты своего уровня и ускоряет крафт рецептов ниже уровнем ([[crafting]]). Через верстак
открывается дерево технологий ([[research]]).

Новое в этой версии — **апгрейды верстака**: отдельные предметы, которые вставляются
в слоты верстака и меняют крафт, дерево технологий и сам верстак.

## Характеристики

| Параметр | Значение | Где |
|----------|----------|-----|
| Уровень | 1, 2 или 3 | `Workbench.Workbenchlevel` (префабы `workbench1/2/3.deployed`) |
| Инженерный верстак | `io.table.deployed`: `isIOBench`, уровень 1, своё дерево `TechTreeIO` | префаб |
| Слоты инвентаря | 0 — чертёж, 1 — эксперимент, 2…(2+N−1) — апгрейды | `blueprintSlot`, `experimentSlot`, `firstUpgradeSlot` |
| Слотов апгрейдов | 10 у строимых верстаков и инженерного, 4 у статичных (по умолчанию 4) | `Workbench.upgradeSlotCount` |
| Размер зоны крафта | в префабе (коллайдер `TriggerWorkbench`, размер неизвестен) | — |
| HP | верстак 1 — 500, верстак 2 — 500, верстак 3 — 750, инженерный — 500; апгрейд «Reinforced» добавляет | `startHealth`, `RefreshReinforcedHealth` |
| Защита | верстак 1 и инженерный — `DeployableWood`, верстаки 2 и 3 — `DeployableMetal` | `baseProtection`, см. [[data-protection]] |
| Деревья технологий | верстак 1 — `TechTreeT0`, верстак 2 — ещё `TechTreeT2`, верстак 3 — ещё `TechTreeT3` (плюс варианты `_Primitive`/`_Hardcore` для режимов) | `techTrees` |

Статичные верстаки на монументах и в квартирах (`workbench1.static`, `workbench2.static`)
бессмертны (защита `Immortal`) и апгрейдов не принимают (`Static`).

### Апгрейды

Значения — из префабов апгрейдов (`assets/prefabs/deployable/workbench upgrades/workbench.upgrade.*.item.prefab`).
У всех `minimumWorkbenchLevel` = 0, то есть любой апгрейд ставится на верстак любого уровня.

| Апгрейд (префаб) | Класс | Эффект | Значение в префабе |
|------------------|-------|--------|--------------------|
| `accelerated` | `ItemModWorkbenchAccelerated` | В пачке из 2+ единиц каждая следующая быстрее: `clamp(1 − 0,25 × уже_сделано, 0,25, 1)` | `speedBonusPerItem` 0,25, `maxSpeedMultiplier` 0,25: 1 → 0,75 → 0,5 → 0,25 |
| `efficiency` | `ItemModWorkbenchEfficiency` | Шанс получить бесплатную копию каждой единицы, только в пачке из 2+ | 10 %; не действует на ракеты, C4, взрывчатку, сачели, порох, бобовые гранаты, разрывные патроны и разрывные снаряды катапульты (`ExcludedItems`) |
| `recyclebin` | `ItemModWorkbenchRecycleBin` | После каждой единицы возвращает случайно 0…10 % каждого ингредиента в отдельный контейнер-«корзину» апгрейда | `maxRefundFraction` 0,1 |
| `surplus` | `ItemModWorkbenchSurplus` | Шанс получить дополнительные предметы из списка `surplusItems` рецепта | в рецепте |
| `defensive` | `ItemModWorkbenchDefensive` | +1 слот для бронепластин у скрафченной брони | `bonusSlots` 1 |
| `reinforced` | `ItemModWorkbenchReinforced` | +HP верстака и −доля урона от взрывов | +500 HP (верстаки 1, 2, инженерный), +750 HP (верстак 3); `explosiveResistance` **0,2** (по умолчанию 0,5) |
| `range` | `ItemModWorkbenchRange` | Увеличивает зону крафта | ×2 |
| `comfort` | `ItemModWorkbenchComfort` | Включает триггер комфорта с минимальным уровнем | `comfortLevel` 1 (100 %) |
| `salvage` | `ItemModWorkbenchSalvage` | Скидка в дереве технологий | `costReduction` 0,2 (−20 %) |
| `prototype` | `ItemModWorkbenchPrototype` | Открыть узел дерева без пути: цена ×, шанс провала | `costMultiplier` 2, `failChance` **0,25** (по умолчанию 0,1) |

Есть ещё класс `ItemModWorkbenchCraftSpeed` (время крафта ×0,75 по умолчанию), но ни
один предмет его не использует: апгрейда «просто быстрее» в игре нет.

## Поведение

- **Уровень крафта игрока** (`BasePlayer.currentCraftLevel`) — максимум по всем верстакам,
  в чьих зонах игрок стоит и которые видны из его глаз. При равенстве выигрывает верстак
  с большим числом апгрейдов — его апгрейды и применятся к крафту.
- **Множители скорости** всех апгрейдов перемножаются (`GetCraftSpeedMultiplier`) и
  умножают время после бонуса за уровень. Например, верстак 3, рецепт уровня 1 и четвёртая
  единица серии с Accelerated: `×0,25 × 0,25 ≈ ×0,06`.
- **Установка апгрейда** (`ItemFilter`, `ItemModWorkbenchUpgrade.CanInstallInWorkbench`):
  - только в слоты апгрейдов; у статичных верстаков (`Static`, на монументах) — никогда;
  - уровень верстака не ниже `minimumWorkbenchLevel` апгрейда;
  - **два одинаковых апгрейда на один верстак нельзя**;
  - у апгрейда может быть зона-габарит: если в ней стоит деплой, установка запрещена
    (отключается `workbench.skipclearancechecks`), а после установки в этой зоне нельзя строить.
- **Панель апгрейдов** открывается только при праве строительства (`player.CanBuild()`),
  см. [[building-privilege]].
- **Корзина апгрейда RecycleBin** — свой контейнер внутри предмета-апгрейда. Пока в ней
  что-то лежит, апгрейд нельзя вынуть.
- **Промышленный крафтер** на верстаке использует его апгрейды скорости и бонусов, но не
  бонус уровня верстака.
- **Подобрать** верстак нельзя, пока на нём есть дочерние объекты (`CanCompletePickup`).

## Нюансы

- **Зона дальности растёт в одну сторону.** `RefreshCraftRange` умножает размер коллайдера
  по локальной оси Z и сдвигает центр на половину прироста. Зона удлиняется вперёд по
  оси верстака, а не во все стороны. Зона комфорта, наоборот, растёт по радиусу
  (`workbench.comfortradiusscale` = 0,95 от множителя дальности).
- **Бонусы только в сериях.** Efficiency и Accelerated ничего не дают при крафте по одной
  штуке: у них проверка `amount + numCrafted > 1`. Ставьте в очередь пачки.
- **Efficiency копирует результат целиком.** Бесплатная копия — это `amountToCreate`
  штук со скином, то есть для патронов это целая порция.
- **Бонусы привязаны к верстаку на старте единицы.** Верстак запоминается в задании
  в момент старта единицы. Если вы отошли, следующая единица уже без апгрейдов.
- **Reinforced спасает от взрывчатки.** `ScaleDamage` умножает урон типа `Explosion` на
  `1 − explosiveResistance`. В префабе апгрейда `explosiveResistance` = 0,2, так что верстак
  получает 80 % урона от C4 и ракет (по умолчанию было бы 50 %). Главная польза —
  прибавка HP.
- **Скидки дерева технологий считаются от верстака, у которого вы стоите**, а не от лучшего
  верстака в базе.

## На практике

- Самая полезная связка для фарма компонентов и патронов — Accelerated + Efficiency (+ RecycleBin)
  на одном верстаке и длинные очереди. Слотов хватает на все апгрейды сразу. Для взрывчатки
  Efficiency бесполезен: она в списке исключений.
- Верстак в сердце базы с Reinforced переживает лишние взрывы — его сложнее «снять» рейдом
  ради лишения уровня крафта.
- Апгрейды недоступны на верстаках монументов: на базе их нужно ставить на собственный
  верстак.
