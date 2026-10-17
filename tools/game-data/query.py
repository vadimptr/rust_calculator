"""Search dumped Rust asset data.
Usage: query.py <dump_dir> <regex> [--cls REGEX] [--fields a,b,c] [--limit N]
Matches regex (case-insensitive) against prefab path / root / GameObject / asset name / shortname.
Resolves ProtectionProperties and ItemDefinition references to names.
"""
import argparse, json, os, re
ap = argparse.ArgumentParser()
ap.add_argument('dump'); ap.add_argument('pattern')
ap.add_argument('--cls'); ap.add_argument('--fields'); ap.add_argument('--limit', type=int, default=40)
ap.add_argument('--monuments', action='store_true', help='also search monuments.jsonl (monument scenes, large)')
a = ap.parse_args()
recs = []
for n in ('items.jsonl', 'content.jsonl', 'prefabs.jsonl', 'monuments.jsonl'):
    path = os.path.join(a.dump, n)
    if not os.path.exists(path) or (n == 'monuments.jsonl' and not a.monuments):
        continue
    for l in open(path):
        r = json.loads(l); r['_src'] = n; recs.append(r)
names = {}
for r in recs:
    if r['_src'] == 'items.jsonl' and r['cls'] == 'ItemDefinition':
        names[r['pid']] = 'item:' + r['f']['shortname']
    elif r.get('so') and r.get('name'):
        names[r['pid']] = f"{r['cls']}:{r['name']}"
def res(v):
    if isinstance(v, dict):
        if set(v) == {'m_FileID', 'm_PathID'}:
            return names.get(v['m_PathID'], v) if v['m_PathID'] else None
        return {k: res(x) for k, x in v.items()}
    if isinstance(v, list): return [res(x) for x in v]
    return v
pat = re.compile(a.pattern, re.I); cpat = re.compile(a.cls, re.I) if a.cls else None
fields = a.fields.split(',') if a.fields else None
shown = 0
for r in recs:
    key = ' '.join(str(r.get(k) or '') for k in ('root', 'prefab', 'go', 'name', 'sub')) + ' ' + str(r['f'].get('shortname', ''))
    if not pat.search(key) or (cpat and not cpat.search(r['cls'])): continue
    f = {k: v for k, v in r['f'].items() if not fields or k in fields}
    print(json.dumps({'cls': r['cls'], 'where': r.get('root') or r.get('prefab') or r.get('name'), 'go': r.get('go') or r.get('sub'),
                      'f': res(f)}, ensure_ascii=False)[:3000])
    shown += 1
    if shown >= a.limit: break
