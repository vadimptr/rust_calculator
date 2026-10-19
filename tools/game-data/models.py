"""Game models for the 3D viewer from a Rust client install. Usage: models.py <Rust client dir> <out dir>"""
import glob
import json
import os
import struct
import sys

import numpy as np
from PIL import Image
from UnityPy.helpers.MeshHelper import MeshHandler

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lazybundle

CORE = 'assets/prefabs/building core/'
GRADE_NAMES = {'twig': 'twig', 'wood': 'wood', 'stone': 'stone', 'metal': 'metal', 'armored': 'toptier'}
BLOCKS = {
    'square-foundation': 'foundation/foundation.{g}.prefab',
    'triangle-foundation': 'foundation.triangle/foundation.triangle.{g}.prefab',
    'square-floor': 'floor/floor.{g}.prefab',
    'triangle-floor': 'floor.triangle/floor.triangle.{g}.prefab',
    'floor-frame': 'floor.frame/floor.frame.{g}.prefab',
    'triangle-floor-frame': ('floor.triangle.frame/floor.triangle.{g}.frame.prefab', 'floor.triangle.frame/floor.triangle.frame.{g}.prefab'),
    'wall': 'wall/wall.{g}.prefab',
    'half-wall': 'wall.half/wall.half.{g}.prefab',
    'low-wall': 'wall.low/wall.low.{g}.prefab',
    'doorway': 'wall.doorway/wall.doorway.{g}.prefab',
    'window-frame': 'wall.window/wall.window.{g}.prefab',
    'wall-frame': 'wall.frame/wall.frame.{g}.prefab',
    'stairs-l-shape': 'stairs.l/block.stair.lshape.{g}.prefab',
    'u-shaped-stairs': 'stairs.u/block.stair.ushape.{g}.prefab',
    'spiral-stairs': 'stairs.spiral/block.stair.spiral.{g}.prefab',
    'roof': 'roof/roof.{g}.prefab',
    'roof-triangle': 'roof.triangle/roof.triangle.{g}.prefab',
    'ramp': 'ramp/ramp.{g}.prefab',
    'foundation-steps': 'foundation.steps/foundation.steps.{g}.prefab',
}
OBJECTS = {
    'wooden-door': ('assets/prefabs/building/door.hinged/door.hinged.wood.prefab', None),
    'sheet-metal-door': ('assets/prefabs/building/door.hinged/door.hinged.metal.prefab', None),
    'armored-door': ('assets/prefabs/building/door.hinged/door.hinged.toptier.prefab', None),
    'wooden-double-door': ('assets/prefabs/building/door.double.hinged/door.double.hinged.wood.prefab', 'hinge_L'),
    'sheet-metal-double-door': ('assets/prefabs/building/door.double.hinged/door.double.hinged.metal.prefab', 'hinge_L'),
    'armored-double-door': ('assets/prefabs/building/door.double.hinged/door.double.hinged.toptier.prefab', 'hinge_L'),
    'garage-door': ('assets/prefabs/building/wall.frame.garagedoor/wall.frame.garagedoor.prefab', 'garage_door_block_unskinend_closed_LOD0'),
    'tool-cupboard': ('assets/prefabs/deployable/tool cupboard/cupboard.tool.deployed.prefab', None),
    'drop-box': ('assets/prefabs/deployable/dropbox/dropbox.deployed.prefab', None),
    'metal-window-bars': ('assets/prefabs/building/wall.window.bars/wall.window.bars.metal.prefab', None),
    'reinforced-glass-window': ('assets/prefabs/building/wall.window.reinforcedglass/wall.window.glass.reinforced.prefab', None),
}
SKIP_NAMES = ('gibs', 'collider', 'collision', 'shadow', 'lod1', 'lod2', 'lod3', 'destruct', 'debris', 'fade', 'wallpaper')
CONDITIONAL = {'full', 'wall_s', 'wall_e', 'wall_n', 'wall_w', 'wall_ne', 'wall_nw', 'roof.full', 'roof.triangle.full',
               'roof.top.line', 'roof.left.line', 'roof.right.line', 'roof.bottom.line', 'ramp.75', 'stairs.spiral.landing'}
MANIFEST = 'assets/manifest.asset'
MAX_TEX = 2048


