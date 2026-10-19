---
id: npc-shop-prices
title: Цены в магазинах NPC
kind: object
group: Торговля
icon: scrap
summary: Полный список товаров всех NPC-магазинов (Аванпост, Бандитский лагерь, конюшни, рыбацкие деревни, колодцы, плавучий город) с базовыми ценами, запасом и скоростью пополнения из наборов NPCVendingOrder.
related: [npc-shops, vending-machines, drone-marketplace, travelling-vendor, gambling, safe-zones]
code: [NPCVendingOrder.cs, NPCVendingMachine.cs, InvisibleVendingMachine.cs]
---

## Кратко

Товары задаются наборами `NPCVendingOrder` (поле `orders`), а расстановка по монументам —
префабами монументов (поле `vendingOrders` у `NPCVendingMachine` / `InvisibleVendingMachine`).
Как работают запас, пополнение и плавающие цены, описано в [[npc-shops]].

**Важно: это базовые цены.** Если товар продаётся за скрап, итоговая цена = базовая × множитель
динамического ценообразования (`NPCVendingMachine.GetDiscountForSlot`). На свежем вайпе множитель
равен **2,0** (`StartingPriceMultiplier`), потом он постепенно снижается до 0,5–2,0 в зависимости от
спроса. Если игрок сам продаёт что-то магазину за скрап, множитель стартует с **0,5**: в начале вайпа
вы получаете половину скрапа. Всё это — в [[npc-shops]].

Обозначения:
- «Кол-во» — сколько штук вы получаете за одну покупку (`sellItemAmount`).
- «Макс. запас» — `maxStock`. «по умолч.» означает −1 в наборе: тогда берётся `StartingStock` автомата
  (10 почти везде, 2 у колодцев, 20 у префаба торговца-путешественника).
- «Пополнение» — `refillAmount` единиц раз в `refillDelay` секунд, пока запас ниже максимума (`NPCVendingMachine.Refill`).

Названия предметов — английские из `ItemDefinition.displayName`, в скобках shortname.

## Аванпост (`compound.prefab`)

Семь автоматов `NPCVendingMachine`, все с `StartingStock = 10` и динамическим ценообразованием.

| Магазин на карте | Набор заказов |
|------------------|---------------|
| Extra 1 | `Compound_Extra1` |
| Building | `Building` |
| Components | `Components` |
| Resource Exchange | `Resources` |
| Tools & Stuff | `Tools` |
| Weapons | `Weapons` |
| Output Outfitters | `Attire` |

#### `Compound_Extra1`

| Товар | Кол-во | Цена | Макс. запас | Пополнение |
|---|---|---|---|---|
| Fluid Switch & Pump (`fluid.switch`) | 1 | 30 скрап | по умолч. | +1 / 10 с |
| Fluid Splitter (`fluid.splitter`) | 1 | 30 скрап | по умолч. | +1 / 10 с |
| Water Pump (`waterpump`) | 1 | 200 скрап | по умолч. | +1 / 10 с |
| Fluid Combiner (`fluid.combiner`) | 1 | 30 скрап | по умолч. | +1 / 10 с |
| Powered Water Purifier (`powered.water.purifier`) | 1 | 150 скрап | по умолч. | +1 / 10 с |
| Electric Heater (`electric.heater`) | 1 | 75 скрап | по умолч. | +1 / 10 с |
| Smoke Grenade (`grenade.smoke`) | 1 | 5 скрап | по умолч. | +1 / 10 с |

#### `Building`

| Товар | Кол-во | Цена | Макс. запас | Пополнение |
|---|---|---|---|---|
| Small Oil Refinery (`small.oil.refinery`) | 1 | 125 скрап | по умолч. | +1 / 10 с |
| Large Furnace (`furnace.large`) | 1 | 350 скрап | по умолч. | +1 / 10 с |
| Computer Station (`computerstation`) | 1 | 300 скрап | по умолч. | +1 / 10 с |
| Small Generator (`electric.fuelgenerator.small`) | 1 | 125 скрап | по умолч. | +1 / 10 с |
| Tesla Coil (`electric.teslacoil`) | 1 | 75 скрап | по умолч. | +1 / 10 с |
| Large Solar Panel (`electric.solarpanel.large`) | 1 | 75 скрап | по умолч. | +1 / 10 с |
| Igniter (`electric.igniter`) | 1 | 50 скрап | по умолч. | +1 / 10 с |

