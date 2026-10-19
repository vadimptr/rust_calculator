---
id: data-crafting
title: Таблица: рецепты крафта
kind: data
group: Предметы и производство
icon: ui/blueprint
summary: Ингредиенты, время и уровень верстака для каждого крафтового предмета.
related: [crafting, research, workbench, recycling]
code: [ItemBlueprint.cs, ItemCrafter.cs]
---

## Как читать

Рецепты всех предметов, которые игрок может скрафтить. Время — базовое, без бонуса верстака, см. [[crafting]]. «Верстак» — нужный уровень. «Сразу» — чертёж известен с начала. Названия предметов — английские, как в игре.

## Оружие

| Предмет | Код | Ингредиенты | Время, с | Верстак | Сразу |
|---|---|---|---|---|---|
| 8x Zoom Scope | `weapon.mod.small.scope` | 50 High Quality Metal | 30 | 3 |  |
| Assault Rifle | `rifle.ak` | 50 High Quality Metal, 200 Wood, 1 Rifle Body, 4 Metal Spring | 45 | 3 |  |
| Ballista | `ballista.static` | 250 Metal Fragments, 1 Gears, 2 Sheet Metal | 30 | 2 |  |
| Battering Ram | `batteringram` | 500 Wood, 2 Sheet Metal, 1 Tarp, 100 High Quality Metal | 30 | 2 |  |
| Beancan Grenade | `grenade.beancan` | 60 Gun Powder, 20 Metal Fragments | 10 | 1 |  |
| Bee Grenade | `grenade.bee` | 1 Beehive Nucleus, 30 Cloth | 10 | 1 |  |
| Blow Pipe | `blowpipe` | 200 Wood, 1 Metal Pipe, 10 Cloth | 30 | 1 |  |
| Bolt Action Rifle | `rifle.bolt` | 20 High Quality Metal, 1 Rifle Body, 3 Metal Pipe, 1 Metal Spring | 45 | 3 |  |
| Bone Club | `bone.club` | 20 Bone Fragments | 10 | — | да |
| Bone Knife | `knife.bone` | 30 Bone Fragments | 30 | — | да |
| Boomerang | `boomerang` | 300 Wood | 10 | — | да |
| Catapult | `catapult` | 500 Wood, 20 High Quality Metal, 1 Rope, 1 Gears | 30 | 2 |  |
| Combat Knife | `knife.combat` | 25 Metal Fragments, 1 High Quality Metal | 15 | 1 |  |
| Compound Bow | `bow.compound` | 100 Wood, 75 Metal Fragments, 2 Rope | 30 | 1 |  |
| Crossbow | `crossbow` | 200 Wood, 75 Metal Fragments, 2 Rope | 30 | 1 | да |
| Custom SMG | `smg.2` | 8 High Quality Metal, 1 SMG Body, 1 Metal Spring | 30 | 2 |  |
| Double Barrel Shotgun | `shotgun.double` | 175 Metal Fragments, 2 Metal Pipe | 40 | 1 |  |
| Eoka Pistol | `pistol.eoka` | 75 Wood, 30 Metal Fragments | 30 | — | да |
| Extended Magazine | `weapon.mod.extendedmags` | 10 High Quality Metal | 30 | 2 |  |
| F1 Grenade | `grenade.f1` | 30 Gun Powder, 25 Metal Fragments | 10 | 2 |  |
| Flame Thrower | `flamethrower` | 15 High Quality Metal, 6 Metal Pipe, 100 Low Grade Fuel, 2 Empty Propane Tank | 40 | 2 |  |
| Flashbang | `grenade.flashbang` | 25 Gun Powder, 50 Metal Fragments | 10 | 2 |  |
| Gas Compression Overdrive | `weapon.mod.gascompressionovedrive` | 10 High Quality Metal | 30 | 2 |  |
| HMLMG | `hmlmg` | 30 High Quality Metal, 1 Rifle Body, 3 Metal Spring, 2 Gears | 30 | 3 |  |
| Handmade SMG | `t1_smg` | 5 High Quality Metal, 200 Metal Fragments, 1 Metal Spring | 30 | 1 |  |
| High Caliber Revolver | `revolver.hc` | 4 Metal Pipe, 1 Metal Spring, 1 Gears, 6 High Quality Metal | 30 | 2 |  |
| Holosight | `weapon.mod.holosight` | 12 High Quality Metal, 1 Tech Trash | 30 | 2 |  |
| Homing Missile Launcher | `homingmissile.launcher` | 20 High Quality Metal, 3 Metal Pipe, 1 Tech Trash, 1 CCTV Camera | 30 | 2 |  |
| Hunting Bow | `bow.hunting` | 200 Wood, 50 Cloth | 30 | — | да |
| Longsword | `longsword` | 2 Metal Blade, 100 Metal Fragments | 30 | 2 |  |
| MP5A4 | `paintballgun` | 50 Metal Fragments, 1 Metal Pipe | 30 | — |  |
| MP5A4 | `smg.mp5` | 15 High Quality Metal, 1 SMG Body, 2 Metal Spring | 30 | 3 |  |
| Mace | `mace` | 100 Wood, 50 Metal Fragments | 30 | 1 |  |
| Machete | `machete` | 100 Wood, 40 Metal Fragments | 30 | — | да |
| Mini Crossbow | `minicrossbow` | 200 Wood, 150 Metal Fragments, 1 Rope, 1 Gears | 30 | 1 |  |
| Molotov Cocktail | `grenade.molotov` | 10 Cloth, 50 Low Grade Fuel | 10 | 2 |  |
| Mounted Ballista | `ballista.mounted` | 250 Metal Fragments, 1 Gears, 2 Sheet Metal | 30 | 2 |  |
| Muzzle Boost | `weapon.mod.muzzleboost` | 10 High Quality Metal | 30 | 2 |  |
| Muzzle Brake | `weapon.mod.muzzlebrake` | 8 High Quality Metal | 30 | 2 |  |
| Nailgun | `pistol.nailgun` | 75 Metal Fragments, 15 Scrap | 30 | 1 | да |
| Oil Filter Silencer | `weapon.mod.oilfiltersilencer` | 10 High Quality Metal | 30 | 2 |  |
| Paddle | `paddle` | 15 Metal Fragments, 1 Metal Blade, 200 Wood | 30 | — |  |
| Pump Shotgun | `shotgun.pump` | 15 High Quality Metal, 2 Metal Pipe, 1 Metal Spring | 40 | 2 |  |
| Python Revolver | `pistol.python` | 3 Metal Pipe, 1 Metal Spring, 10 High Quality Metal | 30 | 2 |  |
| Revolver | `pistol.revolver` | 1 Metal Pipe, 25 Cloth, 125 Metal Fragments | 30 | 1 |  |
| Rocket Launcher | `rocket.launcher` | 40 High Quality Metal, 4 Metal Pipe | 60 | 2 |  |
| SKS | `rifle.sks` | 1 Semi Automatic Body, 2 Metal Spring, 200 Metal Fragments, 12 High Quality Metal | 30 | 3 |  |
| Salvaged Cleaver | `salvaged.cleaver` | 50 Metal Fragments, 1 Road Signs | 30 | 1 |  |
| Salvaged Sword | `salvaged.sword` | 15 Metal Fragments, 1 Metal Blade | 30 | 1 |  |
| Semi-Automatic Pistol | `pistol.semiauto` | 1 Semi Automatic Body, 6 High Quality Metal, 1 Metal Pipe | 30 | 2 |  |
| Semi-Automatic Rifle | `rifle.semiauto` | 1 Semi Automatic Body, 1 Metal Spring, 450 Metal Fragments, 4 High Quality Metal | 30 | 2 |  |
| Siege Tower | `siegetower` | 500 Wood, 250 Metal Fragments, 1 Gears | 30 | 1 |  |
| Simple Handmade Sight | `weapon.mod.simplesight` | 6 High Quality Metal | 30 | 1 | да |
| Skinning Knife | `knife.skinning` | 75 Metal Fragments | 30 | 1 |  |
| Soda Can Silencer | `weapon.mod.sodacansilencer` | 40 Metal Fragments | 30 | 1 |  |
| Speargun | `speargun` | 75 Metal Fragments, 1 Empty Propane Tank | 30 | 1 |  |
| Stone Spear | `spear.stone` | 1 Wooden Spear, 20 Stones | 10 | — | да |
| Targeting Attachment | `weapon.mod.targetingattachment` | 10 High Quality Metal, 1 Tech Trash | 30 | 2 |  |
| Thompson | `smg.thompson` | 10 High Quality Metal, 100 Wood, 1 SMG Body, 1 Metal Spring | 30 | 2 |  |
| Water Gun | `gun.water` | 125 Metal Fragments | 30 | — | да |
| Water Pistol | `pistol.water` | 75 Metal Fragments | 30 | — | да |
| Waterpipe Shotgun | `shotgun.waterpipe` | 150 Wood, 75 Metal Fragments | 30 | 1 |  |
| Weapon Lasersight | `weapon.mod.lasersight` | 3 High Quality Metal, 1 Tech Trash | 30 | 3 |  |
| Weapon flashlight | `weapon.mod.flashlight` | 3 High Quality Metal | 30 | 1 |  |
| Wooden Spear | `spear.wooden` | 300 Wood | 30 | — | да |

## Строительство

