---
id: building-blocked
title: Запрет строительства
kind: mechanic
group: Строительство
summary: Где и почему нельзя строить — зона чужого шкафа (16 м от блоков), монументы и динамические зоны запрета, дороги и рельсы, скалы, пещеры, глубокое море, вода и техника.
related: [construction-placement, building-privilege, tool-cupboard, building-grades, building-structure, foundation]
code: [BasePlayer.cs, BaseEntity.cs, Construction.cs, DeployVolume.cs, PreventBuildingMonumentTag.cs, DynamicPreventBuilding.cs, ConstructionErrors.cs, SocketMod_TerrainCheck.cs, SocketMod_EnvironmentVolume.cs, SocketMod_RoadCheck.cs, BuildingProximity.cs, Deployer.cs]
---

## Кратко

«Building blocked» в Rust — не одна проверка, а несколько независимых:

1. **Чужой шкаф.** Рядом есть постройка со шкафом, в котором вы не авторизованы. Сюда же
   относятся «шкафы» техники и легаси-укрытий.
2. **Зоны запрета.** Невидимые объёмы на слое Prevent Building: монументы, торговец-путешественник,
   место падения спутника, промышленные трубы.
3. **Местность.** Дороги и рельсы, скалы и монументы под фундаментом, пещеры и подземелья,
   глубокое море, вода.
4. **Геометрия.** Близость к блокам не по сокетам, место занято игроком или деревом.

Первые две дают ошибку `You don't have permission to build here` или `Cannot build this close
to <монумент>`, остальные — свои тексты. Общий порядок проверок описан в
[[construction-placement]].

## Как работает

### 1. Зона шкафа

`BaseEntity.GetBuildingPrivilege(OBB)` ищет все блоки постройки, до коробки которых от коробки
проверяемого объекта не больше **16 м** (`obb.Distance(...) > 16f` — отбрасывается).
У каждого блока берётся его постройка и её «главный» шкаф (`GetDominatingBuildingPrivilege` —
самый старый шкаф постройки). Если подходящих блоков несколько, побеждает **самый старый блок**
(`IsOlderThan`).

Значит, зона шкафа — это **16 м от любого блока постройки**, а не круг вокруг самого шкафа.
Подробнее — в [[building-privilege]].

Дальше `BuildingPrivlidge.CanBuild(player)`: вы в списке авторизованных, и у шкафа не стоит флаг
`Flag_BlockAllFromBuilding` (`Reserved6`). В коде его никто не выставляет, но в ассетах он стоит
в поле `flags` префабов «трупов» шкафа режима softcore — `cupboard.tool.corpse`,
`cupboard.tool.retro.deployed.corpse`, `cupboard.tool.shockbyte.deployed.corpse`
(`flags` = 16400 = `Locked` + `Reserved6`). В зоне такого «трупа» не строит никто, даже
авторизованные. У обычных шкафов и у `invisible_building_auth` флага нет.

**Три варианта проверки у игрока:**

| Метод | Нет шкафа | Шкаф, вы авторизованы | Шкаф, не авторизованы |
|---|---|---|---|
| `CanBuild` | можно | можно | нельзя |
| `IsBuildingBlocked` | не заблокировано | не заблокировано | заблокировано |
| `IsBuildingAuthed` | **нет** | да | нет |

Строительство и улучшение используют первые два. Снос использует `IsBuildingAuthed`,
поэтому без шкафа он невозможен (см. [[building-grades]]).

**Другие «шкафы».** До проверки шкафа идут ещё две:

- `IsBuildingBlockedByVehicle` — техника с собственной привилегией (`BaseVehicle.HasBuildingPrivilege`)
  ближе **2 м**, и вы в её привилегии не авторизованы. Сюда же относится станция постройки лодок.
- `IsBuildingBlockedByEntity` — сущность с `EntityPrivilege` ближе **3 м**, в коде это
  `LegacyShelter`, легаси-укрытие. Вы в нём не авторизованы — заблокировано.

