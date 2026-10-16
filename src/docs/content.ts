import { parsePage, sortPages, type DocPage } from './parse';

const files = import.meta.glob('../../docs/game/pages/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** Все страницы документации, отсортированные по группам. */
export const DOC_PAGES: DocPage[] = sortPages(
  Object.entries(files).map(([path, raw]) => {
    const fileId = path.split('/').pop()!.replace(/\.md$/, '');
    return parsePage(raw, fileId);
  }),
);

export const DOC_BY_ID: ReadonlyMap<string, DocPage> = new Map(DOC_PAGES.map(p => [p.id, p]));
