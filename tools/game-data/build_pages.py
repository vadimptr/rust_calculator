"""Builds docs/game/pages/data-*.md tables from dumps of Rust server asset bundles.

Inputs (made by dump.py / dump_scene.py, see README.md):
  items.jsonl    - Bundles/shared/items.preload.bundle
  content.jsonl  - Bundles/shared/content.bundle (+ content.jsonl.names.json)
  prefabs.jsonl  - AssetScene-prefabs from Bundles/shared/assetscenes.bundle
Usage: python build_pages.py <dump_dir> <pages_dir>
"""
import json, math, os, sys
from collections import defaultdict

DUMP, OUT = sys.argv[1], sys.argv[2]
DATE = '2026-10-16'

def load(name):
    with open(os.path.join(DUMP, name)) as f:
        return [json.loads(l) for l in f]

items, content, prefabs = load('items.jsonl'), load('content.jsonl'), load('prefabs.jsonl')
so_names = json.load(open(os.path.join(DUMP, 'content.jsonl.names.json')))
so_names = {int(k): v for k, v in so_names.items()}

DMG = ['Generic', 'Hunger', 'Thirst', 'Cold', 'Drowned', 'Heat', 'Bleeding', 'Poison', 'Suicide', 'Bullet', 'Slash',
       'Blunt', 'Fall', 'Radiation', 'Bite', 'Stab', 'Explosion', 'RadiationExposure', 'ColdExposure', 'Decay',
       'ElectricShock', 'Arrow', 'AntiVehicle', 'Collision', 'Fun_Water', 'BeeSting', 'Paintball', 'Cannon']
DMG_RU = {'Generic': 'Общий', 'Hunger': 'Голод', 'Thirst': 'Жажда', 'Cold': 'Холод', 'Drowned': 'Утопление',
          'Heat': 'Жар', 'Bleeding': 'Кровотечение', 'Poison': 'Яд', 'Suicide': 'Суицид', 'Bullet': 'Пуля',
          'Slash': 'Рубящий', 'Blunt': 'Дробящий', 'Fall': 'Падение', 'Radiation': 'Радиация', 'Bite': 'Укус',
          'Stab': 'Колющий', 'Explosion': 'Взрыв', 'RadiationExposure': 'Облучение', 'ColdExposure': 'Переохлаждение',
          'Decay': 'Распад', 'ElectricShock': 'Электричество', 'Arrow': 'Стрела', 'AntiVehicle': 'Противотех.',
          'Collision': 'Столкновение', 'Fun_Water': 'Водный', 'BeeSting': 'Пчёлы', 'Paintball': 'Пейнтбол',
          'Cannon': 'Пушка'}
GRADES = ['Солома', 'Дерево', 'Камень', 'Металл', 'Броня']
STD_GRADES = {0: 'twigs', 1: 'wood', 2: 'stone', 3: 'metal', 4: 'toptier'}

def fmt(x):
    if x is None: return '—'
    if isinstance(x, float):
        if abs(x - round(x)) < 1e-6: return str(int(round(x)))
        return f'{x:.3g}' if abs(x) < 10 else f'{x:.1f}'
    return str(x)

def pct(x):
    return '—' if not x else f'{round(x * 100)}%'

def table(head, rows):
    out = ['| ' + ' | '.join(head) + ' |', '|' + '|'.join('---' for _ in head) + '|']
    out += ['| ' + ' | '.join(str(c).replace('|', '\\|') for c in r) + ' |' for r in rows]
    return '\n'.join(out)

ICONS = {
    'data-building-blocks': 'build/foundation',
    'data-protection': 'ui/security',
    'data-explosives': 'explosive.timed',
    'data-entity-health': 'ui/health',
    'data-crafting': 'ui/blueprint',
    'data-smelting': 'furnace',
}

def page(pid, title, group, summary, related, code, body):
    fm = (f'---\nid: {pid}\ntitle: {title}\nkind: data\ngroup: {group}\nicon: {ICONS[pid]}\nsummary: {summary}\n'
          f'related: [{", ".join(related)}]\ncode: [{", ".join(code)}]\n---\n\n')
    with open(os.path.join(OUT, pid + '.md'), 'w') as f:
        f.write(fm + body.strip() + '\n')

# ---------- items ----------
itemdef = {}       # pid -> record
item_by_go = {}
for r in items:
    if r['cls'] == 'ItemDefinition':
        itemdef[r['pid']] = r['f']
        item_by_go[(r.get('prefab'), r.get('go'))] = r['f']

