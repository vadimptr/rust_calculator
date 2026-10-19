---
id: train-tunnels
title: Железнодорожные туннели (метро)
kind: object
group: Монументы
icon: ui/map-tunnel
summary: Подземная сеть станций на сетке 216 м: входы с монументов и бункеров, станции с туннельными жителями, ящиками и дрезинами, баррикады на путях; сброс станций раз в 30 минут.
related: [monuments, monument-puzzles, trains, scientists, military-tunnels]
code: [GenerateDungeonGrid.cs, DungeonGridCell.cs, DungeonGridInfo.cs, TunnelDweller.cs, NPCDwelling.cs, PressButton_TrainTunnel.cs, ElevatorStatic.cs, HittableByTrains.cs, PuzzleReset.cs]
---

## Кратко

`GenerateDungeonGrid` строит под картой сеть туннелей на сетке с клеткой 216 м
(отключается `BelowGroundRails`). У каждого входа (`DungeonGridInfo`) ставится станция, станции
соединяются туннелями. Входы: на монументах (`entrance_monuments_a/b/c/town`,
`entrance_ferry_terminal` — Гавани, Паромный терминал, Аэродром, Экскаватор, Военные туннели,
Электростанция, Депо, Водоочистная, Жилой комплекс, Аванпост, Космодром) и отдельные бункеры
`tunnel-entrance/entrance_bunker_a..d`. На входе — лифт `ElevatorStatic` и кнопка
`PressButton_TrainTunnel` (пустой наследник `PressButton`).

## Характеристики

| Где | Что | Откуда |
|-----|-----|--------|
| Станция | до 3 `npc_tunneldweller` (125 HP, ∞), ящики до 4 (`crate_normal` 20 / `crate_normal_2` 80), полоса лута до 4, **до 2 дрезин с респауном 60 с** | `station-*.prefab` |
| Прямой туннель | до 5 тяжёлых баррикад, полосы лута по 2 и 4 | `straight-*.prefab` |
| Полоса лута | до 3 ящиков (`crate_normal_2` 60 / `crate_tools` 30 / `crate_normal` 10) и до 2 жителей | `tunnellootstrip_a` |
| Перегон 18/36/72 м | 1/3/4 «жилища» `tunnel_dwelling_a..h`, в каждом 1–2 жителя (шанс 1.0) | `link-straight-*` |
| Баррикада | лёгкая 120 HP, тяжёлая 150 HP; одиночные `trainbarricade` респаун 180–300 с | `HittableByTrains`, `IndividualSpawner` |
| Сброс | 1800 с, радиус 80 м (перегоны 73 м), «только подземные» | `PuzzleReset` станций и туннелей |

## Поведение

- Баррикаду ломает поезд: при разрушении состав получает `|скорость| × 10` (лёгкая) или
  `× 20` (тяжёлая) урона; пока баррикаду толкают, она получает силу поезда × 0.004 / 0.002 за
  тик (`HittableByTrains`). Поезда — [[trains]].
- Убийство туннельного жителя с движущегося поезда засчитывается в отдельную статистику
  достижения (`TunnelDweller`).
- Жители и лут станций одноразовые и возвращаются при сбросе.

## Нюансы

- **Сброс блокируют игроки сверху.** У пазлов метро `ignoreAboveGroundPlayers = 1`, а условие
  в `PuzzleReset.AnyPlayersWithinDistance` перевёрнуто: игроки под землёй **не** мешают сбросу,
  мешают те, кто на поверхности в 80 м от точки станции. Спящих под землёй сброс убивает.
- Дрезины на станции — обычная группа спауна с 60 с паузой: угнали — через минуту новая.

## На практике

- Не ложитесь спать (не выходите из игры) на станции — сброс убьёт спящего.
- Тяжёлую баррикаду лучше снести оружием, чем таранить дрезиной: таран бьёт по поезду.

## Где в коде

- `GenerateDungeonGrid.Process`; `DungeonGridInfo`, `DungeonGridCell`.
- `HittableByTrains`, `TunnelDweller`, `NPCDwelling`, `PuzzleReset.AnyPlayersWithinDistance`.
