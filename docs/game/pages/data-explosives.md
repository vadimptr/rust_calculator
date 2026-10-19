---
id: data-explosives
title: Таблица: взрывчатка и ракеты
kind: data
group: Урон и рейд
icon: explosive.timed
summary: Урон по типам, радиус, таймер и шанс осечки для всей взрывчатки, ракет и снарядов.
related: [explosions, c4, rocket, satchel-charge, beancan-grenade, explosive-ammo, data-protection]
code: [TimedExplosive.cs, DudTimedExplosive.cs, ServerProjectile.cs]
---

## Как читать

Значения взяты из компонентов `TimedExplosive` и `DudTimedExplosive` на префабах. Урон — до защиты
цели: стена гасит часть по своей таблице, см. [[data-protection]]. Радиус указан как «мин–макс»:
внутри минимального радиуса урон полный, дальше падает до нуля к максимальному, см. [[explosions]].
Таймер — секунды до взрыва. Осечка — шанс, что заряд не взорвётся с первого раза.

## Взрывные сущности

| Префаб | Урон | Радиус, м | Таймер, с | Осечка | Липнет |
|---|---|---|---|---|---|
| `40mm_grenade_he` | Взрыв 35, Дробящий 55 | 1–4 | 8–10 | — | — |
| `40mm_grenade_smoke` | — | 1.5–4.5 | 3 | — | — |
| `boulder_bee` | Дробящий 20 | 1–3 | 20 | — | — |
| `boulder_explosive_deployed` | Взрыв 160, Дробящий 75 | 1–4 | 8–10 | — | — |
| `boulder_explosive` | Взрыв 275, Дробящий 75 | 1–5.2 | 8–10 | — | — |
| `boulder_incendiary_deployed` | Жар 50 | 5–6 | 100 | — | — |
| `boulder_incendiary` | Жар 50 | 5–6 | 100 | — | — |
| `boulder_mid` | Дробящий 40, Противотех. 25 | 1–3 | 20 | — | — |
| `boulder_small` | Дробящий 20, Противотех. 12 | 1–3 | 20 | — | — |
| `boulder` | Дробящий 80, Противотех. 50 | 1–3 | 20 | — | — |
| `candyprojectile` | Стрела 20 | 1–2 | 8–10 | — | — |
| `eastereggprojectile` | Стрела 18 | 1–2 | 8–10 | — | — |
| `explosive.satchel.deployed` | Взрыв 75, Дробящий 200, Колющий 200 | 0–4 | 6–12 | 20% | да |
| `explosive.timed.deployed` | Взрыв 550 | 0–4 | 10 | — | да |
| `firecrackers.deployed` | — | 0–1 | 15 | — | — |
| `flare.deployed` | — | 0–1 | 110–120 | — | — |
| `grenade.beancan.deployed` | Взрыв 15, Дробящий 50, Колющий 50 | 1.5–4.5 | 3.5–4 | 15% | — |
| `grenade.bee.deployed` | Дробящий 10, Рубящий 10 | 2–4 | 10 | — | — |
| `grenade.f1.deployed` | Дробящий 100, Противотех. 50, Пуля 75 | 2–6 | 2.5 | — | — |
| `grenade.flashbang.deployed` | Дробящий 20 | 3–6 | 1.25 | — | — |
| `grenade.molotov.deployed` | Жар 35 | 1–3 | 8–10 | — | — |
| `grenade.smoke.deployed` | — | 1.5–4.5 | 1 | — | — |
| `grenade.supplysignal.deployed` | — | 1.5–4.5 | 3.5 | — | — |
| `landmine` | Укус 25, Дробящий 50, Взрыв 25 | 2–3 | — | — | — |
| `maincannonshell` | Дробящий 40 | 2–8 | 8–10 | — | — |
| `mortar_shell_basic` | Взрыв 60, Дробящий 75, Противотех. 100 | 1–4.5 | 90–120 | — | — |
| `mortar_shell_fragment` | Дробящий 75, Противотех. 50 | 1–6 | 90–120 | — | — |
| `rocket_basic_rpg` | Взрыв 275, Дробящий 75 | 1–3.8 | 8–10 | — | — |
| `rocket_basic` | Взрыв 275, Дробящий 75 | 1–3.8 | 8–10 | — | — |
| `rocket_fire_rpg` | Жар 50 | 5–5 | 8–10 | — | — |
| `rocket_fire` | Жар 50 | 5–5 | 8–10 | — | — |
| `rocket_heatseeker` | Взрыв 10, Пуля 20, Противотех. 500 | 1–3.5 | 12 | — | — |
| `rocket_heli_airburst` | Дробящий 75, Взрыв 200 | 2–6 | 8–10 | — | — |
| `rocket_heli_napalm` | Жар 25 | 2–6 | 8–10 | — | — |
| `rocket_heli` | Дробящий 175, Взрыв 100 | 2–6 | 8–10 | — | — |
| `rocket_hv_rpg` | Взрыв 30, Пуля 150, Противотех. 300 | 1–3.5 | 8–10 | — | — |
| `rocket_hv` | Взрыв 30, Пуля 150, Противотех. 300 | 1–3.5 | 8–10 | — | — |
| `rocket_mlrs` | Взрыв 350, Дробящий 75, Противотех. 75 | 10–15 | 60–70 | — | — |
| `rocket_sam` | Противотех. 120, Дробящий 35 | 3–5 | 8–10 | — | — |
| `rocket_smoke` | Яд 5 | 5–5 | 8–10 | — | — |
| `sam_ammo` | Яд 5 | 5–5 | 8–10 | — | — |
| `scientist2.grenade.f1.deployed` | Дробящий 100, Противотех. 50, Пуля 75 | 2–6 | 0 | — | — |
| `survey_charge.deployed` | Взрыв 8, Дробящий 12 | 1–5 | 5 | — | — |
| `torpedostraight` | Взрыв 10, Противотех. 300, Пуля 120 | 5–5 | 15–20 | — | — |

