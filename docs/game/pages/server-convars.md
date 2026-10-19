---
id: server-convars
title: Настройки сервера (ConVar)
kind: mechanic
group: Сервер и режимы
icon: ui/gear
summary: Подборка ConVar, которые сильнее всего меняют игру — распад и содержание, урон, исчезновение предметов и трупов, ранение, спальники, погода, время, команды, ивенты — со значениями по умолчанию из кода и ссылками на страницы.
related: [decay, upkeep, game-modes, raid-window, day-night-weather, teams, wipe-and-saves, deep-sea, world-events, respawn, sleeping-bag, wounded, death-drop, damage-system, building-grades, turret-targeting, farming, gathering, data-server-settings]
code: [ConVar/Server.cs, ConVar/Decay.cs, ConVar/Env.cs, ConVar/Weather.cs, ConVar/Softcore.cs, ConVar/DeepSea.cs, ConVar/Player.cs, ConVar/Global.cs, ConVar/Spawn.cs, ConVar/Sentry.cs, ConVar/Bradley.cs, ConVar/PatrolHelicopter.cs, ConVar/Vehicle.cs, ConVar/Clan.cs, RelationshipManager.cs, GameModeSoftcore.cs, ConsoleGen.cs]
---

## Кратко

Полный список всех настроек, которые встречаются в документации, с описаниями — [[data-server-settings]].
На каждой странице внизу есть блок «Настройки сервера» с теми, что влияют на её механику.

ConVar — серверные переменные, которые меняются командой в консоли или в `server.cfg`. Здесь
собраны значения **по умолчанию из кода** этой версии сервера. Режим игры может переписать часть
из них при старте ([[game-modes]]), а модифицированные серверы (Oxide/Carbon) часто меняют их или
подменяют механику плагинами: «x2», «x3» и т. п. — это не ванильные ConVar, в ванили множителя
добычи для обычного режима нет вовсе.

Полное имя ConVar — `категория.имя` (регистр не важен). Посмотреть текущее значение на своём
сервере может только админ.

## Распад, содержание, строительство

| ConVar | По умолчанию | Смысл | Подробно |
|--------|-------------|-------|----------|
| `decay.upkeep` | true | режим содержания (иначе старый распад) | [[decay]] |
| `decay.scale` | 1 | множитель распада, 0 — без распада | [[decay]] |
| `decay.tick` | 600 | период тика распада, с | [[decay]] |
| `decay.duration_twig` / `wood` / `stone` / `metal` / `toptier` | 1 / 3 / 5 / 8 / 12 ч | срок распада по грейду | [[decay]] |
| `decay.upkeep_inside_decay_scale` | 0.1 | распад внутри здания | [[decay]] |
| `decay.upkeep_period_minutes` | 1440 | на сколько минут оплачивается содержание | [[upkeep]] |
| `decay.upkeep_grief_protection` | 1440 | сколько живёт оплата после уничтожения шкафа, мин | [[upkeep]] |
| `decay.bracket_0..3_costfraction` | 0.1 / 0.15 / 0.2 / 0.333 | доли цены по числу блоков (15 / 50 / 125 / дальше) | [[upkeep]] |
| `decay.upkeep_group_scaling` | true | налог на большие группы в шкафу | [[upkeep]] |
| `decay.upkeep_group_tier_0_playercount` / `tier_1_playercount` | 4 / 6 | первые 4 без наценки, до 6 — по +2 % за человека, дальше по +4 % | [[upkeep]] |
| `decay.upkeep_group_max_multiplier` | 3 | потолок налога | [[upkeep]] |
| `decay.high_wall_upkeep` | 0.2 | содержание высоких стен и ворот | [[upkeep]] |
| `decay.upgrade_*_enabled`, `decay.upgrade_*_cost_multiplier` | true, 1 | разрешение и цена улучшения | [[building-grades]] |
| `stability.collapse` | 0.05 | порог обрушения | [[stability]] |

## Урон и бой