def iname(pptr_or_pid):
    pid = pptr_or_pid['m_PathID'] if isinstance(pptr_or_pid, dict) else pptr_or_pid
    d = itemdef.get(pid)
    return d['displayName']['legacyEnglish'] if d else '?'

def ishort(pid):
    d = itemdef.get(pid)
    return d['shortname'] if d else '?'

def costs(lst, mult=1.0):
    return ', '.join(f'{fmt(math.ceil(a["amount"] * mult - 1e-9))} {iname(a["itemDef"])}' for a in lst) or '—'

# ---------- protection ----------
prot = {r['pid']: r for r in content if r['cls'] == 'ProtectionProperties'}

def prot_name(pptr):
    if not pptr: return '—'
    p = prot.get(pptr['m_PathID'])
    return p['name'] if p else so_names.get(pptr['m_PathID'], '—')

# =============== data-building-blocks ===============
grades = {}
for r in content:
    if r['cls'] == 'BuildingGrade' and r['name'] in STD_GRADES.values():
        grades[r['name']] = r['f']
order = [STD_GRADES[i] for i in range(5)]
rows = []
for i, g in enumerate(order):
    f = grades[g]
    rows.append([GRADES[i], fmt(f['baseHealth']), costs(f['baseCost']), prot_name(f['damageProtecton'])])
grade_table = table(['Грейд', 'Базовое HP', 'Базовая стоимость', 'Таблица защиты'], rows)

BLOCK_RU = {
    'foundation': 'Фундамент', 'foundation.triangle': 'Треугольный фундамент', 'foundation.steps': 'Ступени фундамента',
    'wall': 'Стена', 'wall.half': 'Полустена', 'wall.low': 'Низкая стена', 'wall.doorway': 'Дверной проём',
    'wall.window': 'Оконный проём', 'wall.frame': 'Стеновая рама', 'floor': 'Пол', 'floor.triangle': 'Треугольный пол',
    'floor.frame': 'Рама пола', 'floor.triangle.frame': 'Треугольная рама пола', 'roof': 'Крыша',
    'roof.triangle': 'Треугольная крыша', 'block.stair.lshape': 'Лестница L', 'block.stair.ushape': 'Лестница U',
    'block.stair.spiral': 'Винтовая лестница', 'block.stair.spiral.triangle': 'Треугольная винтовая лестница',
    'ramp': 'Пандус', 'wall.half.triangle': 'Треугольная полустена',
}
blocks = {}
for r in content + prefabs:
    if r['cls'] != 'Construction' or r.get('sub'): continue
    key = os.path.basename(r.get('root') or '').replace('.prefab', '')
    if key in BLOCK_RU and key not in blocks:
        blocks[key] = r['f']
brows = []
for key in BLOCK_RU:
    if key not in blocks: continue
    f = blocks[key]
    hp = ' / '.join(fmt(grades[g]['baseHealth'] * f['healthMultiplier']) for g in order)
    cost = ' / '.join(fmt(math.ceil(grades[g]['baseCost'][0]['amount'] * f['costMultiplier'] - 1e-9)) for g in order)
    brows.append([BLOCK_RU[key], f'`{key}`', fmt(f['healthMultiplier']), fmt(f['costMultiplier']), hp, cost])
res_note = ' / '.join(f'{GRADES[i]} — {iname(grades[g]["baseCost"][0]["itemDef"])}' for i, g in enumerate(order))
page('data-building-blocks', 'Таблица: HP и стоимость блоков', 'Строительство',
     'HP и стоимость каждого блока постройки по грейдам.',
     ['building-grades', 'foundation', 'wall', 'floor', 'roof', 'stairs', 'data-protection', 'upkeep'],
     ['BuildingGrade.cs', 'ConstructionGrade.cs', 'Construction.cs'], f"""
## Как считается

У каждого грейда есть базовое HP и базовая стоимость (`BuildingGrade`). У каждого блока —
множители `healthMultiplier` и `costMultiplier` (компонент `Construction` на префабе).

- HP блока = базовое HP грейда × `healthMultiplier` (`ConstructionGrade.maxHealth`).
- Стоимость = ⌈базовая стоимость × `costMultiplier` × множитель ConVar⌉ (`ConstructionGrade.UpdateCosts`).
  Множитель ConVar — `decay.upgrade_*_cost_multiplier`, по умолчанию 1.
- Смена скина внутри того же грейда стоит 20% (`num = 0.2`, когда грейд не меняется).

## Грейды

{grade_table}

## Блоки

Значения через косую черту: солома / дерево / камень / металл / броня.
Ресурс стоимости: {res_note}.

{table(['Блок', 'Префаб', 'Множ. HP', 'Множ. цены', 'HP', 'Стоимость'], brows)}

## Нюансы

- Металл и броня используют одну и ту же таблицу защиты `BlockMetal`. Броня отличается от металла
  только вдвое большим HP, проценты гашения урона у них одинаковые, см. [[data-protection]].
- Треугольные блоки и ступени стоят половину, но HP у них то же, что у квадратных: множитель HP 1.
- Тематические скины грейдов (кирпич, бруталист, контейнер и т.д.) используют те же HP, стоимость
  и защиту, что и базовый грейд.
""")