## Летящие снаряды

Скорость в м/с и множитель гравитации у `ServerProjectile` — для ракет и снарядов, которые летят
на сервере.

| Префаб | Скорость | Гравитация |
|---|---|---|
| `40mm_grenade_he` | 30 | 1 |
| `40mm_grenade_smoke` | 30 | 1 |
| `boomerang.thrown.entity` | 40 | 0 |
| `boulder_bee` | 16 | 1.3 |
| `boulder_explosive_deployed` | 16 | 1.3 |
| `boulder_explosive` | 16 | 1.3 |
| `boulder_incendiary_deployed` | 16 | 1.3 |
| `boulder_incendiary` | 16 | 1.3 |
| `boulder_mid` | 16 | 1.1 |
| `boulder_small` | 18 | 1.1 |
| `boulder` | 12 | 1.3 |
| `candyprojectile` | 22.5 | 1 |
| `eastereggprojectile` | 22.5 | 1 |
| `maincannonshell` | 100 | 0 |
| `mortar_shell_basic` | 15 | 0.5 |
| `mortar_shell_fragment` | 15 | 0.5 |
| `rocket_basic_rpg` | 18 | 0.25 |
| `rocket_basic` | 18 | 0.25 |
| `rocket_fire_rpg` | 18 | 0.25 |
| `rocket_fire` | 18 | 0.25 |
| `rocket_heatseeker` | 50 | 0 |
| `rocket_heli_airburst` | 60 | 0 |
| `rocket_heli_napalm` | 60 | 0 |
| `rocket_heli` | 75 | 0 |
| `rocket_hv_rpg` | 40 | 0.05 |
| `rocket_hv` | 40 | 0.05 |
| `rocket_mlrs` | 90 | 0.4 |
| `rocket_sam` | 65 | 0 |
| `rocket_smoke` | 30 | 0.15 |
| `sam_ammo` | 30 | 0.15 |
| `torpedostraight` | 20 | 0 |
