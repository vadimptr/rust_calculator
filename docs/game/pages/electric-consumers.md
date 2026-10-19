---
id: electric-consumers
title: Потребление электроприборов
kind: mechanic
group: Электричество
icon: ui/lightbulb
summary: Таблица потребления (ConsumptionAmount) всех игровых электроприборов — из кода и из полей префабов, с пометкой источника и особенностей расчёта спроса для батареи.
related: [electricity, battery, io-engine, electricity-quirks, auto-turret, sam-site, solar-panel, wind-turbine, electric-generator]
code: [IOEntity.cs, AutoTurret.cs, SamSite.cs, SimpleLight.cs, CeilingLight.cs, TeslaCoil.cs, Elevator.cs, Hopper.cs, NeonSign.cs, DeployableBoomBox.cs]
---

## Кратко

Потребление (`ConsumptionAmount`) — сколько rW устройство забирает с входа, прежде чем
пропустить остаток дальше. Устройство работает, если `вход ≥ потребление` и `вход > 0`
(`IOEntity.GetHasPower`). Без своего переопределения потребление равно **1**.

Отдельно от потребления есть **спрос** (`DesiredPower`) — сколько устройство тратит из
батареи. Обычно спрос = потребление, если устройство запитано, и 0, если нет. Исключения
отмечены в таблице. Как батарея его суммирует — [[battery]].

## Как работает

Источник числа:

- **код** — константа в `ConsumptionAmount` класса;
- **префаб** — поле префаба (`powerConsumption`, `PowerConsumption`, `PowerDrain` и т. п.),
  значение по умолчанию в коде может отличаться;
- **база** — класс не переопределяет метод, действует `IOEntity.ConsumptionAmount` = 1.

### Потребители