#### `Components`

| Товар | Кол-во | Цена | Макс. запас | Пополнение |
|---|---|---|---|---|
| Sheet Metal (`sheetmetal`) | 1 | 30 скрап | по умолч. | +1 / 10 с |
| Gears (`gears`) | 1 | 125 скрап | по умолч. | +1 / 10 с |
| Metal Spring (`metalspring`) | 1 | 60 скрап | по умолч. | +1 / 10 с |
| Metal Pipe (`metalpipe`) | 1 | 30 скрап | по умолч. | +1 / 10 с |
| Metal Blade (`metalblade`) | 1 | 15 скрап | по умолч. | +1 / 10 с |
| Rope (`rope`) | 1 | 30 Cloth (`cloth`) | по умолч. | +1 / 10 с |

#### `Resources`

| Товар | Кол-во | Цена | Макс. запас | Пополнение |
|---|---|---|---|---|
| Stones (`stones`) | 1000 | 50 скрап | по умолч. | +1 / 10 с |
| Wood (`wood`) | 1000 | 20 скрап | по умолч. | +1 / 10 с |
| Metal Fragments (`metal.fragments`) | 250 | 25 скрап | по умолч. | +1 / 10 с |
| Stones (`stones`) | 150 | 500 Wood (`wood`) | по умолч. | +1 / 10 с |
| Wood (`wood`) | 500 | 150 Stones (`stones`) | по умолч. | +1 / 10 с |
| Low Grade Fuel (`lowgradefuel`) | 20 | 10 скрап | по умолч. | +1 / 10 с |
| Diesel Fuel (`diesel_barrel`) | 1 | 300 Low Grade Fuel (`lowgradefuel`) | по умолч. | +1 / 10 с |

#### `Tools`

| Товар | Кол-во | Цена | Макс. запас | Пополнение |
|---|---|---|---|---|
| Pickaxe (`pickaxe`) | 1 | 50 скрап | по умолч. | +1 / 10 с |
| Hatchet (`hatchet`) | 1 | 40 скрап | по умолч. | +1 / 10 с |
| Chainsaw (`chainsaw`) | 1 | 125 скрап | по умолч. | +1 / 10 с |
| RF Pager (`rf_pager`) | 1 | 75 скрап | по умолч. | +1 / 10 с |
| Jackhammer (`jackhammer`) | 1 | 150 скрап | по умолч. | +1 / 10 с |
| RF Transmitter (`rf.detonator`) | 1 | 75 скрап | по умолч. | +1 / 10 с |

#### `Weapons`

| Товар | Кол-во | Цена | Макс. запас | Пополнение |
|---|---|---|---|---|
| Shotgun Trap (`guntrap`) | 1 | 150 скрап | по умолч. | +1 / 10 с |
| Flame Turret (`flameturret`) | 1 | 250 скрап | по умолч. | +1 / 10 с |
| Auto Turret (`autoturret`) | 1 | 400 скрап | по умолч. | +1 / 10 с |
| Revolver (`pistol.revolver`) | 1 | 200 скрап | по умолч. | +1 / 10 с |
| Double Barrel Shotgun (`shotgun.double`) | 1 | 250 скрап | по умолч. | +1 / 10 с |
| SAM Site (`samsite`) | 1 | 500 скрап | по умолч. | +1 / 10 с |
| SAM Ammo (`ammo.rocket.sam`) | 6 | 75 скрап | по умолч. | +1 / 10 с |

#### `Attire`

| Товар | Кол-во | Цена | Макс. запас | Пополнение |
|---|---|---|---|---|
| T-Shirt (`tshirt`) | 1 | 5 скрап | по умолч. | +1 / 10 с |
| Longsleeve T-Shirt (`tshirt.long`) | 1 | 10 скрап | по умолч. | +1 / 10 с |
| Snow Jacket (`jacket.snow`) | 1 | 20 скрап | по умолч. | +1 / 10 с |
| Boots (`shoes.boots`) | 1 | 20 скрап | по умолч. | +1 / 10 с |
| Tactical Gloves (`tactical.gloves`) | 1 | 40 скрап | по умолч. | +1 / 10 с |

## Бандитский лагерь (`bandit_town.prefab`)

Магазины — `InvisibleVendingMachine` (торговец-NPC за прилавком), `StartingStock = 10`.

