---
id: garage-door
title: Гаражная дверь
kind: object
group: Двери и замки
summary: Подъёмные ворота для широкого проёма — тот же класс Door, отличия только в префабе; 600 HP, анимация 3,4 с, транспорт под воротами останавливает закрытие.
related: [doors, door, locks, code-lock, wall, upkeep, protection, data-entity-health, data-protection, data-crafting]
code: [Door.cs, DoorCloser.cs, DoorManipulator.cs]
---

## Кратко

Отдельного класса у гаражной двери нет. Это `Door` со своим префабом: моделью, HP,
защитой, длиной анимации и набором триггеров. Ставится в сокет `WallFrame` стеновой рамы
(`wall.frame`).
Вся общая логика — открытие через замок, доводчик, контроллер, апгрейд — описана в [[doors]].

## Характеристики

| Параметр | Значение | Откуда |
|----------|----------|--------|
| Префаб | `wall.frame.garagedoor` (скин — `industrial.garage.door.deployable`, те же числа) | — |
| HP | 600 | `startHealth` префаба |
| Защита | `MetalDoor`: 100 % пуль, рубящего и колющего, 95 % дробящего, 20 % взрыва | `baseProtection`, [[data-protection]] |
| Рецепт | 300 Metal Fragments, 2 Gears, верстак 2 | [[data-crafting]] |
| Длина анимации | 3,4 с на открытие и столько же на закрытие | `openAnimLength`, `closeAnimLength` префаба |
| Замок | да (`canTakeLock = 1`) | `Door.HasSlot` |
| Доводчик | слот `UpperModifier` есть у любой двери | `Door.HasSlot` |
| Венок, молоток, окошко | нет (`canTakeCloser`, `canTakeKnocker`, `hasHatch` = 0) | префаб |
| Распад | как металлический блок (`BuildingGradeDecay`, грейд Metal) | префаб, [[decay]] |
| Содержание | по рецепту: 300 Metal Fragments × ставка (шестерни не считаются) | [[upkeep]] |

## Поведение

**Защита транспорта.** Если у префаба есть триггеры `vehiclePhysBoxes`, на отрезке от 10% до 80%
анимации сервер проверяет, нет ли в проёме транспорта. Мешают сиденья с `BlocksDoors`
(почти всё, кроме саней `Sled`), модули машин и лодочные блоки. Тогда ворота разворачиваются
обратно (`Door.OnObjects`). У гаражной двери в префабе один такой триггер и
`checkPhysBoxesOnOpen = 0`: транспорт проверяется только при закрытии.

## Нюансы

- **Игрок закрытие не останавливает.** В базовом `Door` помехой считается только транспорт.
- **Сани не мешают.** У `Sled` переопределено `BlocksDoors => false`.
- **С контроллером ворота открываются мимо замка.** См. [[doors]].

## Где в коде

- `Door.OnObjects`, `Door.StartCheckingForBlockages` — проверка транспорта.
- `BaseMountable.BlocksDoors`, `Sled.BlocksDoors` — кто считается помехой.