# =============== data-protection ===============
def prot_amounts(n):
    p = next((x for x in prot.values() if x['name'] == n), None)
    return p['f']['amounts'] if p else None

def prot_transposed(names, labels=None):
    """Damage types as rows, protection assets as columns (at most 5 per table)."""
    names = [n for n in names if prot_amounts(n)]
    out = []
    for i in range(0, len(names), 5):
        chunk = names[i:i + 5]
        amts = [prot_amounts(n) for n in chunk]
        rows = [[DMG_RU[DMG[t]]] + [pct(a[t]) for a in amts]
                for t in range(len(DMG)) if any(abs(a[t]) > 1e-6 for a in amts)]
        head = ['Тип урона'] + [(labels or {}).get(n, f'`{n}`') for n in chunk]
        out.append(table(head, rows))
    return '\n\n'.join(out)

CLOTH_TYPES = ['Bullet', 'Slash', 'Stab', 'Blunt', 'Bite', 'Arrow', 'Explosion', 'Radiation', 'Cold', 'Heat']

def prot_rows(names):
    cols = [DMG.index(t) for t in CLOTH_TYPES]
    rows = []
    for n in names:
        a = prot_amounts(n)
        if a and any(abs(a[i]) > 1e-6 for i in cols):
            rows.append([f'`{n}`'] + [pct(a[i]) for i in cols])
    return table(['Предмет'] + [DMG_RU[t] for t in CLOTH_TYPES], rows)

block_prot = ['BlockTwig', 'BlockWood', 'BlockStone', 'BlockMetal']
block_labels = {'BlockTwig': 'Солома', 'BlockWood': 'Дерево', 'BlockStone': 'Камень', 'BlockMetal': 'Металл и броня'}
build_prot = ['WoodDoor', 'MetalDoor', 'GlassProtection', 'WallpaperProtection', 'BarricadeWood', 'BarricadeStone',
              'BarricadeMetal', 'Fence', 'BuildingShell']
dep_prot = ['DeployableGeneric', 'DeployableGenericDense', 'DeployableWood', 'DeployableMetal', 'DeployableLighting',
            'DeployableWorkBenchMetal', 'turret_protection', 'flame_turret_protection', 'SamSiteDeployed',
            'SignProtection', 'Shelves', 'GenericLootContainer']
cloth = sorted(p['name'] for p in prot.values()
               if p['name'] and p['name'][0].islower() and not p['name'].endswith('protection') and '.' not in p['name'])
page('data-protection', 'Таблица: защита по типам урона', 'Урон и рейд',
     'Сколько процентов урона каждого типа гасит защита блоков, дверей, деплоев и одежды.',
     ['protection', 'damage-system', 'data-building-blocks', 'data-entity-health', 'armor-clothing'],
     ['ProtectionProperties.cs', 'BaseCombatEntity.cs'], f"""
## Как читать

Защита `ProtectionProperties` — массив из 28 чисел — по одному на тип урона (`Rust.DamageType`).
Число — доля урона, которую защита гасит: 90% значит, что проходит 10%. Отрицательное значение
увеличивает урон. В таблицах показаны только типы урона, где хоть у одной колонки есть ненулевое
значение; «—» значит 0%. Как защита применяется, см. [[protection]] и [[damage-system]].

Урон по цели = урон × (1 − защита). Например, C4 (550 взрыва) по камню: 550 × (1 − 0,5) = 275 урона,
то есть 2 C4 на каменную стену в 500 HP. У стен поверх этой таблицы может действовать ещё
внешняя оболочка `BuildingShell`, см. [[protection]].

## Блоки постройки

Металл и броня используют одну таблицу `BlockMetal`.

{prot_transposed(block_prot, block_labels)}

## Двери, окна и баррикады

{prot_transposed(build_prot)}

## Деплои и техника базы

{prot_transposed(dep_prot)}

## Одежда и броня

У одежды защита складывается по зонам тела, см. [[armor-clothing]]. Показаны основные типы урона.

{prot_rows(cloth)}
""")

