---
id: repair
title: Ремонт
kind: mechanic
group: Урон и рейд
icon: hammer
summary: Удар молотком чинит не больше 50 HP и стоит долю от полной цены постройки текущего грейда, пропорционально недостающему HP; 30 секунд после любой атаки чинить и улучшать нельзя.
related: [damage-system, building-grades, decay, upkeep, door, protection, c4, data-building-blocks, data-entity-health]
code: [BaseCombatEntity.cs, Hammer.cs, BuildingBlock.cs, ConstructionGrade.cs, RepairBench.cs, DecayEntity.cs, Planner.cs, ConVar/Decay.cs]
---

## Кратко

Удар киянкой (`Hammer`) вызывает у цели `BaseCombatEntity.DoRepair`. Ремонт:
- запрещён **30 секунд** после последней атаки;
- за один удар восстанавливает **не больше 50 HP**;
- стоит `цена_постройки × RepairCostFraction × доля_недостающего_HP`. У строительных блоков
  `RepairCostFraction = 1`: полная починка с нуля стоит как постройка блока этого грейда.
  У остальных объектов по умолчанию `0.5`.

Максимальное HP при ремонте не снижается: в коде нет механики «износа» от починки.

## Как работает

### Удар молотком

`Hammer.DoAttackShared`:
1. Если цель — часть чего-то большего (`ShouldRepairViaParent`), чинится родитель
   (`GetRepairableParent`).
2. Вызывается `DoRepair(ownerPlayer)`.
3. Атака уходит на перезарядку `repeatDelay` — 0.5 с у префаба `hammer.entity`. Дальность
   удара 1.5 м (`maxDistance`), радиус 0.3 м (`attackRadius`).

Молоток не может бить игроков (`CanHit` возвращает `false` для `BasePlayer`) и бьёт только
`BaseCombatEntity`.

### DoRepair шаг за шагом

1. `repair.enabled` должен быть включён в префабе.
2. **Кулдаун после атаки**: если `SecondsSinceAttacked <= GetDamageRepairCooldown()`
   (по умолчанию 30 с), ремонт отклоняется с сообщением «Recently damaged, repairable in N seconds».
   В креативе с `Creative.freeRepair` кулдауна нет.
3. `missing = MaxHealth − Health`, `frac = missing / MaxHealth`. Если 0 — «Not damaged».
4. **Цена полного ремонта недостающего HP** (`RepairCost(frac)`), по каждому ресурсу цены постройки:

   ```
   cost_i = max( round(build_i × RepairCostFraction × frac), 1 )
   ```

   Ресурс `repair.ignoreForRepair` пропускается. Компоненты (шестерни, трубы и т. п.)
   заменяются первым ингредиентом их собственного чертежа (`RepairBench.StripComponentRepairCost`).
5. **Сколько можно починить сейчас**:

   ```
   share = min( min_i(clamp01(have_i / cost_i)), 50 / missing )
   ```

   Выбирается наименьшее из двух: на какую долю хватает самого дефицитного ресурса и какая доля
   соответствует 50 HP.
6. Списывается `ceil(share × cost_i)` каждого ресурса.
7. Восстанавливается `missing × (списано_всего / cost_всего)`.
8. Если HP полное — эффект `repair_full` и `OnRepairFinished`. У `DecayEntity` это ещё
   и `DecayTouch()`: таймер гниения сбрасывается, см. [[decay]]. Иначе — эффект `repair`.

### Цена постройки у строительного блока

`BuildingBlock.BuildCost()` = `currentGrade.CostToBuild()` без указания исходного грейда.
В `ConstructionGrade.UpdateCosts` для этого случая множитель `num = 1`. Множитель 0.2 действует,
только когда исходный грейд совпадает с целевым: это смена скина в пределах того же грейда,
другой путь. Поэтому:

```
build_i = ceil( gradeBase.baseCost_i × Construction.costMultiplier × decay.<грейд>_cost_multiplier )
```

| Грейд | ConVar множителя цены |
|-------|-----------------------|
| Солома | `decay.build_twig_cost_multiplier` |
| Дерево | `decay.upgrade_wood_cost_multiplier` |
| Камень | `decay.upgrade_stone_cost_multiplier` |
| Металл | `decay.upgrade_metal_cost_multiplier` |
| МВК | `decay.upgrade_hqm_cost_multiplier` |

Все по умолчанию `1`. Значит, ремонт дорожает и дешевеет вместе с улучшением на сервере
с изменёнными ценами.

### Пример

Каменная стена: HP 500, цена 300 камня (`BuildingGrade` камня: 500 HP и 300 Stones,
у стены множители HP и цены 1, см. [[data-building-blocks]]).
Стена полностью разрушена до 1 HP: `missing ≈ 499`, `frac ≈ 0.998`, `cost ≈ round(300 × 1 × 0.998) = 299`.
За удар: `share = min(1, 50/499 ≈ 0.1)`, списывается `ceil(0.1 × 299) = 30` камней,
восстанавливается `≈ 50` HP. Полная починка — около 10 ударов и 300 камня,
то есть цена постройки.

### Улучшение тоже ждёт