| ConVar | По умолчанию | Смысл | Подробно |
|--------|-------------|-------|----------|
| `server.pve` | false | урон игроков по игрокам и блокам отражается | [[game-modes]] |
| `server.bulletdamage`, `meleedamage`, `arrowdamage`, `bleedingdamage` | 1 | множители урона | [[damage-system]] |
| `server.bulletarmor`, `meleearmor`, `arrowarmor` | 1 | множители брони | [[armor-clothing]] |
| `server.pvpbulletdamagemultiplier` / `pvebulletdamagemultiplier` | 1 / 1 | пули по игрокам / по NPC | [[damage-system]] |
| `server.pvp_ttk_global`, `pvp_ttk_melee`, `pvp_ttk_bullet` | 1 | растягивают время убийства в PvP | [[damage-system]] |
| `sentry.targetall` | false | турели стреляют во всех | [[turret-targeting]] |
| `sentry.hostileduration` | 120 | враждебность после атаки, с | [[safe-zones]] |
| `server.combatlogsize` / `combatlogdelay` | 30 / 10 с | журнал боя | — |

## Смерть, ранение, возрождение

| ConVar | По умолчанию | Смысл | Подробно |
|--------|-------------|-------|----------|
| `server.woundingenabled` | true | ранение вместо смерти | [[wounded]] |
| `server.crawlingenabled` | true | состояние «ползком» | [[wounded]] |
| `server.woundedrecoverchance` / `incapacitatedrecoverchance` | 0.2 / 0.1 | шанс встать самому | [[wounded]] |
| `server.rewounddelay` | 60 | пауза перед повторным ранением, с | [[wounded]] |
| `server.corpses` / `server.dropitems` | true / true | трупы и выпадение вещей | [[death-drop]] |
| `server.corpsedespawn` | 300 | труп игрока, с | [[death-drop]] |
| `server.npccorpsedespawn` | 600 | труп NPC, с | [[death-drop]] |
| `player.dropbackpackondeath` / `dropbackpackondowned` | true / true | рюкзак падает отдельно | [[death-drop]] |
| `global.disablebagdropping` | false | сумка после исчезновения трупа | [[death-drop]] |
| `server.max_sleeping_bags` | 15 | спальников на игрока | [[sleeping-bag]] |
| `server.respawnresetrange` | 50 | радиус сброса перезарядки спальников, м | [[respawn]] |
| `server.respawntimeadditionbag` / `bed` | 0 / 0 | добавка к перезарядке | [[respawn]] |

## Предметы и мир

| ConVar | По умолчанию | Смысл | Подробно |
|--------|-------------|-------|----------|
| `server.itemdespawn` | 300 | выброшенный предмет, с | [[death-drop]] |
| `server.itemdespawn_container_scale` / `_max_multiplier` | 2 / 24 | время жизни сумок с вещами | [[death-drop]] |
| `server.itemdespawn_quick` | 30 | быстрое исчезновение мелочи, с | — |
| `server.debrisdespawn` | 30 | обломки, с | — |
| `server.radiation` | true | радиация на монументах | [[radiation]] |
| `server.foodspoiling` | true | порча еды | — |
| `server.planttickscale` | 1 | скорость роста растений | [[farming]] |
| `server.composterupdateinterval` | 300 | тик компостера, с | [[farming]] |
| `server.defaultblueprintresearchcost` | 10 | скрап за изучение базовых чертежей | [[research]] |
| `server.workbenchtaxrate1..3` | 0 | наценка дерева технологий, % | [[workbench]] |
| `server.conveyormovefrequency` / `industrialcrafterfrequency` | 5 / 5 с | индустрия | [[industrial-system]] |
| `spawn.tick_populations` | 60 | период респавна ресурсов и животных, с | [[loot-spawns]] |
| `spawn.min_rate` … `max_density` | 0.5 / 1 / 0.5 / 1 | масштаб респавна от онлайна | [[loot-spawns]] |
| `storagecontainer.dropcorpseondeath` | false | разрушенный ящик оставляет «труп» с лутом | [[game-modes]] |
| `vehicle.vehiclesdroploot` / `carwrecks` | true / true | лут из уничтоженной техники, остовы машин | [[vehicles]] |
| `global.sprayduration` | 10800 | граффити живут, с | — |

