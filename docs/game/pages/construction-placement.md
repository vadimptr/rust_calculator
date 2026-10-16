---
id: construction-placement
title: Размещение и сокеты
kind: mechanic
group: Строительство
summary: Как план строительства решает, можно ли поставить блок — сокеты «папа/мама», проверки SocketMod, объёмы DeployVolume, близость к чужим блокам, дороги и права шкафа.
related: [building-blocked, building-grades, conditional-models, stability, building-structure, building-privilege, tool-cupboard, foundation, wall, floor, roof, stairs, ramp, data-building-blocks]
code: [Planner.cs, Construction.cs, Socket_Base.cs, ConstructionSocket.cs, Socket_Specific.cs, Socket_Free.cs, Socket_Terrain.cs, NeighbourSocket.cs, StabilitySocket.cs, CornerSocket.cs, SocketMod.cs, SocketMod_AreaCheck.cs, SocketMod_TerrainCheck.cs, DeployVolume.cs, BuildingProximity.cs, ConstructionErrors.cs, EntityLink.cs]
---

## Кратко

Каждый блок постройки и каждый деплой описан префабом с компонентом `Construction`. В нём лежат
**сокеты** — точки, которыми блок цепляется к другим, — и на сокетах висят **моды-проверки**
(`SocketMod_*`). Когда игрок жмёт ЛКМ с планом строительства, клиент присылает «куда целился»
(`Construction.Target`), а сервер заново прогоняет всю цепочку: подбирает подходящий сокет,
вычисляет позицию и поворот, проверяет моды, объёмы, линию видимости, дороги, близость
к другим блокам и права шкафа. Первая успешная комбинация побеждает. Если ни одна не прошла,
игрок видит текст последней ошибки.

Сервер клиенту не доверяет: позиция и поворот всегда считаются заново по сокетам.

## Как работает

### 1. Запрос на постройку (`Planner.DoBuild`)

Порядок проверок до размещения:

1. Префаб найден (`Couldn't find construction`).
2. Хватает ресурсов на **базовый грейд** блока (`Planner.CanAffordToPlace`, берётся
   `defaultGrade.CostToBuild()`, для блоков это солома). Не хватает — тихий отказ с подсветкой
   недостающих ресурсов.
3. Цель — существующая сущность: координаты из запроса переводятся из её локальных в мировые.
   Названный сокет ищется по имени (`Couldn't find socket`). Деплой «просто на дверь» без сокета
   запрещён (`Can't deploy on door`).
4. Если деплой будет прикреплён к цели как дочерний (`ShouldParent`), точка крепления должна
   быть не дальше **1 м** от цели (`Parent too far away`).
5. `ownerPlayer.CanBuild()` — у **самого игрока** (по его позиции) должно быть право строить.
6. Целевой сокет должен быть «мамой» (`Target socket is not female`) и не занят
   (`Target socket is occupied`). Нельзя одновременно указать сокет и «землю».
7. Проверка «не строит ли игрок изнутри чего-то» и линии видимости — часть античита,
   здесь не описываем.
8. Лимит спальников (`server.max_sleeping_bags`, по умолчанию 15) — только для спальников.

Потом `Planner.DoPlacement` → `Construction.CreateConstruction` → `Construction.UpdatePlacement`.

### 2. Сокеты: «папа» и «мама»

`Socket_Base` имеет флаги `male`, `female`, `maleDummy`, `femaleDummy`, `monogamous`.
Новый блок ищет у себя «пап» (`male && !maleDummy`), которые подходят к цели
(`Construction.FindMaleSockets` → `TestTarget`). Цель — «мама» на уже стоящем блоке.

