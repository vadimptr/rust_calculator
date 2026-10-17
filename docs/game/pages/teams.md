---
id: teams
title: Команды, контакты и кланы
kind: mechanic
group: Сервер и режимы
summary: Команда — до 8 игроков (relationshipmanager.maxteamsize); приглашают с 7 м или удалённо, она даёт общую карту, пинги, чат и метки спальников, но не даёт прав в шкафу и не отключает урон по своим; отдельно есть система кланов до 100 человек.
related: [game-modes, sleeping-bag, respawn, building-privilege, tool-cupboard, auto-turret, wipe-and-saves, server-convars]
code: [RelationshipManager.cs, BasePlayer.cs, SleepingBag.cs, BuildingPrivlidge.cs, SimplePrivilege.cs, AutoTurret.cs, ConVar/Chat.cs, ConVar/Clan.cs, ClanManager.cs, BaseGameMode.cs]
---

## Кратко

Команды живут в `RelationshipManager`. Размер — `relationshipmanager.maxteamsize`, по умолчанию
**8** (`maxTeamSize_Internal`). Значение 0 выключает команды (`TeamsEnabled`). Режим игры с
`teamSystem = false` ставит 0 ([[game-modes]]).

Команда — это социальная механика: интерфейс, карта, чат. На права она почти не влияет: шкаф,
замки и турели работают по своим спискам, а урон по союзникам проходит как обычно.

## Как работает

### Создание, приглашение, выход

| Действие | Условие | Где |
|----------|---------|-----|
| Создать | вы не в команде; команды включены | `TryCreateTeam` |
| Пригласить рядом | только лидер; цель — не NPC, не в команде, **не дальше 7 м** | `relationshipmanager.sendinvite` |
| Пригласить удалённо | только лидер; цель не в команде и не запретила удалённые приглашения (`client.allowteaminvitesremoteplayers`) | `sendofflineinvite` |
| Принять / отклонить | приглашение есть в списке команды | `acceptinvite` / `rejectinvite` |
| Передать лидерство | лидер смотрит на живого члена команды в пределах 5 м или указывает его ID | `promote`, `promote_id` |
| Выгнать | только лидер, не себя | `kickmember` |
| Выйти | — | `leaveteam` |

`PlayerTeam.AddPlayer` отказывает, если команда уже полна (`members.Count >= maxTeamSize`). Если
уходит лидер, лидером становится первый в списке; если никого не осталось — команда
распускается (`RemovePlayer` → `Disband`).

Список приглашений одной команды ограничен: при `invites.Count > 8` самое старое выкидывается
перед добавлением нового, то есть висит не больше 9 приглашений.

### Что даёт команда

- **Карта и интерфейс** (`BasePlayer.TeamUpdate`): каждому члену уходят имена, здоровье,
  позиции, кто в сети, кто ранен. Спящий член команды показывается как «не в сети».
- **Пинги** членов команды и **метки лидера** на карте (`leaderMapNotes`). Свои метки — до
  `server.maximummapmarkers` = 5, пинги — до `server.maximumpings` = 5 на `server.pingduration` = 10 с.
- **Командный чат** (`ChatChannel.Team`) и чат команды в Rust+.
- **Спальники**: подписи «чей спальник» видны членам команды (`SleepingBag.UseTeamLabels`).
  Режим назначения спальников `client.bagassignmode` = 1 разрешает назначать вам спальник только
  членам команды, друзьям из контактов и соклановцам ([[sleeping-bag]]).
- **Подсказка при улучшении**: если улучшению блока мешает союзник, показывается его имя.
- Команда влияет на квартиры (`ApartmentBuilding.OnTeamMembershipChanged`) и на поведение
  домашнего скота.

### Чего команда не даёт

- **Прав в шкафе, замков, турелей.** Ни в `BuildingPrivlidge`, ни в замках, ни в турелях
  проверки команды нет: каждого надо авторизовать отдельно ([[building-privilege]], [[auto-turret]]).
- **Защиты от своего огня.** В коде нет ни одной проверки команды при уроне.