| Магазин на карте | Набор заказов |
|------------------|---------------|
| Black Market | `Weapons_Bandit` |
| Building Supplies | `building_bandit` |
| Vehicle Parts | `Vehicles` |
| Food Market | `FoodVendor` |
| Scrap 4 Sale | `BuyResources` (вы продаёте, магазин платит скрапом) |
| Farming | `Bandit_Farming` |
| Produce Exchange | `Bandit_ProduceExchange` (вы продаёте) |

#### `Weapons_Bandit`

| Товар | Кол-во | Цена | Макс. запас | Пополнение |
|---|---|---|---|---|
| LR-300 Assault Rifle (`rifle.lr300`) | 1 | 500 скрап | по умолч. | +1 / 10 с |
| M92 Pistol (`pistol.m92`) | 1 | 250 скрап | по умолч. | +1 / 10 с |
| Spas-12 Shotgun (`shotgun.spas12`) | 1 | 250 скрап | по умолч. | +1 / 10 с |
| F1 Grenade (`grenade.f1`) | 1 | 8 скрап | по умолч. | +1 / 10 с |
| Night Vision Goggles (`nightvisiongoggles`) | 1 | 250 скрап | по умолч. | +1 / 10 с |
| M39 Rifle (`rifle.m39`) | 1 | 400 скрап | по умолч. | +1 / 10 с |
| Variable Zoom Scope (`weapon.mod.8x.scope`) | 1 | 300 скрап | по умолч. | +1 / 10 с |

#### `building_bandit`

| Товар | Кол-во | Цена | Макс. запас | Пополнение |
|---|---|---|---|---|
| Drop Box (`dropbox`) | 1 | 40 скрап | по умолч. | +1 / 10 с |
| Salvaged Shelves (`shelves`) | 1 | 25 скрап | по умолч. | +1 / 10 с |
| Tuna Can Lamp (`tunalight`) | 1 | 5 скрап | по умолч. | +1 / 10 с |
| Locker (`locker`) | 1 | 40 скрап | по умолч. | +1 / 10 с |
| Road Sign Gloves (`roadsign.gloves`) | 1 | 40 скрап | по умолч. | +1 / 10 с |
| Wind Turbine (`generator.wind.scrap`) | 1 | 500 скрап | по умолч. | +1 / 10 с |
| Medium Rechargeable Battery (`electric.battery.rechargable.medium`) | 1 | 75 скрап | по умолч. | +1 / 10 с |

#### `Vehicles`

| Товар | Кол-во | Цена | Макс. запас | Пополнение |
|---|---|---|---|---|
| Medium Quality Pistons (`piston2`) | 1 | 40 скрап | по умолч. | +1 / 10 с |
| Medium Quality Crankshaft (`crankshaft2`) | 1 | 65 скрап | по умолч. | +1 / 10 с |
| Medium Quality Valves (`valve2`) | 1 | 40 скрап | по умолч. | +1 / 10 с |
| Medium Quality Spark Plugs (`sparkplug2`) | 1 | 40 скрап | по умолч. | +1 / 10 с |
| Medium Quality Carburetor (`carburetor2`) | 1 | 65 скрап | по умолч. | +1 / 10 с |
| Modular Car Lift (`modularcarlift`) | 1 | 150 скрап | по умолч. | +1 / 10 с |
| Hot Air Balloon Armor (`hab.armor`) | 1 | 70 скрап | по умолч. | +1 / 10 с |

#### `FoodVendor`

| Товар | Кол-во | Цена | Макс. запас | Пополнение |
|---|---|---|---|---|
| Can of Tuna (`can.tuna`) | 5 | 10 скрап | по умолч. | +1 / 10 с |
| Pickles (`jar.pickle`) | 6 | 1 скрап | по умолч. | +1 / 10 с |
| Water Jug (`waterjug`) | 1 | 5 скрап | по умолч. | +1 / 10 с |
| Corn Seed (`seed.corn`) | 20 | 10 скрап | по умолч. | +1 / 10 с |
| 40mm Shotgun Round (`ammo.grenadelauncher.buckshot`) | 6 | 15 скрап | по умолч. | +1 / 10 с |
| Mixing Table (`mixingtable`) | 1 | 175 скрап | по умолч. | +1 / 10 с |

#### `BuyResources`

