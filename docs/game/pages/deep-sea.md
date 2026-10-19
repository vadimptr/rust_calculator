---
id: deep-sea
title: Глубокое море
kind: mechanic
group: Сервер и режимы
icon: ptboat
summary: Глубокое море — отдельный квадрат 4×4 км за краем карты, куда попадают через порталы в 750 м от берега только на разрешённых лодках; оно открыто 3 часа, в последние 5 минут заливается радиацией, а при закрытии убивает всех, кто внутри, и стирает всё, затем закрыто 1.5 часа.
related: [day-night-weather, cargo-ship, vehicles, patrol-helicopter, radiation, locked-crate, world-events, wipe-and-saves, server-convars]
code: [DeepSeaManager.cs, ConVar/DeepSea.cs, TriggerDeepSeaPortal.cs, DeepSeaPortal.cs, Climate.cs, Construction.cs, PlayerBoat.cs, PatrolHelicopterAI.cs, BaseGameMode.cs]
---

## Кратко

Глубокое море (`DeepSeaManager`) — периодический «данж» в океане. Его границы — фиксированный
куб `DeepSeaBounds`: центр (−5900, 0, 0), размер 4000 м. То есть это квадрат 4×4 км к западу
от основной карты (на карте 4500 м её край — x = −2250). Попасть туда можно только через портал
на лодке.

Внутри при открытии генерируются (`GenerateContentAsync`):

| Что | Сколько | ConVar |
|-----|---------|--------|
| Острова | 6 | `deepsea.island_count` |
| Корабли-призраки | 4 | `deepsea.ghostship_count` |
| Плавучий город | 1 | `deepsea.floatingcity_count` |
| Группы RHIB с NPC | 4 | `deepsea.rhib_count` |
| Взламываемый ящик (на корабле-призраке) | 1 | `deepsea.hackablecrate_count` |

## Как работает

### Цикл (`DeepSeaManager.ServerTick`, раз в секунду)

1. **Закрыто.** Отсчёт `TimeToNextOpening`: случайно между `deepsea.wipecooldownmin` и `max`
   (оба 5400 с = 1.5 ч). После вайпа сервера море по умолчанию тоже сначала ждёт этот срок
   (`deepsea.openonserverwipe` = false).
2. **Открытие** (`OpenDeepSeaAsync`): генерация содержимого, навмеши, порталы, `TimeToWipe` =
   `deepsea.wipeduration` = **10800 с (3 ч)**.
3. **Конец.** За `deepsea.wipeendphaseduration` = 1800 с погода внутри плавно портится от
   «штиля» к шторму (`Climate.DeepSeaWeatherState`, пресеты `Clear_DeepSea` → `Storm_DeepSea`).
   В заданные моменты игрокам внутри показываются предупреждения (`wipeSteps`), в плавучем городе
   включается тревога.
4. **Радиация.** За `deepsea.wiperadiationphaseduration` = **300 с** до конца включается
   радиационная зона, её сила растёт до **60** по кривой `EndWipeRadiationCurve`. В это же время
   **вход закрыт** (`CanTeleportToDeepSea` → «скоро закроется»).
5. **Закрытие** (`CloseDeepSeaAsync`): порталы гаснут, затем трижды проходит зачистка
   `KillAllEntitiesAsync`: каждый живой игрок внутри получает **1000 урона радиацией**, NPC и все
   остальные сущности в море удаляются. Туман войны на карте моря у всех сбрасывается.

### Порталы

Входные порталы стоят в `deepsea.island_portal_terrain_distance` = 750 м от берега основной
карты, со случайной стороны света (`deepsea.forceentranceportaldirection` = 0 — случайно). Выход
— на противоположной стороне моря.

Кого пропускает портал (`IsAllowedInDeepSea`):

- **лодку из белого списка** (`vehicleWhitelist` в префабе менеджера, состав неизвестен) вместе
  со всеми, кто на ней; лодку игрока (`PlayerBoat`) — только если рядом с ней нет неразрешённых
  вертолётов, лодок и подлодок;