| Предмет | Код | Ингредиенты | Время, с | Верстак | Сразу |
|---|---|---|---|---|---|
| Animal Fence | `wall.animal.fence` | 250 Wood | 30 | — |  |
| Animal Fence Gate | `wall.animal.fence.gate` | 500 Wood | 30 | — |  |
| Armored Door | `door.hinged.toptier` | 20 High Quality Metal, 5 Gears | 30 | 3 |  |
| Armored Double Door | `door.double.hinged.toptier` | 25 High Quality Metal, 5 Gears | 30 | 3 |  |
| Barbed Wooden Barricade | `barricade.woodwire` | 300 Wood, 50 Metal Fragments, 1 Rope | 30 | 1 |  |
| Beehive | `beehive` | 300 Wood, 1 Sheet Metal | 30 | 1 |  |
| Boat Plan | `boat.planner` | 20 Wood | 15 | 1 |  |
| Building Plan | `building.planner` | 20 Wood | 15 | — | да |
| Chainlink Fence | `wall.frame.fence` | 75 Metal Fragments | 30 | 1 |  |
| Chainlink Fence Gate | `wall.frame.fence.gate` | 75 Metal Fragments | 30 | 1 |  |
| Cloth | `mortar.deployable` | 15 High Quality Metal, 1 Metal Pipe | 30 | 2 |  |
| Code Lock | `lock.code` | 100 Metal Fragments | 30 | — | да |
| Concrete Barricade | `barricade.concrete` | 200 Stones | 30 | 2 |  |
| Floor grill | `floor.grill` | 75 Metal Fragments | 30 | 1 |  |
| Floor triangle grill | `floor.triangle.grill` | 75 Metal Fragments | 30 | 1 |  |
| Garage Door | `wall.frame.garagedoor` | 300 Metal Fragments, 2 Gears | 30 | 2 |  |
| Graveyard Fence | `wall.graveyard.fence` | 250 Stones, 75 Metal Fragments | 30 | — |  |
| High External Stone Gate | `gates.external.high.stone` | 3000 Stones, 5 Gears | 35 | 2 |  |
| High External Stone Wall ×3 | `wall.external.high.stone` | 4000 Stones, 1 Sheet Metal | 30 | 2 |  |
| High External Wooden Gate | `gates.external.high.wood` | 3000 Wood, 2 Gears | 35 | 1 |  |
| High External Wooden Wall ×3 | `wall.external.high` | 4000 Wood | 30 | 1 |  |
| Key Lock | `lock.key` | 75 Wood | 15 | — | да |
| Ladder Hatch | `floor.ladder.hatch.toptier` | 1 Wooden Ladder, 35 High Quality Metal, 6 Gears | 30 | 3 |  |
| Ladder Hatch | `floor.ladder.hatch` | 1 Wooden Ladder, 300 Metal Fragments, 3 Gears | 30 | 2 |  |
| Large Water Catcher | `water.catcher.large` | 500 Wood, 200 Metal Fragments, 2 Tarp | 30 | 2 |  |
| Legacy Wood Shelter | `legacy.shelter.wood` | 600 Wood | 30 | — | да |
| Lunar Wall Frame Inlay | `wall.frame.lunar2025_a` | 100 Wood | 15 | — |  |
| Medieval Barricade | `barricade.medieval` | 300 Wood, 50 Metal Fragments | 30 | 1 |  |
| Metal Barricade | `barricade.metal` | 200 Metal Fragments, 2 Metal Blade | 30 | 2 |  |
| Metal Shop Front | `wall.frame.shopfront.metal` | 250 Metal Fragments | 30 | 1 | да |
| Metal Vertical embrasure | `shutter.metal.embrasure.b` | 100 Metal Fragments | 10 | 2 |  |
| Metal Window Bars | `wall.window.bars.metal` | 25 Metal Fragments | 15 | 1 |  |
| Metal horizontal embrasure | `shutter.metal.embrasure.a` | 100 Metal Fragments | 10 | 2 |  |
| Netting | `wall.frame.netting` | 1 Rope | 30 | — | да |
| Prison Cell Gate | `wall.frame.cell.gate` | 150 Metal Fragments | 30 | 2 |  |
| Prison Cell Wall | `wall.frame.cell` | 150 Metal Fragments | 30 | 2 |  |
| Reinforced Glass Window | `wall.window.bars.toptier` | 4 High Quality Metal | 15 | 3 |  |
| Sandbag Barricade | `barricade.sandbags` | 50 Stones, 5 Cloth | 10 | 1 |  |
| Sheet Metal Door | `door.hinged.metal` | 150 Metal Fragments | 30 | — | да |
| Sheet Metal Double Door | `door.double.hinged.metal` | 200 Metal Fragments | 30 | — | да |
| Shop Front | `wall.frame.shopfront` | 150 Wood | 30 | — | да |
| Small Water Catcher | `water.catcher.small` | 100 Wood, 50 Metal Fragments, 1 Tarp | 30 | 1 |  |
| Stone Barricade | `barricade.stone` | 100 Stones | 30 | — |  |
| Strengthened Glass Window | `wall.window.glass.reinforced` | 50 Metal Fragments | 15 | 2 |  |
| Tool Cupboard | `cupboard.tool` | 1000 Wood | 30 | — | да |
| Triangle Ladder Hatch | `floor.triangle.ladder.hatch.toptier` | 1 Wooden Ladder, 35 High Quality Metal, 6 Gears | 30 | 3 |  |
| Triangle Ladder Hatch | `floor.triangle.ladder.hatch` | 1 Wooden Ladder, 300 Metal Fragments, 3 Gears | 30 | 2 |  |
| Watch Tower | `watchtower.wood` | 250 Wood | 30 | 1 |  |
| Wood Double Door | `door.double.hinged.wood` | 350 Wood | 30 | — | да |
| Wood Shutters | `shutter.wood.a` | 200 Wood | 15 | — |  |
| Wooden Barricade | `barricade.wood` | 300 Wood, 1 Rope | 30 | — |  |
| Wooden Barricade Cover | `barricade.wood.cover` | 250 Wood | 25 | — |  |
| Wooden Door | `door.hinged.wood` | 300 Wood | 30 | — | да |
| Wooden Frontier Bar Doors | `door.double.hinged.bardoors` | 200 Wood | 30 | — |  |
| Wooden Ladder | `ladder.wooden.wall` | 300 Wood, 3 Rope | 30 | 1 |  |
| Wooden Window Bars | `wall.window.bars.wood` | 50 Wood | 15 | — | да |

## Предметы

