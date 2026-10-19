---
id: respawn
title: Возрождение и спальники
kind: mechanic
group: Игрок
icon: bed
summary: После смерти можно возродиться на случайной точке («на пляже») или на своём спальнике или кровати; возрождение ставит перезарядку на все ваши спальники в радиусе 50 м, а таймеры живут только до перезапуска сервера.
related: [sleeping-bag, sleepers, wounded, metabolism, safe-zones]
code: [SleepingBag.cs, StaticRespawnArea.cs, SleepingBagCamper.cs, BasePlayer.cs, SpawnHandler.cs, ServerMgr.cs, ConVar/Server.cs, ConVar/Global.cs, ConVar/party.cs]
---

## Кратко

После смерти сервер присылает список вариантов (`BasePlayer.SendRespawnOptions`): все ваши
спальники, кровати, полотенца, кемперы и статические точки возрождения. Для каждого указаны
оставшаяся перезарядка и состояние. Кнопка «Respawn» без выбора — это случайная точка карты
(`SpawnHandler`).

Возродиться можно не чаще раза в 5 секунд. Возрождение на спальнике ставит перезарядку
на **все ваши** спальники в радиусе `server.respawnresetrange` (50 м) от точки появления.

## Как работает

### Что происходит при любом возрождении

`BasePlayer.RespawnAt`:

1. Снимаются флаги ранения, обнуляются переменные ранения.
2. Игрок появляется **спящим** (`StartSleeping`) и просыпается по действию клиента.
3. Метаболизм сбрасывается на случайные стартовые значения из префаба (`metabolism.Reset`).
4. Снимаются все модификаторы (чаи и прочее). Если `player.keepteaondeath = true`, остаются
   модификаторы из источника `Tea`.
5. Здоровье `Random.Range(50, 60)` из 100 (`StartHealth`).
6. Выдаются стартовые предметы (`GiveDefaultItems`). Если `server.respawnWithLoadout` включён,
   вместо них грузится сохранённый набор.

Между возрождениями должно пройти 5 секунд (`MarkRespawn(5f)` / `CanRespawn`). Иначе сервер
ответит «You can't respawn again so quickly, wait a while».

### Случайная точка («пляж»)

`ServerMgr.FindSpawnPoint` → `SpawnHandler.GetSpawnPoint`:

- До 60 попыток взять точку из распределения `CharDistribution`. Распределение строится
  фильтром `CharacterSpawn` с порогом `CharacterSpawnCutoff`, оба заданы в ассете. По данным
  сообщества это пляжи, в коде фильтр не расшифрован.
- Точка отбрасывается, если ближе **50 м** к любому памятнику (`monument.Distance(pos) < 50`).
- На затопленной карте (уровень океана ≥ 0.5) работает `FloodedSpawnHandler`.
- Если ничего не нашлось, берутся объекты с тегами `spawnpoint` / `SpawnPointFallback`.

**Командное возрождение.** Если у команды включён `usePartySpawn` и уже есть точка первого
появления, сервер делает до `party.maxpartyspawnattempts` (50) попыток. Он берёт первую точку
ближе `party.maxpartyspawndistance` (100 м) к этой точке, а если такой нет — ближайшую из
найденных.

`server.respawnAtDeathPosition` (по умолчанию `false`) возрождает на месте смерти. Это режим
для съёмок.

### Возрождение на спальнике

`SleepingBag.SpawnPlayer` проверяет:

- игрок мёртв и прошло 5 с с прошлого возрождения;
- спальник ваш (`deployerUserID == userID`) и перезарядка вышла (`unlockTime`);
- состояние `GetRespawnState` равно `OK`. Другие состояния:
  - `Underwater` — спальник под водой (`WaterLevel.Test`);
  - `InNoRespawnZone` — внутри зоны запрета возрождения (`TriggerNoRespawnZone`);
  - `Occupied` — у кемпера: на привязанном сиденье сидит другой игрок;
- у статической точки: вы авторизованы (если требуется `requireAuth`).

Игрок появляется в `позиция + spawnOffset` с поворотом спальника по оси Y. Затем **на каждый
ваш спальник** в пределах `server.respawnresetrange` от точки появления ставится перезарядка
`secondsBetweenReuses + надбавка` (`SleepingBag.SetBagTimer`, причина `Respawned`):

| Тип (`RespawnType`) | Надбавка |
|---------------------|----------|
| `SleepingBag`, `BeachTowel` | `server.respawnTimeAdditionBag` (0) |
| `Bed`, `Camper` | `server.respawnTimeAdditionBed` (0) |

У каждого спальника своё `secondsBetweenReuses` из префаба, в классе по умолчанию `300`.
В префабах: спальник и полотенце — 300 с, кровать — 120 с, койка кемпера — 300 с
(`sleepingbag_leather_deployed`, `beachtowel.deployed`, `bed_deployed`,
`modular_car_sleepingbag_campervan`).
Подробно о вариантах — [[sleeping-bag]].

Если у спальника стоит флаг `DestroyAfterUse` (`Flags.Reserved14`), после возрождения он
исчезает. Если в префабе включён `clearHostile`, с игрока снимается статус враждебности (из
обычных спальников он включён только у кроватей квартир, `apartment_*_bed`).

Кемпер (`SleepingBagCamper.PostPlayerSpawn`) сразу будит игрока и сажает его на привязанное
сиденье.

### Перезарядка при установке