| Товар | Кол-во | Цена | Макс. запас | Пополнение |
|---|---|---|---|---|
| Scrap (`scrap`) | 1 | 6 Crude Oil (`crude.oil`) | по умолч. | +1 / 10 с |
| Scrap (`scrap`) | 1 | 20 Metal Fragments (`metal.fragments`) | по умолч. | +1 / 10 с |
| Scrap (`scrap`) | 2 | 1 High Quality Metal (`metal.refined`) | по умолч. | +1 / 10 с |
| Scrap (`scrap`) | 10 | 1 Anti-Radiation Pills (`antiradpills`) | по умолч. | +1 / 10 с |
| Scrap (`scrap`) | 15 | 1 Green Keycard (`keycard_green`) | по умолч. | +1 / 10 с |
| Scrap (`scrap`) | 40 | 1 Blue Keycard (`keycard_blue`) | по умолч. | +1 / 10 с |
| Scrap (`scrap`) | 80 | 1 Red Keycard (`keycard_red`) | по умолч. | +1 / 10 с |

#### `Bandit_Farming`

| Товар | Кол-во | Цена | Макс. запас | Пополнение |
|---|---|---|---|---|
| Composter (`composter`) | 1 | 30 скрап | по умолч. | +1 / 10 с |
| Large Planter Box (`planter.large`) | 1 | 30 скрап | по умолч. | +1 / 10 с |
| Water Barrel (`water.barrel`) | 1 | 30 скрап | по умолч. | +1 / 10 с |
| Sprinkler (`electric.sprinkler`) | 1 | 15 скрап | по умолч. | +1 / 10 с |
| Fluid Switch & Pump (`fluid.switch`) | 1 | 30 скрап | по умолч. | +1 / 10 с |
| Fluid Splitter (`fluid.splitter`) | 1 | 30 скрап | по умолч. | +1 / 10 с |
| Ceiling Light (`ceilinglight`) | 1 | 30 скрап | по умолч. | +1 / 10 с |

#### `Bandit_ProduceExchange`

| Товар | Кол-во | Цена | Макс. запас | Пополнение |
|---|---|---|---|---|
| Scrap (`scrap`) | 10 | 15 Corn (`corn`) | по умолч. | +1 / 60 с |
| Scrap (`scrap`) | 10 | 80 Cloth (`cloth`) | по умолч. | +1 / 60 с |
| Scrap (`scrap`) | 5 | 1 Small Trout (`fish.troutsmall`) | по умолч. | +1 / 60 с |
| Scrap (`scrap`) | 3 | 2 Fertilizer (`fertilizer`) | по умолч. | +1 / 60 с |
| Scrap (`scrap`) | 2 | 1 Jar of Honey (`honey`) | по умолч. | +1 / 60 с |

## Конюшни, рыбацкие деревни

- Конюшни (`stables_a`, `stables_b`): «Stables Shopkeeper» — набор `stables`.
- Рыбацкие деревни (`fishing_village_a/b/c`): «Shop Keeper» — `Fishing_Village`, «Boat Vendor» — `BoatVendor`,
  «Fish Exchange» — `FishExchange` (вы продаёте рыбу).

#### `stables`

| Товар | Кол-во | Цена | Макс. запас | Пополнение |
|---|---|---|---|---|
| Single Horse Saddle (`horse.saddle.single`) | 1 | 75 скрап | по умолч. | +1 / 10 с |
| Double Horse Saddle (`horse.saddle.double`) | 1 | 90 скрап | по умолч. | +1 / 10 с |
| Roadsign Horse Armor (`horse.armor.roadsign`) | 1 | 100 скрап | по умолч. | +1 / 10 с |
| High Quality Horse Shoes (`horse.shoes.advanced`) | 1 | 40 скрап | по умолч. | +1 / 10 с |
| Scrap (`scrap`) | 50 | 12 Rose (`rose`) | по умолч. | +1 / 900 с |
| Scrap (`scrap`) | 3 | 1 Sunflower (`sunflower`) | по умолч. | +1 / 300 с |
| Scrap (`scrap`) | 8 | 1 Orchid (`orchid`) | по умолч. | +1 / 600 с |

#### `Fishing_Village`