| Предмет | Код | Ингредиенты | Время, с | Верстак | Сразу |
|---|---|---|---|---|---|
| Abyss Horizontal Storage Tank | `abyss.barrel.horizontal` | 300 Wood, 75 Metal Fragments | 30 | — |  |
| Abyss Vertical Storage Tank | `abyss.barrel.vertical` | 300 Wood, 75 Metal Fragments | 30 | — |  |
| Anchor | `anchor` | 250 Wood | 30 | 1 |  |
| Armored Cockpit Vehicle Module | `vehicle.1mod.cockpit.armored` | 150 Metal Fragments, 5 High Quality Metal | 30 | 3 |  |
| Armored Passenger Vehicle Module | `vehicle.1mod.passengers.armored` | 150 Metal Fragments, 5 High Quality Metal | 30 | 3 |  |
| Asbestos Armor Insert | `clothing.mod.armorinsert_asbestos` | 50 Metal Fragments | 30 | 2 |  |
| Bamboo Barrel | `bamboo.barrel` | 300 Wood, 75 Metal Fragments | 30 | — |  |
| Barbeque | `bbq` | 40 Metal Fragments, 100 Wood | 30 | — | да |
| Bath Tub Planter | `bathtub.planter` | 100 Metal Fragments | 30 | — |  |
| Bed | `bed` | 60 Cloth, 100 Metal Fragments, 2 Sewing Kit | 30 | 1 |  |
| Biofuel Generator | `generator.biofuel` | 250 Metal Fragments, 150 Wood | 30 | 1 |  |
| Boat Building Station | `boatbuildingstation` | 200 Wood, 1 Tarp | 30 | 1 |  |
| Bota Bag | `botabag` | 10 Cloth | 15 | — | да |
| Camp Fire | `campfire` | 100 Wood | 30 | — | да |
| Camper Vehicle Module | `vehicle.2mod.camper` | 175 Metal Fragments, 125 Wood | 30 | 2 |  |
| Cannon | `cannon` | 100 Wood, 200 Metal Fragments | 30 | 1 |  |
| Carvable Pumpkin | `carvable.pumpkin` | 1 Pumpkin | 1 | — |  |
| Chair | `chair` | 50 Wood, 75 Metal Fragments | 30 | 1 |  |
| Charity Plushie 01 | `charity.plushy.01` | 50 Cloth | 1 | — |  |
| Charity Plushie 02 | `charity.plushy.02` | 50 Cloth | 1 | — |  |
| Charity Plushie 02 | `charity.plushy.03` | 50 Cloth | 1 | — |  |
| Charity Plushie 02 | `charity.plushy.04` | 50 Cloth | 1 | — |  |
| Chicken Coop | `chickencoop` | 300 Wood, 1 Rope, 75 Metal Fragments | 30 | 1 |  |
| Chinese Lantern | `chineselantern` | 25 Cloth, 5 Low Grade Fuel | 30 | — |  |
| Chinese Lantern White | `chineselanternwhite` | 25 Cloth, 5 Low Grade Fuel | 30 | — |  |
| Chippy Arcade Game | `arcade.machine.chippy` | 10 High Quality Metal, 2 Gears | 30 | 1 |  |
| Christmas Door Wreath | `xmasdoorwreath` | 20 Cloth | 30 | — |  |
| Christmas Lights | `xmas.lightstring` | 25 Metal Fragments, 20 Low Grade Fuel | 30 | — |  |
| Clan Table | `clantable` | 200 Wood, 100 Metal Fragments | 30 | 1 |  |
| Clothing Mannequin | `mannequin` | 100 Wood, 50 Metal Fragments | 30 | — | да |
| Cockpit Vehicle Module | `vehicle.1mod.cockpit` | 150 Metal Fragments, 100 Wood | 30 | 2 |  |
| Cockpit With Engine Vehicle Module | `vehicle.1mod.cockpit.with.engine` | 150 Metal Fragments, 5 High Quality Metal, 100 Wood | 30 | 2 |  |
| Composter | `composter` | 2 Tarp, 200 Wood | 30 | — | да |
| Cooking Workbench | `cookingworkbench` | 200 Metal Fragments, 200 Stones, 100 Wood | 30 | 2 |  |
| Discord Trophy | `discord.trophy` | 50 Metal Fragments | 1 | — |  |
| Diver propulsion vehicle | `skidoo` | 1 Tech Trash, 150 Metal Fragments | 30 | 2 |  |
| Double Sign Post | `sign.post.double` | 75 Wood | 30 | — |  |
| Dragon Door Knocker | `dragondoorknocker` | 20 Metal Fragments | 30 | — |  |
| Drone | `drone` | 200 Metal Fragments, 1 CCTV Camera | 30 | 2 |  |
| Drop Box | `dropbox` | 200 Metal Fragments | 30 | 1 |  |
| Easter Door Wreath | `easterdoorwreath` | 20 Cloth | 30 | — |  |
| Empty Propane Tank | `propanetank` | 100 Metal Fragments, 10 Scrap | 1 | 2 |  |
| Engine Vehicle Module | `vehicle.1mod.engine` | 100 Metal Fragments, 3 High Quality Metal | 30 | 2 |  |
| Engineering Workbench | `iotable` | 500 Wood, 100 Metal Fragments | 30 | 1 |  |
| Festive Doorway Garland | `xmas.door.garland` | 25 Cloth | 30 | — |  |
| Festive Double Doorway Garland | `xmas.double.door.garland` | 25 Cloth | 30 | — |  |
| Festive Window Garland | `xmas.window.garland` | 25 Cloth | 30 | — |  |
| Fish Trophy | `fishtrophy` | 75 Wood | 20 | — |  |
| Flatbed Vehicle Module | `vehicle.1mod.flatbed` | 100 Metal Fragments, 100 Wood | 30 | 2 |  |
| Frontier Bolts Single Item Rack | `gunrack.single.1.horizontal` | 50 Wood, 20 Metal Fragments | 30 | 1 |  |
| Frontier Horns Single Item Rack | `gunrack.single.3.horizontal` | 30 Bone Fragments | 30 | 1 |  |
| Frontier Horseshoe Single Item Rack | `gunrack.single.2.horizontal` | 75 Metal Fragments | 30 | 1 |  |
| Fuel Tank Vehicle Module | `vehicle.2mod.fuel.tank` | 175 Metal Fragments, 100 Wood | 30 | 2 |  |
| Furnace | `furnace` | 200 Stones, 100 Wood, 50 Low Grade Fuel | 30 | — | да |
| Gears | `gears` | 25 Metal Fragments, 100 Scrap | 1 | 3 |  |
| Gold Frame Small | `goldframe.small` | 150 Wood | 30 | — |  |
| Gold Frame Standing | `goldframe.standing` | 150 Wood | 30 | — |  |
| Gold Frame large | `goldframe.large` | 150 Wood | 30 | — |  |
| Gold Frame large | `goldframe.xl` | 150 Wood | 30 | — |  |
| Gold Frame large | `goldframe.xxl` | 150 Wood | 30 | — |  |
| Half Height Bamboo Shelves | `half.bamboo.shelves` | 40 Metal Fragments | 10 | — |  |
| Half Height Bamboo Shelves | `halfheight.industrial.shelves` | 40 Metal Fragments | 10 | — |  |
| Hazmat Plushy | `hazmat.plushy` | 50 Cloth | 1 | — |  |
| Hazmat Youtooz | `hazmatyoutooz` | 50 Metal Fragments | 10 | — |  |
| Heavy Scientist Plushie | `heavy.scientist.plushie` | 50 Cloth | 1 | — |  |
| Heavy Scientist Youtooz | `heavyscientistyoutooz` | 50 Metal Fragments | 10 | — |  |
| High Quality Carburetor | `carburetor3` | 170 Metal Fragments | 10 | 3 |  |
| High Quality Crankshaft | `crankshaft3` | 120 Metal Fragments | 10 | 3 |  |
| High Quality Pistons | `piston3` | 120 Metal Fragments | 10 | 3 |  |
| High Quality Spark Plugs | `sparkplug3` | 120 Metal Fragments | 10 | 3 |  |
| High Quality Valves | `valve3` | 120 Metal Fragments | 10 | 3 |  |
| Hitch & Trough | `hitchtroughcombo` | 200 Wood | 30 | — | да |
| Hobo Barrel | `hobobarrel` | 100 Wood | 30 | — |  |
| Horizontal Weapon Rack | `gunrack.horizontal` | 100 Wood, 120 Metal Fragments | 30 | 1 |  |
| Huge Wooden Sign | `sign.wooden.huge` | 250 Wood | 30 | — |  |
| Ice Sculpture | `sculpture.rock` | 200 Stones, 100 Wood | 1 | — |  |
| Jack O Lantern Angry | `jackolantern.angry` | 2 Pumpkin | 20 | — |  |
| Jack O Lantern Happy | `jackolantern.happy` | 2 Pumpkin | 20 | — |  |
| Kayak | `kayak` | 75 Metal Fragments, 200 Wood, 50 Cloth | 30 | 1 |  |
| Krieg Storage Barrel | `industrial.storage.vertical` | 300 Wood, 75 Metal Fragments | 30 | — |  |
| Krieg Storage Barrel | `krieg.storage.vertical` | 300 Wood, 75 Metal Fragments | 30 | — |  |
| Krieg Storage Crates | `industrial.storage.horizontal` | 300 Wood, 75 Metal Fragments | 30 | — |  |
| Krieg Storage Crates | `krieg.storage.horizontal` | 300 Wood, 75 Metal Fragments | 30 | — |  |
| Landscape Photo Frame | `photoframe.landscape` | 100 Wood | 30 | — | да |
| Landscape Picture Frame | `sign.pictureframe.landscape` | 100 Wood, 10 Cloth | 30 | — |  |
| Lantern | `lantern` | 25 Metal Fragments, 15 Low Grade Fuel | 20 | — | да |
| Large Banner Hanging | `sign.hanging.banner.large` | 20 Cloth, 100 Metal Fragments | 30 | — |  |
| Large Banner on pole | `sign.pole.banner.large` | 100 Wood, 50 Metal Fragments, 20 Cloth | 30 | — |  |
| Large Flatbed Vehicle Module | `vehicle.2mod.flatbed` | 150 Metal Fragments, 150 Wood | 30 | 2 |  |
| Large Furnace | `furnace.large` | 500 Stones, 600 Wood, 75 Low Grade Fuel | 40 | 2 |  |
| Large Hunting Trophy | `huntingtrophylarge` | 150 Wood | 20 | — |  |
| Large Photo Frame | `photoframe.large` | 100 Wood | 30 | — | да |
| Large Planter Box | `planter.large` | 200 Wood, 2 Tarp | 30 | — |  |
| Large Wood Box | `box.wooden.large` | 250 Wood, 50 Metal Fragments | 30 | — | да |
| Large Wooden Sign | `sign.wooden.large` | 150 Wood | 30 | — |  |
| Lead Armor Insert | `clothing.mod.armorinsert_lead` | 4 High Quality Metal | 30 | 2 |  |
| Light-Up Frame Large | `lightup.large` | 150 Wood | 30 | — |  |
| Light-Up Frame Large | `lightup.xl` | 150 Wood | 30 | — |  |
| Light-Up Frame Large | `lightup.xxl` | 150 Wood | 30 | — |  |
| Light-Up Frame Small | `lightupframe.small` | 150 Wood | 30 | — |  |
| Light-Up Frame Standing | `lightupframe.standing` | 150 Wood | 30 | — |  |
| Locker | `locker` | 100 Metal Fragments, 50 Wood | 30 | 2 |  |
| Low Quality Carburetor | `carburetor1` | 40 Metal Fragments | 10 | 1 |  |
| Low Quality Crankshaft | `crankshaft1` | 25 Metal Fragments | 10 | 1 |  |
| Low Quality Pistons | `piston1` | 25 Metal Fragments | 10 | 1 |  |
| Low Quality Spark Plugs | `sparkplug1` | 25 Metal Fragments | 10 | 1 |  |
| Low Quality Valves | `valve1` | 25 Metal Fragments | 10 | 1 |  |
| Mail Box | `mailbox` | 100 Wood, 25 Metal Fragments | 30 | — |  |
| Medium Quality Carburetor | `carburetor2` | 100 Metal Fragments | 10 | 2 |  |
| Medium Quality Crankshaft | `crankshaft2` | 70 Metal Fragments | 10 | 2 |  |
| Medium Quality Pistons | `piston2` | 70 Metal Fragments | 10 | 2 |  |
| Medium Quality Spark Plugs | `sparkplug2` | 70 Metal Fragments | 10 | 2 |  |
| Medium Quality Valves | `valve2` | 70 Metal Fragments | 10 | 2 |  |
| Medium Wooden Sign | `sign.wooden.medium` | 100 Wood | 30 | — | да |
| Metal Blade | `metalblade` | 30 Metal Fragments, 10 Scrap | 1 | 2 |  |
| Metal Pipe | `metalpipe` | 2 High Quality Metal, 20 Scrap | 1 | 3 |  |
| Metal Spring | `metalspring` | 2 High Quality Metal, 50 Scrap | 1 | 3 |  |
| Minecart Planter | `minecart.planter` | 100 Metal Fragments | 30 | — |  |
| Mixing Table | `mixingtable` | 200 Metal Fragments, 100 Stones | 30 | 1 |  |
| One Sided Town Sign Post | `sign.post.town` | 100 Wood | 30 | — |  |
| Passenger Vehicle Module | `vehicle.2mod.passengers` | 175 Metal Fragments, 125 Wood | 30 | 2 |  |
| Plank | `plank` | 100 Wood | 30 | 1 |  |
| Plank | `small_ramp` | 250 Wood, 2 Rope | 30 | 1 |  |
| Portrait Photo Frame | `photoframe.portrait` | 100 Wood | 30 | — | да |
| Portrait Picture Frame | `sign.pictureframe.portrait` | 100 Wood, 10 Cloth | 30 | — |  |
| Rear Seats Vehicle Module | `vehicle.1mod.rear.seats` | 150 Metal Fragments, 100 Wood | 30 | 2 |  |
| Repair Bench | `box.repair.bench` | 125 Metal Fragments | 30 | 1 | да |
| Research Table | `research.table` | 200 Metal Fragments, 20 Scrap | 30 | 1 | да |
| Road Signs | `roadsigns` | 2 High Quality Metal, 20 Scrap | 1 | 3 |  |
| Rocking Chair | `rockingchair` | 130 Wood | 30 | 1 |  |
| Rug | `rug` | 25 Cloth | 30 | — |  |
| Rug Bear Skin | `rug.bear` | 20 Leather | 30 | — |  |
| Sail | `sail` | 150 Wood, 1 Tarp | 30 | 1 |  |
| Sail | `smallengine` | 5 High Quality Metal, 2 Gears, 50 Low Grade Fuel | 30 | 2 |  |
| Salvaged Shelves | `shelves` | 50 Metal Fragments | 10 | — |  |
| Scarecrow | `scarecrow` | 200 Wood, 10 Cloth | 30 | — |  |
| Scientist Plushie | `discord.plushie` | 50 Cloth | 1 | — |  |
| Scientist Plushie | `scientist.plushie` | 50 Cloth | 1 | — |  |
| Scrap Frame Small | `scrapframe.small` | 150 Wood | 30 | — |  |
| Scrap Frame Standing | `scrapframe.standing` | 150 Wood | 30 | — |  |
| Scrap Frame Standing | `scrapframe.xl` | 150 Wood | 30 | — |  |
| Scrap Frame Standing | `scrapframe.xxl` | 150 Wood | 30 | — |  |
| Scrap Frame large | `scrapframe.large` | 150 Wood | 30 | — |  |
| Secretlab Chair | `secretlabchair` | 50 Wood, 75 Metal Fragments | 30 | 1 | да |
| Sewing Kit | `sewingkit` | 20 Cloth, 3 Rope | 1 | 3 |  |
| Single Plant Pot | `plantpot.single` | 200 Wood | 30 | — | да |
| Single Shallow Wall Shelves | `single.shallow.wall.shelves` | 100 Wood | 10 | — |  |
| Single Shallow Wall Shelves | `wall.shallow.industrial.shelves` | 100 Wood | 10 | — |  |
| Single Sign Post | `sign.post.single` | 75 Wood | 30 | — |  |
| Skull Door Knocker | `skulldoorknocker` | 20 Metal Fragments | 30 | — |  |
| Skull Fire Pit | `skull_fire_pit` | 100 Wood, 1 Human Skull | 30 | — |  |
| Sleeping Bag | `sleepingbag` | 30 Cloth | 30 | — | да |
| Small Hunting Trophy | `huntingtrophysmall` | 100 Wood | 20 | — |  |
| Small Oil Refinery | `small.oil.refinery` | 200 Wood, 500 Metal Fragments, 250 Low Grade Fuel | 30 | 2 |  |
| Small Planter Box | `planter.small` | 100 Wood, 1 Tarp | 30 | — | да |
| Small Stash | `stash.small` | 10 Cloth | 15 | — | да |
| Small Wooden Sign | `sign.wooden.small` | 75 Wood | 30 | — | да |
| Snowman | `snowman` | 50 Charcoal, 20 Cloth, 20 Metal Fragments | 30 | — |  |
| Sofa | `sofa` | 100 Wood, 30 Cloth | 30 | — |  |
| Sofa | `twitchrivals2025sofa` | 100 Wood, 30 Cloth | 30 | — |  |
| Sofa - Pattern | `sofa.pattern` | 100 Wood, 30 Cloth | 30 | — |  |
| Spinning Wheel | `spinner.wheel` | 150 Metal Fragments | 20 | — |  |
| Steering Wheel | `steeringwheel.boat` | 100 Wood | 30 | 1 |  |
| Stone Fireplace | `fireplace.stone` | 500 Stones, 200 Wood | 30 | — |  |
| Storage Barrel Horizontal | `storage_barrel_c` | 300 Wood, 75 Metal Fragments | 30 | — |  |
| Storage Barrel Vertical | `storage_barrel_b` | 300 Wood, 75 Metal Fragments | 30 | — |  |
| Storage Vehicle Module | `vehicle.1mod.storage` | 50 Metal Fragments, 125 Wood | 30 | 2 |  |
| Survival Fish Trap | `fishtrap.small` | 200 Wood, 5 Cloth | 30 | — | да |
| Table | `table` | 100 Wood | 30 | — |  |
| Tall Picture Frame | `sign.pictureframe.tall` | 150 Wood, 10 Cloth | 30 | — |  |
| Tall Weapon Rack | `gunrack_tall.horizontal` | 100 Wood, 175 Metal Fragments | 30 | 1 |  |
| Taxi Vehicle Module | `vehicle.1mod.taxi` | 175 Metal Fragments, 125 Wood, 5 High Quality Metal | 30 | 2 |  |
| Torch Holder | `torchholder` | 40 Wood, 10 Metal Fragments | 20 | — |  |
| Triangle Planter Box | `planter.triangle` | 150 Wood, 1 Tarp | 30 | — |  |
| Tuna Can Lamp | `tunalight` | 1 Empty Tuna Can, 20 Wood, 10 Low Grade Fuel | 20 | — |  |
| Twitch Rivals Trophy | `circleballoon2025` | 15 Cloth | 10 | — |  |
| Twitch Rivals Trophy | `easel` | 100 Wood | 10 | — |  |
| Twitch Rivals Trophy | `heartballoon2025` | 15 Cloth | 10 | — |  |
| Twitch Rivals Trophy | `latexballoon2025` | 15 Cloth | 10 | — |  |
| Twitch Rivals Trophy | `latexclumpballoon2025` | 15 Cloth | 10 | — |  |
| Twitch Rivals Trophy | `speechbubbleballoon2025` | 15 Cloth | 10 | — |  |
| Twitch Rivals Trophy | `starballoon2025` | 15 Cloth | 10 | — |  |
| Twitch Rivals Trophy | `trophy` | 50 Metal Fragments | 10 | — |  |
| Twitch Rivals Trophy 2023 | `trophy2023` | 50 Metal Fragments | 10 | — |  |
| Two Sided Hanging Sign | `sign.hanging` | 150 Metal Fragments | 30 | — |  |
| Two Sided Ornate Hanging Sign | `sign.hanging.ornate` | 100 Metal Fragments | 30 | — |  |
| Two Sided Town Sign Post | `sign.post.town.roof` | 100 Wood, 50 Metal Fragments | 30 | — |  |
| Vending Machine | `vending.machine` | 20 High Quality Metal, 3 Gears | 30 | 1 | да |
| Wall Cabinet | `electric.wallcabinet` | 250 Wood, 50 Metal Fragments | 30 | 1 | да |
| Wanted Poster | `wantedposter` | 20 Wood | 20 | — |  |
| Water Barrel | `water.barrel` | 250 Wood, 1 Tarp | 30 | — |  |
| Water Purifier | `water.purifier` | 1 Empty Propane Tank, 15 Metal Fragments, 10 Cloth | 30 | — | да |
| Weapon Rack Stand | `gunrack_stand` | 200 Wood, 75 Metal Fragments | 30 | — |  |
| Wicker Barrel | `wicker.barrel` | 300 Wood, 75 Metal Fragments | 30 | — |  |
| Wide Weapon Rack | `gunrack_wide.horizontal` | 100 Wood, 175 Metal Fragments | 30 | 1 |  |
| Wood Storage Box | `box.wooden` | 100 Wood | 15 | — | да |
| Wooden Armor Insert | `clothing.mod.armorinsert_wood` | 150 Wood | 30 | 1 |  |
| Workbench Level 1 | `workbench1` | 500 Wood, 100 Metal Fragments | 30 | — | да |
| Workbench Level 2 | `workbench2` | 500 Metal Fragments, 20 High Quality Metal, 5 Research Paper | 45 | 1 | да |
| Workbench Level 3 | `workbench3` | 1000 Metal Fragments, 100 High Quality Metal, 5 Research Paper | 60 | 2 | да |
| XL Picture Frame | `sign.pictureframe.xl` | 150 Wood, 15 Cloth | 30 | — |  |
| XXL Picture Frame | `sign.artistcanvas.l` | 175 Wood, 30 Cloth | 30 | — |  |
| XXL Picture Frame | `sign.artistcanvas.m` | 175 Wood, 30 Cloth | 30 | — |  |
| XXL Picture Frame | `sign.artistcanvas.xl` | 175 Wood, 30 Cloth | 30 | — |  |
| XXL Picture Frame | `sign.artistcanvas.xs` | 175 Wood, 30 Cloth | 30 | — |  |
| XXL Picture Frame | `sign.artistcanvas.xxl` | 175 Wood, 30 Cloth | 30 | — |  |
| XXL Picture Frame | `sign.pictureframe.xxl` | 175 Wood, 30 Cloth | 30 | — |  |

