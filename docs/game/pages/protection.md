---
id: protection
title: Защита и «мягкая сторона»
kind: mechanic
group: Урон и рейд
icon: ui/security
summary: Защита — это 28 коэффициентов по типам урона из ассета ProtectionProperties; у блоков её задаёт грейд, а «мягкая сторона» — это дополнительная защита DirectionProperties, которая снимается, только если игрок бьёт в слабое место с обратной стороны.
related: [damage-system, explosions, building-grades, wall, foundation, repair, armor-clothing, explosive-ammo, c4, rocket, data-protection, data-building-blocks, data-entity-health]
code: [ProtectionProperties.cs, DirectionProperties.cs, WeakpointProperties.cs, BaseCombatEntity.cs, BuildingBlock.cs, BuildingGrade.cs, ConstructionGrade.cs, Workbench.cs, ItemModWorkbenchReinforced.cs]
---

## Кратко

Защита объекта — ассет `ProtectionProperties` с массивом `amounts[28]`: по одному
коэффициенту на каждый [[damage-system|тип урона]]. Урон каждого типа умножается на
`1 − clamp(amount, −1, 1)`. Значение 0.9 по Explosion — это −90 % урона от взрывов.
Значение 1 даёт полный иммунитет к этому типу.

У строительного блока защита зависит от **грейда**: `BlockTwig`, `BlockWood`, `BlockStone`
и `BlockMetal` (металл и МВК делят одну таблицу). Поверх неё действует **направленная** защита
`DirectionProperties` с ассетом `BuildingShell`. Это и есть механизм «мягкой» и «твёрдой»
стороны. Все числа — в [[data-protection]].

## Как работает

### ProtectionProperties

```csharp
public void Scale(DamageTypeList damageList, float ProtectionAmount = 1f)
{
    for (int i = 0; i < amounts.Length; i++)
        if (amounts[i] != 0f)
            damageList.Scale((DamageType)i, 1f - Mathf.Clamp(amounts[i] * ProtectionAmount, -1f, 1f));
}
```

- Коэффициенты **не складываются** между слоями, а перемножаются. Если базовая защита 0.5,
  а направленная ещё 0.5, проходит `0.5 × 0.5 = 25 %` урона, а не 0 %.
- Отрицательный коэффициент усиливает урон, максимум до ×2.
- Поле `density` (0–100, по умолчанию 1) — это не защита от урона, а «плотность» для пробития
  пулями: `BaseCombatEntity.PenetrationResistance` возвращает `baseProtection.density`, а без
  защиты 100. Насколько пуля теряет целостность при прохождении сквозь объект, считается
  в [[projectile-ballistics]].
- Есть два служебных ассета: `Immortal.asset` и `ImmortalLowDensity.asset`.
  `ProtectionProperties.IsImmortal` считает объект с ними неуязвимым.

### Где берётся защита строительного блока

`BuildingBlock.UpdateGrade`:

```csharp
baseProtection = currentGrade.gradeBase.damageProtecton;
```

`currentGrade` — это `ConstructionGrade` для пары (грейд, скин) из `blockDefinition.GetGrade(grade, skinID)`.
У каждого `BuildingGrade` свои `baseHealth`, `baseCost` и `damageProtecton`.
Защита и HP меняются при улучшении (`ChangeGrade` → `SetGrade` → `UpdateGrade`).

Главные для рейда коэффициенты (полная таблица — [[data-protection]], HP — [[data-building-blocks]]):

| Грейд | Таблица | Explosion | Bullet | Blunt | Stab | Slash | Heat | AntiVehicle |
|-------|---------|-----------|--------|-------|------|-------|------|-------------|
| Солома | `BlockTwig` | 0 % | 80 % | 80 % | 80 % | 80 % | 50 % | 100 % |
| Дерево | `BlockWood` | 10 % | 97 % | 98 % | 90 % | 80 % | 90 % | 100 % |
| Камень | `BlockStone` | 50 % | 99 % | 98 % | 95 % | 98 % | 100 % | 100 % |
| Металл и МВК | `BlockMetal` | 50 % | 100 % | 99 % | 98 % | 99 % | 100 % | 100 % |

