---
id: damage-system
title: Как наносится урон
kind: mechanic
group: Урон и рейд
summary: Любой урон в Rust — это HitInfo со списком из 28 типов урона, который проходит через BaseCombatEntity.Hurt — защиту, «мягкую сторону», серверные множители — и только потом вычитается из здоровья.
related: [protection, explosions, repair, decay, stability, building-grades, projectile-ballistics, hit-zones, armor-clothing, data-protection, data-building-blocks, data-entity-health, data-explosives]
code: [BaseCombatEntity.cs, HitInfo.cs, Rust/DamageType.cs, Rust/DamageTypeList.cs, Rust/DamageTypeEx.cs, ProtectionProperties.cs, DirectionProperties.cs, BuildingBlock.cs, ConVar/Server.cs, RaidWindow.cs]
---

## Кратко

У всего, что можно сломать или убить (стены, двери, ящики, игроки, техника), общий предок —
`BaseCombatEntity`. Урон приходит к нему пакетом `HitInfo`. В пакете лежит не одно число,
а массив из 28 значений, по одному на каждый тип урона: пуля, взрыв, тупой удар, жар и так далее.

Метод `BaseCombatEntity.Hurt(HitInfo)` уменьшает каждое значение защитой цели, потом
серверными множителями, складывает остаток и вычитает его из здоровья. Если здоровье дошло
до нуля, вызывается `Die`. Объект гибнет, а соседние блоки здания пересчитывают
[[stability|стабильность]].

Отсюда главное правило рейда: **урон считается отдельно по каждому типу, и каждый тип
режется своей защитой**. У C4 и ракеты разный набор типов урона, поэтому одна и та же
стена держит их по-разному.

## Как работает

### Типы урона

Перечисление `Rust.DamageType` (порядок важен, индекс — номер ячейки массива):

| № | Тип | № | Тип | № | Тип |
|---|-----|---|-----|---|-----|
| 0 | Generic | 10 | Slash | 20 | ElectricShock |
| 1 | Hunger | 11 | Blunt | 21 | Arrow |
| 2 | Thirst | 12 | Fall | 22 | AntiVehicle |
| 3 | Cold | 13 | Radiation | 23 | Collision |
| 4 | Drowned | 14 | Bite | 24 | Fun_Water |
| 5 | Heat | 15 | Stab | 25 | BeeSting |
| 6 | Bleeding | 16 | **Explosion** | 26 | Paintball |
| 7 | Poison | 17 | RadiationExposure | 27 | Cannon |
| 8 | Suicide | 18 | ColdExposure | | |
| 9 | Bullet | 19 | Decay | | |

`DamageTypeList` — это просто `float[28]`. Взрывчатка, пуля или кирка кладут в него свои
значения из префаба (`List<DamageTypeEntry>`: пары «тип — количество»).

Классификация типов в `DamageTypeEx`:

- **Ближний бой** (`IsMeleeType`): Blunt, Slash, Stab.
- **Вызывает кровотечение**: Bite, Slash, Stab, Bullet, Arrow.
- **Считается атакой** (`IsConsideredAnAttack`): всё, кроме Decay и Collision. От этого зависит,
  запустится ли таймер «недавно атакован», который блокирует ремонт (см. [[repair]]).

Все эти проверки смотрят только на **преобладающий** тип (`GetMajorityDamageType`), то есть
на тип с наибольшим значением. При равенстве побеждает тип с большим индексом.

### HitInfo — что знает удар

Главные поля `HitInfo`:

| Поле | Зачем |
|------|-------|
| `Initiator` | Кто атакует (игрок, турель, NPC). От него берётся `InitiatorPlayer` |
| `WeaponPrefab`, `Weapon` | Чем бьют |
| `HitEntity` | По кому попали. **У сплэша взрыва это поле пустое** (см. [[protection]]) |
| `PointStart` | Откуда пришёл удар. Нужно для проверки «мягкой стороны» |
| `HitPositionWorld` | Точка попадания |
| `damageTypes` | Массив урона по типам |
| `UseProtection` | Учитывать ли защиту цели (по умолчанию `true`) |
| `HitBone`, `boneArea` | Кость и зона попадания для игроков (см. [[hit-zones]]) |

