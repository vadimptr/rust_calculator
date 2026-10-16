---
id: npc-ai
title: Как устроен ИИ NPC
kind: mechanic
group: NPC и животные
summary: В Rust одновременно работают две системы ИИ — старая (учёные-«игроки» с AIDesign-состояниями) и новая Gen2 (все дикие животные и новые учёные на конечных автоматах); у них разное зрение, слух, стрельба и правила лечения.
related: [npc-perception, animal-behaviour, scientists, animals, wolf, tiger, crocodile, shark, snake, bradley, cargo-ship, damage-system, safe-zones]
code: [BaseAIBrain.cs, ScientistBrain.cs, AIBrainSenses.cs, HumanNPC.cs, NPCPlayer.cs, Rust.Ai.Gen2/BaseNPC2.cs, Rust.Ai.Gen2/FSMComponent.cs, Rust.Ai.Gen2/SenseComponent.cs, ConVar/AI.cs]
---

## Кратко

На сервере живут **два поколения ИИ**:

| | Старый ИИ («HumanNPC») | Новый ИИ (Gen2) |
|---|---|---|
| Классы | `NPCPlayer` → `HumanNPC` → `ScientistNPC`, `TunnelDweller`, `UnderwaterDweller`, `BanditGuard`, `ScarecrowNPC`, `GingerbreadNPC` | `BaseNPC2` → `Wolf2`, `Bear`, `PolarBear`, `Boar`, `Stag`, `Chicken`, `Tiger`, `Panther`, `Crocodile`, `ScientistNPC2` |
| Тело | Настоящий `BasePlayer`: инвентарь, одежда, оружие из лоадаута | Отдельная сущность `BaseCombatEntity`; оружие выдаёт `NpcShootingComponent` |
| Мозг | `BaseAIBrain` + набор состояний; переходы задаёт ассет `AIDesignSO` | `FSMComponent` — иерархический конечный автомат, собранный прямо в коде (`Wolf2FSM`, `TigerFSM` …) |
| Органы чувств | `AIBrainSenses`: шар радиусом `SenseRange`, конус, луч видимости | `SenseComponent`: «ясность» видимости, конусы, слух по шумам |
| Где | монументы, карго, нефтевышки, туннели, Брэдли, аванпост | все дикие животные; учёные Gen2 (`scientist2.heavy`, `scientist2.shotgun`) |

Старых животных (`BaseAnimalNPC`, `BaseNpc`) в коде ещё много, но **ни один префаб животного их больше не использует** — все звери в мире на Gen2. Единственные «старые» звери — акула (`SimpleShark`) и змея (`SnakeHazard`), у которых своя простая логика (см. [[shark]], [[snake]]).

## Как работает

### Старый ИИ: состояния и AIDesign

`ScientistBrain.AddStates` регистрирует состояния: `Idle`, `Roam`, `Chase`, `Combat`, `TakeCover`, `Cover`, `Mounted`, `Dismounted`, `FollowPath` (патруль), `NavigateHome`, `CombatStationary`, `MoveTowards`, `MoveToVector3`, `Blinded`, `KillSelf`, `MountAPC`. Состояния «бежать» у учёных нет. Каким будет переход «увидел цель → преследовать → укрыться», решает ассет `AIDesignSO`, указанный в поле `DefaultDesignSO` префаба (`Scientist.Roam.AIDesign`, `Scientist.CargoShip.AIDesign`, `HeavyScientist.Oilrig.AIDesign`, `Scientist.MilitaryTunnels.AIDesign`, `Bandit_Guard.AIDesign` и ещё ~20). Сами правила переходов лежат в отдельных бинарных файлах дизайна и **в дамп ассетов не попали** — поэтому ниже описано только то, что делают сами состояния.