Камень, металл и МВК гасят взрыв одинаково — на 50 %. Разница между ними в рейде только в HP
(500 / 1000 / 2000) и в защите от Blunt и Stab, которые важны для сачеля.

Шаг `ScaleDamage` применяет базовую защиту, только если `info.UseProtection = true`.
Это значение по умолчанию.

### Направленная защита (мягкая и твёрдая сторона)

На префаб можно повесить один или несколько атрибутов `DirectionProperties`. У атрибута есть:
- `bounds` — коробка слабого места в локальных координатах;
- `extraProtection` — дополнительный ассет `ProtectionProperties`;
- положение и направление `worldForward` внутри префаба.

У всех строительных блоков, дверей, люков, внешних стен, решёток и шкафа `extraProtection` —
один и тот же ассет **`BuildingShell`** («This is used to make the outside of building blocks
tougher»):

| Тип урона | Generic | Bullet | Arrow | Slash | Blunt | Stab | Bite | Explosion | Heat |
|-----------|---------|--------|-------|-------|-------|------|------|-----------|------|
| Допзащита | 90 % | 50 % | 50 % | 90 % | 90 % | 90 % | 90 % | **0 %** | 0 % |

Коробки слабого места (`bounds`, полуразмеры в метрах) по префабам:

| Префаб | Центр | Полуразмер |
|--------|-------|------------|
| `wall`, `wall.doorway`, `wall.window` | (0, 0, −0.1) | 1.4 × 1.4 × 0.1 |
| `wall.half` | (0, 0, −0.1) | 1.4 × 0.65 × 0.1 |
| `wall.low` | (0, 0, −0.1) | 1.4 × 0.4 × 0.1 |
| `foundation`, `floor` | (0, 0, −0.1) | 1 × 1 × 0.1 |
| `foundation.triangle`, `floor.triangle`, `floor.triangle.frame` | (0, 0, −0.1) | 0.5 × 0.5 × 0.1 |
| `roof` | (0, 0, 0) | 1.4 × 1.8 × 0.1 |
| `roof.triangle` | (0, 0, −0.3) | 0.5 × 1 × 0.1 |
| `floor.frame`, `wall.frame`, двери, люки, внешние стены и ворота, решётки, шкаф | — | **0** — слабого места нет |

Нулевая коробка значит, что `IsWeakspot` всегда `false`: у дверей, рам, внешних стен
и шкафа допзащита `BuildingShell` действует при любом ударе с `PointStart`.

В `BaseCombatEntity.Hurt`, после базовой защиты:

```csharp
if (info.PointStart != Vector3.zero)
    foreach (var dp in propDirection)
        if (dp.extraProtection != null && !dp.IsWeakspot(transform, info))
            dp.extraProtection.Scale(info.damageTypes);
```

То есть **дополнительная защита действует по умолчанию**. Снимается она, только если
`IsWeakspot` вернул `true`. «Твёрдая сторона» — это обычное состояние, а «мягкая» —
исключение.

### Условия слабого места (`DirectionProperties.IsWeakspot`)

Все условия должны выполниться одновременно:

1. У атрибута ненулевые `bounds`.
2. Атакующий — **игрок** (`info.InitiatorPlayer != null`). Турели и ловушки не игроки,
   поэтому всегда бьют по «твёрдой» стороне.
3. В HitInfo заполнено `HitEntity`.
4. **Видимость слабого места из глаз игрока.** Если на префабе есть `WeakpointProperties`, хотя
   бы одна такая точка должна быть видна из `eyes.position` атакующего (`IsVisible`). Точки
   с флагом `BlockWhenRoofAttached` не считаются, если к блоку через сокет-соседа примыкает
   крыша (`roof` или `roof.triangle`). Если точек нет, должен быть виден центр коробки `bounds`.
