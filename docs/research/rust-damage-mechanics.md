# Rust: механика урона по строениям (взрывчатка, оружие → building blocks, двери)

Источник: декомпилированный серверный C# Rust (~5100 .cs). Код не копируется — поведение описано своими словами, с точными константами из кода. Числа урона/радиусов/защит в коде **не хранятся** — они в префабах и ScriptableObject-ассетах (см. §6).

Ключевые файлы: `TimedExplosive.cs`, `DudTimedExplosive.cs`, `DamageUtil.cs`, `BaseCombatEntity.cs`, `ProtectionProperties.cs`, `DirectionProperties.cs`, `WeakpointProperties.cs`, `BuildingBlock.cs`, `BuildingGrade.cs`, `ConstructionGrade.cs`, `Construction.cs`, `BaseEntity.cs` (геометрия/видимость), `GamePhysics.cs`, `ServerProjectile.cs`, `ItemModProjectile*.cs`, `Projectile.cs`, `BasePlayer.cs` (обработка попаданий пуль), `BaseProjectile.cs`, `BaseMelee.cs`, `ThrownWeapon.cs`, `FlameExplosive.cs`, `FireBall.cs`, `MLRSRocket.cs`, `Workbench.cs`, `RaidWindow.cs`, `StabilityEntity.cs`, `BatteringRam.cs`.

---

## 0. Слои (layer masks)

Enum `Rust.Layer` в декомпиляции отсутствует; маски расшифрованы по стандартной таблице слоёв Rust (проверено на известных константах: `2097152` = Construction, `256` = Deployed, `8388608` = Terrain, `0x10` = Water, `0x8000` = Vehicle_World).

| Маска | Слои | Где используется |
|---|---|---|
| `1210222849` | Default, Deployed, AI, Vehicle_World, Player_Server, Construction, Vehicle_Large, Tree | «полный» сплэш `TimedExplosive` (`fullSplashDamage`) |
| `166144` | Deployed, AI, Vehicle_World, Player_Server | сплэш при `onlyDamageParent` (`parentOnlySplashDamage`) — **без Construction** |
| `1218519041` | Default, Vehicle_Detailed, World, Construction, Terrain, Vehicle_Large, Tree | лучи видимости `BaseEntity.IsVisible` (что блокирует взрыв) |
| `2097152` | Construction | поиск BuildingBlock / дверей |
| `1237003025` | Default, Water, Deployed, Ragdoll, AI, Vehicle_Detailed, World, Player_Server, Player_Model_Rendering, Physics_Projectile, Construction, Terrain, Transparent, Vehicle_Large, Tree | столкновения `ServerProjectile` (ракеты), поиск целей у `ItemModProjectileRadialDamage`, «drop»-установка C4 |

Следствия для планировщика:
- **Блокируют** взрыв (LOS): строительные блоки и двери (слой Construction — двери ищутся кодом по маске Construction, `DoorManipulator.FindDoor`), terrain, world-объекты, деревья, крупные транспортные средства.
- **Не блокируют**: деплойблы (Deployed: ящики, шкафы, замки и т.п.), игроки, AI.

---

## 1. Конвейер урона: от попадания до потери HP

### 1.1 Структуры
- `HitInfo` — носитель урона: `damageTypes` (`DamageTypeList`, массив из 28 float, индекс = `DamageType`), `Initiator` (атакующий), `WeaponPrefab`, `HitEntity`, `PointStart` (откуда атака), `PointEnd`, `HitPositionWorld`, `HitNormalWorld`, `UseProtection` (по умолчанию `true`), `ProjectileDistance`, `ProjectileVelocity` и т.д.
- `DamageType` (индексы): 0 Generic, 1 Hunger, 2 Thirst, 3 Cold, 4 Drowned, 5 Heat, 6 Bleeding, 7 Poison, 8 Suicide, **9 Bullet**, **10 Slash**, **11 Blunt**, 12 Fall, 13 Radiation, 14 Bite, **15 Stab**, **16 Explosion**, 17 RadiationExposure, 18 ColdExposure, 19 Decay, 20 ElectricShock, **21 Arrow**, 22 AntiVehicle, 23 Collision, 24 Fun_Water, 25 BeeSting, 26 Paintball, 27 Cannon; `LAST`=28.
- `DamageTypeEntry` = пара (`type`, `amount`). Все «списки урона» в префабах — `List<DamageTypeEntry>`.
- `DamageTypeList.Total()` — сумма всех типов (NaN/Infinity пропускаются). `ScaleAll(k)` — умножение всех типов на k. `GetMajorityDamageType()` — тип с максимальным значением (при равенстве — последний по индексу).

### 1.2 Точка входа
Почти все источники (сплэш, пули, мили) вызывают `entity.OnAttacked(hitInfo)`. Для `BaseCombatEntity` это: прогон через `EntityComponent.OnAttacked` (компоненты сущности), hit-notify, затем `Hurt(info)`.
Исключение: в ветке `onlyDamageParent` у `TimedExplosive` (см. §2.3) ближайший блок и родитель получают **прямой `Hurt`**, минуя `OnAttacked`.