- **Chase** (`ScientistBrain.ChaseState`): каждые 0,5–1 с выбирает «точку движения» (`AIMovePoint`) рядом с целью в пределах `BestMovementPointMaxDistance` (10 м в префабах) с видимостью цели. Ближе 10 м идёт обычным шагом, дальше — бегом.
- **Combat** (`CombatState`): стоит у точки, где начал бой, и каждые 1–3 с с шансом 1/3 приседает и замирает, иначе делает шаг в случайную точку в радиусе 1 м. То самое «приседание-дёргание» учёных.
- **Cover** (`CoverState`): приседает в точке укрытия; если HP ≤ `HealBelowHealthFraction` (0,5) и выпало `HealChance` (0,5), а цель вне видимости и дальше 5 м — колет шприц и **лечится до полного** (`HumanNPC.Heal` → `Heal(MaxHealth())`). Это умеют только префабы с `CanUseHealingItems = 1` (арена и NVG-учёные) и только при наличии в поясе ≥2 шприцев.
- **Blinded**: светошумовая или пчелиная граната в 5 м с прямой видимостью ослепляет на 3 × (0,6–1,4) с (`TimedExplosive.BlindAnyAI`, `aiBlindDuration = 3`, `aiBlindRange = 5` в префабах `grenade.flashbang.deployed` и `grenade.bee.deployed`). Учёный встаёт и бредёт в случайную точку в 1–2,5 м. Охрана аванпоста и бандитки (`CanBeBlinded = 0`) иммунна.

Атака (`HumanNPC.TickAttack`): NPC должен 0,2 с держать цель в прицеле (скалярное произведение > 0,2) при прямой видимости, и цель должна быть ближе дистанции боя:
`EngagementRange = effectiveRange × (aiOnlyInRange ? 1 : 2) × AttackRangeMultiplier` (`HumanNPC.EngagementRange`). Подробно об уроне — в [[scientists]].

### Новый ИИ: конечный автомат

Каждый Gen2 NPC — дерево состояний, где у каждого узла есть «тиковые» переходы (проверяются каждый тик) и переходы по окончании/провалу состояния. Общие черты всех автоматов:

1. **WaitForNavMesh** → пока навмеш под NPC не готов, он стоит.
2. **Roam / Patrol** — блуждание вокруг точки спавна (`homeRadius`, у всех зверей 50 м; у учёных Gen2 `Patrol.homeRadius = 10`). Если NPC ушёл дальше радиуса, точки поближе к дому получают бонус.
3. **Has target** — боевая ветка; при потере цели — назад к блужданию.
4. **Dead** — спавн трупа `CorpsePrefab` и лута `LootSpawnSlots`.

`NPCEncounterTimer` отсчитывает «терпение» к текущей цели (`giveUpDurationSeconds`: волк, медведь, кабан, олень, курица — 120 с, тигр/пантера — 300 с, крокодил — 60 с). Таймер перезапускается, если NPC получил урон в последние 5 с; тикает в **4 раза быстрее**, если цель у огня, и в **12 раз быстрее**, если цель сидит в транспорте или на сиденье. По истечении зверь (и его стая) убегает.

### Мгновенное лечение «в покое»

Gen2 NPC **полностью восстанавливает HP**, когда входит в состояние блуждания/патруля и не получал урона больше 120 с (`State_Roam.Reset`, `State_Patrol.Reset`: `SecondsSinceAttacked > 120` → `SetHealth(MaxHealth())`). Подранка надо добивать в течение двух минут.

### Тики и сон

- Gen2-органы чувств обновляются раз в 0,2 с, если рядом есть игрок или цель — игрок, иначе раз в 1 с (`SenseComponent.minRefreshIntervalSeconds` / `maxRefreshIntervalSeconds`).
- Старый мозг обновляет органы чувств раз в 0,5 с (`AIBrainSenses.UpdateInterval`), а видимость уже известных игроков — раз в 0,2 с у `HumanNPC` (`HumanKnownPlayersLOSUpdateInterval`).
- `ai.sleepwake` (true) — зоны `AIInformationZone` усыпляют NPC без игроков поблизости и будят при приближении.

## Числа и настройки