5. **Направление.** Точка `PointStart` (откуда пришёл удар) переводится в локальные координаты
   блока. Угол между `worldForward` атрибута и направлением на эту точку должен быть
   **больше 100°**. Атака должна идти «сзади» относительно forward атрибута, с запасом 10°
   за перпендикуляр.
6. Точка попадания `HitPositionWorld` лежит внутри коробки `bounds`.

Если всё выполнено, удар идёт в слабое место и `extraProtection` не применяется.

### Какие удары вообще могут попасть в слабое место

| Источник урона | `PointStart` | `HitEntity` | Мягкая сторона возможна? |
|----------------|--------------|-------------|--------------------------|
| Удар оружием ближнего боя, пуля | откуда стреляли | цель | **да**, по правилам выше |
| Сплэш взрыва (`DamageUtil.RadiusDamage`): ракета, брошенная взрывчатка | центр взрыва | **пусто** | **нет**: допзащита применяется всегда |
| Ближайший блок у заряда, поставленного на дверь или деплой (`TimedExplosive.Explode`) | центр взрыва | пусто | **нет**: допзащита применяется всегда |
| Заряд, поставленный на сам блок (удар по «родителю») | **не задан** (0,0,0) | пусто | шаг пропускается: **допзащиты нет совсем** |
| Сплэш разрывного патрона (`ItemModProjectileRadialDamage`) | позиция стрелка | цель | да, по правилам выше |
| Гниение (`Hurt(amount, Decay)`) | не задан | цель | шаг пропускается |

Отсюда два важных вывода для рейда:
- **Поставленный C4 или сачель бьют стену одинаково с обеих сторон.** По родителю они бьют
  HitInfo без `PointStart`, поэтому шаг направленной защиты не выполняется вообще.
- **Сплэш ракеты всегда идёт как по «твёрдой» стороне.** Но в `BuildingShell` по Explosion
  стоит 0, так что взрывная часть ракеты от стороны не зависит. Режется только её дробящая
  часть (75 Blunt): ещё −90 %. Итог по камню — 137.65 вместо 139 «без оболочки».
- **Мягкая сторона важна для пуль, стрел и ближнего боя.** С твёрдой стороны они теряют ещё
  50 % (Bullet, Arrow) или 90 % (Slash, Blunt, Stab).

### Прочие особые случаи

- **Верстак с бронёй.** `Workbench.ScaleDamage` дополнительно режет Explosion на
  `explosiveResistance` улучшения `ItemModWorkbenchReinforced`. В предмете
  `workbench.upgrade.reinforced` стоит `explosiveResistance = 0.2` (−20 % взрывного урона,
  умолчание класса 0.5) и бонус HP: +500 верстаку 1 и 2 уровня, +750 верстаку 3 уровня,
  +500 IO-столу (`healthBonusLevel1..3`, `healthBonusIOBench`). Базовое HP верстаков —
  500 (уровни 1 и 2, IO-стол) и 750 (уровень 3).
- **Игрок.** Защита игрока от взрыва обрезается сверху ConVar `server.max_explosive_protection = 0.75`.
  Подробнее в [[armor-clothing]].

## Числа и настройки

| Что | Значение | Откуда |
|-----|----------|--------|
| Формула | `урон_t × (1 − clamp(p_t, −1, 1))` | `ProtectionProperties.Scale` |
| Порог «сзади» для слабого места | угол > 100° | `DirectionProperties.IsWeakspot` |
| Защита от взрыва по грейдам | 0 / 10 / 50 / 50 / 50 % (солома / дерево / камень / металл / МВК) | ассеты `BlockTwig`, `BlockWood`, `BlockStone`, `BlockMetal` |
| Допзащита твёрдой стороны | Bullet и Arrow 50 %, Slash / Blunt / Stab 90 %, Explosion 0 % | ассет `BuildingShell` в `DirectionProperties` |
| Коробка слабого места стены | 2.8 × 2.8 × 0.2 м, со смещением −0.1 по z | `DirectionProperties.bounds` префаба `wall` |
| Броня верстака | −20 % Explosion | `explosiveResistance` предмета `workbench.upgrade.reinforced` |
| `density` | 1 по умолчанию | ассет `ProtectionProperties` |
| Защита игрока от взрыва, максимум | 0.75 | `server.max_explosive_protection` |