- игрока **вплавь — нет** (`deepsea.allow_swimmers` = false), стоящего на неразрешённом
  транспорте — нет, сидящего, спящего — нет. На лодку с NPC-пассажиром — нет;
- любую технику — только при `deepsea.allow_all_vehicles` = true.

При отказе показывается подсказка: «нужна лодка», «лодка недостаточно прочная», «неразрешённый
транспорт».

### Правила внутри

- **Строить нельзя.** `deepsea.block_building` = true запрещает ставить всё, у чего нет флага
  `canBeDeployedInDeepSeaWater` (`Construction`). Строить лодку (`PlayerBoat`) в море тоже нельзя.
- **Патрульный вертолёт** не выбирает целями игроков в глубоком море и бросает их, если они туда
  ушли (`PatrolHelicopterAI`, [[patrol-helicopter]]).
- **Карта**: у моря свой туман войны (`server.deepseafogofwar` = true). Режим с
  `blockMapInDeepSea` закрывает карту внутри.
- **Температура** — по кривой умеренного биома, погода своя ([[day-night-weather]]).
- **Безопасная зона** в плавучем городе: лодки игроков в ней не получают урона
  (`PlayerBoat.TakeDamage`).
- Доступ к ферме NPC (`NPCFarmAccess`) требует «платы едой» (`RegisterPaidFoodToll`); оплата
  сбрасывается при закрытии моря.
- Количество лута можно менять `deepsea.loot_scale` и `deepsea.loot_respawn_scale` (1 и 1).

## Числа и настройки

| ConVar | По умолчанию | Смысл |
|--------|-------------|-------|
| `deepsea.enabled` | true | глубокое море (нужен рестарт) |
| `deepsea.wipeduration` | 10800 | сколько открыто, с |
| `deepsea.wipecooldownmin` / `max` | 5400 / 5400 | сколько закрыто, с |
| `deepsea.wipeendphaseduration` | 1800 | фаза ухудшения погоды, с |
| `deepsea.wiperadiationphaseduration` | 300 | фаза радиации и закрытого входа, с |
| `deepsea.openonserverwipe` | false | открыть сразу после вайпа |
| `deepsea.island_portal_terrain_distance` | 750 | порталы от берега, м |
| `deepsea.allow_swimmers` | false | пускать вплавь |
| `deepsea.allow_all_vehicles` | false | пускать любую технику |
| `deepsea.block_building` | true | запрет строительства |
| `deepsea.island_count`, `ghostship_count`, `floatingcity_count`, `rhib_count`, `hackablecrate_count` | 6, 4, 1, 4, 1 | содержимое |
| `deepsea.loot_scale`, `loot_respawn_scale` | 1, 1 | множители лута |

## Нюансы

- **Закрытие — гарантированная смерть.** Урон 1000 радиацией проходит три раза подряд. Кто не
  вышел через выходной портал до конца отсчёта, умирает, а лодка и всё в ней удаляются. Труп
  тоже пропадает: зачистка удаляет все сущности внутри границ.
- **Последние 5 минут — только на выход.** Вход уже закрыт, а радиация растёт до 60.
- **Сохранение.** Море со всем содержимым пишется в сохранение. После рестарта открытое море
  восстанавливается (`PostServerLoad`: радиация, порталы, навмеши), отсчёт `TimeToWipe`
  продолжается с сохранённого значения.
- **Вертолёт не преследует.** Уход в глубокое море — способ сбросить патрульный вертолёт.
- **Отключение сносит всё.** Если админ выключит `deepsea.enabled`, при следующем старте всё
  содержимое моря будет уничтожено (`CloseAndDestroyDeepSea`).

## На практике

- Цикл моря — 4.5 часа: 3 часа открыто, 1.5 закрыто.
- Выходите не позже чем за 5 минут до закрытия: дальше радиация, а в самом конце — смерть.