## Ресурсы

| Предмет | Код | Ингредиенты | Время, с | Верстак | Сразу |
|---|---|---|---|---|---|
| Explosives | `explosives` | 50 Gun Powder, 3 Low Grade Fuel, 10 Sulfur, 10 Metal Fragments | 5 | 3 |  |
| Gun Powder ×10 | `gunpowder` | 30 Charcoal, 20 Sulfur | 2 | 1 | да |
| Low Grade Fuel ×4 | `lowgradefuel` | 3 Animal Fat, 1 Cloth | 5 | — | да |

## Одежда

| Предмет | Код | Ингредиенты | Время, с | Верстак | Сразу |
|---|---|---|---|---|---|
| Bandana Mask | `mask.bandana` | 5 Cloth | 30 | — |  |
| Baseball Cap | `hat.cap` | 5 Cloth | 30 | — |  |
| Basic Horse Shoes | `horse.shoes.basic` | 50 Metal Fragments | 30 | 1 | да |
| Beenie Hat | `hat.beenie` | 15 Cloth | 30 | — |  |
| Bone Armor | `bone.armor.suit` | 15 Cloth, 70 Bone Fragments | 30 | — | да |
| Bone Helmet | `deer.skull.mask` | 15 Cloth, 30 Bone Fragments | 30 | — | да |
| Boonie Hat | `hat.boonie` | 10 Cloth | 30 | — |  |
| Boots | `shoes.boots` | 20 Leather, 15 Metal Fragments, 1 Sewing Kit | 30 | 2 |  |
| Bucket Helmet | `bucket.helmet` | 20 Metal Fragments | 30 | 1 |  |
| Bunny Hat | `hat.bunnyhat` | 10 Cloth | 5 | — |  |
| Burlap Gloves | `burlap.gloves.new` | 5 Cloth | 15 | — | да |
| Burlap Headwrap | `burlap.headwrap` | 10 Cloth | 15 | — | да |
| Burlap Shirt | `burlap.shirt` | 20 Cloth | 15 | — | да |
| Burlap Shoes | `burlap.shoes` | 10 Cloth | 15 | — | да |
| Burlap Trousers | `burlap.trousers` | 20 Cloth | 15 | — | да |
| Candle Hat | `hat.candle` | 15 Cloth, 5 Low Grade Fuel | 30 | — | да |
| Chicken Costume | `bunny.suit` | 25 Cloth, 200 Wood | 15 | — |  |
| Chicken Costume | `chicken.costume` | 25 Cloth, 200 Wood | 15 | — |  |
| Clatter Helmet | `clatter.helmet` | 20 Metal Fragments | 30 | — |  |
| Coffee Can Helmet | `coffeecan.helmet` | 15 Cloth, 60 Metal Fragments, 1 Sewing Kit | 30 | 2 |  |
| Dracula Cape | `draculacape` | 50 Cloth, 2 Sewing Kit | 30 | 1 |  |
| Dracula Mask | `draculamask` | 10 Cloth | 30 | — |  |
| Egg Suit | `attire.egg.suit` | 60 Cloth, 2 Sewing Kit | 15 | — |  |
| Frog Boots | `boots.frog` | 1 Tarp | 1 | — |  |
| Hazmat Suit | `hazmatsuit` | 4 Tarp, 2 Sewing Kit, 7 High Quality Metal | 20 | 2 |  |
| Headset | `silly.horse.mask` | 10 Cloth | 30 | — | да |
| Headset | `twitch.headset` | 10 Cloth | 30 | — | да |
| Heavy Plate Helmet | `heavy.plate.helmet` | 2 Sheet Metal, 8 High Quality Metal | 45 | 2 |  |
| Heavy Plate Jacket | `heavy.plate.jacket` | 2 Sheet Metal, 4 High Quality Metal | 45 | 2 |  |
| Heavy Plate Pants | `heavy.plate.pants` | 1 Sheet Metal, 4 High Quality Metal | 45 | 2 |  |
| Hide Boots | `attire.hide.boots` | 10 Leather | 30 | — | да |
| Hide Halterneck | `attire.hide.helterneck` | 10 Leather | 30 | — | да |
| Hide Pants | `attire.hide.pants` | 10 Leather | 30 | — | да |
| Hide Poncho | `attire.hide.poncho` | 15 Leather | 30 | — | да |
| Hide Skirt | `attire.hide.skirt` | 10 Leather | 30 | — | да |
| Hide Vest | `attire.hide.vest` | 10 Leather | 30 | — | да |
| High Quality Horse Shoes | `horse.shoes.advanced` | 4 High Quality Metal | 30 | 2 |  |
| Hoodie | `hoodie` | 40 Cloth, 1 Sewing Kit | 30 | 2 |  |
| Horse Costume | `horse.costume` | 25 Cloth, 200 Wood | 15 | — |  |
| Hot Air Balloon Armor | `hab.armor` | 200 Metal Fragments | 30 | 1 |  |
| Improvised Balaclava | `mask.balaclava` | 15 Cloth | 30 | — |  |
| Jacket | `jacket` | 50 Cloth, 2 Sewing Kit | 30 | 1 |  |
| Jumpsuit | `paintballoveralls.suit` | 60 Cloth, 2 Sewing Kit | 15 | — |  |
| Leather Gloves | `burlap.gloves` | 20 Leather | 30 | — | да |
| Longsleeve T-Shirt | `tshirt.long` | 30 Cloth | 30 | 1 |  |
| Metal Chest Plate | `metal.plate.torso` | 50 Leather, 18 High Quality Metal, 8 Sewing Kit | 45 | 3 |  |
| Metal Facemask | `metal.facemask` | 50 Leather, 15 High Quality Metal, 6 Sewing Kit | 45 | 3 |  |
| Metal Shield | `metal.shield` | 300 Metal Fragments, 10 Leather, 50 Cloth | 15 | 2 |  |
| Miners Hat | `hat.miner` | 15 Cloth, 10 Low Grade Fuel, 50 Metal Fragments | 30 | 1 |  |
| Movember Moustache | `movembermoustache` | 10 Cloth | 1 | — |  |
| Night Vision Goggles | `nightvisiongoggles` | 10 High Quality Metal, 2 Tech Trash | 30 | 2 |  |
| Ninja Suit | `attire.ninja.suit` | 60 Cloth, 2 Sewing Kit | 1 | — |  |
| Pants | `pants` | 40 Cloth, 1 Sewing Kit | 30 | 1 |  |
| Parachute | `parachute` | 2 Tarp, 2 Sewing Kit, 50 Cloth | 15 | 2 |  |
| Prisoner Hood | `prisonerhood` | 20 Cloth | 15 | — | да |
| Purple Sunglasses | `twitchsunglasses` | 30 Metal Fragments | 15 | — |  |
| Reinforced Wooden Shield | `reinforced.wooden.shield` | 1 Road Signs, 10 Cloth, 200 Wood | 15 | 1 |  |
| Riot Helmet | `riot.helmet` | 10 Cloth, 50 Metal Fragments | 30 | 1 |  |
| Road Sign Gloves | `roadsign.gloves` | 20 Leather, 1 Road Signs, 2 Sewing Kit | 30 | 2 |  |
| Road Sign Jacket | `roadsign.jacket` | 20 Leather, 2 Road Signs, 2 Sewing Kit | 30 | 2 |  |
| Road Sign Kilt | `roadsign.kilt` | 10 Leather, 1 Road Signs, 2 Sewing Kit | 30 | 2 |  |
| Roadsign Horse Armor | `horse.armor.roadsign` | 4 Road Signs, 2 Sewing Kit | 30 | 2 |  |
| Saddle bag | `horse.saddlebag` | 20 Leather | 30 | 1 | да |
| Santa Beard | `santabeard` | 10 Cloth | 1 | — |  |
| Shirt | `shirt.collared` | 25 Cloth | 30 | 1 |  |
| Shorts | `pants.shorts` | 30 Cloth | 30 | — |  |
| Small Backpack | `smallbackpack` | 5 Sewing Kit, 50 Cloth | 30 | 1 | да |
| Snow Jacket | `jacket.snow` | 60 Cloth, 1 Sewing Kit | 30 | 1 |  |
| Snowman Helmet | `attire.snowman.helmet` | 10 Cloth | 30 | — |  |
| Sunglasses | `sunglasses` | 30 Metal Fragments | 15 | — | да |
| Surgeon Scrubs | `halloween.surgeonsuit` | 60 Cloth, 2 Sewing Kit | 1 | — |  |
| T-Shirt | `tshirt` | 25 Cloth | 30 | 1 |  |
| Tank Top | `shirt.tanktop` | 20 Cloth | 15 | — |  |
| Wellipets Hat | `hat.wellipets` | 10 Cloth | 5 | — | да |
| Wolf Headdress | `hat.wolf` | 10 Cloth, 1 Wolf Skull | 30 | 1 | да |
| Wood Armor Gloves | `woodarmor.gloves` | 100 Wood, 15 Cloth | 30 | — | да |
| Wood Armor Helmet | `wood.armor.helmet` | 15 Cloth, 150 Wood | 20 | — | да |
| Wood Armor Pants | `wood.armor.pants` | 15 Cloth, 150 Wood | 20 | — | да |
| Wood Chestplate | `wood.armor.jacket` | 20 Cloth, 250 Wood | 30 | — | да |
| Wooden Horse Armor | `horse.armor.wood` | 2 Rope, 300 Wood | 30 | 1 | да |
| Wooden Shield | `wooden.shield` | 250 Wood, 20 Cloth | 15 | — | да |