- `BuildingBlock.DoUpgradeToGrade`: если `SecondsSinceAttacked < 30`, улучшение запрещено
  («CantUpgradeRecentlyDamaged»). Здесь 30 — литерал, а не вызов метода.
- `Planner.CanUpgradeInPlace` (замена объекта на улучшенную версию) использует
  `GetDamageRepairCooldown()`.
- Смена скина баллончиком (`CanBeReskinned`): тоже `SecondsSinceAttacked < 30` → нельзя.
  Нельзя и пока на объекте висит любой `TimedExplosive`.

### Что сбрасывает таймер «недавно атакован»

`lastAttackedTime` обновляет `SetJustAttacked()`. Его вызывают:
- `BaseCombatEntity.Hurt`, если преобладающий тип урона «считается атакой» — всё, кроме
  `Decay` и `Collision` (`DamageTypeEx.IsConsideredAnAttack`);
- `TimedExplosive.DoStick` — **прилипание взрывчатки** к объекту, даже до взрыва.

## Числа и настройки

| Что | Значение | Откуда |
|-----|----------|--------|
| Максимум HP за удар | 50 | литерал `50f` в `DoRepair` (константа `MAX_HEALTH_REPAIR = 50f`) |
| Кулдаун после атаки | 30 с | `BaseCombatEntity.GetDamageRepairCooldown` |
| Кулдаун у `ConstructableEntity` | 5 с | `ConstructableEntity.GetDamageRepairCooldown` |
| Доля цены, по умолчанию | 0.5 | `BaseCombatEntity.RepairCostFraction` |
| Доля цены, строительный блок | 1.0 | `BuildingBlock.RepairCostFraction` |
| Доля цены, лодка игрока | 1.0 | `PlayerBoat.RepairCostFraction` |
| Минимум за ресурс | 1 | `Mathf.Max(..., 1)` в `RepairCost` |
| Кулдаун улучшения грейда | 30 с | литерал в `BuildingBlock.DoUpgradeToGrade` |
| Бесплатный ремонт в креативе | — | `Creative.freeRepair` |

## Нюансы

- **Блоки чинятся по полной цене, деплои — за полцены.** У `BuildingBlock` `RepairCostFraction`
  переопределён на `1`. У дверей, ящиков и прочего действует базовые `0.5`.
- **Полная починка блока стоит как его постройка в этом грейде.** Множитель 0.2
  в `ConstructionGrade` применяется только при переходе в тот же грейд (смена скина),
  а `BuildCost()` его не запрашивает.
- **Мелкие царапины переплачиваются.** На каждый ресурс берётся минимум 1 единица, плюс
  округление вверх (`ceil`). Добить 1 HP у МВК-блока стоит минимум 1 МВК.
- **Не хватает ресурсов — частичный ремонт.** Если ресурсов меньше нужного, HP растёт
  пропорционально самому дефицитному из них, а остальные списываются в той же пропорции.
- **Гниение не мешает ремонту**, а огонь мешает: `Decay` атакой не считается, `Heat` считается.
- **Поставленный C4 блокирует ремонт сразу**, ещё до взрыва: `DoStick` вызывает
  `SetJustAttacked` у объекта, к которому прилип заряд.
- **Ремонт не снижает максимум HP** — в `DoRepair` нет такой логики.
- **Компоненты в цене двери** (шестерни, пружины) при ремонте заменяются сырьём из первого
  ингредиента их чертежа, с минимумом 1 (`StripComponentRepairCost`).
- **В приложении (замечание).** Калькулятор в `raidData.ts` и `splash.ts` ремонт не моделирует.
  Для расчёта «сколько стоит отбиться» используйте: ремонт блока = цена постройки грейда
  × доля потерянного HP, не больше 50 HP за удар, и ни одного удара в течение 30 с после
  последнего попадания.

## На практике

- Во время рейда чинить стену, по которой продолжают стрелять или на которой висит C4,
  бесполезно: каждый удар или прилипание сбрасывает 30-секундный таймер.
- Каменная стена после рейда чинится примерно за 10 ударов (около 5 с при `repeatDelay`
  0.5 с) и столько же камня, сколько стоила постройка.
- Цена полной починки по грейдам — цена постройки ([[data-building-blocks]]): стена 50 / 200
  дерева, 300 камня, 200 металла или 25 МВК; пол и крыша — половина, треугольный пол — четверть.
- Двери и деплои чинить выгоднее, чем строить заново: половина цены.

## Где в коде

- `BaseCombatEntity.DoRepair`, `RepairCost`, `RepairCostFraction`, `BuildCost`, `GetDamageRepairCooldown`, `SetJustAttacked`, `CanBeReskinned`.
- `Hammer.DoAttackShared`, `Hammer.CanHit`.
- `BuildingBlock.RepairCostFraction`, `BuildingBlock.BuildCost`, `BuildingBlock.DoUpgradeToGrade`.
- `ConstructionGrade.UpdateCosts`, `CostToBuild`.
- `RepairBench.StripComponentRepairCost`.
- `DecayEntity.OnRepairFinished`.
- `Planner.CanUpgradeInPlace`.
- `ConVar.Decay.GetCostMultiplier`.