**Невидимые шкафы.** В режиме Softcore (`GameModeSoftcore`) при `StorageContainer.dropCorpseOnDeath`
учитываются и «невидимые» шкафы из сетки `InvisibleAuthGrid` — тоже на 16 м.

### 2. Где проверяется право

- `Construction.UpdatePlacement` → `target.player.CanBuild(...)` — по позиции **игрока**.
- `Construction.UpdatePlacement` → `IsBuildingBlocked(placement, bounds)` — по коробке **нового
  объекта**.
- `Planner.DoBuild` → `ownerPlayer.CanBuild()` — ещё раз по игроку.
- `BuildingProximity.Check` — если новый блок примыкает к постройке со шкафом, где вы
  не авторизованы: `Cannot attach to unauthorized building`.

Префаб может отключить эти проверки флагом `Construction.canBypassBuildingPermission`.
По ассетам флаг включён у:

- **всех четырёх полов** — `floor`, `floor.triangle`, `floor.frame`, `floor.triangle.frame`
  (и их лодочных вариантов);
- деревянной настенной лестницы `ladder.wooden.wall` и лодочной лестницы;
- карьера `mining_quarry` и нефтекачалки `mining.pumpjack`;
- осадных деплоев `explosivesiegedeployable`, `flammablesiegedeployable`, осадной башни, буксира;
- высаживаемых растений (ягоды, роза, орхидея, подсолнух).

Значит, пол и лестницу можно поставить в зоне чужого шкафа, в том числе пристроив к чужому зданию.

### 3. Монументы и зоны Prevent Building

Объёмы запрета — коллайдеры на слое **Prevent Building** (слой 29, маска `536870912`).
Их «видят» объёмы `DeployVolume` каждого префаба: маска по умолчанию `537001984` — это
Prevent Building плюс слой игроков на сервере.

`DeployVolume.CheckFlags` для каждого задетого коллайдера:

- тег `DeployVolumeIgnore` — пропустить;
- `ColliderInfo` с `OnlyBlockBuildingBlock` мешает только блокам постройки, с `OnlyBlockDeployables` —
  только деплоям;
- тег `BlockPlacement` — запрет всегда;
- коллайдер принадлежит монументу, монумент **не** зона безопасности, а объём объекта игнорирует
  флаг `Monument` — пропустить. Так отдельные деплои разрешены на монументах, но никогда —
  в мирных городах;
- флаг `OnlyEvaluatePreventBuildingInMonuments` — учитывать только коллайдеры, принадлежащие
  монументу.

Если на коллайдере есть `PreventBuildingMonumentTag` с привязанным монументом, ошибка будет
`Cannot build this close to <название монумента>` (`ConstructionErrors.GetBlockedByErrorFromCollider`).
Тег может сам найти ближайший монумент (`autoFindMonument`).

**Динамические зоны запрета** — те же объёмы, появляющиеся и исчезающие во время игры:

| Источник | Как |
|---|---|
| Торговец-путешественник | `TravellingVendor.CreatePreventBuilding` — объём едет вместе с ним как дочерний объект |
| Падение спутника | `SatelliteControlComputer.SpawnPreventBuildingVolume` резервирует место крушения. Место выбирается с отступом `satellite.site_clearance_radius` = 16 м от построек, зон запрета и зон безопасности |
| Промышленные трубы | `IOEntity` вдоль каждой трубы ставит капсулы `ioentitypreventbuilding.prefab`. Ошибка `Blocked by industrial piping` |
| `DynamicPreventBuilding` | Пустой класс-сущность, вся логика в коллайдере префаба |

**Замки и прочие «слотовые» деплои** (`Deployer.DoDeploy_Slot`) проверяют ещё и позицию
игрока: если он стоит в зоне запрета монумента (`IsBuildBlockedByMonument`, сфера 0,1 м
в позиции игрока), ставить нельзя.

### 4. Дороги и рельсы

`Construction.TestPlacingCloseToRoad`, если в префабе нет `canPlaceOnRoads`:

