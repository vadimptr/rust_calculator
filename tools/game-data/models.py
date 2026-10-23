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
    'spiral-stairs-triangle': 'stairs.spiral.triangle/stairs.triangle.spiral.{g}.prefab',
    'roof': 'roof/roof.{g}.prefab',
    'roof-triangle': 'roof.triangle/roof.triangle.{g}.prefab',
    'ramp': 'ramp/ramp.{g}.prefab',
    'foundation-steps': 'foundation.steps/foundation.steps.{g}.prefab',
}
BASES = {
    'square-foundation': 'foundation/foundation.prefab', 'triangle-foundation': 'foundation.triangle/foundation.triangle.prefab',
    'square-floor': 'floor/floor.prefab', 'triangle-floor': 'floor.triangle/floor.triangle.prefab',
    'floor-frame': 'floor.frame/floor.frame.prefab', 'triangle-floor-frame': 'floor.triangle.frame/floor.triangle.frame.prefab',
    'wall': 'wall/wall.prefab', 'half-wall': 'wall.half/wall.half.prefab', 'low-wall': 'wall.low/wall.low.prefab',
    'doorway': 'wall.doorway/wall.doorway.prefab', 'window-frame': 'wall.window/wall.window.prefab', 'wall-frame': 'wall.frame/wall.frame.prefab',
    'stairs-l-shape': 'stairs.l/block.stair.lshape.prefab', 'u-shaped-stairs': 'stairs.u/block.stair.ushape.prefab',
    'spiral-stairs': 'stairs.spiral/block.stair.spiral.prefab', 'spiral-stairs-triangle': 'stairs.spiral.triangle/block.stair.spiral.triangle.prefab', 'roof': 'roof/roof.prefab', 'roof-triangle': 'roof.triangle/roof.triangle.prefab',
    'ramp': 'ramp/ramp.prefab', 'foundation-steps': 'foundation.steps/foundation.steps.prefab',
}
TOKENS = {'square-foundation': 'foundation', 'triangle-foundation': 'foundation_triangle', 'foundation-steps': 'foundation_steps',
          'roof': 'roof', 'roof-triangle': 'roof_triangle'}
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
    'strengthened-glass-window': ('assets/prefabs/building/wall.window.reinforcedglass/wall.window.glass.reinforced.prefab', None),
    'reinforced-glass-window': ('assets/prefabs/building/wall.window.bars/wall.window.bars.toptier.prefab', None),
    'metal-embrasure': ('assets/prefabs/building/wall.window.embrasure/shutter.metal.embrasure.a.prefab', None),
}
SKIP_NAMES = ('gibs', 'collider', 'collision', 'shadow', 'lod1', 'lod2', 'lod3', 'destruct', 'debris', 'fade', 'wallpaper')
CONDITIONAL = {'full', 'wall_s', 'wall_e', 'wall_n', 'wall_w', 'wall_ne', 'wall_nw', 'roof.full', 'roof.triangle.full',
               'roof.top.line', 'roof.left.line', 'roof.right.line', 'roof.bottom.line', 'ramp.75', 'stairs.spiral.landing'}
