---
id: foundation
title: Фундамент
kind: object
group: Строительство
icon: build/foundation
summary: Основание постройки — квадратный, треугольный фундамент и ступени; ставится на землю, держит всё здание, гниёт даже без содержания и привлекает крокодилов, пока соломенный.
related: [construction-placement, building-grades, building-blocked, stability, conditional-models, building-structure, upkeep, decay, wall, floor, stairs, ramp, data-building-blocks, data-protection]
code: [BuildingBlock.cs, StabilityEntity.cs, BuildingBlockDecay.cs, SocketMod_TerrainCheck.cs, ModelConditionTest_FoundationSide.cs, ModelConditionTest_FoundationCornerLeft.cs, BuildingProximity.cs, State_CrocBreakFoundation.cs]
---

## Кратко

Фундамент — единственный блок, который ставится прямо на землю. От него считается
[[stability|стабильность]] всего здания. В коде у фундамента нет своего класса: это обычный
`BuildingBlock`, а всё особенное — сокеты, проверки земли, флаг опоры — задано в префабе.
Код узнаёт фундамент по имени префаба.

## Характеристики

| Вид | Префаб | Примечание |
|---|---|---|
| Квадратный | `foundation` | 4 верхних сокета `foundation-top/1..4`, угловые сокеты `corner/1-l … 4-r` |
| Треугольный | `foundation.triangle` | 3 верхних сокета `foundation-top/1..3`, угловые `corner/1-l … 3-r` |
| Ступени | `foundation.steps` | Пристраиваются к краю фундамента (сокет `Ramp`) |

**HP и цена** — `baseHealth` и `baseCost` грейда × `healthMultiplier` / `costMultiplier` префаба,
см. [[building-grades]] и [[data-building-blocks]]. Значения из ассетов:

| | `healthMultiplier` | `costMultiplier` | HP: солома / дерево / камень / металл / МВК | Цена: солома / дерево / камень / металл / МВК |
|---|---|---|---|---|
| Квадратный | 1 | 1 | 10 / 250 / 500 / 1000 / 2000 | 50 / 200 / 300 / 200 / 25 |
| Треугольный | 1 | 0,5 | 10 / 250 / 500 / 1000 / 2000 | 25 / 100 / 150 / 100 / 13 |
| Ступени | 1 | 0,5 | 10 / 250 / 500 / 1000 / 2000 | 25 / 100 / 150 / 100 / 13 |

Ресурсы: солома и дерево — Wood, камень — Stones, металл — Metal Fragments, МВК — High Quality Metal.
Треугольный фундамент и ступени стоят половину квадратного с округлением вверх
(25 × 0,5 = 12,5 → 13 МВК, `ceil(baseCost × costMultiplier)` из `ConstructionGrade`), а HP у них то же.

## Поведение

**Постановка на землю.** Фундамент ставится без «мамы» — на ландшафт (сокет `Socket_Terrain`
с именем `terrain`). На этом сокете и на боковых `foundation-mid/1` в префабе висят проверки:

| Мод | Сколько точек (квадрат / треугольник) | Условие |
|---|---|---|
| `SocketMod_TerrainCheck`, `wantsInTerrain = 1` (`terrain_test`) | 4 / 3 — по одной на нижний угол | **каждая** точка «в земле» |
| `SocketMod_TerrainCheck`, `wantsInTerrain = 0` внутри `SocketMod_Grouping` (`not_terrain`) | 9 / 7 — сетка по площади | **хотя бы одна** точка не в земле (группа — это ИЛИ) |
| `SocketMod_AngleCheck` (`angle_test`) | 1 | верх фундамента отклонён от вертикали меньше чем на `withinDegrees` = 1° |
| `SocketMod_BoatBuildingNetting` (`not_boat`) | сфера 2,98 / 2,58 м | рядом нет лодочной сетки |

«В земле» значит: в пределах 3 м под точкой есть слой World либо поверхность ландшафта выше
точки. Число угловых точек совпадает с числом углов, так что прежняя версия «нижние углы
фундамента должны уйти в землю» подтверждается данными. Вторая группа не даёт закопать
фундамент целиком. У фундаментов `preventWorldLayerInMonuments = 0`, поэтому скала
монумента для этой проверки считается землёй. Не пускают на монумент другие проверки —
объёмы Prevent Building, см. [[building-blocked]].

**Пристройка к соседу.** Второй фундамент цепляется сокетом к краю первого. Обычные правила
сокетов — в [[construction-placement]]: совпадение до 0,02 м и 2°, автоповорот, проверка
близости `BuildingProximity`. Фундамент рядом с чужим не по сокетам ближе 1,49 м даст
`Too close to Foundation`.