| Товар | Кол-во | Цена | Макс. запас | Пополнение |
|---|---|---|---|---|
| Diving Mask (`diving.mask`) | 1 | 15 скрап | по умолч. | +1 / 10 с |
| Diving Tank (`diving.tank`) | 1 | 35 скрап | по умолч. | +1 / 10 с |
| Diving Fins (`diving.fins`) | 1 | 25 скрап | по умолч. | +1 / 10 с |
| Wetsuit (`diving.wetsuit`) | 1 | 20 скрап | по умолч. | +1 / 60 с |
| Worm (`worm`) | 5 | 50 скрап | по умолч. | +1 / 60 с |
| Handmade Fishing Rod (`fishingrod.handmade`) | 1 | 80 скрап | по умолч. | +1 / 60 с |

#### `BoatVendor`

| Товар | Кол-во | Цена | Макс. запас | Пополнение |
|---|---|---|---|---|
| Kayak (`kayak`) | 1 | 50 скрап | по умолч. | +1 / 10 с |
| Paddle (`paddle`) | 1 | 25 скрап | по умолч. | +1 / 10 с |
| Torpedo (`submarine.torpedo.straight`) | 2 | 75 скрап | по умолч. | +1 / 10 с |
| Diver propulsion vehicle (`skidoo`) | 1 | 200 скрап | по умолч. | +1 / 10 с |

#### `FishExchange`

| Товар | Кол-во | Цена | Макс. запас | Пополнение |
|---|---|---|---|---|
| Scrap (`scrap`) | 30 | 5 Small Trout (`fish.troutsmall`) | по умолч. | +1 / 10 с |
| Scrap (`scrap`) | 50 | 5 Yellow Perch (`fish.yellowperch`) | по умолч. | +1 / 10 с |
| Scrap (`scrap`) | 90 | 2 Small Shark (`fish.smallshark`) | по умолч. | +1 / 10 с |
| Scrap (`scrap`) | 55 | 2 Salmon (`fish.salmon`) | по умолч. | +1 / 10 с |
| Scrap (`scrap`) | 75 | 2 Orange Roughy (`fish.orangeroughy`) | по умолч. | +1 / 10 с |
| Scrap (`scrap`) | 65 | 2 Catfish (`fish.catfish`) | по умолч. | +1 / 10 с |

## Колодцы и бар казино

Колодцы (`water_well_a…e`) используют `WaterWell`, а на сервере эпохи «primitive» — `WaterWell_Primitive`.
В наборе больше 7 позиций, поэтому автомат выбирает 7 случайных по весу и ставит каждой случайную цену
(округление до 5). Раз в `server.waterWellNpcSalesRefreshFrequency` часов (1 по умолчанию) ассортимент
перевыбирается. Динамическое ценообразование выключено (`BypassDynamicPricing = 1`), `StartingStock = 2`.
У колодцев нет маркера на карте.

Бар казино в плавучем городе («Casino Bar Shopkeeper») использует тот же набор `WaterWell`, но с
`StartingStock = 10`, без периодического перевыбора. Плавающих цен у него нет, если плавучий город стоит в зоне глубокого моря (см. ниже).

Поле «Цена» в наборе (`currencyAmount = 150`) для этих позиций не используется: при `useRandom` цена
берётся из `GetRandomPrice`.

#### `WaterWell`