- берётся высота объекта над ландшафтом `h`; если `h > 9 м`, проверка пропускается;
- радиус проверки `r = lerp(3 м, 0, h / 9)`: на земле 3 м, к высоте 9 м сходит на нет;
- в 5 точках (центр и 4 нижних угла коробки) берётся топология в радиусе `r`;
- если там есть биты `0x80800`, ставить нельзя: `Placing too close to road`.

Маска `0x80800` совпадает с той, по которой лошадь определяет «идеальное покрытие»
(`RidableHorse`). Почти наверняка это дорога и рельсы. Сам enum топологии вне этой сборки,
поэтому точные имена битов не проверены.

Отдельно некоторые префабы несут `SocketMod_RoadCheck`, который ищет коллайдеры с тегом
дороги (`Cannot be placed on road`).

### 5. Скалы, монументы под фундаментом, пещеры

- **Сквозь скалу:** `TestPlacingThroughRock` — линии от игрока к объекту не должны пересекать
  слой World.
- **«В земле»:** `SocketMod_TerrainCheck` смотрит вниз на 3 м от точки. Попали в слой World —
  проверяется, чей коллайдер. Монумент или `NPCDwelling` → `Cannot be placed on monument`,
  если у мода включён `preventWorldLayerInMonuments`. В ассетах он включён только у двойной
  деревянной баррикады `barricade.cover.wood_double`; у фундаментов, пандуса и стен он выключен,
  и скала монумента для них — обычная «земля». Тег `AllowBarricadePlacement` разрешает,
  `BlockBarricadePlacement` запрещает. Если коллайдеров нет, точка считается в земле, когда
  поверхность ландшафта выше неё и в этом месте ландшафт не «вырезан» (`TerrainCollision.GetIgnore` —
  входы в пещеры и туннели). За границей карты — `Not in terrain`.
- **Подземелья, туннели, пещеры:** `SocketMod_EnvironmentVolume` с запрещёнными типами окружения
  (`TrainTunnels`, `Underground`, `NoSunlight`, `Building` и др.). Ошибки вида
  `Can't be placed Underground`.

Какие из этих модов стоят на блоках постройки — см. таблицу в [[construction-placement]].
`SocketMod_EnvironmentVolume` у блоков постройки нет.

### 6. Вода и глубокое море

- **Глубокое море:** при `deepsea.block_building` = true строить в зоне глубокого моря можно
  только на лодке (цель — сама лодка, вы авторизованы в её привилегии и стоите на ней) или в зоне станции постройки лодок. Без цели-сущности в глубоком море ставить нельзя вовсе. Иначе —
  `Cannot build in the deep sea`.
- **Вода:** ограничения на воду задаются модами `SocketMod_InWater` (в воде или не в воде)
  и `SocketMod_WaterDepth` (глубина в диапазоне, по умолчанию 2–4 м) на конкретных префабах.
  Общего запрета строить в воде в коде нет. У блоков постройки модов `SocketMod_InWater` и
  `SocketMod_WaterDepth` нет: фундамент на мелководье ограничен только проверкой «в земле»
  (точки под водой, но ниже дна, считаются в земле).

### 7. Геометрия и посторонние объекты

- `BuildingProximity` — `Too close to <блок>`, если новый блок не по сокетам ближе 1,49 м
  к существующему. Владелец не важен. Подробно — [[construction-placement]].
- `DeployVolume` — объект задевает игрока, дерево, руду, лошадь, машину: `Blocked by …`.
- Рядом с большой техникой (сфера 5 м) часть деплоев не ставится: `Cannot deploy near a large vehicle`.

## Числа и настройки

