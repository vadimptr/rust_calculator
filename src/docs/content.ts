import { parsePage, sortPages, type DocPage } from './parse';
import { codeFileUsage, conVarsForPage, type ConVar } from './convars';
import registryJson from '../../docs/game/convars.json';
import ruJson from '../../docs/game/convars.ru.json';
import iconsJson from '../../docs/game/icons.json';
import type { IconManifest } from './icons';

const files = import.meta.glob('../../docs/game/pages/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const filePages: DocPage[] = Object.entries(files).map(([path, raw]) => {
  const fileId = path.split('/').pop()!.replace(/\.md$/, '');
  return parsePage(raw, fileId);
});

export const CONVARS = registryJson as ConVar[];
export const CONVAR_RU = ruJson as Record<string, string>;

/** Настройки сервера, относящиеся к каждой странице. */
const usage = codeFileUsage(filePages);
export const PAGE_CONVARS: ReadonlyMap<string, ConVar[]> = new Map(
  filePages.map(p => [p.id, conVarsForPage(p, CONVARS, usage)]),
);

/** Обратный индекс: настройка → страницы, где она описана. */
export const CONVAR_PAGES: ReadonlyMap<string, string[]> = (() => {
  const m = new Map<string, string[]>();
  for (const [id, list] of PAGE_CONVARS) {
    for (const c of list) m.set(c.name, [...(m.get(c.name) ?? []), id]);
  }
  return m;
})();

export function conVarDescription(c: ConVar): string {
  return CONVAR_RU[c.name] ?? c.help;
}

function cell(s: string): string {
  return s.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

/** Сводная страница всех настроек, упомянутых в документации, по пространствам имён. */
function settingsPage(): DocPage {
  const used = CONVARS.filter(c => CONVAR_PAGES.has(c.name));
  const groups = new Map<string, ConVar[]>();
  for (const c of used) {
    const ns = c.name.split('.')[0];
    groups.set(ns, [...(groups.get(ns) ?? []), c]);
  }
  const parts = [
    '## Как читать',
    '',
    'Все серверные настройки (ConVar), которые относятся к описанным механикам. ' +
      'Указано значение по умолчанию; администратор может его изменить, поэтому на модовых и даже ' +
      '«ванильных» серверах значения бывают другими. Игрок прочитать серверные настройки не может.',
    '',
    `Всего: ${used.length}.`,
  ];
  for (const [ns, list] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
    parts.push('', `## ${ns}`, '', '| Настройка | По умолчанию | Что делает | Где описано |', '|---|---|---|---|');
    for (const c of list) {
      const where = (CONVAR_PAGES.get(c.name) ?? []).map(id => `[[${id}]]`).join(', ');
      parts.push(`| \`${c.name}\` | ${c.default ?? '—'} | ${cell(conVarDescription(c))} | ${where} |`);
    }
  }
  return {
    id: 'data-server-settings',
    title: 'Таблица: настройки сервера',
    kind: 'data',
    group: 'Сервер и режимы',
    icon: 'ui/gear',
    summary: 'Все серверные настройки, влияющие на описанные механики: значение по умолчанию, что делают и где описаны.',
    related: ['server-convars', 'game-modes'],
    code: ['ConsoleGen.cs'],
    body: parts.join('\n'),
  };
}

/** Все страницы документации, отсортированные по группам. */
export const DOC_PAGES: DocPage[] = sortPages([...filePages, settingsPage()]);

export const DOC_BY_ID: ReadonlyMap<string, DocPage> = new Map(DOC_PAGES.map(p => [p.id, p]));

export const ICONS = iconsJson as IconManifest;

export const ITEM_ICONS: ReadonlySet<string> = new Set(ICONS.items);