### 1.3 `BuildingBlock.Hurt` (надстройка)
1. Если серверный convar `server.pve = true` и инициатор — игрок: урон **не наносится** блоку; вместо этого игрок получает `Total()` урона типа Generic (отражение). Для планировщика — игнорировать.
2. Если инициатор — игрок в туториале — урон игнорируется.
3. Обои (wallpaper): если на блоке есть обои, копия урона масштабируется `wallpaperProtection` и вычитается из «здоровья обоев» (отдельный пул, **основной урон не уменьшает**). Взрыв/Decay/Heat бьют обе стороны, прочее — сторону по weakspot-логике. Для рейд-калькулятора не влияет.
4. Далее — общий `BaseCombatEntity.Hurt`.

### 1.4 `BaseCombatEntity.Hurt` (общий для блоков, дверей, деплойблов)
Шаги по порядку:
1. **Ранний выход (неуязвимость)**: сущность мертва; или флаг `Protected` (защита при Nexus-переносе); или `RaidWindow.BlocksDamage` (только режим Softcore с включённым raid window — блокирует урон Explosion по BuildingBlock/Door вне окна рейда; не-softcore серверы не затрагивает).
2. `ScaleDamage(info)`: если `info.UseProtection` и есть `baseProtection` → `baseProtection.Scale(damageTypes)`.
   - Формула для каждого типа i, где `amounts[i] != 0`: `damage[i] *= 1 − clamp(amounts[i], −1, 1)`.
   - Т.е. защита 1.0 = полный иммунитет к типу, 0.9 = −90 %, отрицательная — усиление (до ×2 при −1).
   - Переопределения `ScaleDamage` среди строительных сущностей есть только у `Workbench` (см. §5).
3. **Directional protection (soft side / hard side)**: только если `info.PointStart != (0,0,0)`. Для каждого `DirectionProperties`, прикреплённого к префабу (PrefabAttribute, ищется по `prefabID`): если у него задан `extraProtection` и попадание **не** признано weakspot → `extraProtection.Scale(damageTypes)` (та же формула). Логика weakspot — §1.5.
4. Серверные множители (все по умолчанию 1.0): `Arrow × server.arrowdamage`, `Bullet × server.bulletdamage`, `Slash/Blunt/Stab × server.meleedamage`, `Bleeding × server.bleedingdamage`. **Для Explosion/Heat никакого convar-множителя нет.** Отдельного «building damage scale» convar нет.
5. `EntityComponent.Hurt` для компонентов сущности (могут модифицировать).
6. `Fun_Water` обнуляется для не-игроков; Paintball — своя логика (не важно).
7. `total = damageTypes.Total()`; `health = clamp(health − total, 0, MaxHealth)`.
   - **Никакого округления** и **никакого минимального урона** нет — здоровье float. (Клиенту отправляется апдейт при изменении `round(health)`, это только сеть.)
8. Если `health <= 0` → `Die(info)`: `lifestate = Dead`, `health = 0`, `OnDied` → `DecayEntity.OnDied` спавнит `debrisPrefab` (обломки), затем `Kill(DestroyMode.Gib)`.
9. После уничтожения соседние `StabilityEntity` пересчитывают стабильность (очередь). Блок со стабильностью `< Stability.collapse = 0.05` (5 %) после `Stability.strikes = 10` неудачных проверок уничтожается `Kill(Gib)` (каскадное обрушение). Отключается `server.stability = false`.

Итоговая формула для одного типа урона:
```
dmg_i = raw_i × (1 − clamp(baseProt_i, −1, 1)) × [если применяется] (1 − clamp(dirProt_i, −1, 1)) × convar_i
HP_new = max(0, HP − Σ dmg_i)
```

### 1.5 Soft side: `DirectionProperties.IsWeakspot`
Attribute на префабе (обычно стены). Поля: `bounds` (Bounds в локальных координатах атрибута), `extraProtection` (ProtectionProperties). Позиция/поворот/forward атрибута берутся из трансформа атрибута внутри префаба (`worldPosition`, `worldRotation`, `worldForward` — фактически локальные координаты префаба).

Попадание считается weakspot (т.е. extraProtection **НЕ** применяется), только если всё верно:
1. `bounds.size != 0`;
2. `info.InitiatorPlayer != null` (атакует игрок);
3. `info.HitEntity != null`;
4. Видимость: если у префаба есть `WeakpointProperties` — хотя бы одна точка-weakpoint видна из глаз игрока (луч `IsVisible(eyes → weakpoint)`), при этом weakpoint с флагом `BlockWhenRoofAttached` игнорируется, если через NeighbourSocket присоединён блок `roof` или `roof.triangle`. Если weakpoint-ов нет — должен быть виден центр OBB атрибута.
5. Угол между `worldForward` атрибута и вектором (локальная PointStart − позиция атрибута) **> 100°** (т.е. атакующий находится «за» атрибутом относительно его forward);
6. Точка попадания (`HitPositionWorld` в локальных координатах) лежит внутри OBB (позиция атрибута, его поворот, `bounds`).

