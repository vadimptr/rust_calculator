---
id: scientists
title: Учёные и другие люди-NPC
kind: object
group: NPC и животные
summary: Все человекоподобные NPC — учёные монументов, карго, нефтевышек и Брэдли, тяжёлые учёные, жители туннелей и подводных станций, охрана аванпоста и бандитки, пугала, пряничные человечки и новые учёные Gen2 — с HP, оружием, итоговым множителем урона, дальностью боя, обзором и лутом.
related: [npc-ai, npc-perception, bradley, cargo-ship, safe-zones, loot-spawns, armor-clothing, hit-zones, damage-system, weapon-attachments, projectile-ballistics]
code: [HumanNPC.cs, NPCPlayer.cs, ScientistNPC.cs, ScientistBrain.cs, AIBrainSenses.cs, BaseProjectile.cs, AttackEntity.cs, ScarecrowNPC.cs, Rust.Ai.Gen2/ScientistNPC2.cs, Rust.Ai.Gen2/NpcShootingComponent.cs, Rust.Ai.Gen2/Scientist2FSM_Heavy.cs, Rust.Ai.Gen2/Scientist2FSM_Shotgun.cs, BasePlayer.cs]
---

## Кратко

Почти все люди-NPC — «игроки» старой системы (`HumanNPC`): у них настоящий инвентарь и одежда из лоадаута (`PlayerInventoryProperties`), а стреляют они тем же оружием, что и вы, только **мгновенными лучами** и с сильно урезанным уроном. Итоговый урон = урон патрона × `damageScale` оружия × `damageScale` NPC × `npcDamageScale` оружия. Для LR-300 у обычного учёного это **0,12** от базового урона пули. Новые учёные Gen2 (`scientist2.heavy`, `scientist2.shotgun`) устроены иначе — см. ниже.

## Характеристики

### Старые NPC (`HumanNPC`)

Броня — только из надетой одежды лоадаута (поле `baseProtection` префаба у `BasePlayer` перезаписывается: `BasePlayer.PreInitShared`, `UpdateProtectionFromClothing`). `ai.npchealthmultiplier` на них не действует.

| NPC (префаб) | HP | `damageScale` | Оружие (лоадаут) | Обзор `SenseRange` | Слух `ListenRange` | AIDesign |
|---|---|---|---|---|---|---|
| Учёный (`scientistnpc_roam`, `_patrol`, `_oilrig`, `_cargo`, `_excavator`, `_bradley`, `_arena`) | 150 | 0,75 | MP5 или LR-300, 2 шприца; костюм учёного | 30 м (Брэдли 60, экскаватор 40) | 10 м | Roam / Patrol / CargoShip / Excavator / BradleyAPC … |
| Учёный военных туннелей (`scientistnpc_full_*`) | 115 (пистолет) / 160 (MP5) / 175 (LR, дробовик) / 150 (любой) | 0,75 | M92 / MP5 / LR-300 / SPAS-12 (+ меч, F1) | 60 м | 30 м | MilitaryTunnels |
| Учёный у кучи мусора (`scientistnpc_junkpile_pistol`) | 115 | 0,75 | M92 | 15 м | — | Junkpile |
| NVG-учёный (`scientistnpc_roam_nvg_variant`) | 300 | 0,75 | SPAS-12 или LR-300 + шприцы; лечится | 30 м | 10 м | NVG.Roam |
| Тяжёлый учёный (`scientistnpc_heavy`, `_bradley_heavy`) | 300 | **0,5** | миниган / военный огнемёт / M249 / SPAS-12; тяжёлый костюм | 30 м (Брэдли 60) | — | HeavyScientist.Oilrig / BradleyAPC |
| Пулемётчик Чинука (`scientistnpc_ch47_gunner`) | 150 | 0,75 | M249 | **200 м**, без конуса | 10 м | CH47.Gunner |
| Турельщик карго (`scientistnpc_cargo_turret_*`) | 150 | 0,75 | LR-300 / MP5 | 60 м | 10 м | CargoShip.Turret |
| Охрана аванпоста (`scientistnpc_peacekeeper`) | 300 | 1,0 | MP5, LR-300, меч | 30 м | — | Peacekeeper, только враждебные |
| Охрана бандитки (`npc_bandit_guard`) | 250 | 1,0 | полуавтомат. винтовка, АК, меч | **100 м** | — | Bandit_Guard, только враждебные |
| Житель туннелей (`npc_tunneldweller`) | 125 | 0,75 | M92 или M39 | 40 м | 10 м | Roam (дом 8 м) |
| Подводный житель (`npc_underwaterdweller`) | 125 | 0,75 | M92 или MP5 | 40 м | 25 м | Roam (дом 12 м) |
| Пугало (`scarecrow`, Хэллоуин) | 200 | 1,0 | нож мясника / бензопила / вилы / серп + 2 бобовые гранаты | 30 м | 10 м | Scarecrow |
| Пряничный человечек (`gingerbread_dungeon` / `_meleedungeon`, Рождество) | 350 / 450 | 1,0 | MP5 + 2 бобовые / леденцовая дубина | 30 м | 10 м | Gingerbread |