| Класс сокета | Куда цепляется | Что делает |
|---|---|---|
| `ConstructionSocket` | «мама» того же типа на другом блоке | Основной сокет построек. Совместимость — по `socketType` |
| `Socket_Specific` / `Socket_Specific_Female` | конкретная «мама» по имени | Для деплоев: замки, двери, решётки. «Мама» держит список `allowedMaleSockets` |
| `Socket_Free` | любая поверхность (`target.onTerrain`) | Свободная постановка деплоев с выравниванием по нормали |
| `Socket_Free_Snappable` | любая поверхность | То же + «прилипание» к стенам, углам и таким же деплоям |
| `Socket_Terrain` | земля (`target.onTerrain`) | Ставит по направлению взгляда, по желанию — по нормали земли |
| `NeighbourSocket` | никуда (`TestTarget = false`) | Только замечает соседей по пересечению рамок — для [[conditional-models]] |
| `StabilitySocket` | никуда | Даёт опору с коэффициентом `support` для [[stability]] |
| `CornerSocket` | никуда | Угловой контакт: проверка угла ≤ 2° и пересечения рамок |

**Типы `ConstructionSocket.Type`:** `Foundation`, `Floor`, `Misc`, `Doorway`, `Wall`, `Block`,
`Ramp`, `StairsTriangle`, `Stairs`, `FloorFrameTriangle`, `Window`, `Shutters`, `WallFrame`,
`FloorFrame`, `WindowDressing`, `DoorDressing`, `Elevator`, `DoubleDoorDressing`.
`ConstructionSocket.IsCompatible` требует: оба сокета — `ConstructionSocket`, тип одинаковый
и не `None`, `blockType` одинаковый (`Building` или `Boat`), хотя бы один — «папа» и хотя бы
один — «мама». То есть «что к чему цепляется» целиком определено типами сокетов в префабах:
стена садится в сокет типа `Wall` фундамента или пола, дверь — в `Doorway` дверного проёма
и так далее.

**Точное совпадение.** `ConstructionSocket.CanConnect` (им пользуются связи между блоками
и проверка близости) требует, чтобы точки сокетов совпали с точностью **0,02 м**, а направления —
с точностью **2°**. Связь от «примерно рядом» не возникает.

**Занятость.** У сокета с `monogamous` ёмкость связи — 1 (`EntityLink.Setup`). Если «мама» уже
занята (`IsOccupied`), ни один «папа» в неё не встанет.

### 3. Поворот при постановке

`ConstructionSocket.DoPlacement`:

- Если у сокета `rotationDegrees > 0` (и «мама» не запрещает поворот флагом
  `restrictPlacementRotation`), сервер перебирает повороты с шагом `rotationDegrees` начиная
  с `rotationOffset`. Сначала выбирает тот, что ближе всего к направлению взгляда, затем
  пробует все варианты по кругу и берёт **первый, при котором проходят моды сокета**.
  Отсюда «автоповорот»: если в выбранную сторону поставить нельзя, блок развернётся сам.
- Для типов `WallFrame`, `Doorway`, `FloorFrameTriangle`, `FloorFrame`, `Window`, `Shutters`
  к повороту «мамы» добавляется поворот игрока (`ShouldInheritFemaleSocketRotation`). Поэтому
  двери и вставки в рамы можно крутить клавишей поворота до постановки.
- `restrictPlacementAngle` + `faceAngle` + `angleAllowed` (по умолчанию 150°): блок ставится,
  только если игрок смотрит на сокет в пределах сектора ±`angleAllowed/2`.
- `wantsInside`: точка должна быть «внутри» — `ConstructionSocket.IsOutside` пускает 4 луча
  по 5 м (вверх, вправо, вперёд, назад относительно цели) и считает место наружным,
  если хоть один луч не упёрся в постройку. Ошибка `Must be placed inside your base`.

Поворот **после** постановки — отдельная механика, см. [[building-grades]].

### 4. Моды сокетов (`SocketMod_*`)

`Socket_Base.CheckSocketMods` сначала даёт всем модам поправить позицию (`ModifyPlacement`),
затем проверяет каждый (`DoCheck`). Первый проваленный мод даёт текст ошибки. Моды, вложенные
в `SocketMod_Grouping`, проверяются по ИЛИ: достаточно, чтобы прошёл один из группы.

