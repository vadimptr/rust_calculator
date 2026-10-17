"""Dump all MonoBehaviours of asset scenes with their prefab path.
Usage: dump_scene.py <assetscenes.bundle> <AssetSceneManifest.json> <out.jsonl> [scene-regex]
scene-regex defaults to ^AssetScene-prefabs$ (entity prefabs); use e.g. 'monument|world' for monuments.
Path ids are unique only per file, so everything is keyed by (file, path_id)."""
import sys, json, os, re, UnityPy

env = UnityPy.load(sys.argv[1])
man = json.load(open(sys.argv[2]))['Scenes']
scene_re = re.compile(sys.argv[4] if len(sys.argv) > 4 else r'^AssetScene-prefabs$')
by_base = {}
for sc in man:
    if not scene_re.search(sc['Name']):
        continue
    for p in sc['IncludedAssets']:
        by_base.setdefault(os.path.basename(p).rsplit('.', 1)[0].lower(), p)

objs = {(o.assets_file.name, o.path_id): o for o in env.objects
        if scene_re.search(o.assets_file.name.replace('BuildPlayer-', ''))}
go_name, go_tr, tr_go, tr_parent = {}, {}, {}, {}
for (f, p), o in objs.items():
    if o.type.name == 'GameObject':
        tt = o.read_typetree()
        go_name[(f, p)] = tt['m_Name']
        if tt['m_Component']:
            go_tr[(f, p)] = (f, tt['m_Component'][0]['component']['m_PathID'])
    elif o.type.name == 'Transform':
        tt = o.read_typetree()
        tr_go[(f, p)] = (f, tt['m_GameObject']['m_PathID'])
        tr_parent[(f, p)] = (f, tt['m_Father']['m_PathID'])

scripts = {}
def script_name(o):
    """Class name of a MonoBehaviour, resolving m_Script through its own file."""
    ptr = o.read().m_Script
    key = (o.assets_file.name, ptr.file_id, ptr.path_id)
    if key not in scripts:
        try:
            scripts[key] = ptr.read().m_ClassName
        except Exception:
            scripts[key] = '?'
    return scripts[key]

def root_of(gok):
    tr = go_tr.get(gok)
    path = [go_name.get(gok) or '?']
    while tr in tr_parent and tr_parent[tr][1]:
        tr = tr_parent[tr]
        path.append(go_name.get(tr_go.get(tr)) or '?')
    root = go_name.get(tr_go.get(tr), go_name.get(gok)) or '?'
    return root, '/'.join(reversed(path[:-1])) if len(path) > 1 else ''

def trim(v):
    if isinstance(v, list):
        return [trim(x) for x in v[:64]]
    if isinstance(v, dict):
        return {k: trim(x) for k, x in v.items()}
    return v

out = open(sys.argv[3], 'w')
n = 0
for (f, p), o in objs.items():
    if o.type.name != 'MonoBehaviour':
        continue
    tt = o.read_typetree()
    gok = (f, tt['m_GameObject']['m_PathID'])
    root, sub = root_of(gok)
    rec = {'pid': p, 'scene': f.replace('BuildPlayer-', ''), 'cls': script_name(o), 'root': root, 'sub': sub,
           'prefab': by_base.get(root.lower()),
           'f': trim({k: v for k, v in tt.items() if k not in (
               'm_GameObject', 'm_Script', 'm_Enabled', 'm_EditorHideFlags', 'm_EditorClassIdentifier', 'm_Name')})}
    out.write(json.dumps(rec, ensure_ascii=False, default=str) + '\n')
    n += 1
print('dumped', n, file=sys.stderr)