MANIFEST = 'assets/manifest.asset'
TERRAIN = {
    'god-rock': 'assets/bundled/prefabs/autospawn/decor/v3_rock_formations_large/rock_formation_a.prefab',
}
PARTS = {
    'hot-air-balloon': ('assets/prefabs/deployable/hot air balloon/hotairballoon.prefab', 'hot_air_balloon_LOD0', {'balloon'}),
}
WORLD_LAYER = 16
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
        self.conditionals = True
        self.classes = {}
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

    def specgloss(self, main_ptr, spec_ptr, gloss_scale, alpha):
        main, spec = main_ptr.read(), spec_ptr.read()
        key = f'{main.m_Name}+{spec.m_Name}-sg{"-a" if alpha else ""}'
        if key not in self.textures:
            base = main.image.convert('RGBA')
            base.thumbnail((MAX_TEX, MAX_TEX), Image.LANCZOS)
            sg = spec.image.convert('RGBA').resize(base.size, Image.LANCZOS)
            a = np.asarray(base, dtype=np.float32) / 255
            g = np.asarray(sg, dtype=np.float32) / 255
            lin = lambda c: np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
            srgb = lambda c: np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(np.clip(c, 0, None), 1 / 2.4) - 0.055)
            diffuse, specular = lin(a[..., :3]), lin(g[..., :3])
            bright = lambda c: np.sqrt(0.299 * c[..., 0] ** 2 + 0.587 * c[..., 1] ** 2 + 0.114 * c[..., 2] ** 2)
            one_minus = 1 - specular.max(-1)
            d, sp, k = bright(diffuse), bright(specular), 0.04
            bq = d * one_minus / (1 - k) + sp - 2 * k
            metal = np.where(sp < k, 0, np.clip((-bq + np.sqrt(np.maximum(bq * bq - 4 * k * (k - sp), 0))) / (2 * k), 0, 1))
            m = metal[..., None]
            from_diffuse = diffuse * (one_minus / (1 - k) / np.maximum(1 - metal, 1e-4))[..., None]
            from_spec = (specular - k * (1 - m)) / np.maximum(m, 1e-4)
            color = np.clip(from_diffuse + (from_spec - from_diffuse) * m * m, 0, 1)
            rgb = (np.clip(srgb(color), 0, 1) * 255).astype(np.uint8)
            out = Image.fromarray(np.concatenate([rgb, (a[..., 3:] * 255).astype(np.uint8)], -1), 'RGBA')
            rough = 1 - np.clip(g[..., 3] * gloss_scale, 0, 1)
            mr = np.stack([np.zeros_like(rough), rough, metal], -1)
            mr_img = Image.fromarray((mr * 255).astype(np.uint8), 'RGB').resize((max(1, base.size[0] // 2), max(1, base.size[1] // 2)), Image.LANCZOS)
            name = f'{key}.webp'
            out.convert('RGBA' if alpha else 'RGB').save(os.path.join(self.out, 'tex', name), 'WEBP', quality=82, method=6)
            mr_img.save(os.path.join(self.out, 'tex', f'{key}-mr.webp'), 'WEBP', quality=90, method=6)
            self.textures[key] = ('tex/' + name, f'tex/{key}-mr.webp')
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
        spec = props.get('_SpecGlossMap')
        if spec is not None and spec.m_Texture.path_id and main is not None and main.m_Texture.path_id:
            try:
                out['map'], out['mr'] = self.specgloss(main.m_Texture, spec.m_Texture, float(floats.get('_GlossMapScale', 1)), alpha)
            except FileNotFoundError:
                pass
        for key, ptr, kind in (('map', main, 'color'), ('normal', bump, 'normal')):
            if ptr is None or not ptr.m_Texture.path_id or key in out:
                continue
            try:
                out[key] = self.texture(ptr.m_Texture, kind, alpha and kind == 'color')
            except FileNotFoundError:
                pass
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
            if self.conditionals and name in CONDITIONAL and target is not None:
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

    def cls(self, o):
        d = o.read()
        s = d.m_Script
        key = (o.assets_file.name, s.file_id, s.path_id)
        if key not in self.classes:
            try:
                self.classes[key] = s.read().m_ClassName
            except Exception:
                self.classes[key] = '?'
        return self.classes[key]

    def children(self, go):
        tt = go.read_typetree()
        comps = [self.scene.objects.get(c['component']['m_PathID']) for c in tt['m_Component']]
        tr = next(c for c in comps if c is not None and c.type.name == 'Transform')
        out = []
        for ch in tr.read_typetree()['m_Children']:
            c = self.scene.objects.get(ch['m_PathID'])
            if c is not None:
                g = self.scene.objects.get(c.read_typetree()['m_GameObject']['m_PathID'])
                if g is not None:
                    out.append(g)
        return out

    def behaviours(self, go):
        out = []
        for c in go.read_typetree()['m_Component']:
            o = self.scene.objects.get(c['component']['m_PathID'])
            if o is not None and o.type.name == 'MonoBehaviour':
                try:
                    out.append((o, self.cls(o), o.read_typetree()))
                except Exception:
                    pass
        return out

    def transform(self, go):
        for c in go.read_typetree()['m_Component']:
            o = self.scene.objects.get(c['component']['m_PathID'])
            if o is not None and o.type.name == 'Transform':
                return trs(o.read_typetree())
        return np.eye(4)

    def pieces(self, prefab):
        root = self.roots.get(prefab.lower())
        if root is None:
            return []
        models, owner = [], {}
        for go in self.children(root):
            name = go.read_typetree()['m_Name']
            bs = self.behaviours(go)
            model = next(((o, t) for o, c, t in bs if c == 'ConditionalModel'), None)
            if model is None:
                continue
            owner[model[0].path_id] = name
            tests = []
            skip = False
            for o, c, t in bs:
                if not c.startswith('ModelConditionTest_'):
                    continue
                kind = c[len('ModelConditionTest_'):]
                if kind == 'Wallpaper':
                    if t.get('wantsWallpaper'):
                        skip = True
                    continue
                test = {'type': kind}
                for k in ('angle', 'shape', 'VariantSeed', 'VariantIndex', 'VariantCount'):
                    if k in t:
                        test[k] = t[k]
                if 'reference' in t:
                    test['ref'] = t['reference']['m_PathID']
                if kind in ('FoundationSide', 'FoundationCornerLeft', 'FoundationCornerRight'):
                    m = self.transform(go)
                    test['right'] = [round(float(v), 3) for v in m[:3, 0]]
                tests.append(test)
            ref = self.guids.get(model[1]['prefab'].get('guid'))
            if skip or ref is None:
                continue
            models.append({'name': name, 'prefab': ref, 'matrix': [round(float(v), 5) for v in self.transform(go).T.reshape(-1)], 'tests': tests})
        for m in models:
            for t in m['tests']:
                if 'ref' in t:
                    t['ref'] = owner.get(t['ref'], '?')
        return models

    def sockets(self, prefab):
        root = self.roots.get(prefab.lower())
        out = []
        def walk(go, parent, path):
            name = go.read_typetree()['m_Name']
            world = parent @ self.transform(go)
            here = '' if path is None else (f'{path}/{name}' if path else name)
            for o, c, t in self.behaviours(go):
                if c in ('ConstructionSocket', 'NeighbourSocket', 'StabilitySocket', 'CornerSocket'):
                    s = {'name': here, 'cls': c, 'pos': [round(float(v), 4) for v in world[:3, 3]],
                         'rot': [round(float(v), 5) for v in world[:3, :3].T.reshape(-1)],
                         'size': [t['selectSize'][k] for k in 'xyz'], 'center': [t['selectCenter'][k] for k in 'xyz'],
                         'male': bool(t.get('male')), 'female': bool(t.get('female'))}
                    if c == 'ConstructionSocket':
                        s['type'] = t['socketType']
                    out.append(s)
            for ch in self.children(go):
                walk(ch, world, here)
        walk(root, np.eye(4), None)
        return out

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

    def export(self, prefabs, sub, name):
        items = []
        excluded = set()
        for prefab in [prefabs] if isinstance(prefabs, str) else prefabs:
            root = self.roots.get(prefab.lower())
            if root is None:
                return None
            start = root if sub is None else self.find(root, sub)
            if start is None:
                return None
            if sub is not None:
                self.collect(root, np.eye(4), [], excluded, root=True)
            self.collect(start, np.eye(4), items, excluded, root=True)
        prims = []
        for world, mf, mr in items:
            if mr.path_id in excluded:
                continue
            try:
                mesh = mf.read().m_Mesh.read()
            except FileNotFoundError:
                continue
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

    def mesh_prims(self, mf, mr, materials=None):
        try:
            mesh = mf.read().m_Mesh.read()
        except FileNotFoundError:
            return []
        h = MeshHandler(mesh)
        h.process()
        if not h.m_Vertices or not h.m_UV0:
            return []
        V = np.array(h.m_Vertices, dtype=np.float64)[:, :3]
        N = np.array(h.m_Normals, dtype=np.float64)[:, :3] if h.m_Normals else None
        UV = np.array(h.m_UV0, dtype=np.float64)[:, :2]
        mats = mr.read().m_Materials
        prims = []
        for si, tris in enumerate(h.get_triangles()):
            if si < len(mats) and tris:
                try:
                    mat = mats[si].read()
                    if materials is not None and mat.m_Name not in materials:
                        continue
                    prims.append((V, N, UV, np.array(tris, dtype=np.int64), self.material(mat)))
                except Exception:
                    continue
        return prims

    def world_colliders(self, go, parent, out):
        tt = go.read_typetree()
        comps = [self.scene.objects.get(c['component']['m_PathID']) for c in tt['m_Component']]
        comps = [c for c in comps if c is not None]
        tr = next(c for c in comps if c.type.name == 'Transform').read_typetree()
        world = parent @ trs(tr)
        if tt['m_Layer'] == WORLD_LAYER:
            for c in comps:
                if c.type.name == 'MeshCollider' and c.read_typetree().get('m_Enabled', 1):
                    out.append((world, c.read().m_Mesh))
        for ch in tr['m_Children']:
            child = self.scene.objects.get(ch['m_PathID'])
            if child is None:
                continue
            g = self.scene.objects.get(child.read_typetree()['m_GameObject']['m_PathID'])
            if g is not None and g.read_typetree().get('m_IsActive', 1):
                self.world_colliders(g, world, out)

    def export_part(self, prefab, node, materials, name):
        root = self.roots.get(prefab.lower())
        if root is None:
            return None
        found = []

        def walk(go, parent):
            tt = go.read_typetree()
            comps = [self.scene.objects.get(c['component']['m_PathID']) for c in tt['m_Component']]
            comps = [c for c in comps if c is not None]
            tr = next(c for c in comps if c.type.name == 'Transform').read_typetree()
            world = parent @ trs(tr)
            mf = next((c for c in comps if c.type.name == 'MeshFilter'), None)
            mr = next((c for c in comps if c.type.name == 'MeshRenderer'), None)
            if tt['m_Name'] == node and mf is not None and mr is not None:
                found.append((world, mf, mr))
            for ch in tr['m_Children']:
                child = self.scene.objects.get(ch['m_PathID'])
                if child is not None:
                    g = self.scene.objects.get(child.read_typetree()['m_GameObject']['m_PathID'])
                    if g is not None:
                        walk(g, world)

        walk(root, np.eye(4))
        if not found:
            return None
        world, mf, mr = found[0]
        prims = self.mesh_prims(mf, mr, materials)
        if not prims:
            return None
        matrix = [round(float(v), 6) for v in world.T.reshape(-1)]
        return self.write_scene(name, [(name, prims)], [{'mesh': 0, 'matrix': matrix}, {'name': 'visual', 'children': [0]}], [1])

    def export_terrain(self, prefab, name):
        root = self.roots.get(prefab.lower())
        if root is None:
            return None
        items = []
        self.collect(root, np.eye(4), items, set(), root=True)
        colliders = []
        self.world_colliders(root, np.eye(4), colliders)
        mesh_list, nodes, index = [], [], {}
        visual, collider = [], []
        for world, mf, mr in items:
            key = ('v', mf.read_typetree()['m_Mesh']['m_PathID'], tuple(m['m_PathID'] for m in mr.read_typetree()['m_Materials']))
            if key not in index:
                prims = self.mesh_prims(mf, mr)
                index[key] = len(mesh_list) if prims else None
                if prims:
                    mesh_list.append((mf.read().m_Mesh.read().m_Name, prims))
            if index[key] is not None:
                nodes.append({'mesh': index[key], 'matrix': [round(float(v), 6) for v in world.T.reshape(-1)]})
                visual.append(len(nodes) - 1)
        for world, ptr in colliders:
            key = ('c', ptr.path_id)
            if key not in index:
                mesh = ptr.read()
                h = MeshHandler(mesh)
                h.process()
                V = np.array(h.m_Vertices, dtype=np.float64)[:, :3]
                T = np.concatenate([np.array(t, dtype=np.int64) for t in h.get_triangles() if t]).reshape(-1, 3)
                index[key] = len(mesh_list)
                mesh_list.append((mesh.m_Name, [(V, None, None, T, None)]))
            nodes.append({'mesh': index[key], 'matrix': [round(float(v), 6) for v in world.T.reshape(-1)]})
            collider.append(len(nodes) - 1)
        nodes.append({'name': 'visual', 'children': visual})
        nodes.append({'name': 'collider', 'children': collider})
        return self.write_scene(name, mesh_list, nodes, [len(nodes) - 2, len(nodes) - 1])

    def write_glb(self, name, prims):
        return self.write_scene(name, [(name, prims)], [{'name': name, 'mesh': 0}], [0])

    def write_scene(self, name, mesh_list, nodes, roots):
        buf = bytearray()
        views, accessors, meshes, materials, images, textures = [], [], [], [], [], []
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

        for mesh_name, prims in mesh_list:
            meshes_prims = []
            meshes.append({'name': mesh_name, 'primitives': meshes_prims})
            for V, N, UV, T, mat in prims:
                self.add_prim(meshes_prims, V, N, UV, T, mat, add_acc, tex_index, materials, mat_index)
        while len(buf) % 4:
            buf.append(0)
        gltf = {'asset': {'version': '2.0', 'generator': 'rust_calculator models.py'}, 'scene': 0,
                'scenes': [{'nodes': roots}], 'nodes': nodes, 'meshes': meshes,
                'buffers': [{'byteLength': len(buf)}], 'bufferViews': views, 'accessors': accessors}
        if materials:
            gltf['materials'] = materials
        if textures:
            gltf.update(textures=textures, images=images, samplers=[{}])
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
        return {'triangles': int(sum(len(p[3]) for _, prims in mesh_list for p in prims)), 'bytes': len(data)}

    @staticmethod
    def add_prim(meshes_prims, V, N, UV, T, mat, add_acc, tex_index, materials, mat_index):
        used = np.unique(T)
        remap = np.full(V.shape[0], -1, np.int64)
        remap[used] = np.arange(len(used))
        pos = V[used].copy()
        idx = remap[T].astype(np.uint32).reshape(-1)
        attrs = {'POSITION': add_acc(pos.astype(np.float32), 5126, 'VEC3', 34962, True)}
        if UV is not None:
            uv = UV[used].copy()
            uv[:, 1] = 1 - uv[:, 1]
            attrs['TEXCOORD_0'] = add_acc(uv.astype(np.float32), 5126, 'VEC2', 34962)
        if N is not None:
            nor = N[used].copy()
            attrs['NORMAL'] = add_acc(nor.astype(np.float32), 5126, 'VEC3', 34962)
        if mat is None:
            meshes_prims.append({'attributes': attrs, 'indices': add_acc(idx, 5125, 'SCALAR', 34963)})
            return
        key = json.dumps(mat, sort_keys=True)
        if key not in mat_index:
            m = {'name': mat['name'], 'pbrMetallicRoughness': {'baseColorFactor': [min(1, max(0, c)) for c in mat['color']],
                                                               'metallicFactor': 0.1, 'roughnessFactor': 0.85},
                 'doubleSided': 'cutoff' in mat or 'blend' in mat}
            if 'map' in mat:
                m['pbrMetallicRoughness']['baseColorTexture'] = {'index': tex_index(mat['map'])}
            if 'normal' in mat:
                m['normalTexture'] = {'index': tex_index(mat['normal'])}
            if 'mr' in mat:
                m['pbrMetallicRoughness']['metallicRoughnessTexture'] = {'index': tex_index(mat['mr'])}
                m['pbrMetallicRoughness']['metallicFactor'] = 1
                m['pbrMetallicRoughness']['roughnessFactor'] = 1
            if 'cutoff' in mat:
                m['alphaMode'] = 'MASK'
                m['alphaCutoff'] = mat['cutoff']
            elif 'blend' in mat:
                m['alphaMode'] = 'BLEND'
            materials.append(m)
            mat_index[key] = len(materials) - 1
        meshes_prims.append({'attributes': attrs, 'indices': add_acc(idx, 5125, 'SCALAR', 34963), 'material': mat_index[key]})


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
bases = set()
for name, prefab, sub in jobs:
    if only and not any(name.startswith(o) for o in only):
        continue
    ex.conditionals = name.split('.')[0] not in BLOCKS
    info = ex.export(prefab, sub, name)
    if info:
        bases.add(name)
    print(name, info if info else 'нет основной части', file=sys.stderr)

world_scene = next(sf for f in env.files.values() for n, sf in getattr(f, 'files', {}).items() if n.endswith('AssetScene-world'))
terrain_ex = Exporter(env, world_scene, out, guids)
terrain_ex.conditionals = False
terrain_ex.textures = ex.textures
for name, prefab in TERRAIN.items():
    if only and not any(name.startswith(o) for o in only):
        continue
    print(name, terrain_ex.export_terrain(prefab, name) or 'нет модели', file=sys.stderr)
for name, (prefab, node, materials) in PARTS.items():
    if only and not any(name.startswith(o) for o in only):
        continue
    print(name, ex.export_part(prefab, node, materials, name) or 'нет модели', file=sys.stderr)

ex.conditionals = False
manifest = {}
exported = set()
for kind, base in BASES.items():
    if only and not any(kind.startswith(o) for o in only):
        continue
    entry = {'prefix': base.split('/')[-1][:-len('.prefab')], 'token': TOKENS.get(kind, kind), 'sockets': ex.sockets(CORE + base),
             'base': {}, 'pieces': []}
    byname = {}
    for job, prefab, _ in jobs:
        if not job.startswith(kind + '.') or job.count('.') != 1:
            continue
        grade = job.split('.')[1]
        entry['base'][grade] = job in bases
        for piece in ex.pieces(prefab):
            stem = 'piece.' + piece['prefab'].split('/')[-1][:-len('.prefab')]
            if stem not in exported:
                exported.add(stem)
                print(stem, ex.export(piece['prefab'], None, stem) or 'пусто', file=sys.stderr)
            slot = byname.setdefault(piece['name'], {'name': piece['name'], 'matrix': piece['matrix'], 'tests': piece['tests'], 'model': {}})
            slot['model'][grade] = stem
    entry['pieces'] = list(byname.values())
    manifest[kind] = entry
if manifest:
    with open(os.path.join(out, 'conditionals.json'), 'w') as f:
        json.dump(manifest, f, ensure_ascii=False, separators=(',', ':'))
if not only:
    used = {t for v in ex.textures.values() for t in (v if isinstance(v, tuple) else (v,))}
    for name in os.listdir(os.path.join(out, 'tex')):
        if 'tex/' + name not in used:
            os.remove(os.path.join(out, 'tex', name))