## Инструменты

| Предмет | Код | Ингредиенты | Время, с | Верстак | Сразу |
|---|---|---|---|---|---|
| Binoculars | `tool.binoculars` | 40 Metal Fragments | 30 | — |  |
| Chainsaw | `chainsaw` | 5 High Quality Metal, 2 Gears, 6 Metal Blade | 30 | 2 |  |
| Compass | `compass` | 75 Metal Fragments | 30 | — | да |
| Flare | `flare` | 10 Gun Powder, 10 Metal Fragments | 1 | 1 |  |
| Flashlight | `flashlight.held` | 30 Metal Fragments | 30 | 1 | да |
| Garry's Mod Tool Gun | `toolgun` | 100 Wood, 20 Metal Fragments | 15 | — |  |
| Hammer | `hammer` | 100 Wood | 15 | — | да |
| Handcuffs | `handcuffs` | 70 Metal Fragments | 15 | 2 |  |
| Handmade Fishing Rod | `fishingrod.handmade` | 2 Rope, 200 Wood | 10 | — | да |
| Hatchet | `hatchet` | 100 Wood, 75 Metal Fragments | 30 | 1 |  |
| Instant Camera | `tool.instant_camera` | 1 Gears, 75 Metal Fragments | 30 | — | да |
| Metal Detector | `metal.detector` | 2 Rope, 200 Metal Fragments, 5 High Quality Metal | 30 | 1 |  |
| Pickaxe | `pickaxe` | 100 Wood, 125 Metal Fragments | 30 | 1 |  |
| RF Transmitter | `rf.detonator` | 100 Metal Fragments | 30 | 2 |  |
| Rock | `rock` | 10 Stones | 5 | — | да |
| Salvaged Axe | `axe.salvaged` | 1 Metal Pipe, 5 Metal Blade | 30 | 2 |  |
| Salvaged Hammer | `hammer.salvaged` | 1 Metal Pipe, 50 Metal Fragments | 30 | 1 |  |
| Salvaged Icepick | `icepick.salvaged` | 1 Metal Pipe, 5 Metal Blade | 30 | 2 |  |
| Satchel Charge | `explosive.satchel` | 4 Beancan Grenade, 1 Small Stash, 1 Rope | 5 | 1 |  |
| Smoke Grenade | `grenade.smoke` | 35 Gun Powder, 50 Metal Fragments | 10 | 2 |  |
| Spray Can | `spraycan` | 100 Metal Fragments | 15 | — | да |
| Stone Hatchet | `stonehatchet` | 200 Wood, 100 Stones | 15 | — | да |
| Stone Pickaxe | `stone.pickaxe` | 200 Wood, 100 Stones | 15 | — | да |
| Survey Charge | `surveycharge` | 30 Gun Powder, 5 Cloth, 10 Metal Fragments, 20 Low Grade Fuel | 15 | 2 |  |
| Timed Explosive Charge | `explosive.timed` | 20 Explosives, 5 Cloth, 2 Tech Trash | 30 | 3 |  |
| Torch | `torch` | 30 Wood, 1 Cloth, 1 Low Grade Fuel | 30 | — | да |
| Wallpaper Tool | `wallpaper.tool` | 10 Cloth | 5 | — | да |
| Water Bucket | `bucket.water` | 20 Metal Fragments | 30 | — |  |