### Ограничение авторизаций (`limitTeamAuths`)

Если в режиме игры стоит `limitTeamAuths`, шкаф и турель считают себя «полными», когда число
авторизованных достигает размера команды (`UpdateMaxAuthCapacity`, флаг `Reserved5`). В обычном
режиме флаг выключен, и лимита нет.

### Контакты

`RelationshipManager` также ведёт контакты: знакомый, друг, враг (`RelationshipType`). Игрок
попадает в «знакомые», когда вы видели его ближе `relationshipmanager.seendistance` = 10 м.
Знакомые забываются через `forgetafterminutes` = 960 мин (16 ч) без встреч, на игрока хранится до
`maxplayerrelationships` = 128 записей. Отметка «друг» используется при назначении спальников.

### Кланы

Отдельная система `ClanManager` (`clan.enabled` = true, нужна перезагрузка). Клан — до
`clan.maxmembercount` = 100 человек (для локального бэкенда; на Nexus — общий). Изменения клана
по умолчанию делаются только у клан-стола (`clan.editsrequireclantable`). За действия начисляются
очки клана: Брэдли и патрульный вертолёт — 50, запуск спутника — 25, корабль-карго, взлом
и открытие запертого ящика, спутник — 5–10 и т. д. (`ConVar.Clan`). Разрушение шкафа чужого
клана тоже даёт очко (`BuildingPrivlidge.HandleKilledByClanMember`, по умолчанию 0).

## Числа и настройки

| ConVar | По умолчанию | Смысл |
|--------|-------------|-------|
| `relationshipmanager.maxteamsize` | 8 | размер команды, 0 — команд нет |
| `relationshipmanager.contacts` | true | система контактов |
| `relationshipmanager.seendistance` | 10 | расстояние «видел», м |
| `relationshipmanager.forgetafterminutes` | 960 | забыть знакомого, мин |
| `relationshipmanager.maxplayerrelationships` | 128 | записей контактов на игрока |
| `server.maximummapmarkers` | 5 | меток на карте у игрока |
| `server.maximumpings` / `server.pingduration` | 5 / 10 с | пинги |
| `clan.enabled` | true | кланы |
| `clan.maxmembercount` | 100 | размер клана |
| `clan.editsrequireclantable` | true | менять клан только у стола |

## Нюансы

- **Уменьшение лимита никого не выгоняет.** `maxTeamSize` проверяется только при добавлении. Если
  админ сменит 8 на 4, команды по 8 человек останутся, просто в них нельзя будет принять новых.
- **Приглашение с 7 м — по позиции, без проверки видимости.** Цель может стоять за стеной.
- **Приглашения не истекают.** Список чистится только переполнением (больше 9) или ответом
  приглашённого.
- **Команды сохраняются вместе с картой** (`RelationshipManager.Save`, только `forDisk`). Рестарт
  их не трогает, а вайп карты — распускает.
- **«Стаж» команды сбрасывается при рестарте.** `teamLifetime` считается от
  `Time.realtimeSinceStartup`.
- **Огонь по своим проходит.** Это касается и турелей: турель стреляет в члена вашей команды,
  если он не авторизован в ней.

## На практике

- После вступления в команду каждого всё равно нужно авторизовать в шкафу, на турелях и замках.
- Если вы не хотите, чтобы вас звали в команды издалека, выключите удалённые приглашения в настройках.

## Где в коде

- `RelationshipManager.PlayerTeam` (`AddPlayer`, `RemovePlayer`, `SendInvite`), команды
  `sendinvite`, `sendofflineinvite`, `promote`, `kickmember`, `leaveteam`.
- `BasePlayer.TeamUpdate` — что видят члены команды.
- `SleepingBag.CanAssignBed`, `SleepingBag.UpdateTeamsBags`.
- `BuildingPrivlidge.UpdateMaxAuthCapacity`, `SimplePrivilege.UpdateMaxAuthCapacity`.
- `ConVar.Clan`, `ClanManager`.
