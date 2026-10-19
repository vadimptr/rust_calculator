# Данные игры для документации

Скрипты, которые достают числа из ассетов выделенного сервера Rust и собирают страницы-таблицы
`docs/game/pages/data-*.md`. Запускаются вручную после обновления игры, в сборку приложения не входят.

## Что понадобится

- [DepotDownloader](https://github.com/SteamRE/DepotDownloader) — скачать файлы сервера анонимно.
- Python 3.9+ с [UnityPy](https://pypi.org/project/UnityPy/) в отдельном venv.
- `AssetSceneManifest.json` из папки `Bundles` (есть и в клиенте, и в сервере).
- Для чтения кода: .NET SDK и `ilspycmd` (`dotnet tool install -g ilspycmd`).

## Шаги

```bash
# 1. Файлы сервера (Steam app 258550, Linux-депо), без аккаунта
cat > filelist.txt <<'L'
regex:RustDedicated_Data/Managed/.*\.dll$
Bundles/shared/content.bundle
Bundles/shared/items.preload.bundle
Bundles/shared/assetscenes.bundle
Bundles/AssetSceneManifest.json
L
DepotDownloader -app 258550 -os linux -filelist filelist.txt -dir rustsrv

# 2. Выгрузка ассетов в JSONL
python3 -m venv venv && venv/bin/pip install UnityPy
venv/bin/python -I tools/game-data/dump.py rustsrv/Bundles/shared/items.preload.bundle out/items.jsonl
venv/bin/python -I tools/game-data/dump.py rustsrv/Bundles/shared/content.bundle out/content.jsonl
venv/bin/python -I tools/game-data/dump_scene.py rustsrv/Bundles/shared/assetscenes.bundle \
  rustsrv/Bundles/AssetSceneManifest.json out/prefabs.jsonl
# сцены монументов и мира (~150 МБ): монументы, расписания ивентов, головоломки
venv/bin/python -I tools/game-data/dump_scene.py rustsrv/Bundles/shared/assetscenes.bundle \
  rustsrv/Bundles/AssetSceneManifest.json out/monuments.jsonl 'monument|world|props'

# 3. Страницы-таблицы
venv/bin/python -I tools/game-data/build_pages.py out docs/game/pages

# 4. Реестр серверных настроек (ConVar) из декомпилированного кода
venv/bin/python -I tools/game-data/build_convars.py src-decompiled docs/game/convars.json

# 5. Декомпиляция кода, если нужно перепроверить механики
ilspycmd rustsrv/RustDedicated_Data/Managed/Assembly-CSharp.dll \
  -r rustsrv/RustDedicated_Data/Managed -p -o src-decompiled

# 6. Иконки для документации из установленного клиента Rust (в серверной сборке их нет):
#    предметы — Bundles/items/*.png, значки интерфейса — textures.0.bundle (assets/icons),
#    блоки строительства — спрайты Construction.info.icon из content.bundle + textures.0/2
venv/bin/python -I tools/game-data/icons.py \
  ~/Library/Application\ Support/Steam/steamapps/common/Rust docs/game public/icons

# 7. Текстуры 3D-просмотра: плитки атласов грейдов и запечённые виды дверей, шкафа, дроп-бокса.
#    Бандлы читаются потоково (lazybundle.py): в клиенте они не сжаты, нужные байты берутся
#    по смещению, весь бандл в память не грузится
venv/bin/python -I tools/game-data/textures.py \
  ~/Library/Application\ Support/Steam/steamapps/common/Rust public/textures/game
```

Русские описания настроек лежат в `docs/game/convars.ru.json` и пишутся вручную. Новые настройки,
которых там нет, на страницах показываются с английской подсказкой из игры.

Шаг 4 использует декомпилированный код, поэтому его запускают после шага 5.

После шага 3 поменяйте дату `DATE` в `build_pages.py` и запустите `npm test`: тест проверит,
что все страницы разбираются и ссылки между ними не битые.

## Что где лежит

| Источник | Что внутри |
|----------|-----------|
| `items.preload.bundle` | `ItemDefinition`, `ItemBlueprint` (рецепты), моды предметов: снаряды, готовка, контейнеры |
| `content.bundle` | ScriptableObject'ы: грейды (`BuildingGrade`), защита (`ProtectionProperties`), лут (`LootSpawn`); компоненты `Construction` блоков |
| `assetscenes.bundle`, сцена `AssetScene-prefabs` | Префабы сущностей: двери, взрывчатка, турели, ящики, печи. Корень объекта в сцене назван путём префаба |
| `assetscenes.bundle`, сцены `AssetScene-monument.*`, `-world`, `-props.*` | Монументы целиком (ящики, считыватели карт, радиация, NPC), расписания ивентов. Поиск: `query.py ... --monuments` |

Поиск по выгрузке:

```bash
venv/bin/python -I tools/game-data/query.py out 'door.hinged.toptier' --fields startHealth,baseProtection
```

Ссылки между ассетами (`m_PathID`) уникальны только внутри файла бандла. Класс скрипта поэтому
определяется через `PPtr.read()` UnityPy, а не поиском по номеру.
