---
id: data-smelting
title: Таблица: плавка и готовка
kind: data
group: Предметы и производство
icon: furnace
summary: Что во что превращается в печах и на кострах, за сколько времени и при какой температуре.
related: [smelting, furnace]
code: [ItemModCookable.cs, BaseOven.cs]
---

## Как читать

Данные из `ItemModCookable` на предметах. «Время» — секунды на одну единицу при базовой скорости печи,
как скорость зависит от печи и топлива — в [[smelting]]. «Температура» — диапазон, в котором предмет
готовится: печь должна быть достаточно горячей, иначе предмет не плавится.

| Сырьё | Результат | Кол-во | Время, с | Температура |
|---|---|---|---|---|
| Burnt Pork | Charcoal | 1 | 120 | 150–250 |
| Cooked Bear Meat | Burnt Bear Meat | 1 | 30 | 150–250 |
| Cooked Beef | Burnt Bear Meat | 1 | 30 | 150–250 |
| Cooked Big Cat Meat | Burnt Bear Meat | 1 | 30 | 150–250 |
| Cooked Big Cat Meat | Burnt Bear Meat | 1 | 30 | 150–250 |
| Cooked Chicken | Burnt Chicken | 1 | 60 | 150–250 |
| Cooked Crocodile Meat | Burnt Bear Meat | 1 | 30 | 150–250 |
| Cooked Deer Meat | Burnt Deer Meat | 1 | 60 | 150–250 |
| Cooked Fish | Charcoal | 1 | 60 | 150–250 |
| Cooked Horse Meat | Burnt Horse Meat | 1 | 60 | 150–250 |
| Cooked Human Meat | Burnt Human Meat | 1 | 60 | 150–2000 |
| Cooked Pork | Burnt Pork | 1 | 60 | 150–250 |
| Cooked Snake Meat | Burnt Bear Meat | 1 | 30 | 150–250 |
| Cooked Wolf Meat | Burnt Wolf Meat | 1 | 60 | 150–2000 |
| Crude Oil | Low Grade Fuel | 3 | 10 | 1400–1600 |
| Empty Can Of Beans | Metal Fragments | 15 | 30 | 150–2000 |
| Empty Tuna Can | Metal Fragments | 10 | 30 | 150–2000 |
| High Quality Metal Ore | High Quality Metal | 1 | 20 | 800–1200 |
| Honeycomb | Jar of Honey | 1 | 2 | 800–1200 |
| Metal Ore | Metal Fragments | 1 | 10 | 800–1200 |
| Raw Bear Meat | Cooked Bear Meat | 1 | 30 | 150–250 |
| Raw Beef | Cooked Beef | 1 | 30 | 150–250 |
| Raw Big Cat Meat | Cooked Big Cat Meat | 1 | 30 | 150–250 |
| Raw Big Cat Meat | Cooked Big Cat Meat | 1 | 30 | 150–250 |
| Raw Chicken Breast | Cooked Chicken | 1 | 30 | 150–250 |
| Raw Crocodile Meat | Cooked Crocodile Meat | 1 | 30 | 150–250 |
| Raw Deer Meat | Cooked Deer Meat | 1 | 30 | 150–250 |
| Raw Fish | Cooked Fish | 1 | 20 | 150–250 |
| Raw Horse Meat | Cooked Horse Meat | 1 | 26 | 150–250 |
| Raw Human Meat | Cooked Human Meat | 1 | 30 | 150–250 |
| Raw Pork | Cooked Pork | 1 | 30 | 150–250 |
| Raw Snake Meat | Cooked Snake Meat | 1 | 30 | 150–250 |
| Raw Wolf Meat | Cooked Wolf Meat | 1 | 30 | 150–250 |
| Sulfur Ore | Sulfur | 1 | 5 | 800–1200 |