Новый спальник сразу получает перезарядку `secondsBetweenReuses + надбавка`
(`SetBagTimer`, причина `Placed`). В режиме обучения перезарядки нет.

### Статические точки возрождения (`StaticRespawnArea`)

Это точки, встроенные в карту или памятники.

- Общая перезарядка у них всегда 0 (`SetUnlockTime` записывает 0). Но личная
  (`perPlayerRespawnCooldown`, `SetUnlockTimeForPlayer`) работает.
- Без `allowHostileSpawns` они недоступны, пока вы враждебны. Показанный таймер — это
  `max(оставшаяся враждебность, перезарядка)`.
- Точка появления выбирается случайно из `spawnAreas`.
- При `requireAuth` нужна авторизация. Админские команды `server.unlockrespawns` и
  `server.resetrespawns` её выдают и снимают; в игре её даёт награда миссии типа
  `SafeZoneRespawnUnlock` (`BaseMission.DispenseReward`).

Префабы точек:

| Префаб | Где | Перезарядка | Личная | `requireAuth` |
|--------|-----|-------------|--------|---------------|
| `staticrespawnzonecompound_vanilla` | Outpost, обычный режим | 1800 с (30 мин) | да | да |
| `staticrespawnzonecompound` | Outpost, режим softcore | 0 | нет | нет |
| `staticrespawnzonebandit` | Bandit Camp, режим softcore | 0 | нет | нет |

То есть на ванильном сервере возродиться в Outpost можно только после миссии-разблокировки
и не чаще раза в 30 минут на игрока, а пока вы враждебны — нельзя вовсе.

## Числа и настройки

| ConVar / константа | По умолчанию | Смысл |
|--------------------|--------------|-------|
| `server.respawnresetrange` | `50` | Радиус, в котором возрождение блокирует ваши спальники |
| `server.max_sleeping_bags` | `15` | Лимит спальников на игрока |
| `server.respawnTimeAdditionBag` | `0` | Добавка к перезарядке спальников и полотенец |
| `server.respawnTimeAdditionBed` | `0` | Добавка к перезарядке кроватей и кемперов |
| `SleepingBag.secondsBetweenReuses` | `300` | Базовая перезарядка в классе; в префабах: спальник 300, кровать 120 |
| `MarkRespawn` | `5` с | Минимум между возрождениями |
| `party.maxpartyspawnattempts` / `maxpartyspawndistance` | `50` / `100` | Командное возрождение |
| `server.respawnAtDeathPosition` | `false` | Возрождать на месте смерти |
| `server.respawnWithLoadout` | `false` | Возрождать с сохранённым набором |
| `player.keepteaondeath` | `false` | Сохранять эффекты чаёв после смерти |

## Нюансы

- **Смерть сама по себе не ставит перезарядку.** `SleepingBag.OnPlayerDeath` вызывает
  `SetBagTimer` с причиной `Death`, но в обычном режиме эта причина ничего не делает. Влиять на
  неё может только режим игры (`EvaluateSleepingBagReset`). Подсказка `server.respawnresetrange`
  («спальники рядом с местом смерти уходят на перезарядку») с кодом не совпадает. Блокируются
  только спальники рядом с местом, **где вы возродились**.
- **Спальники дальше 50 м не трогаются.** Два спальника в разных концах базы (больше 50 м)
  дают два независимых возрождения подряд.
- **Перезапуск сервера сбрасывает все перезарядки.** `unlockTime` хранится в
  `Time.realtimeSinceStartup` и не сохраняется (`SleepingBag.Save` его не пишет). После
  рестарта все спальники сразу доступны.
- **Возрождение на пляже не трогает спальники.** Таймеры ставит только `SpawnPlayer`.
- **Передача спальника не сбрасывает перезарядку.** `AssignToUser` таймер не трогает, и новый
  хозяин видит тот же отсчёт. Это общий `unlockTime`, а не личный (кроме префабов с
  `perPlayerRespawnCooldown`).
- **Спальник под водой бесполезен**, пока его не осушат (приливы, затопленная карта).
- **Вы появляетесь спящим.** Пока не нажали «проснуться», вы лежите, но метаболизм уже
  работает: игрок подключён.
- **При установке, похоже, есть ошибка.** `SetBagTimer` для `Placed` пытается взять оставшуюся
  перезарядку соседних спальников, но присваивает `bag.unlockTime` (самого нового спальника)
  вместо `item.unlockTime`. В итоге новый спальник всегда получает ровно полную перезарядку.

## На практике

- Ставьте спальники дальше 50 м друг от друга, чтобы возрождение на одном не блокировало
  другие.
- После рестарта сервера все спальники доступны сразу. Это важно при обороне, которая
  совпала с вайпом или перезапуском.
- Прежде чем полагаться на спальник у воды, проверьте, не уходит ли он под воду.

## Где в коде

- `BasePlayer.RespawnAt`, `BasePlayer.Respawn`, `BasePlayer.CanRespawn` / `MarkRespawn`.
- `ServerMgr.FindSpawnPoint`, `SpawnHandler.GetSpawnPoint`, `GetSpawnPointStandard`, `GetSpawnPointForTeam`.
- `SleepingBag.SpawnPlayer`, `TrySpawnPlayer`, `SetBagTimer`, `OnPlayerDeath`, `GetRespawnState`.
- `StaticRespawnArea`, `SleepingBagCamper`.
- `ConVar.Global.respawn`, `ConVar.Global.respawn_sleepingbag`.