Общее для всех: конус обзора ±143° (`VisionCone = -0.8`), сзади замечают ближе 15 м (присевшего — 4 м), память 10 с, обычная скорость `Speed = 5` м/с (пугала 7) — см. [[npc-perception]].

### Оружие NPC: урон, разброс, дальность

`NPCPlayer.ShotTest` → `BaseProjectile.ServerUse`: выстрел — луч до 300 м (без баллистики), урон доходит с задержкой «дистанция / скорость пули», если она больше 0,2 с.

| Оружие | `damageScale` оружия | `npcDamageScale` | Итог у учёного (×0,75) | У тяжёлого (×0,5) | `aiAimCone` | `effectiveRange` → дальность боя |
|---|---|---|---|---|---|---|
| MP5 | 0,75 | 0,2 | **0,113** | — | 5° (×2 = 10°) | 20 → 40 м |
| LR-300 | 0,8 | 0,2 | **0,12** | — | 2° (×2 = 4°) | 40 → 80 м |
| M92 | 0,9 | 0,25 | **0,169** | — | 2° (4°) | 15 → 30 м |
| SPAS-12 | 0,75 | 0,2 | 0,113 за дробину | 0,075 | 3° (6°) | 15 → 30 м |
| M249 | 1,3 | 0,2 | 0,195 (пулемётчик) | 0,13 | 3° (у пулемётчика ×1 = 3°) | 150 → 300 м |
| Миниган | 0,75 | 0,25 | — | 0,094 | 2° (4°) | 150 → 300 м |
| M39 | 1,0 | 0,2 | 0,15 (житель туннелей) | — | 1° (×3 = 3°) | 30 → 60 м |
| АК | 1,0 | 0,2 | 0,2 (бандит, ×1,0) | — | 2° | 30 → 60 м (бандит ×2 = 120 м) |
| Полуавтомат. винтовка | 0,8 | 0,25 | 0,2 (бандит) | — | 2° | 20 → 40 м (бандит 80 м) |
| Военный огнемёт | — | 0,3 | — | — | — | 11,5 м (`aiOnlyInRange`) |

- Разброс: `projectileSpread` патрона + обычный разброс оружия + `aiAimCone × aimConeScale` NPC (`aimConeScale` = 2 у учёных, 3 у жителей туннелей и подводных, 1 у пулемётчика Чинука) — `BaseProjectile.GetAIAimcone`.
- Дальность боя: `effectiveRange × (aiOnlyInRange ? 1 : 2) × AttackRangeMultiplier` (`HumanNPC.EngagementRange`). `AttackRangeMultiplier`: 1 у большинства, 2 у бандитов и учёных экскаватора, **4 у учёных куч мусора** (M92 → 120 м), 1,5 у пугал.
- Очереди: время зажатия `attackLengthMin…Max` (LR-300 0,4 с, MP5 0,4 с, M249 2,5–3 с), пауза `attackSpacing`; ближе `shortRange` = 10 м очередь до ×2 (`attackLengthMaxShortRangeScale`).
- Гранаты: из пояса (F1 у учёных туннелей, бобовые у пугал/пряников) — если цель в 2–20 м и видна, не чаще раза в 10 с, бросок через 1,5 с прицеливания (`NPCPlayer.TryUseThrownWeapon`).