## Нюансы

- **Мягкая сторона — это видимость, а не только направление.** Слабое место должно быть
  видно из **текущих** глаз атакующего игрока в момент нанесения урона. Для пуль и ближнего
  боя это почти всегда так. Для отложенного урона — нет.
- **Крыша закрывает слабые точки.** `WeakpointProperties.BlockWhenRoofAttached` отключает
  точку, если к блоку примыкает крыша. В префабах флаг стоит у одной из двух слабых точек
  стены `wall` (`weakpoint (1)`). У проёмов (`wall.doorway`, `wall.window`) по две точки без
  флага, у фундамента — пять точек без флага.
- **Сплэш взрыва всегда «твёрдый».** `RadiusDamage` не заполняет `HitInfo.HitEntity`, а
  `IsWeakspot` при пустом `HitEntity` сразу возвращает `false`. Для ракет понятие мягкой
  стороны не работает.
- **Поставленный заряд «мягкий» с любой стороны.** У удара по родителю нет `PointStart`,
  поэтому шаг допзащиты не выполняется. На деле это почти не важно: в `BuildingShell` защита
  от Explosion нулевая, так что поставленный C4 выигрывает лишь на дробящей и колющей части
  (заметно только у сачеля: 51.5 вместо 37.5 + 0.4 + 1 = 38.9 по камню, будь удар «твёрдым»).
- **Скин может иметь свою защиту.** Защита берётся из `ConstructionGrade` для пары
  (грейд, скин). Технически у скина грейда может быть свой `BuildingGrade`, но в ассетах
  тематические скины (кирпич, бруталист, контейнер и т. д.) используют те же HP, стоимость
  и защиту, что и базовый грейд (см. [[data-building-blocks]]).
- **В приложении (замечание).** Калькулятор хранит в `splash.ts` готовый урон по грейду
  (`EXPLOSIVES[*].block`) и не делит его на тип урона и защиту. Модель верна, пока грейд
  определяет один коэффициент. Для поставленных C4 и сачелей направление в коде действительно
  не важно, и приложение это не моделирует — совпадает. Для ракеты это тоже совпадает с кодом:
  137.7 в приложении — это 275 × 0.5 + 75 × 0.02 × 0.1 = 137.65 по камню, то есть уже
  с `BuildingShell`. Для разрывных патронов сторона меняет только пулю: по камню 2.75
  с твёрдой и 3.0 с мягкой стороны за патрон, по металлу 2.5 с любой.

## На практике

- Ломаете стену киркой или пулями — заходите с мягкой стороны и бейте в зону слабого места.
  Цель должна быть в поле зрения.
- Для C4 и сачеля сторона не важна, ставьте туда, куда удобнее подойти.
- Броня верстака продлевает жизнь верстаку при рейде: −20 % взрывного урона и +500–750 HP.

## Где в коде

- `ProtectionProperties.Scale`, `Get`, `IsImmortal`, поле `density`.
- `BaseCombatEntity.ScaleDamage`, `BaseCombatEntity.Hurt` (шаг с `propDirection`), `PenetrationResistance`.
- `DirectionProperties.IsWeakspot`, `CheckWeakpointRoof`, `IsWeakspotVisible`.
- `WeakpointProperties.BlockWhenRoofAttached`.
- `BuildingBlock.UpdateGrade`, `SetGrade`, `currentGrade`.
- `BuildingGrade.damageProtecton`, `ConstructionGrade`.
- `Workbench.ScaleDamage`, `ItemModWorkbenchReinforced.explosiveResistance`.
- `DamageUtil.RadiusDamage`, `TimedExplosive.Explode` — откуда приходят HitInfo без `HitEntity` и `PointStart`.