`HitInfo.Init(attacker, target, type, amount, pos)` выставляет `PointStart` в позицию атакующего,
если он задан. Урон гниения и прочий «урон от мира» приходит без атакующего, поэтому
у него `PointStart = (0,0,0)`.

### Конвейер BaseCombatEntity.Hurt

Порядок шагов строго такой:

1. **Ранний выход.** Цель уже мертва (`IsDead`), защищена при передаче
   (`IsTransferProtected`) или урон запрещён окном рейда (`RaidWindow.BlocksDamage`). Окно рейда
   работает только в режиме Softcore с `raidwindow_enabled`. Вне окна оно блокирует урон
   взрывом по блокам и дверям.
2. **Базовая защита** — `ScaleDamage(info)`: если `info.UseProtection` и у цели есть
   `baseProtection`, то `ProtectionProperties.Scale`. У строительного блока `baseProtection`
   берётся из грейда (см. [[protection]]). Игрок переопределяет этот шаг и добавляет броню
   (см. [[armor-clothing]]).
3. **Направление** — для каждого `DirectionProperties` на префабе: если у него есть
   `extraProtection` и удар **не** в слабое место, применяется дополнительная защита. Шаг
   выполняется только при `PointStart != (0,0,0)`. Это механизм «мягкой стороны».
4. **Серверные множители (ConVar)**:
   `Arrow × server.arrowdamage`, `Bullet × server.bulletdamage`,
   `Slash/Blunt/Stab × server.meleedamage`, `Bleeding × server.bleedingdamage`.
   Все по умолчанию `1`. **Для Explosion отдельного множителя нет.**
5. **Компоненты сущности** (`EntityComponent.Hurt`) могут поправить урон.
6. `Fun_Water` обнуляется для всех, кроме игроков. Paintball масштабируется своими ConVar.
7. **Итог**: `total = damageTypes.Total()`. Значения NaN и бесконечность пропускаются.
   Дальше `health = health − total`. Сеттер `health` зажимает результат в `[0, MaxHealth]`.
8. **Учёт атакующего**: `lastDamage` = преобладающий тип, `lastAttacker` = `Initiator`.
   У атакующего записываются `lastDealtDamageTime` и `lastDealtDamageTo`. Если у цели
   `markAttackerHostile`, атакующий помечается враждебным на 60 с (`MarkHostileFor`,
   по умолчанию `duration = 60f`).
9. Если преобладающий тип «считается атакой», вызывается `SetJustAttacked`: таймер
   `lastAttackedTime` сбрасывается, клиенту уходит RPC. Этот таймер блокирует ремонт.
10. **Смерть**: если `Health() <= 0`, вызывается `Die(info)`.

Важно: защита умножает **каждый тип отдельно** до сложения. Поэтому «процент защиты стены»
— это не одно число, а 28 чисел.

### Как вызывают урон

- **Обычный путь** — `OnAttacked(HitInfo)`: сначала компоненты, потом уведомление о попадании
  (`DoHitNotify`), потом `Hurt`. Так приходят пули, удары и сплэш взрывов
  (`DamageUtil.RadiusDamage` вызывает `OnAttacked`).
- **Прямой путь** — `Hurt(HitInfo)` без `OnAttacked`. Так взрывчатка, поставленная на
  объект, бьёт по своему «родителю» (см. [[explosions]]).
- **Упрощённый путь** — `Hurt(amount, type, attacker, useProtection)`. Он создаёт HitInfo через
  `Init`. Так наносят урон гниение (`DamageType.Decay`, см. [[decay]]), огонь и самоповреждение
  устройств.

Щит игрока (`ProcessAngleBasedShieldDetection`) перехватывает урон, только если вызов явно
просит не игнорировать щит. К постройкам это не относится.

### Здоровье и максимум

