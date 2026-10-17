import { useEffect, useState, lazy, Suspense } from 'react';

const BlueprintSection = lazy(() => import('./components/BlueprintSection'));
const DocsSection = lazy(() => import('./components/DocsSection'));

import './App.css';

type Section = 'build' | 'docs';

const SECTIONS: { id: Section; label: string }[] = [
  { id: 'build', label: 'Строительство' },
  { id: 'docs', label: 'Документация' },
];

function sectionFromHash(): Section {
  const h = window.location.hash.replace('#', '').split('/')[0];
  return SECTIONS.some(s => s.id === h) ? (h as Section) : 'build';
}

/** id страницы документации из адреса вида #docs/<id>. */
function docIdFromHash(): string | null {
  const m = window.location.hash.match(/^#docs\/([a-z0-9-]+)$/);
  return m ? m[1] : null;
}

function App() {
  const [section, setSection] = useState<Section>(sectionFromHash);
  const [docId, setDocId] = useState<string | null>(docIdFromHash);

  useEffect(() => {
    const onHash = () => {
      setSection(sectionFromHash());
      setDocId(docIdFromHash());
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const selectSection = (s: Section) => {
    setSection(s);
    setDocId(null);
    window.history.replaceState(null, '', s === 'build' ? window.location.pathname : `#${s}`);
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header__inner">
          <h1 className="app-header__title">
            <span className="app-header__rust">RUST</span>
            {' '}Калькулятор постройки
          </h1>
          <nav className="tabs" aria-label="Разделы">
            {SECTIONS.map(s => (
              <button
                key={s.id}
                type="button"
                className={`tabs__btn${s.id === section ? ' tabs__btn--active' : ''}`}
                onClick={() => selectSection(s.id)}
                aria-pressed={s.id === section}
              >
                {s.label}
              </button>
            ))}
          </nav>
        </div>
      </header>
      <div className="app-layout app-layout--wide">
        <main className="app-main">
          {section === 'docs' ? (
            <Suspense fallback={<div className="bp__loading">Загрузка документации…</div>}>
              <DocsSection pageId={docId} />
            </Suspense>
          ) : (
            <Suspense fallback={<div className="bp__loading">Загрузка 3D…</div>}>
              <BlueprintSection />
            </Suspense>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
