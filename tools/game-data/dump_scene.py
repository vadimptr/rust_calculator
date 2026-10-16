"""Dump all MonoBehaviours of the AssetScene-prefabs scene with their prefab path.
Usage: dump_scene.py <assetscenes.bundle> <AssetSceneManifest.json> <out.jsonl>"""
import sys, json, os, UnityPy
env = UnityPy.load(sys.argv[1])
man = json.load(open(sys.argv[2]))['Scenes']
by_base = {}
for sc in man:
    if sc['Name'] != 'AssetScene-prefabs': continue
    for p in sc['IncludedAssets']:
        by_base.setdefault(os.path.basename(p).rsplit('.', 1)[0].lower(), p)
objs = {o.path_id: o for o in env.objects if o.assets_file.name.endswith('AssetScene-prefabs')}
go_name, go_tr, tr_go, tr_parent = {}, {}, {}, {}
scripts = {}
for p, o in objs.items():
    if o.type.name == 'GameObject':
        tt = o.read_typetree(); go_name[p] = tt['m_Name']
        if tt['m_Component']: go_tr[p] = tt['m_Component'][0]['component']['m_PathID']
    elif o.type.name == 'Transform':
        tt = o.read_typetree(); tr_go[p] = tt['m_GameObject']['m_PathID']; tr_parent[p] = tt['m_Father']['m_PathID']
def script_name(o):
    """Class name of a MonoBehaviour, resolving m_Script through its own file (path ids are per file)."""
    ptr = o.read().m_Script
    key = (o.assets_file.name, ptr.file_id, ptr.path_id)
    if key not in scripts:
        try:
            scripts[key] = ptr.read().m_ClassName
        except Exception:
            scripts[key] = '?'
    return scripts[key]
def root_of(gop):
    tr = go_tr.get(gop); path = [go_name.get(gop)]
    while tr in tr_parent and tr_parent[tr]:
        tr = tr_parent[tr]; path.append(go_name.get(tr_go.get(tr)))
    root = go_name.get(tr_go.get(tr), go_name.get(gop))
    return root, '/'.join(reversed(path[:-1])) if len(path) > 1 else ''
def trim(v, depth=0):
    if isinstance(v, list):
        return [trim(x, depth+1) for x in v[:64]]
    if isinstance(v, dict):
        return {k: trim(x, depth+1) for k, x in v.items()}
    return v
out = open(sys.argv[3], 'w'); n = 0
for p, o in objs.items():
    if o.type.name != 'MonoBehaviour': continue
    tt = o.read_typetree()
    gop = tt['m_GameObject']['m_PathID']
    root, sub = root_of(gop)
    rec = {'pid': p, 'cls': script_name(o), 'root': root, 'sub': sub,
           'prefab': by_base.get((root or '').lower()),
           'f': trim({k: v for k, v in tt.items() if k not in ('m_GameObject','m_Script','m_Enabled','m_EditorHideFlags','m_EditorClassIdentifier','m_Name')})}
    out.write(json.dumps(rec, ensure_ascii=False, default=str) + '\n'); n += 1
print('dumped', n, file=sys.stderr)