## Медицина

| Предмет | Код | Ингредиенты | Время, с | Верстак | Сразу |
|---|---|---|---|---|---|
| Bandage | `bandage` | 4 Cloth | 5 | — | да |
| Bandage | `medical.honey.bandage` | 4 Cloth, 2 Jar of Honey | 5 | 1 |  |
| Large Medkit | `largemedkit` | 2 Medical Syringe, 10 Low Grade Fuel | 15 | 2 |  |
| Medical Syringe | `syringe.medical` | 15 Cloth, 10 Metal Fragments, 10 Low Grade Fuel | 10 | 2 |  |

## Еда

| Предмет | Код | Ингредиенты | Время, с | Верстак | Сразу |
|---|---|---|---|---|---|
| Pure Anti-Rad Tea | `radiationresisttea.pure.creamy` | 1 Pure Anti-Rad Tea, 3 Cream | 15 | 1 | да |
| Pure Anti-Rad Tea | `radiationresisttea.pure.milky` | 1 Pure Anti-Rad Tea, 3 Apple | 15 | 1 | да |
| Pure Cooling Tea | `purecoolingtea.creamy` | 1 Pure Cooling Tea, 3 Cream | 15 | 1 | да |
| Pure Cooling Tea | `purecoolingtea.milky` | 1 Pure Cooling Tea, 3 Apple | 15 | 1 | да |
| Pure Harvesting Tea | `pureharvestingtea.creamy` | 1 Pure Harvesting Tea, 3 Cream | 15 | 1 | да |
| Pure Harvesting Tea | `pureharvestingtea.milky` | 1 Pure Harvesting Tea, 3 Apple | 15 | 1 | да |
| Pure Healing Tea | `healingtea.pure.creamy` | 1 Pure Healing Tea, 3 Cream | 15 | 1 | да |
| Pure Healing Tea | `healingtea.pure.milky` | 1 Pure Healing Tea, 3 Apple | 15 | 1 | да |
| Pure Max Health Tea | `maxhealthtea.pure.creamy` | 1 Pure Max Health Tea, 3 Cream | 15 | 1 | да |
| Pure Max Health Tea | `maxhealthtea.pure.milky` | 1 Pure Max Health Tea, 3 Apple | 15 | 1 | да |
| Pure Ore Tea | `oretea.pure.creamy` | 1 Pure Ore Tea, 3 Cream | 15 | 1 | да |
| Pure Ore Tea | `oretea.pure.milky` | 1 Pure Ore Tea, 3 Apple | 15 | 1 | да |
| Pure Scrap Tea | `scraptea.pure.creamy` | 1 Pure Scrap Tea, 3 Cream | 15 | 1 | да |
| Pure Scrap Tea | `scraptea.pure.milky` | 1 Pure Scrap Tea, 3 Apple | 15 | 1 | да |
| Pure Warming Tea | `purewarmingtea.creamy` | 1 Pure Warming Tea, 3 Cream | 15 | 1 | да |
| Pure Warming Tea | `purewarmingtea.milky` | 1 Pure Warming Tea, 3 Apple | 15 | 1 | да |
| Pure Wood Tea | `woodtea.pure.creamy` | 1 Pure Wood Tea, 3 Cream | 15 | 1 | да |
| Pure Wood Tea | `woodtea.pure.milky` | 1 Pure Wood Tea, 3 Apple | 15 | 1 | да |

## Патроны

| Предмет | Код | Ингредиенты | Время, с | Верстак | Сразу |
|---|---|---|---|---|---|
| 12 Gauge Buckshot ×2 | `ammo.shotgun` | 5 Metal Fragments, 10 Gun Powder | 3 | 2 |  |
| 12 Gauge Incendiary Shell ×2 | `ammo.shotgun.fire` | 5 Metal Fragments, 10 Gun Powder, 20 Sulfur | 3 | 2 |  |
| 12 Gauge Slug ×2 | `ammo.shotgun.slug` | 5 Metal Fragments, 10 Gun Powder | 3 | 2 |  |
| 5.56 Rifle Ammo ×3 | `ammo.rifle` | 10 Metal Fragments, 5 Gun Powder | 3 | 2 |  |
| Bee Catapult Bomb | `catapult.ammo.bee` | 2 Bee Grenade, 200 Wood | 10 | 2 |  |
| Bone Arrow ×3 | `arrow.bone` | 25 Wood, 10 Bone Fragments | 3 | — | да |
| Cannon ×2 | `cannonball` | 50 Metal Fragments, 15 Gun Powder | 15 | 1 |  |
| Explosive 5.56 Rifle Ammo ×2 | `ammo.rifle.explosive` | 10 Metal Fragments, 20 Gun Powder, 10 Sulfur | 3 | 3 |  |
| Fire Arrow ×2 | `arrow.fire` | 20 Wood, 2 Cloth, 10 Low Grade Fuel | 3 | 1 |  |
| Firebomb | `catapult.ammo.incendiary` | 150 Gun Powder, 50 Low Grade Fuel, 2 Rope | 10 | 2 |  |
| HV 5.56 Rifle Ammo ×3 | `ammo.rifle.hv` | 10 Metal Fragments, 10 Gun Powder | 3 | 3 |  |
| HV Pistol Ammo ×4 | `ammo.pistol.hv` | 10 Metal Fragments, 10 Gun Powder | 3 | 2 |  |
| Hammerhead Bolt | `ballista.bolt.hammerhead` | 5 High Quality Metal, 75 Metal Fragments | 10 | 2 |  |
| Handmade Shell ×2 | `ammo.handmade.shell` | 5 Stones, 5 Gun Powder | 3 | — | да |
| High Velocity Arrow ×2 | `arrow.hv` | 20 Wood, 5 Metal Fragments | 3 | 1 | да |
| High Velocity Rocket | `ammo.rocket.hv` | 1 Metal Pipe, 100 Gun Powder | 10 | 2 |  |
| Homing Missile ×2 | `ammo.rocket.seeker` | 2 Metal Pipe, 100 Gun Powder, 1 Tech Trash | 10 | 2 |  |
| Incapacitate Dart ×2 | `dart.incapacitate` | 5 Wood, 1 Snake Venom | 3 | 1 |  |
| Incendiary 5.56 Rifle Ammo ×2 | `ammo.rifle.incendiary` | 10 Metal Fragments, 10 Gun Powder, 5 Sulfur | 3 | 3 |  |
| Incendiary Bolt | `ballista.bolt.incendiary` | 50 Metal Fragments, 10 Cloth, 10 Low Grade Fuel | 10 | 2 |  |
| Incendiary Pistol Bullet ×3 | `ammo.pistol.fire` | 10 Metal Fragments, 10 Gun Powder, 5 Sulfur | 3 | 2 |  |
| Incendiary Rocket | `ammo.rocket.fire` | 2 Metal Pipe, 150 Gun Powder, 75 Low Grade Fuel | 10 | 2 |  |
| Nailgun Nails ×5 | `ammo.nailgun.nails` | 8 Metal Fragments | 2 | — | да |
| Piercer Bolt | `ballista.bolt.piercer` | 5 High Quality Metal, 75 Metal Fragments | 10 | 2 |  |
| Pistol Bullet ×20 | `ammo.paintball` | 10 Cloth, 2 Yellow Berry | 3 | — | да |
| Pistol Bullet ×4 | `ammo.pistol` | 10 Metal Fragments, 5 Gun Powder | 3 | 1 |  |
| Pitchfork Bolt | `ballista.bolt.pitchfork` | 100 Wood, 50 Metal Fragments | 10 | 2 |  |
| Propane Explosive Bomb | `catapult.ammo.explosive` | 1 Empty Propane Tank, 450 Gun Powder, 20 Low Grade Fuel | 10 | 2 |  |
| Radiation Dart ×2 | `dart.radiation` | 25 Wood, 5 Metal Fragments | 3 | 1 |  |
| Rocket | `ammo.rocket.basic` | 2 Metal Pipe, 150 Gun Powder, 10 Explosives | 10 | 3 |  |
| Rocket ×2 | `ammo.mortar.basic` | 1 Metal Pipe, 300 Gun Powder | 10 | 2 |  |
| Rocket ×3 | `ammo.mortar.fragment` | 1 Metal Pipe, 150 Gun Powder | 10 | 2 |  |
| SAM Ammo ×6 | `ammo.rocket.sam` | 1 Metal Pipe, 30 Gun Powder | 10 | 2 |  |
| Scatter Dart ×2 | `dart.scatter` | 25 Wood, 10 Stones | 3 | 1 |  |
| Scattershot | `catapult.ammo.boulder` | 200 Stones | 10 | 2 |  |
| Speargun Spear ×3 | `speargun.spear` | 50 Metal Fragments | 3 | 1 |  |
| Torpedo ×5 | `submarine.torpedo.straight` | 1 Metal Pipe, 30 Gun Powder | 10 | 2 |  |
| Wood Dart ×2 | `dart.wood` | 25 Wood | 3 | 1 |  |
| Wooden Arrow ×2 | `arrow.wooden` | 25 Wood, 10 Stones | 3 | — | да |