| Что | Значение | Откуда |
|---|---|---|
| Зона шкафа | 16 м от коробки любого блока постройки | константа в `BaseEntity.GetBuildingPrivilege` |
| Привилегия техники | 2 м | `BasePlayer.GetVehicleBuildingPrivilege` |
| Привилегия сущности (легаси-укрытие) | 3 м | `BasePlayer.IsBuildingBlockedByEntity` |
| Дорога: радиус у земли | 3 м, линейно до 0 на высоте 9 м | `Construction.TestPlacingCloseToRoad` |
| Дорога: высота отключения проверки | 9 м над ландшафтом | там же |
| Проверка «в земле» | луч 3 м вниз | `SocketMod_TerrainCheck.IsInTerrain` |
| Место падения спутника | `satellite.site_clearance_radius` = 16 м | `ConVar.Satellite` |
| Запрет в глубоком море | `deepsea.block_building` = true | `ConVar.DeepSea` |
| Слой Prevent Building | маска `536870912` | `ConstructionErrors.IsBuildBlockedByMonument` |
| Маска `DeployVolume` по умолчанию | `537001984` | поле `DeployVolume.layers` |

## Нюансы

- **Зона — от блоков, а не от шкафа.** Каждая новая стена на краю базы двигает границу
  «запрета» на 16 м дальше. Длинная стена из фундаментов перекрывает огромную полосу.
- **Перекрытие зон решает возраст.** Если вы в зоне двух построек, действует шкаф постройки
  с самым старым блоком в радиусе.
- **Блокирует и ваша позиция.** Если вы стоите в чужой зоне, строить нельзя даже туда,
  где зоны нет. Работает и наоборот: блок в чужую зону не поставить, стоя у себя.
- **Шкаф не нужен для улучшения, но нужен для сноса.** Вне зоны любого шкафа любой игрок
  может улучшать и поворачивать ваши свежие блоки. Снести их не может никто, включая вас.
- **Мирные города защищены жёстче.** Деплои с флагом игнорирования монументов можно ставить
  на обычных монументах, но не в зонах безопасности.
- **Торговец-путешественник — движущаяся зона запрета.** Пока он проезжает, рядом с ним
  ничего не построить.
- **Трубы режут бункеры.** При изменении модели блока, например когда крыша поменяла облик,
  с `server.enforcepipechecksonbuildingblockchanges` = true сервер ищет внутри блока промышленные
  трубы и отсоединяет их (`BuildingBlock.CheckForPipes`). Подсказка ConVar прямо называет
  «roof bunkers».
- **Высоко над дорогой — можно.** На высоте больше 9 м над ландшафтом проверка дороги
  не выполняется.

## На практике

- Чтобы не дать соседу строиться вплотную, достаточно иметь блоки ближе 16 м к нужному месту.
  Это значит шкаф и любой блок, хоть фундамент без стен.
- Перед стройкой у дороги отступите от неё хотя бы на 3 м по краям фундамента.
- Если пишет `Cannot build this close to …`, вы в объёме монумента. Объёмы невидимы, отходите,
  пока ошибка не пропадёт.
- Ставьте шкаф сразу: без него нельзя снести неудачный блок, а соседи могут поворачивать ваши стены.

## Где в коде

- `BasePlayer.CanBuild`, `IsBuildingBlocked`, `IsBuildingAuthed`, `IsBuildingBlockedByVehicle`, `IsBuildingBlockedByEntity`, `IsBuildBlockedByMonument`.
- `BaseEntity.GetBuildingPrivilege(OBB, …)` — поиск шкафа в 16 м.
- `BuildingPrivlidge.CanBuild`, `BuildingManager.Building.GetDominatingBuildingPrivilege`.
- `Construction.UpdatePlacement`, `TestPlacingCloseToRoad`, `TestPlacingThroughRock`.
- `DeployVolume.CheckFlags`, `ConstructionErrors.GetBlockedByErrorFromCollider`, `PreventBuildingMonumentTag`.
- `TravellingVendor.CreatePreventBuilding`, `SatelliteControlComputer.SpawnPreventBuildingVolume`, `IOEntity` (трубы), `BuildingBlock.CheckForPipes`.
- `SocketMod_TerrainCheck`, `SocketMod_EnvironmentVolume`, `SocketMod_RoadCheck`, `SocketMod_InWater`, `SocketMod_WaterDepth`.
