"""Dump selected MonoBehaviours from a Unity bundle to JSONL with prefab paths. Usage: dump.py <bundle> <out.jsonl>"""
import sys, json, time, UnityPy
KEEP_CLASSES = None  # dump everything that matches KEYS or is a ScriptableObject
KEYS = {'startHealth','_maxHealth','healthMultiplier','costMultiplier','baseHealth','amounts','explosionRadius',
        'damageTypes','baseProtection','timerAmountMin','dudChance','speed','gravityModifier','ingredients','time',
        'workbenchLevelRequired','maxStackSize','stackable','capacity','inventorySlots','fuelPerSec','cookTime',
        'maxCondition','repairable','decayTime','upkeepCost','damageScale','velocityScale','projectileVelocity'}
t0=time.time()
env = UnityPy.load(sys.argv[1])
objs = {}
for o in env.objects:
    objs[(o.assets_file.name, o.path_id)] = o
print('objects', len(objs), round(time.time()-t0,1), file=sys.stderr)
# container: root GameObject path_id -> asset path
root_path = {}
for o in env.objects:
    if o.type.name == 'AssetBundle':
        for path, info in o.read_typetree()['m_Container']:
            root_path[info['asset']['m_PathID']] = path
script_cls = {}
def cls_of(o):
    """Class name of a MonoBehaviour, resolving m_Script through its own file (path ids are per file)."""
    ptr = o.read().m_Script
    key = (o.assets_file.name, ptr.file_id, ptr.path_id)
    if key not in script_cls:
        try:
            script_cls[key] = ptr.read().m_ClassName
        except Exception:
            script_cls[key] = '?'
    return script_cls[key]
# transform parent map, gameobject names
go_name = {}; tr_go = {}; tr_parent = {}; go_tr = {}
for (f,p),o in objs.items():
    n = o.type.name
    if n == 'GameObject':
        tt = o.read_typetree(); go_name[p] = tt['m_Name']
        for c in tt['m_Component']:
            go_tr.setdefault(p, c['component']['m_PathID'])  # first component is Transform
    elif n == 'Transform':
        tt = o.read_typetree(); tr_go[p] = tt['m_GameObject']['m_PathID']; tr_parent[p] = tt['m_Father']['m_PathID']
print('hierarchy', round(time.time()-t0,1), file=sys.stderr)
def prefab_of(gop):
    tr = go_tr.get(gop); seen = 0
    while tr and tr_parent.get(tr) and seen < 64:
        tr = tr_parent[tr]; seen += 1
    root = tr_go.get(tr, gop)
    return root_path.get(root), go_name.get(root)
names = {}
out = open(sys.argv[2], 'w')
n = kept = 0
for (f,p),o in objs.items():
    if o.type.name != 'MonoBehaviour': continue
    n += 1
    try: tt = o.read_typetree()
    except Exception: continue
    gop = tt['m_GameObject']['m_PathID']
    cls = cls_of(o)
    rec = None
    if gop == 0:
        names[p] = tt.get('m_Name')
        rec = {'pid': p, 'cls': cls, 'name': tt.get('m_Name'), 'so': True}
    elif KEYS & set(tt.keys()):
        prefab, root = prefab_of(gop)
        rec = {'pid': p, 'cls': cls, 'go': go_name.get(gop), 'prefab': prefab, 'root': root}
    if rec is None: continue
    rec['f'] = {k: v for k, v in tt.items() if k not in ('m_GameObject','m_Script','m_Enabled','m_EditorHideFlags','m_EditorClassIdentifier')}
    out.write(json.dumps(rec, ensure_ascii=False, default=str) + '\n'); kept += 1
out.close()
json.dump(names, open(sys.argv[2] + '.names.json','w'), ensure_ascii=False)
print('mb', n, 'kept', kept, round(time.time()-t0,1), file=sys.stderr)