Иначе (не weakspot) → применяется `extraProtection` (hard side).

**Важные следствия:**
- **Взрывы `TimedExplosive` (C4, ракеты, сэтчел, бобовка)**: `DamageUtil.RadiusDamage` и ветка «ближайшего блока» ставят `PointStart = центр взрыва`, но **не** ставят `HitEntity` → `IsWeakspot` всегда false → `extraProtection` **всегда применяется** (если он есть на префабе и содержит ненулевое значение для Explosion). Т.е. взрыв не имеет «мягкой стороны»; если extraProtection содержит Explosion — взрыв режется с обеих сторон одинаково.
- **Прямой урон родителю в режиме `onlyDamageParent`** (§2.3): `HitInfo` без `PointStart` → directional-шаг **пропускается целиком** (extraProtection не применяется).
- **Мили и пули**: `HitEntity`, `PointStart` (позиция игрока/начала атаки) и `HitPositionWorld` заполнены → работает полная soft-side логика.
- **Сплэш разрывных патронов** (`ItemModProjectileRadialDamage`): `HitInfo` создаётся конструктором — `HitEntity = цель`, `PointStart = позиция инициатора (игрока)`, `HitPositionWorld = transform.position цели` → soft-side логика работает (по позиции стрелка).
- Какие префабы имеют `DirectionProperties` и что в их `extraProtection` — данные префабов.

### 1.6 Здоровье
- `BuildingBlock.MaxHealth = ConstructionGrade.maxHealth = BuildingGrade.baseHealth × Construction.healthMultiplier` (если не задан `maxHealthOverride > 0`).
  - `BuildingGrade` (ScriptableObject): `type` (Twigs=0, Wood=1, Stone=2, Metal=3, TopTier=4), `skin`, `baseHealth`, `damageProtecton` (**sic, опечатка в имени поля**), `baseCost`.
  - `Construction` (PrefabAttribute на префабе блока): `healthMultiplier` (0..10, по умолч. 1), `costMultiplier`, `grades` = все `ConstructionGrade` компоненты префаба.
  - `ConstructionGrade` (PrefabAttribute): `gradeBase` (ссылка на BuildingGrade-ассет), `skinObject`.
  - Выбор грейда: ищется ConstructionGrade с `gradeBase.type == grade && gradeBase.skin == skinID`; если не найден — `defaultGrade`. Т.е. **скины грейдов (кирпич, adobe, контейнер и т.п.) — отдельные BuildingGrade-ассеты** с потенциально своими `baseHealth`/`damageProtecton`.
- `BuildingBlock.baseProtection = currentGrade.gradeBase.damageProtecton` (выставляется при инициализации и смене грейда). **То есть защита блока зависит от грейда (и скина), а не от префаба формы.** Форма влияет только на `healthMultiplier` и наличие DirectionProperties/WeakpointProperties.
- Остальные сущности (двери, high external walls, решётки, люки, деплойблы): `MaxHealth = startHealth` (поле `BaseCombatEntity.startHealth` в префабе), `baseProtection` — поле префаба.

### 1.7 Неуязвимость
- `ProtectionProperties` «Immortal» (`Assets/Content/Properties/Protection/Immortal.asset`, `ImmortalLowDensity.asset`) — полная защита (по ассету).
- Транспортная защита (`Flags.Protected`), RaidWindow (Softcore), PvE-режим, туториал — см. §1.3–1.4.
- Сущность, не наследующая `BaseCombatEntity`, не получает урон (`BaseEntity.OnAttacked` пуст).
- `server.explosive_testing_mode = true` — любая `TimedExplosive` наносит ровно 1 Explosion и не уничтожается.

---

## 2. Сплэш-урон взрывчатки

### 2.1 Взрыв `TimedExplosive.Explode`
1. Коллайдер самого заряда отключается.
2. Эффекты (не влияют на урон).
3. Если список урона непуст:
   - Центр взрыва `C = ExplosionCenter()` = `CenterPoint()` заряда = центр его OBB (`transform.position + rotation × (bounds.center × lossyScale)`, где `bounds` — поле `BaseEntity.bounds` префаба). Особый случай: если заряд приклеен к `BaseVehicle` или `BallistaGun`, центр сдвигается назад по forward OBB на `extents.z + 0.1`.
   - Если `onlyDamageParent == false` → `DamageUtil.RadiusDamage(C, minExplosionRadius, explosionRadius, damageTypes, mask=1210222849, useLineOfSight=true, playerDamage, removeWallpaper=splashWallpaperThroughWalls)` — §2.2.
   - Если `onlyDamageParent == true` → §2.3.
4. Заряд уничтожается.

### 2.2 `DamageUtil.RadiusDamage` (точный алгоритм)
Вход: позиция `P`, `rmin`, `r`, список урона, маска слоёв, флаги.