## Время, погода, карта

| ConVar | По умолчанию | Смысл | Подробно |
|--------|-------------|-------|----------|
| `env.daylength` | 80 (префаб) | сутки, реальных минут | [[day-night-weather]] |
| `env.progresstime` | true | идёт ли время | [[day-night-weather]] |
| `weather.rain_grace_period` | 18 | игровых часов без дождя после вайпа | [[day-night-weather]] |
| `weather.*_chance` | 0.9 / 0.08 / 0.03 / 0.03 / 0.02 / 0 | веса ясно / дождь / туман / облачно / гроза / пыль (из префаба) | [[day-night-weather]] |
| `server.worldsize` / `server.seed` | 4500 / 1337 | карта | [[wipe-and-saves]] |
| `server.saveinterval` | 600 | автосохранение, с | [[wipe-and-saves]] |
| `server.mapenabled`, `compassenabled`, `fogofwar` | true, true, false | карта и компас | [[game-modes]] |
| `server.maximummapmarkers` / `maximumpings` | 5 / 5 | метки и пинги | [[teams]] |

## Команды, режимы, события

| ConVar | По умолчанию | Смысл | Подробно |
|--------|-------------|-------|----------|
| `relationshipmanager.maxteamsize` | 8 | размер команды | [[teams]] |
| `clan.enabled` / `clan.maxmembercount` | true / 100 | кланы | [[teams]] |
| `server.gamemode` | пусто | режим игры | [[game-modes]] |
| `gamemodesoftcore.gather_rate` | 2 | добыча в softcore | [[game-modes]] |
| `softcore.raidwindow_start_hour` / `end_hour` | 18 / 21 | окно рейдов | [[raid-window]] |
| `bradley.enabled` / `bradley.respawndelayminutes` | true / 60 | Брэдли | [[bradley]] |
| `heli.lifetimeminutes` | 30 | жизнь патрульного вертолёта, мин | [[patrol-helicopter]] |
| `events.set_event_enabled` / `set_event_min_delay` / `set_event_max_delay` | — | расписание ивентов | [[world-events]] |
| `deepsea.enabled` / `deepsea.wipeduration` | true / 10800 | глубокое море | [[deep-sea]] |
| `xmas.enabled` | false | Рождественское событие: подарки в чулках (`XMasRefill`) и праздничные предметы | — |
| `halloween.enabled` | false | Объявлена, но в коде не используется: Хэллоуин включают другие настройки | — |

## Нюансы

- **ConVar без эффекта.** `server.cycletime` (500) объявлен, но нигде не читается
  ([[day-night-weather]]).
- **Справка ConVar бывает неверной.** У `softcore.raidwindow_block_extra_type` справка обещает
  «8 = Bullet», а 8 — это `Suicide` ([[raid-window]]). У `gamemodesoftcore.reclaim_fraction_wear`
  смысл фактически обратный ([[game-modes]]). Многие строки справки помечены «(Generated)» —
  они сгенерированы автоматически.
- **Сохраняемые ConVar.** Переменные с `Saved = true` (например, `gamemodesoftcore.gather_rate`,
  настройки окна рейдов) пишутся в конфиг сервера и переживают рестарт без `server.cfg`.
- **Значения из префабов.** Длина суток и веса погоды по умолчанию берутся из префабов неба и
  климата, а не из кода; в ConVar они только читаются и переопределяются.

## Где в коде

- `ConVar/*.cs` — объявления с `[ServerVar]` и `[ReplicatedVar]`.
- `ConsoleGen.cs` — полный список зарегистрированных команд и их полные имена.
- `RelationshipManager.maxTeamSize`, `GameModeSoftcore`, `ReclaimManager`, `WipeTimer` — ConVar,
  объявленные вне папки `ConVar`.
