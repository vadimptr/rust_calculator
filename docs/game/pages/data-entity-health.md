---
id: data-entity-health
title: Таблица: HP дверей и деплоев
kind: data
group: Урон и рейд
summary: Здоровье и таблица защиты дверей, внешних стен, турелей, ящиков и прочих деплоев из префабов игры.
related: [door, external-wall, auto-turret, storage-boxes, tool-cupboard, data-protection]
code: [BaseCombatEntity.cs]
---

> Таблица собрана автоматически из ассетов сервера Rust от 2026-10-16 скриптом `tools/game-data/build_pages.py`. Не правьте её руками — перегенерируйте.

## Как читать

HP — поле `startHealth` префаба (`BaseCombatEntity`). Таблица защиты — `baseProtection`, её значения в [[data-protection]]. Показаны префабы из `assets/prefabs`, разбитые по назначению по имени префаба.

## Двери и люки

| Префаб | HP | Защита |
|---|---|---|
| `andswitch.entity` | 200 | `DeployableGeneric` |
| `animalfencegate.deployed` | 100 | `BlockWood` |
| `bunker_door_portal` | 99999 | `Immortal` |
| `chinese_door_decoration` | 500 | `BlockMetal` |
| `chinese_door_frame_decoration` | 500 | `BlockMetal` |
| `christmas_door_wreath_deployed` | 500 | `—` |
| `door.double.hinged.bardoors` | 200 | `WoodDoor` |
| `door.double.hinged.metal` | 250 | `MetalDoor` |
| `door.double.hinged.toptier` | 1000 | `MetalDoor` |
| `door.double.hinged.wood` | 200 | `WoodDoor` |
| `door.hinged.hab_t1` | 800 | `DeployableMetal` |
| `door.hinged.industrial.a` | 250 | `MetalDoor` |
| `door.hinged.industrial.d` | 250 | `MetalDoor` |
| `door.hinged.mboat.wood` | 200 | `WoodDoor` |
| `door.hinged.metal` | 250 | `MetalDoor` |
| `door.hinged.toptier` | 1000 | `MetalDoor` |
| `door.hinged.wood` | 200 | `WoodDoor` |
| `door_barricade_a_large` | 50 | `BarricadeWood` |
| `door_barricade_a` | 50 | `BarricadeWood` |
| `door_barricade_b` | 50 | `BarricadeWood` |
| `door_barricade_dbl_a_large` | 50 | `BarricadeWood` |
| `door_barricade_dbl_a` | 50 | `BarricadeWood` |
| `door_barricade_dbl_b_large` | 50 | `BarricadeWood` |
| `door_barricade_dbl_b` | 50 | `BarricadeWood` |
| `doorcontroller.deployed` | 200 | `DeployableMetal` |
| `doorgarland.deployed` | 100 | `BlockWood` |
| `doormanipulator.invisible` | 9999 | `Immortal` |
| `doormanipulator` | 9999 | `Immortal` |
| `double_doorgarland.deployed` | 100 | `BlockWood` |
| `dragondoorknocker.deployed` | 100 | `Immortal` |
| `easter_door_wreath_deployed` | 500 | `—` |
| `electrical.blocker.deployed` | 200 | `DeployableGeneric` |
| `electrical.branch.deployed` | 200 | `DeployableGeneric` |
| `electrical.combiner.deployed` | 200 | `DeployableGeneric` |
| `electrical.memorycell.deployed` | 200 | `DeployableGeneric` |
| `electrical.random.switch.deployed` | 200 | `DeployableGeneric` |
| `floor.ladder.hatch.toptier` | 1000 | `MetalDoor` |
| `floor.ladder.hatch` | 250 | `MetalDoor` |
| `floor.triangle.ladder.hatch.toptier` | 1000 | `MetalDoor` |
| `floor.triangle.ladder.hatch` | 250 | `MetalDoor` |
| `gates.external.high.adobe` | 500 | `BlockStone` |
| `gates.external.high.legacy` | 500 | `BlockWood` |
| `gates.external.high.stone` | 500 | `BlockStone` |
| `gates.external.high.wood` | 500 | `BlockWood` |
| `industrial.garage.door.deployable` | 600 | `MetalDoor` |
| `legacy.shelter.wood.door` | 500 | `WoodDoor` |
| `medieval.door.double.hinged.metal` | 250 | `MetalDoor` |
| `medieval.door.hinged.metal` | 250 | `MetalDoor` |
| `orswitch.entity` | 200 | `DeployableGeneric` |
| `rfbroadcaster` | 50 | `DeployableLighting` |
| `rfreceiver` | 50 | `DeployableLighting` |
| `skull_door_knocker.deployed` | 100 | `Immortal` |
| `skull_door_knocker` | 100 | `Immortal` |
| `wall.frame.cell.gate` | 300 | `MetalDoor` |
| `wall.frame.fence.gate` | 75 | `Fence` |
| `wall.frame.garagedoor` | 600 | `MetalDoor` |
| `wallpaper.doorway.construction` | 10 | `DeployableGeneric` |
| `xorswitch.entity` | 200 | `DeployableGeneric` |

