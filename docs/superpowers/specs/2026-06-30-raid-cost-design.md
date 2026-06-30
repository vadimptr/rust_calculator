# Дизайн: блок «Стоимость рейда»

Дата: 2026-06-30

## Цель

Добавить в Rust-калькулятор новую секцию «Стоимость рейда»: на основе уже
выбранных пользователем строительных блоков и их количества посчитать, сколько
взрывчатки и ресурсов нужно, чтобы прорейдить эту конструкцию. Не ломать
существующий расчёт постройки и содержания.

## Ключевое архитектурное решение

В текущем калькуляторе у блока **нет выбранного тира** — каждый блок хранит
стоимость сразу по всем пяти материалам (солома/дерево/камень/металл/МВК).
Расчёт рейда требует ровно один тир на блок.

Решение: **глобальный селектор тира** над таблицей рейда (`Дерево / Камень /
Металл / МВК`). Вся выбранная конструкция считается построенной из выбранного
тира. По правилу пользователя стоимость рейда зависит **только от тира** —
Foundation, Wall, Roof и т.д. одного тира рейдятся одинаково (как стена этого
тира). Поэтому raid-правила ключуются по тиру, а не по `blockId`.

Дефолтный тир: `stone`.

## Файлы

### Новые

- `src/data/raidData.ts` — только данные:
  - `EXPLOSIVE_COSTS: Record<ExplosiveType, ExplosiveCost>` — craft-косты.
  - `RAID_RULES: Record<Tier, RaidCostRule>` — 4 правила по тирам.
  - `TIER_LABELS: Record<Tier, string>`, `TIER_ORDER`, `DEFAULT_TIER`.
  - `RAID_METHOD_LABELS`, `RAID_METHOD_ORDER`.
- `src/logic/raidCalculator.ts` — чистые функции (без React/UI):
  - `calculateRaidCost(selections: RaidSelection[]): RaidRow[]`.
  - вспомогательные: агрегирование кол-ва по тирам, расчёт ресурсов метода.
- `src/logic/raidCalculator.test.ts` — тесты в стиле Vitest (5 кейсов).
  Готовы к запуску, но не запускаются (раннер не ставим).
- `src/components/RaidTable.tsx` — отображение `RaidRow[]`, селектор тира,
  пустое состояние. Никаких расчётов в UI.

### Изменяемые

- `src/types/index.ts` — добавить raid-типы (см. ниже) рядом с существующими.
- `src/App.tsx` — состояние `tier`, `useMemo` для расчёта, рендер `RaidTable`
  под `BlockTable`, сброс тира в `resetAll`.
- `src/App.css` — стили таблицы рейда и селектора в текущем визуальном стиле.

## Модель данных (types/index.ts)

```ts
export type Tier = 'wood' | 'stone' | 'metal' | 'armored';
export type ExplosiveType = 'satchel' | 'rocket' | 'c4' | 'explosiveAmmo';
export type RaidMethod = ExplosiveType | 'optimal';

export interface ExplosiveCost {
  sulfur: number;
  charcoal?: number;
  metalFragments?: number;
  lowGradeFuel?: number;
  cloth?: number;
  rope?: number;
  pipes?: number;
  techTrash?: number;
  explosives?: number;
}

export interface RaidCostRule {
  blockId: string;   // = id тира ('wood' | 'stone' | 'metal' | 'armored')
  blockName: string; // отображаемое имя тира
  satchel?: number;
  rocket?: number;
  c4?: number;
  explosiveAmmo?: number;
  optimal?: Partial<Record<ExplosiveType, number>>;
}

export interface RaidSelection {
  tier: Tier;
  quantity: number;
}

export interface RaidRow {
  method: RaidMethod;
  label: string;
  supported: boolean;
  breakdown: { explosive: ExplosiveType; count: number }[];
  resources: ExplosiveCost; // суммарные ресурсы строки
}
```