1. **Поиск кандидатов**: `Physics.OverlapSphere(P, r, mask)` (триггеры включаются) → каждая коллайдер → её `BaseEntity` (через `ToBaseEntity`). Дубли по сущности отбрасываются (HashSet). Если на месте P «отключённый terrain» (терраин-дыра) — Terrain убирается из маски (неважно).
2. Для каждой сущности E (только серверные; пропуск `ignoreEntity`; пропуск уже обработанных; лодочные блоки — опционально):
   1. `Q = E.ClosestPoint(P)` — **ближайшая точка на OBB сущности** (OBB из `transform` + `BaseEntity.bounds` префаба, **не** реальный коллайдер). Если P внутри OBB, Q = P.
   2. `d = |Q − P|`; `t = clamp01((d − rmin) / (r − rmin))`; **`k = 1 − t`**.
      - `d ≤ rmin` → k=1 (полный урон); `d ≥ r` → k=0 (сущность всё равно «бьётся» с нулём урона).
      - Особый случай: части лодок (`BoatBuildingBlock`/`IBoatBuildingPiece` с родителем `PlayerBoat`) — фиксированно `k = 0.85` и не более одного попадания на одну лодку.
   3. `removeWallpaper` — снять обои (не влияет на HP).
   4. **Линия видимости** (`useLineOfSight = true` для всех TimedExplosive): `E.IsVisible(P)` — см. §2.4. Не видно → сущность пропускается целиком (урона 0).
   5. Для пригнувшихся игроков — доп. проверка (неважно для строений).
   6. Создаётся HitInfo: `Initiator = создатель заряда`, `WeaponPrefab`, урон = `playerDamage` для игроков (если задан) иначе `damage`, × k; `HitPositionWorld = Q`, `HitNormalWorld = norm(P − Q)`, `PointStart = P`, `PointEnd = Q`. `HitEntity` **не задаётся**.
3. **Применение**: после сбора всего списка каждой сущности вызывается `OnAttacked(hit)` (кроме атакующего, если `ignoreAttackingPlayer`). Порядок = порядок обнаружения коллайдеров.

Ответы на вопросы:
- **Сколько раз одна сущность может быть задета одним взрывом**: ровно 1 раз (дедупликация).
- **Уменьшается ли урон по одной сущности из-за других**: нет «поглощения» или деления урона. Влияние других — только бинарное через LOS (стена между зарядом и целью полностью блокирует урон по цели). Блокировка вычисляется **до** применения урона, поэтому уничтоженная этим же взрывом стена всё равно заслоняет.
- **Дистанция** — до ближайшей точки OBB (prefab `bounds`), не до центра.
- Падение — **линейное** от `rmin` до `r`.

### 2.3 Режим `onlyDamageParent` (C4/сэтчел «посаженные» вплотную)
Флаг `TimedExplosive.onlyDamageParent` — поле префаба, а также **принудительно выставляется в `true`** в `ThrownWeapon.DoDrop` (правый клик / «положить», если сферкаст радиусом 0.05 на 1.5 м по маске 1237003025 попал в `StabilityEntity` — блок, дверь, high wall и т.п.; заряд сразу приклеивается к этой сущности). При обычном броске (`DoThrow`) флаг остаётся префабным.

Алгоритм:
1. Родитель: идём от `parentEntity` вверх по иерархии до первой `BaseCombatEntity` (`baseCombatEntity`); `baseEntity` — последняя рассмотренная.
2. `RadiusDamage` с маской **`166144`** (Deployed, AI, Vehicle_World, Player_Server — **без Construction и Default**), LOS включён, `ignoreEntity = baseCombatEntity`. То есть сплэш задевает только деплойблы/игроков/NPC/транспорт; строительные блоки и двери этим сплэшем **не задеваются**. (Если родитель — транспорт и `antihack.explosive_vehicle_parent_damage_deployables = false` (по умолчанию) — Deployed тоже исключается.)
3. **Ближайший строительный блок** — выполняется, только если `baseEntity == null` (заряд не приклеен) **или** родитель **не на слое Construction** (т.е. приклеен к деплойблу/high wall/чему-то вне Construction):
   - `Vis.Entities(C, explosionRadius, Construction, триггеры игнорируются)` → только класса `BuildingBlock` (не двери), живые (`healthFraction > 0`).
   - Для каждого: `d = |ClosestPoint(C) − C|`; выбирается **минимальный d среди видимых** (`IsVisible(C, maxDistance = explosionRadius)`).
   - Ему наносится прямой `Hurt` с `GetDamageList(block) × (1 − clamp01((d − rmin)/(r − rmin)))`, `PointStart = C`, `PointEnd = transform.position` блока. Урон идёт **только одному блоку**.
4. **Родитель** (`baseCombatEntity`, если есть): прямой `Hurt` с **полным** уроном (`GetDamageList(baseEntity)`, без падения, без LOS, без PointStart → без DirectionProperties).
   - Если родитель не combat-сущность, но есть `baseEntity` → ему `OnAttacked` с полным уроном.
5. `splashWallpaperThroughWalls` — снять обои со всех блоков в радиусе 3.4 м (косметика).