## Стены, окна и баррикады

| Префаб | HP | Защита |
|---|---|---|
| `animalfence.deployed` | 100 | `BlockWood` |
| `barricade.concrete` | 500 | `BarricadeStone` |
| `barricade.cover.wood_double` | 80 | `PlayerBarricade` |
| `barricade.cover.wood` | 120 | `BlockWood` |
| `barricade.medieval` | 400 | `BarricadeWood` |
| `barricade.metal` | 600 | `BarricadeMetal` |
| `barricade.sandbags.half` | 150 | `BarricadeStone` |
| `barricade.sandbags.pillbox` | 300 | `BarricadeStone` |
| `barricade.sandbags.three.quarter` | 200 | `BarricadeStone` |
| `barricade.sandbags` | 250 | `BarricadeStone` |
| `barricade.stone` | 100 | `BarricadeStone` |
| `barricade.wood` | 250 | `BarricadeWood` |
| `barricade.woodwire` | 400 | `BarricadeWood` |
| `graveyardfence` | 100 | `BlockStone` |
| `shutter.metal.embrasure.a` | 500 | `DeployableMetal` |
| `shutter.metal.embrasure.b` | 500 | `DeployableMetal` |
| `shutter.wood.a` | 200 | `DeployableWood` |
| `wall.external.high.adobe` | 500 | `BlockStone` |
| `wall.external.high.ice` | 500 | `BlockStone` |
| `wall.external.high.legacy` | 500 | `BlockWood` |
| `wall.external.high.stone` | 500 | `BlockStone` |
| `wall.external.high.wood` | 500 | `BlockWood` |
| `wall.frame.cell` | 300 | `MetalDoor` |
| `wall.frame.fence` | 100 | `Fence` |
| `wall.frame.netting` | 100 | `BlockTwig` |
| `wall.frame.shopfront.metal` | 750 | `BlockMetal` |
| `wall.frame.shopfront` | 500 | `WoodDoor` |
| `wall.window.bars.metal` | 500 | `BlockMetal` |
| `wall.window.bars.toptier` | 500 | `BlockMetal` |
| `wall.window.bars.wood` | 250 | `BlockWood` |
| `wall.window.glass.reinforced` | 350 | `BlockMetal` |
| `wallpaper.window.construction` | 10 | `DeployableGeneric` |
| `window.paintable` | 350 | `BlockMetal` |
| `windowgarland.deployed` | 100 | `BlockWood` |

## Защита базы

| Префаб | HP | Защита |
|---|---|---|
| `autoturret_deployed` | 1000 | `turret_protection` |
| `beartrap` | 200 | `—` |
| `flameturret.deployed` | 300 | `flame_turret_protection` |
| `gamesroom.shotgun.trap.deployed` | 300 | `flame_turret_protection` |
| `guntrap.deployed` | 300 | `flame_turret_protection` |
| `industrial_autoturret_deployed` | 1000 | `turret_protection` |
| `internalmounteddouble50calturretseat` | 1 | `Immortal` |
| `internalmountedturretseat` | 1 | `Immortal` |
| `landmine` | 100 | `—` |
| `npcvendorturretmodified variant` | 1000 | `Immortal` |
| `npcvendorturretside` | 1000 | `Immortal` |
| `sam_site_turret_deployed` | 1000 | `SamSiteDeployed` |
| `sam_static` | 1000 | `SamStatic` |
| `skullspikes.candles.deployed` | 200 | `DeployableWood` |
| `skullspikes.deployed` | 200 | `DeployableWood` |
| `skullspikes.pumpkin.deployed` | 200 | `DeployableWood` |
| `spikes.floor` | 100 | `BarricadeWood` |
| `spikes.trap` | 30 | `BarricadeWood` |
| `standingmounted50calturretseat` | 1 | `Immortal` |
| `standingmountedturretseat` | 1 | `Immortal` |
| `survivalfishtrap.deployed` | 100 | `DeployableWood` |

## Хранение и производство