| Мод | Что проверяет | Ошибка |
|---|---|---|
| `SocketMod_AreaCheck` | Есть ли (или нет) коллайдеры нужных слоёв в коробке `bounds` | `Not stable enough`, `Must be placed on a construction`, `Cannot be placed on constructions` |
| `SocketMod_SphereCheck` | То же сферой `sphereRadius`; опция `requireMonument` — только коллайдеры монументов | те же + `Cannot be placed on monument`, `Blocked by …` |
| `SocketMod_TerrainCheck` | Точка «в земле»: под ней в пределах 3 м есть слой World или поверхность ландшафта выше точки | `Not in terrain`, `Cannot be placed on monument` |
| `SocketMod_TerrainBoundsCheck` | Точка внутри границ карты | `Not in terrain` |
| `SocketMod_BuildingBlock` | В сфере есть (или нет) блок постройки | `Must be placed on a construction` |
| `SocketMod_EntityCheck` | В сфере есть (или нет) сущности из списка префабов | `Invalid entity` |
| `SocketMod_EntityType` | То же по типу класса | `Invalid entity type` |
| `SocketMod_AngleCheck` | Наклон не больше `withinDegrees` (по умолчанию 45°) от вертикали | `Invalid angle` |
| `SocketMod_InWater` | Точка в воде / не в воде; можно исключить искусственную воду | `Must be placed in water`, `Can't be placed in water` |
| `SocketMod_WaterDepth` | Глубина строго между `MinimumWaterDepth` и `MaximumWaterDepth` (по умолчанию 2 и 4 м) | `Water is too shallow/deep` |
| `SocketMod_Inside` | Внутри / снаружи базы: 8 лучей по 20 м, «внутри» — если все попали и не меньше двух — в постройки | `Must be placed inside your base`, `Can't be placed inside a base` |
| `SocketMod_RoadCheck` | Есть ли в сфере коллайдер с тегом дороги | `Cannot be placed on road`, `Must be placed on road` |
| `SocketMod_EnvironmentVolume` | Запрещённые типы окружения: туннели, подземелье, темнота, подлодка, здание и т. п. | `Can't be placed Underground` и др. |
| `SocketMod_PhysicMaterial` | Материал поверхности под точкой из разрешённого списка | — |
| `SocketMod_PlantCheck` | Есть ли растения рядом; можно ли в горшок | — |
| `SocketMod_Attraction` | Не проверка: «примагничивает» к точкам `AttractionPoint` группы (по умолчанию `wallbottom`) в радиусе `outerRadius`. Shift отключает | — |
| `SocketMod_HotSpot`, `SocketMod_UseTargetOrientation` | Не проверки: сдвигают точку или наследуют поворот цели | — |
| `SocketMod_Boat*`, `SocketMod_Anchor` | Лодочное строительство | — |

**Антиблизость к большой технике.** Если `AreaCheck` или `SphereCheck` требует «быть внутри
чего-то» и не включает слой больших машин, мод дополнительно проверяет сферу **5 м** вокруг
точки: если там большая техника, ошибка `Cannot deploy near a large vehicle`.

Какие моды висят на сокетах блоков постройки (из префабов):

| Блок | Моды |
|---|---|
| Фундамент, треугольный фундамент | `SocketMod_TerrainCheck` (4/3 точки «в земле» + группа 9/7 точек, из которых хоть одна не в земле), `SocketMod_AngleCheck` (≤ 1° от вертикали), `SocketMod_BoatBuildingNetting` |
| Ступени фундамента, пандус | `SocketMod_TerrainCheck` на `ramp-male/1` (4 точки в земле, 2 не в земле); у ступеней ещё `SocketMod_BoatBuildingNetting` |
| Стены, полы, крыши, лестницы | модов нет — только совпадение сокетов, объёмы, близость и права |

Подробно про фундамент — [[foundation]].

### 5. Общие проверки `Construction.UpdatePlacement`

Для каждого подходящего «папы» по порядку:

1. Целевая «мама» уже занята — пропустить.
2. Вычислить размещение (`DoPlacement`), прогнать моды.
3. Электрику (`IOEntity`) нельзя ставить на лодки, если `ioentity.allow_on_boats` выключен.
4. **Сквозь скалу** (`TestPlacingThroughRock`): линия от центра игрока до начала луча и от начала
   луча до объекта не должна пересекать слой World (скалы, монументы). `Placing through rock`.
