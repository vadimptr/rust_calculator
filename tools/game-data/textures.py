"""Textures for the 3D viewer from a Rust client install. Usage: textures.py <Rust client dir> <out dir>"""
import glob
import os
import sys

import numpy as np
from PIL import Image
from UnityPy.helpers.MeshHelper import MeshHandler

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lazybundle

SIZE = 1024
NORMAL_SIZE = 512
PPM = 256

GRADES = {
    'twig': ('atlas_twig', 2, {'side': (1, 0), 'top': (0, 1), 'roof': (0, 0)}),
    'wood': ('atlas_wood_stone_metal', 4, {'side': (0, 1), 'top': (1, 0), 'roof': (1, 1)}),
    'stone': ('atlas_wood_stone_metal', 4, {'side': (2, 1), 'top': (2, 0), 'roof': (3, 0)}),
    'metal': ('atlas_wood_stone_metal', 4, {'side': (2, 3), 'top': (3, 2), 'roof': (2, 3)}),
    'armored': ('atlas_toptier', 2, {'side': (0, 0), 'top': (1, 0), 'roof': (0, 1)}),
}

PREFABS = 'assets/prefabs/'
OBJECTS = {
    'wooden-door': ('building/door.hinged/door.hinged.wood.prefab', 'door', {'front': (2, 1), 'back': (2, -1), 'edge': (0, 1)}),
    'sheet-metal-door': ('building/door.hinged/door.hinged.metal.prefab', 'door', {'front': (2, 1), 'back': (2, -1), 'edge': (0, 1)}),
    'armored-door': ('building/door.hinged/door.hinged.toptier.prefab', 'door', {'front': (2, 1), 'back': (2, -1), 'edge': (0, 1)}),
    'wooden-double-door': ('building/door.double.hinged/door.double.hinged.wood.prefab', 'doubledoor.wood_L', {'front': (0, 1), 'back': (0, -1), 'edge': (2, 1)}),
    'sheet-metal-double-door': ('building/door.double.hinged/door.double.hinged.metal.prefab', 'doubledoor.metal_L', {'front': (0, 1), 'back': (0, -1), 'edge': (2, 1)}),
    'armored-double-door': ('building/door.double.hinged/door.double.hinged.toptier.prefab', 'doubledoor.toptier_L', {'front': (0, 1), 'back': (0, -1), 'edge': (2, 1)}),
    'garage-door': ('building/wall.frame.garagedoor/wall.frame.garagedoor.prefab', 'garage_door_block_unskinend_closed_LOD0', {'front': (0, 1), 'back': (0, -1), 'edge': (2, 1)}),
    'tool-cupboard': ('deployable/tool cupboard/cupboard.tool.deployed.prefab', 'tool_cupboard_LOD0', {'front': (2, 1), 'back': (2, -1), 'side': (0, 1), 'top': (1, 1)}),
    'drop-box': ('deployable/dropbox/dropbox.deployed.prefab', 'dropboxv2', {'front': (2, 1), 'back': (2, -1), 'side': (0, 1), 'top': (1, 1)}),
}


def normal_from_dxt5nm(im):
    a = np.asarray(im.convert('RGBA'), dtype=np.float32) / 255.0
    x = a[..., 3] * 2 - 1
    y = a[..., 1] * 2 - 1
    z = np.sqrt(np.clip(1 - x * x - y * y, 0, 1))
    rgb = np.stack([x, y, z], -1) * 0.5 + 0.5
    return Image.fromarray((rgb * 255).astype(np.uint8), 'RGB')