| Префаб | HP | Защита |
|---|---|---|
| `abyss_barrel_horizontal.corpse` | 300 | `DeployableCorpse` |
| `abyss_barrel_horizontal` | 300 | `DeployableWood` |
| `abyss_barrel_vertical.corpse` | 300 | `DeployableCorpse` |
| `abyss_barrel_vertical` | 300 | `DeployableWood` |
| `apartment.cupboard_brown_large` | 300 | `Immortal` |
| `apartment.cupboard_dark_small` | 300 | `Immortal` |
| `apartment.fridge` | 200 | `DeployableWood` |
| `apartment.kitchen_cupboard_large` | 300 | `Immortal` |
| `apartment.mailbox_slide_2` | 300 | `Immortal` |
| `apartment.mailbox_slide_3` | 300 | `Immortal` |
| `apartment.mailbox_slide_4` | 300 | `Immortal` |
| `apartment.mailbox_slide_5` | 300 | `Immortal` |
| `apartment.mailbox_slide_6` | 300 | `Immortal` |
| `apartment.mailbox_slide_7` | 300 | `Immortal` |
| `apartment.mailbox_slide_8` | 300 | `Immortal` |
| `apartment.mailbox_slide` | 300 | `Immortal` |
| `apartment_large_furnace` | 1500 | `DeployableWood` |
| `bamboo_barrel.corpse` | 300 | `DeployableCorpse` |
| `bamboo_barrel` | 300 | `DeployableWood` |
| `boombox.deployed.static` | 100 | `Immortal` |
| `boombox.deployed` | 100 | `DeployableGeneric` |
| `boombox.static` | 100 | `Immortal` |
| `box.wooden.large.corpse` | 150 | `DeployableCorpse` |
| `box.wooden.large` | 300 | `DeployableWood` |
| `component.box.ammo.large.corpse` | 300 | `DeployableCorpse` |
| `component.box.ammo.large` | 300 | `DeployableWood` |
| `component.box.armor.large.corpse` | 300 | `DeployableCorpse` |
| `component.box.armor.large` | 300 | `DeployableWood` |
| `component.box.charcoal.large.corpse` | 300 | `DeployableCorpse` |
| `component.box.charcoal.large` | 300 | `DeployableWood` |
| `component.box.clothing.large.corpse` | 300 | `DeployableCorpse` |
| `component.box.clothing.large` | 300 | `DeployableWood` |
| `component.box.comps.large.corpse` | 300 | `DeployableCorpse` |
| `component.box.comps.large` | 300 | `DeployableWood` |
| `component.box.explosives.large.corpse` | 300 | `DeployableCorpse` |
| `component.box.explosives.large` | 300 | `DeployableWood` |
| `component.box.food.large.corpse` | 300 | `DeployableCorpse` |
| `component.box.food.large` | 300 | `DeployableWood` |
| `component.box.guns.large.corpse` | 300 | `DeployableCorpse` |
| `component.box.guns.large` | 300 | `DeployableWood` |
| `component.box.meds.large.corpse` | 300 | `DeployableCorpse` |
| `component.box.meds.large` | 300 | `DeployableWood` |
| `component.box.metal.large.corpse` | 300 | `DeployableCorpse` |
| `component.box.metal.large` | 300 | `DeployableWood` |
| `component.box.ore.large.corpse` | 300 | `DeployableCorpse` |
| `component.box.ore.large` | 300 | `DeployableWood` |
| `component.box.scrap.large.corpse` | 300 | `DeployableCorpse` |
| `component.box.scrap.large` | 300 | `DeployableWood` |
| `component.box.stone.large.corpse` | 300 | `DeployableCorpse` |
| `component.box.stone.large` | 300 | `DeployableWood` |
| `component.box.sulfur.large.corpse` | 300 | `DeployableCorpse` |
| `component.box.sulfur.large` | 300 | `DeployableWood` |
| `component.box.tools.large.corpse` | 300 | `DeployableCorpse` |
| `component.box.tools.large` | 300 | `DeployableWood` |
| `component.box.wood.large.corpse` | 300 | `DeployableCorpse` |
| `component.box.wood.large` | 300 | `DeployableWood` |
| `composter` | 500 | `DeployableGeneric` |
| `cookingworkbench.bbq` | 200 | `Immortal` |
| `cookingworkbench.deployed` | 500 | `DeployableGeneric` |
| `cupboard.tool.corpse` | 150 | `DeployableCorpse` |
| `cupboard.tool.deployed` | 100 | `WoodDoor` |
| `cupboard.tool.retro.deployed.corpse` | 100 | `DeployableCorpse` |
| `cupboard.tool.retro.deployed` | 100 | `WoodDoor` |
| `cupboard.tool.shockbyte.deployed.corpse` | 100 | `DeployableCorpse` |
| `cupboard.tool.shockbyte.deployed` | 100 | `WoodDoor` |
| `deepseatreasuremission_box` | 300 | `Immortal` |
| `dropbox.deployed` | 100 | `DeployableMetal` |
| `dynamicmissionstash` | 250 | `Immortal` |
| `electricfurnace.deployed.corpse` | 500 | `DeployableCorpse` |
| `electricfurnace.deployed_workshop` | 500 | `DeployableGeneric` |
| `electricfurnace.deployed` | 500 | `DeployableGeneric` |
| `electricfurnace.io` | 100 | `Immortal` |
| `fridge.deployed.corpse` | 200 | `DeployableCorpse` |
| `fridge.deployed` | 200 | `DeployableWood` |
| `fridge_respawnableloot.static.entity` | 9999 | `Immortal` |
| `furnace.corpse` | 150 | `DeployableCorpse` |
| `furnace.large` | 1500 | `DeployableWood` |
| `furnace` | 500 | `DeployableGeneric` |
| `fusebox` | 99999 | `Immortal` |
| `gamesroom.minifridge.deployed.corpse` | 100 | `DeployableCorpse` |
| `gamesroom.minifridge.deployed` | 100 | `DeployableWood` |
| `gearbox` | 999 | `Immortal` |
| `giftbox_loot` | 30 | `GenericLootContainer` |
| `industrial.furnace.large` | 1500 | `DeployableWood` |
| `industrial_electric_furnace.deployed.corpse` | 500 | `DeployableCorpse` |
| `industrial_electric_furnace.deployed` | 500 | `DeployableGeneric` |
| `industrial_electric_furnace.io` | 100 | `Immortal` |
| `io.table.deployed` | 500 | `DeployableWood` |
| `jukebox.deployed` | 100 | `DeployableGeneric` |
| `krieg_storage_horizontal.corpse` | 300 | `DeployableCorpse` |
| `krieg_storage_horizontal` | 300 | `DeployableWood` |
| `krieg_storage_vertical.corpse` | 300 | `DeployableCorpse` |
| `krieg_storage_vertical` | 300 | `DeployableWood` |
| `legacy_furnace.corpse` | 500 | `DeployableCorpse` |
| `legacy_furnace` | 500 | `DeployableGeneric` |
| `locker.campermodule` | 500 | `Immortal` |
| `locker.deployed.corpse` | 500 | `DeployableCorpse` |
| `locker.deployed` | 500 | `DeployableWood` |
| `locker_single` | 500 | `Immortal` |
| `logstash` | 250 | `Immortal` |
| `mailbox.deployed` | 300 | `turret_protection` |
| `medieval.box.wooden.large.corpse` | 300 | `DeployableCorpse` |
| `medieval.box.wooden.large` | 300 | `DeployableWood` |
| `minifridge.deployed.corpse` | 100 | `DeployableCorpse` |
| `minifridge.deployed` | 100 | `DeployableWood` |
| `missionlootbox_basic` | 250 | `Immortal` |
| `missionstash` | 250 | `Immortal` |
| `mixingtable.deployed` | 500 | `DeployableGeneric` |
| `pilot_hazmat_woodbox_deployed.corpse` | 150 | `DeployableCorpse` |
| `pilot_hazmat_woodbox_deployed` | 150 | `DeployableWood` |
| `refinery_small_deployed` | 1500 | `DeployableGenericDense` |
| `repairbench_deployed` | 200 | `DeployableWood` |
| `researchtable_deployed` | 200 | `DeployableWood` |
| `simplelootbox` | 250 | `Immortal` |
| `small_stash_deployed` | 150 | `DeployableWood` |
| `storageadaptor_retro_tc.deployed` | 30 | `DeployableGeneric` |
| `tacklebox` | 250 | `Immortal` |
| `wicker_barrel.corpse` | 300 | `DeployableCorpse` |
| `wicker_barrel` | 300 | `DeployableWood` |
| `woodbox_deployed.corpse` | 150 | `DeployableCorpse` |
| `woodbox_deployed` | 150 | `DeployableWood` |
| `workbench1.deployed.corpse` | 500 | `DeployableCorpse` |
| `workbench1.deployed` | 500 | `DeployableWood` |
| `workbench2.deployed.corpse` | 500 | `DeployableCorpse` |
| `workbench2.deployed` | 500 | `DeployableMetal` |
| `workbench3.deployed.corpse` | 150 | `DeployableCorpse` |
| `workbench3.deployed` | 750 | `DeployableMetal` |
| `xmastunnellootbox` | 250 | `Immortal` |