# =============== data-explosives ===============
ex_rows = []
seen = set()
for r in prefabs:
    if r['sub'] or 'explosionRadius' not in r['f'] or 'damageTypes' not in r['f']: continue
    f = r['f']; path = r['root']
    if path in seen: continue
    seen.add(path)
    dmg = ', '.join(f'{DMG_RU[DMG[d["type"]]]} {fmt(d["amount"])}' for d in f.get('damageTypes', []) if d['amount'])
    timer = fmt(f.get('timerAmountMin')) if f.get('timerAmountMin') == f.get('timerAmountMax') else f'{fmt(f.get("timerAmountMin"))}–{fmt(f.get("timerAmountMax"))}'
    dud = pct(f.get('dudChance')) if 'dudChance' in f else '—'
    ex_rows.append([f'`{os.path.basename(path).replace(".prefab", "")}`', dmg or '—',
                    f'{fmt(f.get("minExplosionRadius"))}–{fmt(f.get("explosionRadius"))}', timer, dud,
                    'да' if f.get('canStick') else '—'])
ex_rows.sort()
proj = {}
for r in prefabs:
    if not r['sub'] and 'speed' in r['f'] and 'gravityModifier' in r['f']:
        proj[r['root']] = r['f']
prow = sorted([f'`{os.path.basename(p).replace(".prefab", "")}`', fmt(f.get('speed')), fmt(f.get('gravityModifier'))]
              for p, f in proj.items())
page('data-explosives', 'Таблица: взрывчатка и ракеты', 'Урон и рейд',
     'Урон по типам, радиус, таймер и шанс осечки для всей взрывчатки, ракет и снарядов.',
     ['explosions', 'c4', 'rocket', 'satchel-charge', 'beancan-grenade', 'explosive-ammo', 'data-protection'],
     ['TimedExplosive.cs', 'DudTimedExplosive.cs', 'ServerProjectile.cs'], f"""
## Как читать

Значения взяты из компонентов `TimedExplosive` и `DudTimedExplosive` на префабах. Урон — до защиты
цели: стена гасит часть по своей таблице, см. [[data-protection]]. Радиус указан как «мин–макс»:
внутри минимального радиуса урон полный, дальше падает до нуля к максимальному, см. [[explosions]].
Таймер — секунды до взрыва. Осечка — шанс, что заряд не взорвётся с первого раза.

## Взрывные сущности

{table(['Префаб', 'Урон', 'Радиус, м', 'Таймер, с', 'Осечка', 'Липнет'], ex_rows)}

## Летящие снаряды

Скорость в м/с и множитель гравитации у `ServerProjectile` — для ракет и снарядов, которые летят
на сервере.

{table(['Префаб', 'Скорость', 'Гравитация'], prow)}
""")

# =============== data-entity-health ===============
CATS = [('Двери и люки', ('door', 'hatch', 'gate')), ('Стены, окна и баррикады', ('wall.external', 'barricade', 'gates.external', 'wall.frame', 'bars', 'shutter', 'embrasure', 'netting', 'fence', 'window')),
        ('Защита базы', ('turret', 'samsite', 'sam_site', 'trap', 'landmine', 'guntrap', 'spikes')),
        ('Хранение и производство', ('box', 'cupboard', 'workbench', 'furnace', 'refinery', 'recycler', 'locker', 'repairbench', 'research', 'stash', 'fridge', 'composter', 'mixingtable')),
        ('Электричество', ('electric', 'battery', 'solar', 'windmill', 'generator', 'switch', 'splitter'))]
ent = defaultdict(list); seenp = set()
for r in prefabs:
    f = r['f']
    if 'startHealth' not in f or r['sub'] or not r['root'].startswith('assets/prefabs/'): continue
    path = r['root']
    if path in seenp or f['startHealth'] <= 0: continue
    base = os.path.basename(path).replace('.prefab', '')
    for cat, keys in CATS:
        if any(k in path for k in keys):
            seenp.add(path)
            ent[cat].append([f'`{base}`', fmt(f['startHealth']), f'`{prot_name(f.get("baseProtection"))}`'])
            break
