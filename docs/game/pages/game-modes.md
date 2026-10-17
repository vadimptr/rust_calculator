---
id: game-modes
title: Режимы игры (vanilla, softcore, hardcore)
kind: mechanic
group: Сервер и режимы
summary: Режим сервера — это сущность BaseGameMode с флагами (карта, команды, чат, спальники) и ConVar; softcore удваивает добычу, возвращает половину пояса и инвентаря после смерти (одежду из-за перевёрнутого ConVar — нет) и ограничивает рейды окном по часам.
related: [raid-window, teams, death-drop, respawn, sleeping-bag, wounded, gathering, safe-zones, server-convars, wipe-and-saves, tool-cupboard, building-privilege]
code: [BaseGameMode.cs, GameModeVanilla.cs, GameModeSoftcore.cs, GameModeHardcore.cs, EraGameMode.cs, PrimitiveGameMode.cs, ReclaimManager.cs, ReclaimTerminal.cs, ConVar/gamemode.cs, ConVar/Softcore.cs, ConVar/Server.cs, GameSetup.cs, ItemContainer.cs, BaseCombatEntity.cs]
---

## Кратко

Режим игры — это невидимая сущность-синглтон `BaseGameMode`, которая создаётся при старте
из префаба `assets/prefabs/gamemodes/<имя>.prefab`. Имя берётся из ConVar `server.gamemode`.
Если ConVar пуст, режима нет вовсе (`BaseGameMode.CreateGameMode` пишет «No Gamemode.»), и
сервер работает на голых ConVar, то есть как обычный ванильный.

Режим делает три вещи:

1. **Выставляет ConVar и флаги**: карта, компас, команды, глобальный чат, Rust+, лимит спальников
   и т. д. (`OnCreated_Vanilla`, `ApplyConVars`). Плюс выполняет список команд `convars` из префаба.
2. **Подменяет правила** через виртуальные методы: что происходит при смерти, сколько живёт труп,
   можно ли брать вещи из инвентаря раненого, сколько стоит крафт.
3. **Убирает лишнее с карты**: NPC и турели в безопасных зонах, MLRS, NPC-квестодателей
   (`DeleteEntities`), если соответствующий флаг выключен.

Известные режимы в коде (`GameSetup.GameModeShortName`): `vanilla`, `softcore`, `hardcore`,
`primitive`, а также мини-игры `deathmatch`, `teamdeathmatch`, `onedeath`, `kingofthehillDM`,
`kingofthehillTeam`, `weapontest`. Свой C#-класс есть только у `GameModeVanilla` (пустой),
`GameModeSoftcore`, `GameModeHardcore` и `PrimitiveGameMode` (пустой, наследник `EraGameMode`).
Остальное — разные значения полей в префабах.

## Как работает

### Флаги базового режима (`BaseGameMode`)

Значения по умолчанию в классе (в префабе режима могут быть другими):

| Поле | По умолчанию | Что делает |
|------|-------------|-----------|
| `globalChat` / `localChat` | да / нет | пишет в `chat.globalchat` / `chat.localchat` |
| `teamSystem` | да | если нет — `relationshipmanager.maxteamsize = 0`, команды выключены ([[teams]]) |
| `safeZone` | да | если нет — в Outpost/Bandit Camp и городах убиваются NPC, турели-миротворцы и `Marketplace` ([[safe-zones]]) |
| `ingameMap`, `compass` | да | `server.mapenabled`, `server.compassenabled` |
| `fogOfWar`, `fogOfWarRevealSize` | нет, 256 | `server.fogofwar`, `server.fogofwarrevealsize` |
| `hidePlayerOnMap`, `hideMapPlayerDirectionIndicator` | нет | своя метка и направление на карте |
| `contactSystem` | да | `relationshipmanager.contacts` |
| `crawling` | да | `server.crawlingenabled` (ползком при ранении, см. [[wounded]]) |
| `rustPlus` | да | включает или гасит сервер Rust+ |
| `maximumSleepingBags` | −1 | если не −1 — перезаписывает `server.max_sleeping_bags` (по умолчанию 15) |
| `missionSystem`, `mlrs` | да | без них удаляются квестодатели и MLRS |
| `wipeBpsOnProtocol` | нет | вайп чертежей при смене протокола ([[wipe-and-saves]]) |
| `limitTeamAuths` | нет | шкаф и турель «полны», когда авторизовано столько же, сколько размер команды |
| `permanent` | да | режим нельзя сменить командой `gamemode.set` без перезапуска сервера |
| `allowSleeping`, `allowWounding`, `allowBleeding`, `allowTemperature` | да | отключают спящих, ранение, кровотечение, температуру |