## Ловушки

| Предмет | Код | Ингредиенты | Время, с | Верстак | Сразу |
|---|---|---|---|---|---|
| Flame Turret | `flameturret` | 200 Metal Fragments, 2 Empty Propane Tank, 1 Gears | 30 | 1 |  |
| Homemade Landmine | `trap.landmine` | 50 Metal Fragments, 30 Gun Powder | 20 | 2 |  |
| Shotgun Trap | `guntrap` | 500 Wood, 250 Metal Fragments, 2 Gears, 2 Rope | 30 | 1 |  |
| Snap Trap | `trap.bear` | 50 Metal Fragments, 1 Gears | 30 | 1 |  |
| Spike Trap | `spikes.trap` | 80 Wood | 15 | — | да |
| Tin Can Alarm | `tincan.alarm` | 100 Wood, 1 Rope, 30 Metal Fragments | 20 | 1 |  |
| Wooden Floor Spikes | `spikes.floor` | 150 Wood | 30 | — |  |

## Прочее

| Предмет | Код | Ингредиенты | Время, с | Верстак | Сразу |
|---|---|---|---|---|---|
| Cursed Cauldron | `cursedcauldron` | 100 Wood | 25 | — |  |
| Fogger-3000 | `fogmachine` | 100 Metal Fragments, 30 Low Grade Fuel, 1 Metal Pipe | 15 | — |  |
| Giant Candy Decor | `giantcandycanedecor` | 30 Cloth | 30 | — |  |
| Giant Lollipop Decor | `giantlollipops` | 20 Cloth | 30 | — |  |
| Large Candle Set | `largecandles` | 20 Animal Fat, 10 Cloth | 15 | — |  |
| Note | `note` | 10 Wood | 5 | — | да |
| Rustigé Egg - Blue | `rustige_egg_b` | 2 High Quality Metal | 30 | — |  |
| Rustigé Egg - Cerulean | `rustige_egg_g` | 2 High Quality Metal | 30 | — |  |
| Rustigé Egg - Cerulean | `rustige_egg_h` | 2 High Quality Metal | 30 | — |  |
| Rustigé Egg - Green | `rustige_egg_e` | 2 High Quality Metal | 30 | — |  |
| Rustigé Egg - Ivory | `rustige_egg_d` | 2 High Quality Metal | 30 | — |  |
| Rustigé Egg - Purple | `rustige_egg_c` | 2 High Quality Metal | 30 | — |  |
| Rustigé Egg - Red | `rustige_egg_a` | 2 High Quality Metal | 30 | — |  |
| Rustigé Egg - White | `rustige_egg_f` | 2 High Quality Metal | 30 | — |  |
| Small Candle Set | `smallcandles` | 10 Animal Fat, 5 Cloth | 15 | — |  |
| Snow Machine | `snowmachine` | 125 Metal Fragments, 30 Low Grade Fuel, 1 Metal Pipe | 30 | 1 |  |
| Spooky Speaker | `spookyspeaker` | 400 Wood, 100 Metal Fragments, 20 Cloth | 30 | — |  |
| Strobe Light | `strobelight` | 100 Metal Fragments, 2 High Quality Metal | 15 | — |  |

## Развлечения

| Предмет | Код | Ингредиенты | Время, с | Верстак | Сразу |
|---|---|---|---|---|---|
|  ×10 | `xmas.lightstring.advanced` | 50 Metal Fragments | 10 | — |  |
| AND Switch | `electric.andswitch` | 100 Metal Fragments | 30 | 2 |  |
| Audio Alarm | `electric.audioalarm` | 75 Metal Fragments | 30 | 1 |  |
| Auto Turret | `autoturret` | 1 Targeting Computer, 1 CCTV Camera, 25 High Quality Metal | 45 | 2 |  |
| Blocker | `electric.blocker` | 75 Metal Fragments | 30 | 1 |  |
| Bulb String Lights ×10 | `electric.bulbstringlights` | 50 Metal Fragments | 10 | — |  |
| Button | `electric.button` | 75 Metal Fragments | 30 | 1 |  |
| Ceiling Light | `ceilinglight` | 50 Metal Fragments | 30 | 1 |  |
| Chandelier | `electric.chandelier` | 100 Metal Fragments | 30 | 1 |  |
| Computer Station | `computerstation` | 5 High Quality Metal, 1 Targeting Computer, 1 RF Broadcaster, 1 RF Receiver | 30 | 2 |  |
| Counter | `electric.counter` | 75 Metal Fragments | 30 | 2 |  |
| Digital Clock | `electric.digitalclock` | 100 Metal Fragments | 30 | 2 |  |
| Door Controller | `electric.doorcontroller` | 75 Metal Fragments | 30 | 1 |  |
| Electric Furnace | `electric.furnace` | 5 High Quality Metal, 200 Metal Fragments | 30 | 2 |  |
| Electric Heater | `electric.heater` | 200 Metal Fragments | 30 | 1 |  |
| Electric Table Light | `electric.tablelight` | 50 Metal Fragments | 30 | 1 |  |
| Electrical Branch | `electrical.branch` | 75 Metal Fragments | 30 | 1 |  |
| Elevator | `elevator` | 3 High Quality Metal, 200 Metal Fragments, 1 Gears | 30 | 2 |  |
| Fairy Lights ×10 | `electric.fairylights` | 50 Metal Fragments | 10 | 1 |  |
| Flasher Light | `electric.flasherlight` | 120 Metal Fragments | 30 | 1 |  |
| Fluid Combiner | `fluid.combiner` | 75 Metal Fragments | 30 | 1 |  |
| Fluid Splitter | `fluid.splitter` | 75 Metal Fragments | 30 | 1 |  |
| Fluid Switch & Pump | `fluid.switch` | 150 Metal Fragments | 30 | 1 |  |
| Fluorescent Light | `electric.fluorescentlight` | 50 Metal Fragments | 30 | 1 |  |
| Fridge | `fridge` | 150 Metal Fragments | 30 | 1 |  |
| Fridge | `mini fridge` | 50 Metal Fragments | 15 | 1 |  |
| HBHF Sensor | `electric.hbhfsensor` | 75 Metal Fragments | 30 | 2 |  |
| Hopper | `hopper` | 200 Metal Fragments, 1 Gears | 30 | 1 |  |
| Hose Tool | `hosetool` | 2 High Quality Metal | 1 | 1 | да |
| Igniter | `electric.igniter` | 75 Metal Fragments | 30 | — |  |
| Industrial Combiner | `industrial.combiner` | 75 Metal Fragments | 30 | 1 |  |
| Industrial Conveyor | `industrial.conveyor` | 75 Metal Fragments | 30 | 1 |  |
| Industrial Crafter | `industrial.crafter` | 3 High Quality Metal, 2 Tech Trash | 30 | 2 |  |
| Industrial Splitter | `industrial.splitter` | 75 Metal Fragments | 30 | 1 |  |
| Industrial Wall Light | `industrial.wall.light` | 30 Metal Fragments | 30 | 1 |  |
| Large Animated Neon Sign | `sign.neon.xl.animated` | 350 Metal Fragments, 5 High Quality Metal | 15 | 2 |  |
| Large Neon Sign | `sign.neon.xl` | 250 Metal Fragments | 15 | 1 |  |
| Large Rechargeable Battery | `electric.battery.rechargable.large` | 10 High Quality Metal, 2 Tech Trash | 30 | 2 |  |
| Large Solar Panel | `electric.solarpanel.large` | 5 High Quality Metal, 1 Tech Trash | 30 | 1 |  |
| Laser Detector | `electric.laserdetector` | 75 Metal Fragments | 30 | 2 |  |
| Medium Animated Neon Sign | `sign.neon.125x215.animated` | 300 Metal Fragments, 2 High Quality Metal | 15 | 2 |  |
| Medium Neon Sign | `sign.neon.125x215` | 200 Metal Fragments | 15 | 1 |  |
| Medium Rechargeable Battery | `electric.battery.rechargable.medium` | 5 High Quality Metal, 1 Tech Trash | 30 | 2 |  |
| Memory Cell | `electrical.memorycell` | 75 Metal Fragments | 30 | 2 |  |
| Modular Car Lift | `modularcarlift` | 200 Metal Fragments, 5 High Quality Metal, 1 Gears | 30 | 2 |  |
| OR Switch | `electric.orswitch` | 100 Metal Fragments | 30 | 1 |  |
| PTZ CCTV Camera | `ptz.cctv.camera` | 1 CCTV Camera, 150 Metal Fragments | 1 | 2 |  |
| Pipe Tool | `pipetool` | 2 High Quality Metal | 1 | 1 | да |
| Powered Water Purifier | `powered.water.purifier` | 300 Metal Fragments, 20 Cloth, 100 Wood | 30 | 2 |  |
| Pressure Pad | `electric.pressurepad` | 150 Wood, 1 Metal Spring, 1 Gears | 30 | 1 |  |
| RAND Switch | `electric.random.switch` | 75 Metal Fragments | 30 | 2 |  |
| RF Broadcaster | `electric.rf.broadcaster` | 150 Metal Fragments | 30 | 2 |  |
| RF Pager | `rf_pager` | 100 Metal Fragments | 20 | 2 |  |
| RF Receiver | `electric.rf.receiver` | 150 Metal Fragments | 30 | 2 |  |
| Reactive Target | `target.reactive` | 100 Wood, 150 Metal Fragments, 1 Gears | 30 | 1 |  |
| Root Combiner | `electrical.combiner` | 75 Metal Fragments | 30 | 1 |  |
| Search Light | `searchlight` | 500 Wood, 200 Metal Fragments | 30 | 2 |  |
| Seismic Sensor | `electric.seismicsensor` | 3 High Quality Metal, 1 Tech Trash | 30 | 2 |  |
| Siren Light | `electric.sirenlight` | 120 Metal Fragments | 30 | 1 |  |
| Small Generator | `electric.fuelgenerator.small` | 5 High Quality Metal, 2 Gears | 30 | 2 |  |
| Small Neon Sign | `sign.neon.125x125` | 150 Metal Fragments | 15 | 1 |  |
| Small Rechargeable Battery | `electric.battery.rechargable.small` | 5 High Quality Metal | 30 | 1 |  |
| Smart Alarm | `smart.alarm` | 3 High Quality Metal, 1 Tech Trash | 30 | 2 |  |
| Smart Switch | `smart.switch` | 3 High Quality Metal, 1 Tech Trash | 30 | 2 |  |
| Splitter | `electric.splitter` | 100 Metal Fragments | 30 | 1 |  |
| Spot Light | `electric.spotlight.tripod` | 50 Metal Fragments | 30 | 1 |  |
| Spot Light | `electric.spotlight` | 50 Metal Fragments | 30 | 1 |  |
| Sprinkler | `electric.sprinkler` | 75 Metal Fragments | 30 | 1 |  |
| Storage Adaptor | `storageadaptor` | 100 Metal Fragments | 30 | 1 |  |
| Storage Monitor | `storage.monitor` | 3 High Quality Metal, 1 Tech Trash | 30 | 2 |  |
| Switch | `electric.switch` | 100 Metal Fragments | 30 | 1 |  |
| Tesla Coil | `electric.teslacoil` | 3 High Quality Metal, 1 Tech Trash | 30 | 2 |  |
| Timer | `electric.timer` | 75 Metal Fragments | 30 | 1 |  |
| Tuna Can Lamp | `neonsigntr` | 150 Metal Fragments | 20 | — |  |
| Water Pump | `waterpump` | 250 Wood, 200 Metal Fragments, 1 Gears | 30 | 2 |  |
| Wind Turbine | `generator.water` | 500 Wood, 2 Gears, 1 Sheet Metal | 30 | 1 |  |
| Wind Turbine | `generator.wind.scrap` | 500 Wood, 10 High Quality Metal, 3 Gears, 3 Sheet Metal | 30 | 2 |  |
| Wire Tool | `wiretool` | 2 High Quality Metal | 1 | 1 | да |
| XOR Switch | `electric.xorswitch` | 100 Metal Fragments | 30 | 1 |  |