- `health` хранится в `_health`. Сеттер зажимает его в `[0, MaxHealth()]`.
- `MaxHealth()` равен `maxHealthOverride`, если тот больше 0, иначе `_maxHealth`.
- **У строительного блока максимум считается от грейда:**
  `BuildingBlock.MaxHealth = ConstructionGrade.maxHealth = BuildingGrade.baseHealth × Construction.healthMultiplier`.
  Базовое HP грейдов — 10 / 250 / 500 / 1000 / 2000 (солома / дерево / камень / металл / МВК),
  а `healthMultiplier` у всех стандартных блоков равен 1, так что треугольный пол держит
  столько же, сколько стена (см. [[data-building-blocks]], [[building-grades]]).
  HP дверей и деплоев — поле `startHealth` префаба, см. [[data-entity-health]].
- При смене грейда (`ChangeGrade`) блок получает полное здоровье (`SetHealthToMax`).
- После загрузки сервера (`PostServerLoad`) здоровье выше максимума или NaN заменяется максимумом.

### Смерть и разрушение

`Die(info)`:
1. ставит `health = 0` и `lifestate = Dead`;
2. засчитывает задания (`KILL_ENTITY`) инициатору и его команде;
3. `TryDropCorpse` — для ящиков и подобных, если включено `storagecontainer.dropcorpseondeath`.
   «Труп» не появляется, если урон был от гниения или если добил владелец либо игрок
   с правами в шкафу;
4. `OnDied`. У `DecayEntity` он спавнит обломки (`debrisPrefab`), у базового класса —
   `Kill(DestroyMode.Gib)`.

При уничтожении `DestroyShared` вызывает `UpdateSurroundingsOnDestroy`: границы объекта
попадают в очередь пересчёта [[stability]]. Так «падают» блоки, опиравшиеся на убитый.

### Урон со временем

Отдельного общего механизма DoT в `BaseCombatEntity` нет. Урон со временем — это повторные
вызовы `Hurt` от внешних источников:
- **Огонь** (`FireBall`): раз в `tickRate` с бьёт типом `Heat` на `damagePerSecond × tickRate`
  всех в радиусе `radius`. Умолчания класса — 0.5 с, 2 урона в секунду, 0.5 м, 20–40 с,
  но у каждого огня свой префаб:

  | Префаб | Урон в секунду | Тик, с | Радиус, м | Живёт, с |
  |--------|----------------|--------|-----------|----------|
  | `fireball` (зажигательная ракета, молотов) | 5 | 0.5 | 1 | 30–40 |
  | `flamethrower_fireball`, `flameturret_fireball` | 5 | 0.5 | 1 | 15–20 |
  | `fireball_small` (зажигательные патроны) | 2.5 | 0.3 | 0.5 | 20–30 |
  | `fireball_small_arrow`, `fireball_small_shotgun` | 2.5 | 0.3 / 0.5 | 0.5 | 10–15 |
  | `napalm` | 6 | 0.5 | 2 | 60–90 |
  | `oilfireball2`, `oilfireballsmall` (разлив нефти) | 8 | 0.5 | 3 | 180–300 |

  Какой именно шар создаёт каждое оружие, по дампу ассетов не видно (ссылки на префабы
  хранятся по GUID); соответствие в скобках — по именам префабов.
- **Гниение** — периодический `Hurt(…, DamageType.Decay)` (см. [[decay]]).
- **Кровотечение** у игроков — через метаболизм, множитель `server.bleedingdamage`.

## Числа и настройки

| ConVar / константа | По умолчанию | Что делает |
|--------------------|--------------|------------|
| `server.meleedamage` | 1 | Множитель Slash, Blunt, Stab |
| `server.bulletdamage` | 1 | Множитель Bullet |
| `server.arrowdamage` | 1 | Множитель Arrow |
| `server.bleedingdamage` | 1 | Множитель Bleeding |
| `server.pve` | false | PvE: урон игрока по строительному блоку уходит самому игроку |
| `server.explosive_testing_mode` | false | Любая взрывчатка бьёт ровно 1 Explosion и не исчезает после взрыва |
| `server.max_explosive_protection` | 0.75 | Потолок защиты **игрока** от взрыва (см. [[armor-clothing]]) |
| `MarkHostileFor(duration)` | 60 с | Сколько атакующий считается враждебным |
| `GetDamageRepairCooldown()` | 30 с | Сколько после атаки нельзя чинить (см. [[repair]]) |

## Нюансы

