---
id: world-events
title: Ивенты
kind: mechanic
group: Мир и события
icon: ui/icon-map
summary: Как сервер планирует и запускает ивенты (патрульный вертолёт, аирдроп, карго, чинук, Брэдли) и что у них общего — таймеры, ConVar, ящики.
related: [patrol-helicopter, bradley, cargo-ship, airdrop, locked-crate, safe-zones, loot-spawns, damage-system]
code: [EventSchedule.cs, TriggeredEvent.cs, TriggeredEventPrefab.cs, EventScheduleWipeOffset.cs, ConVar/Events.cs, ConVar/Server.cs, BradleySpawner.cs, RoadBradleys.cs, AirfieldCallChinookTerminal.cs]
---

## Кратко

Почти все «большие» события мира устроены одинаково: на карте живёт объект-расписание
`EventSchedule`, у которого есть случайный таймер между `minimumHoursBetween` и
`maxmumHoursBetween`. Когда таймер доходит до нуля, расписание запускает один из своих
«триггеров» `TriggeredEvent`, обычно это просто «создать префаб» (вертолёт, самолёт, корабль,
чинук). Дальше каждый ивент живёт своей жизнью — подробности на страницах объектов:
[[patrol-helicopter]], [[bradley]], [[cargo-ship]], [[airdrop]], [[locked-crate]].

Брэдли на Launch Site — исключение: у него не расписание, а свой спаунер с таймером
респауна в **реальных** минутах.

## Как работает

### 1. Расписание считает игровые часы, а не реальные

`EventSchedule.RunSchedule` вызывается раз в секунду. `CountHours` берёт разницу
**внутриигрового** времени (`TOD_Sky.Instance.Cycle.DateTime`) с прошлого вызова и вычитает её
из `hoursRemaining`. Поэтому интервалы ивентов задаются в игровых часах. Сколько это реального
времени, зависит от длины суток на сервере. Если админ перематывает время (`env.time`),
таймеры ивентов тоже прыгают.

```
hoursRemaining −= (игровое время сейчас − игровое время прошлого вызова) в часах
```

При включении расписания и после каждого срабатывания таймер заново берётся как
`Random.Range(minimumHoursBetween, maxmumHoursBetween)`. По умолчанию в коде это 12–24 часа,
но реальные значения для каждого ивента задаются в префабе расписания.

### 2. Что именно запускается

`EventSchedule.Trigger` берёт **случайный** компонент `TriggeredEvent` на том же объекте и
вызывает `RunEvent`. Для большинства ивентов это `TriggeredEventPrefab`: он создаёт префаб,
шлёт ему сообщения `TriggeredEventSpawn` / `TriggeredEventPostSpawn` и при
`shouldBroadcastSpawn` рассылает всем игрокам уведомление о появлении.

Через `TriggeredEventSpawn` объекты выбирают себе стартовую точку:

| Объект | Где появляется |
|--------|----------------|
| Патрульный вертолёт | Случайная точка в море (`TerrainMeta.RandomPointOffshore`) |
| Карго | Случайная точка в море |
| Чинук (CH47) | Точка в море, на 30 м выше воды |
| Самолёт аирдропа | За краем карты, на 250 м выше самой высокой точки рельефа |

### 3. Особые расписания

- `EventScheduleWipeOffset` — расписание, которое работает только в последние
  `event_hours_before_wipe` (по умолчанию **24**) реальных часа перед вайпом, если на сервере
  есть таймер вайпа.
- `EventScheduleDynamicTickrate` — то же расписание, но время умножается на `tickRate`
  (ускоренный или замедленный отсчёт).
- `RoadBradleys` — триггер, который досоздаёт «дорожных» Брэдли до числа
  `ceil(World.Size / 1000) * 2`: для карты 4000 м это 8 машин. Включён ли этот ивент на
  обычных серверах, по коду не видно: это решает префаб расписания.

### 4. Брэдли — свой таймер

`BradleySpawner` раз в 5 секунд проверяет, жив ли танк. Если нет, ставит респаун через
`Random.Range(respawnDelayMinutes - respawnDelayVariance, respawnDelayMinutes + respawnDelayVariance)`
минут. Таймер реальный (`Invoke`), а не игровой.

