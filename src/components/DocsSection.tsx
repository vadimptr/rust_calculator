import { useEffect, useMemo, useRef, useState } from 'react';
import { marked } from 'marked';
import { DOC_BY_ID, DOC_PAGES } from '../docs/content';
import { DOC_GROUPS, KIND_LABEL, backlinks, resolveWikiLinks, searchPages, type DocKind, type DocPage } from '../docs/parse';

type KindFilter = 'all' | DocKind;

const FILTERS: { id: KindFilter; label: string }[] = [
  { id: 'all', label: 'Всё' },
  { id: 'mechanic', label: 'Механики' },
  { id: 'object', label: 'Объекты' },
  { id: 'data', label: 'Таблицы' },
];

const KIND_LETTER: Record<DocKind, string> = { mechanic: 'М', object: 'О', data: 'Т' };

const TITLES: ReadonlyMap<string, string> = new Map(DOC_PAGES.map(p => [p.id, p.title]));

function renderMarkdown(md: string): string {
  return marked.parse(resolveWikiLinks(md, TITLES), { async: false, gfm: true }) as string;
}

function PageLink({ page, active }: { page: DocPage; active?: boolean }) {
  return (
    <a href={`#docs/${page.id}`} className={`docs-nav__link${active ? ' docs-nav__link--active' : ''}`}>
      <span className={`docs-kind docs-kind--${page.kind}`} title={KIND_LABEL[page.kind]}>
        {KIND_LETTER[page.kind]}
      </span>
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
        Механик: {count('mechanic')}, объектов: {count('object')}, таблиц: {count('data')}.
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
      <h2 className="docs-page__title">{page.title}</h2>
      {page.summary && <p className="docs-page__lead">{page.summary}</p>}
      <div className="docs-md" dangerouslySetInnerHTML={{ __html: html }} />
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

  useEffect(() => {
    mainRef.current?.scrollIntoView({ block: 'start' });
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
              return (
                <div key={g} className="docs-nav__group">
                  <h3>{g}</h3>
                  <ul>
                    {pages.map(p => (
                      <li key={p.id}><PageLink page={p} active={p.id === pageId} /></li>
                    ))}
                  </ul>
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