## Электричество

| Префаб | HP | Защита |
|---|---|---|
| `alarmsound` | 999 | `Immortal` |
| `andswitch` | 99999 | `Immortal` |
| `biofuel_generator.deployed` | 500 | `DeployableGeneric` |
| `cardreader` | 10000 | `Immortal` |
| `electric.bulbstringlights.deployed` | 100 | `DeployableLighting` |
| `electric.chandelier.deployed` | 300 | `DeployableLighting` |
| `electric.digitalclock.deployed` | 100 | `DeployableGeneric` |
| `electric.fairylights.deployed` | 100 | `DeployableLighting` |
| `electric.flasherlight.deployed` | 200 | `DeployableMetal` |
| `electric.fluorescentlight.ceiling.deployed` | 300 | `turret_protection` |
| `electric.fluorescentlight.deployed` | 200 | `DeployableLighting` |
| `electric.seismicsensor.deployed` | 200 | `DeployableGeneric` |
| `electric.sirenlight.deployed` | 75 | `DeployableMetal` |
| `electric.spotlight.deployed` | 100 | `DeployableLighting` |
| `electric.spotlight.tripod.deployed` | 100 | `DeployableLighting` |
| `electric.sprinkler.deployed` | 200 | `DeployableGeneric` |
| `electric.tablelamp.deployed` | 100 | `DeployableLighting` |
| `electric.wallcabinet.corpse` | 300 | `DeployableCorpse` |
| `electric.wallcabinet.deployed` | 300 | `DeployableWood` |
| `electric.waterwheel` | 400 | `DeployableWaterwheel` |
| `electric.windmill.small` | 250 | `DeployableWindmill` |
| `electrical.heater` | 200 | `DeployableLighting` |
| `electrical.modularcarlift.deployed` | 250 | `DeployableMetal` |
| `fluidsplitter` | 200 | `DeployableGeneric` |
| `fluidswitch` | 200 | `DeployableGeneric` |
| `generator.noreset.static` | 9999 | `Immortal` |
| `generator.small` | 1000 | `DeployableGeneric` |
| `generator.static_hidden` | 9999 | `Immortal` |
| `generator.static` | 9999 | `Immortal` |
| `generator.wind.scrap` | 1000 | `BlockMetal` |
| `industrialsplitter.deployed` | 200 | `DeployableGeneric` |
| `large.rechargable.battery.deployed` | 100 | `DeployableMetal` |
| `medium.rechargable.battery.deployed` | 100 | `DeployableMetal` |
| `orswitch` | 999999 | `Immortal` |
| `powergrid_accesspoint.static` | 9999 | `Immortal` |
| `powergrid_powerline_io.static` | 9999 | `Immortal` |
| `pressbutton_compact` | 9999 | `Immortal` |
| `pressbutton_invisible` | 9999 | `Immortal` |
| `pressbutton_officeelevatorcall` | 9999 | `Immortal` |
| `pressbutton_officeelevatordown` | 9999 | `Immortal` |
| `pressbutton_officeelevatorup` | 9999 | `Immortal` |
| `pressbutton_trainstairwell` | 9999 | `Immortal` |
| `pressbutton` | 9999 | `Immortal` |
| `rfbroadcaster.static` | 5000000 | `Immortal` |
| `simplelight` | 9999 | `Immortal` |
| `simpleswitch_lightswitch` | 99999 | `Immortal` |
| `simpleswitch` | 99999 | `Immortal` |
| `sirenlightblue` | 15555 | `Immortal` |
| `sirenlightgreen` | 15555 | `Immortal` |
| `sirenlightorange` | 15555 | `Immortal` |
| `small_fuel_generator.deployed` | 100 | `DeployableMetal` |
| `small_fuel_generator.static` | 100 | `Immortal` |
| `smallrechargablebattery.deployed` | 100 | `DeployableMetal` |
| `smartswitch` | 200 | `DeployableGeneric` |
| `solarpanel.large.deployed` | 100 | `DeployableMetal` |
| `splitter` | 10000 | `Immortal` |
| `splitter` | 500 | `DeployableGeneric` |
| `switch` | 200 | `DeployableGeneric` |
| `timerswitch` | 99999 | `Immortal` |
| `wheelswitch_wheel_only` | 9999 | `Immortal` |
| `wheelswitch` | 9999 | `Immortal` |
| `xorswitch` | 999999 | `Immortal` |