Итого для планировщика:
- Посаженный на стену/дверь/фундамент/потолок заряд (родитель на слое Construction) бьёт **только эту сущность** — 100 % урона, никаких соседних блоков.
- Посаженный на не-Construction StabilityEntity (например, high external wall, если её слой не Construction — проверить по префабу) бьёт родителя 100 % **плюс** ближайший видимый BuildingBlock с падением.
- Брошенный (не посаженный) заряд с `onlyDamageParent=false` в префабе — полноценный сплэш по всем сущностям в радиусе (§2.2), в т.ч. приклеившийся к стене заряд — стене с `d ≈ 0` → ~100 %.

### 2.4 Линия видимости: `BaseEntity.IsVisible(P)`
Цель видна, если проходит **хотя бы один из двух лучей**:
1. P → `CenterPoint()` цели (центр OBB);
2. P → `ClosestPoint(P)` цели.

Каждый луч (`IsVisible(from, target, maxDistance)`):
- Если `|target − from| < ε` → видно.
- Начало луча сдвигается к цели на `min(dist, 0.01)` м; длина ограничена `min(maxDistance, dist + 0.2)`.
- Луч обязан пересечь собственный OBB цели в пределах этой длины, иначе «не видно».
- Raycast (без радиуса) по маске **`1218519041`** (Default, Vehicle_Detailed, World, Construction, Terrain, Vehicle_Large, Tree), берётся **ближайшее** попадание (отключённые коллайдеры игнорируются):
  - нет попаданий → видно;
  - первое попадание — сама цель → видно;
  - попадание в родителя цели на слое Vehicle_Detailed (или у цели `VisibilityPassesThroughParent`) → видно;
  - иначе: если `дистанция попадания ≤ дистанции входа луча в OBB цели` → **заслонено**; иначе видно.

Т.е. блокирует любой коллайдер из маски, пересечённый лучом **до** входа в OBB цели. Для планировщика: моделировать каждую сущность её OBB, блокировку — пересечением отрезка с коллайдерами (приближённо OBB) других Construction-сущностей/terrain.

### 2.5 Ракеты и снаряды (`ServerProjectile`)
- Движение каждый FixedUpdate: скорость += `gravity × gravityModifier × dt`; трассировка сферой радиуса `radius` (или лучом при 0) на длину шага + `scanRange` по маске `1237003025` (триггеры игнор). Пропускаются: создатель, `ignoreEntity`, коллайдеры без флага Shootable (`ColliderInfo`).
- При попадании заряд переносится вперёд на `max(0, hit.distance − 0.1)` м (т.е. ~на 0.1 м перед поверхностью, по pivot), затем `ProjectileImpact` → `Explode()`. Урон — через тот же `TimedExplosive.Explode` (§2.1) из **центра OBB ракеты**. Отдельного «прямого» урона у ракет **в коде нет** — всё через сплэш (direct hit = сплэш с d≈0).
- Если не попала — взрывается по таймеру `timerAmountMin..Max` (Random.Range).
- Запуск из `BaseLauncher` игроком: `damageTypes` не масштабируются; для NPC/турелей — `SetDamageScale(npcDamageScale | turretDamageScale)`.
- `MLRSRocket`: взрыв обычный (`Explode(rayOrigin)` меняет только позицию эффекта; урон из центра OBB ракеты).
- `FlameExplosive` (зажигательная ракета, молотов и т.п.): спавнит `numToCreate` огненных шаров (`createOnExplode`) с разбросом `spreadAngle`, скоростью `minVelocity..maxVelocity`, затем обычный `Explode` (свой `damageTypes`).
- `FireBall` (огонь): каждые `tickRate` (0.5 с по умолч.) если стоит на месте — `Heat = damagePerSecond × tickRate` всем `BaseCombatEntity` в сфере `radius` (центр поднят на `0.75×radius`), маска `AttackLayers` (по умолч. `1220225809`) | Vehicle_World, при видимости `IsVisible`. Живёт `lifeTimeMin..lifeTimeMax` (20–40 с по умолч.), тухнет в воде. Порождает «дочерние» огни с вероятностью `0.9 − 0.1×generation`. Heat режется защитой грейда (у камня/металла обычно иммунитет — по ассету).

---

## 3. Взрывчатка и оружие: где лежат числа

### 3.1 `TimedExplosive` (C4, ракеты, 40 мм, F1, MLRS и т.д.) — поля префаба
| Поле | Смысл |
|---|---|
| `damageTypes : List<DamageTypeEntry>` | урон по всему, кроме игроков (основное для строений) |
| `playerDamage : List<DamageTypeEntry>` | урон по игрокам (если пуст — `damageTypes`) |
| `minExplosionRadius` | радиус полного урона |
| `explosionRadius` (по умолч. 10) | максимальный радиус, линейное падение до 0 |
| `timerAmountMin` / `timerAmountMax` (10/20 по умолч.) | фитиль: `Random.Range(min, max)` |
| `explodeOnContact` | взрыв через 0.015 с после столкновения |
| `canStick` | прилипание к поверхности при столкновении |
| `onlyDamageParent` | режим §2.3 |
| `waterCausesExplosion` | взрыв при погружении ≥ 0.5 |
| `splashWallpaperThroughWalls` | косметика |
| `BaseEntity.bounds` | OBB заряда → центр взрыва |
| (`ServerProjectile`) `speed`, `gravityModifier`, `drag`, `radius`, `scanRange` | баллистика ракет |
| (`FlameExplosive`) `createOnExplode`, `numToCreate`, `spreadAngle`, `min/maxVelocity` | зажигательные |

