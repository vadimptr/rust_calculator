---
id: satellite-dish
title: Спутниковая тарелка
kind: object
group: Монументы
summary: Малый радтаун с синей картой на полу, одним зелёным считывателем, щитком и столом изучения; радиация LOW.
related: [monuments, monument-puzzles, monument-radiation]
code: [PuzzleReset.cs, CardReader.cs, ItemBasedFlowRestrictor.cs]
---

## Кратко

`small/satellite_dish.prefab` («Satellite Dish»). Радиация `LOW` ×5, `MINIMAL` ×1. Ящики:
14 смешанных + 9 `crate_normal_2` (2 одноразовых); бочки 15 + 3. Синяя карта (∞), базовый
фрагмент. Переработчик и стол изучения.

## Поведение

Цепь пазла из префаба: генератор → щиток → рубильник → зелёный считыватель → OR → дверь;
кнопка изнутри → тот же OR. Пока горит предохранитель (200 с обычный), дверь открыта;
после выгорания достаточно нового предохранителя — карта повторно не нужна
([[monument-puzzles]]). Сброс 1800 с, радиус 5 м, радиационный сброс.

## Где в коде

- `CardReader.ServerCardSwiped`, `ItemBasedFlowRestrictor`, `PuzzleReset`.
