"""Copy game icons used by the docs from a Rust client install. Usage: icons.py <Rust client dir> <docs/game dir> <public/icons dir>"""
import sys, os, re, json, glob
import UnityPy
from PIL import Image, ImageChops

SIZE = 96
TINT = (0xe8, 0xd9, 0xb0)
CODE_RE = re.compile(r'`([^`\n]+)`')
FENCE_RE = re.compile(r'^(```|~~~).*?^\1', re.S | re.M)
ICON_FIELD_RE = re.compile(r'^icon:\s*(\S+)\s*$', re.M)
SCHEME_ICON_RE = re.compile(r'\bicon=([a-z0-9._/-]+)', re.I)

client, docs, public = sys.argv[1:4]
bundles = os.path.join(client, 'Bundles')
items_dir = os.path.join(bundles, 'items')
available_items = {f[:-4] for f in os.listdir(items_dir) if f.endswith('.png') and ' ' not in f}

UI_ITEMS = {'wood', 'stones', 'metal.fragments', 'metal.refined'}
wanted = {'items': set(UI_ITEMS), 'ui': set(), 'build': set()}
for path in glob.glob(os.path.join(docs, 'pages', '*.md')):
    text = open(path, encoding='utf8').read()
    explicit = ICON_FIELD_RE.findall(text) + SCHEME_ICON_RE.findall(text)
    for ref in explicit:
        kind, _, name = ref.rpartition('/')
        if kind in ('ui', 'build'):
            wanted[kind].add(name)
        elif ref in available_items:
            wanted['items'].add(ref)
        else:
            sys.exit(f'{os.path.basename(path)}: нет иконки предмета {ref}')
    for code in CODE_RE.findall(FENCE_RE.sub('', text)):
        if code in available_items:
            wanted['items'].add(code)


def square(im):
    im = im.convert('RGBA')
    box = im.getbbox()
    if box:
        im = im.crop(box)
    side = max(im.size)
    canvas = Image.new('RGBA', (side, side))
    canvas.paste(im, ((side - im.width) // 2, (side - im.height) // 2))
    return canvas.resize((SIZE, SIZE), Image.LANCZOS)


def tint_if_mono(im):
    r, g, b, a = im.split()
    spread = ImageChops.subtract(ImageChops.lighter(ImageChops.lighter(r, g), b), ImageChops.darker(ImageChops.darker(r, g), b))
    colored = ImageChops.multiply(spread.point(lambda v: 255 if v >= 24 else 0), a.point(lambda v: 255 if v > 32 else 0))
    if colored.getbbox() is None:
        im = Image.new('RGBA', im.size, TINT + (255,))
        im.putalpha(a)
    return im


def save(im, kind, name, tint=False):
    im = square(im)
    if tint:
        im = tint_if_mono(im)
    out = os.path.join(public, kind)
    os.makedirs(out, exist_ok=True)
    im.save(os.path.join(out, name + '.webp'), 'WEBP', quality=85, method=6)


for name in sorted(wanted['items']):
    save(Image.open(os.path.join(items_dir, name + '.png')), 'items', name)

shared = os.path.join(bundles, 'shared')

if wanted['ui']:
    env = UnityPy.load(os.path.join(shared, 'textures.0.bundle'))
    bundle = next(o for o in env.objects if o.type.name == 'AssetBundle')
    by_id = {}
    for path, info in bundle.read_typetree()['m_Container']:
        m = re.fullmatch(r'assets/icons/(.+)\.png', path)
        if m and m.group(1).replace('/', '-') in wanted['ui']:
            by_id[info['asset']['m_PathID']] = m.group(1).replace('/', '-')
    for o in env.objects:
        if o.type.name == 'Texture2D' and o.path_id in by_id:
            save(o.read().image, 'ui', by_id[o.path_id], tint=True)

if wanted['build']:
    env = UnityPy.load(*[os.path.join(shared, f) for f in ('content.bundle', 'textures.0.bundle', 'textures.2.bundle')])
    classes = {}
    done = set()
    for o in env.objects:
        if o.type.name != 'MonoBehaviour':
            continue
        try:
            d = o.read()
            s = d.m_Script
            key = (o.assets_file.name, s.file_id, s.path_id)
            if key not in classes:
                classes[key] = s.read().m_ClassName
            if classes[key] != 'Construction' or not d.info.icon.path_id:
                continue
            sprite = d.info.icon.read()
        except Exception:
            continue
        if sprite.m_Name in wanted['build'] and sprite.m_Name not in done:
            save(sprite.image, 'build', sprite.m_Name, tint=True)
            done.add(sprite.m_Name)

manifest = {}
for kind in wanted:
    folder = os.path.join(public, kind)
    have = {f[:-5] for f in os.listdir(folder) if f.endswith('.webp')} if os.path.isdir(folder) else set()
    for stale in have - wanted[kind]:
        os.remove(os.path.join(folder, stale + '.webp'))
    missing = wanted[kind] - have
    if missing:
        sys.exit(f'{kind}: не найдены {", ".join(sorted(missing))}')
    manifest[kind] = sorted(wanted[kind])

with open(os.path.join(docs, 'icons.json'), 'w', encoding='utf8') as f:
    json.dump(manifest, f, ensure_ascii=False, indent=0)
    f.write('\n')
print({k: len(v) for k, v in manifest.items()})
