import { useEffect, useMemo, useRef, useState } from 'react';
import { Marked } from 'marked';
import { CONVAR_PAGES, DOC_BY_ID, DOC_PAGES, ITEM_ICONS, PAGE_CONVARS, conVarDescription } from '../docs/content';
import { iconUrl } from '../docs/icons';
import { schemeToHtml } from '../docs/scheme';
import { DOC_GROUPS, KIND_LABEL, backlinks, resolveWikiLinks, searchPages, type DocKind, type DocPage } from '../docs/parse';

type KindFilter = 'all' | DocKind;

const FILTERS: { id: KindFilter; label: string }[] = [
  { id: 'all', label: 'Всё' },
  { id: 'mechanic', label: 'Механики' },
  { id: 'object', label: 'Объекты' },
  { id: 'scheme', label: 'Схемы' },
  { id: 'data', label: 'Таблицы' },
];

const KIND_LETTER: Record<DocKind, string> = { mechanic: 'М', object: 'О', scheme: 'С', data: 'Т' };

const TITLES: ReadonlyMap<string, string> = new Map(DOC_PAGES.map(p => [p.id, p.title]));

const marked = new Marked({
  renderer: {
    code({ text, lang }) {
      return lang === 'scheme' ? schemeToHtml(text) : false;
    },
    codespan({ text }) {
      if (!ITEM_ICONS.has(text)) return false;
      return `<code class="docs-item"><img src="${iconUrl(text)}" alt="" loading="lazy">${text}</code>`;
    },
  },
});

function renderMarkdown(md: string): string {
  return marked.parse(resolveWikiLinks(md, TITLES), { async: false, gfm: true }) as string;
}

function PageIcon({ page, className }: { page: DocPage; className: string }) {
  return page.icon
    ? <img className={className} src={iconUrl(page.icon)} alt="" loading="lazy" />
    : <span className={className} aria-hidden="true" />;
}

function PageLink({ page, active }: { page: DocPage; active?: boolean }) {
  return (
    <a href={`#docs/${page.id}`} className={`docs-nav__link${active ? ' docs-nav__link--active' : ''}`}>
      <span className={`docs-kind docs-kind--${page.kind}`} title={KIND_LABEL[page.kind]}>
        {KIND_LETTER[page.kind]}
      </span>
      <PageIcon page={page} className="docs-nav__icon" />
      <span>{page.title}</span>
    </a>
  );
}