5. **Сквозь стену** (`TestPlacingThroughWall`): луч от глаз до точки установки не должен упираться
   в постройку. Исключения — попали в сам целевой блок или до точки осталось меньше **0,2 м**.
   `Placing through walls`.
6. **Дорога** (`TestPlacingCloseToRoad`), если в префабе не стоит `canPlaceOnRoads`. Подробно —
   [[building-blocked]].
7. Деплой на дверь без сокета запрещён.
8. **Дальность:** от глаз до точки не больше `maxplaceDistance + 1` м. `maxplaceDistance`
   по умолчанию **4** (поле `Construction`). У всех блоков постройки в префабах 4; у высоких внешних
   стен и ворот — 6. `Too far away`.
9. **Объёмы `DeployVolume`** префаба не должны ничего задевать. По умолчанию они смотрят слои
   Prevent Building и игроков (маска `537001984`). Ошибка уточняется по тому, что задели:
   `Blocked by Player X`, `Blocked by tree`, `Cannot build this close to <монумент>`,
   `Blocked by industrial piping`, иначе `Not enough space`.
10. **Близость к блокам** (`BuildingProximity.Check`) — см. ниже.
11. **Шкаф на шкаф:** если ставится шкаф, в его зоне не должно быть чужой привилегии
    (`Cannot stack building privileges`). Подробнее — [[tool-cupboard]].
12. **Права в точке:** `IsBuildingBlocked` для коробки нового блока. `You don't have permission
    to build here`. Подробнее — [[building-blocked]].
13. Для предметов с удержанием (`holdToPlaceDuration`) — игрок не сдвинулся больше чем на 1 м
    и держал нужное время (±0,5 с).

### 6. Близость к другим блокам (`BuildingProximity`)

Проверяются все блоки постройки в радиусе «половина диагонали нового блока + **2 м**».
Для каждой пары считается, **связаны ли** блоки (совпал хоть один `ConstructionSocket`,
`NeighbourSocket` или `StabilitySocket`) и **насколько близко** сокеты стен нового блока
к точкам `BuildingProximity` соседа.

- **Связаны, у постройки соседа есть шкаф**, игрок в нём не авторизован → `Cannot attach to
  unauthorized building`.
- **Связаны сразу с двумя разными постройками, у каждой свой шкаф** → `Cannot connect two
  buildings with cupboards`, даже если вы авторизованы в обоих.
- **Не связаны, но близко:** если отрезок между точками короче **1,49 м** по горизонтали и по
  вертикали → `Too close to <блок>`. Так игра запрещает ставить блоки «внахлёст» и со сдвигом
  рядом с существующими, не по сокетам.

Владелец блока в этой проверке не участвует. Это не «минимальное расстояние между базами
разных кланов», а чисто геометрическое правило.

### 7. Что происходит после постановки

`Planner.SpawnConstruction`: блоку ставится грейд по умолчанию, HP = `maxHealth` грейда
(для деплоев — с учётом износа предмета), `OwnerID` = игрок. Блок присоединяется к постройке
цели (`DecayEntity.AttachToBuilding`) или получает новый id постройки, затем постройки
сливаются по связям (`CheckMerge`, см. [[building-structure]]). Пересчитываются соседи
(`UpdateSurroundingEntities`) — стабильность и облик ([[conditional-models]]). Ресурсы
списываются в `Planner.PayForPlacement`.

## Числа и настройки