Остальные поля (`matchDuration`, `warmupDuration`, `teams`, `loadouts`, `numScoreForVictory`, очки)
нужны только мини-играм: варм-ап, матч, победа по счёту, раздача наборов (`LoadoutPlayer`).

### Модификаторы лута и крафта

- `LootDistributionModifiers` — прибавка к весу предмета в таблицах лута по типу
  (`ItemDefinition.lootDistributionType`), `GetLootWeightModifier`.
- `CraftingCostModifiers` — множитель цены крафта по тому же типу, `GetCraftingCostModifier`.
  В hardcore множитель может браться из ConVar `server.hardcorefirearmammunitioncraftingmultiplier`
  (по умолчанию 1) — так задаётся цена крафта огнестрельных патронов.
- `Restrictions` и `allowedTechTrees` — запрет предметов и деревьев технологий по «эпохам»
  (см. ниже).

### Softcore

`GameModeSoftcore` наследует vanilla и добавляет:

**Двойная добыча.** `gamemodesoftcore.gather_rate` = **2** (сохраняемый ConVar). Умножает выход с руды,
деревьев, брёвен, растений и животных (`ResourceDispenser`), с подбираемых ресурсов
(`CollectibleEntity`) и даже с карьеров (`MiningQuarry`). Результат округляется, минимум 1.

**Возврат вещей после смерти (reclaim).** `GameModeSoftcore.OnPlayerDeath`:

Код вызывает `ItemContainer.RemoveFractionOfContainer(список, 1 − доля)` и отправляет
**вынутое** в хранилище возврата `ReclaimManager`. То есть в возврат попадает `1 − доля`, а
`доля` остаётся на трупе. Для пояса и инвентаря это незаметно (0.5 = 0.5), а для одежды смысл
ConVar переворачивается:

| Контейнер | ConVar (по умолчанию) | Вернут при возрождении | Останется на трупе |
|-----------|----------------------|------------------------|--------------------|
| Пояс | `gamemodesoftcore.reclaim_fraction_belt` = 0.5 | 50 % | 50 % |
| Основной инвентарь | `gamemodesoftcore.reclaim_fraction_main` = 0.5 | 50 % | 50 % |
| Содержимое рюкзака | тот же `reclaim_fraction_main` | 50 % | 50 % |
| Одежда и броня | `gamemodesoftcore.reclaim_fraction_wear` = 1 | **0 %** | 100 % |

Справка ConVar обещает «1.0 = сохранить 100 % одежды», но `RemoveFractionOfContainer` при доле
0 сразу выходит, и одежда в возврат не попадает. Если сервер (или префаб режима, которого нет
в выгрузке) выставит `reclaim_fraction_wear` = 0, одежда будет возвращаться полностью.

При следующем возрождении (`OnPlayerRespawn`) вещи сами возвращаются в инвентарь
(`PlayerReclaimEntry.GiveToPlayer`): одежда, пояс, основной, затем рюкзак. Что не влезло, падает
рюкзаком-сумкой (`item_drop_backpack`) под ноги.

Как делится половина (`ItemContainer.RemoveFractionOfContainer`):

- **Стаки** делятся пополам. Дробная часть разыгрывается случайно, и остаток переносится между
  стаками одного типа: из трёх стаков по 5 серы вернётся 7 или 8.
- **Одиночные предметы** (оружие, инструменты, всё с количеством 1) перемешиваются, и в возврат
  уходит `Mathf.RoundToInt(n × 0.5)` штук. Округление банковское (к чётному): из 1 предмета —
  **0**, из 2 — 1, из 3 — 2, из 4 — 2, из 5 — 2, из 6 — 3.