`SetDamageScale(scale)` умножает `damageTypes` (только для NPC/турелей в лаунчерах).

**Прилипание** (`canStick`): при столкновении, если `CanStickTo` (нельзя к DecorDeployable, дронам, TravellingVendor; для `DudTimedExplosive` — только если фитиль горит) → заряд ставится в точку контакта, ориентируется по нормали и становится child-ом задетой сущности (`SetParent`). Особого урона «приклеенной» сущности в обычном режиме нет — она просто ближе всех (`d≈0`). Особый урон — только при `onlyDamageParent` (§2.3). Если C4 приклеен к другому заряду — переклеивается к его родителю.

**Проверка прохода сквозь стены** (`CheckClippingThroughWalls`, для `canStick`): если приклеенный заряд сместился (например, вместе с открывающейся дверью) и отрезок между прошлой и новой позицией его центра пересекает BuildingBlock (слой Construction) — заряд откатывается назад и **немедленно взрывается** (`ForceExplode`, шанс осечки обнуляется). Для `DudTimedExplosive` проверка работает только при горящем фитиле.

### 3.2 `DudTimedExplosive` (сэтчел, бобовка)
- `dudChance` (по умолч. в коде **0.4**, реальное значение — в префабе): при наступлении таймера `Random < dudChance` → осечка. NPC-создатель — осечек нет. `ForceExplode` — без осечки.
- Таймер: базовый `Random(timerAmountMin, timerAmountMax)`, затем модификатор: с вероятностью **15 %** ×**0.334**; иначе с вероятностью 15 % (итого 12.75 %) ×**3**; иначе ×1.
- Осечка: фитиль гаснет, заряд остаётся (если родитель синхронизирует позицию — отклеивается), исчезает через **1200 с**. Можно поджечь снова (`Ignite`) — новый таймер и новый бросок на осечку при взрыве.
- Подбор осечки (`RPC_Pickup`, дистанция 3 м): если заряд приклеен — с вероятностью **50 %** вместо подбора фитиль поджигается заново на **2.5–3 с**.
- `becomeDudInWater` — в воде (≥ 0.5) становится осечкой; `DoSplash` водой — тоже осечка.
- Урон/радиусы — поля TimedExplosive из §3.1.

### 3.3 `RFTimedExplosive`
RF-детонируемый вариант (взрыв через 0–0.2 с после сигнала на частоте). Урон — как у TimedExplosive.

### 3.4 Разрывные патроны (`ammo.rifle.explosive` и т.п.)
Два источника урона:
1. **Прямой урон пули** (`Projectile` на префабе снаряда, `damageTypes`), см. §4.2.
2. **`ItemModProjectileRadialDamage`** (компонент на item-префабе патрона, в массиве `ItemModProjectile.mods`): поля `radius` (по умолч. 0.5), `damage` (**одна** `DamageTypeEntry`), `ignoreHitObject` (по умолч. **true**), `onlyDoors`.
   - Срабатывает в `ServerProjectileHit`, когда пуля останавливается (integrity ≤ 0) и `hits ≤ antihack.projectile_impactspawndepth` (= 1), либо ровно на этой глубине.
   - Кандидаты: `Vis.Entities(hitPos, radius, mask 1237003025)`; при `ignoreHitObject` сущность, в которую попала пуля, **пропускается** (она получает только прямой урон пули). При `onlyDoors` — только `Door`.
   - `d = |ClosestPoint(hitPos) − hitPos|`; `k = 1 − d/radius` (**без** min-радиуса); лодки — 0.9.
   - Видимость: `IsVisibleAndCanSeeLegacy` (двусторонняя видимость к центру ИЛИ к ближайшей точке) из двух точек — `hitPos − velDir×0.1` и `hitPos − dir(hitPos→Q)×0.1` — обе должны пройти.
   - Урон `damage.amount × k` через `OnAttacked` (soft-side логика работает, см. §1.5).

### 3.5 `ItemModProjectileSpawn`
Спавн сущности при попадании (`createOnImpact`, шанс `createOnImpactChance`, `numToCreateChances` раз) — например, огонь у зажигательных патронов. Сущность спавнится в `hitPos − dir×0.1`, если есть LOS от начала выстрела.