| ConVar | По умолчанию | Что делает | Работает? |
|---|---|---|---|
| `ai.think` / `ai.move` / `ai.navthink` | true | выключатели мышления и движения | да |
| `ai.ignoreplayers` | false | NPC не видят игроков | да (и старые, и Gen2, и акула) |
| `ai.npchealthmultiplier` | 1 | множитель HP | **только Gen2** (`BaseNPC2.InitShared`) |
| `ai.npc_enable` | true | спавн NPC в монументах | да |
| `ai.scientist_spawners_enabled` | true | если false — `SpawnGroup` с учёными/жителями туннелей/Gen2 отключается | да |
| `ai.npc_spawn_on_cargo_ship` / `ai.npc_spawn_on_junkpile` | true | учёные на карго / у куч мусора | да |
| `ai.npc_junkpilespawn_chance` | 0,07 (в подсказке написано 0,1) | шанс учёного у кучи мусора | да |
| `ai.npc_max_population_military_tunnels` | 3 | население военных туннелей (`AiLocationSpawner`) | да |
| `ai.npc_respawn_delay_min/max_military_tunnels` | 480 / 1920 с | задержка респауна там же | да |
| `ai.smokegrenadenpcradius` | 4 м | радиус дыма, который режет обзор Gen2 | да |
| `ai.watchedangle` / `ai.aimedatangle` | 50° / 10° | когда Gen2 считает, что на него смотрят / целятся | да |
| `server.npcammolootmultiplier` | 1 | множитель патронов в трупах NPC | да |
| `ai.npc_gun_noise_silencer_modifier` | 0,15 | «шум глушителя» | **нет**, нигде не читается |
| `ai.npc_htn_player_base_damage_modifier` | 1,15 | урон HTN-NPC | **нет** |
| `ai.npc_speed_*`, `ai.npc_alertness_*`, `ai.npc_valid_aim_cone`, `ai.npc_use_new_aim_system`, `ai.npc_cover_*`, `ai.npc_max_roam_multiplier`, `ai.npc_junkpile_dist_aggro_gate`, `ai.npc_max_junkpile_count`, `ai.npc_families_no_hurt`, `ai.sensetime`, `ai.tickrate` | разные | наследие удалённой HTN-системы | **нет** — значения в коде не используются |

Время реакции Gen2 задаётся командой `ai.setnpcreactiontime` (по умолчанию 0,65 с) — см. [[npc-perception]].

## Нюансы

- **Половина ConVar-ов `ai.npc_*` мёртвые.** Они остались от HTN-ИИ: регистрируются в консоли, но код их не читает. Менять `ai.npc_gun_noise_silencer_modifier` бессмысленно.
- **`ai.npchealthmultiplier` не трогает учёных старой системы** — у `HumanNPC` HP берётся из `startHealth` префаба напрямую (`HumanNPC.StartHealth`).
- **NPC-«игрок» не может быть ранен** (`NPCPlayer.EligibleForWounding` → false): учёный умирает сразу, без «лежачего» состояния.
- **Сидящий NPC получает 10 % урона** (`HumanNPC.Hurt`: `isMounted` → `ScaleAll(0.1)`). Пулемётчики в Чинуке и учёные на стационарных турелях в 10 раз «толще», пока сидят.
- **Пули старых NPC пролетают сквозь других NPC** (`BaseProjectile.ServerUse` пропускает попадания NPC-по-NPC, кроме фракции Horror и питомцев): стрелять «через» соседа-учёного они могут, а вы прятаться за другим учёным — нет.
- Gen2 NPC, который не нашёл навмеш после слезания с транспорта, **умирает** (`BaseNPC2.DieOffNavmesh`, ищет навмеш в 10 м).

## На практике

- Отошли и спрятались, но учёный Gen2 или зверь недобит — у вас две минуты, потом он вернётся к патрулю с полным HP.
- Флешка — отличный инструмент против учёных старой системы на монументах: до 4 с они не стреляют и бродят. На охрану аванпоста и бандитки не действует, на зверей и учёных Gen2 тоже.
- Сидя в машине/лодке вы «надоедаете» зверям в 12 раз быстрее — они бросают погоню примерно через 10 с вместо 120.

## Где в коде

- `BaseAIBrain` (`AddStates`, `SetBlinded`, `BasicAIState`), `ScientistBrain` (`ChaseState`, `CombatState`, `CoverState`, `BlindedState`).
- `HumanNPC.TickAttack`, `EngagementRange`, `Hurt`, `FindHealingItem`; `NPCPlayer.ShotTest`, `EligibleForWounding`.
- `Rust.Ai.Gen2/BaseNPC2.InitShared`, `FSMComponent`, `NPCEncounterTimer.Tick`, `State_Roam.Reset`, `State_Patrol.Reset`.
- `TimedExplosive.BlindAnyAI`; `SpawnGroup.Spawn` (проверка `ai.scientist_spawners_enabled`); `ConVar/AI.cs`.