- Стартовые предметы (`rock`, `torch`, `cakefiveyear`, `partyhat`, `snowball`) в расчёт не
  попадают и всегда остаются на трупе.

Возврата **нет**, если:

- смерть от самоубийства (F1 kill), когда игрок не был ранен — `gamemodesoftcore.reclaim_suicide` = false;
- игрок умер **внутри своей базы**, в зоне шкафа, где он авторизован —
  `gamemodesoftcore.reclaim_building_auth` = false;
- игрок в обучении или в «закрытой» сетевой группе.

Хранилище живёт `reclaimmanager.reclaim_expire_minutes` = **120 мин**, после чего вещи
уничтожаются. Проверка — раз в 60 с (`TickEntries`).

**Нельзя обыскать раненого.** При ранении инвентарь блокируется (`SetInventoryLocked`), и
`CanMoveItemsFrom` не даёт вытащить из него ни одного предмета. После поднятия — разблокируется
(если игрок не связан).

**Трупы в безопасных зонах** удаляются через **30 с** вместо `server.corpsedespawn` = 300 с
(`GameModeSoftcore.CorpseRemovalTime`).

**«Трупы» ящиков и шкафа.** Если включено `storagecontainer.dropcorpseondeath`, разрушенный
контейнер оставляет `ContainerCorpse` со своими вещами (`BaseCombatEntity.ShouldDropDeployableCorpse`).
Не оставляет, если его сломал владелец или игрок с правами шкафа, если он сгнил (`Decay`) или
стоял на лодке. Труп шкафа (`cupboard.tool.corpse`) — это невидимый шкаф (`IsInvisibleAuth`):
он продолжает давать запрет строительства в радиусе 16 м (`BaseEntity.GetBuildingPrivilege`,
блок `InvisibleTC`). `gamemodesoftcore.allow_tc_corpse_no_building` = true разрешает труп шкафа, даже
если у шкафа нет здания.

**Окно рейдов** — отдельная страница [[raid-window]].

**Точки возрождения** в Outpost и Bandit Camp: префабы
`gamemodes/softcore/staticrespawnzonecompound` и `staticrespawnzonebandit` (`StaticRespawnArea`),
см. [[respawn]].

### Hardcore

У `GameModeHardcore` в коде только две вещи:

- множитель крафта патронов берётся из `server.hardcorefirearmammunitioncraftingmultiplier`
  (по умолчанию 1, то есть без изменений, пока сервер не поменяет);
- при старте переработчики пересчитывают, стоят ли они в безопасной зоне (`Recycler.UpdateInSafeZone`).

Всё остальное (отключённая карта, компас, контакты, Rust+ и т. п.) задаётся полями префаба
`hardcore.prefab`, которого нет в выгрузке ассетов. По данным сообщества, в hardcore нет карты,
команд в интерфейсе и Rust+; в коде это не подтверждено.

### Эпохи (`server.era`)

`server.era` принимает `none`, `primitive`, `medieval` (или `siege`), `frontier`, `modern` (или `rust`).
Режим-эпоха (`EraGameMode`, `PrimitiveGameMode`) через `Restrictions` разрешает только предметы
своей эпохи (`BaseGameMode.IsAllowed`). Админ-команда `server.enforce_era_restrictions` удаляет
с сервера всё, что эпохе не положено.

### PvE (`server.pve`)

Это не режим, а ConVar (по умолчанию false). При нём:

- урон игрока по другому игроку **не наносится, а возвращается стрелку** как `Generic`
  (`BasePlayer.Hurt`);
- так же отражается **любой** урон игрока по строительным блокам (`BuildingBlock.Hurt`), в том
  числе по своим;
- строительные блоки можно сносить всегда, а не только 10 минут после постройки
  (`DecayEntity.IsDemolishable`).

## Числа и настройки