### 3.6 Осадные орудия (кратко)
- `BatteringRam`: при ударе — сущности в сфере 1 м от `damagePoint` (маска `1210286337`), с LOS (`1075904768`) от точки на 0.5 м позади; урон `damageTypes` полностью (без падения). **BuildingBlock с грейдом > `batteringram.maxBuildingBlockGrade` (по умолч. 2 = Stone) не повреждается** (металл/МВК иммунны). Голова тарана теряет 20 HP за удар (`headDamagePerHit`).
- `DeployableSiegeExplosive`: любой урон поджигает фитиль `MinimumFuseTime..MaximumFuseTime` (3–10 с), затем спавнит и сразу взрывает `ExplosionEffect` (TimedExplosive); соседние такие же в радиусе 2 м поджигаются.
- Catapult/Ballista — снаряды задаются префабами (`ItemModCatapultBoulder.projectileSettings`); подробно не исследовалось.

---

## 4. Мили и пули по строениям

**В коде нет жёсткого правила «блоки иммунны к пулям/мили».** Всё определяется `ProtectionProperties` грейда/префаба (например, защита 1.0 от Bullet = иммунитет) и `DirectionProperties.extraProtection` (soft/hard side).

### 4.1 Мили (`BaseMelee`)
- Урон = `damageTypes` оружия. Если `deployableDamageOverrides` непуст и цель — `DecayEntity`, но **не** BuildingBlock/BasePlayer/Door/SimpleBuildingBlock/LootContainer → используется `deployableDamageOverrides`. Для блоков, дверей, high walls — всегда обычный `damageTypes`.
- Дальше стандартный конвейер §1.4: защита грейда → hard-side `extraProtection` (если не weakspot) → `× server.meleedamage`.
- Мили-атака: `maxDistance` (1.5), `attackRadius` (0.3) — поля префаба.

### 4.2 Пули (`Projectile.CalculateDamage`)
Для каждой записи `damageTypes` снаряда:
```
a  = distanceOffset + distanceScale × damageDistances.x
b  = distanceOffset + distanceScale × farDistanceScale' × damageDistances.y    (farDistanceScale' = 1, если <0)
m  = lerp(damageMultipliers.x, farDamageScale' (или damageMultipliers.y, если <0), inverseLerp(a, b, ProjectileDistance))
dmg = amount × integrity × (damageOffset + damageScale × m)
```
По умолчанию `damageDistances = (10, 100)`, `damageMultipliers = (1, 0.8)`. Модификатор от оружия: `damageScale = Π модов × BaseProjectile.damageScale`, `distanceScale = Π модов × BaseProjectile.distanceScale`, офсеты — сумма модов.
- Пробитие: после попадания `integrity -= target.PenetrationResistance / penetrationPower`, где `PenetrationResistance = baseProtection.density` (100, если защиты нет). У строений обычно высокая density → пуля останавливается.
- Урон по сущности применяется, только если `hits ≤ antihack.projectile_damagedepth` (= 2).
- Дальше конвейер §1.4: `Bullet × server.bulletdamage` и т.д.; Arrow — `× server.arrowdamage`.

---

## 5. Прочее, влияющее на рейд

- **Двери** (`Door : AnimatedBuildingBlock : StabilityEntity : DecayEntity`): никакой собственной логики урона. HP = `startHealth`, защита = `baseProtection` префаба (у каждой двери свой ассет). Лежат на слое Construction → блокируют LOS взрывов; посаженный на дверь C4 (`onlyDamageParent`) бьёт только дверь. Могут иметь `DirectionProperties` в префабе (проверить). Улучшение двери (`ISimpleUpgradable`) — замена на другой префаб.
- **Люки (hatch), гаражные ворота, ворота (Gate)** — подклассы/экземпляры `Door`; то же самое.
- **High external walls, решётки, ограды** — `SimpleBuildingBlock` (или `StabilityEntity`/`DecayEntity`): HP `startHealth`, защита `baseProtection` префаба, особой логики урона нет.
- **Деплойблы**: обычные `BaseCombatEntity`/`DecayEntity` с `startHealth`/`baseProtection`. Попадают в полный сплэш (маска включает Deployed) и в сплэш `onlyDamageParent`, но **не блокируют** LOS.
- **Верстак (Workbench)**: после базовой защиты урон Explosion дополнительно умножается на `1 − clamp01(explosiveResistance)` для каждого установленного улучшения `ItemModWorkbenchReinforced` (слоты инвентаря начиная с индекса 2). Касается только самого верстака.
- **Обрушение**: §1.4 п.9 — снос опоры может каскадно уничтожить блоки выше (stability < 5 %).
- **Softcore raid window**: §1.4 п.1 (не стандартный режим).
- Upkeep/decay — вне рамок.

---

## 6. Что взять из данных префабов/ассетов

