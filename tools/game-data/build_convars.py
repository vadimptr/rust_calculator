"""Builds docs/game/convars.json: every server-side console variable of the Rust server
with its default value, help text and the source file that declares it.

Usage: python build_convars.py <decompiled src dir> <out.json>
Source: ConsoleGen.cs (FullName, Description, GetOveride → Class.field) + field initializers.
"""
import json, os, re, sys

SRC, OUT = sys.argv[1], sys.argv[2]
gen = open(os.path.join(SRC, 'ConsoleGen.cs'), encoding='utf8').read()

# index: class name -> file (relative); nested namespaces like ConVar.Server -> ConVar/Server.cs
files = {}
for root, _, fs in os.walk(SRC):
    for f in fs:
        if f.endswith('.cs'):
            rel = os.path.relpath(os.path.join(root, f), SRC)
            files.setdefault(rel[:-3].replace(os.sep, '.'), rel)
            files.setdefault(f[:-3], rel)

def class_file(cls):
    if not cls:
        return None
    return files.get(cls) or files.get('ConVar.' + cls) or files.get(cls.split('.')[-1])

def find_default(cls, field):
    rel = class_file(cls)
    if not rel:
        return None, None
    text = open(os.path.join(SRC, rel), encoding='utf8').read()
    for name in (field, field + '_Internal', '_' + field, field + '_internal'):
        m = re.search(r'public\s+static\s+(?:readonly\s+)?([\w<>\[\]]+)\s+' + re.escape(name) + r'\s*(?:=\s*([^;]+))?;', text) \
            or re.search(r'(?:private|internal|protected)\s+static\s+([\w<>\[\]]+)\s+' + re.escape(name) + r'\s*(?:=\s*([^;]+))?;', text)
        if m:
            typ, val = m.group(1), (m.group(2) or '').strip()
            if not val:
                val = {'bool': 'false', 'int': '0', 'float': '0', 'string': '""'}.get(typ, '')
            val = re.sub(r'(?<=\d)f\b', '', val).replace('"', '')
            return typ, val
    return None, None

out = []
for block in re.findall(r'new ConsoleSystem\.Command\s*\{(.*?)\n\t\t\}', gen, re.S):
    if 'Variable = true' not in block or 'Client = true' in block:
        continue
    full = re.search(r'FullName = "([^"]+)"', block)
    if not full:
        continue
    desc = re.search(r'Description = "((?:[^"\\]|\\.)*)"', block)
    setter = re.search(r'SetOveride = \(string str\) =>\s*\{\s*([\w.]+)\.(\w+) = ', block)
    getter = re.search(r'GetOveride = \(\) => ([\w.]+?)\.(\w+)(?:\.ToString\(\)|\s*\?)', block)
    m = setter or getter
    cls, field = (m.group(1), m.group(2)) if m else (None, None)
    typ, default = find_default(cls, field) if cls else (None, None)
    help_text = (desc.group(1) if desc else '').replace('(Generated) ', '').replace('\\"', '"')
    out.append({
        'name': full.group(1),
        'default': default,
        'type': typ,
        'help': help_text,
        'admin': 'ServerAdmin = true' in block,
        'replicated': 'Replicated = true' in block,
        'saved': 'Saved = true' in block,
        'file': class_file(cls),
    })
out.sort(key=lambda c: c['name'])
json.dump(out, open(OUT, 'w', encoding='utf8'), ensure_ascii=False, indent=0)
print(len(out), 'convars;', sum(1 for c in out if c['default'] is None), 'without default')