def trs(t):
    p, q, s = t['m_LocalPosition'], t['m_LocalRotation'], t['m_LocalScale']
    x, y, z, w = q['x'], q['y'], q['z'], q['w']
    r = np.array([
        [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
        [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
        [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)],
    ])
    m = np.eye(4)
    m[:3, :3] = r * np.array([s['x'], s['y'], s['z']])
    m[:3, 3] = [p['x'], p['y'], p['z']]
    return m


def normal_from_dxt5nm(im):
    a = np.asarray(im.convert('RGBA'), dtype=np.float32) / 255.0
    x, y = a[..., 3] * 2 - 1, a[..., 1] * 2 - 1
    z = np.sqrt(np.clip(1 - x * x - y * y, 0, 1))
    return Image.fromarray(((np.stack([x, y, z], -1) * 0.5 + 0.5) * 255).astype(np.uint8), 'RGB')


class Exporter:
    def __init__(self, env, scene, out, guids):
        self.env, self.scene, self.out, self.guids = env, scene, out, guids
        self.textures = {}
        self.roots = {}
        for o in scene.objects.values():
            if o.type.name == 'GameObject':
                self.roots.setdefault(o.read_typetree()['m_Name'].lower(), o)
        os.makedirs(os.path.join(out, 'tex'), exist_ok=True)

    def texture(self, ptr, kind, alpha=False):
        tex = ptr.read()
        key = f'{tex.m_Name}-{kind}{"-a" if alpha else ""}'
        if key not in self.textures:
            im = tex.image
            if kind == 'normal':
                im = normal_from_dxt5nm(im)
            im.thumbnail((MAX_TEX if kind == 'color' else MAX_TEX // 2,) * 2, Image.LANCZOS)
            im = im.convert('RGBA' if alpha else 'RGB')
            name = f'{key}.webp'
            im.save(os.path.join(self.out, 'tex', name), 'WEBP', quality=82, method=6)
            self.textures[key] = 'tex/' + name
        return self.textures[key]

    def material(self, mat):
        props = {k: v for k, v in mat.m_SavedProperties.m_TexEnvs}
        floats = {k: v for k, v in mat.m_SavedProperties.m_Floats}
        colors = {k: v for k, v in mat.m_SavedProperties.m_Colors}
        main = props.get('_MainTex') or props.get('_BaseColorMap')
        bump = props.get('_BumpMap') or props.get('_NormalMap')
        c = colors.get('_Color')
        shader = ''
        try:
            shader = mat.m_Shader.read().m_ParsedForm.m_Name
        except Exception:
            pass
        out = {'name': mat.m_Name, 'color': [c.r, c.g, c.b, c.a] if c else [1, 1, 1, 1]}
        keywords = ' '.join(getattr(mat, 'm_ValidKeywords', []) or []) + ' ' + str(getattr(mat, 'm_ShaderKeywords', ''))
        if 'glass' in mat.m_Name.lower() or 'glass' in shader.lower() or 'Transparent' in shader:
            out['blend'] = True
        elif '_ALPHATEST_ON' in keywords or 'cutout' in shader.lower() or 'twig' in mat.m_Name.lower():
            out['cutoff'] = float(floats.get('_Cutoff', 0.5))
        alpha = 'blend' in out or 'cutoff' in out
        if main is not None and main.m_Texture.path_id:
            out['map'] = self.texture(main.m_Texture, 'color', alpha)
        if bump is not None and bump.m_Texture.path_id:
            out['normal'] = self.texture(bump.m_Texture, 'normal')
        return out

    def prefab_ref(self, comps):
        for c in comps:
            if c.type.name != 'MonoBehaviour':
                continue
            try:
                ref = c.read_typetree().get('prefab')
            except Exception:
                continue
            if isinstance(ref, dict) and ref.get('guid') in self.guids:
                return self.guids[ref['guid']]
        return None

    def collect(self, go, parent, items, excluded, root=False):
        tt = go.read_typetree()
        if not root and not tt.get('m_IsActive', 1):
            return
        name = tt['m_Name']
        if not root and any(s in name.lower() for s in SKIP_NAMES):
            return
        comps = [self.scene.objects.get(c['component']['m_PathID']) for c in tt['m_Component']]
        comps = [c for c in comps if c is not None]
        tr = next(c for c in comps if c.type.name in ('Transform', 'RectTransform'))
        trt = tr.read_typetree()
        world = parent @ trs(trt)
        ref = None if root else self.prefab_ref(comps)
        if ref is not None:
            target = self.roots.get(ref.lower())
            if name in CONDITIONAL and target is not None:
                self.collect(target, world, items, excluded, root=True)
            return
        mf = next((c for c in comps if c.type.name == 'MeshFilter'), None)
        mr = next((c for c in comps if c.type.name == 'MeshRenderer'), None)
        for c in comps:
            if c.type.name == 'LODGroup':
                for lod in c.read_typetree()['m_LODs'][1:]:
                    for r in lod['renderers']:
                        excluded.add(r['renderer']['m_PathID'])
        if mf is not None and mr is not None and mr.path_id not in excluded:
            r = mr.read_typetree()
            if r.get('m_Enabled', 1) and r.get('m_CastShadows', 1) != 3:
                items.append((world, mf, mr))
        for ch in trt['m_Children']:
            child = self.scene.objects.get(ch['m_PathID'])
            if child is not None:
                g = self.scene.objects.get(child.read_typetree()['m_GameObject']['m_PathID'])
                if g is not None:
                    self.collect(g, world, items, excluded)

    def find(self, go, name):
        tt = go.read_typetree()
        if tt['m_Name'] == name:
            return go
        for c in tt['m_Component']:
            co = self.scene.objects.get(c['component']['m_PathID'])
            if co is not None and co.type.name == 'Transform':
                for ch in co.read_typetree()['m_Children']:
                    child = self.scene.objects.get(ch['m_PathID'])
                    if child is not None:
                        g = self.scene.objects.get(child.read_typetree()['m_GameObject']['m_PathID'])
                        if g is not None:
                            hit = self.find(g, name)
                            if hit is not None:
                                return hit
        return None

    def export(self, prefab, sub, name):
        root = self.roots.get(prefab.lower())
        if root is None:
            return None
        start = root if sub is None else self.find(root, sub)
        if start is None:
            return None
        items = []
        excluded = set()
        if sub is not None:
            self.collect(root, np.eye(4), [], excluded, root=True)
        self.collect(start, np.eye(4), items, excluded, root=True)
        prims = []
        for world, mf, mr in items:
            if mr.path_id in excluded:
                continue
            mesh = mf.read().m_Mesh.read()
            h = MeshHandler(mesh)
            h.process()
            if not h.m_Vertices or not h.m_UV0:
                continue
            V = np.array(h.m_Vertices, dtype=np.float64)[:, :3]
            N = np.array(h.m_Normals, dtype=np.float64)[:, :3] if h.m_Normals else None
            UV = np.array(h.m_UV0, dtype=np.float64)[:, :2]
            V = (world[:3, :3] @ V.T).T + world[:3, 3]
            if N is not None:
                nm = np.linalg.inv(world[:3, :3]).T
                N = (nm @ N.T).T
                N /= np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-9)
            flip = np.linalg.det(world[:3, :3]) < 0
            mats = mr.read().m_Materials
            for si, tris in enumerate(h.get_triangles()):
                if si >= len(mats) or not tris:
                    continue
                try:
                    mat = mats[si].read()
                except Exception:
                    continue
                T = np.array(tris, dtype=np.int64)
                if flip:
                    T = T[:, ::-1]
                prims.append((V, N, UV, T, self.material(mat)))
        if not prims:
            return None
        return self.write_glb(name, prims)

    def write_glb(self, name, prims):
        buf = bytearray()
        views, accessors, meshes_prims, materials, images, textures = [], [], [], [], [], []
        mat_index, img_index = {}, {}

        def add_view(data, target=None):
            while len(buf) % 4:
                buf.append(0)
            off = len(buf)
            buf.extend(data)
            v = {'buffer': 0, 'byteOffset': off, 'byteLength': len(data)}
            if target:
                v['target'] = target
            views.append(v)
            return len(views) - 1

        def add_acc(arr, ctype, typ, target, minmax=False):
            view = add_view(arr.tobytes(), target)
            a = {'bufferView': view, 'componentType': ctype, 'count': int(arr.shape[0]), 'type': typ}
            if minmax:
                a['min'] = arr.min(0).tolist()
                a['max'] = arr.max(0).tolist()
            accessors.append(a)
            return len(accessors) - 1

        def tex_index(uri):
            if uri not in img_index:
                images.append({'uri': uri})
                textures.append({'source': len(images) - 1})
                img_index[uri] = len(textures) - 1
            return img_index[uri]

        for V, N, UV, T, mat in prims:
            used = np.unique(T)
            remap = np.full(V.shape[0], -1, np.int64)
            remap[used] = np.arange(len(used))
            pos = V[used].copy()
            uv = UV[used].copy()
            uv[:, 1] = 1 - uv[:, 1]
            idx = remap[T].astype(np.uint32).reshape(-1)
            attrs = {'POSITION': add_acc(pos.astype(np.float32), 5126, 'VEC3', 34962, True),
                     'TEXCOORD_0': add_acc(uv.astype(np.float32), 5126, 'VEC2', 34962)}
            if N is not None:
                nor = N[used].copy()
                attrs['NORMAL'] = add_acc(nor.astype(np.float32), 5126, 'VEC3', 34962)
            key = json.dumps(mat, sort_keys=True)
            if key not in mat_index:
                m = {'name': mat['name'], 'pbrMetallicRoughness': {'baseColorFactor': [min(1, max(0, c)) for c in mat['color']],
                                                                   'metallicFactor': 0.1, 'roughnessFactor': 0.85},
                     'doubleSided': 'cutoff' in mat or 'blend' in mat}
                if 'map' in mat:
                    m['pbrMetallicRoughness']['baseColorTexture'] = {'index': tex_index(mat['map'])}
                if 'normal' in mat:
                    m['normalTexture'] = {'index': tex_index(mat['normal'])}
                if 'cutoff' in mat:
                    m['alphaMode'] = 'MASK'
                    m['alphaCutoff'] = mat['cutoff']
                elif 'blend' in mat:
                    m['alphaMode'] = 'BLEND'
                materials.append(m)
                mat_index[key] = len(materials) - 1
            meshes_prims.append({'attributes': attrs, 'indices': add_acc(idx, 5125, 'SCALAR', 34963), 'material': mat_index[key]})
        while len(buf) % 4:
            buf.append(0)
        gltf = {'asset': {'version': '2.0', 'generator': 'rust_calculator models.py'}, 'scene': 0,
                'scenes': [{'nodes': [0]}], 'nodes': [{'name': name, 'mesh': 0}],
                'meshes': [{'name': name, 'primitives': meshes_prims}], 'materials': materials,
                'textures': textures, 'images': images, 'samplers': [{}],
                'buffers': [{'byteLength': len(buf)}], 'bufferViews': views, 'accessors': accessors}
        for t in textures:
            t['sampler'] = 0
        js = json.dumps(gltf, separators=(',', ':')).encode()
        while len(js) % 4:
            js += b' '
        data = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(buf))
        data += struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(buf), 0x004E4942) + bytes(buf)
        path = os.path.join(self.out, name + '.glb')
        with open(path, 'wb') as f:
            f.write(data)
        return {'triangles': int(sum(len(p[3]) for p in prims)), 'bytes': len(data)}