### 6.1 Строительные блоки
- **Ассеты `BuildingGrade`** (ScriptableObject, меню «Rust/Building Grade»): по одному на грейд и на каждый скин грейда. Поля: `type`, `skin`, `baseHealth`, **`damageProtecton`** → ссылка на `ProtectionProperties`. Ожидаемые имена: `twigs`, `wood`, `stone`, `metal`, `toptier` (+ скины: brick, adobe, frontier/log, shipping container, brutalist и т.п.).
- **Ассеты `ProtectionProperties`** (меню «Rust/Protection Properties», путь вида `Assets/Content/Properties/Protection/*.asset`): `amounts[28]` (индекс = DamageType, значение 0..1 = доля поглощения, допускаются отрицательные), `density` (для пробития пуль).
- **Префабы блоков** (`assets/prefabs/building core/<shape>/<shape>.prefab`, напр. `wall/wall.prefab`, `foundation/...`, `floor/...`, `wall.doorway`, `wall.window`, `wall.frame`, `wall.half`, `wall.low`, `roof`, `stairs` и т.д.):
  - `Construction.healthMultiplier` (HP = baseHealth × это);
  - список `ConstructionGrade` (`gradeBase` → BuildingGrade);
  - `BaseEntity.bounds` (OBB для дистанций и LOS);
  - коллайдеры (для точной LOS-геометрии);
  - `DirectionProperties` (поля `bounds`, `extraProtection` + трансформ атрибута) и `WeakpointProperties` (`BlockWhenRoofAttached` + позиция).

### 6.2 Двери, люки, ворота, high walls, решётки, амбразуры, деплойблы
- `BaseCombatEntity.startHealth`, `BaseCombatEntity.baseProtection` (→ ProtectionProperties ассет), `BaseEntity.bounds`, слой GameObject (Construction или Deployed), `DirectionProperties`.
- Примерные префабы: `door.hinged.wood/metal/toptier`, `door.double.hinged.*`, `wall.frame.garagedoor`, `floor.ladder.hatch`, `floor.triangle.ladder.hatch`, `wall.external.high.wood/stone`, `gates.external.high.*`, `wall.window.bars.wood/metal/toptier`, `shutter.*`, `wall.frame.netting`, `wall.frame.cell`/`cell.gate`, `wall.frame.fence`/`fence.gate`.

### 6.3 Взрывчатка (TimedExplosive / DudTimedExplosive / FlameExplosive / MLRSRocket)
Для каждого: `damageTypes`, `playerDamage`, `minExplosionRadius`, `explosionRadius`, `timerAmountMin/Max`, `explodeOnContact`, `canStick`, **`onlyDamageParent`**, `BaseEntity.bounds`; для Dud — `dudChance`, `becomeDudInWater`; для ракет — `ServerProjectile.speed/gravityModifier/radius`; для Flame — `createOnExplode` и параметры, плюс `FireBall.damagePerSecond/tickRate/radius/lifeTimeMin/Max`.
Ожидаемые префабы (пути из знания игры, в коде не встречаются):
- C4: `assets/prefabs/tools/c4/explosive.timed.deployed.prefab`
- Satchel: `assets/prefabs/weapons/satchelcharge/explosive.satchel.deployed.prefab`
- Beancan: `assets/prefabs/weapons/beancan grenade/grenade.beancan.deployed.prefab`
- F1: `assets/prefabs/weapons/f1 grenade/grenade.f1.deployed.prefab`
- Rocket: `assets/prefabs/ammo/rocket/rocket_basic.prefab`, `rocket_hv.prefab`, `rocket_fire.prefab`
- 40mm HE: `assets/prefabs/ammo/40mmgrenade/40mm_grenade_he.prefab`
- MLRS: `rocket_mlrs.prefab`
- Survey charge, Molotov (`FlameExplosive`), осадная взрывчатка — аналогично.

### 6.4 Оружие
- Пули: префаб снаряда (`Projectile`: `damageTypes`, `damageDistances`, `damageMultipliers`, `penetrationPower`); item-префаб патрона (`ItemModProjectile` + `ItemModProjectileRadialDamage.radius/damage/ignoreHitObject/onlyDoors`); оружие (`BaseProjectile.damageScale/distanceScale`, моды `ProjectileWeaponMod`).
- Мили: `BaseMelee.damageTypes`, `deployableDamageOverrides`.
- Таран: `BatteringRam.damageTypes`.

---

## 7. Не удалось определить из кода
- Все числовые значения (урон, радиусы, HP, защиты, dudChance, флаг `onlyDamageParent` на конкретных префабах) — только в ассетах.
- Enum `Rust.Layer` отсутствует в декомпиляции; маски расшифрованы по стандартной таблице. Слой дверей = Construction выведен косвенно (поиск дверей по маске Construction); слой high external walls/решёток — проверить в префабах.
- Реализация `OBB.ClosestPoint`/`OBB.Trace` и `DotDegrees` (библиотека Facepunch) не декомпилирована; поведение (кламп точки в OBB; пересечение луча с OBB; угол в градусах через acos) принято стандартным. Поведение `OBB.Trace` при старте луча внутри OBB не проверено.
- Настройка `Physics.queriesHitTriggers` (влияет на LOS-лучи с `UseGlobal`) — неизвестна; триггеры в маски LOS обычно не входят.
- Точные критерии `StabilityEntity.SupportValue` (каскадное обрушение) здесь не разбирались.