### 5. Чинук по вызову (Airfield)

На аэродроме есть терминал `AirfieldCallChinookTerminal`. Когда он заряжен и активирован, он
выбирает ближайшую зону сброса `CH47DropZone`. Если на карте нет чинука, который ещё может
сбросить ящик, терминал принудительно запускает расписание чинука (`eventSchedule.Trigger()`).
Уже летящий чинук бросает текущий маршрут и летит к вызванной зоне.

## Числа и настройки

| ConVar | По умолчанию | Что делает |
|--------|--------------|-----------|
| `server.events` | `true` | Главный выключатель всех расписаний |
| `events.set_event_enabled <id> <bool>` | — | Вкл/выкл конкретный ивент |
| `events.set_event_min_delay <id> <h>` | — | Мин. интервал, в **игровых часах** |
| `events.set_event_max_delay <id> <h>` | — | Макс. интервал, в игровых часах |
| `events.print_server_events` | — | Показать все ивенты и их интервалы |
| `eventschedule.triggerevent <имя>` | — | Запустить ивент вручную (поиск по части имени) |
| `event_hours_before_wipe` | 24 | Окно предвайповых ивентов, реальные часы |
| `bradley.respawnDelayMinutes` | 60 | Средняя задержка респауна Брэдли, мин |
| `bradley.respawnDelayVariance` | 1 | Разброс ± в минутах |
| `bradley.enabled` | `true` | Спаунить ли Брэдли |
| `heli.lifetimeMinutes` | 30 | Жизнь патрульного вертолёта |
| `cargoship.event_duration_minutes` | 50 | Длительность рейса карго |
| `hackablelockedcrate.requiredhackseconds` | 900 | Время взлома запертого ящика |

`events.set_event_*` для id `bradley` особый случай: он меняет не расписание, а
`bradley.enabled` и `bradley.respawnDelayMinutes`.

## Нюансы

- **Интервалы ивентов — в игровых часах.** Поле `minimumHoursBetween` и команды
  `events.set_event_*_delay` считают время суток TOD. Подсказка у команды говорит про
  «seconds», но это ошибка подсказки: в ответе команды написано «in-game hours», и код
  считает в часах.
- **Подсказка `bradley.respawnDelayVariance` врёт.** Там написано, что при 1.0 задержка
  будет от 0 до `respawnDelayMinutes`. На деле это разброс в **минутах**:
  `Range(60 − 1, 60 + 1)`, то есть Брэдли возвращается через 59–61 минуту после смерти.
- При ручном или терминальном запуске ивента таймер расписания тоже перезапускается: следующий
  «естественный» ивент будет не раньше чем через `minimumHoursBetween`.
- `TriggeredEvent` выбирается случайно из нескольких на одном расписании. Так одно расписание
  может давать разные варианты одного ивента.
- Таймер всех ивентов стоит, пока сервер грузится (`Rust.Application.isLoading`). Само
  расписание после рестарта начинается заново со случайного интервала: прогресс таймера не
  сохраняется.
- Общий для вертолёта и Брэдли приём: ящики при смерти падают физическими телами, и на каждом
  сидит огненный шар (`SetLockingEnt`). Пока он горит, ящик не открыть. Остальные «пустые»
  огненные шары разлетаются вокруг: их `12 − maxCratesToSpawn` штук.

## На практике

- Чтобы понять, когда ждать ивент, смотрите на часы в игре, а не на реальные.
- Брэдли можно планировать: убили — ровно через час (±1 мин) он снова на маршруте.
- Карго, вертолёт и чинук появляются с моря. Если сидеть на побережье, их видно заранее.

## Где в коде

- `EventSchedule.RunSchedule`, `EventSchedule.CountHours`, `EventSchedule.Trigger` — таймер и запуск.
- `TriggeredEventPrefab.RunEvent` — создание префаба ивента.
- `ConVar.Events.UpdateServerEvent` — команды `events.*`.
- `BradleySpawner.ScheduleRespawn` — респаун Брэдли.
- `RoadBradleys.GetDesiredNumber` — число дорожных Брэдли.
- `AirfieldCallChinookTerminal.Activate` — вызов чинука с аэродрома.