| Что | Значение | Откуда |
|---|---|---|
| Макс. дальность постановки | `maxplaceDistance` + 1 м: 4 + 1 у блоков постройки, 6 + 1 у высоких стен и ворот | поле `Construction` (префаб) |
| Мин. дальность | `minPlaceDistance` = 1 м — поле есть, но сервер его не использует (вероятно, только клиент) | поле `Construction` |
| Допуск совпадения сокетов | 0,02 м и 2° | `ConstructionSocket.CanConnect` |
| Сектор для `restrictPlacementAngle` | `angleAllowed` = 150° | поле `ConstructionSocket` |
| Проверка «внутри» у сокета | 4 луча × 5 м | `ConstructionSocket.IsOutside` |
| Проверка «внутри» у мода | 8 лучей × 20 м | `SocketMod_Inside.IsOutside` |
| Сфера антитехники | 5 м | `SocketMod_AreaCheck`, `SocketMod_SphereCheck` |
| Радиус поиска блоков для близости | ½ диагонали + 2 м | `BuildingProximity.check_radius` |
| Порог «слишком близко» | 1,49 м | `BuildingProximity.Check` |
| Проход сквозь стену допускается | < 0,2 м до точки | `TestPlacingThroughWall` |
| Привязка деплоя к родителю | ≤ 1 м | `Planner.DoBuild` |
| Лимит спальников | `server.max_sleeping_bags` = 15 | `ConVar.Server` |
| Деплой электрики на лодки | `ioentity.allow_on_boats` = True | ReplicatedVar в `IOEntity` |
| Альтернативные проверки видимости | `construction.alternativeloschecks_enabled` = true | ReplicatedVar |
| Строительство в глубоком море | `deepsea.block_building` = true | `ConVar.DeepSea` |

## Нюансы

- **Цена — только за солому.** При постановке списывается стоимость грейда по умолчанию
  (`defaultGrade`), умноженная на `costMultiplier` префаба и `decay.build_twig_cost_multiplier`.
  Остальные грейды оплачиваются при улучшении, см. [[building-grades]].
- **Блокировка по позиции игрока.** Помимо коробки нового блока проверяется `CanBuild()` по
  позиции **самого игрока**. Стоя в зоне чужого шкафа, нельзя построить ничего, даже снаружи
  этой зоны. Исключение — префабы с `canBypassBuildingPermission = 1`: среди блоков постройки
  это все четыре пола ([[floor]], [[building-blocked]]).
- **Автоповорот — не баг.** Для сокетов с `rotationDegrees` сервер сам перебирает повороты
  и ставит первый проходящий. Поэтому лестницы и пандусы иногда «сами» встают другой стороной.
- **Связь требует идеального совпадения.** Блок, стоящий в 3 см от сокета, для игры не сосед:
  ни опоры, ни слияния моделей.
- **Угловой контакт не объединяет постройки.** У `CornerSocket` свойство `ConnectsBuildings = false`:
  два фундамента, касающиеся только углами, через этот контакт в одну постройку не сливаются.
- **Близость не смотрит на владельца.** Ошибка `Too close to` одинаково срабатывает рядом
  со своими и чужими блоками.
- **Два шкафа нельзя склеить.** Даже авторизованный в обоих игрок не может соединить блоком
  две постройки, у каждой из которых есть шкаф.
- **Сквозь скалу и стену.** Проверки идут от глаз игрока, поэтому прячась за камнем или
  стеной, нельзя поставить блок «за угол».
- **Подсказка «Blocked by Player».** Когда мешает игрок, его имя пишется в ошибке. При улучшении
  блока имя показывается только если мешает тиммейт (`BuildingBlock.DoUpgradeToGrade`).

## На практике

- Не получается поставить стену или пол — смотрите текст ошибки: он прямо называет
  проваленный шаг: мод сокета, объём, дорогу, шкаф или близость.
- «Too close to Foundation» значит, что блок пытается встать не по сокету рядом с существующим.
  Цельтесь в сокет или отойдите больше чем на 1,5 м.
- Чтобы соединить две базы с разными шкафами, один из шкафов придётся убрать.

## Где в коде

- `Planner.DoBuild`, `Planner.DoPlacement`, `Planner.SpawnConstruction`, `Planner.PayForPlacement`.
- `Construction.UpdatePlacement`, `TestPlacingThroughRock`, `TestPlacingThroughWall`, `TestPlacingCloseToRoad`.
- `Socket_Base.CheckSocketMods`, `ConstructionSocket.IsCompatible`, `ConstructionSocket.CanConnect`, `ConstructionSocket.DoPlacement`.
- `SocketMod_*` — по файлу на мод.
- `DeployVolume.CheckFlags` — объёмы и уточнение ошибки.
- `BuildingProximity.Check`, `BuildingProximity.GetProximity`.
- `ConstructionErrors` — все тексты ошибок.