- **Для взрывов нет серверного множителя.** Есть `meleedamage`, `bulletdamage`, `arrowdamage`,
  но нет `explosiondamage`. Сервер может ускорить или замедлить рейд только правкой ассетов защиты.
  Исключение — отладочный `server.explosive_testing_mode`.
- **Защита может усиливать урон.** В `ProtectionProperties.Scale` множитель равен
  `1 − clamp(amount, −1, 1)`. Отрицательная защита увеличивает урон, максимум вдвое.
  Редактор ассета разрешает значения от −4 до 3, но код всё равно обрезает их до [−1, 1].
- **PvE-режим отражает урон.** При `server.pve = true` удар игрока по строительному блоку не
  ранит блок: игрок сам получает `Total()` как `Generic` (`BuildingBlock.Hurt`).
- **Игрок в обучении** не может повредить строительный блок: `BuildingBlock.Hurt` сразу выходит.
- **Обои снимает взрыв, а не пуля.** Если в уроне есть Explosion (или преобладают Decay либо Heat),
  `BuildingBlock.Hurt` бьёт обои с обеих сторон. Иначе — только с одной стороны: с лицевой
  (`side 0`), если удар пришёлся в слабое место, и с обратной (`side 1`), если нет.
  У обоев 100 HP (`WALLPAPER_MAXHEALTH`) и своя `wallpaperProtection`. Сама стена при этом
  получает полный урон: обои её не прикрывают.
- **Гниение и столкновения не мешают ремонту.** Они не «считаются атакой» и не сбрасывают
  таймер `lastAttackedTime`. Огонь (`Heat`) сбрасывает.
- **«Недавно атакован» включается и без урона.** Когда липкая взрывчатка прилипает к объекту,
  `TimedExplosive.DoStick` вызывает у него `SetJustAttacked`. Поставили C4 — стену 30 секунд
  нельзя ни чинить, ни улучшать.
- **Порядок защиты и множителей не влияет на результат.** Это умножения, а обрезка
  `clamp(−1..1)` касается только коэффициента защиты, а не урона.

## На практике

- Чтобы понять, сколько единиц взрывчатки уйдёт на блок, нужны три вещи: набор
  `damageTypes` взрывчатки ([[data-explosives]]), защита грейда по этим типам ([[data-protection]])
  и максимум HP блока ([[data-building-blocks]]).
  Формула: `ceil(MaxHealth / Σ_type(damage_type × (1 − protection_type)))`, если вся
  взрывчатка попадает в полную силу. Пример — сачель по каменной стене:
  75 × (1 − 0.5) + 200 × (1 − 0.98) + 200 × (1 − 0.95) = 37.5 + 4 + 10 = 51.5,
  `ceil(500 / 51.5) = 10`. Для сплэша (ракета, бобовка) добавьте допзащиту `BuildingShell`
  твёрдой стороны (см. [[protection]]).
- Серверные «x2 урона пуль» на рейд взрывчаткой не влияют. На рейд разрывными патронами влияют
  частично: `bulletdamage` масштабирует прямое попадание пули, если у него тип Bullet,
  а радиальная часть разрывного — тип Explosion (см. [[explosive-ammo]]).

## Где в коде

- `BaseCombatEntity.Hurt(HitInfo)` — весь конвейер; `OnAttacked`, `Die`, `OnDied`, `MaxHealth`, `SetJustAttacked`, `MarkHostileFor`.
- `HitInfo` — поля удара, `Init`, `InitiatorPlayer`.
- `Rust.DamageType`, `DamageTypeList` (`Total`, `ScaleAll`, `GetMajorityDamageType`), `DamageTypeEx`.
- `ProtectionProperties.Scale` — формула защиты.
- `BuildingBlock.Hurt` — PvE, обучение, обои; `BuildingBlock.MaxHealth`.
- `ConstructionGrade.maxHealth` — HP блока от грейда.
- `ConVar.Server` — `meleedamage`, `bulletdamage`, `arrowdamage`, `bleedingdamage`, `pve`, `explosive_testing_mode`.
- `RaidWindow.BlocksDamage` — окно рейда в Softcore.
- `FireBall.Think` — урон огнём.