## 17

| Предмет | Код | Ингредиенты | Время, с | Верстак | Сразу |
|---|---|---|---|---|---|
| Above Ground Pool | `abovegroundpool` | 200 Metal Fragments, 3 Tarp, 500 Wood | 60 | 1 | да |
| Acoustic Guitar | `fun.guitar` | 100 Wood, 10 Cloth | 20 | — |  |
| Beach Chair | `beachchair` | 50 Wood, 75 Metal Fragments | 30 | 1 | да |
| Beach Parasol | `beachparasol` | 20 Cloth, 75 Metal Fragments | 30 | — | да |
| Beach Table | `beachtable` | 100 Wood | 30 | — |  |
| Beach Towel | `beachtowel` | 30 Cloth | 30 | — | да |
| Blue Boomer | `firework.boomer.blue` | 25 Metal Fragments, 30 Gun Powder, 15 Low Grade Fuel | 10 | — |  |
| Blue Roman Candle | `firework.romancandle.blue` | 25 Metal Fragments, 10 Low Grade Fuel | 60 | — |  |
| Boogie Board | `boogieboard` | 75 Metal Fragments, 1 Tarp | 30 | 1 | да |
| Boom Box | `boombox` | 200 Wood, 100 Metal Fragments, 20 Cloth | 15 | 1 | да |
| Boom Box | `jukebox` | 200 Wood, 100 Metal Fragments, 20 Cloth | 15 | 1 | да |
| Canbourine | `fun.tambourine` | 25 Metal Fragments | 20 | — | да |
| Car Radio | `vehicle.car_radio` | 120 Metal Fragments | 15 | 1 | да |
| Cassette - Long | `cassette` | 100 Metal Fragments | 5 | — | да |
| Cassette - Medium ×3 | `cassette.medium` | 75 Metal Fragments | 5 | — | да |
| Cassette - Short ×5 | `cassette.short` | 50 Metal Fragments | 5 | — | да |
| Cassette Recorder | `fun.casetterecorder` | 75 Metal Fragments | 15 | 1 | да |
| Champagne Boomer | `firework.boomer.champagne` | 30 Metal Fragments, 75 Gun Powder, 30 Low Grade Fuel | 10 | — |  |
| Connected Speaker | `connected.speaker` | 75 Metal Fragments | 15 | 1 | да |
| Cowbell | `fun.cowbell` | 35 Metal Fragments | 20 | — | да |
| Disco Ball | `discoball` | 50 Metal Fragments | 15 | 1 | да |
| Disco Floor | `discofloor` | 75 Metal Fragments | 15 | 1 | да |
| Green Boomer | `firework.boomer.green` | 25 Metal Fragments, 30 Gun Powder, 15 Low Grade Fuel | 10 | — |  |
| Green Roman Candle | `firework.romancandle.green` | 25 Metal Fragments, 10 Low Grade Fuel | 60 | — |  |
| Inner Tube | `innertube` | 75 Metal Fragments, 1 Tarp | 30 | 1 | да |
| Jerry Can Guitar | `fun.jerrycanguitar` | 25 Wood, 50 Metal Fragments | 20 | — | да |
| Junkyard Drum Kit | `drumkit` | 200 Wood, 100 Metal Fragments | 30 | 1 | да |
| Laser Light | `laserlight` | 100 Metal Fragments | 15 | 1 | да |
| Megaphone | `megaphone` | 50 Wood, 75 Metal Fragments | 15 | 1 | да |
| Microphone Stand | `microphonestand` | 75 Metal Fragments | 15 | 1 | да |
| Mobile Phone | `mobilephone` | 125 Metal Fragments | 15 | 1 | да |
| New Year Gong | `newyeargong` | 100 Wood, 50 Metal Fragments | 15 | — |  |
| Orange Boomer | `firework.boomer.orange` | 25 Metal Fragments, 30 Gun Powder, 15 Low Grade Fuel | 10 | — |  |
| Paddling Pool | `paddlingpool` | 100 Cloth, 1 Tarp | 30 | — | да |
| Pan Flute | `fun.flute` | 20 Metal Fragments, 5 Cloth | 20 | — | да |
| Pattern Boomer | `firework.boomer.pattern` | 50 Metal Fragments, 30 Gun Powder, 15 Low Grade Fuel | 10 | — |  |
| Plumber's Trumpet | `fun.trumpet` | 75 Metal Fragments | 20 | — | да |
| Portable Boom Box | `fun.boomboxportable` | 120 Metal Fragments | 15 | 1 | да |
| Red Boomer | `firework.boomer.red` | 25 Metal Fragments, 30 Gun Powder, 15 Low Grade Fuel | 10 | — |  |
| Red Roman Candle | `firework.romancandle.red` | 25 Metal Fragments, 10 Low Grade Fuel | 60 | — |  |
| Red Volcano Firework | `firework.volcano.red` | 20 Metal Fragments, 15 Gun Powder | 10 | — |  |
| Shovel Bass | `fun.bass` | 50 Wood, 75 Metal Fragments | 20 | — | да |
| Skull Spikes | `skullspikes` | 150 Wood, 1 Human Skull | 15 | — |  |
| Skull Trophy | `skull.trophy` | 100 Wood, 25 Metal Fragments | 15 | — |  |
| Sky Lantern | `skylantern` | 10 Cloth, 5 Low Grade Fuel | 2 | — |  |
| Sound Light | `soundlight` | 100 Metal Fragments | 15 | 1 | да |
| Sousaphone | `fun.tuba` | 100 Metal Fragments | 20 | — | да |
| Table | `pooltable` | 200 Wood, 10 Cloth | 30 | — |  |
| Telephone | `telephone` | 50 Wood, 100 Metal Fragments, 1 Tech Trash | 30 | 1 |  |
| Violet Boomer | `firework.boomer.violet` | 25 Metal Fragments, 30 Gun Powder, 15 Low Grade Fuel | 10 | — |  |
| Violet Roman Candle | `firework.romancandle.violet` | 25 Metal Fragments, 10 Low Grade Fuel | 60 | — |  |
| Violet Volcano Firework | `firework.volcano.violet` | 20 Metal Fragments, 15 Gun Powder | 10 | — |  |
| Wheelbarrow Piano | `piano` | 200 Wood, 100 Metal Fragments | 30 | 1 | да |
| White Boomer | `firework.boomer.white` | 25 Metal Fragments, 30 Gun Powder, 15 Low Grade Fuel | 10 | — |  |
| White Volcano Firework | `firework.volcano` | 20 Metal Fragments, 15 Gun Powder | 10 | — |  |
| Wind Turbine | `dartboard` | 150 Wood | 30 | 1 |  |
| Xylobone | `xylophone` | 50 Bone Fragments | 30 | 1 | да |