### Новые учёные Gen2 (`ScientistNPC2`)

| | `scientist2.heavy` | `scientist2.shotgun` |
|---|---|---|
| HP | **2250**, полоска HP не показывается | 215 |
| Хедшоты | нет (`canBeHeadshot = 0`) | да |
| Оружие | MP5, `damageModifier` 1,3 → итог 0,75 × 1,3 × 0,2 = **0,195** | тоже MP5 (несмотря на имя), 0,195 |
| Слабое место | рюкзак: 110 «HP», попадания в `backpack_col` не ранят тело; когда рюкзак кончился — **взрыв и 99 999 урона** | — |
| Тактика | патруль 4–6 м вокруг точки (радиус 10 м) шагом 1,7 м/с; «подавление» — идёт к вам шагом и стреляет по последней известной точке, даже не видя вас; ближе 8 м при видимости — стоит и стреляет | замечает → сначала **прячется** (укрытие в 8 м); ближе 20 м — сближается, ближе 7 м — «собачья свалка»; **бросается в атаку**, если вы вне видимости и ранены (HP ≤ 50 %) или «недовооружены» |
| Обзор / слух | касание 6 м, ±100° до 30 м, днём до 60 м; слух 50 м; помнит 300 с | то же |

«Недовооружён» (`Trans_TargetIsUndergeared`): ни в поясе, ни в рюкзаке нет оружия под 9 мм, 12-й калибр, 5,56, ракеты или самонаводящиеся ракеты.

Стрельба Gen2 (`NpcShootingComponent`): стреляет, только развернувшись к цели в пределах 5° и не на спринте. Очереди: ближе половины `effectiveRange` — 3–9 выстрелов и пауза 0,3–0,4 с; до `effectiveRange` — 3–5 выстрелов и 0,5–1,2 с; дальше — одиночные с паузой 0,5–1,5 с. Шанс **намеренного промаха** (`CheckIfShouldMiss`):

| Ваше движение | Шанс попадания по «прицельной» точке |
|---|---|
| Стоите (скорость < 1 м/с) или бежите прямо на NPC (угол < 30°) | 100 % |
| Бежите в другую сторону/вбок | 50 % |
| Идёте, ближе половины дальности | 100 % |
| Идёте, до полной дальности | 75 % |
| Идёте, дальше | 50 % |

Защита от выстрелов Gen2 считается особо: `(голова + 1,5 × грудь + 0,5 × ноги) / 3` от надетой брони, без учёта места попадания (`BasePlayer.ScaleDamage`, `UseProtectionForNPCs`).

## Поведение

- Описание состояний старых NPC — в [[npc-ai]]; как они видят и слышат — в [[npc-perception]].
- **Охрана аванпоста и бандитки** (`HostileTargetsOnly = 1`) реагирует только на враждебных игроков и не ослепляется флешкой. Правила враждебности — в [[safe-zones]].
- **Пугала**: тело получает от игроков ×0,25 урона (`halloween.scarecrow_body_dmg_modifier`), голова — полный; урон от NPC ×2. Удар осиновым колом (`vampirestake`) или боеприпасом «vamp» (режущий+колющий+Generic ≤ 0,1) — «освобождение души»: урон ×1000 и бонусный лут. Их бобовые гранаты наносят игрокам ×0,1 (`halloween.scarecrow_beancan_vs_player_dmg_modifier`), не чаще раза в 8 с на весь сервер. Численность: `halloween.scarecrowpopulation` = 0. Флаг `halloween.enabled` в коде ни на что не влияет: пугала появляются, только если поднять численность.

### Труп и лут

`NPCPlayer.CreateCorpse`: труп можно лутать через 2 с; **инвентарь NPC в труп не переносится** — контейнеры очищаются и заполняются по `LootSpawnSlots` префаба (`HumanNPC.ApplyLoot`). Оружие учёного вы получите, только если оно выпало из таблицы лута. Патроны в трупе умножаются на `server.npcammolootmultiplier` (1).