| Товар | Кол-во | Цена, скрап | Дешёвая цена (шанс) | Вес | Макс. запас | Пополнение |
|---|---|---|---|---|---|---|
| Advanced Scrap Tea (`scraptea.advanced`) | 1 | 50–60 | 35–45 (10 %) | 0.01 | по умолч. | +1 / 600 с |
| Advanced Wood Tea (`woodtea.advanced`) | 1 | 30–40 | 25–30 (10 %) | 0.02 | по умолч. | +1 / 600 с |
| Advanced Ore Tea (`oretea.advanced`) | 1 | 35–45 | 30–35 (10 %) | 0.02 | по умолч. | +1 / 600 с |
| Advanced Max Health Tea (`maxhealthtea.advanced`) | 1 | 30–40 | 25–30 (10 %) | 0.02 | по умолч. | +1 / 600 с |
| Advanced Healing Tea (`healingtea.advanced`) | 1 | 30–40 | 25–30 (10 %) | 0.03 | по умолч. | +1 / 600 с |
| Pickaxe (`pickaxe`) | 1 | 30–40 | 15–30 (10 %) | 0.05 | по умолч. | +1 / 600 с |
| Hatchet (`hatchet`) | 1 | 30–40 | 15–30 (10 %) | 0.05 | по умолч. | +1 / 600 с |
| Revolver (`pistol.revolver`) | 1 | 100–125 | 30–70 (20 %) | 0.10 | по умолч. | +1 / 600 с |
| Double Barrel Shotgun (`shotgun.double`) | 1 | 100–125 | 75–100 (10 %) | 0.10 | по умолч. | +1 / 600 с |
| Medical Syringe (`syringe.medical`) | 2 | 10–15 | 5–15 (10 %) | 0.10 | 10 | +1 / 120 с |
| Bandage (`medical.honey.bandage`) | 3 | 10–15 | 5–15 (10 %) | 0.10 | 10 | +1 / 120 с |
| Large Medkit (`largemedkit`) | 1 | 20–30 | 10–20 (10 %) | 0.05 | 10 | +1 / 120 с |
| Jackhammer (`jackhammer`) | 1 | 150–200 | 100–150 (10 %) | 0.05 | по умолч. | +1 / 600 с |
| Chainsaw (`chainsaw`) | 1 | 80–125 | 75–100 (10 %) | 0.05 | по умолч. | +1 / 600 с |
| Hazmat Suit (`hazmatsuit`) | 1 | 80–100 | 30–60 (10 %) | 0.05 | по умолч. | +1 / 600 с |
| Pistol Bullet (`ammo.pistol`) | 20 | 20–25 | 15–20 (10 %) | 0.10 | 10 | +1 / 120 с |
| Apple (`apple`) | 1 | 10–30 | 5–10 (10 %) | 0.05 | 10 | +1 / 120 с |
| Advanced Harvesting Tea (`advanceharvestingtea`) | 1 | 50–60 | 35–45 (10 %) | 0.05 | по умолч. | +1 / 600 с |
| Advanced Crafting Quality Tea (`advancedcraftingtea_quality`) | 1 | 50–60 | 35–45 (10 %) | 0.05 | по умолч. | +1 / 600 с |

#### `WaterWell_Primitive`

| Товар | Кол-во | Цена, скрап | Дешёвая цена (шанс) | Вес | Макс. запас | Пополнение |
|---|---|---|---|---|---|---|
| Advanced Scrap Tea (`scraptea.advanced`) | 1 | 50–60 | 35–45 (10 %) | 0.01 | по умолч. | +1 / 600 с |
| Advanced Wood Tea (`woodtea.advanced`) | 1 | 30–40 | 25–30 (10 %) | 0.02 | по умолч. | +1 / 600 с |
| Advanced Ore Tea (`oretea.advanced`) | 1 | 35–45 | 30–35 (10 %) | 0.02 | по умолч. | +1 / 600 с |
| Advanced Max Health Tea (`maxhealthtea.advanced`) | 1 | 30–40 | 25–30 (10 %) | 0.02 | по умолч. | +1 / 600 с |
| Advanced Healing Tea (`healingtea.advanced`) | 1 | 30–40 | 25–30 (10 %) | 0.03 | по умолч. | +1 / 600 с |
| Pickaxe (`pickaxe`) | 1 | 30–40 | 15–30 (10 %) | 0.05 | по умолч. | +1 / 600 с |
| Hatchet (`hatchet`) | 1 | 30–40 | 15–30 (10 %) | 0.05 | по умолч. | +1 / 600 с |
| Medical Syringe (`syringe.medical`) | 2 | 10–15 | 5–15 (10 %) | 0.10 | 10 | +1 / 120 с |
| Bandage (`medical.honey.bandage`) | 3 | 10–15 | 5–15 (10 %) | 0.10 | 10 | +1 / 120 с |
| Large Medkit (`largemedkit`) | 1 | 20–30 | 10–20 (10 %) | 0.05 | 10 | +1 / 120 с |
| Hazmat Suit (`hazmatsuit`) | 1 | 80–100 | 30–60 (10 %) | 0.05 | по умолч. | +1 / 600 с |

## Плавучий город (глубокое море)

Те же наборы, что на суше: `Weapons`, `Weapons_Bandit`, `Attire`, `FoodVendor`, `Bandit_Farming`, `Fishing_Village`,
`WaterWell_Primitive` («Medical shop»). Цены в глубоком море не плавают: `DynamicPricingServerInit`
включает `BypassDynamicPricing`, если автомат внутри зоны глубокого моря.

## Наборы без размещения на монументах