| Устройство | Префаб | Потребление, rW | Источник | Спрос для батареи |
|---|---|---|---|---|
| ПВО | `sam_site_turret_deployed` | 25 | код `SamSite` | обычный |
| Тесла-катушка | `teslacoil.deployed` | 25 = ceil(35 / 1.4) | код `TeslaCoil` + поля префаба | `min(вход, 25)` — работает и на частичном питании |
| Автотурель | `autoturret_deployed`, `industrial_autoturret_deployed` | 10 | код `AutoTurret` | обычный |
| Прожектор (большой) | `searchlight.deployed` | 10 | код `SearchLight` | обычный |
| Бумбокс, музыкальный автомат | `boombox.deployed`, `jukebox.deployed` | 10 | код; `PowerUsageWhilePlaying` = 10 | только пока играет |
| Хоппер | `hopper.deployed` | 8 | код `Hopper` | **всегда 8** |
| Неоновая вывеска XL анимированная | `sign.neon.xl.animated` | 7 | префаб | вход 0 — **всегда** |
| Неоновая вывеска XL | `sign.neon.xl` | 6 | префаб | вход 0 — **всегда** |
| Неоновая вывеска средняя анимированная | `sign.neon.125x215.animated` | 5 | префаб | вход 0 — **всегда** |
| Неоновая вывеска средняя | `sign.neon.125x215` | 4 | префаб | вход 0 — **всегда** |
| Неоновая вывеска малая | `sign.neon.125x125` | 2 | префаб | вход 0 — **всегда** |
| Гирлянды, лампочки на проводе | `electric.fairylights.deployed`, `electric.bulbstringlights.deployed` | 5 | код `StringLights` | обычный |
| Новогодние гирлянды | `xmas.advanced.lights.deployed` | 5 | код `ChristmasLights` | обычный |
| Прожектор на стене/треноге | `electric.spotlight.deployed`, `electric.spotlight.tripod.deployed` | 5 (в префабе 1, код перекрывает) | код `OrientableLight` | обычный |
| Лифт | `elevator` | 5 | код `Elevator` | **всегда 5** |
| Гаражная платформа | `electrical.modularcarlift.deployed` | 5 | код `ModularCarGarage` | обычный |
| Холодильник | `fridge.deployed` | 5 | префаб `PowerConsumption` | обычный |
| Торговый автомат | `vendingmachine.deployed` | 5 | префаб | обычный |
| Водяной насос | `water.pump.deployed` | 5 | префаб | обычный |
| Электроочиститель воды | `poweredwaterpurifier.deployed` | 5 | префаб `PowerDrain` | обычный |
| Биотопливный генератор | `biofuel_generator.deployed` | 5 | префаб `powerConsumption` | только при флаге `Reserved3` |
| Микрофонная стойка | `microphonestandio.entity` | 5 | префаб `PowerCost` | **всегда 5** |
| Компьютерный стол | `computerstation.ioent` | 5 | префаб | только если стол включён |
| Люстра | `electric.chandelier.deployed` | 4 | код `Chandelier` | обычный |
| Обогреватель | `electrical.heater` | 3 | код `ElectricalHeater` | обычный |
| Камера CCTV, PTZ | `cctv_deployed`, `ptz_cctv_deployed` | 3 | код `CCTV_RC` | обычный |
| Электропечь | `electricfurnace.io`, `industrial_electric_furnace.io` | 3 | префаб | только пока печь включена |
| Потолочная и потолочная люминесцентная лампы | `ceilinglight.deployed`, `electric.fluorescentlight.ceiling.deployed` | 2 | префаб `consumptionAmount` | обычный |
| Поджигатель | `igniter.deployed` | 2 | префаб | только если может поджечь |
| Мини-холодильник | `minifridge.deployed` | 2 | префаб | обычный |
| Простая, настольная, люминесцентная лампы, настенные индустриальные лампы, подсветка оружейной стойки, рамки с подсветкой | `simplelight`, `electric.tablelamp.deployed`, `electric.fluorescentlight.deployed`, `industrial.wall.lamp*.deployed`, `weaponracklight*`, `lightupframe.ioent.*` | 1 | префаб `powerConsumption` | обычный |
| Рамки из металлолома | `scrapframe.ioent.*` | 0 | префаб | — |
| Мишень | `reactivetarget_deployed` | 1 | код `ReactiveTarget` | обычный |
| Индустриальный адаптер | `storageadaptor.deployed` | 1 | код | обычный |
| Конвейер, индустриальный крафтер | `industrialconveyor.deployed`, `industrialcrafter.deployed` | 1 | база | только когда включён |
| Датчики HBHF и лазерный, сейсмодатчик, RF-передатчик и приёмник, умная сигнализация, монитор хранилища, цифровые часы, звуковая сирена, проблесковый маячок, мигалка, дверной контроллер, кабельный туннель, электрошкаф, диско-шар, светомузыка, колонки | разные | 1 | база | обычный |

### Ничего не потребляют (0)

Батареи, солнечная панель, ветряк, генераторы, сплиттер, ветвитель, блокировщик, сумматор,
AND, OR, XOR, RAND, ячейка памяти, счётчик, таймер, выключатель, умный выключатель, кнопка,
нажимная плита, стробоскоп и генератор дыма/снега (работают на топливе, входы только
сигнальные).

## Нюансы

- **«Всегда» в спросе** значит: устройство тратит заряд батареи, даже если ему не хватает
  питания и оно не работает (`DesiredPower` без проверки входа). У неоновой вывески это
  касается входа 0; входы кадров анимированных вывесок требуют питание, только пока вывеска
  не запитана (`NeonSign.DesiredPower`).
- **Мерцание** делает «всегда» из любого спроса: при [[flicker|мерцании]] `IOEntity.DesiredPower`
  возвращает полное потребление.
- **Тип батареи и устройства должен совпадать.** `ShouldDrainBattery` по умолчанию сравнивает
  `ioType`. Разбрызгиватель (тип «вода») электрическую батарею не тратит. Конвейер и
  крафтер переопределяют проверку: тратят, только когда включены.
- Сигнальные выходы турели и ПВО дают по 1 rW сверх проходящей мощности: ПВО на входе 30
  выдаёт 5 на Passthrough и до трёх единиц на сигналах ([[sensors]]).

## Где в коде

`ConsumptionAmount` и `DesiredPower` в перечисленных классах; `IOEntity.ConsumptionAmount`,
`IOEntity.DesiredPower`, `IOEntity.ShouldDrainBattery`, `IOEntity.GetHasPower`.