| NPC | Лут (`LootSpawnSlots`) |
|---|---|
| Учёный (roam/patrol/oilrig/cargo/Брэдли) | RadTown2 50 %, RadTown1 25 %, AmmoStandard 100 % + 25 %, Ammo 10 %, MedicalDrop 50 % |
| Учёный военных туннелей | ScientistCommon ×2 100 % + 50 %, ScientistUnCommon 20 %, ScientistVeryRare 5 % + 3 % |
| Тяжёлый учёный | Collection.Weapons 50 %, RadTownElite 25 %, Ammo ×3, MedicalDrop ×2, MGL 5 %, MGL_Ammo ×3 по 20 %, миниган с патронами 20 %, военный огнемёт 20 % |
| Учёный кучи мусора | ScientistCommon 100 % + 50 %, ScientistUnCommon 5 %, фрагмент чертежа 10 % |
| Житель туннелей / подводный | 2 × Barrel, RadTown2 50 %, AmmoStandard 25 %, MedicalDrop 25 % |
| Охрана аванпоста / бандитки | ScientistCommon 100 % |
| Пугало | 3 × Barrel, RadTown2 50 %, Halloween.Weapons, Halloween.Food, детали Франкенштейна, редкие 2 × 25 % |

## Нюансы

- **Урон учёных «урезан» в 5–10 раз** множителем `npcDamageScale` оружия. Зато лучи мгновенные: прятаться за кустами бесполезно, за постройками — эффективно.
- **Учёный на сиденье получает 10 % урона** (`HumanNPC.Hurt`). Пулемётчик Чинука и турельщики сидят — стреляйте, когда они встанут.
- **Учёные кучи мусора стреляют из M92 на 120 м** (`AttackRangeMultiplier = 4`), хотя видят только на 15 м: заметив вас, они «достают» дальше любого другого учёного с пистолетом.
- **Gen2-тяжёлый: стреляйте в рюкзак.** 2250 HP в тело против 110 в рюкзак — рюкзак взрывается и убивает носителя. Хедшоты по нему не работают.
- **Против Gen2 стрейф лучше бега на месте**: стоящую цель и бегущую прямо на него он не «мажет» нарочно, бегущую вбок — в половине выстрелов.
- **Gen2-«дробовик» дразнится слабостью**: вы ранены (≤ 50 % HP) или без огнестрела — он сам бросится на вас, как только потеряет из виду.
- Старые NPC не ранятся «в лежачее» — сразу умирают ([[wounded]]).
- Пули старых NPC проходят сквозь других NPC, а ваши — нет.

## На практике

- На военных туннелях учёные слышат выстрел на 30 м даже с глушителем (у старой системы глушитель не учитывается) — стреляйте с дальней дистанции.
- Для фарма тяжёлых учёных на нефтевышке берите броню: их итоговый множитель 0,09–0,13, но миниган и M249 стреляют долго.
- Охрану аванпоста можно провести: пока вы не враждебны, они вас игнорируют.

## Где в коде

- `HumanNPC`: `EngagementRange`, `TickAttack`, `Hurt`, `GetBestTarget`, `ApplyLoot`, `UseHealingItem`.
- `NPCPlayer`: `ShotTest`, `TriggerDown`, `TryUseThrownWeapon`, `CreateCorpse`, `EligibleForWounding`.
- `BaseProjectile.ServerUse` (ветка NPC: `GetAIAimcone`, `npcDamageScale`, `TraceAll` 300 м); `AttackEntity` (`effectiveRange`, `aiAimCone`, `npcDamageScale`).
- `Rust.Ai.Gen2/NpcShootingComponent.Update`, `CheckIfShouldMiss`; `Scientist2FSM_Heavy.Hurt` (рюкзак); `Scientist2FSM_Shotgun`; `ScientistNPC2.ScaleDamage`; `BasePlayer.UpdateProtectionFromClothing` (`protectionAgainstNPCs`).
- `ScarecrowNPC.Hurt`, `ConVar/Halloween.cs`.