Эти наборы существуют (часть — в манифесте `NPCVendingOrderManifest`), но в известных
префабах монументов не стоят. Их могут использовать другие префабы или модовые
карты (`assets/bundled/prefabs/modding/hapis/*`).

#### `Compound_Extra2`

| Товар | Кол-во | Цена | Макс. запас | Пополнение |
|---|---|---|---|---|
| Elevator (`elevator`) | 1 | 250 скрап | по умолч. | +1 / 10 с |
| Smart Alarm (`smart.alarm`) | 1 | 75 скрап | по умолч. | +1 / 10 с |
| Smart Switch (`smart.switch`) | 1 | 75 скрап | по умолч. | +1 / 10 с |
| Button (`electric.button`) | 1 | 30 скрап | по умолч. | +1 / 10 с |
| Wooden Barricade Cover (`barricade.wood.cover`) | 1 | 75 скрап | по умолч. | +1 / 10 с |
| Storage Monitor (`storage.monitor`) | 1 | 75 скрап | по умолч. | +1 / 10 с |
| Telephone (`telephone`) | 1 | 50 скрап | по умолч. | +1 / 10 с |

#### `Vehicles2`

| Товар | Кол-во | Цена | Макс. запас | Пополнение |
|---|---|---|---|---|
| High Quality Pistons (`piston3`) | 1 | 70 скрап | по умолч. | +1 / 10 с |
| High Quality Crankshaft (`crankshaft3`) | 1 | 100 скрап | по умолч. | +1 / 10 с |
| High Quality Valves (`valve3`) | 1 | 70 скрап | по умолч. | +1 / 10 с |
| High Quality Spark Plugs (`sparkplug3`) | 1 | 70 скрап | по умолч. | +1 / 10 с |
| High Quality Carburetor (`carburetor3`) | 1 | 100 скрап | по умолч. | +1 / 10 с |

#### `attire_bandit`

| Товар | Кол-во | Цена | Макс. запас | Пополнение |
|---|---|---|---|---|
| T-Shirt (`tshirt`) | 1 | 5 скрап | по умолч. | +1 / 10 с |
| Longsleeve T-Shirt (`tshirt.long`) | 1 | 10 скрап | по умолч. | +1 / 10 с |
| Snow Jacket (`jacket.snow`) | 1 | 20 скрап | по умолч. | +1 / 10 с |
| Boots (`shoes.boots`) | 1 | 20 скрап | по умолч. | +1 / 10 с |
| Roadsign Horse Armor (`horse.armor.roadsign`) | 1 | 100 скрап | по умолч. | +1 / 10 с |

#### `HapisVendor`

| Товар | Кол-во | Цена | Макс. запас | Пополнение |
|---|---|---|---|---|
| Camera (`tool.camera`) | 1 | 75 скрап | по умолч. | +1 / 10 с |
| Pumpkin Seed (`seed.pumpkin`) | 10 | 75 скрап | по умолч. | +1 / 10 с |
| Hemp Seed (`seed.hemp`) | 10 | 75 скрап | по умолч. | +1 / 10 с |
| Hazmat Suit (`hazmatsuit`) | 1 | 125 скрап | по умолч. | +1 / 10 с |
| Metal Ore (`metal.ore`) | 100 | 300 Stones (`stones`) | по умолч. | +1 / 10 с |
| Low Grade Fuel (`lowgradefuel`) | 125 | 1 Diesel Fuel (`diesel_barrel`) | по умолч. | +1 / 10 с |

#### `FloatingCity_BoatVendor`

| Товар | Кол-во | Цена | Макс. запас | Пополнение |
|---|---|---|---|---|
| Boat Plan (`boat.planner`) | 1 | 50 скрап | по умолч. | +1 / 10 с |
| Sail (`sail`) | 1 | 50 скрап | по умолч. | +1 / 10 с |
| Steering Wheel (`steeringwheel.boat`) | 1 | 50 скрап | по умолч. | +1 / 10 с |
| Anchor (`anchor`) | 1 | 50 скрап | по умолч. | +1 / 10 с |
| Diver propulsion vehicle (`skidoo`) | 1 | 100 скрап | по умолч. | +1 / 10 с |
| Sail (`smallengine`) | 1 | 250 скрап | по умолч. | +1 / 10 с |

Наборы торговца-путешественника (`TravellingVendorLite`, `TravellingVendor_Primitive`, `TravellingVendor`)
описаны в [[travelling-vendor]].
