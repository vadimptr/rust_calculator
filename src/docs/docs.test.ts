import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { VIRTUAL_PAGE_IDS, backlinks, parsePage, resolveWikiLinks, searchPages, sortPages, wikiTargets, type DocPage } from './parse.ts';

const PAGES_DIR = new URL('../../docs/game/pages/', import.meta.url);

function loadAll(): DocPage[] {
  return readdirSync(PAGES_DIR)
    .filter(f => f.endsWith('.md'))
    .map(f => parsePage(readFileSync(new URL(f, PAGES_DIR), 'utf8'), f.replace(/\.md$/, '')));
}

const sample = `---
id: stability
title: Стабильность
kind: mechanic
group: Здание и шкаф
summary: Кратко.
related: [wall, foundation]
code: [StabilityEntity.cs]
---

## Кратко
Смотри [[wall]] и [[decay|распад]].
`;

test('parsePage reads front matter and body', () => {
  const p = parsePage(sample, 'stability');
  assert.equal(p.title, 'Стабильность');
  assert.equal(p.kind, 'mechanic');
  assert.deepEqual(p.related, ['wall', 'foundation']);
  assert.deepEqual(p.code, ['StabilityEntity.cs']);
  assert.ok(p.body.startsWith('## Кратко'));
});

test('parsePage rejects id that differs from file name and unknown group', () => {
  assert.throws(() => parsePage(sample, 'other'), /не совпадает/);
  assert.throws(() => parsePage(sample.replace('Здание и шкаф', 'Что-то'), 'stability'), /неизвестная группа/);
});

test('wiki links resolve to hash links, unknown ones become text', () => {
  const titles = new Map([['wall', 'Стена']]);
  assert.equal(resolveWikiLinks('[[wall]] и [[decay|распад]]', titles), '[Стена](#docs/wall) и распад');
  assert.deepEqual(wikiTargets('[[wall]] и [[decay|распад]]'), ['wall', 'decay']);
});

test('search ranks title matches first and requires all words', () => {
  const a = parsePage(sample, 'stability');
  const b = { ...a, id: 'wall', title: 'Стена', summary: 'Держит стабильность', body: '' };
  const r = searchPages([b, a], 'стабильность');
  assert.equal(r[0].id, 'stability');
  assert.equal(searchPages([a, b], 'стабильность распад').length, 1);
  assert.deepEqual(backlinks([a, b], 'wall').map(p => p.id), ['stability']);
});

test('all documentation pages are valid, ids unique, links not broken', () => {
  const pages = loadAll();
  assert.ok(pages.length > 0, 'нет страниц');
  const ids = new Set([...pages.map(p => p.id), ...VIRTUAL_PAGE_IDS]);
  assert.equal(ids.size, pages.length + VIRTUAL_PAGE_IDS.length, 'повторяющиеся id');
  const broken: string[] = [];
  for (const p of pages) {
    for (const t of [...p.related, ...wikiTargets(p.body)]) {
      if (!ids.has(t)) broken.push(`${p.id} → ${t}`);
    }
  }
  assert.deepEqual(broken, [], `битые ссылки:\n${broken.join('\n')}`);
  assert.equal(sortPages(pages).length, pages.length);
});

import { codeFileUsage, conVarsForPage, mentionedConVars, type ConVar } from './convars.ts';

test('convars: mentions and code-file declarations attach to a page, ConVar/* classes do not', () => {
  const registry: ConVar[] = [
    { name: 'heli.lifetimeminutes', default: '30', type: 'float', help: '', file: 'ConVar/PatrolHelicopter.cs' },
    { name: 'heli.guns', default: '1', type: 'int', help: '', file: 'ConVar/PatrolHelicopter.cs' },
    { name: 'patrolhelicopterai.monument_crash', default: 'true', type: 'bool', help: '', file: 'PatrolHelicopterAI.cs' },
    { name: 'server.pve', default: 'false', type: 'bool', help: '', file: 'ConVar/Server.cs' },
    { name: 'antihack.debuglevel', default: '1', type: 'int', help: '', file: 'ConVar/AntiHack.cs' },
  ];
  const page = { ...parsePage(sample, 'stability'), code: ['PatrolHelicopterAI.cs', 'ConVar/Server.cs'],
    body: 'Живёт `heli.lifetimeminutes` минут; antihack.debuglevel не трогаем; heli.call() — команда.' };
  assert.deepEqual(conVarsForPage(page, registry).map(c => c.name),
    ['heli.lifetimeminutes', 'heli.guns', 'patrolhelicopterai.monument_crash'], 'упомянутая, соседняя из того же namespace, объявленная в коде');
  assert.deepEqual(mentionedConVars('см. decay.scale и decay.scale', new Set(['decay.scale'])), ['decay.scale']);
  const many = Array.from({ length: 6 }, (_, i) => ({ ...page, id: `p${i}` }));
  const usage = codeFileUsage(many);
  assert.deepEqual(conVarsForPage(page, registry, usage).map(c => c.name), ['heli.lifetimeminutes', 'heli.guns'],
    'файл, указанный на 6 страницах, считается общим и не подтягивает объявленные в нём настройки');
});

test('convars registry is valid and descriptions refer to known names', () => {
  const registry = JSON.parse(readFileSync(new URL('../../docs/game/convars.json', import.meta.url), 'utf8')) as ConVar[];
  assert.ok(registry.length > 500);
  const ru = JSON.parse(readFileSync(new URL('../../docs/game/convars.ru.json', import.meta.url), 'utf8')) as Record<string, string>;
  const names = new Set(registry.map(c => c.name));
  assert.deepEqual(Object.keys(ru).filter(n => !names.has(n)), []);
});