def tile(im, grid, row, col):
    w, h = im.size
    return im.crop((col * w // grid, row * h // grid, (col + 1) * w // grid, (row + 1) * h // grid)).resize((SIZE, SIZE), Image.LANCZOS)


def save(im, path, alpha=False):
    if not alpha:
        im = im.convert('RGB')
    im.save(path, 'WEBP', quality=82, method=6)


def bake(V, UV, T, tex, axis, sign):
    e = np.eye(3)
    d = -sign * e[axis]
    up = e[1] if axis != 1 else e[2]
    right = np.cross(d, up)
    U, Y = V @ right, V @ up
    W = max(1, int(round((U.max() - U.min()) * PPM)))
    H = max(1, int(round((Y.max() - Y.min()) * PPM)))
    px, py = (U - U.min()) * PPM, (Y.max() - Y) * PPM
    depth = V[:, axis] * sign
    t = np.asarray(tex.convert('RGBA'), dtype=np.uint8)
    th, tw = t.shape[:2]
    out = np.zeros((H, W, 4), np.uint8)
    zb = np.full((H, W), -np.inf)
    p = V[T]
    n = np.cross(p[:, 1] - p[:, 0], p[:, 2] - p[:, 0])
    for k, tri in enumerate(T):
        if n[k, axis] * sign <= 0:
            continue
        xs, ys = px[tri], py[tri]
        x0, x1 = int(max(0, np.floor(xs.min()))), int(min(W - 1, np.ceil(xs.max())))
        y0, y1 = int(max(0, np.floor(ys.min()))), int(min(H - 1, np.ceil(ys.max())))
        if x1 < x0 or y1 < y0:
            continue
        gx, gy = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
        det = (ys[1] - ys[2]) * (xs[0] - xs[2]) + (xs[2] - xs[1]) * (ys[0] - ys[2])
        if abs(det) < 1e-12:
            continue
        a = ((ys[1] - ys[2]) * (gx - xs[2]) + (xs[2] - xs[1]) * (gy - ys[2])) / det
        b = ((ys[2] - ys[0]) * (gx - xs[2]) + (xs[0] - xs[2]) * (gy - ys[2])) / det
        c = 1 - a - b
        m = (a >= -1e-6) & (b >= -1e-6) & (c >= -1e-6)
        z = a * depth[tri[0]] + b * depth[tri[1]] + c * depth[tri[2]]
        sub = zb[y0:y1 + 1, x0:x1 + 1]
        m &= z > sub
        if not m.any():
            continue
        uv = UV[tri]
        u = (a * uv[0, 0] + b * uv[1, 0] + c * uv[2, 0]) % 1.0
        v = (a * uv[0, 1] + b * uv[1, 1] + c * uv[2, 1]) % 1.0
        ix = np.clip((u * tw).astype(int), 0, tw - 1)
        iy = np.clip(((1 - v) * th).astype(int), 0, th - 1)
        sub[m] = z[m]
        out[y0:y1 + 1, x0:x1 + 1][m] = t[iy[m], ix[m]]
    img = Image.fromarray(out, 'RGBA')
    bg = Image.new('RGBA', img.size, tuple(int(c) for c in np.median(out[out[..., 3] > 0][:, :3], 0)) + (255,))
    bg.alpha_composite(img)
    return bg


def find_scene(env, suffix):
    for f in env.files.values():
        for name, sf in getattr(f, 'files', {}).items():
            if name.endswith(suffix):
                return sf
    raise SystemExit(f'нет сцены {suffix}')


def mesh_and_texture(scene, roots, prefab, go_name):
    stack = [roots[(PREFABS + prefab).lower()]]
    while stack:
        go = stack.pop()
        tt = go.read_typetree()
        comps = [scene.objects.get(c['component']['m_PathID']) for c in tt['m_Component']]
        comps = [c for c in comps if c is not None]
        if tt['m_Name'] == go_name:
            mf = next(c for c in comps if c.type.name == 'MeshFilter').read()
            mr = next(c for c in comps if c.type.name == 'MeshRenderer').read()
            mat = mr.m_Materials[0].read()
            tex = next(v.m_Texture.read() for k, v in mat.m_SavedProperties.m_TexEnvs if k == '_MainTex')
            return mf.m_Mesh.read(), tex.image
        tr = next(c for c in comps if c.type.name == 'Transform')
        for ch in tr.read_typetree()['m_Children']:
            child = scene.objects.get(ch['m_PathID'])
            if child is not None:
                stack.append(scene.objects[child.read_typetree()['m_GameObject']['m_PathID']])
    raise SystemExit(f'{prefab}: нет объекта {go_name}')


client, out = sys.argv[1:3]
bundles = os.path.join(client, 'Bundles')
os.makedirs(out, exist_ok=True)
env = lazybundle.load(os.path.join(bundles, 'shared', 'assetscenes.bundle'), os.path.join(bundles, 'shared', 'content.bundle'),
                      *sorted(glob.glob(os.path.join(bundles, 'shared', 'textures.*.bundle'))),
                      *sorted(glob.glob(os.path.join(bundles, 'textures', '*.bundle'))))

atlases = {name for name, _, _ in GRADES.values()}
maps = {}
for o in env.objects:
    if o.type.name == 'Material' and o.assets_file.name.startswith('CAB-'):
        mat = o.read()
        if mat.m_Name in atlases and mat.m_Name not in maps:
            texs = dict((k, v.m_Texture) for k, v in mat.m_SavedProperties.m_TexEnvs)
            maps[mat.m_Name] = (texs['_MainTex'].read().image, normal_from_dxt5nm(texs['_BumpMap'].read().image))

for grade, (atlas, grid, faces) in GRADES.items():
    color, normal = maps[atlas]
    for face, (row, col) in faces.items():
        save(tile(color, grid, row, col), os.path.join(out, f'{grade}-{face}.webp'), alpha=grade == 'twig')
        save(tile(normal, grid, row, col).resize((NORMAL_SIZE, NORMAL_SIZE), Image.LANCZOS), os.path.join(out, f'{grade}-{face}-n.webp'))
    print(grade, file=sys.stderr)

scene = find_scene(env, 'AssetScene-prefabs')
wanted = {(PREFABS + p).lower() for p, _, _ in OBJECTS.values()}
roots = {}
for o in scene.objects.values():
    if o.type.name == 'GameObject':
        name = o.read_typetree()['m_Name'].lower()
        if name in wanted:
            roots[name] = o

for kind, (prefab, go_name, views) in OBJECTS.items():
    mesh, tex = mesh_and_texture(scene, roots, prefab, go_name)
    h = MeshHandler(mesh)
    h.process()
    V = np.array(h.m_Vertices)[:, :3]
    UV = np.array(h.m_UV0)[:, :2]
    T = np.array([t for sub in h.get_triangles() for t in sub])
    for face, (axis, sign) in views.items():
        im = bake(V, UV, T, tex, axis, sign)
        im.thumbnail((SIZE, SIZE), Image.LANCZOS)
        save(im, os.path.join(out, f'{kind}-{face}.webp'))
    print(kind, file=sys.stderr)
