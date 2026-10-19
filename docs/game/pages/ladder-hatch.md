---
id: ladder-hatch
title: Люк с лестницей
kind: object
group: Двери и замки
icon: floor.ladder.hatch
summary: Люк в полу с приставной лестницей — это дверь класса Door в проёме пола; открывается и запирается по тем же правилам, что и обычная дверь.
related: [doors, door, locks, code-lock, stability, upkeep, protection, floor, data-entity-health, data-protection, data-crafting]
code: [Door.cs, TriggerLadder.cs]
---

## Кратко

Люк ставится в «пол с люком» и ведёт себя как дверь: у него есть флаг `Open`,
слот замка и анимация. Отдельного класса для люка в серверном коде нет. Это префаб класса `Door`
со своей моделью и лестницей внутри. Лестница для подъёма — триггер `TriggerLadder`
в префабе. Общая логика описана в [[doors]].

## Характеристики

| Люк | Префаб | Сокет | HP | Рецепт | Распад как грейд |
|---|---|---|---|---|---|
| Люк | `floor.ladder.hatch` | `FloorFrame` | 250 | 1 Wooden Ladder, 300 Metal Fragments, 3 Gears | Metal |
| Треугольный люк | `floor.triangle.ladder.hatch` | `FloorFrameTriangle` | 250 | то же | Metal |
| Бронированный люк | `floor.ladder.hatch.toptier` | `FloorFrame` | 1000 | 1 Wooden Ladder, 35 HQM, 6 Gears | TopTier |
| Бронированный треугольный | `floor.triangle.ladder.hatch.toptier` | `FloorFrameTriangle` | 1000 | то же | TopTier |

HP и защита — `startHealth` и `baseProtection` префабов ([[data-entity-health]]); защита у всех
`MetalDoor` ([[data-protection]]). Рецепты — [[data-crafting]].

| Параметр | Значение | Откуда |
|----------|----------|--------|
| Замок | да, у всех четырёх (`canTakeLock = 1`) | `Door.HasSlot` |
| Дистанция открытия | 3 м | `RPC_Server.MaxDistance(3f)` |
| Направление открытия | фиксированное (`canReverseOpen = 0` у всех) | `Door.RPC_OpenDoor` |
| Анимация | 1,17 с открытие, 0,83 с закрытие | `openAnimLength`, `closeAnimLength` префабов |
| Проверка транспорта | 1 триггер `vehiclePhysBoxes`, и при открытии, и при закрытии | префаб |

## Поведение

- Открыть и закрыть можно с расстояния до 3 м, решает замок ([[locks]]).
- Пока люк в анимации (`Busy`), повторно его не открыть и не закрыть.
- Раненый игрок может открыть люк с задержкой больше 2,5 с, как и дверь.

## Нюансы

- **Флаг `hasHatch` — не про этот люк.** В `Door` есть отдельный механизм «окошка» (`hasHatch`,
  `RPC_ToggleHatch`, флаг `Reserved3`). Он открывает маленькую створку в двери и тоже проверяет
  замок. По ассетам он включён только у бронированных дверей `door.hinged.toptier` и
  `door.double.hinged.toptier` ([[door]]); у люков он выключен.
- **Ставится в раму пола.** Квадратный люк — в `floor.frame`, треугольный — в `floor.triangle.frame`
  ([[floor]]). В сплошной пол люк не встанет.
- **Содержание считается без лестницы и шестерён.** В расчёт идут только ресурсы рецепта:
  300 Metal Fragments или 35 HQM ([[upkeep]]).
- **Игрок на люке не мешает его закрыть.** Сервер проверяет помехи только от транспорта
  и только у дверей с триггерами `vehiclePhysBoxes` ([[doors]]).

## Где в коде

- `Door.RPC_OpenDoor`, `Door.RPC_CloseDoor` — открытие.
- `Door.RPC_ToggleHatch` — «окошко» в двери (не люк в полу).