body = ['## Как читать\n\nHP — поле `startHealth` префаба (`BaseCombatEntity`). Таблица защиты — `baseProtection`, '
        'её значения в [[data-protection]]. Показаны префабы из `assets/prefabs`, разбитые по назначению '
        'по имени префаба.\n']
for cat, _ in CATS:
    if ent[cat]:
        body.append(f'## {cat}\n\n' + table(['Префаб', 'HP', 'Защита'], sorted(ent[cat])) + '\n')
page('data-entity-health', 'Таблица: HP дверей и деплоев', 'Урон и рейд',
     'Здоровье и таблица защиты дверей, внешних стен, турелей, ящиков и прочих деплоев из префабов игры.',
     ['door', 'external-wall', 'auto-turret', 'storage-boxes', 'tool-cupboard', 'data-protection'],
     ['BaseCombatEntity.cs'], '\n'.join(body))

# =============== data-crafting ===============
bp_rows = defaultdict(list)
CAT = ['Оружие', 'Строительство', 'Предметы', 'Ресурсы', 'Одежда', 'Инструменты', 'Медицина', 'Еда', 'Патроны',
       'Ловушки', 'Прочее', 'Всё', 'Поиск', 'Предметы', 'Компоненты', 'Электричество', 'Развлечения']
for r in items:
    if r['cls'] != 'ItemBlueprint': continue
    f = r['f']
    if not f.get('userCraftable'): continue
    d = item_by_go.get((r.get('prefab'), r.get('go')))
    if not d: continue
    ing = ', '.join(f'{fmt(a["amount"])} {iname(a["itemDef"])}' for a in f['ingredients'])
    cat = CAT[d['category']] if d['category'] < len(CAT) else str(d['category'])
    wb = f['workbenchLevelRequired'] or '—'
    out_amt = f['amountToCreate'] if f['amountToCreate'] > 1 else ''
    bp_rows[cat].append([d['displayName']['legacyEnglish'] + (f' ×{out_amt}' if out_amt else ''), f'`{d["shortname"]}`',
                         ing, fmt(f['time']), wb, 'да' if f.get('defaultBlueprint') else ''])
cbody = ['## Как читать\n\nРецепты всех предметов, которые игрок может скрафтить. '
         'Время — базовое, без бонуса верстака, см. [[crafting]]. «Верстак» — нужный уровень. '
         '«Сразу» — чертёж известен с начала. Названия предметов — английские, как в игре.\n']
for cat in sorted(bp_rows, key=lambda c: CAT.index(c) if c in CAT else 99):
    cbody.append(f'## {cat}\n\n' + table(['Предмет', 'Код', 'Ингредиенты', 'Время, с', 'Верстак', 'Сразу'],
                                          sorted(bp_rows[cat])) + '\n')
page('data-crafting', 'Таблица: рецепты крафта', 'Предметы и производство',
     'Ингредиенты, время и уровень верстака для каждого крафтового предмета.',
     ['crafting', 'research', 'workbench', 'recycling'], ['ItemBlueprint.cs', 'ItemCrafter.cs'], '\n'.join(cbody))

# =============== data-smelting ===============
srows = []
for r in items:
    if r['cls'] != 'ItemModCookable': continue
    f = r['f']; d = item_by_go.get((r.get('prefab'), r.get('go')))
    if not d: continue
    become = iname(f['becomeOnCooked']) if f.get('becomeOnCooked', {}).get('m_PathID') else '—'
    srows.append([d['displayName']['legacyEnglish'], become, fmt(f.get('amountOfBecome')), fmt(f.get('cookTime')),
                  f'{fmt(f.get("lowTemp"))}–{fmt(f.get("highTemp"))}'])
page('data-smelting', 'Таблица: плавка и готовка', 'Предметы и производство',
     'Что во что превращается в печах и на кострах, за сколько времени и при какой температуре.',
     ['smelting', 'furnace'], ['ItemModCookable.cs', 'BaseOven.cs'], f"""
## Как читать

Данные из `ItemModCookable` на предметах. «Время» — секунды на одну единицу при базовой скорости печи,
как скорость зависит от печи и топлива — в [[smelting]]. «Температура» — диапазон, в котором предмет
готовится: печь должна быть достаточно горячей, иначе предмет не плавится.

{table(['Сырьё', 'Результат', 'Кол-во', 'Время, с', 'Температура'], sorted(srows))}
""")
print('ok')