## Craft-косты (raidData.ts)

| Взрывчатка | sulfur | charcoal | metalFragments | прочее |
|---|---|---|---|---|
| Rocket | 1400 | 1950 | 100 | lowGradeFuel 30, pipes 2 |
| Satchel Charge | 480 | 720 | 80 | cloth 10, rope 1 |
| C4 (Timed Explosive) | 2200 | 3000 | 200 | cloth 5, techTrash 2 |
| Explosive 5.56 (за 1 патрон) | 25 | 30 | 10 | — |

## Raid-правила по тирам (raidData.ts)

| Тир | satchel | rocket | c4 | explosiveAmmo | optimal |
|---|---|---|---|---|---|
| wood | 3 | 2 | 1 | 49 | explosiveAmmo 49 |
| stone | 10 | 4 | 2 | 185 | c4 2 |
| metal | 23 | 8 | 4 | 400 | c4 4 |
| armored | 46 | 15 | 8 | 799 | c4 8 |

`optimal` подобран под минимум серы и берётся **из конфига** (не вычисляется в
UI). Структура поддерживает смешанные варианты, напр. `{ c4: 2, explosiveAmmo:
49 }`.

## Логика (raidCalculator.ts)

`calculateRaidCost(selections)`:
1. Агрегировать `quantity` по тирам (`Map<Tier, number>`).
2. Если сумма = 0 → вернуть пустой массив (пустое состояние в UI).
3. Для каждого метода из `RAID_METHOD_ORDER`:
   - для простых методов (satchel/rocket/c4/explosiveAmmo): кол-во =
     `Σ rule[tier][method] × qty[tier]`; если хоть для одного выбранного тира
     метод не задан → `supported = false`.
   - для `optimal`: breakdown = сумма по `rule.optimal` каждого тира × qty.
   - ресурсы строки = `Σ count(explosive) × EXPLOSIVE_COSTS[explosive]` по всем
     полям `ExplosiveCost`.
4. Вернуть `RaidRow[]`.

Сигнатура принимает массив `RaidSelection`, поэтому смешанные тиры
поддерживаются на будущее; сейчас App передаёт все блоки с одним глобальным
тиром.

## Таблица (RaidTable.tsx)

Строки (`RAID_METHOD_ORDER`): Только сачели · Только ракеты · Только C4 ·
Только explosive ammo · **Оптимальный рейд** (выделенная строка).

Колонки: Чем рейдим · Кол-во взрывчатки · Сера · Порох/уголь (charcoal) ·
Металл · Ткань · Трубы · Верёвка · Tech Trash · Прочие (lowGradeFuel +
explosives).

- Кол-во взрывчатки: для простых методов — число + иконка; для optimal —
  breakdown (напр. «C4 ×16»).
- Нет выбранных блоков → пустое состояние «Добавьте блоки для расчёта рейда»
  (как в Summary).
- Если метод не поддержан для тира → прочерк в строке.

Селектор тира — сегментированный переключатель в шапке секции, стиль из текущей
тёмной темы (`--accent`, `--card-bg`, `--card-border`).

## Reset

`resetAll` в `App.tsx` дополнительно сбрасывает `tier` в `DEFAULT_TIER`.

## Тесты (raidCalculator.test.ts, Vitest-стиль)

1. **1 stone wall**: satchel 10 (sulfur 4800…), c4 2, optimal = c4 2.
2. **8 stone walls**: всё ×8 (satchel 80, c4 16…).
3. **1 sheet metal wall**: metal-тир (satchel 23, c4 4…).
4. **mixed blocks**: несколько блоков одного тира → сумма количеств.
5. **optimal route**: проверка breakdown и ресурсов optimal-строки.

## Что НЕ трогаем

`Resources`, `BuildingBlock`, расчёт build/upkeep, `BlockTable`, `Summary`,
`Presets` — без изменений (кроме добавления секции и состояния тира в App).
```
