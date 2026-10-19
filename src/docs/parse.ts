/** Разбор страниц документации по механикам (docs/game/pages/*.md). Без зависимостей от Vite — тестируется в node. */

export const DOC_GROUPS = [
  'Строительство',
  'Здание и шкаф',
  'Урон и рейд',
  'Двери и замки',
  'Защита базы',
  'Электричество',
  'Схемы',
  'Индустрия',
  'Вода и фермерство',
  'Игрок',
  'Предметы и производство',
  'Оружие и бой',
  'Торговля',
  'Транспорт',
  'NPC и животные',
  'Монументы',
  'Мир и события',
  'Сервер и режимы',
] as const;

/** Страницы, которые собираются в приложении, а не лежат файлом в docs/game/pages. */
export const VIRTUAL_PAGE_IDS: readonly string[] = ['data-server-settings'];

export type DocGroup = (typeof DOC_GROUPS)[number];
export type DocKind = 'mechanic' | 'object' | 'scheme' | 'data';

export const DOC_KINDS: readonly DocKind[] = ['mechanic', 'object', 'scheme', 'data'];

export interface DocPage {
  id: string;
  title: string;
  kind: DocKind;
  group: DocGroup;
  icon: string;
  summary: string;
  related: string[];
  code: string[];
  body: string;
}

export const KIND_LABEL: Record<DocKind, string> = {
  mechanic: 'Механика',
  object: 'Объект',
  scheme: 'Схема',
  data: 'Таблица',
};

const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function parseList(value: string): string[] {
  const v = value.trim();
  const inner = v.startsWith('[') && v.endsWith(']') ? v.slice(1, -1) : v;
  return inner
    .split(',')
    .map(s => s.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean);
}

/** Разбирает markdown с front matter. Бросает ошибку с понятным текстом, если формат нарушен. */
export function parsePage(raw: string, fileId?: string): DocPage {
  const text = raw.replace(/^﻿/, '').replace(/\r\n/g, '\n');
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) throw new Error(`${fileId ?? '?'}: нет front matter`);
  const fields: Record<string, string> = {};
  for (const line of m[1].split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const i = line.indexOf(':');
    if (i < 0) throw new Error(`${fileId ?? '?'}: строка без двоеточия: ${line}`);
    fields[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  const where = fileId ?? fields.id ?? '?';
  const need = (k: string) => {
    if (!fields[k]) throw new Error(`${where}: нет поля ${k}`);
    return fields[k];
  };
  const id = need('id');
  if (!ID_RE.test(id)) throw new Error(`${where}: id «${id}» — только латиница, цифры и дефис`);
  if (fileId && fileId !== id) throw new Error(`${where}: id «${id}» не совпадает с именем файла`);
  const kind = need('kind');
  if (!(DOC_KINDS as readonly string[]).includes(kind)) throw new Error(`${where}: kind «${kind}» — нужно ${DOC_KINDS.join(', ')}`);
  const group = need('group');
  if (!(DOC_GROUPS as readonly string[]).includes(group)) throw new Error(`${where}: неизвестная группа «${group}»`);
  return {
    id,
    title: need('title'),
    kind: kind as DocKind,
    group: group as DocGroup,
    icon: fields.icon ?? '',
    summary: fields.summary ?? '',
    related: fields.related ? parseList(fields.related) : [],
    code: fields.code ? parseList(fields.code) : [],
    body: m[2].trim(),
  };
}

const WIKI_RE = /\[\[([a-z0-9-]+)(?:\|([^\]]+))?\]\]/g;

/** id всех страниц, на которые ссылается текст через [[id]]. */
export function wikiTargets(md: string): string[] {
  return [...md.matchAll(WIKI_RE)].map(m => m[1]);
}

/**
 * Заменяет [[id]] и [[id|текст]] на markdown-ссылки #docs/id.
 * Ссылка на несуществующую страницу превращается в обычный текст.
 */
export function resolveWikiLinks(md: string, titles: ReadonlyMap<string, string>): string {
  return md.replace(WIKI_RE, (_all, id: string, text?: string) => {
    const title = titles.get(id);
    const label = text ?? title ?? id;
    return title ? `[${label}](#docs/${id})` : label;
  });
}

function norm(s: string): string {
  return s.toLowerCase().replace(/ё/g, 'е');
}

/** Поиск по страницам: все слова запроса должны встретиться; заголовок весит больше описания, описание больше текста. */
export function searchPages(pages: readonly DocPage[], query: string): DocPage[] {
  const words = norm(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [...pages];
  const scored: { page: DocPage; score: number }[] = [];
  for (const page of pages) {
    const title = norm(page.title + ' ' + page.id);
    const summary = norm(page.summary);
    const body = norm(page.body + ' ' + page.code.join(' '));
    let score = 0;
    let all = true;
    for (const w of words) {
      if (title.includes(w)) score += 10;
      else if (summary.includes(w)) score += 4;
      else if (body.includes(w)) score += 1;
      else { all = false; break; }
    }
    if (all) scored.push({ page, score });
  }
  return scored.sort((a, b) => b.score - a.score || a.page.title.localeCompare(b.page.title, 'ru')).map(s => s.page);
}

/** Страницы, которые ссылаются на данную (через related или [[id]] в тексте). */
export function backlinks(pages: readonly DocPage[], id: string): DocPage[] {
  return pages.filter(p => p.id !== id && (p.related.includes(id) || wikiTargets(p.body).includes(id)));
}

/** Порядок внутри группы: механики, объекты, таблицы; внутри — по алфавиту. */
export function sortPages(pages: readonly DocPage[]): DocPage[] {
  return [...pages].sort((a, b) =>
    DOC_GROUPS.indexOf(a.group) - DOC_GROUPS.indexOf(b.group) ||
    DOC_KINDS.indexOf(a.kind) - DOC_KINDS.indexOf(b.kind) ||
    a.title.localeCompare(b.title, 'ru'),
  );
}
