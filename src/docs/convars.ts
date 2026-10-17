/** Серверные настройки (ConVar) и их привязка к страницам документации. Без зависимостей от Vite. */
import type { DocPage } from './parse.ts';

export interface ConVar {
  name: string;
  default: string | null;
  type: string | null;
  help: string;
  file: string | null;
}

/** Пространства имён, которые к игровым механикам не относятся (или не описываются). */
const HIDDEN_PREFIXES = ['antihack.', 'analytics.', 'profile.', 'ping.', 'gc.', 'demo.', 'console.', 'debug.', 'app.'];

export function isHiddenConVar(name: string): boolean {
  return HIDDEN_PREFIXES.some(p => name.startsWith(p));
}

const NAME_RE = /(?<![\w.])([a-z][a-z0-9_]*\.[a-z0-9_]+)(?![\w(])/g;

/** Имена настроек, упомянутые в тексте. */
export function mentionedConVars(text: string, known: ReadonlySet<string>): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(NAME_RE)) {
    if (known.has(m[1])) found.add(m[1]);
  }
  return [...found];
}

/** Файл кода «узкий», если на него ссылается не больше стольких страниц. */
export const MAX_PAGES_PER_CODE_FILE = 5;

const base = (f: string) => f.split('/').pop()!;

/** Сколько страниц указывают каждый файл в поле code. */
export function codeFileUsage(pages: readonly DocPage[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const p of pages) for (const f of new Set(p.code.map(base))) m.set(f, (m.get(f) ?? 0) + 1);
  return m;
}

/**
 * Настройки, относящиеся к странице: сначала упомянутые в тексте, затем объявленные в файлах из поля code.
 * Файлы ConVar/* и «общие» файлы, на которые ссылается много страниц (например BasePlayer.cs),
 * не учитываются: иначе к странице прилипают сотни посторонних настроек.
 */
/** Небольшое пространство имён (heli.*, sentry.*) относится к одной механике целиком. */
export const MAX_SIBLING_NAMESPACE = 12;

const ns = (name: string) => name.split('.')[0];

export function conVarsForPage(page: DocPage, registry: readonly ConVar[], usage?: ReadonlyMap<string, number>): ConVar[] {
  const visible = registry.filter(c => !isHiddenConVar(c.name));
  const byName = new Map(visible.map(c => [c.name, c]));
  const nsSize = new Map<string, number>();
  for (const c of visible) nsSize.set(ns(c.name), (nsSize.get(ns(c.name)) ?? 0) + 1);
  const direct = mentionedConVars(page.body, new Set(byName.keys())).sort();
  const smallNs = new Set(direct.map(ns).filter(n => (nsSize.get(n) ?? 0) <= MAX_SIBLING_NAMESPACE));
  const siblings = visible
    .filter(c => smallNs.has(ns(c.name)) && !direct.includes(c.name))
    .map(c => c.name)
    .sort();
  const mentioned = [...direct, ...siblings];
  const codeFiles = new Set(page.code.map(base).filter(f => (usage?.get(f) ?? 1) <= MAX_PAGES_PER_CODE_FILE));
  const declared = visible
    .filter(c => c.file && !c.file.startsWith('ConVar/') && codeFiles.has(base(c.file)) && !mentioned.includes(c.name))
    .map(c => c.name)
    .sort();
  return [...mentioned, ...declared].map(n => byName.get(n)!);
}