client, out = sys.argv[1:3]
only = sys.argv[3].split(',') if len(sys.argv) > 3 else None
bundles = os.path.join(client, 'Bundles')
env = lazybundle.load(os.path.join(bundles, 'shared', 'assetscenes.bundle'), os.path.join(bundles, 'shared', 'content.bundle'),
                      *sorted(glob.glob(os.path.join(bundles, 'shared', 'textures.*.bundle'))),
                      *sorted(glob.glob(os.path.join(bundles, 'textures', '*.bundle'))))
scene = next(sf for f in env.files.values() for n, sf in getattr(f, 'files', {}).items() if n.endswith('AssetScene-prefabs'))
content = env.files[os.path.join(bundles, 'shared', 'content.bundle')]
cab = next(sf for sf in content.files.values() if hasattr(sf, 'objects'))
container = next(o for o in cab.objects.values() if o.type.name == 'AssetBundle').read_typetree()['m_Container']
manifest_obj = cab.objects[next(info['asset']['m_PathID'] for path, info in container if path == MANIFEST)]
guids = {p['guid']: p['name'] for p in manifest_obj.read_typetree()['prefabProperties']}
ex = Exporter(env, scene, out, guids)
jobs = []
for kind, paths in BLOCKS.items():
    for grade, gname in GRADE_NAMES.items():
        options = [CORE + p.format(g=gname) for p in ([paths] if isinstance(paths, str) else paths)]
        jobs.append((f'{kind}.{grade}', next((p for p in options if p.lower() in ex.roots), options[0]), None))
jobs += [(kind, prefab, sub) for kind, (prefab, sub) in OBJECTS.items()]
for name, prefab, sub in jobs:
    if only and not any(name.startswith(o) for o in only):
        continue
    info = ex.export(prefab, sub, name)
    print(name, info if info else 'НЕТ', file=sys.stderr)
if not only:
    used = set(ex.textures.values())
    for name in os.listdir(os.path.join(out, 'tex')):
        if 'tex/' + name not in used:
            os.remove(os.path.join(out, 'tex', name))