| ConVar | По умолчанию | Смысл |
|--------|-------------|-------|
| `server.gamemode` | пусто | имя режима при старте |
| `gamemode.set <имя>` | — | сменить режим на лету (если текущий не `permanent`) |
| `gamemodesoftcore.gather_rate` | 2 | множитель добычи в softcore |
| `gamemodesoftcore.reclaim_fraction_belt` / `_main` / `_wear` | 0.5 / 0.5 / 1 | по коду — доля, что остаётся на трупе (вернут `1 − доля`) |
| `gamemodesoftcore.reclaim_suicide` | false | возвращать ли вещи после F1 kill |
| `gamemodesoftcore.reclaim_building_auth` | false | возвращать ли при смерти в своей базе |
| `gamemodesoftcore.allow_tc_corpse_no_building` | true | труп шкафа без здания |
| `reclaimmanager.reclaim_expire_minutes` | 120 | срок хранения возврата |
| `storagecontainer.dropcorpseondeath` | false | контейнеры оставляют «труп» с лутом |
| `server.hardcorefirearmammunitioncraftingmultiplier` | 1 | цена крафта патронов в hardcore |
| `server.pve` | false | PvE: урон по игрокам и блокам отражается |
| `server.era` | none | эпоха |

## Нюансы

- **Терминал возврата не работает.** `ReclaimTerminal.LoadReclaimLoot` берёт запись игрока
  (`GetReclaim`), но результат отбрасывает и перебирает пустой список. Терминал всегда пуст:
  вещи возвращаются только автоматически при возрождении.
- **Срок хранения сбрасывается при рестарте.** `timeAlive` записи в сохранение не пишется, после
  загрузки отсчёт 120 минут начинается с нуля. Вторая смерть до получения вещей тоже обнуляет
  срок: новые вещи добавляются в ту же запись.
- **Умереть дома — хуже, чем в поле.** При смерти в зоне своего шкафа возврата нет: всё остаётся
  на трупе. Смысл в том, что труп лежит у вас в базе.
- **Единственный ствол не вернётся никогда.** Один одиночный предмет даёт `RoundToInt(0.5)` = 0.
  Если в поясе один автомат и пачка патронов, патроны вернутся наполовину, автомат — нет.
- **Рюкзак.** Его содержимое режется на 50 %. Если бы рюкзак сам ушёл в возврат (при
  `reclaim_fraction_wear` < 1), оставшаяся половина перекладывается в инвентарь трупа, а лишнее
  выпадает отдельной сумкой. Если возвращаемая половина есть только в рюкзаке, а пояс, одежда и
  инвентарь ничего не дали, запись возврата не создаётся (`obj.Count > 0 || obj2.Count > 0 ||
  obj3.Count > 0`), и эти вещи пропадают.
- **PvE не защищает двери и деплои.** Отражение урона есть только в `BasePlayer.Hurt` и
  `BuildingBlock.Hurt`. Двери, ящики, шкаф, турели наследуют обычный `BaseCombatEntity.Hurt`,
  и на PvE-сервере их можно ломать.
- **PvE-отражение бьёт по броне.** Возвращённый урон идёт типом `Generic` через обычную защиту,
  поэтому одежда стрелка его частично гасит.
- **Значения в префабах режимов неизвестны.** Префабы `assets/prefabs/gamemodes/*.prefab` не
  попали в выгрузку. Например, лимит спальников в softcore может отличаться от 15.

## На практике

- В softcore при настройках по умолчанию одежда остаётся на трупе целиком: её надо забирать с тела.
- Одиночные предметы возвращаются случайной половиной с округлением к чётному: из трёх стволов
  вернутся два, из одного — ни одного.
- На PvE-сервере стрельба по игроку убьёт вас самого.

## Где в коде

- `BaseGameMode.CreateGameMode`, `OnCreated_Vanilla`, `ApplyConVars`, `DeleteEntities` — создание и флаги.
- `GameModeSoftcore.OnPlayerDeath`, `OnPlayerRespawn`, `CorpseRemovalTime`, `SetInventoryLocked`, `CanMoveItemsFrom`.
- `ItemContainer.RemoveFractionOfContainer` — деление стаков.
- `ReclaimManager.AddPlayerReclaim`, `TickEntries`, `PlayerReclaimEntry.GiveToPlayer`.
- `GameModeHardcore.GetCraftingCostConVar`.
- `BasePlayer.Hurt`, `BuildingBlock.Hurt`, `DecayEntity.IsDemolishable` — PvE.
- `ConVar.gamemode.set`, `ConVar.Softcore`, `ConVar.Server.era`.