**Опора.** У `StabilityEntity` есть поле `grounded`: такой блок всегда имеет 100 % стабильности
и не ищет опор (`InitializeSupports` сразу выходит). В префабах `grounded = 1` стоит у
`foundation` и `foundation.triangle`. У ступеней `foundation.steps` флаг **не** выставлен:
они получают опору от фундамента через свой сокет `ramp-male/1` (`support` = 0,7), то есть
имеют 70 %. Подробнее — [[stability]].

**Что ставится сверху.** «Мамы» на фундаменте (из префаба):

| Сокет | Тип | Что садится |
|---|---|---|
| `wall-female/1..4` | `Wall` | стены всех видов |
| `stairs-female/1` | `Stairs` | винтовая лестница |
| `block-female/1` | `Block` | L- и U-образные лестницы |
| `ramp-female/1..4` | `Ramp` | пандус и ступени фундамента |
| `misc-female/1` | `Misc` | — |
| `foundation-top/bot/mid/1..4` | `Foundation` (и «папа», и «мама») | соседние фундаменты сверху, снизу и сбоку |

Сокета типа `Floor` у фундамента нет: пол на фундамент не ставится, он садится на верх стены
или к краю другого пола ([[floor]]). У треугольного фундамента 3 сокета стен, 3 сокета `Ramp`
и 3 сокета `StairsTriangle` (под треугольную винтовую лестницу).

**Облик.** Боковины фундамента прячутся под каменной и более прочной стеной, углы — при соседнем
фундаменте. Ступени не учитываются. См. [[conditional-models]].

## Нюансы

- **Гниёт всегда.** `BuildingBlockDecay.ShouldDecay`: если содержание выключено
  (`decay.upkeep` = false), гниют только солома и блоки с `foundation` или `hull` в имени префаба.
  Фундамент любого грейда продолжает гнить. Подробнее — [[decay]].
- **Крокодилы ломают соломенные фундаменты.** Состояние ИИ `State_CrocBreakFoundation`: если цель
  крокодила стоит на постройке или рядом (4 м), он ищет ближайший **соломенный** `foundation`
  или `foundation.triangle` этой постройки, не прикреплённый к родителю, и **мгновенно уничтожает**
  его (`Kill`) вместо обычного удара. Дальность атаки — 3 м. Достаточно улучшить фундаменты
  хотя бы до дерева.
- **Копирование построек** (`ConVar.CopyPaste`) умеет брать только фундаменты (`--foundations-only`)
  и распознаёт их по коротким именам `foundation` и `foundation.triangle`.
- **Угловой контакт не сливает постройки.** Угловые сокеты (`CornerSocket`) не объединяют
  постройки (`ConnectsBuildings = false`). Для [[building-structure]] нужен контакт стороной.
- **Кусты под фундаментом.** В префабах `foundation` и `foundation.triangle` стоит `CullBushes = 1`:
  при постановке все кусты в объёме блока удаляются. У ступеней флага нет.
- **Улучшение проверяет объём.** У фундаментов, ступеней и пандуса в префабе `checkVolumeOnUpgrade = 1`:
  если в объёме блока стоит игрок или что-то ещё, улучшить нельзя ([[building-grades]]).
- **Повернуть после постановки нельзя.** У всех трёх префабов `canRotateAfterPlacement = 0`.
- **Старый режим распада.** При `decay.upkeep` = false у квадратного фундамента 4 точки распада
  (`DecayPoint` на `foundation-mid/1..4`, по 0,25), у треугольного — 3 по 0,35. Фундамент,
  со всех сторон окружённый соседями, в этом режиме не гниёт ([[decay]]).
- **Зона шкафа растёт от фундаментов.** Привилегия шкафа действует в 16 м от любого блока постройки,
  см. [[building-blocked]].

## На практике

- Первым делом улучшайте фундаменты из соломы: их бьют все, включая крокодилов, и снаружи они
  не держат пули.
- Если фундамент не ставится на склоне, ищите место, где все опорные точки уходят в землю или скалу.
  На монументе фундамент не встанет.
- Треугольные фундаменты вдвое дешевле. Ими удобно заполнять углы и делать «соты» вокруг базы.

## Где в коде

- `BuildingBlock` — общий класс блока.
- `StabilityEntity.grounded`, `StabilityEntity.InitializeSupports`.
- `BuildingBlockDecay.ShouldDecay`, `BuildingBlockDecay.AttributeSetup` (`isFoundation`).
- `SocketMod_TerrainCheck.IsInTerrain`.
- `ModelConditionTest_FoundationSide`, `ModelConditionTest_FoundationCornerLeft/Right`.
- `Rust.Ai.Gen2.State_CrocBreakFoundation.FindNearestTwigFoundationOnTargetBuilding`.