function Overview() {
  const count = (k: DocKind) => DOC_PAGES.filter(p => p.kind === k).length;
  return (
    <article className="docs-page">
      <h2 className="docs-page__title">Как устроен Rust изнутри</h2>
      <p className="docs-page__lead">
        Справочник по игровым механикам, восстановленный по декомпилированному коду сервера Rust.
        Механики объясняют общие алгоритмы, объекты описывают конкретные вещи и ссылаются на механики,
        в которых участвуют. Таблицы собраны автоматически из ассетов игры: HP, защита, урон, рецепты.
      </p>
      <p className="docs-page__meta">
        Механик: {count('mechanic')}, объектов: {count('object')}, схем: {count('scheme')}, таблиц: {count('data')}.
        Код и ассеты сервера от 16 октября 2026.
      </p>
      <div className="docs-groups">
        {DOC_GROUPS.map(g => {
          const pages = DOC_PAGES.filter(p => p.group === g);
          if (!pages.length) return null;
          return (
            <section key={g} className="docs-groups__card">
              <h3>{g}</h3>
              <ul>
                {pages.map(p => (
                  <li key={p.id}>
                    <PageLink page={p} />
                    {p.summary && <p className="docs-groups__summary">{p.summary}</p>}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </article>
  );
}

const SETTINGS_PREVIEW = 8;
const SETTINGS_LINKS = 3;

/** Текст с `кодом` в обратных кавычках. */
function InlineCode({ text }: { text: string }) {
  return <>{text.split(/(`[^`]+`)/).map((part, i) =>
    part.startsWith('`') && part.endsWith('`') && part.length > 1
      ? <code key={i}>{part.slice(1, -1)}</code>
      : <span key={i}>{part}</span>)}</>;
}

function SettingsBlock({ pageId }: { pageId: string }) {
  const list = PAGE_CONVARS.get(pageId) ?? [];
  const [all, setAll] = useState(false);
  if (!list.length) return null;
  const shown = all ? list : list.slice(0, SETTINGS_PREVIEW);
  return (
    <section className="docs-settings">
      <h3>Настройки сервера</h3>
      <p className="docs-settings__hint">
        Что администратор может изменить в этой механике. Значения по умолчанию — из кода сервера;
        на конкретном сервере они могут быть другими. <a href="#docs/data-server-settings">Все настройки</a>
      </p>
      <div className="docs-md">
        <table>
          <thead>
            <tr><th>Настройка</th><th>По умолчанию</th><th>Что делает</th><th>Ещё на страницах</th></tr>
          </thead>
          <tbody>
            {shown.map(c => {
              const others = (CONVAR_PAGES.get(c.name) ?? []).filter(id => id !== pageId);
              return (
                <tr key={c.name}>
                  <td><code>{c.name}</code></td>
                  <td>{c.default ?? '—'}</td>
                  <td><InlineCode text={conVarDescription(c)} /></td>
                  <td>
                    {others.length
                      ? others.slice(0, SETTINGS_LINKS).map((id, i) => (
                          <span key={id}>{i > 0 && ', '}<a href={`#docs/${id}`}>{DOC_BY_ID.get(id)?.title ?? id}</a></span>
                        ))
                      : '—'}
                    {others.length > SETTINGS_LINKS && (
                      <span className="docs-settings__extra"> и ещё {others.length - SETTINGS_LINKS}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {list.length > SETTINGS_PREVIEW && (
        <button type="button" className="docs-settings__more" onClick={() => setAll(v => !v)}>
          {all ? 'Свернуть' : `Показать все (${list.length})`}
        </button>
      )}
    </section>
  );
}

function Page({ page }: { page: DocPage }) {
  const html = useMemo(() => renderMarkdown(page.body), [page]);
  const related = page.related.map(id => DOC_BY_ID.get(id)).filter((p): p is DocPage => !!p);
  const incoming = useMemo(
    () => backlinks(DOC_PAGES, page.id).filter(p => !page.related.includes(p.id)),
    [page],
  );
  return (
    <article className="docs-page">
      <nav className="docs-page__crumbs">
        <a href="#docs">Документация</a> · {page.group} · {KIND_LABEL[page.kind]}
      </nav>
      <h2 className="docs-page__title">
        {page.icon && <img className="docs-page__icon" src={iconUrl(page.icon)} alt="" />}
        {page.title}
      </h2>
      {page.summary && <p className="docs-page__lead">{page.summary}</p>}
      <div className="docs-md" dangerouslySetInnerHTML={{ __html: html }} />
      {page.id !== 'data-server-settings' && <SettingsBlock key={page.id} pageId={page.id} />}
      {(related.length > 0 || incoming.length > 0) && (
        <footer className="docs-page__footer">
          {related.length > 0 && (
            <div>
              <h4>Связано</h4>
              <div className="docs-chips">{related.map(p => <PageLink key={p.id} page={p} />)}</div>
            </div>
          )}
          {incoming.length > 0 && (
            <div>
              <h4>Упоминается в</h4>
              <div className="docs-chips">{incoming.map(p => <PageLink key={p.id} page={p} />)}</div>
            </div>
          )}
          {page.code.length > 0 && (
            <div>
              <h4>Файлы кода</h4>
              <div className="docs-code-list">{page.code.map(f => <code key={f}>{f}</code>)}</div>
            </div>
          )}
        </footer>
      )}
    </article>
  );
}

export default function DocsSection({ pageId }: { pageId: string | null }) {
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<KindFilter>('all');
  const mainRef = useRef<HTMLDivElement>(null);
  const page = pageId ? DOC_BY_ID.get(pageId) ?? null : null;
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => new Set(page ? [page.group] : []));

  useEffect(() => {
    if (page) setOpenGroups(prev => (prev.has(page.group) ? prev : new Set(prev).add(page.group)));
  }, [page]);

  const toggleGroup = (g: string) =>
    setOpenGroups(prev => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g);
      else next.add(g);
      return next;
    });

  // при смене страницы — в самый верх, вместе с шапкой сайта (scrollIntoView прятал шапку)
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pageId]);

  const visible = useMemo(() => {
    const byKind = kind === 'all' ? DOC_PAGES : DOC_PAGES.filter(p => p.kind === kind);
    return query.trim() ? searchPages(byKind, query) : byKind;
  }, [query, kind]);

  return (
    <div className="docs">
      <aside className="docs-nav" aria-label="Оглавление документации">
        <input
          type="search"
          className="docs-nav__search"
          placeholder="Поиск: шкаф, сплэш, распад…"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <div className="docs-nav__filters" role="group" aria-label="Тип страниц">
          {FILTERS.map(f => (
            <button
              key={f.id}
              type="button"
              className={`docs-nav__filter${kind === f.id ? ' docs-nav__filter--active' : ''}`}
              aria-pressed={kind === f.id}
              onClick={() => setKind(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="docs-nav__list">
          {query.trim() ? (
            visible.length ? (
              <ul>
                {visible.map(p => (
                  <li key={p.id}>
                    <PageLink page={p} active={p.id === pageId} />
                    <p className="docs-nav__hint">{p.group}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="docs-nav__empty">Ничего не нашлось</p>
            )
          ) : (
            DOC_GROUPS.map(g => {
              const pages = visible.filter(p => p.group === g);
              if (!pages.length) return null;
              const open = openGroups.has(g);
              return (
                <div key={g} className="docs-nav__group">
                  <h3>
                    <button
                      type="button"
                      className="docs-nav__group-btn"
                      aria-expanded={open}
                      onClick={() => toggleGroup(g)}
                    >
                      <span className={`docs-nav__caret${open ? ' docs-nav__caret--open' : ''}`} aria-hidden="true">▸</span>
                      {g}
                      <span className="docs-nav__count">{pages.length}</span>
                    </button>
                  </h3>
                  {open && (
                    <ul>
                      {pages.map(p => (
                        <li key={p.id}><PageLink page={p} active={p.id === pageId} /></li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })
          )}
        </div>
      </aside>
      <div className="docs-main" ref={mainRef}>
        {pageId && !page ? (
          <article className="docs-page">
            <h2 className="docs-page__title">Страница не найдена</h2>
            <p>Нет страницы «{pageId}». <a href="#docs">К оглавлению</a></p>
          </article>
        ) : page ? (
          <Page page={page} />
        ) : (
          <Overview />
        )}
      </div>
    </div>
  );
}
